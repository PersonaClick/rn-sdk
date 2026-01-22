import { Image } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// In-memory cache for fast access
const memoryCache = new Map()

// Cache metadata keys
const CACHE_METADATA_KEY = 'stories.imageCache.metadata'
const CACHE_TIMESTAMP_KEY = 'stories.imageCache.timestamps'

/**
 * Get cached image metadata from AsyncStorage
 * @returns {Promise<Map<string, number>>} Map of URL -> timestamp
 */
async function getCacheMetadata() {
  try {
    const metadataStr = await AsyncStorage.getItem(CACHE_METADATA_KEY)
    if (metadataStr) {
      const metadata = JSON.parse(metadataStr)
      return new Map(Object.entries(metadata))
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[imageCache] Error getting cache metadata:', error)
    }
  }
  return new Map()
}

/**
 * Save cache metadata to AsyncStorage
 * @param {Map<string, number>} metadata - Map of URL -> timestamp
 */
async function saveCacheMetadata(metadata) {
  try {
    const metadataObj = Object.fromEntries(metadata)
    await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadataObj))
  } catch (error) {
    if (__DEV__) {
      console.warn('[imageCache] Error saving cache metadata:', error)
    }
  }
}

/**
 * Check if image is cached (in memory or AsyncStorage metadata)
 * @param {string} url - Image URL
 * @returns {Promise<boolean>} True if image is cached
 */
export async function isImageCached(url) {
  if (!url || typeof url !== 'string') {
    return false
  }

  // Check in-memory cache first
  if (memoryCache.has(url)) {
    return true
  }

  // Check AsyncStorage metadata
  const metadata = await getCacheMetadata()
  return metadata.has(url)
}

/**
 * Get cached image URL (for React Native Image component)
 * React Native Image.prefetch() automatically caches images,
 * so we just return the original URL if cached
 * @param {string} url - Image URL
 * @returns {Promise<string|null>} Cached image URL or null
 */
export async function getCachedImage(url) {
  if (!url || typeof url !== 'string') {
    return null
  }

  const isCached = await isImageCached(url)
  if (isCached) {
    return url // React Native Image component uses cached version automatically
  }

  return null
}

/**
 * Preload image and save to cache
 * Uses Image.prefetch() which is non-blocking and handles caching automatically
 * @param {string} url - Image URL to preload
 * @returns {Promise<boolean>} True if successfully cached, false otherwise
 */
export async function preloadImage(url) {
  if (!url || typeof url !== 'string') {
    return false
  }

  // Check if already cached
  const alreadyCached = await isImageCached(url)
  if (alreadyCached) {
    return true
  }

  try {
    // Use Image.prefetch() - non-blocking, native caching
    await Image.prefetch(url)
    
    // Mark as cached in memory
    memoryCache.set(url, Date.now())
    
    // Update AsyncStorage metadata
    const metadata = await getCacheMetadata()
    metadata.set(url, Date.now())
    await saveCacheMetadata(metadata)
    
    return true
  } catch (error) {
    // Don't fail on preload errors - this is background operation
    if (__DEV__) {
      console.warn('[imageCache] Error preloading image:', url, error)
    }
    return false
  }
}

/**
 * Clear image cache
 * @param {string[]} [urls] - Optional array of URLs to clear. If not provided, clears all
 */
export async function clearImageCache(urls = null) {
  try {
    if (urls && Array.isArray(urls)) {
      // Clear specific URLs
      urls.forEach(url => {
        memoryCache.delete(url)
      })
      const metadata = await getCacheMetadata()
      urls.forEach(url => {
        metadata.delete(url)
      })
      await saveCacheMetadata(metadata)
    } else {
      // Clear all
      memoryCache.clear()
      await AsyncStorage.removeItem(CACHE_METADATA_KEY)
      await AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY)
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[imageCache] Error clearing cache:', error)
    }
  }
}

/**
 * Get cache size (number of cached images)
 * @returns {Promise<number>} Number of cached images
 */
export async function getCacheSize() {
  const metadata = await getCacheMetadata()
  return metadata.size
}

/**
 * Clean up old cache entries (older than specified days)
 * @param {number} daysOld - Remove entries older than this many days
 * @returns {Promise<number>} Number of entries removed
 */
export async function cleanupOldCache(daysOld = 7) {
  try {
    const metadata = await getCacheMetadata()
    const now = Date.now()
    const maxAge = daysOld * 24 * 60 * 60 * 1000 // Convert days to milliseconds
    let removedCount = 0

    for (const [url, timestamp] of metadata.entries()) {
      if (now - timestamp > maxAge) {
        metadata.delete(url)
        memoryCache.delete(url)
        removedCount++
      }
    }

    await saveCacheMetadata(metadata)
    return removedCount
  } catch (error) {
    if (__DEV__) {
      console.warn('[imageCache] Error cleaning up old cache:', error)
    }
    return 0
  }
}
