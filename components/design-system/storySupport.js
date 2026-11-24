/**
 * Чистая логика сторис V2: разбор блока `stories/{code}` в то, что рисуют компоненты кита.
 * Без React и без react-native — её гоняют тесты.
 *
 * Данные приходят как их отдаёт `sdk.getStories(code)`: snake_case из API плюс camelCase-копии,
 * которые SDK дописывает сам (`backgroundColor`, `textInput`, `yOffset`…). Здесь читается
 * snake_case, camelCase — запасной вариант.
 *
 * Номера правил в комментариях (A1…E6) — общие правила сторис V2 для всех четырёх SDK.
 */

import { PERSONALIZATION_COLORS } from '../../constants/colors.constants'
import { popupColor, popupKitScheme } from '../../lib/popupsV3/values'

/** Длительность слайда по умолчанию, с — если сервер её не прислал или прислал 0 (A7). */
export const STORY_DEFAULT_DURATION = 10

/** Непустая строка. */
export const hasText = (value) => typeof value === 'string' && value.trim().length > 0

/**
 * Пропсы без перечисленных: так компоненты кита отбрасывают пропсы v3 — их принимает только шлюз
 * internal/v3.
 */
export function withoutProps(props, names) {
  const rest = { ...(props || {}) }
  names.forEach((name) => delete rest[name])
  return rest
}

/**
 * Число из значения API: число как есть, строка — десятичная дробь (C10: никогда не целое
 * отсечением). Пробелы-разделители тысяч убираются, запятая считается десятичной точкой,
 * хвост с валютой отбрасывается: `"19 990.50 ₽"` → 19990.5, `"12,5"` → 12.5. Не число — `null`.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
export function toDecimal(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const text = value.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  const match = /-?\d+(?:\.\d+)?/.exec(text)
  if (!match) return null
  const n = parseFloat(match[0])
  return Number.isFinite(n) ? n : null
}

const toNumber = (value) => toDecimal(value) ?? 0

/**
 * Процент без лишних нулей, дробная часть сохраняется (C10): 28 → `"28"`, 12.5 → `"12.5"`,
 * 33.333… → `"33.33"`.
 */
export function formatPercent(value) {
  const n = toDecimal(value)
  if (n === null) return ''
  return String(Math.round(n * 100) / 100)
}

/**
 * Делит отформатированную цену на сумму и валюту: валюта — хвост без цифр после последней цифры.
 * `"1 190 900 ₽"` → `{ amount: "1 190 900", currency: "₽" }`. Валюта спереди (`"$140"`) не
 * отделяется: такая строка целиком уходит в сумму.
 *
 * @param {string|number|null|undefined} formatted
 * @returns {{ amount: string, currency: string }}
 */
export function splitCurrency(formatted) {
  const text = formatted === null || formatted === undefined ? '' : String(formatted).trim()
  const match = /^(.*\d)\s*(\D+)$/.exec(text)
  if (!match) return { amount: text, currency: '' }
  return { amount: match[1], currency: match[2].trim() }
}

/** Кегль кода в блоке промокода и нижняя граница, до которой длинный код ужимается. */
export const STORY_PROMO_CODE_SIZE = 24
export const STORY_PROMO_CODE_MIN_SIZE = 14
/** Поля блока промокода слева и справа. */
const PROMO_PADDING = 16
/** Больше этой доли ряда блок промокода не забирает — остальное цене (как на Android). */
const MAX_PROMO_SHARE = 0.65

/**
 * Ширина блока промокода и кегль кода. Блок делит ряд с ценой поровну, длинный код берёт сколько
 * ему нужно на кегле 24, но не больше 65 % ряда; не влез и так — кегль ужимается пропорционально,
 * не ниже 14. Без ужатия цена слева резалась до «9 … ₽».
 *
 * @param {number} rowWidth ширина всей плашки цены
 * @param {number} codeWidth ширина кода на кегле 24 без полей
 * @returns {{ width: number, fontSize: number }}
 */
export function storyPromoLayout(rowWidth, codeWidth) {
  const needed = codeWidth + PROMO_PADDING * 2
  const width = Math.round(Math.min(Math.max(needed, rowWidth / 2), rowWidth * MAX_PROMO_SHARE))
  const room = width - PROMO_PADDING * 2
  if (codeWidth <= room) return { width, fontSize: STORY_PROMO_CODE_SIZE }
  const fitted = Math.floor((STORY_PROMO_CODE_SIZE * room) / codeWidth)
  return { width, fontSize: Math.max(STORY_PROMO_CODE_MIN_SIZE, fitted) }
}

/** Цена товара строкой: `price_formatted`, иначе число с валютой. */
function regularPriceText(item) {
  if (hasText(item.price_formatted)) return item.price_formatted
  const price = toDecimal(item.price)
  return `${price ?? ''} ${item.currency || ''}`.trim()
}

