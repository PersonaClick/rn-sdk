import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View,
  Modal,
  Text,
  Pressable,
  Dimensions,
  PanResponder,
  Animated,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native'
import StorySlide from './StorySlide'
import StoryTimeline from './StoryTimeline.js'
import ProductsCarousel from './ProductsCarousel'
import { styles, getDuration, getStartSlideIndex, extractNumericId, extractSlideIdForTracking, getColorFromSettings, DEFAULT_COLORS } from './styles'
import { markSlideAsViewed, getStartSlideIndex as getStorageStartIndex, setLastSeenSlide } from '../../lib/stories/storage'
import { isSlidePreloaded, preloadSlide, onSlideReady, PRIORITY } from '../../lib/stories/slidePreloader'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

/**
 * StoryViewer Component
 * Full-screen modal for viewing stories with navigation and progress tracking
 * 
 * @param {Object} props
 * @param {boolean} props.visible - Whether modal is visible
 * @param {Story[]} props.stories - Array of stories
 * @param {number} props.initialStoryIndex - Initial story index to start with
 * @param {number} [props.initialSlideIndex] - Initial slide index within story
 * @param {Object} [props.settings] - Stories settings from API (colors, etc.)
 * @param {Function} props.onClose - Callback when viewer is closed
 * @param {Object} props.sdk - SDK instance
 * @param {string} props.code - Stories code identifier
 * @param {Function} [props.onElementPress] - Callback when element is pressed
 */
