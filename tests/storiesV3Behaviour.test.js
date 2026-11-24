import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  STORY_TEXT_V3_FONT_SIZE,
  isMediaSlide,
  isSkippedSlide,
  isVideoSlide,
  slideHeaderElement,
  slideNeedsMedia,
  slideTextBlocks,
  storyButtonTarget,
  storyColor,
  storyColorScheme,
  storySlideLetterbox,
  storySlideScheme,
  storySlideScrim,
  storySoundButtonShown,
  storyTextBlockProps,
  storyTextRegion,
  storyV3TextBackground,
  storyVideoHasAudio,
} from '../components/design-system/storySupport'
import {
  STORY_V3_CLOSE_DISTANCE,
  STORY_VIEWER_CLOSED,
  storyEntrySlide,
  storyGestureOutcome,
  storyShownSlide,
  storyViewerReducer,
} from '../components/design-system/storyViewerState'
import {
  loadStorySoundMuted,
  rememberStorySoundMuted,
  resetStorySoundMuted,
  storySoundMuted,
} from '../components/design-system/storyNative'
import { PERSONALIZATION_TYPOGRAPHY } from '../constants/typography.constants'

// Stories from the API v3 feed behave as the web SDK's (`v3/src/stories.js`); the legacy feed keeps the
// rules of the kit. Each case shows both.

describe('Stories v3 — media by type (R6)', () => {
  test('v3: image and video by `type`, whatever the background; legacy: a non-empty background', () => {
    const product = { id: '39_0', type: '', background: 'https://x/a.jpg' }
    expect(isMediaSlide(product, true)).toBe(false)
    expect(isMediaSlide(product)).toBe(true)
    expect(isMediaSlide({ type: 'image', background: '' }, true)).toBe(true)
    expect(isMediaSlide({ type: 'image', background: '' })).toBe(false)
    expect(isVideoSlide({ type: 'video', background: 'https://x/v.mp4' }, true)).toBe(true)
    expect(isMediaSlide({ type: 'gif', background: 'https://x/a.gif' }, true)).toBe(false)
  })

  test('nothing to load without an address: the clock does not wait for media that is not there', () => {
    expect(slideNeedsMedia({ type: 'image', background: '' }, true, true)).toBe(false)
    expect(slideNeedsMedia({ type: 'image', background: 'https://x/a.jpg' }, true, true)).toBe(true)
    expect(slideNeedsMedia({ type: 'video', background: '', preview: '' }, true, true)).toBe(false)
    expect(slideNeedsMedia({ type: 'video', background: '', preview: 'https://x/p.jpg' }, true, true)).toBe(true)
    expect(slideNeedsMedia({ type: 'video', background: 'https://x/v.mp4' }, false, true)).toBe(false)
    expect(slideNeedsMedia({ type: '', background: 'https://x/a.jpg' }, true, true)).toBe(false)
  })
})

describe('Stories v3 — slides the web SDK skips', () => {
  test('no media type and no product element — skipped (v3 only)', () => {
    const product = { type: 'product' }
    expect(isSkippedSlide({ type: '', background_color: '#000', elements: [{ type: 'poll' }] }, true)).toBe(true)
    expect(isSkippedSlide({ type: null, background: 'https://x/a.jpg' }, true)).toBe(true)
    expect(isSkippedSlide({ type: '', elements: [{ ...product, item: { id: 1 } }] }, true)).toBe(false)
    expect(isSkippedSlide({ type: 'image', background: '' }, true)).toBe(false)
    expect(isSkippedSlide({ type: 'video', background: 'https://x/v.mp4' }, true)).toBe(false)
    // Старая лента ничего не пропускает.
    expect(isSkippedSlide({ type: '', elements: [] })).toBe(false)
    expect(isSkippedSlide(null, true)).toBe(false)
  })
})

