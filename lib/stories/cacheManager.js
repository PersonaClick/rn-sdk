import { AppState } from 'react-native'
import { cleanupOldCache as cleanupOldImageCache, getCacheSize as getImageCacheSize, clearImageCache } from './imageCache'
import { cleanupOldVideoCache, getVideoCacheSize, clearVideoCache } from './videoCache'

// Maximum cache size in bytes (default: 100MB)
const MAX_CACHE_SIZE = 100 * 1024 * 1024 // 100MB

// Cache cleanup age in days (default: 7 days)
const CACHE_CLEANUP_AGE_DAYS = 7

// AppState listener for memory warnings
let appStateSubscription = null

/**
 * Get total cache size (images + videos)
 * @returns {Promise<number>} Total cache size in bytes
 */
export async function getTotalCacheSize() {
  try {
    const imageCacheSize = await getImageCacheSize()
    const videoCacheSize = await getVideoCacheSize()
    return imageCacheSize + videoCacheSize
  } catch (error) {
    if (__DEV__) {
      console.warn('[cacheManager] Error getting total cache size:', error)
    }
    return 0
  }
}

/**
 * Clean up old cache entries
 * @param {number} daysOld - Remove entries older than this many days (default: 7)
 * @returns {Promise<{imagesRemoved: number, videosRemoved: number}>} Number of entries removed
 */
export async function cleanupOldCache(daysOld = CACHE_CLEANUP_AGE_DAYS) {
  try {
    const imagesRemoved = await cleanupOldImageCache(daysOld)
    const videosRemoved = await cleanupOldVideoCache(daysOld)
    
    if (__DEV__) {
      console.log(`[cacheManager] Cleaned up old cache: ${imagesRemoved} images, ${videosRemoved} videos`)
    }
    
    return { imagesRemoved, videosRemoved }
  } catch (error) {
    if (__DEV__) {
      console.warn('[cacheManager] Error cleaning up old cache:', error)
    }
    return { imagesRemoved: 0, videosRemoved: 0 }
  }
}

/**
 * Clear all cache
 * @returns {Promise<void>}
 */
export async function clearAllCache() {
  try {
    await clearImageCache()
    await clearVideoCache()
    
    if (__DEV__) {
      console.log('[cacheManager] All cache cleared')
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[cacheManager] Error clearing all cache:', error)
    }
  }
}

/**
 * Manage cache size by removing oldest entries if cache exceeds maximum size
 * @param {number} maxSize - Maximum cache size in bytes (default: 100MB)
 * @returns {Promise<{cleared: boolean, sizeBefore: number, sizeAfter: number}>}
 */
export async function manageCacheSize(maxSize = MAX_CACHE_SIZE) {
  try {
    const currentSize = await getTotalCacheSize()
    
    if (currentSize <= maxSize) {
      return { cleared: false, sizeBefore: currentSize, sizeAfter: currentSize }
    }
    
    if (__DEV__) {
      console.log(`[cacheManager] Cache size (${(currentSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum (${(maxSize / 1024 / 1024).toFixed(2)}MB), cleaning up...`)
    }
    
    // Start with cleaning up old entries (7 days)
    await cleanupOldCache(CACHE_CLEANUP_AGE_DAYS)
    
    // Check size again
    let newSize = await getTotalCacheSize()
    
    // If still too large, clean up older entries (3 days)
    if (newSize > maxSize) {
      await cleanupOldCache(3)
      newSize = await getTotalCacheSize()
    }
    
    // If still too large, clean up very old entries (1 day)
    if (newSize > maxSize) {
      await cleanupOldCache(1)
      newSize = await getTotalCacheSize()
    }
    
    // If still too large, clear all cache (last resort)
    if (newSize > maxSize) {
      await clearAllCache()
      newSize = await getTotalCacheSize()
    }
    
    if (__DEV__) {
      console.log(`[cacheManager] Cache size after cleanup: ${(newSize / 1024 / 1024).toFixed(2)}MB`)
    }
    
    return { cleared: true, sizeBefore: currentSize, sizeAfter: newSize }
  } catch (error) {
    if (__DEV__) {
      console.warn('[cacheManager] Error managing cache size:', error)
    }
    return { cleared: false, sizeBefore: 0, sizeAfter: 0 }
  }
}

/**
 * Initialize cache management
 * Sets up AppState listener for memory warnings and periodic cleanup
 */
export function initializeCacheManagement() {
  if (appStateSubscription) {
    return // Already initialized
  }

  // Clean up old cache on app start
  cleanupOldCache(CACHE_CLEANUP_AGE_DAYS).catch(() => {
    // Silent fail
  })

  // Manage cache size on app start
  manageCacheSize(MAX_CACHE_SIZE).catch(() => {
    // Silent fail
  })

  // Listen for app state changes to clean up on memory warnings
  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'background') {
      // Clean up old cache when app goes to background
      cleanupOldCache(CACHE_CLEANUP_AGE_DAYS).catch(() => {
        // Silent fail
      })
      
      // Manage cache size when app goes to background
      manageCacheSize(MAX_CACHE_SIZE).catch(() => {
        // Silent fail
      })
    }
  }

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange)
}

/**
 * Cleanup cache management
 * Removes AppState listener
 */
export function cleanupCacheManagement() {
  if (appStateSubscription) {
    appStateSubscription.remove()
    appStateSubscription = null
  }
}

// Auto-initialize cache management
initializeCacheManagement()
