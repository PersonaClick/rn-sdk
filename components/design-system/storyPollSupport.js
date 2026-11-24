import AsyncStorage from '@react-native-async-storage/async-storage'
import { getStorageKey } from '../../utils'
import { slidePollElements, storyColorScheme, toDecimal } from './storySupport'

/**
 * Опросы на слайдах сторис V2 (элемент `poll`, только API v3): мини-опросы `single_choice`,
 * `multiple_choice`, `text` и шкалы NPS / CSAT / CES. Чистая логика без React — разбор элемента,
 * шкала, тексты, сохранённые ответы и контроллер карточки (поведение `createPoll` JS SDK). Рисует
 * карточку StoryPoll; в сеть ходит транспорт опросов, который просмотру передаёт виджет.
 *
 * Разбор терпимый: числа строками (`"40"`, `"120"`), `null` в необязательных полях; `code` не
 * обязателен (нет — пустая строка, как в JS: опрос рисуется, ответит сервер). Неизвестный вид или
 * битый элемент — `null` (опрос не рисуется, слайд показывается как обычно).
 */

/**
 * Встроенные тексты карточки — три английские константы JS SDK (`DEFAULT_POLL_TEXTS`), какой бы ни был
 * язык устройства или приложения. Тексты хоста и `labels` элемента (непустые строки) их перекрывают; у
 * кнопки отправки выбора и текста сперва `submit_label` опроса.
 */
export const STORY_POLL_DEFAULT_TEXTS = Object.freeze({
  reanswer: 'Answer again',
  error: 'Failed to send the answer. Please try again',
  submit: 'Send',
})

/** Значения шкал по умолчанию: NPS 0..10, CSAT 1..5, CES 1..7. */
export const STORY_POLL_SCALE_RANGES = Object.freeze({ nps: [0, 10], csat: [1, 5], ces: [1, 7] })

/** Больше значений шкала не рисует. */
export const STORY_POLL_SCALE_LIMIT = 21

/** Длина комментария к вопросу полосы шкалы (`render-scale.ts` JS SDK). */
export const STORY_POLL_COMMENT_LIMIT = 5000

/** Сколько живёт сохранённый ответ: столько лента помнит ответ (`STORIES_ANSWER_MEMORY_DAYS`), мс. */
export const STORY_POLL_ANSWER_TTL_MS = 90 * 24 * 60 * 60 * 1000

/** Зазор между карточкой и низом слайда (`POLL_FIT_MARGIN` JS SDK). */
export const STORY_POLL_FIT_MARGIN = 16

const MINI_KINDS = ['single_choice', 'multiple_choice', 'text']
const TEXT_KEYS = ['reanswer', 'error', 'submit']

/** NPS, CSAT или CES. */
export const isStoryPollScale = (type) => type === 'nps' || type === 'csat' || type === 'ces'

/** Debug-лог опросов (только в сборке разработки). */
export function storyPollDebug(message) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.log(`[Stories polls] ${message}`)
}

const str = (value) => (typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : null)
// Непустая строка, как истинность строки в JS SDK: пробелы — тоже текст.
const filled = (value) => typeof value === 'string' && value.length > 0
// Истина — только `true`, `1` или `"true"`.
const flag = (value) => value === true || value === 1 || value === 'true'
const integer = (value) => {
  const n = typeof value === 'number' || (typeof value === 'string' && /^\s*-?\d+(\.0+)?\s*$/.test(value)) ? toDecimal(value) : null
  return n !== null && Number.isInteger(n) ? n : null
}
const list = (value) => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [])

/**
 * Ответ из ленты или сервера: `{ id?, option_ids, text, rate, comment }` или `null`. Поля — как их
 * понимает `hasAnswer` JS SDK, чтобы «отвечен» значило одно и то же: `option_ids` — массив как есть
 * (целые строкой становятся числами, прочие значения остаются — вариант они не выделят, но ответ
 * есть), `text` — только строка, `rate` — только число (строка `"9"` — не оценка).
 */
