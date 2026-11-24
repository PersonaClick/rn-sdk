import axios from 'axios'
import {
  parseStoriesShareLink,
  storiesShareLinkKey,
  storyLinkStartIndex,
  storyShareTarget,
  storyShareUrl,
} from '../components/design-system/storySupport'
import {
  fetchSharedStoryV3,
  fetchStoriesFeedV3,
  storiesV3ResponseDeviceId,
  resolveStoriesApiV3Domain,
  setStoriesApiV3Domain,
  storiesApiV3Domain,
  storiesIdentity,
  storiesV3EventBody,
  storiesV3EventsUrl,
  storiesV3FeedUrl,
  storiesV3StoryUrl,
  trackStoriesV3,
  unwrapStoriesV3,
} from '../components/widgets/storiesApiV3'
import { STORY_PAUSE, STORY_VIEWER_CLOSED, isStoryClockRunning, storyViewerReducer } from '../components/design-system/storyViewerState'

// Stories V2 «Поделиться» (DEV-4618): the share link of a slide, links that open a campaign, API v3.

jest.mock('axios', () => jest.fn())

describe('Stories V2 share — parse a link (the table of the JS SDK)', () => {
  const at = (query) => `https://shop.test/promo${query}`

  test('reads block, campaign and slide; other parameters do not matter', () => {
    expect(parseStoriesShareLink(at('?utm_source=tg&r46_stories=main&r46_story=5&r46_slide=10'))).toEqual({
      code: 'main',
      storyId: 5,
      slideId: '10',
    })
  })

  test('accepts links without a slide and virtual slides of product campaigns', () => {
    expect(parseStoriesShareLink(at('?r46_stories=main&r46_story=5'))).toEqual({ code: 'main', storyId: 5, slideId: null })
    expect(parseStoriesShareLink(at('?r46_stories=main&r46_story=5&r46_slide=5_2'))?.slideId).toBe('5_2')
  })

  test('ignores other pages and broken links; a broken slide still opens the campaign', () => {
    expect(parseStoriesShareLink(at(''))).toBeNull()
    expect(parseStoriesShareLink(at('?r46_story=5'))).toBeNull()
    expect(parseStoriesShareLink(at('?r46_stories=main&r46_story=abc'))).toBeNull()
    expect(parseStoriesShareLink(at('?r46_stories=&r46_story=5'))).toBeNull()
    expect(parseStoriesShareLink(at('?r46_stories=main&r46_story=12345678901'))).toBeNull()
    expect(parseStoriesShareLink(at('?r46_stories=main&r46_story=5&r46_slide=1;DROP'))?.slideId).toBeNull()
    expect(parseStoriesShareLink(at('?r46_stories=main&r46_story=5&r46_slide=1_12345'))?.slideId).toBeNull()
    expect(parseStoriesShareLink(null)).toBeNull()
  })

  test('decodes values, takes the first of repeated keys, stops at the fragment', () => {
    expect(parseStoriesShareLink(at('?r46_stories=a%20b&r46_story=5&r46_story=6'))).toMatchObject({ code: 'a b', storyId: 5 })
    expect(parseStoriesShareLink(at('?r46_stories=main&r46_story=5#r46_slide=7'))?.slideId).toBeNull()
    expect(parseStoriesShareLink('https://shop.test/#/?r46_stories=main&r46_story=5')).toBeNull()
    expect(parseStoriesShareLink(at('?r46_stories=%E0%A4%A&r46_story=5'))?.code).toBe('%E0%A4%A')
  })

  test('the link of the demo opens campaign 40 at slide 37; the key tells links apart', () => {
    const link = parseStoriesShareLink(
      'https://demo.personaClick.ru/?r46_stories=115bd0b67cf5989a1b60c841790b2af6&r46_story=40&r46_slide=37',
    )
    expect(link).toEqual({ code: '115bd0b67cf5989a1b60c841790b2af6', storyId: 40, slideId: '37' })
    expect(storiesShareLinkKey(link)).not.toBe(storiesShareLinkKey({ ...link, slideId: null }))
  })

  test('the scheme and the path do not matter: an app scheme opens the same campaign', () => {
    const own = 'personaClickrn://demo.personaClick.ru/?r46_stories=115bd0b67cf5989a1b60c841790b2af6&r46_story=40&r46_slide=37'
    expect(parseStoriesShareLink(own)).toEqual({ code: '115bd0b67cf5989a1b60c841790b2af6', storyId: 40, slideId: '37' })
    expect(parseStoriesShareLink('personaClickrn://stories?r46_stories=c&r46_story=40')).toEqual({ code: 'c', storyId: 40, slideId: null })
  })
})

