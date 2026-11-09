import { fetchSharedStoryV3, setStoriesApiV3Domain } from '../components/widgets/storiesApiV3'
import { STORIES_LINK_REOPEN_DELAY, handleStoriesLink, resetStoriesLinkState } from '../components/widgets/storiesLink'
import { activeStoriesShow, attachStoriesShowHost, registerOpenStoriesViewer } from '../components/widgets/storiesShow'

// PersonalizationStories.handleLink(url, options) — opening a campaign by a «Поделиться» link.

jest.mock('../components/widgets/storiesApiV3', () => ({
  ...jest.requireActual('../components/widgets/storiesApiV3'),
  fetchSharedStoryV3: jest.fn(),
}))

const LINK = 'https://demo.personaClick.ru/?r46_stories=115bd0b67cf5989a1b60c841790b2af6&r46_story=40&r46_slide=37'
const sdk = { shop_id: 'shop' }
const campaign = {
  id: 1,
  stories: [{ id: 40, start_position: 1, share_url: 'https://demo/?r46_story=40', slides: [{ id: 36 }, { id: 37 }] }],
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('Stories V2 — handleLink', () => {
  let rendered
  let detach

  beforeEach(() => {
    fetchSharedStoryV3.mockReset()
    resetStoriesLinkState()
    setStoriesApiV3Domain('app.personaClick.ru')
    rendered = []
    detach = attachStoriesShowHost((request) => rendered.push(request))
  })

  afterEach(() => {
    activeStoriesShow()?.finish()
    detach()
    setStoriesApiV3Domain(null)
  })

  test('false for other links and without apiV3Domain; nothing is loaded', () => {
    expect(handleStoriesLink('https://shop.test/?utm_source=tg', { sdk })).toBe(false)
    expect(handleStoriesLink('https://shop.test/?r46_stories=main&r46_story=abc', { sdk })).toBe(false)
    expect(handleStoriesLink('not a link', { sdk })).toBe(false)
    // Своя схема приложения — тоже ссылка сторис: важны только параметры.
    expect(handleStoriesLink('personaClickrn://demo.personaClick.ru/?utm=1', { sdk })).toBe(false)
    setStoriesApiV3Domain(null)
    expect(handleStoriesLink(LINK, { sdk })).toBe(false)
    expect(fetchSharedStoryV3).not.toHaveBeenCalled()
    expect(rendered).toEqual([])
  })

  test('the host of the call wins: without the global one handleLink works with its own value', async () => {
    setStoriesApiV3Domain(null)
    fetchSharedStoryV3.mockResolvedValue(campaign)
    expect(handleStoriesLink(LINK, { sdk })).toBe(false)
    expect(handleStoriesLink(LINK, { sdk, apiV3Domain: 'own.test' })).toBe(true)
    await flush()
    expect(fetchSharedStoryV3.mock.calls[0][2]).toBe('own.test')
    expect(rendered[0].options.preloaded.host).toBe('own.test')
    activeStoriesShow()?.finish()
    setStoriesApiV3Domain('app.personaClick.ru')
    expect(handleStoriesLink(LINK, { sdk, apiV3Domain: null })).toBe(false)
  })

  test('loads the campaign of the link and shows it through the show host', async () => {
    fetchSharedStoryV3.mockResolvedValue(campaign)
    const onError = jest.fn()
    const shareUrlTransform = (url) => url.replace('https://', 'personaClickrn://')
    expect(handleStoriesLink(LINK, { sdk, onError, shareLabel: 'Поделиться', shareUrlTransform, code: 'ignored' })).toBe(true)
    await flush()
    expect(fetchSharedStoryV3).toHaveBeenCalledWith(
      sdk,
      { code: '115bd0b67cf5989a1b60c841790b2af6', storyId: 40, slideId: '37' },
      'app.personaClick.ru',
    )
    expect(rendered).toHaveLength(1)
    const options = rendered[0].options
    expect(options).toMatchObject({ code: '115bd0b67cf5989a1b60c841790b2af6', sdk, shareLabel: 'Поделиться', shareUrlTransform, onError })
    expect(options.preloaded).toMatchObject({ host: 'app.personaClick.ru', response: { stories: [{ id: 40 }] }, slideId: '37' })
    expect(typeof options.shared).toBe('string')
    expect(onError).not.toHaveBeenCalled()
  })

  test('a link without a slide: the viewer gets none and keeps the server start_position', async () => {
    fetchSharedStoryV3.mockResolvedValue(campaign)
    expect(handleStoriesLink(LINK.replace('&r46_slide=37', ''), { sdk })).toBe(true)
    await flush()
    expect(rendered[0].options.preloaded.slideId).toBeNull()
  })

  test('the same link while it loads or while it is open is ignored, but still true', async () => {
    let answer
    fetchSharedStoryV3.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    expect(handleStoriesLink(LINK, { sdk })).toBe(true)
    expect(handleStoriesLink(LINK, { sdk })).toBe(true)
    answer(campaign)
    await flush()
    expect(handleStoriesLink(LINK, { sdk })).toBe(true)
    await flush()
    expect(fetchSharedStoryV3).toHaveBeenCalledTimes(1)
    expect(rendered).toHaveLength(1)
    // Другой слайд той же кампании — другая ссылка.
    fetchSharedStoryV3.mockResolvedValue(campaign)
    expect(handleStoriesLink(LINK.replace('r46_slide=37', 'r46_slide=38'), { sdk })).toBe(true)
    await flush()
    expect(fetchSharedStoryV3).toHaveBeenCalledTimes(2)
  })

  test('404, an empty answer or a missing host: onError and nothing is shown', async () => {
    const onError = jest.fn()
    fetchSharedStoryV3.mockRejectedValueOnce(new Error('Request failed with status code 404'))
    handleStoriesLink(LINK, { sdk, onError })
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(rendered).toEqual([])

    fetchSharedStoryV3.mockResolvedValueOnce({ stories: [{ id: 40, slides: [] }] })
    handleStoriesLink(LINK, { sdk, onError })
    await flush()
    expect(onError).toHaveBeenCalledTimes(2)
    expect(String(onError.mock.calls[1][0])).toMatch(/empty/)
    expect(rendered).toEqual([])
  })

  test('a timeout reports once and a late answer is dropped', async () => {
    jest.useFakeTimers()
    try {
      let answer
      fetchSharedStoryV3.mockReturnValue(new Promise((resolve) => (answer = resolve)))
      const onError = jest.fn()
      handleStoriesLink(LINK, { sdk, onError })
      jest.advanceTimersByTime(15000)
      expect(onError).toHaveBeenCalledTimes(1)
      answer(campaign)
      await Promise.resolve()
      await Promise.resolve()
      expect(rendered).toEqual([])
    } finally {
      jest.useRealTimers()
    }
  })

  test('closes other open viewers first, then shows after a short delay', async () => {
    jest.useFakeTimers()
    try {
      fetchSharedStoryV3.mockResolvedValue(campaign)
      const close = jest.fn()
      registerOpenStoriesViewer(close)
      handleStoriesLink(LINK, { sdk })
      for (let i = 0; i < 5; i += 1) await Promise.resolve()
      expect(close).toHaveBeenCalledTimes(1)
      expect(rendered).toEqual([])
      jest.advanceTimersByTime(STORIES_LINK_REOPEN_DELAY)
      expect(rendered).toHaveLength(1)
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('Stories V2 — widget statics', () => {
  test('apiV3Domain reads and writes the SDK setting; handleLink is there', () => {
    const { PersonalizationStories } = require('../internal/v3')
    PersonalizationStories.apiV3Domain = 'app.personaClick.ru'
    expect(PersonalizationStories.apiV3Domain).toBe('app.personaClick.ru')
    PersonalizationStories.apiV3Domain = null
    expect(PersonalizationStories.apiV3Domain).toBeNull()
    expect(PersonalizationStories.handleLink('https://shop.test/?r46_stories=a&r46_story=1')).toBe(false)
  })
})
