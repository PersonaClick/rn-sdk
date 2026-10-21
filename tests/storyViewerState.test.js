import {
  STORY_PAUSE,
  STORY_VIEWER_CLOSED,
  storyViewerReducer,
  isStoryClockRunning,
  storyPlayerShouldPlay,
  storyClockStep,
  storyPlayerPosition,
  storyTapZone,
  storyDragKind,
  storyGestureOutcome,
  storyCountdown,
  STORY_MEDIA_TIMEOUT,
  STORY_VIDEO_RETRY_DELAY,
} from '../components/design-system/storyViewerState'
import { storyPriceView } from '../components/design-system/storySupport'

// Stories V2 viewer logic without UI (rule E1): navigation, start slide, pauses, sheet, gestures.

const stories = [
  { id: 1, start_position: 1, slides: [{ id: 11, type: '' }, { id: 12, type: '' }, { id: 13, type: '' }] },
  { id: 2, slides: [] },
  { id: 3, slides: [{ id: 31, type: 'image', background: 'https://x/a.jpg' }, { id: 32, type: '', duration: 0 }] },
]
const ctx = { stories, seen: {} }
const run = (state, ...actions) => actions.reduce((s, a) => storyViewerReducer(s, { ...ctx, ...a }), state)
const open = (index = 0, seen = {}) => storyViewerReducer(STORY_VIEWER_CLOSED, { type: 'open', index, stories, seen })

describe('Stories V2 viewer — navigation', () => {
  test('A4: opens at start_position, or the first unseen slide', () => {
    expect(open(0)).toMatchObject({ open: true, story: 0, slide: 1, entry: 1 })
    expect(open(0, { 1: ['11'] })).toMatchObject({ slide: 1 })
    expect(open(0, { 1: ['11', '12', '13'] })).toMatchObject({ slide: 0 })
  })

  test('next/previous walk slides, skip empty stories in the direction of travel', () => {
    const s = run(open(0), { type: 'tap', zone: 'next' })
    expect(s).toMatchObject({ story: 0, slide: 2, entry: 2 })
    const into = run(s, { type: 'next' })
    expect(into).toMatchObject({ story: 2, slide: 0 })
    const back = run(into, { type: 'tap', zone: 'previous' })
    expect(back).toMatchObject({ story: 0, slide: 1 })
  })

  test('B3: previous on the first slide of the first story restarts it', () => {
    const first = run(open(0), { type: 'previous' })
    const restarted = run(first, { type: 'previous' })
    expect(restarted).toMatchObject({ story: 0, slide: 0, entry: first.entry })
    expect(restarted.epoch).toBe(first.epoch + 1)
  })

  test('F3: a restart keeps the media mounted and ready, only the clock starts over', () => {
    const media = [{ id: 5, slides: [{ id: 51, type: 'video', background: 'https://x/v.mp4' }] }]
    const act = (state, action) => storyViewerReducer(state, { ...action, stories: media, seen: {} })
    const playing = act(act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 }), { type: 'mediaReady', durationMs: 8000 })
    const restarted = act(playing, { type: 'previous' })
    expect(restarted).toMatchObject({ media: 'ready', clock: 'player', durationMs: 8000, pauses: [] })
    expect(restarted.entry).toBe(playing.entry)
    expect(restarted.load).toBe(playing.load)
    expect(restarted.epoch).toBe(playing.epoch + 1)
  })

  test('F3: a new slide and Retry remount the media, a restart does not', () => {
    const s = open(0)
    expect(run(s, { type: 'next' }).load).toBe(s.load + 1)
    const failed = run(open(2), { type: 'mediaFailed' })
    expect(run(failed, { type: 'retry' }).load).toBe(failed.load + 1)
    const first = run(open(0), { type: 'previous' })
    expect(run(first, { type: 'previous' }).load).toBe(first.load)
  })

  test('B3: next on the last slide of the last story closes', () => {
    const last = run(open(2), { type: 'next' })
    expect(last).toMatchObject({ story: 2, slide: 1 })
    expect(run(last, { type: 'ended' }).closing).toBe(true)
  })

  test('B1: a tap in the centre third does nothing', () => {
    const s = open(0)
    expect(run(s, { type: 'tap', zone: 'center' })).toBe(s)
  })

  test('B4: swipes switch stories; nothing past the ends', () => {
    const s = run(open(0), { type: 'swipe', direction: 'next' })
    expect(s).toMatchObject({ story: 2 })
    expect(run(s, { type: 'swipe', direction: 'next' })).toBe(s)
    expect(run(open(0), { type: 'swipe', direction: 'previous' }).story).toBe(0)
  })

  test('F11: open inside an open viewer pages to that story from its start slide', () => {
    const s = run(open(0), { type: 'tap', zone: 'next' })
    const paged = run(s, { type: 'page', index: 2 })
    expect(paged).toMatchObject({ open: true, story: 2, slide: 0, entry: s.entry + 1 })
    expect(run(paged, { type: 'page', index: 0 })).toMatchObject({ story: 0, slide: 1 })
  })

  test('F11: paging to the shown story, an empty one or out of range does nothing', () => {
    const s = open(0)
    expect(run(s, { type: 'page', index: 0 })).toBe(s)
    expect(run(s, { type: 'page', index: 1 })).toBe(s)
    expect(run(s, { type: 'page', index: 7 })).toBe(s)
    expect(run(s, { type: 'page', index: -1 })).toBe(s)
    expect(storyViewerReducer(STORY_VIEWER_CLOSED, { ...ctx, type: 'page', index: 2 })).toBe(STORY_VIEWER_CLOSED)
  })

  test('C16: a block without slides never opens', () => {
    const closed = storyViewerReducer(STORY_VIEWER_CLOSED, { type: 'open', index: 0, stories: [{ id: 9, slides: [] }] })
    expect(closed).toMatchObject({ open: false, closing: true })
  })
})

