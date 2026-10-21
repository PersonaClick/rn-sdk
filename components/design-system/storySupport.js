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

/** Длительность слайда по умолчанию, с — если сервер её не прислал или прислал 0 (A7). */
export const STORY_DEFAULT_DURATION = 10

/** Непустая строка. */
export const hasText = (value) => typeof value === 'string' && value.trim().length > 0

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

/**
 * Элемент `text_block` → пропсы StoryTextBlock плюс положение на слайде (`yOffset`, % высоты) и
 * промокод (C12). Фон — `text_background_color` как есть и его прозрачность отдельно
 * (`backgroundOpacity` из `text_background_color_opacity`): блок кладёт её на подложку, так что
 * годится любой цвет, который понимает React Native, — hex, rgb(), именованный. Кегля нет — 20
 * (small); интерлиньяж — storyTextLineHeight (C15). Пустой текст — `null` (C15: такие блоки
 * пропускаются).
 */
export function storyTextBlockProps(element) {
  const el = element || {}
  const text = pick(el, 'text_input', 'textInput')
  if (!hasText(text)) return null
  const fontSize = toNumber(pick(el, 'font_size', 'fontSize')) || STORY_TEXT_PRESETS.small.fontSize
  const opacity = parseOpacity(pick(el, 'text_background_color_opacity', 'textBackgroundColorOpacity'))
  const background = pick(el, 'text_background_color', 'textBackgroundColor')
  const visible = isVisibleColor(background) && opacity > 0
  const bold = pick(el, 'bold', 'textBold')
  const italic = pick(el, 'italic', 'textItalic')
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
    bold: bold === true || bold === 'true',
    italic: italic === true || italic === 'true',
    fontType: hasText(fontType) ? fontType : undefined,
    yOffset: y === undefined || y === null || y === '' ? undefined : Math.max(0, Math.min(100, toNumber(y))),
    promocode: hasText(promocode) ? promocode.trim() : undefined,
  }
}

const elementsOf = (slide) => (Array.isArray(slide?.elements) ? slide.elements.filter(Boolean) : [])

/**
 * Слайд с фото или видео — тот, у которого непустой `background` (F9; один `type` ничего не
 * решает): медиа вписывается целиком, слайд рисуется тёмными токенами (C1).
 */
export function isMediaSlide(slide) {
  return !!slide && hasText(slide.background)
}

/** Видео-слайд: медиа-слайд (F9) с `type` `video`; иначе медиа — картинка. */
export function isVideoSlide(slide) {
  return isMediaSlide(slide) && slide.type === 'video'
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

/** Кнопки слайда с непустой подписью, по порядку (C8: на товарном слайде — все, стопкой). */
export function slideButtons(slide) {
  return elementsOf(slide).filter((el) => el.type === 'button' && hasText(el.title))
}

/** Элемент `products` с товарами («Used products»), если он есть. */
export function slideProductsElement(slide) {
  return elementsOf(slide).find((el) => el.type === 'products' && Array.isArray(el.products) && el.products.length) || null
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

export function slideTextBlocks(slide) {
  if (slideProductElement(slide)) return []
  return elementsOf(slide)
    .filter((el) => el.type === 'text_block')
    .map((el) => {
      const props = storyTextBlockProps(el)
      return props ? { ...props, element: el } : null
    })
    .filter(Boolean)
}

/**
 * Скрим сверху и снизу — на каждом слайде (C3): 50 % только у медиа-слайда без товара и без
 * непустых текст-блоков, иначе 30 %.
 */
export function storySlideScrim(slide) {
  if (!isMediaSlide(slide) || slideProductElement(slide)) return 0.3
  return slideTextBlocks(slide).length > 0 ? 0.3 : 0.5
}

/**
 * Фон слайда (C1, C2): у медиа-слайда — поля вокруг вписанного медиа, `background_color` или
 * чёрный; у слайда без фото и видео — `null`, то есть Background/Card темы приложения
 * (`background_color` там не берётся).
 */
export function storySlideLetterbox(slide) {
  if (!isMediaSlide(slide)) return null
  const color = slide.background_color ?? slide.backgroundColor
  return hasText(color) ? color.trim() : '#000000'
}

/**
 * Что слайду нужно загрузить, прежде чем пойдут часы (C5): у медиа-слайда (F9) — картинку
 * `background`, у видео — сам ролик (или превью, когда плеера нет). Нечего грузить — `false`.
 *
 * @param {object} slide
 * @param {boolean} [canPlayVideo] установлен ли плеер
 */
export function slideNeedsMedia(slide, canPlayVideo = true) {
  if (!isMediaSlide(slide)) return false
  if (isVideoSlide(slide)) return canPlayVideo || hasText(slide.preview)
  return true
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
 * ссылки на товарном слайде открывает товар. Вести некуда — `null`.
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
