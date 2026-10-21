import { slideDuration, slideNeedsMedia, storyStartSlide } from './storySupport'
import { animatedSlideDurationMs } from './storyGif'

/**
 * Логика полноэкранного просмотра сторис без React и без вьюх (E1): где мы (сторис и слайд), с
 * какого слайда открыть сторис, почему слайд стоит, открыта ли шторка товаров, во что выливается
 * жест. StoryViewer только рисует и передаёт сюда события — касания, конец времени, готовность
 * медиа, уход в фон — через `storyViewerReducer`.
 *
 * Номера правил (A1…C16) — общие правила сторис V2 для всех четырёх SDK.
 */

/** Почему слайд стоит. Часы идут, только когда причин нет. */
export const STORY_PAUSE = Object.freeze({
  /** Палец держит слайд (B2). */
  HOLD: 'hold',
  /** Слайд тянут — вниз, чтобы закрыть, или вбок, к соседней сторис (B4). */
  DRAG: 'drag',
  /** Открыта шторка товаров (B5). */
  SHEET: 'sheet',
  /** Приложение в фоне, окно без фокуса, экран погас (B6). */
  BACKGROUND: 'background',
  /** Пауза хоста — `pause()` виджета (B8). */
  HOST: 'host',
  /** Медиа ещё не готово или видео подгружается (C4, C5). */
  LOADING: 'loading',
  /** Медиа не загрузилось — на слайде кнопка «Повторить» (C5). */
  ERROR: 'error',
})

/** Состояние закрытого просмотра. */
export const STORY_VIEWER_CLOSED = Object.freeze({
  open: false,
  /** Просмотр сам решил закрыться (крестик, свайп вниз, конец последней сторис) — ждёт хоста. */
  closing: false,
  story: 0,
  slide: 0,
  /** Растёт, когда слайд становится текущим (A1: показ, трекинг `view`), — не на перезапуске. */
  entry: 0,
  /** Растёт на каждом старте слайда, и на перезапуске (B3), и на «Повторить» (C5): часы с нуля. */
  epoch: 0,
  /**
   * Растёт, когда медиа монтируется заново: новый слайд и «Повторить» (C5) — ключ медиа.
   * Перезапуск (B3, F3) его не трогает: медиа то же, видео перематывается к нулю.
   */
  load: 0,
  sheetOpen: false,
  /** Причины паузы, без повторов, по алфавиту. */
  pauses: [],
  /** Медиа слайда: `loading` | `ready` | `error`. */
  media: 'ready',
  /** Откуда идёт время: `timer` — из админки (A7), `player` — позиция видео известной длины (C4). */
  clock: 'timer',
  /** Длина текущего слайда, мс. */
  durationMs: 0,
})

const withPause = (pauses, reason, on) => {
  const has = pauses.includes(reason)
  if (on === has) return pauses
  return on ? [...pauses, reason].sort() : pauses.filter((item) => item !== reason)
}

const slidesOf = (story) => (Array.isArray(story?.slides) ? story.slides : [])
const seenOf = (seen, story) => (seen && story ? seen[String(story.id)] : undefined) || []

/**
 * Новый текущий слайд (A1): шторка закрыта, время с нуля, медиа грузится заново, `entry` растёт.
 */
function startSlide(state, stories, storyIndex, slideIndex, { canPlayVideo = true } = {}) {
  const slide = slidesOf(stories[storyIndex])[slideIndex]
  const loading = slideNeedsMedia(slide, canPlayVideo)
  let pauses = withPause(state.pauses, STORY_PAUSE.SHEET, false)
  pauses = withPause(pauses, STORY_PAUSE.ERROR, false)
  pauses = withPause(pauses, STORY_PAUSE.LOADING, loading)
  return {
    ...state,
    open: true,
    closing: false,
    story: storyIndex,
    slide: slideIndex,
    entry: state.entry + 1,
    epoch: state.epoch + 1,
    load: state.load + 1,
    sheetOpen: false,
    pauses,
    media: loading ? 'loading' : 'ready',
    clock: 'timer',
    durationMs: slideDuration(slide) * 1000,
  }
}

/**
 * Перезапуск текущего слайда (B3, F3): время с нуля, видео — к нулю. Слайд не становится текущим
 * заново (ни `view`, ни отметки), медиа не перезагружается: его готовность и длина остаются.
 */
function restartSlide(state) {
  return { ...state, epoch: state.epoch + 1, sheetOpen: false, pauses: withPause(state.pauses, STORY_PAUSE.SHEET, false) }
}

const close = (state) => (state.closing ? state : { ...state, closing: true })