export function parseStoryPollAnswer(value) {
  if (!value || typeof value !== 'object') return null
  const ids = Array.isArray(value.option_ids)
    ? value.option_ids.map((id) => {
        const n = integer(id)
        return n !== null ? n : id
      })
    : null
  // Отвечен любым числом `rate`, как в JS SDK (выделится только совпавшая ячейка шкалы).
  const answer = {
    option_ids: ids && ids.length ? ids : null,
    text: typeof value.text === 'string' ? value.text : null,
    rate: typeof value.rate === 'number' && Number.isFinite(value.rate) ? value.rate : null,
    comment: typeof value.comment === 'string' ? value.comment : null,
  }
  const id = integer(value.id)
  if (id !== null) answer.id = id
  return answer
}

/** Результаты выбора: `{ total, options: [{ id, percent }] }` или `null`. */
export function parseStoryPollResults(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.options)) return null
  const options = list(value.options)
    .map((item) => ({ id: integer(item.id), percent: toDecimal(item.percent) ?? 0 }))
    .filter((item) => item.id !== null)
  return { total: toDecimal(value.total) ?? 0, options }
}

/**
 * Элемент `poll` → модель карточки или `null` (неизвестный вид, битые данные).
 * `kind` — `single_choice` | `multiple_choice` | `text` | `scale`; `type` — `poll_type`. Сам элемент
 * ленты — в неперечисляемом `element`: после ответа карточка пишет ответ в него, как JS SDK в
 * закэшированную ленту, и слайд, показанный снова, рисует опрос уже отвеченным.
 */
export function parseStoryPoll(element) {
  try {
    if (!element || typeof element !== 'object' || element.type !== 'poll') return null
    const type = element.poll_type
    const raw = element.poll && typeof element.poll === 'object' ? element.poll : null
    let kind = null
    if (raw && isStoryPollScale(type)) kind = 'scale'
    else if (raw && type === 'mini_poll' && MINI_KINDS.includes(raw.kind)) kind = raw.kind
    if (!kind) {
      storyPollDebug(`skipped poll ${String(type)}/${String(raw && raw.kind)}`)
      return null
    }
    const y = toDecimal(element.y_offset)
    const max = toDecimal(raw.max_length)
    const labels = {}
    if (element.labels && typeof element.labels === 'object') {
      TEXT_KEYS.forEach((key) => {
        if (filled(element.labels[key])) labels[key] = element.labels[key]
      })
    }
    const poll = {
      type,
      kind,
      code: str(raw.code) ?? '',
      // Нет `y_offset` — от верха слайда.
      yOffset: y === null ? 0 : Math.max(0, Math.min(100, y)),
      allowReanswer: flag(element.allow_reanswer),
      question: str(raw.question),
      placeholder: str(raw.placeholder),
      maxLength: max !== null && max > 0 ? Math.floor(max) : null,
      submitLabel: str(raw.submit_label),
      thanksText: str(raw.thanks_text),
      showResults: flag(raw.show_results),
      options: list(raw.options)
        .map((option) => ({ id: integer(option.id), label: str(option.label) ?? '' }))
        .filter((option) => option.id !== null),
      channel: str(raw.channel),
      rateMin: integer(raw.rate_min),
      rateMax: integer(raw.rate_max),
      bands: Array.isArray(raw.bands)
        ? list(raw.bands)
            .map((band) => ({
              from: toDecimal(band.from),
              to: toDecimal(band.to),
              question: str(band.question),
              success: str(band.success),
            }))
            .filter((band) => band.from !== null && band.to !== null)
        : null,
      answer: parseStoryPollAnswer(element.answer),
      results: parseStoryPollResults(element.results),
      labels,
    }
    Object.defineProperty(poll, 'element', { value: element, enumerable: false })
    return poll
  } catch (error) {
    storyPollDebug(`broken poll element: ${error && error.message}`)
    return null
  }
}

/**
 * Верх текст-блока слайда: `y_offset` % ВСЕЙ высоты слайда (как `top: y%` в вебе), потом сдвиг внутрь
 * `region` — области между шапкой и кнопками: не выше её верха, низ не ниже её низа, а не влезает
 * целиком — к верху. `cardHeight` 0 — ещё не измерен.
 */
export function storyPollTop(yOffset, slideHeight, region, cardHeight) {
  let top = Math.max(region.top, ((yOffset || 0) / 100) * slideHeight)
  if (cardHeight > 0 && top + cardHeight > region.bottom) top = Math.max(region.top, region.bottom - cardHeight)
  return top
}

