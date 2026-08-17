import AsyncStorage from '@react-native-async-storage/async-storage'
import { getStorageKey } from '../../utils'

// Story viewed/last-seen state is partitioned per shop (Release 2). Slide ids are not unique across
// shops (they can be plain integers), so a global `viewed.slide.<storyId>` key would let a story
// viewed in shop A read as viewed in shop B. Keys now go through getStorageKey(raw, shopId) →
// `@PersonaClick_<shopId>_viewed.slide.<storyId>`, matching the rest of the SDK's storage.
//
// A missing shopId degrades to a no-op (writes) / empty (reads) rather than polluting a shared
// `undefined` bucket. In practice callers always pass `sdk.shop_id`.

const VIEWED_PREFIX = 'viewed.slide.'
const LAST_SEEN_PREFIX = 'lastSeen.slide.'

/** @returns {string} shop-scoped key, e.g. `@PersonaClick_<shopId>_viewed.slide.<storyId>`. */
function viewedKey(storyId, shopId) {
  return getStorageKey(`${VIEWED_PREFIX}${storyId}`, shopId)
}

/** @returns {string} shop-scoped key for the last-seen slide of a story. */
function lastSeenKey(storyId, shopId) {
  return getStorageKey(`${LAST_SEEN_PREFIX}${storyId}`, shopId)
}

/**
 * Get viewed slide IDs for a specific story
 * @param {string} storyId - Story identifier
 * @param {string} shopId - Shop identifier (partition key)
 * @returns {Promise<string[]>} Array of viewed slide IDs
 */
export async function getViewedSlides(storyId, shopId) {
  if (!shopId) return []
  try {
    const viewedSlides = await AsyncStorage.getItem(viewedKey(storyId, shopId))
    const parsed = viewedSlides ? JSON.parse(viewedSlides) : []
    // Normalize to strings (IDs may come as numbers from API / storage)
    return Array.isArray(parsed) ? parsed.map((id) => String(id)) : []
  } catch (error) {
    console.warn('Error getting viewed slides:', error)
    return []
  }
}

/**
 * Mark a slide as viewed for a specific story
 * @param {string} storyId - Story identifier
 * @param {string} slideId - Slide identifier
 * @param {string} shopId - Shop identifier (partition key)
 * @returns {Promise<void>}
 */
export async function markSlideAsViewed(storyId, slideId, shopId) {
  if (!shopId) return
  try {
    const viewedSlides = await getViewedSlides(storyId, shopId)
    const normalizedSlideId = String(slideId)

    if (!viewedSlides.includes(normalizedSlideId)) {
      viewedSlides.push(normalizedSlideId)
      await AsyncStorage.setItem(viewedKey(storyId, shopId), JSON.stringify(viewedSlides))
    }
  } catch (error) {
    console.warn('Error marking slide as viewed:', error)
  }
}

/**
 * Get the last viewed slide ID for a specific story
 * @param {string} storyId - Story identifier
 * @param {string} shopId - Shop identifier (partition key)
 * @returns {Promise<string|null>} Last viewed slide ID or null
 */
export async function getLastViewedSlide(storyId, shopId) {
  try {
    const viewedSlides = await getViewedSlides(storyId, shopId)
    return viewedSlides.length > 0 ? viewedSlides[viewedSlides.length - 1] : null
  } catch (error) {
    console.warn('Error getting last viewed slide:', error)
    return null
  }
}

/**
 * Set the last seen slide ID for a specific story
 * @param {string} storyId - Story identifier
 * @param {string} slideId - Slide identifier
 * @param {string} shopId - Shop identifier (partition key)
 * @returns {Promise<void>}
 */
export async function setLastSeenSlide(storyId, slideId, shopId) {
  if (!shopId) return
  try {
    const normalizedSlideId = String(slideId)
    await AsyncStorage.setItem(lastSeenKey(storyId, shopId), normalizedSlideId)
  } catch (error) {
    console.warn('Error setting last seen slide:', error)
  }
}

/**
 * Get the last seen slide ID for a specific story
 * @param {string} storyId - Story identifier
 * @param {string} shopId - Shop identifier (partition key)
 * @returns {Promise<string|null>} Last seen slide ID or null
 */
