import { isSkippedSlide, slideDuration, slideNeedsMedia, storyStartIndex, storyStartSlide } from './storySupport'
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
  /** Открыто системное окно «Поделиться». */
  SHARE: 'share',
  /** Карточку опроса держат пальцем, в её поле фокус или ответ отправляется. */
  POLL: 'poll',
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
  /** Растёт на перезапуске слайда (B3): у сторис v3 это тоже показ — `view` (F4). */
  restart: 0,
  /**
   * Растёт, когда пользователь уходит из сторис вперёд (R8), — на каждую сторис. `left` — уходы по
   * порядку, `{ story, completed, seq }`: индекс сторис, досмотрена ли она (`completed`: кончился
   * последний показанный слайд или нажали «вперёд» на нём; сторис, где показать нечего, — тоже; свайп к
   * следующей — не досмотрена) и номер ухода (`leave` после него). За один шаг их может быть
   * несколько: сторис из одних пропущенных слайдов проходятся насквозь.
   */
  leave: 0,
  left: [],
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

/** Счётчики, которые переживают открытие и закрытие: эффекты просмотра следят за их ростом. */
const counters = (state) => ({ entry: state.entry, epoch: state.epoch, load: state.load, restart: state.restart, leave: state.leave })

/**
 * С какого слайда открыть сторис. Старая лента — A4 (`storyStartSlide` по виденным). Сторис v3 — как JS
 * SDK (R8): `start_position` ленты (продолжение считает сервер), а после показа в этом сеансе — слайд,
 * на котором из неё ушли (`positions`, `{ [storyId]: index }`; досмотренная — с начала).
 */
export function storyEntrySlide(story, { v3 = false, positions = null, seen = null } = {}) {
  if (!v3) return storyStartSlide(story, seenOf(seen, story))
  const count = slidesOf(story).length
  const position = positions && story ? positions[String(story.id)] : undefined
  if (Number.isInteger(position) && position >= 0 && position < count) return position
  return storyStartIndex(story)
}

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
function startSlide(state, stories, storyIndex, slideIndex, { canPlayVideo = true, v3 = false } = {}) {
  const slide = slidesOf(stories[storyIndex])[slideIndex]
  const loading = slideNeedsMedia(slide, canPlayVideo, v3)
  let pauses = withPause(state.pauses, STORY_PAUSE.SHEET, false)
  pauses = withPause(pauses, STORY_PAUSE.ERROR, false)
  pauses = withPause(pauses, STORY_PAUSE.LOADING, loading)
  // Карточки опросов прежнего слайда ушли вместе с ним — их пауза не должна залипнуть.
  pauses = withPause(pauses, STORY_PAUSE.POLL, false)
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
  return {
    ...state,
    epoch: state.epoch + 1,
    restart: state.restart + 1,
    sheetOpen: false,
    pauses: withPause(state.pauses, STORY_PAUSE.SHEET, false),
  }
}

/** Сколько последних уходов из сторис держит `left` (их забирает просмотр после каждого шага). */
const LEFT_KEPT = 64

/** Ушли из сторис `index` вперёд (R8): досмотрев её, пройдя насквозь или свайпом к следующей. */
const leaving = (state, index, completed) => {
  const leave = state.leave + 1
  return { ...state, leave, left: [...(state.left || []), { story: index, completed, seq: leave }].slice(-LEFT_KEPT) }
}

/**
 * Номер слайда, который показывается, от `from` с шагом `step` (1 — вперёд, −1 — назад), или −1.
 * Пропущенные слайды сторис v3 (`isSkippedSlide`, как в JS SDK) не показываются: вперёд их проходят,
 * назад через них переступают (в JS SDK шаг назад на такой слайд отскакивает вперёд и снова шлёт
 * `view` — здесь нет).
 */
export function storyShownSlide(story, from, step, v3 = false) {
  const slides = slidesOf(story)
  for (let index = from; index >= 0 && index < slides.length; index += step) {
    if (!isSkippedSlide(slides[index], v3)) return index
  }
  return -1
}

const close = (state) => (state.closing ? state : { ...state, closing: true })

/**
 * Вход в сторис с `index` в сторону `direction` (1 — вперёд, −1 — назад): `{ state, entered }`.
 * Сторис без слайдов пропускаются (C16). Сторис открывается на стартовом слайде (A4, R8), а если он
 * пропущенный (сторис v3) — на следующем показанном; назад, если после него показать нечего, — на
 * ближайшем показанном перед ним. Показать в сторис нечего — она пройдена насквозь, как в JS SDK:
 * досмотрена (`leaving`), и вход идёт дальше в ту же сторону. Дальше сторис нет — `entered: false` и
 * состояние с отметками пройденных.
 */