/**
 * Нижний край места карточек опросов: верх нижнего ряда слайда (кнопка звука, «товары»), если он
 * виден (`bottom` — от верха слайда), иначе низ безопасной зоны; не выше её верха.
 *
 * @param {number} slideHeight
 * @param {{ top?: number, bottom?: number }} [insets]
 * @param {number|null} [bottom]
 */
export function storyPollLowerEdge(slideHeight, insets = {}, bottom = null) {
  const upper = Math.max(0, (insets && insets.top) || 0)
  const edge = typeof bottom === 'number' && Number.isFinite(bottom) ? bottom : slideHeight - Math.max(0, (insets && insets.bottom) || 0)
  return Math.max(upper, edge)
}

/**
 * Верх карточки опроса — как `fittedTop` JS SDK (#277): `clamp(y_offset, 0, 100)` % ВСЕЙ высоты слайда
 * (как у текст-блоков), не выше верха безопасной зоны (под вырезом карточка не рисуется); карточка,
 * которая не влезает, поднимается так, чтобы её низ был на `margin` выше нижнего ряда слайда (`bottom`
 * — верх ряда со звуком или «товарами», если он виден) или низа безопасной зоны, но не выше её верха.
 * Высота карточки 0 — ещё не измерена: как задано.
 *
 * @param {number} yOffset
 * @param {number} slideHeight высота всего слайда
 * @param {number} cardHeight
 * @param {{ top?: number, bottom?: number }} [insets]
 * @param {number} [margin]
 * @param {number|null} [bottom] верх нижнего ряда от верха слайда; `null` — ряда нет
 */
export function storyPollFittedTop(yOffset, slideHeight, cardHeight, insets = {}, margin = STORY_POLL_FIT_MARGIN, bottom = null) {
  const upper = Math.max(0, insets.top || 0)
  const lower = storyPollLowerEdge(slideHeight, insets, bottom)
  const y = Math.max(0, Math.min(100, Number(yOffset) || 0))
  const configured = Math.max(upper, (y / 100) * slideHeight)
  if (!(slideHeight > 0) || !(cardHeight > 0)) return configured
  const max = lower - cardHeight - margin
  return configured <= max ? configured : Math.max(upper, max)
}

/** Опросы слайда, которые рисуются, по порядку. */
export function slidePolls(slide) {
  return slidePollElements(slide).map(parseStoryPoll).filter(Boolean)
}

/** Отвеченный — как `hasAnswer` JS SDK: непустые `option_ids`, непустой `text` или число `rate`. */
export function hasStoryPollAnswer(answer) {
  if (!answer) return false
  return (
    (Array.isArray(answer.option_ids) && answer.option_ids.length > 0) ||
    (typeof answer.text === 'string' && answer.text !== '') ||
    (typeof answer.rate === 'number' && Number.isFinite(answer.rate))
  )
}

/** Значения шкалы: `rate_min..rate_max`, иначе по умолчанию вида; не больше 21. */
export function storyPollScaleRange(type, poll) {
  const [defaultMin, defaultMax] = STORY_POLL_SCALE_RANGES[type] || STORY_POLL_SCALE_RANGES.nps
  const min = poll && Number.isInteger(poll.rateMin) ? poll.rateMin : defaultMin
  const max = poll && Number.isInteger(poll.rateMax) ? poll.rateMax : defaultMax
  const values = []
  for (let value = min; value <= max && values.length < STORY_POLL_SCALE_LIMIT; value++) values.push(value)
  return values
}

/**
 * Тон ячейки шкалы — цвета `scaleColor` JS SDK семантикой кита: `danger` (красный), `warning`
 * (жёлтый), `success` (зелёный). У NPS 0..10 критики 0–6 — `danger`, нейтралы 7–8 — `warning`,
 * сторонники 9–10 — `success`; у прочих — по трети шкалы.
 *
 * @returns {'danger'|'warning'|'success'}
 */
export function storyPollScaleTone(type, value, min, max) {
  if (type === 'nps' && min === 0 && max === 10) return value <= 6 ? 'danger' : value <= 8 ? 'warning' : 'success'
  const position = max > min ? (value - min) / (max - min) : 1
  return position < 0.34 ? 'danger' : position < 0.68 ? 'warning' : 'success'
}

