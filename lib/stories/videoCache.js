import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

// Try to import react-native-fs, fallback to basic file operations if not available
let RNFS = null
try {
  RNFS = require('react-native-fs')
  if (__DEV__) {
    console.log('[videoCache] react-native-fs loaded successfully')
  }
} catch (error) {
  if (__DEV__) {
    console.warn('[videoCache] react-native-fs not available, using basic file operations', error)
  }
}

// Cache directory for videos
const CACHE_DIR = RNFS ? RNFS.CachesDirectoryPath + '/stories_videos' : null

// Cache metadata keys
const VIDEO_METADATA_KEY = 'stories.videoCache.metadata'
const VIDEO_DURATION_KEY = 'stories.videoCache.durations'

// Active downloads map for cancellation
const activeDownloads = new Map()

/**
 * Initialize cache directory
 */
async function initCacheDirectory() {
  if (!RNFS || !CACHE_DIR) {
    return false
  }

  try {
    const dirExists = await RNFS.exists(CACHE_DIR)
    if (!dirExists) {
      await RNFS.mkdir(CACHE_DIR)
    }
    return true
  } catch (error) {
    if (__DEV__) {
      console.warn('[videoCache] Error initializing cache directory:', error)
    }
    return false
  }
}

/**
 * Normalize slide ID to string (handle both string and number IDs)
 * @param {string|number} slideId - Slide ID
 * @returns {string} Normalized slide ID as string
 */
function normalizeSlideId(slideId) {
  if (slideId === null || slideId === undefined) {
    return null
  }
  return String(slideId)
}

/**
 * Get video file path for a slide
 * @param {string|number} slideId - Slide ID
 * @returns {string} File path
 */
function getVideoFilePath(slideId) {
  if (!CACHE_DIR) {
    return null
  }
  const normalizedId = normalizeSlideId(slideId)
  if (!normalizedId) {
    return null
  }
  return `${CACHE_DIR}/${normalizedId}.mp4`
}

/**
 * Get cached video metadata from AsyncStorage
 * @returns {Promise<Map<string, {path: string, timestamp: number, size?: number}>>}
 */
async function getVideoMetadata() {
  try {
    const metadataStr = await AsyncStorage.getItem(VIDEO_METADATA_KEY)
    if (metadataStr) {
      const metadata = JSON.parse(metadataStr)
      return new Map(Object.entries(metadata))
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[videoCache] Error getting video metadata:', error)
    }
  }
  return new Map()
}

/**
 * Save video metadata to AsyncStorage
 * @param {Map<string, {path: string, timestamp: number, size?: number}>} metadata
 */
async function saveVideoMetadata(metadata) {
  try {
    const metadataObj = Object.fromEntries(metadata)
    await AsyncStorage.setItem(VIDEO_METADATA_KEY, JSON.stringify(metadataObj))
  } catch (error) {
    if (__DEV__) {
      console.warn('[videoCache] Error saving video metadata:', error)
    }
  }
}

/**
 * Get video duration from cache
 * @param {string|number} slideId - Slide ID
 * @returns {Promise<number|null>} Duration in seconds or null
 */
async function getCachedVideoDuration(slideId) {
  try {
    const normalizedId = normalizeSlideId(slideId)
    if (!normalizedId) {
      return null
    }
    const durationsStr = await AsyncStorage.getItem(VIDEO_DURATION_KEY)
    if (durationsStr) {
      const durations = JSON.parse(durationsStr)
      return durations[normalizedId] || null
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[videoCache] Error getting video duration:', error)
    }
  }
  return null
}

/**
 * Save video duration to cache
 * @param {string|number} slideId - Slide ID
 * @param {number} duration - Duration in seconds
 */
async function saveVideoDuration(slideId, duration) {
  try {
    const normalizedId = normalizeSlideId(slideId)
    if (!normalizedId) {
      return
    }
    const durationsStr = await AsyncStorage.getItem(VIDEO_DURATION_KEY)
    const durations = durationsStr ? JSON.parse(durationsStr) : {}
    durations[normalizedId] = duration
    await AsyncStorage.setItem(VIDEO_DURATION_KEY, JSON.stringify(durations))
  } catch (error) {
    if (__DEV__) {
      console.warn('[videoCache] Error saving video duration:', error)
    }
  }
}

