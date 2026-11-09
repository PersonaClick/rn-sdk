import { slidePollElements, toDecimal } from './storySupport'

/**
 * Опросы на слайдах сторис V2 (элемент `poll`, только API v3): мини-опросы `single_choice`,
 * `multiple_choice`, `text` и шкалы NPS / CSAT / CES. Чистая логика без React — разбор элемента,
 * шкала, тексты, ответы сессии и контроллер карточки (поведение `createPoll` JS SDK). Рисует
 * карточку StoryPoll; в сеть ходит транспорт опросов, который просмотру передаёт виджет.
 *
 * Разбор терпимый: числа строками (`"40"`, `"120"`), `null` в необязательных полях; `code` не
 * обязателен (нет — пустая строка, как в JS: опрос рисуется, ответит сервер). Неизвестный вид или
 * битый элемент — `null` (опрос не рисуется, слайд показывается как обычно).
 */

/** Тексты по умолчанию; хост и `labels` элемента (непустые строки) их перекрывают. */
export const STORY_POLL_DEFAULT_TEXTS = Object.freeze({
  reanswer: 'Answer again',
  error: 'Failed to send the answer. Please try again',
  submit: 'Send',
})

/** Значения шкал по умолчанию: NPS 0..10, CSAT 1..5, CES 1..7. */
export const STORY_POLL_SCALE_RANGES = Object.freeze({ nps: [0, 10], csat: [1, 5], ces: [1, 7] })

/** Больше значений шкала не рисует. */
export const STORY_POLL_SCALE_LIMIT = 21

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

/** Ответ из ленты или сервера: `{ id?, option_ids, text, rate }` или `null`. */
export function parseStoryPollAnswer(value) {
  if (!value || typeof value !== 'object') return null
  const ids = Array.isArray(value.option_ids) ? value.option_ids.map(integer).filter((id) => id !== null) : null
  // Отвечен любым числом `rate`, как в JS SDK (выделится только совпавшая ячейка шкалы).
  const answer = { option_ids: ids && ids.length ? ids : null, text: str(value.text), rate: toDecimal(value.rate) }
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
 * `kind` — `single_choice` | `multiple_choice` | `text` | `scale`; `type` — `poll_type`.
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
    return {
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
            .map((band) => ({ from: toDecimal(band.from), to: toDecimal(band.to), success: str(band.success) }))
            .filter((band) => band.from !== null && band.to !== null)
        : null,
      answer: parseStoryPollAnswer(element.answer),
      results: parseStoryPollResults(element.results),
      labels,
    }
  } catch (error) {
    storyPollDebug(`broken poll element: ${error && error.message}`)
    return null
  }
}

/**
 * Верх карточки опроса и текст-блока слайда (одно правило): `y_offset` % ВСЕЙ высоты слайда (как
 * `top: y%` в вебе), потом сдвиг внутрь `region` — области между шапкой и кнопками: не выше её верха,
 * низ не ниже её низа, а не влезает целиком — к верху (у карточки дальше прокрутка внутри).
 * `cardHeight` 0 — ещё не измерена.
 */
export function storyPollTop(yOffset, slideHeight, region, cardHeight) {
  let top = Math.max(region.top, ((yOffset || 0) / 100) * slideHeight)
  if (cardHeight > 0 && top + cardHeight > region.bottom) top = Math.max(region.top, region.bottom - cardHeight)
  return top
}

/** Опросы слайда, которые рисуются, по порядку. */
export function slidePolls(slide) {
  return slidePollElements(slide).map(parseStoryPoll).filter(Boolean)
}

/** Отвеченный: непустые `option_ids`, непустой `text` или число `rate`. */
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

const NPS_COLORS = ['#FCA5A5', '#FCA5A5', '#FCA5A5', '#FDBA74', '#FDBA74', '#FDBA74', '#FCD34D']

/** Цвет ячейки: у NPS 0..10 критики красные/оранжевые, 7–8 жёлтые, 9–10 зелёные; иначе по трети. */
export function storyPollScaleColor(type, value, min, max) {
  if (type === 'nps' && min === 0 && max === 10) {
    return value <= 6 ? NPS_COLORS[value] : value <= 8 ? '#FDE68A' : '#86EFAC'
  }
  const position = max > min ? (value - min) / (max - min) : 1
  return position < 0.34 ? '#FCA5A5' : position < 0.68 ? '#FDE68A' : '#86EFAC'
}