describe('Stories V2 viewer — pauses, media, sheet', () => {
  test('pause reasons stack and the clock runs only without any', () => {
    let s = run(open(0), { type: 'pause', reason: STORY_PAUSE.HOLD }, { type: 'pause', reason: STORY_PAUSE.BACKGROUND })
    expect(s.pauses).toEqual(['background', 'hold'])
    expect(isStoryClockRunning(s)).toBe(false)
    s = run(s, { type: 'resume', reason: 'hold' }, { type: 'resume', reason: 'background' })
    expect(isStoryClockRunning(s)).toBe(true)
  })

  test('C5: media slides wait for media; the player plays while loading only', () => {
    const s = open(2)
    expect(s).toMatchObject({ media: 'loading', pauses: ['loading'] })
    expect(storyPlayerShouldPlay(s)).toBe(true)
    const ready = run(s, { type: 'mediaReady' })
    expect(isStoryClockRunning(ready)).toBe(true)
    expect(storyPlayerShouldPlay(run(ready, { type: 'pause', reason: 'hold' }))).toBe(false)
  })

  test('C4: a known video length drives the clock; buffering pauses it', () => {
    const s = run(open(2), { type: 'mediaReady', durationMs: 7300 })
    expect(s).toMatchObject({ clock: 'player', durationMs: 7300 })
    expect(run(s, { type: 'buffering', active: true }).pauses).toEqual(['loading'])
  })

  test('C5: failure shows retry; retry reloads the slide', () => {
    const failed = run(open(2), { type: 'mediaFailed' })
    expect(failed).toMatchObject({ media: 'error', pauses: ['error'] })
    const retried = run(failed, { type: 'retry' })
    expect(retried).toMatchObject({ media: 'loading', pauses: ['loading'], epoch: failed.epoch + 1 })
  })

  test('A7: admin duration in ms, 10 s when zero', () => {
    expect(run(open(2), { type: 'next' }).durationMs).toBe(10000)
  })

  test('B5: an open sheet pauses, eats taps and swipes, back closes it first', () => {
    const s = run(open(0), { type: 'sheet', open: true })
    expect(s.pauses).toEqual(['sheet'])
    const tapped = run(s, { type: 'tap', zone: 'next' })
    expect(tapped).toMatchObject({ slide: 1, sheetOpen: false, pauses: [] })
    expect(run(s, { type: 'swipe', direction: 'next' })).toBe(s)
    expect(run(s, { type: 'back' })).toMatchObject({ sheetOpen: false, closing: false })
    expect(run(open(0), { type: 'back' }).closing).toBe(true)
  })

  test('F2: the close cross closes the viewer while the sheet is open', () => {
    const s = run(open(0), { type: 'sheet', open: true })
    expect(run(s, { type: 'close' }).closing).toBe(true)
  })

  test('B5: changing slide resets the sheet', () => {
    const s = run(open(0), { type: 'sheet', open: true }, { type: 'ended' })
    expect(s).toMatchObject({ slide: 2, sheetOpen: false, pauses: [] })
  })
})