describe('Stories v3 — background_color (R2)', () => {
  test('paints a slide without media instead of the kit card; empty — the kit card', () => {
    expect(storySlideLetterbox({ type: '', background_color: '#112233' }, true)).toBe('#112233')
    expect(storySlideLetterbox({ type: '', background_color: '' }, true)).toBeNull()
    expect(storySlideLetterbox({ type: '' }, true)).toBeNull()
    // Медиа — поля вокруг медиа, как раньше.
    expect(storySlideLetterbox({ type: 'image', background: 'https://x/a.jpg', background_color: '#fff' }, true)).toBe('#fff')
    expect(storySlideLetterbox({ type: 'image', background: 'https://x/a.jpg' }, true)).toBe('#000000')
    // Старая лента: без медиа — карточка кита.
    expect(storySlideLetterbox({ type: '', background_color: '#112233' })).toBeNull()
  })

  test('the kit scheme follows the colour so the kit text stays readable', () => {
    expect(storySlideScheme({ type: '', background_color: '#000' }, true)).toBe('dark')
    expect(storySlideScheme({ type: '', background_color: '#FFF3E0' }, true)).toBe('light')
    expect(storySlideScheme({ type: '', background_color: 'rgb(0,0,0)' }, true)).toBe('dark')
    expect(storySlideScheme({ type: '', background_color: 'red' }, true)).toBeNull()
    expect(storySlideScheme({ type: '' }, true)).toBeNull()
    expect(storySlideScheme({ type: 'video', background: 'https://x/v.mp4' }, true)).toBe('dark')
    expect(storySlideScheme({ type: '', background_color: '#000' })).toBeNull()
  })
})

describe('Stories v3 — colours (R2): one parser, the scheme by the WCAG contrast', () => {
  test('#RGB, #RRGGBB, #RRGGBBAA, rgb() and rgba() → #rrggbbaa; anything else is not a colour', () => {
    expect(storyColor('#F0A')).toBe('#ff00aaff')
    expect(storyColor(' #112233 ')).toBe('#112233ff')
    expect(storyColor('#11223380')).toBe('#11223380')
    expect(storyColor('rgb(17, 34, 51)')).toBe('#112233ff')
    expect(storyColor('rgba(17, 34, 51, 0.5)')).toBe('#11223380')
    expect(storyColor('rgb(17 34 51 / 50%)')).toBe('#11223380')
    ;['red', '#F0A8', '#12345', 'rgb(1,2)', '', null, 12].forEach((value) => expect(storyColor(value)).toBeNull())
  })

  test('the kit text that contrasts more wins: white on dark, black on light', () => {
    // #767676 — белый ≈ 4,54:1 против чёрного ≈ 4,62:1: светлая схема; #757575 — наоборот.
    expect(storyColorScheme('#767676')).toBe('light')
    expect(storyColorScheme('#757575')).toBe('dark')
    expect(storyColorScheme('#007DF2')).toBe('light')
    expect(storyColorScheme('rgb(229, 25, 25)')).toBe('dark')
    // Альфа ложится на чёрный фон просмотра: полупрозрачный белый — серый.
    expect(storyColorScheme('#FFFFFF')).toBe('light')
    expect(storyColorScheme('#FFFFFF33')).toBe('dark')
    expect(storyColorScheme('rgba(255, 255, 255, 0.6)')).toBe('light')
    expect(storyColorScheme('nope')).toBeNull()
    expect(storySlideScheme({ type: '', background_color: '#FFFFFF33' }, true)).toBe('dark')
    expect(storySlideScheme({ type: '', background_color: '#FFFFFFCC' }, true)).toBe('light')
  })
})