/**
 * Вход в сторис `index` с её стартового слайда (A4). Сторис без слайдов пропускаются в сторону
 * движения (C16): вперёд — дальше, пока есть, иначе просмотр закрывается; назад — к предыдущим,
 * а если их нет — ничего не происходит.
 */
function enterStory(state, action, index, direction) {
  const stories = action.stories || []
  let target = index
  while (target >= 0 && target < stories.length && slidesOf(stories[target]).length === 0) target += direction
  if (target < 0) return state
  if (target >= stories.length) return direction > 0 ? close(state) : state
  const story = stories[target]
  return startSlide(state, stories, target, storyStartSlide(story, seenOf(action.seen, story)), action)
}

function next(state, action) {
  const stories = action.stories || []
  const count = slidesOf(stories[state.story]).length
  if (state.slide + 1 < count) return startSlide(state, stories, state.story, state.slide + 1, action)
  return enterStory(state, action, state.story + 1, 1)
}

function previous(state, action) {
  const stories = action.stories || []
  if (state.slide > 0) return startSlide(state, stories, state.story, state.slide - 1, action)
  const moved = enterStory(state, action, state.story - 1, -1)
  if (moved !== state) return moved
  // Первый слайд первой сторис начинается заново — прогресс и видео с нуля (B3, F3).
  return restartSlide(state)
}

/**
 * Редьюсер просмотра. Действия, которым нужны данные, несут их сами: `stories` (как у
 * StoryViewer), `seen` (`{ [storyId]: slideId[] }` — для A4) и `canPlayVideo` (есть ли плеер).
 *
 * - `open` `{ index }` — открыть с сторис `index` (её стартовый слайд по A4);
 * - `page` `{ index }` — открыть сторис `index` в уже открытом просмотре (F11): листание к ней с её
 *   стартового слайда; она уже на экране, её нет или в ней нет слайдов — ничего;
 * - `reset` — просмотр закрыт хостом;
 * - `tap` `{ zone: 'previous'|'center'|'next' }` — касание (B1); при открытой шторке только
 *   закрывает её (B5);
 * - `swipe` `{ direction: 'next'|'previous' }` — соседняя сторис (B4); при открытой шторке ничего;
 *   у краёв ленты ничего;
 * - `next` / `previous` — следующий / предыдущий слайд (время вышло — `ended`);
 * - `ended` — время слайда вышло или видео доиграло (C4);
 * - `back` — системная «назад»: сначала шторка, потом просмотр (B5);
 * - `close` — крестик или свайп вниз;
 * - `sheet` `{ open }`; `pause` / `resume` `{ reason }`;
 * - `mediaReady` `{ durationMs? }` — медиа готово; длина видео, если известна (C4, C5);
 * - `animationLoop` `{ loopMs }` — проход GIF фона: слайд идёт по большему из него и админки (G2);
 * - `buffering` `{ active }`; `mediaFailed`; `retry` (C5).
 */