describe('Stories V2 viewer — clock and gestures', () => {
  test('B6/B7: the clock steps by real frame time, capped after a stall', () => {
    expect(storyClockStep(1000, 1016)).toBe(16)
    expect(storyClockStep(1000, 61000)).toBe(100)
    expect(storyClockStep(1000, 900)).toBe(0)
    expect(storyPlayerPosition({ positionMs: 2000, at: 1000 }, 1100, 5000, true)).toBe(2100)
    expect(storyPlayerPosition({ positionMs: 2000, at: 1000 }, 9000, 5000, true)).toBe(2250)
    expect(storyPlayerPosition({ positionMs: 2000, at: 1000 }, 9000, 5000, false)).toBe(2000)
  })

  test('B1: thirds, mirrored in RTL', () => {
    expect(storyTapZone(10, 300)).toBe('previous')
    expect(storyTapZone(150, 300)).toBe('center')
    expect(storyTapZone(290, 300)).toBe('next')
    expect(storyTapZone(10, 300, true)).toBe('next')
  })

  test('B2/B4: gesture outcomes', () => {
    const base = { x: 290, width: 300 }
    expect(storyGestureOutcome({ ...base, dx: 0, dy: 3 })).toEqual({ type: 'tap', zone: 'next' })
    expect(storyGestureOutcome({ ...base, dx: 0, dy: 3, held: true })).toBeNull()
    expect(storyGestureOutcome({ ...base, dx: 4, dy: 30, held: true })).toBeNull()
    expect(storyGestureOutcome({ ...base, dx: 5, dy: 130 })).toEqual({ type: 'close' })
    expect(storyGestureOutcome({ ...base, dx: 5, dy: 40, vy: 1 })).toEqual({ type: 'close' })
    expect(storyGestureOutcome({ ...base, dx: 5, dy: 40 })).toBeNull()
    expect(storyGestureOutcome({ ...base, dx: -80, dy: 5 })).toEqual({ type: 'swipe', direction: 'next' })
    expect(storyGestureOutcome({ ...base, dx: -80, dy: 5, rtl: true })).toEqual({ type: 'swipe', direction: 'previous' })
    expect(storyGestureOutcome({ ...base, dx: -80, dy: 5, sheetOpen: true })).toBeNull()
    expect(storyDragKind({ dx: 2, dy: 40 })).toBe('vertical')
    expect(storyDragKind({ dx: 2, dy: 40 }, true)).toBe('horizontal')
    expect(storyDragKind({ dx: 3, dy: 4 })).toBeNull()
  })
})

describe('Stories V2 viewer — F5 countdowns freeze in background', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  test('readiness and retry delays are 10 s and 15 s', () => {
    expect(STORY_MEDIA_TIMEOUT).toBe(10000)
    expect(STORY_VIDEO_RETRY_DELAY).toBe(15000)
  })

  test('starts paused and fires once after resume', () => {
    const done = jest.fn()
    const countdown = storyCountdown(1000, done)
    jest.advanceTimersByTime(5000)
    expect(done).not.toHaveBeenCalled()
    countdown.resume()
    jest.advanceTimersByTime(999)
    expect(done).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(done).toHaveBeenCalledTimes(1)
    countdown.resume()
    jest.advanceTimersByTime(5000)
    expect(done).toHaveBeenCalledTimes(1)
  })

  test('a pause keeps the remaining time, resume continues from it', () => {
    const done = jest.fn()
    const countdown = storyCountdown(STORY_MEDIA_TIMEOUT, done)
    countdown.resume()
    jest.advanceTimersByTime(4000)
    countdown.pause()
    expect(countdown.remaining()).toBe(6000)
    jest.advanceTimersByTime(60000)
    expect(done).not.toHaveBeenCalled()
    countdown.resume()
    jest.advanceTimersByTime(5999)
    expect(done).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(done).toHaveBeenCalledTimes(1)
  })

  test('repeated pause/resume never restarts the full delay; cancel stops it for good', () => {
    const done = jest.fn()
    const countdown = storyCountdown(STORY_VIDEO_RETRY_DELAY, done)
    countdown.resume()
    jest.advanceTimersByTime(10000)
    countdown.pause()
    countdown.pause()
    countdown.resume()
    countdown.resume()
    expect(countdown.remaining()).toBe(5000)
    countdown.cancel()
    countdown.resume()
    jest.advanceTimersByTime(60000)
    expect(done).not.toHaveBeenCalled()
  })
})

describe('Stories V2 — C10 price', () => {
  test('promo code crosses out oldprice, else the regular price; discount keeps fractions', () => {
    const item = { price: 19990, price_formatted: '19 990 ₽', promocode: 'P', price_with_promocode: 17990, price_with_promocode_formatted: '17 990 ₽' }
    expect(storyPriceView(item)).toEqual({ type: 'promoCode', price: '17 990 ₽', promoCode: 'P', oldPrice: '19 990 ₽' })
    expect(storyPriceView({ ...item, oldprice: '27990.00', oldprice_formatted: '27 990 ₽' }).oldPrice).toBe('27 990 ₽')
    expect(storyPriceView({ price: 100, price_formatted: '100 ₽', discount_percent: 12.5 }).discount).toBe('12.5%')
    expect(storyPriceView({ price: '100.5', price_formatted: '100,5 ₽', oldprice: '100.25', oldprice_formatted: '100,25 ₽' }).oldPrice).toBeUndefined()
  })
})