describe('Stories v3 — text blocks (R4)', () => {
  test('the default size is the kit body text', () => {
    expect(STORY_TEXT_V3_FONT_SIZE).toBe(PERSONALIZATION_TYPOGRAPHY.baseDefault.fontSize)
    expect(storyTextBlockProps({ text_input: 'Hi' }, true).fontSize).toBe(16)
    expect(storyTextBlockProps({ text_input: 'Hi', font_size: 24 }, true).fontSize).toBe(24)
    expect(storyTextBlockProps({ text_input: 'Hi' }).fontSize).toBe(20)
  })

  test('bold and italic: bold / italic, the legacy text_bold / text_italic too', () => {
    const block = (extra) => storyTextBlockProps({ text_input: 'Hi', ...extra }, true)
    expect(block({ bold: true })).toMatchObject({ bold: true, italic: false })
    expect(block({ text_bold: true, text_italic: 'true' })).toMatchObject({ bold: true, italic: true })
    expect(block({ bold: false, text_bold: true })).toMatchObject({ bold: false })
    expect(block({ italic: 1 })).toMatchObject({ italic: true })
    expect(block({ bold: 'false' })).toMatchObject({ bold: false })
    // Старая лента — только `bold` / `italic`.
    expect(storyTextBlockProps({ text_input: 'Hi', text_bold: true })).toMatchObject({ bold: false })
  })

  test('the background opacity as calculateOpacity of JS: a number is a percent; none — opaque; font types', () => {
    const block = (value) => storyTextBlockProps({ text_input: 'a', text_background_color: '#000', text_background_color_opacity: value }, true)
    const opacity = (value) => block(value).backgroundOpacity
    expect(['40%', 40, '40', ' 40 '].map(opacity)).toEqual([0.4, 0.4, 0.4, 0.4])
    expect(opacity('0.5')).toBeCloseTo(0.005)
    expect(opacity(0.4)).toBeCloseTo(0.004)
    expect(opacity('100%')).toBe(1)
    // Нет прозрачности (у JS `!opacity`: и число 0, и false), не число или вне 0…100 — цвет как есть,
    // непрозрачный.
    ;[undefined, null, '', 0, false, 'abc', '-10', '110'].forEach((value) => expect(opacity(value)).toBe(1))
    expect(block(0)).toMatchObject({ backgroundColor: '#000', backgroundOpacity: 1 })
    // Ноль строкой — прозрачный фон: блок без подложки.
    expect(block('0%')).toMatchObject({ backgroundColor: undefined, backgroundOpacity: undefined })
    expect(block('0')).toMatchObject({ backgroundColor: undefined, backgroundOpacity: undefined })
    // Цвет со своей альфой: верная прозрачность её заменяет, без неё альфа цвета остаётся.
    const own = (color, value) => {
      const props = storyTextBlockProps({ text_input: 'a', text_background_color: color, text_background_color_opacity: value }, true)
      return [props.backgroundColor, props.backgroundOpacity]
    }
    expect(own('#11223380', '50')).toEqual(['#112233ff', 0.5])
    expect(own('rgba(17, 34, 51, 0.2)', '100%')).toEqual(['#112233ff', 1])
    expect(own('#11223300', '40%')).toEqual(['#112233ff', 0.4])
    expect(own('#11223380', undefined)).toEqual(['#11223380', 1])
    expect(own('rgba(17, 34, 51, 0.2)', 0)).toEqual(['rgba(17, 34, 51, 0.2)', 1])
    expect(own('#11223380', '150')).toEqual(['#11223380', 1])
    expect(own('#11223300', '')).toEqual([undefined, undefined])
    expect(own('red', '50')).toEqual(['red', 0.5])
    expect(storyV3TextBackground('#112233', '0%')).toEqual({ color: '#112233ff', opacity: 0 })
    // Старая лента — как раньше: доля 0–1 тоже понимается.
    expect(storyTextBlockProps({ text_input: 'a', text_background_color: '#000', text_background_color_opacity: '0.4' }).backgroundOpacity).toBe(0.4)
    expect(storyTextBlockProps({ text_input: 'a', font_type: 'monospaced' }, true).fontType).toBe('monospaced')
    expect(slideTextBlocks({ elements: [{ type: 'text_block', text_input: 'a' }] }, true)[0].fontSize).toBe(16)
  })

  test('the scrim of a v3 media slide counts its v3 text blocks', () => {
    const slide = { type: 'image', background: 'https://x/a.jpg', elements: [{ type: 'text_block', text_input: 'a' }] }
    expect(storySlideScrim(slide, true)).toBe(0.3)
    expect(storySlideScrim({ type: '', background: 'https://x/a.jpg' }, true)).toBe(0.3)
    expect(storySlideScrim({ type: 'image', background: 'https://x/a.jpg' }, true)).toBe(0.5)
  })
})

describe('Stories v3 — text blocks under the header row', () => {
  test('the region starts at the measured top of the body: under the navigation and the header row', () => {
    // Безопасная зона 47; в содержимом поле 16, шапка 46 и шаг 16 — тело с 78, а со строкой header
    // (40 и шаг 16) — с 134: блоки ниже строки, а не под ней.
    expect(storyTextRegion(47, 78, { y: 0, height: 500 })).toEqual({ top: 125, bottom: 625 })
    expect(storyTextRegion(47, 134, { y: 0, height: 444 })).toEqual({ top: 181, bottom: 625 })
    expect(storyTextRegion(47, 134, { y: 10, height: -5 })).toEqual({ top: 191, bottom: 191 })
    expect(storyTextRegion(null, 134, { y: 0, height: 10 })).toBeNull()
    expect(storyTextRegion(47, null, { y: 0, height: 10 })).toBeNull()
    expect(storyTextRegion(47, 134, null)).toBeNull()
  })
})