export function storyViewerReducer(state, action) {
  switch (action.type) {
    case 'open': {
      const base = { ...STORY_VIEWER_CLOSED, entry: state.entry, epoch: state.epoch, load: state.load }
      const opened = enterStory(base, action, Math.max(0, Math.floor(Number(action.index) || 0)), 1)
      return opened.open ? opened : { ...base, closing: true }
    }
    case 'reset':
      return { ...STORY_VIEWER_CLOSED, entry: state.entry, epoch: state.epoch, load: state.load }
    default:
      break
  }
  if (!state.open || state.closing) return state

  switch (action.type) {
    case 'tap':
      if (state.sheetOpen) return storyViewerReducer(state, { type: 'sheet', open: false })
      if (action.zone === 'previous') return previous(state, action)
      if (action.zone === 'next') return next(state, action)
      return state
    case 'swipe':
      if (state.sheetOpen) return state
      if (action.direction === 'next') {
        if (state.story + 1 >= (action.stories || []).length) return state
        return enterStory(state, action, state.story + 1, 1)
      }
      if (action.direction === 'previous') return state.story > 0 ? enterStory(state, action, state.story - 1, -1) : state
      return state
    case 'page': {
      const stories = action.stories || []
      const index = Math.floor(Number(action.index))
      if (!(index >= 0 && index < stories.length) || index === state.story) return state
      if (slidesOf(stories[index]).length === 0) return state
      return enterStory(state, action, index, index > state.story ? 1 : -1)
    }
    case 'next':
    case 'ended':
      return next(state, action)
    case 'previous':
      return previous(state, action)
    case 'back':
      if (state.sheetOpen) return storyViewerReducer(state, { type: 'sheet', open: false })
      return close(state)
    case 'close':
      return close(state)
    case 'sheet': {
      const open = !!action.open
      if (open === state.sheetOpen) return state
      return { ...state, sheetOpen: open, pauses: withPause(state.pauses, STORY_PAUSE.SHEET, open) }
    }
    case 'pause':
    case 'resume': {
      const pauses = withPause(state.pauses, action.reason, action.type === 'pause')
      return pauses === state.pauses ? state : { ...state, pauses }
    }
    case 'mediaReady': {
      const durationMs = Number(action.durationMs)
      const player = Number.isFinite(durationMs) && durationMs > 0
      if (state.media === 'ready' && (!player || state.clock === 'player')) return state
      let pauses = withPause(state.pauses, STORY_PAUSE.LOADING, false)
      pauses = withPause(pauses, STORY_PAUSE.ERROR, false)
      return {
        ...state,
        media: 'ready',
        pauses,
        clock: player ? 'player' : state.clock,
        durationMs: player ? durationMs : state.durationMs,
      }
    }
    case 'animationLoop': {
      if (state.clock === 'player') return state
      const slide = slidesOf((action.stories || [])[state.story])[state.slide]
      const durationMs = animatedSlideDurationMs(slideDuration(slide) * 1000, action.loopMs)
      return durationMs === state.durationMs ? state : { ...state, durationMs }
    }
    case 'buffering':
      if (state.media !== 'ready') return state
      return { ...state, pauses: withPause(state.pauses, STORY_PAUSE.LOADING, !!action.active) }
    case 'mediaFailed': {
      if (state.media === 'error') return state
      let pauses = withPause(state.pauses, STORY_PAUSE.LOADING, false)
      pauses = withPause(pauses, STORY_PAUSE.ERROR, true)
      return { ...state, media: 'error', pauses }
    }
    case 'retry': {
      if (state.media !== 'error') return state
      let pauses = withPause(state.pauses, STORY_PAUSE.ERROR, false)
      pauses = withPause(pauses, STORY_PAUSE.LOADING, true)
      return { ...state, media: 'loading', pauses, epoch: state.epoch + 1, load: state.load + 1 }
    }
    default:
      return state
  }
}

/** Часы слайда идут: просмотр открыт и причин паузы нет. */
export function isStoryClockRunning(state) {
  return state.open && !state.closing && state.pauses.length === 0
}

/**
 * Видео должно играть: стоит только из-за подгрузки (иначе оно не догрузится) — играет; любая
 * другая причина его останавливает.
 */
export function storyPlayerShouldPlay(state) {
  return state.open && !state.closing && state.pauses.every((reason) => reason === STORY_PAUSE.LOADING)
}

/** Самый длинный шаг часов за кадр, мс: после фона или подвисания время не прыгает вперёд (B6). */
export const STORY_CLOCK_MAX_STEP = 100

/**
 * Шаг часов между кадрами, мс: разница отметок, но не больше STORY_CLOCK_MAX_STEP и не меньше
 * нуля. Часы считают реальное время по кадрам, а не системную анимацию, поэтому от масштаба
 * анимаций (B7) не зависят.
 */
export function storyClockStep(lastMs, nowMs) {
  if (!Number.isFinite(lastMs) || !Number.isFinite(nowMs)) return 0
  return Math.max(0, Math.min(STORY_CLOCK_MAX_STEP, nowMs - lastMs))
}

/** Срок готовности медиа (C5), мс: не готово — ошибка и «Повторить». */
export const STORY_MEDIA_TIMEOUT = 10000
/** Видео, которое не загрузилось, повторяет само через это время (C5), мс. */
export const STORY_VIDEO_RETRY_DELAY = 15000

/**
 * Отсчёт, который встаёт на паузу и продолжает с остатка (F5): в фоне срок готовности медиа и
 * автоповтор видео не идут, а по возвращении не начинаются заново. Создаётся стоящим — пускает
 * его `resume()`. Срабатывает один раз; `cancel()` гасит его насовсем.
 *
 * @param {number} delayMs
 * @param {() => void} onDone
 * @param {{ now?: () => number, setTimeout?: Function, clearTimeout?: Function }} [timers]
 * @returns {{ resume(): void, pause(): void, cancel(): void, remaining(): number }}
 */
export function storyCountdown(delayMs, onDone, timers = {}) {
  const now = timers.now || Date.now
  const schedule = timers.setTimeout || setTimeout
  const unschedule = timers.clearTimeout || clearTimeout
  let left = Math.max(0, Number(delayMs) || 0)
  let timer = null
  let startedAt = 0
  let finished = false
  const elapsed = () => Math.max(0, now() - startedAt)
  return {
    resume() {
      if (finished || timer !== null) return
      startedAt = now()
      timer = schedule(() => {
        timer = null
        finished = true
        onDone()
      }, left)
    },
    pause() {
      if (timer === null) return
      unschedule(timer)
      timer = null
      left = Math.max(0, left - elapsed())
    },
    cancel() {
      if (timer !== null) unschedule(timer)
      timer = null
      finished = true
    },
    remaining() {
      return timer === null ? left : Math.max(0, left - elapsed())
    },
  }
}