/**
 * Что показывает плашка цены на товарном слайде (C10).
 *
 * - Промокод → `promoCode`: крупно — цена по промокоду (`price_with_promocode_formatted`),
 *   зачёркнута — `oldprice`, если она больше обычной цены, иначе обычная цена, когда она выше
 *   цены по промокоду (F10).
 * - Иначе `discount_percent` > 0 → `discount` с процентом, дробная часть сохраняется («12.5%»).
 * - Иначе `price`.
 * Старая цена что-то значит, только если она численно больше ОБЫЧНОЙ цены (F10); числа
 * сравниваются как десятичные дроби.
 *
 * `slidePromo` — промокод текстового блока того же слайда (H2): сами блоки на товарном слайде
 * не рисуются, а код идёт в плашку цены, как в макете, если у товара своего нет. Цена тогда
 * обычная, зачёркнута только старая (H3).
 *
 * @param {object} product товар из элемента `product` (`item`)
 * @param {string} [slidePromo] промокод текстового блока слайда
 * @returns {{ type: 'price'|'discount'|'promoCode', price: string, oldPrice?: string,
 *             discount?: string, promoCode?: string }}
 */
export function storyPriceView(product, slidePromo) {
  const item = product || {}
  const regular = toDecimal(item.price)
  const old = toDecimal(item.oldprice)
  const regularText = regularPriceText(item)

  if (hasText(item.promocode)) {
    const promoText = hasText(item.price_with_promocode_formatted) ? item.price_with_promocode_formatted : null
    const promo = promoText ? toDecimal(item.price_with_promocode) ?? toDecimal(promoText) : regular
    const view = { type: 'promoCode', price: promoText || regularText, promoCode: item.promocode.trim() }
    if (old !== null && regular !== null && old > regular && hasText(item.oldprice_formatted)) {
      view.oldPrice = item.oldprice_formatted
    } else if (promoText && hasText(regularText)) {
      // Обычная цена зачёркнута, только когда она выше цены по промокоду (как на остальных
      // платформах); без чисел — когда строки различаются.
      const higher = regular !== null && promo !== null ? regular > promo : regularText.trim() !== promoText.trim()
      if (higher) view.oldPrice = regularText
    }
    return view
  }

  const view = { type: 'price', price: regularText }
  if (old !== null && regular !== null && old > regular && hasText(item.oldprice_formatted)) {
    view.oldPrice = item.oldprice_formatted
  }
  if (hasText(slidePromo)) return { ...view, type: 'promoCode', promoCode: slidePromo.trim() }
  const discount = toDecimal(item.discount_percent)
  if (discount !== null && discount > 0) {
    view.type = 'discount'
    view.discount = `${formatPercent(discount)}%`
  }
  return view
}

/**
 * Подпись над промокодом (C9): `title` элемента `product` из админки, если он не пустой, иначе
 * текст хоста.
 */
export function storyPromoCaption(element, fallback) {
  const title = element && element.title
  return hasText(title) ? title.trim() : fallback
}

/**
 * Товар из сторис → данные карточки кита (карусель «Used products»). Строки — как их отформатировал
 * сервер; старая цена — только численно больше цены; скидка — бейдж «-N%» (дробная часть
 * сохраняется), только когда есть старая цена.
 */
export function storyCardProduct(product, index = 0) {
  const item = product || {}
  const price = toDecimal(item.price)
  const old = toDecimal(item.oldprice)
  const hasOld = old !== null && price !== null && old > price && hasText(item.oldprice_formatted)
  const percent = toNumber(item.discount_percent) || toNumber(item.discount)
  const imageUrl = item.picture || item.image_url || null
  return {
    id: item.id !== undefined && item.id !== null ? String(item.id) : String(index),
    name: item.name || '',
    price: regularPriceText(item),
    source: imageUrl ? { uri: imageUrl } : undefined,
    brand: item.brand || undefined,
    oldPrice: hasOld ? item.oldprice_formatted : undefined,
    discount: hasOld && percent > 0 ? `-${formatPercent(percent)}%` : undefined,
  }
}

/**
 * Остаток до `endTime` по единицам. Отрицательный остаток — нули.
 *
 * @param {number} msLeft
 * @returns {{ days: number, hours: number, minutes: number, seconds: number }}
 */