/** `success` полосы, где `from ≤ rate ≤ to`; нет такой или нет текста — `null`. */
export function storyPollBandText(poll, rate) {
  if (typeof rate !== 'number' || !poll || !Array.isArray(poll.bands)) return null
  const band = poll.bands.find((item) => rate >= item.from && rate <= item.to)
  return (band && band.success) || null
}

/**
 * Заливка выбранного значения шкалы — цвет его полосы (`storyPollScaleColor`); значения нет ни в
 * одной полосе (или полос нет) — `null`, тогда карточка берёт цвет выбора.
 */
export function storyPollScaleFill(poll, value, min, max) {
  if (!poll || !Array.isArray(poll.bands) || !poll.bands.some((item) => value >= item.from && value <= item.to)) return null
  return storyPollScaleColor(poll.type, value, min, max)
}

/** Относительная яркость `#RRGGBB` (sRGB, как WCAG); не цвет — `null`. */
function luminanceOf(color) {
  const match = /^#([0-9a-f]{6})$/i.exec(typeof color === 'string' ? color : '')
  if (!match) return null
  const rgb = parseInt(match[1], 16)
  const linear = (channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * linear((rgb >> 16) & 255) + 0.7152 * linear((rgb >> 8) & 255) + 0.0722 * linear(rgb & 255)
}

/** Отношение контраста WCAG двух яркостей. */
const contrastRatio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/**
 * Текст и значки на заливке `#RRGGBB` (кнопка, галочка, выбранное значение шкалы): из белого и тёмного
 * (`text_dark_primary`, чёрный) — тот, у кого контраст WCAG с заливкой выше: `light` или `dark`. Не цвет —
 * `dark`. На цвете выбора `#22C55E` — тёмный (≈ 9:1 против 2,3:1 у белого).
 */
export function storyPollTextOn(color) {
  const fill = luminanceOf(color)
  if (fill === null) return 'dark'
  return contrastRatio(fill, 1) > contrastRatio(fill, 0) ? 'light' : 'dark'
}

/** Буква варианта: A, B, C… после Z — номер. */
export function storyPollOptionLetter(index) {
  return index >= 0 && index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}

/**
 * Тексты итогов выбора — русские и английские, по языку устройства: шапка «Результаты», «Спасибо!» с
 * «Голос учтён» (если у опроса нет своего `thanks_text`) и формы числа голосов.
 */
export const STORY_POLL_RESULT_TEXTS = Object.freeze({
  ru: Object.freeze({ results: 'Результаты', thanks: 'Спасибо!', counted: 'Голос учтён', votes: ['голос', 'голоса', 'голосов'] }),
  en: Object.freeze({ results: 'Results', thanks: 'Thanks!', counted: 'Vote counted', votes: ['vote', 'votes'] }),
})

/** Язык устройства: `ru` для русской локали, иначе `en`. */
export function storyPollLanguage() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || ''
    return /^ru\b/i.test(locale) ? 'ru' : 'en'
  } catch (error) {
    return 'en'
  }
}

/** Тексты итогов по языку (`ru` / `en`; другой — английские). */
export const storyPollResultTexts = (language = storyPollLanguage()) => STORY_POLL_RESULT_TEXTS[language] || STORY_POLL_RESULT_TEXTS.en

/**
 * Число голосов `results.total` с формой слова: «1 голос», «3 голоса», «1 248 голосов» / «1 vote»,
 * «1,248 votes». Разряды и пробел перед словом неразрывные. Нет голосов (или не число) — `null`.
 */
export function storyPollVotes(total, language = storyPollLanguage()) {
  const n = Math.round(Number(total))
  if (!Number.isFinite(n) || n <= 0) return null
  const ru = language === 'ru'
  const forms = (ru ? STORY_POLL_RESULT_TEXTS.ru : STORY_POLL_RESULT_TEXTS.en).votes
  const digits = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ru ? ' ' : ',')
  let form = n === 1 ? forms[0] : forms[1]
  if (ru) {
    const tens = n % 100
    const ones = n % 10
    form = ones === 1 && tens !== 11 ? forms[0] : ones >= 2 && ones <= 4 && (tens < 12 || tens > 14) ? forms[1] : forms[2]
  }
  return `${digits} ${form}`
}