describe('Stories v3 — header and buttons (R1, R5)', () => {
  test('the header looks the same on all platforms: icon 40, gap 12, kit body small title and caption subtitle', () => {
    const { STORY_HEADER_STYLE } = require('../components/design-system/StorySlide')
    expect(STORY_HEADER_STYLE).toEqual({ icon: 40, gap: 12, title: 'smEmphasized', subtitle: 'xsDefault' })
    expect(PERSONALIZATION_TYPOGRAPHY[STORY_HEADER_STYLE.title]).toMatchObject({ fontSize: 14, fontWeight: '600' })
    expect(PERSONALIZATION_TYPOGRAPHY[STORY_HEADER_STYLE.subtitle]).toMatchObject({ fontSize: 12, fontWeight: '400' })
  })

  test('the header element: icon, title or subtitle', () => {
    const header = { type: 'header', icon: 'https://x/i.png', title: 'Shop', subtitle: 'News', link: 'https://shop.test/' }
    expect(slideHeaderElement({ elements: [{ type: 'button', title: 'Go' }, header] })).toBe(header)
    expect(slideHeaderElement({ elements: [{ type: 'header', title: ' ', subtitle: '', icon: null }] })).toBeNull()
    expect(slideHeaderElement({ elements: null })).toBeNull()
    expect(storyButtonTarget(header, null, 'ios')).toEqual({ kind: 'link', url: 'https://shop.test/' })
    expect(storyButtonTarget({ ...header, link: '' }, null, 'ios')).toBeNull()
  })

  test('a button without a link opens nothing when the widget passes no product (v3); legacy opens the product', () => {
    const button = { type: 'button', title: 'Buy' }
    const product = { id: 1 }
    expect(storyButtonTarget(button, null, 'android')).toBeNull()
    expect(storyButtonTarget(button, product, 'android')).toEqual({ kind: 'product', product })
  })
})

describe('Stories v3 — start slide and viewed state (R8)', () => {
  const img = (id) => ({ id, type: 'image', background: `https://x/${id}.jpg` })
  const stories = [
    { id: 1, start_position: 1, viewed: true, slides: [img(11), img(12), img(13)] },
    { id: 2, start_position: 0, slides: [img(21), img(22)] },
  ]
  const act = (state, action, extra = {}) => storyViewerReducer(state, { stories, seen: { 1: ['11', '12'] }, ...extra, ...action })
  const lefts = (state) => state.left.map(({ story, completed }) => ({ story, completed }))

  test('v3 opens at start_position, not the first unseen slide nor the start of a viewed story', () => {
    expect(act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 }, { v3: true, positions: {} })).toMatchObject({ story: 0, slide: 1 })
    // Старая лента: просмотренная — с начала (A4).
    expect(act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 })).toMatchObject({ story: 0, slide: 0 })
  })

  test('after a show in this session — the slide it was left on; a finished story — from the start', () => {
    expect(storyEntrySlide(stories[0], { v3: true, positions: { 1: 2 } })).toBe(2)
    expect(storyEntrySlide(stories[0], { v3: true, positions: { 1: 0 } })).toBe(0)
    expect(storyEntrySlide(stories[0], { v3: true, positions: { 1: 9 } })).toBe(1)
    expect(storyEntrySlide(stories[0], { v3: true, positions: null })).toBe(1)
    expect(act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 }, { v3: true, positions: { 1: 2 } })).toMatchObject({ slide: 2 })
  })

  test('a story opened by a link starts at the link slide once, then follows the session as any story', () => {
    const v3 = { v3: true, positions: { 1: 2 } }
    expect(act(STORY_VIEWER_CLOSED, { type: 'open', index: 0, slide: 0 }, v3)).toMatchObject({ story: 0, slide: 0 })
    // Ушли в следующую и вернулись свайпом — слайд сеанса, а не слайд ссылки.
    const away = act(act(STORY_VIEWER_CLOSED, { type: 'open', index: 0, slide: 0 }, v3), { type: 'swipe', direction: 'next' }, v3)
    expect(act(away, { type: 'swipe', direction: 'previous' }, v3)).toMatchObject({ story: 0, slide: 2 })
  })

  test('leaving a story forward: the last slide ends — completed; a swipe to the next — not completed', () => {
    const v3 = { v3: true, positions: {} }
    const opened = act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 }, v3)
    const last = act(opened, { type: 'next' }, v3)
    expect(last).toMatchObject({ slide: 2, leave: 0, left: [] })
    const ended = act(last, { type: 'ended' }, v3)
    expect(ended).toMatchObject({ story: 1, slide: 0, leave: 1 })
    expect(ended.left).toEqual([{ story: 0, completed: true, seq: 1 }])
    const swiped = act(opened, { type: 'swipe', direction: 'next' }, v3)
    expect(swiped).toMatchObject({ story: 1, leave: 1 })
    expect(lefts(swiped)).toEqual([{ story: 0, completed: false }])
    // Конец последней сторис — тоже уход вперёд, просмотр закрывается.
    const closing = act(act(ended, { type: 'next' }, v3), { type: 'next' }, v3)
    expect(closing).toMatchObject({ closing: true, leave: 2 })
    expect(closing.left[closing.left.length - 1]).toEqual({ story: 1, completed: true, seq: 2 })
    // Назад — не уход вперёд.
    expect(act(ended, { type: 'previous' }, v3).leave).toBe(1)
  })

  test('the counters survive closing and opening', () => {
    const v3 = { v3: true, positions: {} }
    const swiped = act(act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 }, v3), { type: 'swipe', direction: 'next' }, v3)
    const reopened = act(act(swiped, { type: 'reset' }, v3), { type: 'open', index: 0 }, v3)
    expect(reopened.leave).toBe(swiped.leave)
    expect(reopened.left).toEqual([])
  })
})