/**
 * Check if video is cached
 * @param {string} slideId - Slide ID
 * @returns {Promise<boolean>} True if video is cached
 */
export async function isVideoCached(slideId) {
  if (!slideId) {
    return false
  }

  if (!RNFS || !CACHE_DIR) {
    // If react-native-fs is not available, we can't cache videos
    return false
  }

  try {
    // Normalize slideId to string for consistent comparison
    const normalizedId = normalizeSlideId(slideId)
    if (!normalizedId) {
      return false
    }

    const filePath = getVideoFilePath(normalizedId)
    if (!filePath) {
      if (__DEV__) {
        console.warn(`[videoCache] No file path for slide ${normalizedId}`)
      }
      return false
    }

    // Check metadata first (faster)
    const metadata = await getVideoMetadata()
    const hasMetadata = metadata.has(normalizedId)
    
    if (__DEV__) {
      console.log(`[videoCache] Checking cache for slide ${normalizedId} (original: ${slideId}, type: ${typeof slideId}): metadata=${hasMetadata}, filePath=${filePath}`)
    }

    // Check if file exists
    const exists = await RNFS.exists(filePath)
    
    if (__DEV__) {
      console.log(`[videoCache] File exists check for slide ${normalizedId}: ${exists}`)
    }

    if (exists && hasMetadata) {
      if (__DEV__) {
        console.log(`[videoCache] Video is cached for slide ${normalizedId}`)
      }
      return true
    }

    if (exists && !hasMetadata) {
      // File exists but metadata is missing - add metadata
      if (__DEV__) {
        console.log(`[videoCache] File exists but metadata missing for slide ${normalizedId}, adding metadata`)
      }
      try {
        const fileStats = await RNFS.stat(filePath)
        const fileSize = fileStats.size || 0
        metadata.set(normalizedId, {
          path: filePath,
          timestamp: Date.now(),
          size: fileSize,
        })
        await saveVideoMetadata(metadata)
        if (__DEV__) {
          console.log(`[videoCache] Metadata added for slide ${normalizedId}`)
        }
        return true
      } catch (error) {
        if (__DEV__) {
          console.warn(`[videoCache] Error adding metadata for slide ${normalizedId}:`, error)
        }
      }
    }

    if (__DEV__) {
      console.log(`[videoCache] Video not cached for slide ${normalizedId}: exists=${exists}, hasMetadata=${hasMetadata}`)
    }
    return false
  } catch (error) {
    if (__DEV__) {
      console.warn('[videoCache] Error checking if video cached:', error)
    }
    return false
  }
}

/**
 * Get cached video file path
 * @param {string} slideId - Slide ID
 * @param {string} url - Original video URL (for fallback)
 * @returns {Promise<string|null>} Cached file path or null
 */
export async function getCachedVideoPath(slideId, url) {
  if (!slideId) {
    return null
  }

  // Normalize slideId to string
  const normalizedId = normalizeSlideId(slideId)
  if (!normalizedId) {
    return null
  }

  const isCached = await isVideoCached(normalizedId)
  if (isCached) {
    const filePath = getVideoFilePath(normalizedId)
    return filePath
  }

  return null
}

/**
 * Preload video with streaming download
 * Uses fetch with streaming to avoid loading entire file into memory
 * @param {string} slideId - Slide ID
 * @param {string} url - Video URL
 * @param {Function} [onProgress] - Progress callback (progress: number 0-1)
 * @returns {Promise<{path: string, duration?: number}>} Object with cached path and optional duration
 */