function enterFrom(state, action, index, direction) {
  const stories = action.stories || []
  let current = state
  for (let target = index; target >= 0 && target < stories.length; target += direction) {
    const story = stories[target]
    if (slidesOf(story).length === 0) continue
    const entry = storyEntrySlide(story, action)
    let slide = storyShownSlide(story, entry, 1, action.v3)
    if (slide < 0 && direction < 0) slide = storyShownSlide(story, entry - 1, -1, action.v3)
    if (slide >= 0) return { state: startSlide(current, stories, target, slide, action), entered: true }
    current = leaving(current, target, true)
  }
  return { state: current, entered: false }
}

/**
 * Вход в сторис `index` (A4): см. `enterFrom`. Вперёд и дальше нечего показать — просмотр
 * закрывается; назад — остаётся, где был (с отметками пройденных сторис).
 */
function enterStory(state, action, index, direction) {
  const result = enterFrom(state, action, index, direction)
  if (result.entered) return result.state
  return direction > 0 ? close(result.state) : result.state
}

/**
 * Вход в сторис `index` сразу на слайде `slide` (открытие по ссылке «Поделиться»: слайд из
 * ответа, в обход A4); номер зажимается в границы, пропущенный слайд — следующий показанный, а нет
 * его — сторис пройдена, как при обычном входе. В сторис нет слайдов — обычный вход.
 */
function enterStoryAt(state, action, index, slide) {
  const stories = action.stories || []
  const count = slidesOf(stories[index]).length
  if (count === 0) return enterStory(state, action, index, 1)
  const shown = storyShownSlide(stories[index], Math.min(count - 1, slide), 1, action.v3)
  if (shown >= 0) return startSlide(state, stories, index, shown, action)
  return enterStory(leaving(state, index, true), action, index + 1, 1)
}

function next(state, action) {
  const stories = action.stories || []
  const target = storyShownSlide(stories[state.story], state.slide + 1, 1, action.v3)
  if (target >= 0) return startSlide(state, stories, state.story, target, action)
  return enterStory(leaving(state, state.story, true), action, state.story + 1, 1)
}

/**
 * Назад: предыдущий показанный слайд (пропущенные — переступая); на первом показанном — предыдущая
 * сторис. Её нет: у сторис v3 просмотр закрывается, как в JS SDK (`prev` на первой сторис); у старой
 * ленты слайд начинается заново — прогресс и видео с нуля (B3, F3).
 */
function previous(state, action) {
  const stories = action.stories || []
  const target = storyShownSlide(stories[state.story], state.slide - 1, -1, action.v3)
  if (target >= 0) return startSlide(state, stories, state.story, target, action)
  const moved = enterFrom(state, action, state.story - 1, -1)
  if (moved.entered) return moved.state
  return action.v3 ? close(moved.state) : restartSlide(moved.state)
}