export function timerUnits(msLeft) {
  const total = Math.max(0, Math.floor(toNumber(msLeft) / 1000))
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

/**
 * Числа таймера строками: дни как есть, часы, минуты и секунды — двумя цифрами
 * (`2d 08h 05m 09s`).
 *
 * @param {number} msLeft
 * @returns {{ days: string, hours: string, minutes: string, seconds: string }}
 */
export function timerText(msLeft) {
  const units = timerUnits(msLeft)
  const two = (n) => String(n).padStart(2, '0')
  return {
    days: String(units.days),
    hours: two(units.hours),
    minutes: two(units.minutes),
    seconds: two(units.seconds),
  }
}

/** Мс до конца: `endTime` — Date, число мс или строка ISO. */
export function timerRemaining(endTime, now = Date.now()) {
  const end = endTime instanceof Date ? endTime.getTime() : typeof endTime === 'string' ? Date.parse(endTime) : endTime
  return Number.isFinite(end) ? Math.max(0, end - now) : 0
}

/**
 * Прозрачность с сервера: `"0%"`…`"100%"`, число 0…100 или доля 0…1. Нет значения — 1.
 * @returns {number} 0…1
 */
export function parseOpacity(value) {
  if (value === undefined || value === null || value === '') return 1
  const text = String(value).trim()
  const n = parseFloat(text)
  if (!Number.isFinite(n)) return 1
  const fraction = text.endsWith('%') || n > 1 ? n / 100 : n
  return Math.max(0, Math.min(1, fraction))
}

/**
 * Прозрачность фона текст-блока сторис v3 — как `calculateOpacity` JS SDK (R4): число — проценты,
 * строкой или числом, с `%` и без (`"50"`, `"50%"`, `50` → 0.5, `"0.5"` → 0.005); ложное значение (нет
 * значения, `""`, число `0`, `false` — у JS `!opacity`), не число или вне 0…100 — цвет как есть, без
 * прозрачности (1). Прозрачный фон — только строкой: `"0"` или `"0%"`.
 * @returns {number} 0…1
 */
export function storyV3Opacity(value) {
  const opacity = storyV3OpacityValue(value)
  return opacity === null ? 1 : opacity
}

/** Прозрачность сторис v3, если она задана верно (`storyV3Opacity`), иначе `null`. */
function storyV3OpacityValue(value) {
  if (!value) return null
  const n = parseFloat(String(value).trim())
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n / 100
}

/**
 * Фон текст-блока сторис v3 и его прозрачность. Верная прозрачность (`storyV3Opacity`) заменяет альфу
 * самого цвета (`#RRGGBBAA`, `rgba()`): цвет берётся непрозрачным, прозрачность — заданная. Без неё у
 * цвета остаётся своя альфа. Цвет, который не разобрал `storyColor` (имя, `hsl()`), — как есть.
 *
 * @returns {{ color: string|undefined, opacity: number }}
 */
export function storyV3TextBackground(color, opacityValue) {
  const text = hasText(color) ? color.trim() : undefined
  const opacity = storyV3OpacityValue(opacityValue)
  if (opacity === null) return { color: text, opacity: 1 }
  const parsed = storyColor(text)
  return { color: parsed ? `${parsed.slice(0, 7)}ff` : text, opacity }
}

/** Пресеты кегля текст-блока для хоста: large 48/48, medium 30/36, small 20/24, все Regular. */
export const STORY_TEXT_PRESETS = {
  large: { fontSize: 48, lineHeight: 48 },
  medium: { fontSize: 30, lineHeight: 36 },
  small: { fontSize: 20, lineHeight: 24 },
}

/** Кегль, начиная с которого (строго больше) у сплошного текст-блока поля 12/16, а не 8/16. */
export const STORY_TEXT_LARGE_ABOVE = 30

/**
 * Интерлиньяж текст-блока (C15): кегль × `text_line_spacing`, если сервер его прислал; иначе —
 * пропорция ближайшего по кеглю пресета (48/48 → 1.0, 30/36 и 20/24 → 1.2), пересчитанная на этот
 * кегль. Никогда не берётся интерлиньяж другого кегля.
 *
 * @param {number} fontSize
 * @param {number|string|null|undefined} spacing
 * @returns {number}
 */
export function storyTextLineHeight(fontSize, spacing) {
  const size = toNumber(fontSize) || STORY_TEXT_PRESETS.small.fontSize
  const factor = toNumber(spacing)
  if (factor > 0) return Math.round(size * factor)
  const presets = Object.values(STORY_TEXT_PRESETS)
  const nearest = presets.reduce((best, preset) =>
    Math.abs(preset.fontSize - size) < Math.abs(best.fontSize - size) ? preset : best,
  )
  return Math.round((size * nearest.lineHeight) / nearest.fontSize)
}

/** Выравнивание текста с сервера (C15): left/start, center, right/end. */
export function storyTextAlign(value) {
  const text = String(value || '').trim().toLowerCase()
  if (text === 'center') return 'center'
  if (text === 'right' || text === 'end') return 'right'
  return 'left'
}

/**
 * Рамка текст-блока. Сплошной — фон виден (есть цвет и прозрачность > 0): радиус 12, поля 12/16
 * у крупного текста (кегль больше 30 — общее правило всех SDK) и 8/16 у остального. Прозрачный —
 * без полей и без фона.
 *
 * @param {{ backgroundColor?: string|null, backgroundOpacity?: number, fontSize?: number }} block
 * @returns {{ solid: boolean, paddingVertical: number, paddingHorizontal: number, radius: number }}
 */
export function storyTextFrame({ backgroundColor, backgroundOpacity = 1, fontSize } = {}) {
  const solid = isVisibleColor(backgroundColor) && toNumber(backgroundOpacity) > 0
  if (!solid) return { solid: false, paddingVertical: 0, paddingHorizontal: 0, radius: 0 }
  const large = toNumber(fontSize) > STORY_TEXT_LARGE_ABOVE
  return { solid: true, paddingVertical: large ? 12 : 8, paddingHorizontal: 16, radius: 12 }
}

/** Цвет виден: не пустой, не `transparent`, у rgba/hsla и #RRGGBBAA альфа больше нуля. */
export function isVisibleColor(color) {
  if (!hasText(color)) return false
  const text = color.trim().toLowerCase()
  if (text === 'transparent' || text === 'clear') return false
  const alpha = /^(?:rgba|hsla)\([^)]*,\s*([\d.]+%?)\s*\)$/.exec(text)
  if (alpha) return parseFloat(alpha[1]) > 0
  if (/^#[0-9a-f]{8}$/.test(text)) return parseInt(text.slice(7, 9), 16) > 0
  if (/^#[0-9a-f]{4}$/.test(text)) return parseInt(text[4], 16) > 0
  return true
}

const pick = (element, snake, camel) => (element[snake] !== undefined ? element[snake] : element[camel])

/** Кегль текст-блока сторис v3 без своего — основной текст кита (Base, 16; у JS — кегль страницы). */
export const STORY_TEXT_V3_FONT_SIZE = 16

/** Признак жирности или курсива: `true`, `1` или `"true"`. */
const isOn = (value) => value === true || value === 1 || value === 'true'

/** Первое заданное значение из ключей элемента. */
const firstOf = (element, keys) => {
  for (const key of keys) if (element[key] !== undefined && element[key] !== null) return element[key]
  return undefined
}

/**
 * Элемент `text_block` → пропсы StoryTextBlock плюс положение на слайде (`yOffset`, % высоты) и
 * промокод (C12). Фон — `text_background_color` как есть и его прозрачность отдельно
 * (`backgroundOpacity` из `text_background_color_opacity`: `"NN%"`, число 0–100 или доля 0–1; у сторис
 * v3 — проценты всегда, как JS, `storyV3Opacity`): блок
 * кладёт её на подложку, так что годится любой цвет, который понимает React Native, — hex, rgb(),
 * именованный. Кегля нет — 20 (small), у сторис v3 — основной текст кита (R4); интерлиньяж —
 * storyTextLineHeight (C15). Жирность — `bold`, курсив — `italic`; у сторис v3 ещё и старые
 * `text_bold` / `text_italic` (R4). Пустой текст — `null` (C15: такие блоки пропускаются).
 *
 * @param {object} element
 * @param {boolean} [v3] сторис из ленты API v3
 */
export function storyTextBlockProps(element, v3 = false) {
  const el = element || {}
  const text = pick(el, 'text_input', 'textInput')
  if (!hasText(text)) return null
  const fontSize = toNumber(pick(el, 'font_size', 'fontSize')) || (v3 ? STORY_TEXT_V3_FONT_SIZE : STORY_TEXT_PRESETS.small.fontSize)
  const rawOpacity = pick(el, 'text_background_color_opacity', 'textBackgroundColorOpacity')
  const rawBackground = pick(el, 'text_background_color', 'textBackgroundColor')
  // У сторис v3 верная прозрачность заменяет альфу цвета (`storyV3TextBackground`).
  const v3Background = v3 ? storyV3TextBackground(rawBackground, rawOpacity) : null
  const opacity = v3Background ? v3Background.opacity : parseOpacity(rawOpacity)
  const background = v3Background ? v3Background.color : rawBackground
  const visible = isVisibleColor(background) && opacity > 0
  const bold = v3 ? firstOf(el, ['bold', 'text_bold', 'textBold']) : pick(el, 'bold', 'textBold')
  const italic = v3 ? firstOf(el, ['italic', 'text_italic', 'textItalic']) : pick(el, 'italic', 'textItalic')
  const y = pick(el, 'y_offset', 'yOffset')
  const color = pick(el, 'text_color', 'textColor')
  const fontType = pick(el, 'font_type', 'fontType')
  const promocode = pick(el, 'promocode', 'promoCode')
  return {
    text,
    fontSize,
    lineHeight: storyTextLineHeight(fontSize, pick(el, 'text_line_spacing', 'textLineSpacing')),
    color: hasText(color) ? color : undefined,
    backgroundColor: visible ? background.trim() : undefined,
    backgroundOpacity: visible ? opacity : undefined,
    align: storyTextAlign(pick(el, 'text_align', 'textAlignment')),
    bold: v3 ? isOn(bold) : bold === true || bold === 'true',
    italic: v3 ? isOn(italic) : italic === true || italic === 'true',
    fontType: hasText(fontType) ? fontType : undefined,
    yOffset: y === undefined || y === null || y === '' ? undefined : Math.max(0, Math.min(100, toNumber(y))),
    promocode: hasText(promocode) ? promocode.trim() : undefined,
  }
}

const elementsOf = (slide) => (Array.isArray(slide?.elements) ? slide.elements.filter(Boolean) : [])

/**
 * Слайд с фото или видео: медиа вписывается целиком, слайд рисуется тёмными токенами (C1). У старой
 * ленты — тот, у которого непустой `background` (F9; один `type` ничего не решает); у сторис v3 — по
 * `type` `image` или `video`, как в JS SDK (R6).
 *
 * @param {object} slide
 * @param {boolean} [v3] сторис из ленты API v3
 */
export function isMediaSlide(slide, v3 = false) {
  if (!slide) return false
  if (v3) return slide.type === 'image' || slide.type === 'video'
  return hasText(slide.background)
}

/**
 * Слайд сторис v3, который пропускается, как в JS SDK (`stories.js`, ветка `default` показа): ни фото,
 * ни видео по `type` и нет элемента `product` — просмотр сразу идёт дальше, `view` не уходит. У старой
 * ленты пропусков нет.
 */
export function isSkippedSlide(slide, v3 = false) {
  return !!v3 && !!slide && !isMediaSlide(slide, true) && !slideProductElement(slide)
}

/** Видео-слайд: медиа-слайд с `type` `video`; иначе медиа — картинка. */
export function isVideoSlide(slide, v3 = false) {
  return isMediaSlide(slide, v3) && slide.type === 'video'
}

/** Элемент `product` слайда (с товаром в `item`), если он есть. */
export function slideProductElement(slide) {
  return elementsOf(slide).find((el) => el.type === 'product' && (el.item || el.product)) || null
}

/** Товар слайда из элемента `product` (`item`), если он есть. */
export function slideProduct(slide) {
  const element = slideProductElement(slide)
  return element ? element.item || element.product : null
}

/**
 * Элемент `header` слайда (иконка, заголовок, подзаголовок, ссылка) — его рисуют сторис v3, как JS SDK
 * (R1); без заголовка, подзаголовка и иконки — `null`.
 */
export function slideHeaderElement(slide) {
  return (
    elementsOf(slide).find(
      (el) => el.type === 'header' && (hasText(el.title) || hasText(el.subtitle) || hasText(el.icon)),
    ) || null
  )
}

/** Кнопки слайда с непустой подписью, по порядку (C8: на товарном слайде — все, стопкой). */
export function slideButtons(slide) {
  return elementsOf(slide).filter((el) => el.type === 'button' && hasText(el.title))
}

/** Элемент `products` с товарами («Used products»), если он есть. */
export function slideProductsElement(slide) {
  return elementsOf(slide).find((el) => el.type === 'products' && Array.isArray(el.products) && el.products.length) || null
}

/** Элементы `poll` слайда (API v3) как пришли; разбор и виды — `slidePolls` в storyPollSupport. */
export function slidePollElements(slide) {
  return elementsOf(slide).filter((el) => el && typeof el === 'object' && el.type === 'poll')
}

/**
 * Текст-блоки слайда, уже разобранные, без пустых (C15). На товарном слайде их нет (C8):
 * там рисуется карточка товара.
 */
/**
 * Промокод слайда для плашки цены товара (H2): первый текстовый блок с непустым кодом
 * (буквальное `"null"` не код).
 */
export function slidePromocode(slide) {
  for (const el of elementsOf(slide)) {
    if (el.type !== 'text_block') continue
    const code = pick(el, 'promocode', 'promoCode')
    if (hasText(code) && code.trim() !== 'null') return code.trim()
  }
  return undefined
}

export function slideTextBlocks(slide, v3 = false) {
  if (slideProductElement(slide)) return []
  return elementsOf(slide)
    .filter((el) => el.type === 'text_block')
    .map((el) => {
      const props = storyTextBlockProps(el, v3)
      return props ? { ...props, element: el } : null
    })
    .filter(Boolean)
}

/**
 * Область текст-блоков слайда от его верха: верх содержимого (`contentTop`, под безопасной зоной), в
 * нём верх тела слайда (`bodyTop` — под шапкой и строкой элемента `header`, по замеру) и в теле
 * свободное место над кнопками (`free`: `{ y, height }` от верха тела). Чего-то ещё не измерили —
 * `null`, блоки ждут.
 *
 * @returns {{ top: number, bottom: number } | null}
 */
export function storyTextRegion(contentTop, bodyTop, free) {
  if (typeof contentTop !== 'number' || typeof bodyTop !== 'number' || !free) return null
  const top = contentTop + bodyTop + free.y
  return { top, bottom: top + Math.max(0, free.height) }
}

/**
 * Скрим сверху и снизу — на каждом слайде (C3): 50 % только у медиа-слайда без товара и без
 * непустых текст-блоков, иначе 30 %.
 */
export function storySlideScrim(slide, v3 = false) {
  if (!isMediaSlide(slide, v3) || slideProductElement(slide)) return 0.3
  return slideTextBlocks(slide, v3).length > 0 ? 0.3 : 0.5
}

/**
 * Фон слайда (C1, C2): у медиа-слайда — поля вокруг вписанного медиа, `background_color` или
 * чёрный; у слайда без фото и видео — `null`, то есть Background/Card темы приложения
 * (`background_color` там не берётся). У сторис v3 `background_color` красит любой слайд, как в JS
 * SDK (R2): без медиа — вместо цвета карточки кита, пустой — карточка кита.
 */
export function storySlideLetterbox(slide, v3 = false) {
  const color = slide ? slide.background_color ?? slide.backgroundColor : null
  if (v3 && !isMediaSlide(slide, v3)) return hasText(color) ? color.trim() : null
  if (!isMediaSlide(slide, v3)) return null
  return hasText(color) ? color.trim() : '#000000'
}

/**
 * Цвет из данных сторис — один разбор на весь SDK сторис (фон слайда, заливки карточки опроса):
 * `#RGB`, `#RRGGBB`, `#RRGGBBAA` (альфа последней) и `rgb()` / `rgba()` (через запятые или пробелы, с
 * альфой после `/`) → `#rrggbbaa` в нижнем регистре; остальное (имена, `#RGBA`, пусто) — `null`. Сам
 * разбор — `popupColor` попапов v3.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function storyColor(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text) && !/^rgba?\(/i.test(text)) return null
  return popupColor(text)
}

/** Непрозрачный цвет `#rrggbbff`: `color` (`#rrggbbaa`) со своей альфой поверх непрозрачного `under`. */
function storyColorOver(color, under) {
  const channels = (value) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16))
  const alpha = parseInt(color.slice(7, 9), 16) / 255
  const base = channels(under)
  const mixed = channels(color).map((channel, index) => Math.round(channel * alpha + base[index] * (1 - alpha)))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}ff`
}

/** Основной текст светлой и тёмной схем кита — по нему выбирается схема на цвете (R2). */
const KIT_TEXT_PRIMARY = Object.freeze({
  light: PERSONALIZATION_COLORS.light.textPrimary,
  dark: PERSONALIZATION_COLORS.dark.textPrimary,
})

/**
 * Схема кита на цвете (`storyColor`): из светлой и тёмной та, чей основной текст контрастнее с ним по
 * WCAG (равно — светлая). Полупрозрачный цвет ложится на чёрный — фон просмотра под слайдом. Не цвет —
 * `null`.
 *
 * @param {unknown} color
 * @param {{ light: string, dark: string }} [textPrimary] основной текст светлой и тёмной схем
 * @returns {'dark'|'light'|null}
 */
export function storyColorScheme(color, textPrimary = KIT_TEXT_PRIMARY) {
  const parsed = storyColor(color)
  if (!parsed) return null
  return popupKitScheme(storyColorOver(parsed, '#000000ff'), textPrimary)
}

/**
 * Схема токенов слайда: медиа — тёмная (C1); слайд сторис v3 без медиа со своим `background_color` —
 * та схема кита, чей текст контрастнее с этим цветом по WCAG (R2, `storyColorScheme`); иначе `null` —
 * схема приложения.
 *
 * @returns {'dark'|'light'|null}
 */
export function storySlideScheme(slide, v3 = false) {
  if (isMediaSlide(slide, v3)) return 'dark'
  if (!v3) return null
  return storyColorScheme(storySlideLetterbox(slide, v3))
}

/**
 * Есть ли у видео звук — по дорожкам, которые перечислил плеер (`audioTracks` из `onLoad`
 * react-native-video), для кнопки звука сторис v3 (R9): дорожки есть — `true`; список пуст на Android —
 * `false` (ExoPlayer перечисляет дорожки файла); пуст на iOS или списка нет — `null`, неизвестно: iOS
 * строит список из группы выбора аудио (AVMediaSelectionGroup), а у обычного MP4 её нет и со звуком.
 *
 * @param {unknown} audioTracks
 * @param {string} os `Platform.OS`
 * @returns {boolean|null}
 */
export function storyVideoHasAudio(audioTracks, os) {
  if (!Array.isArray(audioTracks)) return null
  if (audioTracks.length > 0) return true
  return os === 'android' ? false : null
}

/**
 * Кнопка звука видео-слайда: у старой ленты — всегда; у сторис v3 — когда плеер сказал, что звук есть
 * или что не знает (`storyVideoHasAudio` → `true` / `null`); пока видео не загрузилось (`undefined`) и
 * когда звука точно нет (`false`) — нет (и места не занимает).
 *
 * @param {boolean|null|undefined} audio
 * @param {boolean} v3
 */
export function storySoundButtonShown(audio, v3) {
  if (!v3) return true
  return audio === true || audio === null
}

/**
 * Что слайду нужно загрузить, прежде чем пойдут часы (C5): у медиа-слайда — картинку `background`, у
 * видео — сам ролик (или превью, когда плеера нет). Нечего грузить (в том числе у слайда v3 с `type`
 * медиа без адреса) — `false`.
 *
 * @param {object} slide
 * @param {boolean} [canPlayVideo] установлен ли плеер
 * @param {boolean} [v3] сторис из ленты API v3
 */
export function slideNeedsMedia(slide, canPlayVideo = true, v3 = false) {
  if (!isMediaSlide(slide, v3)) return false
  if (isVideoSlide(slide, v3)) return (canPlayVideo && hasText(slide.background)) || hasText(slide.preview)
  return hasText(slide.background)
}

/** Длительность слайда, с: из админки, иначе (нет или 0) — 10 (A7). У видео — его длина (C4). */
export function slideDuration(slide) {
  const seconds = toNumber(slide?.duration)
  return seconds > 0 ? seconds : STORY_DEFAULT_DURATION
}

/** Id слайдов сторис строками, по порядку. */
export function storySlideIds(story) {
  return (Array.isArray(story?.slides) ? story.slides : []).map((slide) => String(slide?.id))
}

const seenSet = (seenIds) => (seenIds instanceof Set ? seenIds : new Set((seenIds || []).map(String)))

/** Сторис просмотрена (A3): так сказал сервер или видны все её слайды. */
export function storyIsViewed(story, seenIds) {
  if (story?.viewed === true) return true
  const ids = storySlideIds(story)
  const seen = seenSet(seenIds)
  return ids.length > 0 && ids.every((id) => seen.has(id))
}

/** `start_position` сервера, зажатый в границы слайдов. */
export function storyStartIndex(story) {
  const count = story?.slides?.length || 0
  if (count === 0) return 0
  const start = Math.floor(toNumber(story.start_position ?? story.startPosition))
  return Math.max(0, Math.min(count - 1, start))
}

/**
 * С какого слайда открыть сторис (A4) — из ленты, программно и при переходе в соседнюю: часть
 * слайдов видна — с первого невиденного по порядку; не видно ничего — `start_position` сервера;
 * просмотрена — с начала.
 *
 * @param {object} story
 * @param {Iterable<string>|Set<string>} seenIds id показанных слайдов этой сторис
 */
export function storyStartSlide(story, seenIds) {
  const ids = storySlideIds(story)
  if (ids.length === 0) return 0
  const seen = seenSet(seenIds)
  if (storyIsViewed(story, seen)) return 0
  if (ids.some((id) => seen.has(id))) return Math.max(0, ids.findIndex((id) => !seen.has(id)))
  return storyStartIndex(story)
}

/**
 * Индекс сторис с этим id в списке, иначе `-1`. С `fallbackToFirst` (показ без ленты, F12)
 * неизвестный или не заданный id — первая сторис, если список не пуст.
 *
 * @param {Array<object>} stories
 * @param {string|number|null|undefined} id
 * @param {boolean} [fallbackToFirst]
 */
export function storyIndexForId(stories, id, fallbackToFirst = false) {
  const list = Array.isArray(stories) ? stories : []
  const index = id === undefined || id === null ? -1 : list.findIndex((story) => String(story?.id) === String(id))
  if (index >= 0 || !fallbackToFirst) return index
  return list.length > 0 ? 0 : -1
}

/**
 * Обложка в ленте (A5). Закреплённая — всегда кольцо Semantic/Warning со звездой, и после
 * просмотра; просмотренная — сплошное кольцо без сегментов (у незакреплённой — Neutral Subtle,
 * у закреплённой — сплошное предупреждающее, без отмеченных сегментов). Иначе кольцо делится по
 * слайдам, и сегмент i отмечен, если показан слайд i (по индексу, не по счёту).
 *
 * @returns {{ state: 'default'|'pinned'|'viewed', segments: number, seenSegments: number[] }}
 */
export function storyCoverRing(story, seenIds) {
  const seen = seenSet(seenIds)
  const viewed = storyIsViewed(story, seen)
  const state = story?.pinned ? 'pinned' : viewed ? 'viewed' : 'default'
  if (viewed) return { state, segments: 1, seenSegments: [] }
  const ids = storySlideIds(story)
  return {
    state,
    segments: Math.max(1, ids.length),
    seenSegments: ids.reduce((list, id, index) => (seen.has(id) ? [...list, index] : list), []),
  }
}

/**
 * Ссылка элемента под платформу: `link_android` / `link_ios`, иначе `link`. У товара —
 * `deeplink_android` / `deeplink_ios`, иначе `url`.
 *
 * @param {object} element кнопка или товар
 * @param {'android'|'ios'|string} os
 */
export function storyLink(element, os) {
  const el = element || {}
  const android = os === 'android'
  const candidates = android
    ? [el.link_android, el.linkAndroid, el.deeplink_android, el.deeplinkAndroid, el.link, el.url]
    : [el.link_ios, el.linkIos, el.deeplink_ios, el.deeplinkIos, el.link, el.url]
  const found = candidates.find(hasText)
  return found ? found.trim() : null
}

/**
 * Куда ведёт кнопка слайда (C11): своя ссылка (сперва платформенная, потом `link`); кнопка без
 * ссылки на товарном слайде открывает товар (у сторис v3 — нет, как в JS SDK, R5: товар не передают).
 * Вести некуда — `null`.
 *
 * @param {object} button элемент `button`
 * @param {object|null} product товар слайда, если слайд товарный
 * @param {'android'|'ios'|string} os
 * @returns {{ kind: 'link', url: string } | { kind: 'product', product: object } | null}
 */
export function storyButtonTarget(button, product, os) {
  const el = button || {}
  const own = [os === 'android' ? el.link_android ?? el.linkAndroid : el.link_ios ?? el.linkIos, el.link].find(hasText)
  if (own) return { kind: 'link', url: own.trim() }
  return product ? { kind: 'product', product } : null
}

/**
 * Id, который примет `track/stories` (A6): целое положительное число (или строка из него). У
 * динамических товарных слайдов id вида `39_0` — такие не трекаются.
 */
export function isTrackableId(id) {
  if (typeof id === 'number') return Number.isInteger(id) && id > 0
  if (typeof id !== 'string' || !/^\d+$/.test(id.trim())) return false
  return Number(id) > 0
}

/**
 * Отмечает показанный слайд. `seen` — `{ [storyId]: slideId[] }`; возвращается новый объект,
 * если слайд новый, и тот же — если он уже был отмечен.
 */
export function withSlideSeen(seen, storyId, slideId) {
  const key = String(storyId)
  const id = String(slideId)
  const list = (seen && seen[key]) || []
  if (list.includes(id)) return seen
  return { ...(seen || {}), [key]: [...list, id] }
}

/**
 * Сторис, которые можно показать: со слайдами (C16) и без повторов id — сервер иногда отдаёт
 * одну сторис дважды; остаётся первая, иначе ключи списка и просмотренность по id склеиваются.
 *
 * @param {object[] | null | undefined} stories сторис из ответа `getStories`
 * @returns {object[]}
 */
export function playableStories(stories) {
  const ids = new Set()
  return (Array.isArray(stories) ? stories : []).filter((story) => {
    if (!Array.isArray(story?.slides) || story.slides.length === 0) return false
    const id = String(story.id)
    if (ids.has(id)) return false
    ids.add(id)
    return true
  })
}

/** Параметры ссылки «Поделиться»: блок, кампания и слайд (как у JS SDK). */
export const STORY_SHARE_PARAMS = Object.freeze({ code: 'r46_stories', story: 'r46_story', slide: 'r46_slide' })

const SHARE_STORY_ID = /^\d{1,10}$/
// Слайд — число или виртуальный слайд товарной кампании `{story_id}_{index}`.
const SHARE_SLIDE_ID = /^\d{1,10}(_\d{1,4})?$/

/**
 * Ссылка «Поделиться» показанного слайда (API v3), как `slideShareUrl` JS SDK (S3): у кампании с
 * `shareable: false` — нет; иначе своя ссылка слайда, без неё — ссылка кампании как есть. Только
 * http(s), регистр схемы не важен; иначе — `null`, и кнопки на слайде нет.
 *
 * @param {object} story
 * @param {object} slide
 * @returns {string|null}
 */
export function storyShareUrl(story, slide) {
  if (!story || story.shareable === false) return null
  const url = (slide && slide.share_url) || story.share_url
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null
}

/**
 * Слайд, с которого кампания по ссылке «Поделиться» открывается: слайд ссылки (`r46_slide`), если он
 * в ней есть, иначе `start_position` сервера. Сервер ставит `start_position` только по своим слайдам —
 * виртуальные слайды товарных кампаний (`39_2`) он не знает.
 *
 * @param {object} story
 * @param {string|null|undefined} slideId
 * @returns {number}
 */
export function storyLinkStartIndex(story, slideId) {
  if (slideId !== null && slideId !== undefined && slideId !== '') {
    const slides = Array.isArray(story?.slides) ? story.slides : []
    const index = slides.findIndex((slide) => slide && String(slide.id) === String(slideId))
    if (index >= 0) return index
  }
  return storyStartIndex(story)
}

/**
 * Ссылка для системного окна «Поделиться»: `transform` хоста (например, своя схема приложения
 * вместо `https://`), без него — как есть. Ошибка, пустой или не строковый результат — исходная.
 *
 * @param {string} url
 * @param {((url: string) => string) | undefined} transform
 * @returns {string}
 */
