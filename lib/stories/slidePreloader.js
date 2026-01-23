import { AppState } from 'react-native'
import { preloadImage } from './imageCache'
import { preloadVideo, isVideoCached, getCachedVideoPath, setVideoDuration } from './videoCache'
import { isImageCached } from './imageCache'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { initializeCacheManagement, cleanupCacheManagement } from './cacheManager'

// Priority levels
export const PRIORITY = {
  HIGH: 'high',      // Current slide - load immediately
  MEDIUM: 'medium',  // Next slide - load with minimal delay
  LOW: 'low',        // Other slides - load with delay
}

// Throttling delays (in milliseconds)
const DELAYS = {
  [PRIORITY.HIGH]: 0,        // No delay for high priority
  [PRIORITY.MEDIUM]: 100,    // 100ms delay for medium priority
  [PRIORITY.LOW]: 200,       // 200ms delay for low priority
}

// Cache key for slide preload status
const PRELOAD_STATUS_KEY = 'stories.slidePreload.status'

// Queue state
let highPriorityQueue = []
let lowPriorityQueue = []
let isProcessing = false
let isPaused = false
let currentProcessingSlideId = null
let processingTimeout = null

// Status tracking: pending, loading, cached, error
const slideStatus = new Map()

// Event listeners for slide ready notifications
const slideReadyListeners = new Map()

/**
 * Get preload status from AsyncStorage
 * @returns {Promise<Map<string, string>>} Map of slideId -> status
 */
async function getPreloadStatusFromStorage() {
  try {
    const statusStr = await AsyncStorage.getItem(PRELOAD_STATUS_KEY)
    if (statusStr) {
      const status = JSON.parse(statusStr)
      return new Map(Object.entries(status))
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[slidePreloader] Error getting preload status:', error)
    }
  }
  return new Map()
}

/**
 * Save preload status to AsyncStorage
 * @param {Map<string, string>} status - Map of slideId -> status
 */
async function savePreloadStatusToStorage(status) {
  try {
    const statusObj = Object.fromEntries(status)
    await AsyncStorage.setItem(PRELOAD_STATUS_KEY, JSON.stringify(statusObj))
  } catch (error) {
    if (__DEV__) {
      console.warn('[slidePreloader] Error saving preload status:', error)
    }
  }
}

/**
 * Update slide status
 * @param {string} slideId - Slide ID
 * @param {string} status - Status: 'pending', 'loading', 'cached', 'error'
 */
async function updateSlideStatus(slideId, status) {
  slideStatus.set(slideId, status)
  
  // Save to AsyncStorage
  const storageStatus = await getPreloadStatusFromStorage()
  storageStatus.set(slideId, status)
  await savePreloadStatusToStorage(storageStatus)

  // Notify listeners if cached
  if (status === 'cached') {
    const listeners = slideReadyListeners.get(slideId)
    if (listeners) {
      listeners.forEach(listener => listener())
      slideReadyListeners.delete(slideId)
    }
  }
}

/**
 * Check if slide media is already cached
 * @param {Object} slide - Slide object
 * @returns {Promise<boolean>} True if slide is cached
 */
async function isSlideMediaCached(slide) {
  if (!slide || !slide.id) {
    return false
  }

  // Check image
  if (slide.type === 'image' && slide.background) {
    const imageCached = await isImageCached(slide.background)
    if (!imageCached) {
      return false
    }
  }

  // Check video
  if (slide.type === 'video' && slide.background) {
    const videoCached = await isVideoCached(slide.id)
    if (!videoCached) {
      return false
    }
  }

  return true
}

/**
 * Preload a single slide
 * @param {Object} slide - Slide object
 * @param {string} priority - Priority level
 * @returns {Promise<boolean>} True if successfully preloaded
 */
async function preloadSlideMedia(slide, priority) {
  if (!slide || !slide.id) {
    return false
  }

  const slideId = slide.id

  // Check if already cached
  const alreadyCached = await isSlideMediaCached(slide)
  if (alreadyCached) {
    await updateSlideStatus(slideId, 'cached')
    return true
  }

  // Update status to loading
  await updateSlideStatus(slideId, 'loading')
  currentProcessingSlideId = slideId

  try {
    // Preload image or video based on slide type
    if (slide.type === 'image' && slide.background) {
      const success = await preloadImage(slide.background)
      if (success) {
        await updateSlideStatus(slideId, 'cached')
        return true
      } else {
        await updateSlideStatus(slideId, 'error')
        return false
      }
    } else if (slide.type === 'video' && slide.background) {
      try {
        if (__DEV__) {
          console.log(`[slidePreloader] Starting video preload for slide ${slideId}`)
        }
        const result = await preloadVideo(slideId, slide.background)
        if (result && result.path) {
          if (__DEV__) {
            console.log(`[slidePreloader] Video preloaded successfully for slide ${slideId}: ${result.path}`)
          }
          // If duration is provided, save it
          if (result.duration) {
            await setVideoDuration(slideId, result.duration)
          }
          await updateSlideStatus(slideId, 'cached')
          return true
        } else {
          if (__DEV__) {
            console.warn(`[slidePreloader] Video preload failed for slide ${slideId}: no path returned`)
          }
          await updateSlideStatus(slideId, 'error')
          return false
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(`[slidePreloader] Video preload error for slide ${slideId}:`, error)
        }
        if (error.message === 'Video preload cancelled') {
          // Don't mark as error if cancelled
          await updateSlideStatus(slideId, 'pending')
          return false
        }
        await updateSlideStatus(slideId, 'error')
        return false
      }
    } else {
      // No media to preload
      await updateSlideStatus(slideId, 'cached')
      return true
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[slidePreloader] Error preloading slide:', slideId, error)
    }
    await updateSlideStatus(slideId, 'error')
    return false
  } finally {
    currentProcessingSlideId = null
  }
}