/**
 * Текст и значки на заливке (кнопка, галочка, ячейка шкалы): из белого и тёмного — тот, у кого контраст
 * WCAG с заливкой выше (равно — тёмный): `light` или `dark`. Цвет разбирает тот же `storyColor`, что и
 * фон слайда; не цвет — `dark`.
 */
export function storyPollTextOn(color) {
  return storyColorScheme(color, ON_FILL) === 'dark' ? 'light' : 'dark'
}

/** Тёмный и белый текст на заливке: схема `dark` — белый. */
const ON_FILL = Object.freeze({ light: '#000000', dark: '#FFFFFF' })

/** Буква варианта: A, B, C… после Z — номер. */
export function storyPollOptionLetter(index) {
  return index >= 0 && index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}

/** Полоса, где `from ≤ rate ≤ to`, или `null`. */
export function storyPollBand(poll, rate) {
  if (typeof rate !== 'number' || !poll || !Array.isArray(poll.bands)) return null
  return poll.bands.find((item) => rate >= item.from && rate <= item.to) || null
}

/** `success` полосы оценки; нет такой или нет текста — `null`. */
export function storyPollBandText(poll, rate) {
  const band = storyPollBand(poll, rate)
  return (band && band.success) || null
}

/** Вопрос полосы оценки (`bandQuestion` JS SDK): без пробелов по краям; пустой или нет — `null`. */
export function storyPollBandQuestion(poll, rate) {
  const band = storyPollBand(poll, rate)
  const question = band && typeof band.question === 'string' ? band.question.trim() : ''
  return question || null
}

/**
 * Тексты карточки, как в JS SDK: английские умолчания < тексты хоста (`{ reanswer, error, submit }`) <
 * `labels` элемента. Пустые строки ничего не перекрывают.
 */
export function storyPollTexts(host, labels) {
  const texts = { ...STORY_POLL_DEFAULT_TEXTS }
  ;[host, labels].forEach((source) => {
    if (!source || typeof source !== 'object') return
    TEXT_KEYS.forEach((key) => {
      if (filled(source[key])) texts[key] = source[key]
    })
  })
  return texts
}

/** Ввод поля в пределах `limit` единиц UTF-16 (как `value.length` в вебе), пару суррогатов не режет. */
export function storyPollCutText(value, limit) {
  if (!limit || value.length <= limit) return value
  const last = value.charCodeAt(limit - 1)
  return value.slice(0, last >= 0xd800 && last <= 0xdbff ? limit - 1 : limit)
}

// --- Сохранённые ответы (P1) -----------------------------------------------------------------------
//
// Как `stories-poll/storage.ts` JS SDK: ответ после отправки пишется на устройство на 90 дней (лента не
// знает ответов анонимов). Ключ — магазин (как у остальных хранилищ SDK), `did`, вид опроса, код,
// сторис и слайд: `@PersonaClick_<shop>_stories_poll_<did>_<type>_<code>_<story>_<slide>`. Без `did` ничего не
// читается и не пишется: ответ другого человека не показывается. Запись — `{ answer, results,
// saved_at }`; битая, без даты или старше 90 дней удаляется при чтении. Что важнее: ответ свежей ленты >
// ответ, отправленный раньше в этом процессе (он в элементе ленты и в кэше) > запись на устройстве.
//
// AsyncStorage асинхронный, а карточка рисуется сразу: записи держит кэш в памяти. Виджет читает их
// заранее, вместе с лентой (`loadStoryPollAnswers`); карточка без прочитанной записи дочитывает её
// сама и показывает, если её ещё не трогали.

const stored = new Map()

/**
 * Ключ сохранённого ответа или `null` — нет магазина или `did`.
 * @param {{ shopId?: string, did?: string } | null | undefined} storage
 */
export function storyPollStorageKey(storage, poll, storyId, slideId) {
  if (!storage || !filled(storage.shopId) || !filled(storage.did) || !poll) return null
  const name = ['stories_poll', storage.did, poll.type, String(poll.code || ''), String(storyId), String(slideId)].join('_')
  return getStorageKey(name, storage.shopId)
}

const fresh = (record, now = Date.now()) =>
  !!record && typeof record.saved_at === 'number' && Number.isFinite(record.saved_at) && now - record.saved_at <= STORY_POLL_ANSWER_TTL_MS