export function storyShareTarget(url, transform) {
  if (typeof transform !== 'function') return url
  try {
    const next = transform(url)
    return typeof next === 'string' && next.trim().length > 0 ? next : url
  } catch (error) {
    return url
  }
}

/**
 * Ссылка «Поделиться» сторис: `…?r46_stories=<code>&r46_story=<id>[&r46_slide=<id>]`, другие
 * параметры не мешают. Разбор как у JS SDK (`parseShareLink`): блок непустой, кампания — до 10
 * цифр; неверный слайд — `null`, кампания всё равно открывается. Не ссылка сторис — `null`.
 *
 * @param {string} url
 * @returns {{ code: string, storyId: number, slideId: string|null } | null}
 */
export function parseStoriesShareLink(url) {
  const params = queryParams(url)
  const code = params.get(STORY_SHARE_PARAMS.code)
  const storyId = params.get(STORY_SHARE_PARAMS.story)
  if (!code || !storyId || !SHARE_STORY_ID.test(storyId)) return null
  const slideId = params.get(STORY_SHARE_PARAMS.slide)
  return { code, storyId: Number(storyId), slideId: slideId && SHARE_SLIDE_ID.test(slideId) ? slideId : null }
}

/** Ключ ссылки сторис для отсева повторов: блок, кампания и слайд. */
export function storiesShareLinkKey(link) {
  return link ? `${link.code}\n${link.storyId}\n${link.slideId ?? ''}` : ''
}

/**
 * Параметры строки запроса до `#`: первое значение каждого ключа, `+` — пробел, как у
 * `URLSearchParams.get` (URL в React Native реализован не целиком). Битая %-последовательность
 * остаётся как есть.
 *
 * @returns {Map<string, string>}
 */
function queryParams(url) {
  const result = new Map()
  if (typeof url !== 'string') return result
  const hash = url.indexOf('#')
  const base = hash < 0 ? url : url.slice(0, hash)
  const start = base.indexOf('?')
  if (start < 0) return result
  base
    .slice(start + 1)
    .split('&')
    .forEach((pair) => {
      if (!pair) return
      const index = pair.indexOf('=')
      const key = decodeQueryPart(index < 0 ? pair : pair.slice(0, index))
      if (!result.has(key)) result.set(key, decodeQueryPart(index < 0 ? '' : pair.slice(index + 1)))
    })
  return result
}

function decodeQueryPart(part) {
  const text = part.replace(/\+/g, ' ')
  try {
    return decodeURIComponent(text)
  } catch (error) {
    return text
  }
}