/**
 * Тексты карточки: умолчания < тексты хоста (`{ reanswer, error, submit }`) < `labels` элемента.
 * Пустые строки ничего не перекрывают.
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

/** Ввод поля `text` в пределах `limit` единиц UTF-16 (как `value.length` в вебе), пару суррогатов не режет. */
export function storyPollCutText(value, limit) {
  if (!limit || value.length <= limit) return value
  const last = value.charCodeAt(limit - 1)
  return value.slice(0, last >= 0xd800 && last <= 0xdbff ? limit - 1 : limit)
}

// Ответы этой сессии: в памяти на процесс, одни на все виджеты, show() и handleLink. На диск не
// пишутся. Важнее `answer` / `results` из ленты — новая лента о свежем ответе может не знать.
const answers = new Map()
const answerKey = (shopId, poll) => JSON.stringify([String(shopId || ''), String(poll.type), String(poll.code)])

/** Сохранённый в сессии ответ `{ answer, results }` или `null`. */
export function storyPollSavedAnswer(shopId, poll) {
  return answers.get(answerKey(shopId, poll)) || null
}

/** Запомнить ответ опроса до конца процесса. */
export function saveStoryPollAnswer(shopId, poll, state) {
  answers.set(answerKey(shopId, poll), { answer: state.answer || null, results: state.results || null })
}

/** Для тестов: забыть ответы сессии. */
export function resetStoryPollAnswers() {
  answers.clear()
}

/** Ответ на мини-опрос для транспорта: `story_id` числом, `slide_id` всегда строкой (`"39_0"`). */
export function storyPollAnswerBody(params, storyId, slideId) {
  const body = {}
  if (Array.isArray(params.option_ids)) body.option_ids = params.option_ids
  if (typeof params.text === 'string') body.text = params.text
  body.story_id = typeof storyId === 'string' && /^\d+$/.test(storyId) ? Number(storyId) : storyId
  body.slide_id = String(slideId)
  return body
}

/** Оценка шкалы для транспорта: `channel` (по умолчанию `stories`), NPS — `category`, CSAT / CES — `campaign`. */
export function storyPollReviewBody(poll, rate) {
  const body = { channel: filled(poll.channel) ? poll.channel : 'stories' }
  if (poll.type === 'nps') body.category = poll.code
  else body.campaign = poll.code
  body.rate = rate
  return body
}

const percentOf = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)))

/**
 * Контроллер карточки — поведение `createPoll` JS SDK без отрисовки. Состояния `form` / `answered`
 * (отвеченный — по ответу сессии, иначе по `answer` ленты). Выбор одного и шкала отправляются по
 * нажатию (выделение сразу, при ошибке — назад к прежнему), несколько вариантов и текст — кнопкой.
 * Пока ответ уходит, всё выключено и повторные нажатия не считаются; ошибка — текст под карточкой,
 * можно повторить (автоповтора нет). Успех — в ответы сессии, даже если карточки уже нет.
 *
 * Пауза слайда: `onHold(hold)` при смене `hold = pressed || focused || sending`. После `detach()`
 * (карточка ушла со слайда) ни `onChange`, ни `onHold` не зовутся: ответ только сохраняется.
 *
 * @param {{ poll: object, storyId: string|number, slideId: string|number,
 *           transport: { answerMiniPoll: Function, review: Function }, shopId?: string,
 *           texts?: { reanswer?: string, error?: string, submit?: string },
 *           onChange?: (state: object) => void, onHold?: (hold: boolean) => void }} options
 */