/**
 * Строка хранилища → `{ answer, results, saved_at }`; записи нет — `null`; битая (не JSON, без ответа),
 * без даты или старая — `{ stale: true }`, её удаляют.
 */
function readRecord(raw) {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || !value.answer || typeof value.answer !== 'object') return { stale: true }
    if (!fresh(value)) return { stale: true }
    return {
      answer: value.answer,
      results: value.results && typeof value.results === 'object' ? value.results : null,
      saved_at: value.saved_at,
    }
  } catch (error) {
    return { stale: true }
  }
}

/**
 * Сохранённый ответ из кэша: `{ answer, results }` (ответ и итоги как в ленте), `null` — его нет,
 * `undefined` — ещё не прочитан.
 */
export function storyPollSavedAnswer(key) {
  if (!key || !stored.has(key)) return undefined
  const record = stored.get(key)
  if (!record) return null
  if (!fresh(record)) {
    stored.set(key, null)
    AsyncStorage.removeItem(key).catch(() => {})
    return null
  }
  return { answer: record.answer, results: record.results }
}

/** Прочитать записи с диска в кэш (уже прочитанные не читаются); старые и без даты удаляются. */
export async function loadStoryPollAnswers(keys) {
  const missing = Array.from(new Set((keys || []).filter((key) => key && !stored.has(key))))
  if (missing.length === 0) return
  let pairs = []
  try {
    pairs = await AsyncStorage.multiGet(missing)
  } catch (error) {
    return
  }
  const stale = []
  ;(pairs || []).forEach(([key, raw]) => {
    if (stored.has(key)) return
    const record = readRecord(raw)
    if (record && record.stale) stale.push(key)
    stored.set(key, record && !record.stale ? record : null)
  })
  if (stale.length) AsyncStorage.multiRemove(stale).catch(() => {})
}

/** Записать ответ (кэш и диск) с отметкой времени. Без ключа — ничего. */
export function writeStoryPollAnswer(key, state) {
  if (!key) return
  const record = { answer: state.answer || null, results: state.results || null, saved_at: Date.now() }
  stored.set(key, record)
  try {
    Promise.resolve(AsyncStorage.setItem(key, JSON.stringify(record))).catch(() => {})
  } catch (error) {
    // Нет хранилища — ответ живёт до конца процесса.
  }
}

/**
 * Ключи ответов, которые слайдам нужно прочитать: опросы без ответа ленты.
 * @param {{ shopId: string, did: string }} storage
 * @param {object[]} stories
 */
export function storyPollStorageKeys(storage, stories) {
  const keys = []
  ;(Array.isArray(stories) ? stories : []).forEach((story) => {
    ;(Array.isArray(story && story.slides) ? story.slides : []).forEach((slide) => {
      slidePolls(slide).forEach((poll) => {
        if (poll.answer) return
        const key = storyPollStorageKey(storage, poll, story.id, slide && slide.id)
        if (key) keys.push(key)
      })
    })
  })
  return keys
}

/** Для тестов: забыть кэш сохранённых ответов. */
export function resetStoryPollAnswers() {
  stored.clear()
}

// --- Тела запросов (P3) ----------------------------------------------------------------------------

/**
 * Источник ответа для отчётов опросов (`sourceParams` JS SDK): кампания сторис и слайд, строками
 * (виртуальные слайды товарных кампаний — `12_0`). Нет сторис — нет источника; нет слайда — без
 * `source_item_id`; пустые значения не уходят.
 */
export function storyPollSource(storyId, slideId) {
  if (storyId === undefined || storyId === null || storyId === '') return {}
  const source = { source_type: 'stories', source_id: String(storyId) }
  if (slideId !== undefined && slideId !== null && slideId !== '') source.source_item_id = String(slideId)
  return source
}

/** Ответ на мини-опрос для транспорта: `option_ids` или `text` и источник. */
export function storyPollAnswerBody(params, storyId, slideId) {
  const body = {}
  if (Array.isArray(params.option_ids)) body.option_ids = params.option_ids
  if (typeof params.text === 'string') body.text = params.text
  return { ...body, ...storyPollSource(storyId, slideId) }
}

/**
 * Оценка шкалы для транспорта: `channel` (по умолчанию `stories`), NPS — `category`, CSAT / CES —
 * `campaign`, `rate`, `comment` (только непустой) и источник.
 */