export default function StoryViewer({
  visible,
  stories,
  initialStoryIndex,
  initialSlideIndex,
  settings,
  onClose,
  sdk,
  code,
  onElementPress,
}) {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex || 0)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [mediaLoaded, setMediaLoaded] = useState(false)
  const [mediaPreloaded, setMediaPreloaded] = useState(false) // Track if media is preloaded
  
  // Carousel state
  const [carouselVisible, setCarouselVisible] = useState(false)
  const [carouselProducts, setCarouselProducts] = useState([])
  
  const [carouselHideLabel, setCarouselHideLabel] = useState('Скрыть')
  
  const timerRef = useRef(null)
  const progressTimerRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const isLongPressingRef = useRef(false)
  
  // Use refs for functions used in timers to avoid recreating callbacks
  const nextSlideRef = useRef(null)
  const nextStoryRef = useRef(null)
  const clearTimersRef = useRef(null)
  
  // Use ref for isPaused to always have current value inside timer
  const isPausedRef = useRef(false)
  
  // Store current progress step when paused to resume from same position
  const pausedProgressStepRef = useRef(0)
  
  // Use ref for progress to always have current value
  const progressRef = useRef(0)
  
  // Use refs for current story and slide index to always have current values
  const currentStoryRef = useRef(null)
  const currentSlideRef = useRef(null)
  const currentStoryIndexRef = useRef(initialStoryIndex || 0)
  const currentSlideIndexRef = useRef(0)
  const mediaLoadedRef = useRef(false)
  const storiesRef = useRef(stories)
  const startProgressTimerRef = useRef(null)
  const elementPressTimeoutRef = useRef(null)
  const handleLongPressStartRef = useRef(null)
  const handleLongPressEndRef = useRef(null)
  
  // Animation for swipe down to close
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  const backdropOpacity = useRef(new Animated.Value(1)).current // Backdrop opacity for host screen visibility
  const isClosingRef = useRef(false)

  // Memoize current story and slide to avoid recalculation
  const currentStory = useMemo(() => stories?.[currentStoryIndex], [stories, currentStoryIndex])
  const currentSlide = useMemo(() => currentStory?.slides?.[currentSlideIndex], [currentStory, currentSlideIndex])

  // Memoize slide IDs to avoid recreating array on each render
  const slideIds = useMemo(() => {
    return currentStory?.slides?.map(slide => slide.id) || []
  }, [currentStory])

  // Update currentStoryIndex when visible becomes true or initialStoryIndex changes
  useEffect(() => {
    if (visible) {
      const targetIndex = initialStoryIndex ?? 0
      // Always sync ref/state when opening to avoid stale index
      currentStoryIndexRef.current = targetIndex
      setCurrentStoryIndex(targetIndex)
      // Reset slide index refs/state immediately; start index will be set after storage lookup
      currentSlideIndexRef.current = 0
      setCurrentSlideIndex(0)
      setProgress(0)
      progressRef.current = 0
      pausedProgressStepRef.current = 0
      setIsPaused(false)
      isPausedRef.current = false
      clearTimers()
    }
  }, [visible, initialStoryIndex])

  // Reset slide index when story index changes to avoid stale progress state
  // Use ref to track previous story index to avoid resetting on first open
  const previousStoryIndexRef = useRef(currentStoryIndex)
  useEffect(() => {
    if (!visible) return
    // Only reset if story actually changed (not on first open)
    if (previousStoryIndexRef.current !== currentStoryIndex) {
      currentSlideIndexRef.current = 0
      setCurrentSlideIndex(0)
      setProgress(0)
      pausedProgressStepRef.current = 0
      setIsPaused(false)
      previousStoryIndexRef.current = currentStoryIndex
    }
  }, [visible, currentStoryIndex])

  useEffect(() => {
    if (visible && currentStory && slideIds.length > 0) {
      // Reset media loaded state when story changes
      setMediaLoaded(false)
      clearTimers()
      // Reset to a safe default immediately to avoid stale ref usage
      const defaultIndex = initialSlideIndex || currentStory.startPosition || 0
      const maxIndex = slideIds.length - 1
      const safeDefaultIndex = Math.min(Math.max(defaultIndex, 0), maxIndex)
      currentSlideIndexRef.current = safeDefaultIndex
      setCurrentSlideIndex(safeDefaultIndex)
      setProgress(0)
      progressRef.current = 0
      pausedProgressStepRef.current = 0
      setIsPaused(false)
      isPausedRef.current = false
      
      const storyId = currentStory.id
      let isActive = true

      // Get starting slide index from storage
      getStorageStartIndex(storyId, slideIds, initialSlideIndex || currentStory.startPosition || 0)
        .then(startIndex => {
          if (!isActive || currentStoryRef.current?.id !== storyId) {
            return
          }
          const safeStartIndex = Math.min(Math.max(startIndex, 0), maxIndex)
          // Sync ref/state immediately to avoid mismatch with progress/handlers
          currentSlideIndexRef.current = safeStartIndex
          setCurrentSlideIndex(safeStartIndex)
          // Reset progress and pause state for new start
          setProgress(0)
          progressRef.current = 0
          pausedProgressStepRef.current = 0
          setIsPaused(false)
          isPausedRef.current = false
          // Don't start timer yet - wait for media to load
        })
        .catch(error => {
          if (!isActive || currentStoryRef.current?.id !== storyId) {
            return
          }
          console.warn('[StoryViewer] Error getting start slide index:', error)
          // Fallback to default
          const fallbackIndex = initialSlideIndex || currentStory.startPosition || 0
          const safeFallbackIndex = Math.min(Math.max(fallbackIndex, 0), maxIndex)
          currentSlideIndexRef.current = safeFallbackIndex
          setCurrentSlideIndex(safeFallbackIndex)
          setProgress(0)
          progressRef.current = 0
          pausedProgressStepRef.current = 0
          setIsPaused(false)
          isPausedRef.current = false
        })

      return () => {
        isActive = false
      }
    }
  }, [visible, currentStoryIndex, currentStory, slideIds, initialSlideIndex])

  // Check if current slide media is preloaded
  // For video slides: show immediately (streaming), don't wait for full preload
  // For image slides: check preload status, show loading indicator if not ready
  useEffect(() => {
    if (visible && currentSlide) {
      if (__DEV__) {
        console.log(`[StoryViewer] Checking preload for slide ${currentSlide.id}, type: ${currentSlide.type}`)
      }
      // For video slides, show immediately - video will load and play via streaming
      if (currentSlide.type === 'video') {
        // Always show video slides immediately - don't wait for preload
        if (__DEV__) {
          console.log(`[StoryViewer] Video slide - setting mediaPreloaded=true immediately`)
        }
        setMediaPreloaded(true)
        // Start preloading in background for better performance (optional)
        preloadSlide(currentSlide, PRIORITY.HIGH).catch(() => {
          // Silent fail - video will load via streaming anyway
        })
      } else {
        // For image slides, check if preloaded
        setMediaPreloaded(false)
        isSlidePreloaded(currentSlide.id).then(preloaded => {
          if (preloaded) {
            setMediaPreloaded(true)
          } else {
            // If not preloaded, request high priority preload and wait for it
            preloadSlide(currentSlide, PRIORITY.HIGH).then(() => {
              // Wait for slide to be ready
              const unsubscribe = onSlideReady(currentSlide.id, () => {
                setMediaPreloaded(true)
                unsubscribe()
              })
            }).catch(() => {
              // If preload fails, show anyway after a short delay
              setTimeout(() => {
                setMediaPreloaded(true)
              }, 500)
            })
          }
        }).catch(() => {
          // If check fails, show anyway after a short delay
          setTimeout(() => {
            setMediaPreloaded(true)
          }, 500)
        })
      }
    } else if (!visible) {
      // Reset when modal closes
      setMediaPreloaded(false)
    }
  }, [visible, currentSlide?.id, currentSlide?.type])

  useEffect(() => {
    if (visible) {
      // Reset media loaded state and progress when slide changes
      setMediaLoaded(false)
      // Don't reset mediaPreloaded here - let the preload check useEffect handle it
      // This prevents race condition where video slides get stuck on loading
      setProgress(0) // Reset progress immediately when slide changes
      progressRef.current = 0
      pausedProgressStepRef.current = 0 // Reset paused step when slide changes
      setIsPaused(false) // Reset pause state when slide changes
      isPausedRef.current = false
      clearTimers()
      // Clear video duration for previous slide (will be set when new video loads)
      
      // Preload next slide with medium priority
      if (currentStory?.slides) {
        const nextSlideIndex = currentSlideIndex + 1
        if (nextSlideIndex < currentStory.slides.length) {
          const nextSlide = currentStory.slides[nextSlideIndex]
          if (nextSlide) {
            preloadSlide(nextSlide, PRIORITY.MEDIUM)
          }
        }
      }
      
      // Clear any pending element press timeout
      if (elementPressTimeoutRef.current) {
        clearTimeout(elementPressTimeoutRef.current)
        elementPressTimeoutRef.current = null
      }
    }
    
    return () => {
      clearTimers()
      // Cleanup timeout on unmount
      if (elementPressTimeoutRef.current) {
        clearTimeout(elementPressTimeoutRef.current)
        elementPressTimeoutRef.current = null
      }
    }
  }, [visible, currentSlide?.id, currentSlideIndex, currentStory, clearTimers])

  // Reset progress and media loaded when slide index changes (e.g., when resuming from storage)
  useEffect(() => {
    if (visible) {
      setMediaLoaded(false)
      setProgress(0)
      progressRef.current = 0
      pausedProgressStepRef.current = 0
      clearTimers()
    }
  }, [currentSlideIndex, visible, clearTimers])

  useEffect(() => {
    if (visible && currentSlide && mediaLoaded) {
      // Track slide view only after media is loaded
      if (sdk && code) {
        const storyIdToUse = extractNumericId(currentStory.id, currentStory.ids)
        // If slide.id is string, use slideIndex; if number, use slide.id as is
        const slideIdToUse = extractSlideIdForTracking(currentSlide.id, currentSlideIndex)
        
        sdk.trackStoryView(storyIdToUse, slideIdToUse, code, currentSlideIndex)
      }
      
      // Don't mark slide as viewed immediately - wait for it to complete or be navigated away
    }
  }, [currentSlide, mediaLoaded, currentSlideIndex])

  useEffect(() => {
    if (!visible) {
      // Save last seen slide when closing
      const story = currentStoryRef.current
      const slideIndex = currentSlideIndexRef.current

      if (story && story.slides && slideIndex >= 0 && slideIndex < story.slides.length) {
        const currentSlideToSave = story.slides[slideIndex]
        if (currentSlideToSave) {
          setLastSeenSlide(story.id, currentSlideToSave.id)
        }
      }

    // Mark current slide as viewed when closing (like iOS didEndDisplaying)
    if (story && story.slides && slideIndex >= 0 && slideIndex < story.slides.length) {
      const currentSlideToMark = story.slides[slideIndex]
      if (currentSlideToMark) {
        markSlideAsViewed(story.id, currentSlideToMark.id)
      }
    }

      clearTimers()
      setMediaLoaded(false)
      // Reset animation when modal closes
      translateY.setValue(0)
      opacity.setValue(1)
      backdropOpacity.setValue(1)
      isClosingRef.current = false
    } else {
      // Reset animation when modal opens
      translateY.setValue(0)
      opacity.setValue(1)
      backdropOpacity.setValue(1)
      isClosingRef.current = false
      // Reset pause state and progress when opening
      setIsPaused(false)
      isPausedRef.current = false // Also reset ref
      setProgress(0)
      pausedProgressStepRef.current = 0
      setMediaLoaded(false) // Reset media loaded to trigger reload
    }
  }, [visible])

  // Update refs when state changes
  useEffect(() => {
    isPausedRef.current = isPaused
    progressRef.current = progress
    currentStoryRef.current = currentStory
    currentSlideRef.current = currentSlide
    currentStoryIndexRef.current = currentStoryIndex
    currentSlideIndexRef.current = currentSlideIndex
    mediaLoadedRef.current = mediaLoaded
    storiesRef.current = stories
  }, [isPaused, progress, currentStory, currentSlide, currentStoryIndex, currentSlideIndex, mediaLoaded, stories])

  // Guard: keep slide index within bounds of current story
  useEffect(() => {
    if (!visible || !currentStory?.slides?.length) return
    const maxIndex = currentStory.slides.length - 1
    if (currentSlideIndex < 0 || currentSlideIndex > maxIndex) {
      const safeIndex = Math.min(Math.max(currentSlideIndex, 0), maxIndex)
      if (__DEV__) {
        console.warn('[StoryViewer] Clamping slide index:', {
          currentSlideIndex,
          safeIndex,
          maxIndex,
          storyId: currentStory.id,
        })
      }
      currentSlideIndexRef.current = safeIndex
      setCurrentSlideIndex(safeIndex)
      setProgress(0)
      pausedProgressStepRef.current = 0
      setIsPaused(false)
    }
  }, [visible, currentStory, currentSlideIndex])
  
  // Start/restart timer when slide changes, media loads, or pause state changes
  useEffect(() => {
    if (visible && currentSlide && mediaLoaded && !isPaused) {
      // For video slides, ensure we have video duration before starting timer
      // This prevents timer from starting before video metadata is loaded
      if (currentSlide.type === 'video') {
        const videoDuration = videoDurationsRef.current[currentSlide.id]
        // If video duration is not available yet, wait for it
        // Timer will restart when duration arrives via handleVideoDuration
        if (!videoDuration || videoDuration <= 0) {
          if (__DEV__) {
            console.log(`[StoryViewer] Waiting for video duration before starting timer for slide ${currentSlide.id}`)
          }
          return
        }
      }
      startProgressTimer()
    } else if (isPaused || !mediaLoaded) {
      clearTimers()
    }
  }, [isPaused, mediaLoaded, visible, currentSlide, currentSlideIndex])

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])
  
  // Update refs when functions change
  useEffect(() => {
    clearTimersRef.current = clearTimers
    nextSlideRef.current = nextSlide
    nextStoryRef.current = nextStory
    startProgressTimerRef.current = startProgressTimer
    handleLongPressStartRef.current = handleLongPressStart
    handleLongPressEndRef.current = handleLongPressEnd
  }, [clearTimers, nextSlide, nextStory, startProgressTimer, handleLongPressStart, handleLongPressEnd])

  const handleMediaLoaded = useCallback(() => {
    setMediaLoaded(true)
  }, [])
  
  // Store video duration for slides that don't have duration set
  const videoDurationsRef = useRef({}) // slideId -> duration in seconds
  
  const handleVideoProgress = useCallback((currentTime, slideId) => {
    // For video slides, use video playback time as the source of truth for progress
    // currentTime is in seconds
    if (currentSlideRef.current?.id === slideId && currentSlideRef.current?.type === 'video') {
      const videoDuration = videoDurationsRef.current[slideId]
      if (videoDuration && videoDuration > 0) {
        // Calculate progress based on actual video playback time
        const progress = Math.min(1, currentTime / videoDuration)
        // Update progress to match video playback - this is the authoritative source for video slides
        setProgress(progress)
        progressRef.current = progress
      }
    }
  }, [])

  const handleVideoDuration = useCallback((duration, slideId) => {
    // Store video duration for the slide (duration is in seconds)
    if (slideId && duration > 0 && typeof duration === 'number' && !isNaN(duration) && isFinite(duration)) {
      videoDurationsRef.current[slideId] = duration
      if (__DEV__) {
        console.log(`[StoryViewer] Video duration stored: ${duration.toFixed(3)}s for slide ${slideId}, currentSlide=${currentSlideRef.current?.id}, mediaLoaded=${mediaLoadedRef.current}`)
      }
      // If this is the current slide and media is loaded, restart timer with correct duration
      if (currentSlideRef.current?.id === slideId && mediaLoadedRef.current && !isPausedRef.current) {
        if (__DEV__) {
          console.log(`[StoryViewer] Restarting timer with video duration: ${duration.toFixed(3)}s for slide ${slideId}`)
        }
        // Reset progress when restarting with correct duration
        setProgress(0)
        progressRef.current = 0
        pausedProgressStepRef.current = 0
        // Restart timer with correct duration using ref to avoid dependency
        startProgressTimerRef.current?.()
      }
    }
  }, [])

  const startProgressTimer = useCallback(() => {
    if (!currentSlide || isPausedRef.current || !mediaLoadedRef.current) {
      if (__DEV__) {
        console.log(`[StoryViewer] Timer blocked: currentSlide=${!!currentSlide}, isPaused=${isPausedRef.current}, mediaLoaded=${mediaLoadedRef.current}`)
      }
      return
    }
    
    // For video slides, ensure video is actually ready (not just metadata loaded)
    if (currentSlide.type === 'video') {
      // Additional check: video should be loaded and ready
      // This prevents timer from starting before video is ready to play
      if (!mediaLoadedRef.current) {
        if (__DEV__) {
          console.log(`[StoryViewer] Timer blocked for video: media not loaded yet`)
        }
        return
      }
    }
    
    // Always clear existing timers first
    clearTimers()
    
    // For video slides, always use duration from video file metadata
    // For other slides, use duration from API response
    let duration
    if (currentSlide.type === 'video') {
      const videoDuration = videoDurationsRef.current[currentSlide.id]
      if (videoDuration && videoDuration > 0 && typeof videoDuration === 'number' && !isNaN(videoDuration) && isFinite(videoDuration)) {
        // Convert from seconds to milliseconds - always use video file duration
        duration = videoDuration * 1000
        if (__DEV__) {
          console.log(`[StoryViewer] Using video duration: ${videoDuration.toFixed(3)}s (${duration}ms) for slide ${currentSlide.id}`)
        }
      } else {
        // Video duration not loaded yet - wait for it (timer will restart when duration arrives)
        // Use default duration temporarily to avoid timer issues
        duration = 10000 // Default 10 seconds, will be updated when video metadata loads
        if (__DEV__) {
          console.log(`[StoryViewer] Video duration not available yet for slide ${currentSlide.id}, using default: ${duration}ms`)
        }
      }
    } else {
      // For non-video slides, use duration from API response
      duration = getDuration(currentSlide)
      if (__DEV__) {
        console.log(`[StoryViewer] Using API duration: ${duration}ms for slide ${currentSlide.id}`)
      }
    }
    const progressInterval = 50 // Update every 50ms
    const totalSteps = duration / progressInterval
    
    if (__DEV__) {
      if (__DEV__) {
        console.log(`[ProgressTimer] Starting: duration=${duration}, totalSteps=${totalSteps}, slideId=${currentSlide.id}`)
      }
    }
    
    // Use saved progress step if resuming from pause, otherwise start from 0
    let currentStep = pausedProgressStepRef.current
    
    // If resuming from pause, restore progress value
    if (currentStep > 0) {
      const savedProgress = currentStep / totalSteps
      setProgress(savedProgress)
      if (__DEV__) {
      }
    } else {
      // Starting fresh - reset progress to 0
      setProgress(0)
      if (__DEV__) {
      }
    }
    
    progressTimerRef.current = setInterval(() => {
      // Check if paused inside the timer - if paused, save current step and clear timer
      if (isPausedRef.current) {
        pausedProgressStepRef.current = currentStep
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current)
          progressTimerRef.current = null
        }
        return
      }
      
      // For video slides, don't update progress from timer - use onProgress from video instead
      // This prevents conflicts between timer and video playback progress
      if (currentSlide.type === 'video') {
        // Only increment step for completion check, but don't update progress
        // Progress is updated by handleVideoProgress from video onProgress event
        currentStep++
        const newProgress = currentStep / totalSteps
        
        if (newProgress >= 1) {
          // Timer reached end - move to next slide
          // But for video, we rely on onEnd event, so this is just a fallback
          clearTimersRef.current?.()
          nextSlideRef.current?.()
        }
        return
      }
      
      // For non-video slides, update progress normally
      currentStep++
      const newProgress = currentStep / totalSteps
      setProgress(newProgress)
      progressRef.current = newProgress
      
      if (__DEV__ && currentStep % 20 === 0) {
        console.log(`[ProgressTimer] Update: step=${currentStep}, progress=${newProgress.toFixed(3)}`)
      }
      
      if (newProgress >= 1) {
        // Mark slide as viewed when it completes (like iOS didEndDisplaying)
        if (currentStoryRef.current && currentSlide) {
          markSlideAsViewed(currentStoryRef.current.id, currentSlide.id)
        }
        
        // Reset paused step when slide completes
        pausedProgressStepRef.current = 0
        clearTimersRef.current?.()
        nextSlideRef.current?.()
      }
    }, progressInterval)
  }, [currentSlide, clearTimers])

  const nextSlide = useCallback(() => {
    // Save last seen slide before navigating away
    const story = currentStoryRef.current
    const slideIndex = currentSlideIndexRef.current

    if (story && story.slides && slideIndex >= 0 && slideIndex < story.slides.length) {
      const currentSlideToSave = story.slides[slideIndex]
      if (currentSlideToSave) {
        setLastSeenSlide(story.id, currentSlideToSave.id)
      }
    }

    // Mark current slide as viewed when navigating away (like iOS didEndDisplaying)
    if (story && story.slides && slideIndex >= 0 && slideIndex < story.slides.length) {
      const currentSlideToMark = story.slides[slideIndex]
      if (currentSlideToMark) {
        markSlideAsViewed(story.id, currentSlideToMark.id)
      }
    }

    // Reset state before changing slide
    setMediaLoaded(false)
    setProgress(0)
    pausedProgressStepRef.current = 0 // Reset paused step when changing slides
    clearTimers()

    if (!story || !story.slides) {
      if (__DEV__) {
        console.warn('[StoryViewer] Cannot go to next slide: story is undefined')
      }
      return
    }

    if (slideIndex < story.slides.length - 1) {
      const nextIndex = slideIndex + 1
      currentSlideIndexRef.current = nextIndex
      setCurrentSlideIndex(nextIndex)
    } else {
      nextStoryRef.current?.()
    }
  }, [clearTimers, nextStory])

  const previousSlide = useCallback(() => {
    // Save last seen slide before navigating away
    const story = currentStoryRef.current
    const slideIndex = currentSlideIndexRef.current

    if (story && story.slides && slideIndex >= 0 && slideIndex < story.slides.length) {
      const currentSlideToSave = story.slides[slideIndex]
      if (currentSlideToSave) {
        setLastSeenSlide(story.id, currentSlideToSave.id)
      }
    }

    // Reset state before changing slide
    setMediaLoaded(false)
    setProgress(0)
    pausedProgressStepRef.current = 0 // Reset paused step when changing slides
    clearTimers()

    if (slideIndex > 0) {
      const prevIndex = slideIndex - 1
      currentSlideIndexRef.current = prevIndex
      setCurrentSlideIndex(prevIndex)
    } else {
      previousStory()
    }
  }, [clearTimers, previousStory])

  const nextStory = useCallback(() => {
    // Save last seen slide before moving to next story
    const story = currentStoryRef.current
    const slideIndex = currentSlideIndexRef.current

    if (story && story.slides && slideIndex >= 0 && slideIndex < story.slides.length) {
      const currentSlideToSave = story.slides[slideIndex]
      if (currentSlideToSave) {
        setLastSeenSlide(story.id, currentSlideToSave.id)
      }
    }

    // Mark current slide as viewed when moving to next story
    if (story && story.slides && slideIndex >= 0 && slideIndex < story.slides.length) {
      const currentSlideToMark = story.slides[slideIndex]
      if (currentSlideToMark) {
        markSlideAsViewed(story.id, currentSlideToMark.id)
      }
    }

    const storyIndex = currentStoryIndexRef.current
    // Use ref for stories as it's updated in useEffect and contains the latest value
    // Props might be empty initially when modal opens
    const storiesArray = storiesRef.current || stories

    // Check if there's a next story available - prefer ref over props
    if (storiesArray && Array.isArray(storiesArray) && storiesArray.length > 0) {
      const nextStoryIndex = storyIndex + 1
      if (nextStoryIndex < storiesArray.length) {
        currentStoryIndexRef.current = nextStoryIndex
        currentSlideIndexRef.current = 0
        setCurrentStoryIndex(nextStoryIndex)
        setCurrentSlideIndex(0)
        return
      }
    }

    // No more stories, close viewer
    onCloseRef.current?.()
  }, [stories, onClose, currentStoryIndex])

  const previousStory = () => {
    // Save last seen slide before moving to previous story
    const story = currentStoryRef.current
    const slideIndex = currentSlideIndexRef.current
    const storyIndex = currentStoryIndexRef.current
    // Use ref for stories as it's updated in useEffect and contains the latest value
    // Props might be empty initially when modal opens
    const storiesArray = storiesRef.current || stories

    if (story && story.slides && slideIndex >= 0 && slideIndex < story.slides.length) {
      const currentSlideToSave = story.slides[slideIndex]
      if (currentSlideToSave) {
        setLastSeenSlide(story.id, currentSlideToSave.id)
      }
    }

    if (storiesArray && Array.isArray(storiesArray) && storiesArray.length > 0 && storyIndex > 0) {
      const prevStoryIndex = storyIndex - 1
      const prevStory = storiesArray[prevStoryIndex]
      if (prevStory && prevStory.slides && prevStory.slides.length > 0) {
        currentStoryIndexRef.current = prevStoryIndex
        currentSlideIndexRef.current = prevStory.slides.length - 1
        setCurrentStoryIndex(prevStoryIndex)
        setCurrentSlideIndex(prevStory.slides.length - 1)
      } else {
        if (__DEV__) {
          console.warn('[StoryViewer] Previous story not found or has no slides')
        }
        onClose?.()
      }
    } else {
      // No previous story, close viewer
      onClose?.()
    }
  }

  const handleElementPress = useCallback((element) => {
    // Pause timer when element is pressed
    setIsPaused(true)
    clearTimers()
    
    // Track click event for slide element - use refs for current values
    if (sdk && code) {
      const story = currentStoryRef.current
      const slide = currentSlideRef.current || currentSlide
      const slideIndex = currentSlideIndexRef.current
      
      if (story && slide) {
        const storyIdToUse = extractNumericId(story.id, story.ids)
        const slideIdToUse = extractSlideIdForTracking(slide.id, slideIndex)
        sdk.trackStoryClick(storyIdToUse, slideIdToUse, code)
      }
    }
    
    // Track product view if element is a product
    if (element.type === 'product' && sdk && code) {
      const productData = element.item || element.product
      if (productData && productData.id) {
        sdk.track('view', {
          id: productData.id,
          recommended_by: 'stories',
          recommended_code: code,
        }).catch((err) => {
          if (__DEV__) {
            console.warn('Failed to track product view from slide:', err)
          }
        })
      }
    }
    
    // Handle products carousel
    const productsArray = element.products || element.items || []
    if (element.type === 'products' && productsArray.length > 0) {
      setCarouselProducts(productsArray)
      
      // Get hide label from slide settings (priority) or element labels (fallback)
      // Support both snake_case (from server) and camelCase formats
      // Priority: slide.settings?.labels?.hideCarousel/hide_carousel -> element.labels?.hideCarousel/hide_carousel -> 'Скрыть'
      const slide = currentSlideRef.current || currentSlide
      const hideLabel = slide?.settings?.labels?.hideCarousel
        || slide?.settings?.labels?.hide_carousel
        || element.labels?.hideCarousel
        || element.labels?.hide_carousel
        || 'Скрыть'
      setCarouselHideLabel(hideLabel)
      setCarouselVisible(true)
      return
    }
    
    // Handle deeplinks with platform detection
    let urlToOpen = null
    if (Platform.OS === 'ios') {
      urlToOpen = element.deeplinkIos || element.linkIos || element.link
    } else if (Platform.OS === 'android') {
      urlToOpen = element.deeplinkAndroid || element.linkAndroid || element.link
    } else {
      urlToOpen = element.link
    }
    
    // Use ref for mediaLoaded to avoid stale closure
    const mediaLoadedValue = mediaLoadedRef.current
    
    if (urlToOpen) {
      Linking.openURL(urlToOpen).catch((err) => {
        if (__DEV__) {
          console.warn('Failed to open URL:', err)
        }
      })
      
      // Resume timer after a short delay - store timeout ID for cleanup
      const timeoutId = setTimeout(() => {
        setIsPaused(false)
        if (mediaLoadedValue) {
          startProgressTimerRef.current?.()
        }
      }, 500)
      
      // Store timeout ID for potential cleanup
      elementPressTimeoutRef.current = timeoutId
    } else {
      const timeoutId = setTimeout(() => {
        setIsPaused(false)
        if (mediaLoadedValue) {
          startProgressTimerRef.current?.()
        }
      }, 100)
      elementPressTimeoutRef.current = timeoutId
    }
    
    onElementPress?.(element)
  }, [sdk, code, onElementPress])
  
  const handleCarouselClose = useCallback(() => {
    setCarouselVisible(false)
    setCarouselProducts([])
    // Resume timer after carousel closes
    setTimeout(() => {
      setIsPaused(false)
      if (mediaLoadedRef.current) {
        startProgressTimerRef.current?.()
      }
    }, 400)
  }, [])
  
  const handleCarouselProductPress = useCallback((product) => {
    // Track product view from carousel
    if (sdk && product.id && code) {
      sdk.track('view', {
        id: product.id,
        recommended_by: 'stories',
        recommended_code: code,
      }).catch((err) => {
        if (__DEV__) {
          console.warn('Failed to track product view from carousel:', err)
        }
      })
    }
    
    // Determine which URL to use based on platform
    let urlToOpen = null
    
    if (Platform.OS === 'ios') {
      urlToOpen = product.deeplinkIos || product.url
    } else if (Platform.OS === 'android') {
      urlToOpen = product.deeplinkAndroid || product.url
    } else {
      // Fallback for other platforms
      urlToOpen = product.url
    }
    
    if (urlToOpen) {
      Linking.openURL(urlToOpen).catch((err) => {
        if (__DEV__) {
          console.warn('Failed to open product URL:', err)
        }
      })
    }
    
    // Close carousel and resume timer
    handleCarouselClose()
  }, [handleCarouselClose, sdk, code])

  const handleLongPressStart = useCallback(() => {
    isLongPressingRef.current = true
    isPausedRef.current = true
    
    // Save current progress step BEFORE clearing timer
    const slide = currentSlideRef.current
    if (slide && progressTimerRef.current) {
      const duration = getDuration(slide)
      const progressInterval = 50
      const totalSteps = duration / progressInterval
      // Calculate current step from current progress (0-1)
      const currentStep = Math.floor(progressRef.current * totalSteps)
      pausedProgressStepRef.current = currentStep
    }
    
    setIsPaused(true)
    clearTimers()
  }, [clearTimers])

  const handleLongPressEnd = useCallback(() => {
    isLongPressingRef.current = false
    isPausedRef.current = false
    setIsPaused(false)
    // Timer will restart automatically via useEffect when isPaused becomes false
  }, [])

  const handleSwipeDown = useCallback((gestureState) => {
    if (isClosingRef.current) return
    
    const { dy } = gestureState
    const swipeThreshold = screenHeight * 0.2 // 20% of screen height
    
    if (dy > swipeThreshold) {
      // Swipe down enough to close
      isClosingRef.current = true
      clearTimers()
      
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose?.()
      })
    } else {
      // Spring back if not enough swipe
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.spring(opacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.spring(backdropOpacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start()
    }
  }, [onClose, clearTimers])

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false, // Don't capture on start
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only respond to vertical swipes down (dy > 0 and vertical movement is dominant)
      const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      const isSwipeDown = gestureState.dy > 10
      return isVerticalSwipe && isSwipeDown
    },
    onPanResponderGrant: (evt) => {
      // Pause timer when starting to drag
      setIsPaused(true)
      clearTimers()
    },
    onPanResponderMove: (evt, gestureState) => {
      // Handle vertical swipe down
      if (gestureState.dy > 0 && !isClosingRef.current) {
        const dragDistance = Math.min(gestureState.dy, screenHeight)
        const progress = dragDistance / screenHeight
        
        translateY.setValue(dragDistance)
        opacity.setValue(1 - progress * 0.5) // Fade out as you drag down
        // Reduce backdrop opacity to reveal host screen content
        backdropOpacity.setValue(1 - progress)
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      handleSwipeDown(gestureState)
      // Resume timer if not closing
      if (!isClosingRef.current) {
        setIsPaused(false)
      }
    },
    onPanResponderTerminate: (evt, gestureState) => {
      // Spring back if gesture is cancelled
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.spring(opacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.spring(backdropOpacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start(() => {
        setIsPaused(false)
      })
    },
  }), [handleSwipeDown, clearTimers])
  
  // Pan responder for center zone - handles only long press (pause)
  // Swipe down is handled by the main panResponder on storyViewer
  const centerPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only respond to minimal movement (long press), not swipes
      const isMinimalMovement = Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10
      return isMinimalMovement
    },
      onPanResponderGrant: (evt) => {
        // Start long press timer
        isLongPressingRef.current = false
        longPressTimerRef.current = setTimeout(() => {
          handleLongPressStartRef.current?.()
        }, 200) // 200ms delay for long press
      },
    onPanResponderMove: (evt, gestureState) => {
      // If movement is significant, cancel long press
      if (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10) {
        // Cancel long press timer
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      // Cancel long press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      
      // If long press was active, end it
      if (isLongPressingRef.current) {
        handleLongPressEndRef.current?.()
      }
    },
    onPanResponderTerminate: (evt, gestureState) => {
      // Cancel long press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      
      // If long press was active, end it
      if (isLongPressingRef.current) {
        handleLongPressEndRef.current?.()
      }
    },
  }), [])

  // Store onClose in ref to avoid dependency
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Memoize tap zone styles to avoid recreating objects
  const tapZoneBottomStyle = useMemo(() => ({ bottom: 120 }), [])
  const hitSlop = useMemo(() => ({ top: 0, bottom: 0, left: 0, right: 0 }), [])

  // Calculate progress bar values directly (no memoization to avoid cache issues)
  const progressBgColor = currentStory ? getColorFromSettings(settings, 'backgroundProgress', DEFAULT_COLORS.backgroundProgress) : DEFAULT_COLORS.backgroundProgress
  const closeButtonColor = currentStory ? getColorFromSettings(settings, 'closeColor', DEFAULT_COLORS.closeButton) : DEFAULT_COLORS.closeButton

  if (!visible || !stories || stories.length === 0) {
    return null
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent={true}
      onRequestClose={onClose}
    >
      {/* Backdrop that reveals host screen when swiping down */}
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: backdropOpacity,
          }
        ]}
      />
      
      <Animated.View 
        style={[
          styles.storyViewer,
          {
            transform: [{ translateY }],
            opacity,
          }
        ]}
        {...panResponder.panHandlers}
      >
        {currentStory && (
          <View style={styles.progressContainer}>
            <StoryTimeline
              key={`timeline-${currentStoryIndex}-${currentSlideIndex}`}
              slides={currentStory.slides}
              currentSlideIndex={currentSlideIndex}
              currentProgress={progress}
              backgroundColor={progressBgColor}
            />
            <Pressable style={styles.closeButton} onPress={() => onCloseRef.current?.()}>
              <Text style={[styles.closeButtonText, { color: closeButtonColor }]}>×</Text>
            </Pressable>
          </View>
        )}
        
        <View 
          style={styles.storyViewerContainer}
        >
          {currentSlide && (
            <>
              {/* For video slides, always show immediately (streaming) */}
              {/* For image slides, show loading indicator if not preloaded */}
              {!mediaPreloaded && currentSlide.type !== 'video' && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={DEFAULT_COLORS.closeButton} />
                </View>
              )}
              {(mediaPreloaded || currentSlide.type === 'video') && (
                <StorySlide
                  key={`${currentStoryIndex}-${currentSlideIndex}`} // Force re-render on slide change
                  slide={currentSlide}
                  isActive={!isPaused}
                  settings={settings}
                  onElementPress={handleElementPress}
                  onMediaLoaded={handleMediaLoaded}
                  onVideoDuration={handleVideoDuration}
                  onVideoEnd={nextSlide}
                  onVideoProgress={handleVideoProgress}
                  onLoad={undefined}
                />
              )}
            </>
          )}
        </View>
        
        {/* Tap zones for navigation - placed outside storyViewerContainer to be on top */}
        {/* Exclude bottom area (120px) where buttons are located */}
        <Pressable
          style={[styles.tapZone, styles.tapZoneLeft, tapZoneBottomStyle]}
          onPress={previousSlide}
          hitSlop={hitSlop}
        />
        {/* Center zone for long press (pause) and swipe down (close) */}
        <View
          style={[styles.tapZone, styles.tapZoneCenter, tapZoneBottomStyle]}
          {...centerPanResponder.panHandlers}
        />
        <Pressable
          style={[styles.tapZone, styles.tapZoneRight, tapZoneBottomStyle]}
          onPress={nextSlide}
          hitSlop={hitSlop}
        />
      </Animated.View>
      
      {/* Products Carousel */}
      <ProductsCarousel
        visible={carouselVisible}
        products={carouselProducts}
        hideLabel={carouselHideLabel}
        onClose={handleCarouselClose}
        onProductPress={handleCarouselProductPress}
        settings={settings}
      />
    </Modal>
  )
}