describe('Stories V2 share — the link of a slide', () => {
  const story = { shareable: true, share_url: 'https://shop.test/?r46_story=5' }

  test('the slide link, else the campaign link as is — no r46_slide added (slideShareUrl of the JS SDK)', () => {
    expect(storyShareUrl(story, { id: 1, share_url: 'https://shop.test/?r46_slide=1' })).toBe('https://shop.test/?r46_slide=1')
    // У товарного слайда своей ссылки нет: ссылка кампании как есть.
    expect(storyShareUrl(story, { id: '5_2' })).toBe('https://shop.test/?r46_story=5')
    expect(storyShareUrl(story, { id: '5_0', share_url: '' })).toBe('https://shop.test/?r46_story=5')
    expect(storyShareUrl(story, { id: 37, share_url: null })).toBe('https://shop.test/?r46_story=5')
    expect(storyShareUrl(story, null)).toBe('https://shop.test/?r46_story=5')
    expect(storyShareUrl({ share_url: 'HTTP://shop.test/' }, {})).toBe('HTTP://shop.test/')
    expect(storyShareUrl({ share_url: 'shop://x' }, { id: 37 })).toBeNull()
  })

  test('nothing when sharing is off or the link is not http(s)', () => {
    expect(storyShareUrl({ ...story, shareable: false }, { share_url: 'https://shop.test/' })).toBeNull()
    expect(storyShareUrl({}, {})).toBeNull()
    expect(storyShareUrl({ share_url: 'javascript:alert(1)' }, {})).toBeNull()
    expect(storyShareUrl({ share_url: 'shop://x' }, { share_url: null })).toBeNull()
    expect(storyShareUrl(null, {})).toBeNull()
  })
})

describe('Stories V2 share — the slide a link opens on', () => {
  // Сервер не знает виртуальных слайдов: на `slide_id=39_2` всё равно `start_position: 0`.
  const products = { id: 39, start_position: 0, slides: [{ id: '39_0' }, { id: '39_1' }, { id: '39_2' }] }
  const photos = { id: 40, start_position: 1, slides: [{ id: 36 }, { id: 37 }] }

  test('the link slide when the campaign has it, product campaigns too; shared_open goes with it', () => {
    const start = storyLinkStartIndex(products, '39_2')
    expect(start).toBe(2)
    expect(products.slides[start].id).toBe('39_2')
    expect(storyLinkStartIndex(photos, '36')).toBe(0)
  })

  test('no such slide or no slide in the link — the server start_position', () => {
    expect(storyLinkStartIndex(photos, '99')).toBe(1)
    expect(photos.slides[storyLinkStartIndex(photos, '99')].id).toBe(37)
    expect(storyLinkStartIndex(photos, null)).toBe(1)
    expect(storyLinkStartIndex(photos, undefined)).toBe(1)
    expect(storyLinkStartIndex({ start_position: 9, slides: [{ id: 1 }, { id: 2 }] }, null)).toBe(1)
  })
})