export function storyPollReviewBody(poll, rate, comment, storyId, slideId) {
  const body = { channel: filled(poll.channel) ? poll.channel : 'stories' }
  if (poll.type === 'nps') body.category = poll.code
  else body.campaign = poll.code
  body.rate = rate
  if (filled(comment)) body.comment = comment
  return { ...body, ...storyPollSource(storyId, slideId) }
}

const percentOf = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)))

/**
 * Контроллер карточки — поведение `createPoll` JS SDK без отрисовки. Состояния `form` / `answered`:
 * ответ ленты, без него — сохранённый на устройстве (`storage`), без него — форма. Выбор одного и шкала
 * отправляются по нажатию (выделение сразу, при ошибке — назад к прежнему), несколько вариантов и
 * текст — кнопкой. Пока ответ уходит, всё выключено и повторные нажатия не считаются; ошибка — текст под
 * карточкой, можно повторить (автоповтора нет). Успех — ответ в состояние, в элемент ленты (слайд,
 * показанный снова, рисует его отвеченным) и на устройство, даже если карточки уже нет.
 *
 * Шкала с вопросом в полосе оценки (P2): после оценки — вопрос и поле комментария (до 5000 символов,
 * счётчик), кнопка отправляет ту же оценку с комментарием; потом — `success` полосы. Без вопроса —
 * `success` сразу. Ушли со слайда без комментария — при следующем показе вопрос снова.
 *
 * Пауза слайда: `onHold(hold)` при смене `hold = pressed || focused || sending`. После `detach()`
 * (карточка ушла со слайда) ни `onChange`, ни `onHold` не зовутся: ответ только сохраняется.
 *
 * @param {{ poll: object, storyId: string|number, slideId: string|number,
 *           transport: { answerMiniPoll: Function, review: Function },
 *           storage?: { shopId: string, did: string } | null,
 *           texts?: { reanswer?: string, error?: string, submit?: string },
 *           onChange?: (state: object) => void, onHold?: (hold: boolean) => void }} options
 */
