/**
 * Разбор значений документа design попапов v3: числа, булевы, строки и CSS-цвета. Чистые функции
 * без React — их гоняют тесты на общих фикстурах (`parsing.json`).
 *
 * Числа и цвета в JSON дизайна могут приходить строками и `null`: значение приводится, а не
 * подошло — берётся запасное, как `Context#num` / `Context#color` компилятора на бэке.
 */

/** Значения нет: `null`, `undefined` или строка из одних пробелов (как `blank?` в Ruby). */
export const isBlank = (value) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0)

/**
 * Число: число как есть, строка — как `parseFloat` (`"12"`, `" 7 "`, `"12px"` → 12); остальное
 * (пусто, `null`, не число, булево) — `fallback`.
 */
export function popupNum(value, fallback) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'string') {
    const n = parseFloat(value.trim())
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

/** Булево: `true` / `"true"` / `1` — да, `false` / `"false"` / `0` — нет, иначе `null`. */
export function popupBool(value) {
  if (value === true || value === 1 || value === 'true') return true
  if (value === false || value === 0 || value === 'false') return false
  return null
}

/** Строка: строка как есть, конечное число — его запись, остальное — пустая строка. */
export function popupStr(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/** Одно из допустимых значений или `fallback`. */
export const popupEnum = (value, allowed, fallback) => (allowed.indexOf(value) !== -1 ? value : fallback)

// 148 именованных цветов CSS: «имя:rrggbb» через пробел.
const NAMED_SOURCE =
  'aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc ' +
  'bisque:ffe4c4 black:000000 blanchedalmond:ffebcd blue:0000ff blueviolet:8a2be2 brown:a52a2a ' +
  'burlywood:deb887 cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 ' +
  'cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c cyan:00ffff darkblue:00008b darkcyan:008b8b ' +
  'darkgoldenrod:b8860b darkgray:a9a9a9 darkgreen:006400 darkgrey:a9a9a9 darkkhaki:bdb76b ' +
  'darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 ' +
  'darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b darkslategray:2f4f4f ' +
  'darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 deepskyblue:00bfff ' +
  'dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222 floralwhite:fffaf0 ' +
  'forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 ' +
  'goldenrod:daa520 gray:808080 green:008000 greenyellow:adff2f grey:808080 honeydew:f0fff0 ' +
  'hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa ' +
  'lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080 ' +
  'lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgreen:90ee90 lightgrey:d3d3d3 ' +
  'lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa lightskyblue:87cefa ' +
  'lightslategray:778899 lightslategrey:778899 lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 ' +
  'limegreen:32cd32 linen:faf0e6 magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa ' +
  'mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 ' +
  'mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585 ' +
  'midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead ' +
  'navy:000080 oldlace:fdf5e6 olive:808000 olivedrab:6b8e23 orange:ffa500 orangered:ff4500 ' +
  'orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093 ' +
  'papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 ' +
  'purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 ' +
  'saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d ' +
  'silver:c0c0c0 skyblue:87ceeb slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa ' +
  'springgreen:00ff7f steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347 ' +
  'turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5 yellow:ffff00 ' +
  'yellowgreen:9acd32'

let named = null
const namedColors = () => {
  if (!named) {
    named = {}
    NAMED_SOURCE.split(' ').forEach((pair) => {
      const [name, hex] = pair.split(':')
      if (name && hex) named[name] = hex
    })
  }
  return named
}

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')

/** Канал rgb(): число 0–255 или проценты. */
function channel(text) {
  const percent = /%$/.test(text)
  const n = parseFloat(text)
  if (!Number.isFinite(n)) return null
  return percent ? (n * 255) / 100 : n
}

/** Альфа rgba(): доля 0–1 или проценты. */
function alpha(text) {
  const percent = /%$/.test(text)
  const n = parseFloat(text)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(1, percent ? n / 100 : n))
}

/**
 * CSS-цвет в `#rrggbbaa` (нижний регистр) или `null`. Понимает `#rgb`, `#rgba`, `#rrggbb`,
 * `#rrggbbaa` (порядок CSS, альфа последней), `rgb()` / `rgba()` через запятые и через пробел (с
 * альфой после `/`), 148 имён и `transparent`. Остальное (`url(...)`, числа, пусто) — `null`.
 */
export function popupColor(value) {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase()
  if (!text) return null
  if (text === 'transparent') return '#00000000'
  let match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text)
  if (match) {
    const digits = match[1]
    if (digits.length <= 4) {
      const full = digits
        .split('')
        .map((digit) => digit + digit)
        .join('')
      return `#${full}${digits.length === 3 ? 'ff' : ''}`
    }
    return `#${digits}${digits.length === 6 ? 'ff' : ''}`
  }
  match = /^rgba?\(([^()]*)\)$/.exec(text)
  if (match) {
    const parts = match[1]
      .trim()
      .split(/\s*[,/]\s*|\s+/)
      .filter((part) => part.length > 0)
    if (parts.length !== 3 && parts.length !== 4) return null
    const rgb = parts.slice(0, 3).map(channel)
    const a = parts.length === 4 ? alpha(parts[3]) : 1
    if (rgb.some((n) => n === null) || a === null) return null
    return `#${rgb.map(hex2).join('')}${hex2(a * 255)}`
  }
  const hex = namedColors()[text]
  return hex ? `#${hex}ff` : null
}