/** Насколько вперёд от последнего отчёта плеера прогресс может дорисовать сам, мс. */
export const STORY_PLAYER_LEAD = 250

/**
 * Позиция видео для полоски прогресса (C4), мс: последний отчёт плеера плюс время с него, пока
 * часы идут (не больше STORY_PLAYER_LEAD — на подгрузке полоска встаёт), в пределах длины.
 */
export function storyPlayerPosition(report, nowMs, durationMs, running) {
  if (!report) return 0
  const lead = running ? Math.max(0, Math.min(STORY_PLAYER_LEAD, nowMs - report.at)) : 0
  return Math.max(0, Math.min(durationMs, report.positionMs + lead))
}

/** Долгое нажатие (B2), мс. */
export const STORY_HOLD_DELAY = 200
/** Сдвиг пальца, после которого касание — уже жест, а не тап. */
export const STORY_TAP_SLOP = 10
/** Свайп вниз закрывает с этого сдвига (B4)… */
export const STORY_CLOSE_DISTANCE = 120
/** …или с этой скорости, точек в мс (800 в секунду). */
export const STORY_CLOSE_VELOCITY = 0.8
/** Горизонтальный свайп переключает сторис с этого сдвига… */
export const STORY_SWIPE_DISTANCE = 60
/** …или с этой скорости, точек в мс. */
export const STORY_SWIPE_VELOCITY = 0.8

/**
 * Зона касания по трети ширины (B1): левая — назад, правая — вперёд, середина — ничего. В RTL
 * края меняются местами.
 *
 * @returns {'previous'|'center'|'next'}
 */
export function storyTapZone(x, width, rtl = false) {
  if (!(width > 0)) return 'center'
  const third = width / 3
  if (x < third) return rtl ? 'next' : 'previous'
  if (x > width - third) return rtl ? 'previous' : 'next'
  return 'center'
}

/**
 * Перетаскивание началось: какое. `vertical` — вниз, слайд едет за пальцем (B4); `horizontal` —
 * вбок; `null` — ещё касание. При открытой шторке слайд за пальцем не едет (B5).
 */
export function storyDragKind({ dx, dy }, sheetOpen = false) {
  if (Math.abs(dx) <= STORY_TAP_SLOP && Math.abs(dy) <= STORY_TAP_SLOP) return null
  if (Math.abs(dy) > Math.abs(dx)) return dy > 0 && !sheetOpen ? 'vertical' : 'horizontal'
  return 'horizontal'
}

/**
 * Во что вылилось касание, когда палец отпустили. Возвращает действие для storyViewerReducer или
 * `null` — ничего (слайд при этом всегда возвращается на место, а пауза от удержания и
 * перетаскивания снимается).
 *
 * - Удержание (B2) никогда не листает.
 * - Тап — зона по трети ширины (B1), с открытой шторкой — её закрытие (B5).
 * - Вниз дальше STORY_CLOSE_DISTANCE или быстрее STORY_CLOSE_VELOCITY — закрыть (B4); с открытой
 *   шторкой — ничего.
 * - Вбок — соседняя сторис (B4), в RTL зеркально; с открытой шторкой — ничего.
 *
 * @param {{ dx: number, dy: number, vx?: number, vy?: number, x: number, width: number,
 *           held?: boolean, rtl?: boolean, sheetOpen?: boolean }} gesture
 */
export function storyGestureOutcome({ dx, dy, vx = 0, vy = 0, x, width, held = false, rtl = false, sheetOpen = false }) {
  if (held) return null
  if (Math.abs(dx) <= STORY_TAP_SLOP && Math.abs(dy) <= STORY_TAP_SLOP) {
    return { type: 'tap', zone: storyTapZone(x, width, rtl) }
  }
  if (sheetOpen) return null
  if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0 && (dy > STORY_CLOSE_DISTANCE || vy > STORY_CLOSE_VELOCITY) ? { type: 'close' } : null
  }
  const forward = dx < -STORY_SWIPE_DISTANCE || vx < -STORY_SWIPE_VELOCITY
  const backward = dx > STORY_SWIPE_DISTANCE || vx > STORY_SWIPE_VELOCITY
  if (!forward && !backward) return null
  const toNext = forward !== rtl
  return { type: 'swipe', direction: toNext ? 'next' : 'previous' }
}