export async function getLastSeenSlide(storyId, shopId) {
  if (!shopId) return null
  try {
    const lastSeenSlide = await AsyncStorage.getItem(lastSeenKey(storyId, shopId))
    return lastSeenSlide ? String(lastSeenSlide) : null
  } catch (error) {
    console.warn('Error getting last seen slide:', error)
    return null
  }
}

/**
 * Check if a story is fully viewed (all slides viewed)
 * @param {string} storyId - Story identifier
 * @param {string[]} allSlideIds - All slide IDs for the story
 * @param {string} shopId - Shop identifier (partition key)
 * @returns {Promise<boolean>} True if all slides are viewed
 */
export async function isStoryFullyViewed(storyId, allSlideIds, shopId) {
  try {
    const viewedSlides = await getViewedSlides(storyId, shopId)
    const normalizedAllSlideIds = Array.isArray(allSlideIds) ? allSlideIds.map((id) => String(id)) : []
    const isFullyViewed = normalizedAllSlideIds.every((slideId) => viewedSlides.includes(slideId))
    return isFullyViewed
  } catch (error) {
    console.warn('Error checking if story is fully viewed:', error)
    return false
  }
}

/**
 * Clear all stories cache/viewed state for a shop
 * @param {string} shopId - Shop identifier (partition key)
 * @returns {Promise<void>}
 */
export async function clearStoriesCache(shopId) {
  if (!shopId) return
  try {
    const viewedPrefix = getStorageKey(VIEWED_PREFIX, shopId)
    const lastSeenPrefix = getStorageKey(LAST_SEEN_PREFIX, shopId)
    const keys = await AsyncStorage.getAllKeys()
    const storyKeys = keys.filter(
      (key) => key.startsWith(viewedPrefix) || key.startsWith(lastSeenPrefix)
    )
    if (storyKeys.length > 0) {
      await AsyncStorage.multiRemove(storyKeys)
    }
  } catch (error) {
    console.warn('Error clearing stories cache:', error)
  }
}

/**
 * Get the starting slide index for a story based on viewed state
 * @param {string} storyId - Story identifier
 * @param {string[]} allSlideIds - All slide IDs for the story
 * @param {number} defaultStartPosition - Default start position from story data
 * @param {string} shopId - Shop identifier (partition key)
 * @returns {Promise<number>} Starting slide index
 */
export async function getStartSlideIndex(storyId, allSlideIds, defaultStartPosition = 0, shopId) {
  try {
    // Validate inputs
    if (!storyId || !allSlideIds || !Array.isArray(allSlideIds) || allSlideIds.length === 0) {
      return defaultStartPosition
    }

    const normalizedAllSlideIds = allSlideIds.map((id) => String(id))

    // First, check if we have a last seen slide position
    const lastSeenSlide = await getLastSeenSlide(storyId, shopId)
    if (lastSeenSlide) {
      const lastSeenIndex = normalizedAllSlideIds.findIndex((id) => id === lastSeenSlide)
      if (lastSeenIndex !== -1) {
        // If last seen slide is NOT the final slide, resume from that slide
        if (lastSeenIndex < normalizedAllSlideIds.length - 1) {
          return lastSeenIndex
        } else {
          // If last seen slide IS the final slide, start from the first slide
          return 0
        }
      }
    }

    // Fallback to old logic if no last seen slide or it doesn't match
    // If story is fully viewed, always start from the first slide
    const fullyViewed = await isStoryFullyViewed(storyId, normalizedAllSlideIds, shopId)
    if (fullyViewed) {
      return 0
    }

    const lastViewedSlide = await getLastViewedSlide(storyId, shopId)

    if (lastViewedSlide) {
      const lastViewedIndex = normalizedAllSlideIds.findIndex((id) => id === String(lastViewedSlide))
      if (lastViewedIndex !== -1) {
        // If user already reached the last slide, treat story as completed and start from beginning
        if (lastViewedIndex >= normalizedAllSlideIds.length - 1) {
          return 0
        }
        // Resume from next slide after last viewed
        const nextIndex = Math.min(lastViewedIndex + 1, normalizedAllSlideIds.length - 1)
        return nextIndex
      }
    }

    if (__DEV__) {
      console.log('[storage] Using default start position:', {
        storyId,
        defaultStartPosition,
      })
    }
    return defaultStartPosition
  } catch (error) {
    console.warn('Error getting start slide index:', error)
    return defaultStartPosition
  }
}