/** Цвет или запасной (тоже CSS-строкой, её разбирает `popupColor`). */
export const popupColorOr = (value, fallback) => popupColor(value) || popupColor(fallback)

/**
 * Цвет тени: как у компилятора, к шестизначному hex дописывается альфа `55`, остальные форматы
 * идут как есть. Нет цвета — `#000000` с той же альфой.
 */
export function popupShadowColor(value) {
  const raw = typeof value === 'string' && popupColor(value) ? value.trim() : '#000000'
  return /^#[0-9a-f]{6}$/i.test(raw) ? popupColor(`${raw}55`) : popupColor(raw)
}

/** Цвет `#rrggbbaa` с альфой, умноженной на `opacity` (0–1). */
export function popupColorWithOpacity(color, opacity) {
  const parsed = popupColor(color)
  if (!parsed) return null
  const base = parseInt(parsed.slice(7, 9), 16) / 255
  const factor = Math.max(0, Math.min(1, opacity))
  return `${parsed.slice(0, 7)}${hex2(base * factor * 255)}`
}

/** Каналы `#rrggbbaa`: `rgb` 0–255 и альфа 0–1. */
function channelsOf(color) {
  const rgb = parseInt(color.slice(1, 7), 16)
  return { rgb: [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255], alpha: parseInt(color.slice(7, 9), 16) / 255 }
}

/**
 * Непрозрачный фон попапа под элементом, `#rrggbbff`: фон элемента, если он задан и не прозрачный,
 * иначе фон рамки, иначе белый (так рисуется рамка по умолчанию). Полупрозрачный ложится на то, что
 * под ним.
 */
export function popupBackdrop(elementBg, frameBg) {
  return [frameBg, elementBg].reduce((under, value) => {
    const color = popupColor(value)
    if (!color) return under
    const top = channelsOf(color)
    const base = channelsOf(under).rgb
    return `#${top.rgb.map((c, i) => hex2(c * top.alpha + base[i] * (1 - top.alpha))).join('')}ff`
  }, '#ffffffff')
}

/** Относительная яркость CSS-цвета (sRGB, как WCAG; альфа не учитывается); не цвет — `null`. */
function luminanceOf(value) {
  const color = popupColor(value)
  if (!color) return null
  const linear = (channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = channelsOf(color).rgb
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** Отношение контраста WCAG двух яркостей. */
const contrastRatio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/**
 * Схема кита (`light` / `dark`) для его компонентов внутри попапа — по фону попапа под ними, а не
 * по системе: из двух тем та, у которой основной текст (`textPrimary`) контрастнее с фоном по WCAG.
 * Белый фон — светлая в любой теме системы. Не разобрался цвет текста — как у макета (чёрный и
 * белый).
 *
 * @param {string} backdrop непрозрачный фон (`popupBackdrop`)
 * @param {{ light: string, dark: string }} textPrimary основной текст светлой и тёмной темы кита
 */
export function popupKitScheme(backdrop, textPrimary) {
  const background = luminanceOf(backdrop) ?? 1
  const light = luminanceOf(textPrimary.light) ?? 0
  const dark = luminanceOf(textPrimary.dark) ?? 1
  return contrastRatio(background, dark) > contrastRatio(background, light) ? 'dark' : 'light'
}