describe('Stories v3 — back on the first slide, as JS (`prev` closes on the first story)', () => {
  const stories = [
    { id: 1, slides: [{ id: 11, type: 'image' }, { id: 12, type: 'image' }] },
    { id: 2, slides: [{ id: 21, type: 'image' }, { id: 22, type: 'image' }] },
  ]
  const act = (state, action, v3) => storyViewerReducer(state, { stories, seen: {}, v3, positions: v3 ? {} : null, ...action })

  test('v3: back on the first slide of the first story closes the viewer; of another story — the previous story', () => {
    const opened = act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 }, true)
    expect(act(opened, { type: 'tap', zone: 'previous' }, true)).toMatchObject({ open: true, closing: true, restart: opened.restart })
    const second = act(STORY_VIEWER_CLOSED, { type: 'open', index: 1 }, true)
    expect(act(second, { type: 'tap', zone: 'previous' }, true)).toMatchObject({ story: 0, slide: 0, closing: false })
  })

  test('v3: a back swipe on the first story closes the viewer, as JS (stories.js `i <= 0` → close); legacy stays', () => {
    const second = act(STORY_VIEWER_CLOSED, { type: 'open', index: 1 }, true)
    const first = act(second, { type: 'swipe', direction: 'previous' }, true)
    expect(first).toMatchObject({ story: 0, closing: false })
    // Закрывает только длинный свайп; короткий рывок у края ничего не делает.
    expect(act(first, { type: 'swipe', direction: 'previous', far: false }, true)).toBe(first)
    expect(act(first, { type: 'swipe', direction: 'previous', far: true }, true)).toMatchObject({ open: true, closing: true })
    const legacy = act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 }, false)
    expect(act(legacy, { type: 'swipe', direction: 'previous' }, false)).toBe(legacy)
  })

  test('v3: a forward swipe on the last story marks it viewed and closes the viewer, as JS `next`; legacy stays', () => {
    const first = act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 }, true)
    const second = act(first, { type: 'swipe', direction: 'next' }, true)
    expect(second).toMatchObject({ story: 1, closing: false })
    expect(second.left.map(({ story }) => story)).toEqual([0])
    expect(act(second, { type: 'swipe', direction: 'next', far: false }, true)).toBe(second)
    const closed = act(second, { type: 'swipe', direction: 'next', far: true }, true)
    expect(closed).toMatchObject({ open: true, closing: true })
    expect(closed.left.map(({ story }) => story)).toEqual([0, 1])
    const legacy = act(STORY_VIEWER_CLOSED, { type: 'open', index: 1 }, false)
    expect(act(legacy, { type: 'swipe', direction: 'next' }, false)).toBe(legacy)
  })

  test('legacy: the first slide of the first story starts again, without a view', () => {
    const opened = act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 }, false)
    const restarted = act(opened, { type: 'tap', zone: 'previous' }, false)
    expect(restarted).toMatchObject({ slide: 0, closing: false, entry: opened.entry, restart: opened.restart + 1 })
    expect(act(restarted, { type: 'tap', zone: 'previous' }, false).restart).toBe(opened.restart + 2)
  })
})

