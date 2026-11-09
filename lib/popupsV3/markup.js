/**
 * Облегчённая разметка текстов и переменные `{{key}}` попапов v3. Чистые функции без React — их
 * гоняют тесты на общих фикстурах (`markup.json`, `variables.json`).
 *
 * Разметка — регэксп компилятора (`Context::RICH_TEXT_RE`): одно сканирование слева направо, без
 * вложенности. `***жирный курсив***`, `**жирный**`, `*курсив*`, `__подчёркнутый__`,
 * `~~зачёркнутый~~`, `^^надчёркнутый^^`; перевод строки — перенос; HTML — обычный текст.
 */

const RICH_TEXT_RE = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|~~([^~]+)~~|__([^_]+)__|\^\^([^^]+)\^\^|\*([^*]+)\*/g

const GROUP_FLAGS = [
  null,
  { bold: true, italic: true },
  { bold: true },
  { strike: true },
  { underline: true },
  { overline: true },
  { italic: true },
]

/**
 * Текст → спаны `{ text, bold?, italic?, underline?, strike?, overline? }` (только выставленные
 * флаги). Пустая строка — пустой список.
 */
export function popupMarkupSpans(text) {
  const source = typeof text === 'string' ? text : ''
  const spans = []
  let position = 0
  RICH_TEXT_RE.lastIndex = 0
  let match
  while ((match = RICH_TEXT_RE.exec(source)) !== null) {
    if (match.index > position) spans.push({ text: source.slice(position, match.index) })
    let group = 1
    while (group < GROUP_FLAGS.length && match[group] === undefined) group += 1
    spans.push({ text: match[group], ...GROUP_FLAGS[group] })
    position = match.index + match[0].length
  }
  if (position < source.length) spans.push({ text: source.slice(position) })
  return spans
}

/** Спаны → строка без разметки (подписи доступности, копирование). */
export const popupSpansText = (spans) => (Array.isArray(spans) ? spans.map((span) => span.text).join('') : '')

/** Переменные витрины: их значения подставляет SDK при показе, а не дизайн. */
export const POPUP_RUNTIME_VARIABLES = Object.freeze([
  'promo_code',
  'coupon_code',
  'campaign_end',
  'remaining',
  'progress',
  'cart_total',
  'wheel_prize',
])

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/**
 * Статические переменные дизайна: объект `{ key: value }` или старый массив `{ key, value }`
 * (записи без ключа отбрасываются). Значения — строками.
 */
export function popupStaticVariables(raw) {
  const out = {}
  const put = (key, value) => {
    const name = typeof key === 'string' ? key : typeof key === 'number' ? String(key) : ''
    if (!name.trim()) return
    out[name] = value === null || value === undefined ? '' : String(value)
  }
  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) put(item.key, item.value)
    })
  } else if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach((key) => put(key, raw[key]))
  }
  return out
}

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key)

/**
 * Подставляет статические переменные. Ключ витринной переменной не трогается, даже если он есть в
 * `variables` дизайна. Платформенные ссылки: для `{{key}}` сначала `key_android` / `key_ios` (по
 * `os`), потом `key`. Неизвестный ключ остаётся токеном.
 */
export function popupApplyStaticVariables(text, statics, os) {
  if (typeof text !== 'string' || text.indexOf('{{') === -1) return text
  return text.replace(TOKEN_RE, (token, key) => {
    if (POPUP_RUNTIME_VARIABLES.indexOf(key) !== -1) return token
    const platformKey = os === 'android' || os === 'ios' ? `${key}_${os}` : null
    if (platformKey && own(statics, platformKey)) return statics[platformKey]
    return own(statics, key) ? statics[key] : token
  })
}

/** Подставляет витринные переменные, известные при показе; остальные токены остаются. */
export function popupApplyRuntimeVariables(text, runtime) {
  if (typeof text !== 'string' || text.indexOf('{{') === -1 || !runtime) return text
  return text.replace(TOKEN_RE, (token, key) => {
    if (POPUP_RUNTIME_VARIABLES.indexOf(key) === -1) return token
    const value = runtime[key]
    return value === null || value === undefined ? token : String(value)
  })
}

/**
 * Спаны текста с витринными переменными: разметка разбирается до подстановки, значения витринных
 * переменных — без разметки.
 */
export function popupRichSpans(text, runtime) {
  return popupMarkupSpans(text).map((span) => {
    const value = popupApplyRuntimeVariables(span.text, runtime)
    return value === span.text ? span : { ...span, text: value }
  })
}

/** Есть ли токен переменной `key` в строке. */
export const popupHasVariable = (text, key) =>
  typeof text === 'string' && new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`).test(text)

/**
 * Применяет `fn` ко всем строкам значения (вглубь объектов и массивов) — подстановка статических
 * переменных во все поля стиля: тексты, подписи полей формы, ссылки, адреса картинок.
 */
export function popupMapStrings(value, fn) {
  if (typeof value === 'string') return fn(value)
  if (Array.isArray(value)) return value.map((item) => popupMapStrings(item, fn))
  if (value && typeof value === 'object') {
    const out = {}
    Object.keys(value).forEach((key) => {
      out[key] = popupMapStrings(value[key], fn)
    })
    return out
  }
  return value
}
