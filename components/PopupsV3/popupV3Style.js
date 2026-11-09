import { Platform } from 'react-native'

/**
 * Модель попапа v3 → стили React Native: коробка элемента, текст, выравнивание. Чистые функции,
 * их гоняют тесты. CSS px = логический px React Native.
 */

/** left / center / right → значение flex-выравнивания. */
export const popupFlexAlign = (align) => (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start')

/** top / center / bottom → `justifyContent` вертикального стека. */
export const popupFlexJustify = (align) => (align === 'center' ? 'center' : align === 'bottom' ? 'flex-end' : 'flex-start')

/** Вес шрифта CSS → строка `100`…`900`, которую понимает React Native. */
export const popupFontWeight = (weight) => String(Math.max(100, Math.min(900, Math.round((Number(weight) || 400) / 100) * 100)))

/**
 * Шрифт: системный; моноширинный и с засечками — по ключевому слову (шрифтов приложения по имени не
 * ищем, их на устройстве может не быть).
 */
export function popupFontFamily(family) {
  const text = typeof family === 'string' ? family.toLowerCase() : ''
  if (!text) return undefined
  if (/mono|courier|menlo|consolas/.test(text)) return Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  if (/(^|[\s,'"])serif|georgia|times/.test(text) && !/sans-serif/.test(text.split(',')[0])) {
    return Platform.OS === 'ios' ? 'Georgia' : 'serif'
  }
  return undefined
}

/** Моноширинный шрифт кода промокода. */
export const POPUP_MONOSPACE = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

/** Текст коробки: цвет, кегль, вес, межстрочный (множитель кегля), межбуквенный, шрифт. */
export function popupTextStyle(box, overrides = {}) {
  const fontSize = overrides.fontSize !== undefined ? overrides.fontSize : box.fontSize
  const fontWeight = overrides.fontWeight !== undefined ? overrides.fontWeight : box.fontWeight
  const style = {
    color: box.textColor,
    fontSize,
    fontWeight: popupFontWeight(fontWeight),
    lineHeight: Math.round(fontSize * box.lineHeight * 100) / 100,
    letterSpacing: box.letterSpacing,
  }
  const family = popupFontFamily(box.fontFamily)
  if (family) style.fontFamily = family
  return style
}

/** Коробка элемента: фон, рамка, радиус, поля, непрозрачность, тень. */
export function popupBoxStyle(box) {
  const style = {
    backgroundColor: box.bgColor,
    borderRadius: box.borderRadius,
    paddingHorizontal: box.paddingX,
    paddingVertical: box.paddingY,
  }
  if (box.borderWidth > 0) {
    style.borderWidth = box.borderWidth
    style.borderColor = box.borderColor
  }
  if (box.opacity < 1) style.opacity = box.opacity
  if (box.shadow) style.boxShadow = `0px ${box.shadow.y}px ${box.shadow.blur}px ${box.shadow.color}`
  return style
}

/**
 * Место элемента в ячейке (вертикальный стек): растягиваемые типы — на всю ширину, остальные — по
 * своему выравниванию (`cellAlign`, у кнопок — `buttonAlign`) или выравниванию ячейки, шириной по
 * содержимому, не шире ячейки. `cellVerticalAlign` прижимает сам элемент.
 */
export function popupElementPlacement(element, cellAlign) {
  const style = element.stretch
    ? { alignSelf: 'stretch' }
    : { alignSelf: popupFlexAlign(element.selfAlign || cellAlign), maxWidth: '100%' }
  if (element.verticalSelf === 'bottom') style.marginTop = 'auto'
  else if (element.verticalSelf === 'center') {
    style.marginTop = 'auto'
    style.marginBottom = 'auto'
  }
  return style
}

/** object-fit → `resizeMode` картинки. */
export const popupResizeMode = (fit) => (fit === 'contain' ? 'contain' : fit === 'fill' ? 'stretch' : fit === 'none' ? 'center' : 'cover')

/** Стиль спана разметки. Надчёркивания React Native не умеет — такой спан рисуется обычным. */
export function popupSpanStyle(span) {
  const style = {}
  if (span.bold) style.fontWeight = 'bold'
  if (span.italic) style.fontStyle = 'italic'
  if (span.underline && span.strike) style.textDecorationLine = 'underline line-through'
  else if (span.underline) style.textDecorationLine = 'underline'
  else if (span.strike) style.textDecorationLine = 'line-through'
  return style
}