export function createStoryPollController({ poll, storyId, slideId, transport, storage = null, texts, onChange, onHold }) {
  const key = storyPollStorageKey(storage, poll, storyId, slideId)
  const current = { answer: null, results: null }
  // Ответ ленты важнее сохранённого (JS: `element.answer ? null : readPollAnswer(key)`).
  const saved = poll.answer ? null : storyPollSavedAnswer(key)
  if (saved) {
    current.answer = parseStoryPollAnswer(saved.answer)
    current.results = parseStoryPollResults(saved.results)
  } else {
    current.answer = poll.answer
    current.results = poll.results
  }
  const pollTexts = storyPollTexts(texts, poll.labels)
  const optionIds = poll.options.map((option) => option.id)
  const limit = poll.kind === 'text' ? poll.maxLength : null
  let mode = hasStoryPollAnswer(current.answer) ? 'answered' : 'form'
  let previous = []
  let selected = []
  let previousRate = null
  let marked = null
  let text = ''
  let comment = ''
  let sending = false
  let error = false
  let reanswered = false
  let touched = false
  let pressed = false
  let focused = false
  let paused = false
  let attached = true

  // Форма начинается с прежнего ответа: он подсвечен (выбор, шкала) или предвыбран (чипы).
  const resetForm = () => {
    const ids = current.answer && Array.isArray(current.answer.option_ids) ? current.answer.option_ids : []
    previous = optionIds.filter((id) => ids.includes(id))
    selected = [...previous]
    previousRate = current.answer && typeof current.answer.rate === 'number' ? current.answer.rate : null
    marked = previousRate
    text = ''
    comment = ''
    error = false
  }
  resetForm()

  const answeredRate = () => (current.answer && typeof current.answer.rate === 'number' ? current.answer.rate : null)
  const answeredIds = () => {
    const ids = current.answer && Array.isArray(current.answer.option_ids) ? current.answer.option_ids : []
    return optionIds.filter((id) => ids.includes(id))
  }
  // Вопрос полосы, пока на него нет комментария.
  const followUp = () => {
    if (mode !== 'answered' || poll.kind !== 'scale') return null
    const rate = answeredRate()
    if (rate === null || (current.answer && filled(current.answer.comment))) return null
    return storyPollBandQuestion(poll, rate)
  }
  const percents = () => {
    const results = current.results
    if (!results || !Array.isArray(results.options)) return null
    const map = {}
    optionIds.forEach((id) => {
      const item = results.options.find((option) => option.id === id)
      map[id] = percentOf(item && item.percent)
    })
    return map
  }
  const thanks = () => {
    if (mode !== 'answered') return null
    if (poll.kind === 'scale') return followUp() ? null : storyPollBandText(poll, answeredRate())
    return filled(poll.thanksText) ? poll.thanksText : null
  }

  const snapshot = () => {
    const question = followUp()
    return {
      kind: poll.kind,
      mode,
      sending,
      error,
      selected: mode === 'answered' ? answeredIds() : [...selected],
      rate: mode === 'answered' ? answeredRate() : marked,
      text,
      limit,
      counter: limit ? `${text.length}/${limit}` : null,
      canSubmit:
        mode === 'form' && !sending && (poll.kind === 'multiple_choice' ? selected.length > 0 : poll.kind === 'text' ? text.trim() !== '' : false),
      // Итоги выбора — проценты, если сервер прислал `results` (P7).
      percents: mode === 'answered' ? percents() : null,
      thanks: thanks(),
      answerText: mode === 'answered' && current.answer && filled(current.answer.text) ? current.answer.text : null,
      // Вопрос полосы шкалы и поле комментария к нему.
      followUp: question,
      comment,
      commentCounter: question ? `${comment.length}/${STORY_POLL_COMMENT_LIMIT}` : null,
      canSubmitComment: !!question && !sending && comment.trim() !== '',
      // Поле на карточке: `text` — форма текста, `comment` — комментарий шкалы, иначе `null`.
      field: mode === 'form' && poll.kind === 'text' ? 'text' : question ? 'comment' : null,
      canReanswer: mode === 'answered' && poll.allowReanswer,
      reanswered,
      // Кнопка выбора нескольких и текста: `submit_label`, иначе текст `submit`.
      submitLabel: filled(poll.submitLabel) ? poll.submitLabel : pollTexts.submit,
      // Кнопка комментария: у шкалы своей подписи нет — текст `submit` (по умолчанию «Send», как JS).
      commentSubmitLabel: pollTexts.submit,
      texts: pollTexts,
    }
  }

  const emit = () => {
    if (attached && onChange) onChange(snapshot())
  }
  const sync = () => {
    const hold = pressed || focused || sending
    if (hold === paused) return
    paused = hold
    if (attached && onHold) onHold(hold)
  }

  // Сохранённый ответ ещё не прочитан — дочитать и показать, если карточку не трогали.
  if (!poll.answer && key && saved === undefined) {
    loadStoryPollAnswers([key]).then(() => {
      const late = storyPollSavedAnswer(key)
      if (!late || touched || sending || mode !== 'form') return
      current.answer = parseStoryPollAnswer(late.answer)
      current.results = parseStoryPollResults(late.results)
      if (!hasStoryPollAnswer(current.answer)) return
      mode = 'answered'
      resetForm()
      emit()
    })
  }

  // Ответ принят: состояние, элемент ленты и запись на устройстве (`raw` — как в ленте).
  const accept = (raw) => {
    const element = poll.element
    if (element && typeof element === 'object') {
      element.answer = raw.answer
      element.results = raw.results
    }
    writeStoryPollAnswer(key, raw)
    current.answer = parseStoryPollAnswer(raw.answer)
    current.results = parseStoryPollResults(raw.results)
  }

  const send = (request, toRaw, revert, allowed) => {
    if (sending || !allowed()) return Promise.resolve(false)
    touched = true
    sending = true
    error = false
    emit()
    sync()
    let result
    try {
      result = Promise.resolve(request())
    } catch (failure) {
      result = Promise.reject(failure)
    }
    return result.then(
      (reply) => {
        accept(toRaw(reply))
        sending = false
        if (!attached) return true
        mode = 'answered'
        reanswered = false
        // Поля больше нет — фокус ушёл вместе с ним.
        focused = false
        resetForm()
        emit()
        sync()
        return true
      },
      () => {
        sending = false
        if (!attached) return false
        error = true
        if (revert) revert()
        emit()
        sync()
        return false
      },
    )
  }

  const inForm = (kind) => mode === 'form' && !sending && (!kind || poll.kind === kind)
  const formAllowed = () => mode === 'form'

  const answer = (params) =>
    send(
      () => transport.answerMiniPoll(poll.code, storyPollAnswerBody(params, storyId, slideId)),
      // Ответ сервера (`payload.answer`), без него — отправленный; результаты — только из ответа.
      (reply) => ({
        answer:
          (reply && reply.answer && typeof reply.answer === 'object' ? reply.answer : null) || {
            option_ids: params.option_ids || null,
            text: typeof params.text === 'string' ? params.text : null,
          },
        results: (reply && reply.results && typeof reply.results === 'object' ? reply.results : null) || null,
      }),
      () => {
        if (poll.kind === 'single_choice') selected = [...previous]
      },
      formAllowed,
    )

  return {
    /** Текущее состояние для отрисовки. */
    state: snapshot,
    /** Тексты карточки (английские умолчания JS SDK < хост < `labels`). */
    texts: pollTexts,
    /** Ключ сохранённого ответа (`null` — не сохраняется). */
    storageKey: key,
    /** Выбор одного: выделение сразу и отправка. */
    choose(id) {
      if (!inForm('single_choice') || !optionIds.includes(id)) return Promise.resolve(false)
      selected = [id]
      return answer({ option_ids: [id] })
    },
    /** Чип выбора нескольких: включить / выключить. */
    toggle(id) {
      if (!inForm('multiple_choice') || !optionIds.includes(id)) return
      touched = true
      selected = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
      emit()
    },
    /** Ввод текста: обрезается по `max_length` (пару суррогатов не режет). */
    setText(value) {
      if (!inForm('text')) return
      touched = true
      text = storyPollCutText(typeof value === 'string' ? value : '', limit)
      emit()
    },
    /** Кнопка отправки: выбранные варианты в порядке вариантов или обрезанный текст. */
    submit() {
      if (!inForm()) return Promise.resolve(false)
      if (poll.kind === 'multiple_choice') {
        const ids = optionIds.filter((id) => selected.includes(id))
        return ids.length ? answer({ option_ids: ids }) : Promise.resolve(false)
      }
      if (poll.kind === 'text') {
        const trimmed = text.trim()
        return trimmed ? answer({ text: trimmed }) : Promise.resolve(false)
      }
      return Promise.resolve(false)
    },
    /** Оценка шкалы: выделение сразу и отправка, без комментария. */
    rate(value) {
      if (!inForm('scale')) return Promise.resolve(false)
      marked = value
      return send(
        () => transport.review(poll.type, storyPollReviewBody(poll, value, null, storyId, slideId)),
        () => ({ answer: { rate: value }, results: null }),
        () => {
          marked = previousRate
        },
        formAllowed,
      )
    },
    /** Комментарий к вопросу полосы: не длиннее 5000 (пару суррогатов не режет). */
    setComment(value) {
      if (sending || !followUp()) return
      touched = true
      comment = storyPollCutText(typeof value === 'string' ? value : '', STORY_POLL_COMMENT_LIMIT)
      emit()
    },
    /** Отправка комментария: та же оценка и обрезанный комментарий. */
    submitComment() {
      const rate = answeredRate()
      const trimmed = comment.trim()
      if (sending || !followUp() || !trimmed) return Promise.resolve(false)
      return send(
        () => transport.review(poll.type, storyPollReviewBody(poll, rate, trimmed, storyId, slideId)),
        () => ({ answer: { rate, comment: trimmed }, results: null }),
        null,
        () => !!followUp(),
      )
    },
    /** «Ответить заново» (`allow_reanswer`): снова форма, прежний ответ подсвечен, поле пустое. */
    reanswer() {
      if (mode !== 'answered' || !poll.allowReanswer || sending) return
      touched = true
      mode = 'form'
      reanswered = true
      resetForm()
      emit()
    },
    /** Палец на карточке. */
    press(on) {
      pressed = !!on
      sync()
    },
    /** Фокус в поле карточки (клавиатура). */
    focus(on) {
      focused = !!on
      sync()
    },
    /** Карточка ушла: дальше только сохранение ответов, без UI и паузы. */
    detach() {
      attached = false
    },
    /** Карточка снова на экране (повторный монтаж того же вида). */
    attach() {
      attached = true
    },
  }
}
