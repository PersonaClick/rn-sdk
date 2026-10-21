import { STORY_VIEWER_CLOSED, storyViewerReducer } from '../components/design-system/storyViewerState'
import {
  animatedSlideDurationMs,
  fetchGifLoopMs,
  gifFrameDelaysMs,
  gifLoopMs,
  isGif,
} from '../components/design-system/storyGif'

// Stories V2 animated GIF (rules G1, G2, G9) on the fixture shared by all four SDKs.

// 2x2, 3 frames, delays 10 cs / 0 cs / 50 cs, loops forever.
const FIXTURE = Uint8Array.from(
  Buffer.from(
    'R0lGODlhAgACAIEAAP8AAAD/AAAA/////yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAgACAAACAoRRACH5BAAAAAAALAAA' +
      'AAACAAIAAAICjFMAIfkEADIAAAAsAAAAAAIAAgAAAgKUVQA7',
    'base64',
  ),
)
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('Stories V2 — GIF loop', () => {
  test('G1: a gif is recognised by its signature', () => {
    expect(isGif(FIXTURE)).toBe(true)
    expect(isGif(Uint8Array.from(Buffer.from('GIF87a....')))).toBe(true)
    expect(isGif(PNG)).toBe(false)
    expect(isGif(new Uint8Array(3))).toBe(false)
  })

  test('G2: frame delays below 20 ms count as 100 ms', () => {
    expect(gifFrameDelaysMs(FIXTURE)).toEqual([100, 100, 500])
    expect(gifLoopMs(FIXTURE)).toBe(700)
  })

  test('not a gif or a broken gif has no loop', () => {
    expect(gifLoopMs(PNG)).toBeNull()
    expect(gifLoopMs(FIXTURE.slice(0, 30))).toBeNull()
  })

  test('G2: the slide lasts the longer of the loop and the admin duration', () => {
    expect(animatedSlideDurationMs(5000, 8000)).toBe(8000)
    expect(animatedSlideDurationMs(5000, 700)).toBe(5000)
    expect(animatedSlideDurationMs(5000, null)).toBe(5000)
    expect(animatedSlideDurationMs(5000, 0)).toBe(5000)
  })
})

describe('Stories V2 — GIF fetch (G9)', () => {
  const response = (type, bytes = FIXTURE, ok = true) => ({
    ok,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) },
    arrayBuffer: jest.fn(async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  })

  test('reads the loop of a gif response', async () => {
    const fetchImpl = jest.fn(async () => response('image/gif'))
    await expect(fetchGifLoopMs('https://x/a.gif', fetchImpl)).resolves.toBe(700)
  })

  test('a non-gif response is not downloaded', async () => {
    const jpeg = response('image/jpeg')
    await expect(fetchGifLoopMs('https://x/a.jpg', jest.fn(async () => jpeg))).resolves.toBeNull()
    expect(jpeg.arrayBuffer).not.toHaveBeenCalled()
  })

  test('an http or network error gives no loop', async () => {
    await expect(fetchGifLoopMs('https://x/a.gif', jest.fn(async () => response('image/gif', FIXTURE, false)))).resolves.toBeNull()
    await expect(fetchGifLoopMs('https://x/a.gif', jest.fn(async () => Promise.reject(new Error('offline'))))).resolves.toBeNull()
    await expect(fetchGifLoopMs('', jest.fn())).resolves.toBeNull()
  })
})

describe('Stories V2 viewer — GIF slide length', () => {
  const stories = [
    {
      id: 7,
      slides: [
        { id: 71, type: 'image', background: 'https://x/clock.gif', duration: 5 },
        { id: 72, type: 'video', background: 'https://x/v.mp4', duration: 5 },
      ],
    },
  ]
  const run = (state, ...actions) => actions.reduce((s, a) => storyViewerReducer(s, { stories, seen: {}, ...a }), state)
  const open = () => run(STORY_VIEWER_CLOSED, { type: 'open', index: 0 })

  test('G2: a longer loop stretches the slide, a shorter one leaves the admin duration', () => {
    expect(run(open(), { type: 'mediaReady' }, { type: 'animationLoop', loopMs: 8000 }).durationMs).toBe(8000)
    expect(run(open(), { type: 'mediaReady' }, { type: 'animationLoop', loopMs: 700 }).durationMs).toBe(5000)
  })

  test('the loop may arrive before the image is ready', () => {
    const s = run(open(), { type: 'animationLoop', loopMs: 8000 }, { type: 'mediaReady' })
    expect(s.durationMs).toBe(8000)
  })

  test('a restart keeps the measured length', () => {
    const s = run(open(), { type: 'mediaReady' }, { type: 'animationLoop', loopMs: 8000 }, { type: 'previous' })
    expect(s.durationMs).toBe(8000)
  })

  test('a video slide driven by the player ignores a loop', () => {
    const video = run(open(), { type: 'next' }, { type: 'mediaReady', durationMs: 3000 }, { type: 'animationLoop', loopMs: 8000 })
    expect(video).toMatchObject({ clock: 'player', durationMs: 3000 })
  })
})