export async function preloadVideo(slideId, url, onProgress) {
  if (!slideId || !url) {
    throw new Error('slideId and url are required')
  }

  if (!RNFS || !CACHE_DIR) {
    if (__DEV__) {
      console.warn('[videoCache] react-native-fs not available, cannot cache video')
    }
    throw new Error('react-native-fs is required for video caching')
  }

  // Normalize slideId to string
  const normalizedId = normalizeSlideId(slideId)
  if (!normalizedId) {
    throw new Error('Invalid slideId')
  }

  // Check if already cached
  const alreadyCached = await isVideoCached(normalizedId)
  if (alreadyCached) {
    if (__DEV__) {
      console.log(`[videoCache] Video already cached for slide ${normalizedId}`)
    }
    const filePath = getVideoFilePath(normalizedId)
    const duration = await getCachedVideoDuration(normalizedId)
    return { path: filePath, duration: duration || undefined }
  }

  if (__DEV__) {
    console.log(`[videoCache] Starting video download for slide ${normalizedId} from ${url}`)
  }

  // Initialize cache directory
  await initCacheDirectory()

  const filePath = getVideoFilePath(normalizedId)
  const abortController = new AbortController()
  let downloadJob = null
  
  // Store abort controller and download job for cancellation (use normalized ID)
  activeDownloads.set(normalizedId, { abortController, downloadJob: null })

  try {
    // Use RNFS.downloadFile for efficient downloading and writing
    // This handles streaming, progress, and file writing natively
    downloadJob = RNFS.downloadFile({
      fromUrl: url,
      toFile: filePath,
      background: true,
      discretionary: true,
      cacheable: true,
      progress: onProgress ? (res) => {
        if (res.contentLength > 0 && res.bytesWritten > 0) {
          const progress = res.bytesWritten / res.contentLength
          onProgress(progress)
        }
      } : undefined,
    })
    
    // Store download job for cancellation (use normalized ID)
    activeDownloads.set(normalizedId, { abortController, downloadJob })

    const downloadResult = await downloadJob.promise

    if (downloadResult.statusCode !== 200) {
      throw new Error(`Download failed with status ${downloadResult.statusCode}`)
    }

    if (__DEV__) {
      console.log(`[videoCache] Video downloaded successfully for slide ${normalizedId}, status: ${downloadResult.statusCode}`)
    }

    // Get file size for metadata
    const fileStats = await RNFS.stat(filePath)
    const fileSize = fileStats.size || 0

    if (__DEV__) {
      console.log(`[videoCache] Video file size for slide ${normalizedId}: ${fileSize} bytes`)
    }

    // Save metadata (use normalized ID)
    const metadata = await getVideoMetadata()
    metadata.set(normalizedId, {
      path: filePath,
      timestamp: Date.now(),
      size: fileSize,
    })
    await saveVideoMetadata(metadata)

    if (__DEV__) {
      console.log(`[videoCache] Video cached successfully for slide ${normalizedId} at ${filePath}`)
      // Verify metadata was saved
      const verifyMetadata = await getVideoMetadata()
      console.log(`[videoCache] Metadata verification for slide ${normalizedId}: ${verifyMetadata.has(normalizedId)}`)
      // Also check all keys in metadata
      console.log(`[videoCache] All cached slide IDs:`, Array.from(verifyMetadata.keys()))
    }

    // Try to get video duration (this would require native module or video processing)
    // For now, we'll skip duration extraction as it requires additional dependencies
    // Duration can be set later via setVideoDuration()

    // Remove from active downloads
    activeDownloads.delete(normalizedId)

    return { path: filePath }
  } catch (error) {
    // Remove from active downloads
    activeDownloads.delete(normalizedId)

    // Clean up partial file on error
    try {
      const exists = await RNFS.exists(filePath)
      if (exists) {
        await RNFS.unlink(filePath)
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    if (error.message === 'Video preload cancelled' || error.name === 'AbortError') {
      throw new Error('Video preload cancelled')
    }

    throw error
  }
}

/**
 * Cancel video preload
 * @param {string|number} slideId - Slide ID
 */
export async function cancelVideoPreload(slideId) {
  const normalizedId = normalizeSlideId(slideId)
  if (!normalizedId) {
    return
  }
  const downloadInfo = activeDownloads.get(normalizedId)
  if (downloadInfo) {
    if (downloadInfo.abortController) {
      downloadInfo.abortController.abort()
    }
    if (downloadInfo.downloadJob) {
      downloadInfo.downloadJob.promise.catch(() => {}) // Ignore cancellation errors
      // RNFS downloadFile doesn't have a direct cancel method, but abort signal should handle it
    }
    activeDownloads.delete(normalizedId)
  }
}

/**
 * Set video duration for cached video
 * @param {string|number} slideId - Slide ID
 * @param {number} duration - Duration in seconds
 */
export async function setVideoDuration(slideId, duration) {
  await saveVideoDuration(slideId, duration)
}

/**
 * Get video duration from cache
 * @param {string|number} slideId - Slide ID
 * @returns {Promise<number|null>} Duration in seconds or null
 */
export async function getVideoDuration(slideId) {
  return await getCachedVideoDuration(slideId)
}

/**
 * Clear video cache
 * @param {string[]} [slideIds] - Optional array of slide IDs to clear. If not provided, clears all
 */
export async function clearVideoCache(slideIds = null) {
  if (!RNFS || !CACHE_DIR) {
    return
  }

  try {
    const metadata = await getVideoMetadata()

    if (slideIds && Array.isArray(slideIds)) {
      // Clear specific videos
      for (const slideId of slideIds) {
        const filePath = getVideoFilePath(slideId)
        if (filePath) {
          try {
            const exists = await RNFS.exists(filePath)
            if (exists) {
              await RNFS.unlink(filePath)
            }
          } catch (error) {
            // Ignore individual file errors
          }
        }
        metadata.delete(slideId)
      }
    } else {
      // Clear all videos
      const allSlideIds = Array.from(metadata.keys())
      for (const slideId of allSlideIds) {
        const filePath = getVideoFilePath(slideId)
        if (filePath) {
          try {
            const exists = await RNFS.exists(filePath)
            if (exists) {
              await RNFS.unlink(filePath)
            }
          } catch (error) {
            // Ignore individual file errors
          }
        }
      }
      metadata.clear()
    }

    await saveVideoMetadata(metadata)
  } catch (error) {
    if (__DEV__) {
      console.warn('[videoCache] Error clearing cache:', error)
    }
  }
}

/**
 * Get cache size (total size of cached videos)
 * @returns {Promise<number>} Total size in bytes
 */
export async function getVideoCacheSize() {
  if (!RNFS || !CACHE_DIR) {
    return 0
  }

  try {
    const metadata = await getVideoMetadata()
    let totalSize = 0

    for (const [slideId, info] of metadata.entries()) {
      if (info.size) {
        totalSize += info.size
      } else {
        // Try to get file size if not in metadata
        const filePath = getVideoFilePath(slideId)
        if (filePath) {
          try {
            const exists = await RNFS.exists(filePath)
            if (exists) {
              const stat = await RNFS.stat(filePath)
              totalSize += stat.size || 0
            }
          } catch (error) {
            // Ignore errors
          }
        }
      }
    }

    return totalSize
  } catch (error) {
    if (__DEV__) {
      console.warn('[videoCache] Error getting cache size:', error)
    }
    return 0
  }
}

/**
 * Clean up old video cache entries (older than specified days)
 * @param {number} daysOld - Remove entries older than this many days
 * @returns {Promise<number>} Number of entries removed
 */
export async function cleanupOldVideoCache(daysOld = 7) {
  if (!RNFS || !CACHE_DIR) {
    return 0
  }

  try {
    const metadata = await getVideoMetadata()
    const now = Date.now()
    const maxAge = daysOld * 24 * 60 * 60 * 1000
    let removedCount = 0

    for (const [slideId, info] of metadata.entries()) {
      if (now - info.timestamp > maxAge) {
        const filePath = getVideoFilePath(slideId)
        if (filePath) {
          try {
            const exists = await RNFS.exists(filePath)
            if (exists) {
              await RNFS.unlink(filePath)
            }
          } catch (error) {
            // Ignore individual file errors
          }
        }
        metadata.delete(slideId)
        removedCount++
      }
    }

    await saveVideoMetadata(metadata)
    return removedCount
  } catch (error) {
    if (__DEV__) {
      console.warn('[videoCache] Error cleaning up old cache:', error)
    }
    return 0
  }
}