/**
 * Process next item in queue
 */
async function processNext() {
  // Don't process if paused or already processing
  if (isPaused || isProcessing) {
    return
  }

  // Check if there's anything in queues
  if (highPriorityQueue.length === 0 && lowPriorityQueue.length === 0) {
    isProcessing = false
    return
  }

  isProcessing = true

  // Get next slide from high priority queue first, then low priority
  let nextSlide = null
  let nextPriority = null

  if (highPriorityQueue.length > 0) {
    nextSlide = highPriorityQueue.shift()
    nextPriority = PRIORITY.HIGH
  } else if (lowPriorityQueue.length > 0) {
    nextSlide = lowPriorityQueue.shift()
    nextPriority = PRIORITY.LOW
  }

  if (!nextSlide) {
    isProcessing = false
    return
  }

  const { slide, priority } = nextSlide
  const delay = DELAYS[priority] || DELAYS[PRIORITY.LOW]

  if (__DEV__) {
    console.log(`[slidePreloader] Processing slide ${slide.id} (${slide.type}) with priority ${priority}, delay: ${delay}ms`)
  }

  // Apply delay for low/medium priority (high priority has 0 delay)
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  // Check if paused during delay
  if (isPaused) {
    // Put back in queue
    if (priority === PRIORITY.HIGH) {
      highPriorityQueue.unshift(nextSlide)
    } else {
      lowPriorityQueue.unshift(nextSlide)
    }
    isProcessing = false
    return
  }

  // Preload the slide
  await preloadSlideMedia(slide, priority)

  // Process next item
  isProcessing = false
  processNext()
}

/**
 * Add slide to preload queue
 * @param {Object} slide - Slide object
 * @param {string} priority - Priority level (HIGH, MEDIUM, LOW)
 */
function addToQueue(slide, priority = PRIORITY.LOW) {
  if (!slide || !slide.id) {
    return
  }

  const slideId = slide.id

  // Check if already in queue
  const inHighQueue = highPriorityQueue.some(item => item.slide.id === slideId)
  const inLowQueue = lowPriorityQueue.some(item => item.slide.id === slideId)

  if (inHighQueue || inLowQueue) {
    return // Already queued
  }

  // Check current status
  const currentStatus = slideStatus.get(slideId)
  if (currentStatus === 'cached' || currentStatus === 'loading') {
    return // Already cached or loading
  }

  const queueItem = { slide, priority }

  if (priority === PRIORITY.HIGH) {
    highPriorityQueue.push(queueItem)
  } else {
    lowPriorityQueue.push(queueItem)
  }

  // Start processing if not already processing
  if (!isProcessing) {
    processNext()
  }
}

/**
 * Preload a single slide with priority
 * @param {Object} slide - Slide object
 * @param {string} priority - Priority level (default: LOW)
 * @returns {Promise<boolean>} True if successfully queued
 */
export async function preloadSlide(slide, priority = PRIORITY.LOW) {
  if (!slide || !slide.id) {
    return false
  }

  const slideId = slide.id

  // Check if already cached
  const alreadyCached = await isSlideMediaCached(slide)
  if (alreadyCached) {
    await updateSlideStatus(slideId, 'cached')
    return true
  }

  // Add to queue
  addToQueue(slide, priority)
  return true
}

/**
 * Preload all slides from stories
 * @param {Array} stories - Array of story objects
 * @param {Object} options - Options
 * @param {number} options.currentStoryIndex - Current story index (for prioritization)
 * @param {number} options.currentSlideIndex - Current slide index (for prioritization)
 * @param {boolean} options.preloadAll - If false, only preload visible/next slides (default: true)
 */