export function createStoryPollController({ poll, storyId, slideId, transport, shopId = '', texts, onChange, onHold }) {
  const saved = storyPollSavedAnswer(shopId, poll)
  const current = { answer: saved ? saved.answer : poll.answer, results: saved ? saved.results : poll.results }
  const pollTexts = storyPollTexts(texts, poll.labels)
  const optionIds = poll.options.map((option) => option.id)
  const limit = poll.kind === 'text' ? poll.maxLength : null
  // Запись сессии появляется только после успешной отправки — и карточка из неё всегда отвеченная,
  // даже если ответ ничего не выделяет (как после успеха в JS).
  let mode = saved || hasStoryPollAnswer(current.answer) ? 'answered' : 'form'
  let previous = []
  let selected = []
  let previousRate = null
  let marked = null
  let text = ''
  let sending = false
  let error = false
  let reanswered = false
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
    error = false
  }
  resetForm()

  const answeredRate = () => (current.answer && typeof current.answer.rate === 'number' ? current.answer.rate : null)
  const answeredIds = () => {
    const ids = current.answer && Array.isArray(current.answer.option_ids) ? current.answer.option_ids : []
    return optionIds.filter((id) => ids.includes(id))
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
    if (poll.kind === 'scale') return storyPollBandText(poll, answeredRate())
    return filled(poll.thanksText) ? poll.thanksText : null
  }

  const snapshot = () => ({
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
    percents: mode === 'answered' ? percents() : null,
    // Всего голосов из `results` (подвал итогов); результатов нет — `null`.
    total: mode === 'answered' && current.results ? current.results.total : null,
    thanks: thanks(),
    answerText: mode === 'answered' && current.answer && filled(current.answer.text) ? current.answer.text : null,
    canReanswer: mode === 'answered' && poll.allowReanswer,
    reanswered,
    // Кнопка выбора нескольких и текста: `submit_label`, иначе текст `submit`.
    submitLabel: filled(poll.submitLabel) ? poll.submitLabel : pollTexts.submit,
    texts: pollTexts,
  })

  const emit = () => {
    if (attached && onChange) onChange(snapshot())
  }
  const sync = () => {
    const hold = pressed || focused || sending
    if (hold === paused) return
    paused = hold
    if (attached && onHold) onHold(hold)
  }

  const send = (request, toState, revert) => {
    if (sending || mode !== 'form') return Promise.resolve(false)
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
        const next = toState(reply)
        saveStoryPollAnswer(shopId, poll, next)
        sending = false
        if (!attached) return true
        current.answer = next.answer
        current.results = next.results
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

  const answer = (params) =>
    send(
      () => transport.answerMiniPoll(poll.code, storyPollAnswerBody(params, storyId, slideId)),
      // Ответ сервера (`payload.answer`), без него — отправленный; результаты — только из ответа.
      (reply) => {
        const server = parseStoryPollAnswer(reply && reply.answer)
        const sent = { option_ids: params.option_ids || null, text: typeof params.text === 'string' ? params.text : null, rate: null }
        return { answer: server || sent, results: parseStoryPollResults(reply && reply.results) }
      },
      () => {
        if (poll.kind === 'single_choice') selected = [...previous]
      },
    )

  const inForm = (kind) => mode === 'form' && !sending && (!kind || poll.kind === kind)

  return {
    /** Текущее состояние для отрисовки. */
    state: snapshot,
    /** Тексты карточки (умолчания < хост < `labels`). */
    texts: pollTexts,
    /** Выбор одного: выделение сразу и отправка. */
    choose(id) {
      if (!inForm('single_choice') || !optionIds.includes(id)) return Promise.resolve(false)
      selected = [id]
      return answer({ option_ids: [id] })
    },
    /** Чип выбора нескольких: включить / выключить. */
    toggle(id) {
      if (!inForm('multiple_choice') || !optionIds.includes(id)) return
      selected = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
      emit()
    },
    /** Ввод текста: обрезается по `max_length` (пару суррогатов не режет). */
    setText(value) {
      if (!inForm('text')) return
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
    /** Оценка шкалы: выделение сразу и отправка. */
    rate(value) {
      if (!inForm('scale')) return Promise.resolve(false)
      marked = value
      return send(
        () => transport.review(poll.type, storyPollReviewBody(poll, value)),
        () => ({ answer: { option_ids: null, text: null, rate: value }, results: null }),
        () => {
          marked = previousRate
        },
      )
    },
    /** «Ответить заново» (`allow_reanswer`): снова форма, прежний ответ подсвечен. */
    reanswer() {
      if (mode !== 'answered' || !poll.allowReanswer || sending) return
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
    /** Карточка ушла: дальше только ответы сессии, без UI и паузы. */
    detach() {
      attached = false
    },
    /** Карточка снова на экране (повторный монтаж того же вида). */
    attach() {
      attached = true
    },
  }
}