describe('Stories v3 — a vertical swipe closes the viewer, as JS (only by distance: longer than 100, up or down)', () => {
  const swipe = (dy, extra = {}) => storyGestureOutcome({ dx: 5, dy, x: 200, width: 400, ...extra })
  test('v3: up or down past 100 closes; up slides the viewer up; shorter does nothing', () => {
    expect(swipe(-101, { v3: true })).toEqual({ type: 'close', up: true })
    expect(swipe(101, { v3: true })).toEqual({ type: 'close' })
    expect(swipe(-99, { v3: true })).toBeNull()
    expect(swipe(99, { v3: true })).toBeNull()
    // Только по длине: быстрый короткий рывок не закрывает ни вниз, ни вверх.
    expect(swipe(60, { v3: true, vy: 1 })).toBeNull()
    expect(swipe(-60, { v3: true, vy: -1 })).toBeNull()
    expect(swipe(101, { v3: true, vy: 0 })).toEqual({ type: 'close' })
    // Открыта шторка — ничего; горизонтальный жест — соседняя сторис.
    expect(swipe(-150, { v3: true, sheetOpen: true })).toBeNull()
    expect(storyGestureOutcome({ dx: -150, dy: -120, x: 200, width: 400, v3: true })).toEqual({ type: 'swipe', direction: 'next', far: true })
  })

  test('v3: paging keeps 60 or a fling; only a swipe past 100 is `far` and may close at the ends', () => {
    const side = (dx, extra = {}) => storyGestureOutcome({ dx, dy: 5, x: 200, width: 400, v3: true, ...extra })
    expect(side(-101)).toEqual({ type: 'swipe', direction: 'next', far: true })
    expect(side(101)).toEqual({ type: 'swipe', direction: 'previous', far: true })
    expect(side(-70)).toEqual({ type: 'swipe', direction: 'next', far: false })
    expect(side(-20, { vx: -2 })).toEqual({ type: 'swipe', direction: 'next', far: false })
    expect(side(20, { vx: 2 })).toEqual({ type: 'swipe', direction: 'previous', far: false })
    expect(side(-50)).toBeNull()
    // Старая лента — как раньше: с 60 или рывком, без `far`.
    expect(storyGestureOutcome({ dx: -70, dy: 5, x: 200, width: 400 })).toEqual({ type: 'swipe', direction: 'next' })
    expect(storyGestureOutcome({ dx: -20, dy: 5, vx: -2, x: 200, width: 400 })).toEqual({ type: 'swipe', direction: 'next' })
  })

  test('legacy: only down, past 120 or with a fling', () => {
    expect(swipe(-150)).toBeNull()
    expect(swipe(110)).toBeNull()
    expect(swipe(121)).toEqual({ type: 'close' })
    expect(swipe(60, { vy: 1 })).toEqual({ type: 'close' })
    expect(STORY_V3_CLOSE_DISTANCE).toBe(100)
  })
})