describe('Stories V2 share — the link for the share sheet', () => {
  const url = 'https://demo.personaClick.ru/?r46_stories=c&r46_story=40&r46_slide=37'

  test('the host transform goes to the sheet; without it — the link as is', () => {
    const toScheme = (link) => link.replace(/^https?:\/\//i, 'personaClickrn://')
    expect(storyShareTarget(url, toScheme)).toBe('personaClickrn://demo.personaClick.ru/?r46_stories=c&r46_story=40&r46_slide=37')
    expect(storyShareTarget(url, undefined)).toBe(url)
  })

  test('a broken transform does not lose the link', () => {
    expect(storyShareTarget(url, () => '')).toBe(url)
    expect(storyShareTarget(url, () => null)).toBe(url)
    expect(
      storyShareTarget(url, () => {
        throw new Error('boom')
      }),
    ).toBe(url)
  })
})

describe('Stories V2 API v3 — response and event body', () => {
  test('unwraps the payload; product slides get "" instead of null; share fields stay', () => {
    const feed = unwrapStoriesV3({
      status: 'success',
      payload: {
        id: 1,
        settings: { close_color: '#fff' },
        stories: [
          { id: 39, shareable: true, share_url: 'https://demo/?r46_story=39', slides: [{ id: '39_0', type: '', background: null, preview: null }] },
          { id: 40, slides: [{ id: 37, type: 'image', background: 'https://cdn/a.jpg', preview: '', share_url: 'https://demo/?r46_slide=37' }] },
        ],
      },
    })
    expect(feed.id).toBe(1)
    expect(feed.stories[0]).toMatchObject({ shareable: true, share_url: 'https://demo/?r46_story=39' })
    expect(feed.stories[0].slides[0]).toMatchObject({ id: '39_0', background: '', preview: '' })
    expect(feed.stories[1].slides[0]).toMatchObject({ background: 'https://cdn/a.jpg', share_url: 'https://demo/?r46_slide=37' })
    expect(unwrapStoriesV3({ status: 'success', payload: { id: 2 } }).stories).toEqual([])
  })

  test('fail status or no payload is an error', () => {
    expect(() => unwrapStoriesV3({ status: 'fail', message: 'Resource not found' })).toThrow(/Stories v3/)
    expect(() => unwrapStoriesV3({ status: 'success' })).toThrow()
    expect(() => unwrapStoriesV3('<html>404</html>')).toThrow()
    expect(() => unwrapStoriesV3(null)).toThrow()
  })

  test('event body: story id a number when numeric, slide id always a string', () => {
    const who = { shop_id: 'shop', did: 'did1' }
    expect(storiesV3EventBody(who, 'view', 40, 37)).toEqual({ shop_id: 'shop', did: 'did1', event: 'view', story_id: 40, slide_id: '37' })
    expect(storiesV3EventBody(who, 'share', '39', '39_0')).toEqual({ shop_id: 'shop', did: 'did1', event: 'share', story_id: 39, slide_id: '39_0' })
    expect(storiesV3EventBody(who, 'click', 'promo-1', 12)).toMatchObject({ story_id: 'promo-1', slide_id: '12' })
  })

  test('URLs and the domain setting', () => {
    expect(storiesV3FeedUrl('app.personaClick.ru', 'a b')).toBe('https://app.personaClick.ru/api/v3/storefront/stories/a%20b')
    expect(storiesV3StoryUrl('app.personaClick.ru', 'c', 40)).toBe('https://app.personaClick.ru/api/v3/storefront/stories/c/story/40')
    expect(storiesV3EventsUrl('app.personaClick.ru', 'c')).toBe('https://app.personaClick.ru/api/v3/storefront/stories/c/events')
    setStoriesApiV3Domain(' https://app.personaClick.ru/ ')
    expect(storiesApiV3Domain()).toBe('app.personaClick.ru')
    setStoriesApiV3Domain('')
    expect(storiesApiV3Domain()).toBeNull()
    setStoriesApiV3Domain(null)
    expect(storiesApiV3Domain()).toBeNull()
  })
})

describe('Stories V2 API v3 — the global value of the widget', () => {
  test('PersonalizationStories.apiV3Domain reaches the stories API', () => {
    const { PersonalizationStories } = require('../internal/v3')
    PersonalizationStories.apiV3Domain = 'https://app.personaClick.ru/'
    expect(storiesApiV3Domain()).toBe('app.personaClick.ru')
    expect(PersonalizationStories.apiV3Domain).toBe('app.personaClick.ru')
    PersonalizationStories.apiV3Domain = null
    expect(storiesApiV3Domain()).toBeNull()
  })
})

describe('Stories V2 API v3 — the value of an instance', () => {
  afterEach(() => setStoriesApiV3Domain(null))

  test('the widget value wins over the global one; no value — the global one', () => {
    setStoriesApiV3Domain('global.test')
    expect(resolveStoriesApiV3Domain('https://own.test/')).toBe('own.test')
    expect(resolveStoriesApiV3Domain(undefined)).toBe('global.test')
    expect(resolveStoriesApiV3Domain(null)).toBeNull()
    expect(resolveStoriesApiV3Domain('')).toBeNull()
  })

  test('a widget without a value stays on the old API even when its neighbour uses v3', () => {
    expect(resolveStoriesApiV3Domain('app.personaClick.ru')).toBe('app.personaClick.ru')
    expect(resolveStoriesApiV3Domain(undefined)).toBeNull()
    expect(storiesApiV3Domain()).toBeNull()
  })
})

describe('Stories V2 API v3 — requests', () => {
  // SDK, у которого init прошёл позже: команды ждут в очереди.
  const sdkWithQueue = () => {
    const queue = []
    return { shop_id: 'shop', did: '', push: (command) => queue.push(command), getDeviceId: async () => 'did1', flush: () => queue.forEach((c) => c()), queue }
  }

  beforeEach(() => {
    axios.mockReset()
  })

  test('the feed waits for init, then goes with the identity of the JS SDK, cookie-less', async () => {
    axios.mockResolvedValue({ data: { status: 'success', payload: { id: 1, stories: [] } } })
    const sdk = sdkWithQueue()
    const feed = fetchStoriesFeedV3(sdk, 'code1', 'app.personaClick.ru')
    await Promise.resolve()
    expect(axios).not.toHaveBeenCalled()
    sdk.flush()
    const loaded = await feed
    expect(loaded).toMatchObject({ id: 1, stories: [] })
    // `did` загрузки — в ответе, вместе с копией ответа: лента не ходит за ним в очередь второй раз.
    expect(storiesV3ResponseDeviceId(loaded)).toBe('did1')
    expect(storiesV3ResponseDeviceId({ ...loaded, stories: [] })).toBe('did1')
    expect(Object.keys(loaded)).toEqual(['id', 'stories'])
    expect(storiesV3ResponseDeviceId({ stories: [] })).toBeNull()
    expect(axios.mock.calls[0][0]).toMatchObject({
      method: 'GET',
      url: 'https://app.personaClick.ru/api/v3/storefront/stories/code1',
      withCredentials: false,
    })
    // Без сеанса и A/B-группы — пустые строки, поток по умолчанию, без тестового режима — без testmode.
    expect(axios.mock.calls[0][0].params).toEqual({ shop_id: 'shop', did: 'did1', sid: '', segment: '', stream: 'react-native' })
  })

  test('sid, segment, stream and testmode: the native session, the A/B group, the shop stream, popups v3 test mode', async () => {
    axios.mockResolvedValue({ data: { status: 'success', payload: { id: 1, stories: [] } } })
    const sdk = {
      shop_id: 'shop',
      getDeviceId: async () => 'did1',
      userSeance: 'sid-7',
      stream: 'android',
      segments: { getAbGroup: () => 'B' },
      segment: 'A',
      _popupsV3: { testMode: true },
    }
    await fetchStoriesFeedV3(sdk, 'code1', 'h')
    expect(axios.mock.calls[0][0].params).toEqual({ shop_id: 'shop', did: 'did1', sid: 'sid-7', segment: 'B', stream: 'android', testmode: true })
    await fetchSharedStoryV3(sdk, { code: 'c', storyId: 40, slideId: '40_1' }, 'h')
    expect(axios.mock.calls[1][0].params).toEqual({
      shop_id: 'shop',
      did: 'did1',
      sid: 'sid-7',
      segment: 'B',
      stream: 'android',
      testmode: true,
      slide_id: '40_1',
    })
    await trackStoriesV3({ ...sdk, segments: undefined, _popupsV3: { testMode: false } }, 'c', 'view', '40', '40_1', 'h')
    expect(axios.mock.calls[2][0].data).toEqual({
      shop_id: 'shop',
      did: 'did1',
      sid: 'sid-7',
      segment: 'A',
      stream: 'android',
      event: 'view',
      story_id: 40,
      slide_id: '40_1',
    })
  })

  test('identity: an A/B group other than A or B is empty; a throwing getter falls back to the copy', () => {
    const base = { shop_id: 's', userSeance: null, stream: '' }
    expect(storiesIdentity({ ...base, segment: 'C' }, 'd')).toEqual({ shop_id: 's', did: 'd', sid: '', segment: '', stream: 'react-native' })
    expect(storiesIdentity({ ...base, segments: { getAbGroup: () => { throw new Error('x') } }, segment: 'A' }, 'd').segment).toBe('A')
    expect(storiesIdentity({ ...base, segment: 'A' }, 'd', { segment: false })).not.toHaveProperty('segment')
    expect(storiesIdentity({ ...base, _popupsV3: { testMode: 'yes' } }, 'd')).not.toHaveProperty('testmode')
  })

  test('a shared story asks for the slide; events are a JSON POST', async () => {
    axios.mockResolvedValue({ data: { status: 'success', payload: { stories: [] } } })
    const sdk = { shop_id: 'shop', getDeviceId: async () => 'did1' }
    await fetchSharedStoryV3(sdk, { code: 'c', storyId: 40, slideId: '37' }, 'app.personaClick.ru')
    expect(axios.mock.calls[0][0]).toMatchObject({
      url: 'https://app.personaClick.ru/api/v3/storefront/stories/c/story/40',
      params: { shop_id: 'shop', did: 'did1', sid: '', segment: '', stream: 'react-native', slide_id: '37' },
    })
    await fetchSharedStoryV3(sdk, { code: 'c', storyId: 40, slideId: null }, 'app.personaClick.ru')
    expect(axios.mock.calls[1][0].params.slide_id).toBeUndefined()
    await trackStoriesV3(sdk, 'c', 'shared_open', 40, 37, 'app.personaClick.ru')
    expect(axios.mock.calls[2][0]).toMatchObject({
      method: 'POST',
      url: 'https://app.personaClick.ru/api/v3/storefront/stories/c/events',
      headers: { 'Content-Type': 'application/json' },
      data: { shop_id: 'shop', did: 'did1', sid: '', segment: '', stream: 'react-native', event: 'shared_open', story_id: 40, slide_id: '37' },
    })
  })

  test('an HTTP error or a fail answer rejects', async () => {
    const sdk = { shop_id: 'shop', getDeviceId: async () => 'did1' }
    axios.mockRejectedValueOnce(new Error('Request failed with status code 404'))
    await expect(fetchSharedStoryV3(sdk, { code: 'c', storyId: 999, slideId: null }, 'h')).rejects.toThrow(/404/)
    axios.mockResolvedValueOnce({ data: { status: 'fail', message: 'Resource not found' } })
    await expect(fetchStoriesFeedV3(sdk, 'c', 'h')).rejects.toThrow(/Stories v3/)
  })
})

describe('Stories V2 viewer — share pause and opening at a slide', () => {
  const stories = [{ id: 40, start_position: 0, viewed: true, slides: [{ id: 36 }, { id: 37 }, { id: 38 }] }]
  const open = (slide) => storyViewerReducer(STORY_VIEWER_CLOSED, { type: 'open', index: 0, slide, stories, seen: { 40: ['36'] } })

  test('a slide given on open wins over the first-unseen rule and is clamped', () => {
    expect(open(undefined)).toMatchObject({ story: 0, slide: 0 })
    expect(open(1)).toMatchObject({ open: true, story: 0, slide: 1, entry: 1 })
    expect(open(9)).toMatchObject({ slide: 2 })
    expect(open(-1)).toMatchObject({ slide: 0 })
  })

  test('the share sheet is its own pause reason: the clock stops and resumes', () => {
    const paused = storyViewerReducer(open(1), { type: 'pause', reason: STORY_PAUSE.SHARE, stories })
    expect(isStoryClockRunning(paused)).toBe(false)
    const held = storyViewerReducer(paused, { type: 'pause', reason: STORY_PAUSE.HOLD, stories })
    expect(isStoryClockRunning(storyViewerReducer(held, { type: 'resume', reason: STORY_PAUSE.SHARE, stories }))).toBe(false)
    expect(isStoryClockRunning(storyViewerReducer(paused, { type: 'resume', reason: STORY_PAUSE.SHARE, stories }))).toBe(true)
  })
})
