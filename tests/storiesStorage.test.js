import {
  markSlideAsViewed,
  getViewedSlides,
  isStoryFullyViewed,
  setLastSeenSlide,
  getLastSeenSlide,
  clearStoriesCache,
} from '../lib/stories/storage.js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Release 2 (RN-5): story viewed/last-seen state is partitioned per shop. Slide ids are not unique
// across shops, so a global key would leak "viewed" state between them. These tests pin the
// isolation and the shop-scoped key scheme.

beforeEach(() => AsyncStorage.clearAll())

describe('stories/storage — per-shop isolation', () => {
  test('a slide viewed in shop A is not viewed in shop B', async () => {
    await markSlideAsViewed('story-1', 'slide-1', 'shop-a')

    expect(await getViewedSlides('story-1', 'shop-a')).toEqual(['slide-1'])
    expect(await getViewedSlides('story-1', 'shop-b')).toEqual([])
  })

  test('isStoryFullyViewed is scoped per shop', async () => {
    await markSlideAsViewed('story-1', 's1', 'shop-a')
    await markSlideAsViewed('story-1', 's2', 'shop-a')

    expect(await isStoryFullyViewed('story-1', ['s1', 's2'], 'shop-a')).toBe(true)
    expect(await isStoryFullyViewed('story-1', ['s1', 's2'], 'shop-b')).toBe(false)
  })

  test('last-seen slide is scoped per shop', async () => {
    await setLastSeenSlide('story-1', 's3', 'shop-a')

    expect(await getLastSeenSlide('story-1', 'shop-a')).toBe('s3')
    expect(await getLastSeenSlide('story-1', 'shop-b')).toBeNull()
  })

  test('the same story+slide id in two shops does not collide', async () => {
    // Both shops have a story "39" with integer-like slide id 39_0 — the real-world collision case.
    await markSlideAsViewed('39', '390', 'shop-a')

    expect(await getViewedSlides('39', 'shop-a')).toEqual(['390'])
    expect(await getViewedSlides('39', 'shop-b')).toEqual([])
  })
})

describe('stories/storage — shop-scoped key scheme', () => {
  test('writes go to the @PersonaClick_<shopId>_ partition, not a global key', async () => {
    await markSlideAsViewed('story-1', 'slide-1', 'shop-a')

    const keys = await AsyncStorage.getAllKeys()
    expect(keys).toContain('@PersonaClick_shop-a_viewed.slide.story-1')
    // No un-partitioned legacy key is written.
    expect(keys).not.toContain('viewed.slide.story-1')
  })

  test('clearStoriesCache removes only the given shop partition', async () => {
    await markSlideAsViewed('story-1', 's1', 'shop-a')
    await setLastSeenSlide('story-1', 's1', 'shop-a')
    await markSlideAsViewed('story-1', 's1', 'shop-b')

    await clearStoriesCache('shop-a')

    expect(await getViewedSlides('story-1', 'shop-a')).toEqual([])
    expect(await getLastSeenSlide('story-1', 'shop-a')).toBeNull()
    expect(await getViewedSlides('story-1', 'shop-b')).toEqual(['s1']) // untouched
  })
})

describe('stories/storage — missing shopId degrades safely', () => {
  test('a missing shopId is a no-op on write and empty on read (no shared bucket)', async () => {
    await markSlideAsViewed('story-1', 'slide-1', undefined)
    await setLastSeenSlide('story-1', 'slide-1', undefined)

    expect(await getViewedSlides('story-1', undefined)).toEqual([])
    expect(await getLastSeenSlide('story-1', undefined)).toBeNull()
    // Nothing was persisted at all.
    expect(await AsyncStorage.getAllKeys()).toEqual([])
  })
})