describe('Stories v3 — slides the web SDK skips: passing and stepping over', () => {
  const img = (id) => ({ id, type: 'image', background: `https://x/${id}.jpg` })
  const skip = (id) => ({ id, type: '', background_color: '#000' })
  const act = (stories, state, action, positions = {}) =>
    storyViewerReducer(state, { stories, seen: {}, v3: true, positions, ...action })
  const open = (stories, index, extra = {}) => act(stories, STORY_VIEWER_CLOSED, { type: 'open', index, ...extra })
  const lefts = (state) => state.left.map(({ story, completed }) => ({ story, completed }))

  test('forward passes a skipped slide, its segment counts as passed; back steps over it without a new show', () => {
    const stories = [{ id: 1, slides: [img(11), skip(12), img(13)] }]
    const first = open(stories, 0)
    const third = act(stories, first, { type: 'next' })
    expect(third).toMatchObject({ slide: 2, entry: first.entry + 1 })
    const back = act(stories, third, { type: 'previous' })
    expect(back).toMatchObject({ slide: 0, entry: third.entry + 1, closing: false })
    expect(storyShownSlide(stories[0], 1, 1, true)).toBe(2)
    expect(storyShownSlide(stories[0], 1, -1, true)).toBe(0)
    expect(storyShownSlide(stories[0], 1, 1, false)).toBe(1)
  })

  test('back over leading skipped slides is back on the first slide: the previous story, or closing on the first', () => {
    const stories = [{ id: 1, slides: [img(11)] }, { id: 2, slides: [skip(21), img(22)] }]
    const second = open(stories, 1)
    expect(second).toMatchObject({ story: 1, slide: 1 })
    expect(act(stories, second, { type: 'previous' })).toMatchObject({ story: 0, slide: 0 })
    const alone = [{ id: 2, slides: [skip(21), img(22)] }]
    expect(act(alone, open(alone, 0), { type: 'previous' })).toMatchObject({ closing: true })
  })

  test('start_position on a skipped slide: the next shown one; none after it — the story is passed and viewed', () => {
    const stories = [
      { id: 1, start_position: 1, slides: [img(11), skip(12), img(13)] },
      { id: 2, start_position: 1, slides: [img(21), skip(22)] },
      { id: 3, slides: [img(31)] },
    ]
    expect(open(stories, 0)).toMatchObject({ story: 0, slide: 2 })
    const passed = open(stories, 1)
    expect(passed).toMatchObject({ open: true, story: 2, slide: 0, leave: 1 })
    expect(lefts(passed)).toEqual([{ story: 1, completed: true }])
  })

  test('a story of skipped slides only is passed and viewed; the last one closes the viewer without showing it', () => {
    const stories = [
      { id: 1, slides: [img(11)] },
      { id: 2, slides: [skip(21), skip(22)] },
      { id: 3, slides: [skip(31)] },
    ]
    const opened = open(stories, 0)
    const done = act(stories, opened, { type: 'ended' })
    expect(done).toMatchObject({ closing: true, leave: 3 })
    expect(lefts(done)).toEqual([
      { story: 0, completed: true },
      { story: 1, completed: true },
      { story: 2, completed: true },
    ])
    // Открыть такую сторис из ленты: просмотр закрывается сразу, не открываясь; сторис — просмотренная.
    const empty = open(stories, 1)
    expect(empty).toMatchObject({ open: false, closing: true, leave: 2 })
    expect(lefts(empty)).toEqual([
      { story: 1, completed: true },
      { story: 2, completed: true },
    ])
  })

  test('stepping back over a story with nothing to show marks it viewed; nothing before it — the viewer closes', () => {
    const stories = [{ id: 1, slides: [skip(11)] }, { id: 2, slides: [img(21)] }]
    const second = open(stories, 1)
    const tapped = act(stories, second, { type: 'previous' })
    expect(tapped).toMatchObject({ closing: true })
    expect(lefts(tapped)).toEqual([{ story: 0, completed: true }])
    const swiped = act(stories, second, { type: 'swipe', direction: 'previous', far: true })
    expect(swiped).toMatchObject({ closing: true })
    expect(act(stories, second, { type: 'swipe', direction: 'previous', far: false })).toBe(second)
    expect(lefts(swiped)).toEqual([{ story: 0, completed: true }])
  })

  test('a link to a story with nothing to show passes it: viewed, the next story opens, or nothing if it is the last', () => {
    const alone = [{ id: 40, slides: [skip(401), skip(402)] }]
    const closed = open(alone, 0, { slide: 1 })
    expect(closed).toMatchObject({ open: false, closing: true })
    expect(lefts(closed)).toEqual([{ story: 0, completed: true }])
    const more = [{ id: 40, slides: [skip(401)] }, { id: 41, slides: [img(411)] }]
    const next = open(more, 0, { slide: 0 })
    expect(next).toMatchObject({ open: true, story: 1, slide: 0 })
    expect(lefts(next)).toEqual([{ story: 0, completed: true }])
  })

  test('a link to a skipped slide starts at the next shown one; swipes and paging pass such stories too', () => {
    const stories = [
      { id: 1, slides: [img(11), skip(12), img(13)] },
      { id: 2, slides: [skip(21)] },
      { id: 3, slides: [img(31)] },
    ]
    expect(open(stories, 0, { slide: 1 })).toMatchObject({ story: 0, slide: 2 })
    const first = open(stories, 0)
    expect(act(stories, first, { type: 'swipe', direction: 'next' })).toMatchObject({ story: 2, slide: 0, leave: 2 })
    expect(act(stories, first, { type: 'page', index: 1 })).toMatchObject({ story: 2, slide: 0 })
    const last = open(stories, 2)
    // Назад через сторис без показанных слайдов — к той, что перед ней.
    expect(act(stories, last, { type: 'swipe', direction: 'previous' })).toMatchObject({ story: 0 })
  })
})

