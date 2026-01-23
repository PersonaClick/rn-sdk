import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Get viewed slide IDs for a specific story
 * @param {string} storyId - Story identifier
 * @returns {Promise<string[]>} Array of viewed slide IDs
 */
export async function getViewedSlides(storyId) {
  try {
    const key = `viewed.slide.${storyId}`
    const viewedSlides = await AsyncStorage.getItem(key)
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
 * @returns {Promise<void>}
 */
export async function markSlideAsViewed(storyId, slideId) {
  try {
    const key = `viewed.slide.${storyId}`
    const viewedSlides = await getViewedSlides(storyId)
    const normalizedSlideId = String(slideId)
    
    if (!viewedSlides.includes(normalizedSlideId)) {
      viewedSlides.push(normalizedSlideId)
      await AsyncStorage.setItem(key, JSON.stringify(viewedSlides))
    }
  } catch (error) {
    console.warn('Error marking slide as viewed:', error)
  }
}

/**
 * Get the last viewed slide ID for a specific story
 * @param {string} storyId - Story identifier
 * @returns {Promise<string|null>} Last viewed slide ID or null
 */
export async function getLastViewedSlide(storyId) {
  try {
    const viewedSlides = await getViewedSlides(storyId)
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
 * @returns {Promise<void>}
 */
export async function setLastSeenSlide(storyId, slideId) {
  try {
    const key = `lastSeen.slide.${storyId}`
    const normalizedSlideId = String(slideId)
    await AsyncStorage.setItem(key, normalizedSlideId)
  } catch (error) {
    console.warn('Error setting last seen slide:', error)
  }
}

/**
 * Get the last seen slide ID for a specific story
 * @param {string} storyId - Story identifier
 * @returns {Promise<string|null>} Last seen slide ID or null
 */
export async function getLastSeenSlide(storyId) {
  try {
    const key = `lastSeen.slide.${storyId}`
    const lastSeenSlide = await AsyncStorage.getItem(key)
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
 * @returns {Promise<boolean>} True if all slides are viewed
 */
export async function isStoryFullyViewed(storyId, allSlideIds) {
  try {
    const viewedSlides = await getViewedSlides(storyId)
    const normalizedAllSlideIds = Array.isArray(allSlideIds) ? allSlideIds.map((id) => String(id)) : []
    const isFullyViewed = normalizedAllSlideIds.every((slideId) => viewedSlides.includes(slideId))
    return isFullyViewed
  } catch (error) {
    console.warn('Error checking if story is fully viewed:', error)
    return false
  }
}

/**
 * Clear all stories cache/viewed state
 * @returns {Promise<void>}
 */
export async function clearStoriesCache() {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const storyKeys = keys.filter(key =>
      key.startsWith('viewed.slide.') || key.startsWith('lastSeen.slide.')
    )
    await AsyncStorage.multiRemove(storyKeys)
  } catch (error) {
    console.warn('Error clearing stories cache:', error)
  }
}

/**
 * Get the starting slide index for a story based on viewed state
 * @param {string} storyId - Story identifier
 * @param {string[]} allSlideIds - All slide IDs for the story
 * @param {number} defaultStartPosition - Default start position from story data
 * @returns {Promise<number>} Starting slide index
 */
export async function getStartSlideIndex(storyId, allSlideIds, defaultStartPosition = 0) {
  try {
    // Validate inputs
    if (!storyId || !allSlideIds || !Array.isArray(allSlideIds) || allSlideIds.length === 0) {
      return defaultStartPosition
    }

    const normalizedAllSlideIds = allSlideIds.map((id) => String(id))

    // First, check if we have a last seen slide position
    const lastSeenSlide = await getLastSeenSlide(storyId)
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
    const fullyViewed = await isStoryFullyViewed(storyId, normalizedAllSlideIds)
    if (fullyViewed) {
      return 0
    }

    const lastViewedSlide = await getLastViewedSlide(storyId)

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