/**
 * Редьюсер просмотра. Действия, которым нужны данные, несут их сами: `stories` (как у
 * StoryViewer), `seen` (`{ [storyId]: slideId[] }` — для A4), `canPlayVideo` (есть ли плеер), `v3`
 * (сторис из ленты API v3: медиа по `type`, старт по R8) и `positions` (R8, `storyEntrySlide`).
 *
 * - `open` `{ index, slide? }` — открыть с сторис `index` (её стартовый слайд по A4; `slide` —
 *   сразу этот слайд, в обход A4);
 * - `page` `{ index }` — открыть сторис `index` в уже открытом просмотре (F11): листание к ней с её
 *   стартового слайда; она уже на экране, её нет или в ней нет слайдов — ничего;
 * - `reset` — просмотр закрыт хостом;
 * - `tap` `{ zone: 'previous'|'center'|'next' }` — касание (B1); при открытой шторке только
 *   закрывает её (B5);
 * - `swipe` `{ direction: 'next'|'previous', far? }` — соседняя сторис (B4); при открытой шторке ничего;
 *   у краёв ленты ничего (у сторис v3 закрыть, как JS SDK: назад с первой сторис, вперёд с последней —
 *   она отмечается просмотренной);
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
      const base = { ...STORY_VIEWER_CLOSED, ...counters(state) }
      const index = Math.max(0, Math.floor(Number(action.index) || 0))
      const slide = Number(action.slide)
      const opened =
        action.slide !== undefined && action.slide !== null && Number.isInteger(slide) && slide >= 0
          ? enterStoryAt(base, action, index, slide)
          : enterStory(base, action, index, 1)
      // Показать нечего (в том числе сторис из одних пропущенных слайдов в конце ленты) — просмотр
      // сразу закрывается и не показывается вовсе; пройденные сторис остаются отмечены.
      return opened.open ? opened : { ...opened, open: false, closing: true }
    }
    case 'reset':
      return { ...STORY_VIEWER_CLOSED, ...counters(state) }
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
        // Сторис v3, как JS SDK (`next`: просмотрена, на последней — `close()`): с последней сторис
        // свайп вперёд отмечает её и закрывает просмотр — только длинный (`far`). Старая лента у края
        // ничего не делает.
        if (!action.v3 && state.story + 1 >= (action.stories || []).length) return state
        const moved = enterFrom(leaving(state, state.story, false), action, state.story + 1, 1)
        if (moved.entered) return moved.state
        return action.v3 && action.far ? close(moved.state) : state
      }
      if (action.direction === 'previous') {
        // Сторис v3, как JS SDK (`i <= 0` → `close()`): назад с первой сторис — закрыть просмотр, и когда
        // перед текущей показать нечего (сторис без показанных слайдов пройдены и отмечены), — только
        // длинный свайп (`far`). Старая лента у края ничего не делает.
        const moved = enterFrom(state, action, state.story - 1, -1)
        if (moved.entered) return moved.state
        return action.v3 && action.far ? close(moved.state) : state
      }
      return state
    case 'page': {
      const stories = action.stories || []
      const index = Math.floor(Number(action.index))
      if (!(index >= 0 && index < stories.length) || index === state.story) return state
      if (slidesOf(stories[index]).length === 0) return state
      // Как открытие из ленты: сторис, где показать нечего, проходится вперёд (JS SDK, `showStory`).
      return enterStory(state, action, index, 1)
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
      // Слайд монтируется заново — и карточки опросов на нём тоже.
      pauses = withPause(pauses, STORY_PAUSE.POLL, false)
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
/** У сторис v3 вертикальный свайп вверх или вниз длиннее этого закрывает просмотр (JS SDK, `swipeLength`). */
export const STORY_V3_CLOSE_DISTANCE = 100
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
 *   шторкой — ничего. У сторис v3, как JS SDK, только по длине: вверх или вниз дальше
 *   STORY_V3_CLOSE_DISTANCE — закрыть (вверх — `{ type: 'close', up: true }`, слайд уезжает вверх);
 *   быстрый короткий рывок не закрывает.
 * - Вбок — соседняя сторис (B4), в RTL зеркально; с открытой шторкой — ничего. У сторис v3 ещё `far`:
 *   свайп длиннее STORY_V3_CLOSE_DISTANCE — только такой закрывает просмотр у краёв ленты (как JS SDK).
 *
 * @param {{ dx: number, dy: number, vx?: number, vy?: number, x: number, width: number,
 *           held?: boolean, rtl?: boolean, sheetOpen?: boolean, v3?: boolean }} gesture
 */
export function storyGestureOutcome({ dx, dy, vx = 0, vy = 0, x, width, held = false, rtl = false, sheetOpen = false, v3 = false }) {
  if (held) return null
  if (Math.abs(dx) <= STORY_TAP_SLOP && Math.abs(dy) <= STORY_TAP_SLOP) {
    return { type: 'tap', zone: storyTapZone(x, width, rtl) }
  }
  if (sheetOpen) return null
  if (Math.abs(dy) > Math.abs(dx)) {
    if (v3) {
      // Только по длине, как JS SDK: быстрый короткий рывок не закрывает.
      if (dy < -STORY_V3_CLOSE_DISTANCE) return { type: 'close', up: true }
      return dy > STORY_V3_CLOSE_DISTANCE ? { type: 'close' } : null
    }
    return dy > 0 && (dy > STORY_CLOSE_DISTANCE || vy > STORY_CLOSE_VELOCITY) ? { type: 'close' } : null
  }
  const forward = dx < -STORY_SWIPE_DISTANCE || vx < -STORY_SWIPE_VELOCITY
  const backward = dx > STORY_SWIPE_DISTANCE || vx > STORY_SWIPE_VELOCITY
  if (!forward && !backward) return null
  const toNext = forward !== rtl
  const swipe = { type: 'swipe', direction: toNext ? 'next' : 'previous' }
  // Сторис v3: закрыть свайпом у краёв ленты можно только по длине, как JS SDK (`swipeLength`), —
  // `far`; к соседней сторис листает и короткий рывок, как пейджер платформ.
  if (v3) swipe.far = Math.abs(dx) > STORY_V3_CLOSE_DISTANCE
  return swipe
}