describe('Stories v3 — view on every show (F4)', () => {
  test('every show of a slide is an entry: forward, back and reopening', () => {
    const stories = [{ id: 1, slides: [{ id: 11, type: 'image' }, { id: 12, type: 'image' }] }]
    const act = (state, action) => storyViewerReducer(state, { stories, seen: {}, v3: true, positions: {}, ...action })
    const opened = act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 })
    const second = act(opened, { type: 'next' })
    const back = act(second, { type: 'previous' })
    expect([opened.entry, second.entry, back.entry]).toEqual([1, 2, 3])
    expect(act(act(back, { type: 'reset' }), { type: 'open', index: 0 }).entry).toBe(4)
  })
})

describe('Stories v3 — sound (R9)', () => {
  beforeEach(async () => {
    resetStorySoundMuted()
    await AsyncStorage.clearAll()
  })

  test('muted by default; the choice of a shop is kept on the device', async () => {
    expect(storySoundMuted('shop')).toBe(true)
    rememberStorySoundMuted(false, 'shop')
    expect(storySoundMuted('shop')).toBe(false)
    await Promise.resolve()
    expect(await AsyncStorage.getItem('@PersonaClick_shop_stories_mute')).toBe('false')
    // Новый запуск: выбор читается с устройства.
    resetStorySoundMuted()
    expect(storySoundMuted('shop')).toBe(true)
    await loadStorySoundMuted('shop')
    expect(storySoundMuted('shop')).toBe(false)
    expect(storySoundMuted('other')).toBe(true)
  })

  test('v3 keeps its own state apart from the legacy one; without a shop it stays in the process', async () => {
    rememberStorySoundMuted(false)
    expect(storySoundMuted()).toBe(false)
    expect(storySoundMuted('')).toBe(true)
    expect(storySoundMuted('shop')).toBe(true)
    rememberStorySoundMuted(false, '')
    expect(storySoundMuted('')).toBe(false)
    rememberStorySoundMuted(true)
    expect(storySoundMuted('')).toBe(false)
    await Promise.resolve()
    expect(await AsyncStorage.getAllKeys()).toEqual([])
  })

  test('the button: shown when the player lists an audio track or cannot tell, hidden only when it confirms none', () => {
    expect(storyVideoHasAudio([{ index: 0 }], 'ios')).toBe(true)
    expect(storyVideoHasAudio([{ index: 0 }], 'android')).toBe(true)
    // ExoPlayer перечисляет дорожки файла — пусто значит без звука; iOS строит список из группы
    // выбора аудио, у обычного MP4 её нет и со звуком — неизвестно.
    expect(storyVideoHasAudio([], 'android')).toBe(false)
    expect(storyVideoHasAudio([], 'ios')).toBeNull()
    expect(storyVideoHasAudio(undefined, 'android')).toBeNull()
    expect([true, null, false, undefined].map((audio) => storySoundButtonShown(audio, true))).toEqual([true, true, false, false])
    expect([true, null, false, undefined].map((audio) => storySoundButtonShown(audio, false))).toEqual([true, true, true, true])
  })

  test('a choice made while reading wins; the legacy sound stays in the process', async () => {
    await AsyncStorage.setItem('@PersonaClick_shop_stories_mute', 'false')
    const reading = loadStorySoundMuted('shop')
    rememberStorySoundMuted(true, 'shop')
    await reading
    expect(storySoundMuted('shop')).toBe(true)
    rememberStorySoundMuted(false)
    expect(storySoundMuted()).toBe(false)
    expect(await AsyncStorage.getItem('@PersonaClick_undefined_stories_mute')).toBeNull()
  })
})