export async function preloadSlides(stories, options = {}) {
  if (!stories || !Array.isArray(stories) || stories.length === 0) {
    return
  }

  const {
    currentStoryIndex = 0,
    currentSlideIndex = 0,
    preloadAll = true,
  } = options

  // Initialize status from storage
  const storageStatus = await getPreloadStatusFromStorage()
  storageStatus.forEach((status, slideId) => {
    slideStatus.set(slideId, status)
  })

  // Collect all slides with their priorities
  const slidesToPreload = []

  stories.forEach((story, storyIdx) => {
    if (!story.slides || !Array.isArray(story.slides)) {
      return
    }

    story.slides.forEach((slide, slideIdx) => {
      if (!slide || !slide.id) {
        return
      }

      // Determine priority
      let priority = PRIORITY.LOW

      if (storyIdx === currentStoryIndex) {
        if (slideIdx === currentSlideIndex) {
          priority = PRIORITY.HIGH // Current slide
        } else if (slideIdx === currentSlideIndex + 1) {
          priority = PRIORITY.MEDIUM // Next slide
        } else if (preloadAll) {
          priority = PRIORITY.LOW // Other slides in current story
        } else {
          return // Skip if not preloading all
        }
      } else if (storyIdx === currentStoryIndex + 1 && preloadAll) {
        priority = PRIORITY.MEDIUM // Next story
      } else if (preloadAll) {
        priority = PRIORITY.LOW // Other stories
      } else {
        return // Skip if not preloading all
      }

      slidesToPreload.push({ slide, priority })
    })
  })

  // Add slides to queue with delay to avoid blocking
  // Use setTimeout to ensure this runs in background
  setTimeout(() => {
    slidesToPreload.forEach(({ slide, priority }) => {
      addToQueue(slide, priority)
    })
  }, 0)
}

/**
 * Check if slide is preloaded
 * @param {string} slideId - Slide ID
 * @returns {Promise<boolean>} True if slide is preloaded
 */
export async function isSlidePreloaded(slideId) {
  if (!slideId) {
    return false
  }

  // Check in-memory status first
  const status = slideStatus.get(slideId)
  if (status === 'cached') {
    return true
  }

  // Check storage status
  const storageStatus = await getPreloadStatusFromStorage()
  return storageStatus.get(slideId) === 'cached'
}

/**
 * Get preload status for a slide
 * @param {string} slideId - Slide ID
 * @returns {Promise<string>} Status: 'pending', 'loading', 'cached', 'error', or null
 */
export async function getPreloadStatus(slideId) {
  if (!slideId) {
    return null
  }

  // Check in-memory status first
  const status = slideStatus.get(slideId)
  if (status) {
    return status
  }

  // Check storage status
  const storageStatus = await getPreloadStatusFromStorage()
  return storageStatus.get(slideId) || 'pending'
}

/**
 * Cancel all preloads
 */
export function cancelAllPreloads() {
  // Clear queues
  highPriorityQueue = []
  lowPriorityQueue = []

  // Cancel current processing
  if (currentProcessingSlideId) {
    // Note: We can't cancel Image.prefetch(), but we can cancel video downloads
    // Video cancellation is handled in videoCache
    currentProcessingSlideId = null
  }

  // Clear timeout
  if (processingTimeout) {
    clearTimeout(processingTimeout)
    processingTimeout = null
  }

  isProcessing = false
}

/**
 * Pause preloading
 */
export function pausePreloading() {
  isPaused = true
}

/**
 * Resume preloading
 */
export function resumePreloading() {
  if (isPaused) {
    isPaused = false
    // Resume processing if there are items in queue
    if (!isProcessing && (highPriorityQueue.length > 0 || lowPriorityQueue.length > 0)) {
      processNext()
    }
  }
}

/**
 * Add listener for slide ready notification
 * @param {string} slideId - Slide ID
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function onSlideReady(slideId, callback) {
  if (!slideId || typeof callback !== 'function') {
    return () => {}
  }

  // Check if already cached
  isSlidePreloaded(slideId).then(cached => {
    if (cached) {
      callback()
      return
    }
  })

  // Add listener
  if (!slideReadyListeners.has(slideId)) {
    slideReadyListeners.set(slideId, [])
  }
  slideReadyListeners.get(slideId).push(callback)

  // Return unsubscribe function
  return () => {
    const listeners = slideReadyListeners.get(slideId)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
      if (listeners.length === 0) {
        slideReadyListeners.delete(slideId)
      }
    }
  }
}

// Initialize AppState listener for pause/resume
let appStateSubscription = null

/**
 * Initialize AppState integration
 */
export function initializeAppStateIntegration() {
  if (appStateSubscription) {
    return // Already initialized
  }

  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      pausePreloading()
    } else if (nextAppState === 'active') {
      resumePreloading()
    }
  }

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange)
}

/**
 * Cleanup AppState integration
 */
export function cleanupAppStateIntegration() {
  if (appStateSubscription) {
    appStateSubscription.remove()
    appStateSubscription = null
  }
}

// Auto-initialize AppState integration
initializeAppStateIntegration()

// Auto-initialize cache management
initializeCacheManagement()
