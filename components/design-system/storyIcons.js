import React from 'react'
import { Image } from 'react-native'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'

/**
 * Встроенные иконки сторис V2. Остальной кит рисует иконки только через `renderIcon` хоста
 * (React Native не рисует SVG сам), и без него иконок не видно. Сторис без крестика и кнопки
 * звука непригодны, поэтому у их компонентов есть запасной вариант: PNG в пакете (@1x/@2x/@3x),
 * растеризованные из тех же путей SVG кита (PERSONALIZATION_ICONS, рамка 32), чёрные с альфой —
 * цвет даёт `tintColor`. `renderIcon` хоста, если он есть, по-прежнему главнее.
 *
 * Только для сторис (крестик, звук вкл/выкл, копирование, звезда, стрелки «Used products»):
 * остальной кит не меняется.
 */
const BUILT_IN = new Map([
  [PERSONALIZATION_ICONS.cross, require('../../assets/personalization-story-cross.png')],
  [PERSONALIZATION_ICONS.speaker, require('../../assets/personalization-story-speaker.png')],
  [PERSONALIZATION_ICONS.speakerOff, require('../../assets/personalization-story-speaker-off.png')],
  [PERSONALIZATION_ICONS.copy, require('../../assets/personalization-story-copy.png')],
  [PERSONALIZATION_ICONS.starFill, require('../../assets/personalization-story-star-fill.png')],
  [PERSONALIZATION_ICONS.angleLargeUp, require('../../assets/personalization-story-angle-large-up.png')],
  [PERSONALIZATION_ICONS.angleLargeDown, require('../../assets/personalization-story-angle-large-down.png')],
])

/** Встроенная иконка сторис по исходнику SVG; чужой иконки нет — `null`. */
function builtInIcon(svg, color, size) {
  const source = BUILT_IN.get(svg)
  if (!source) return null
  // Размер явно: у локального ресурса Image подставляет размер файла в начало стиля.
  return <Image source={source} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />
}

/**
 * Отрисовщик иконок для компонентов сторис: `renderIcon` хоста, а без него — встроенные PNG.
 *
 * @param {((svg: string, color: string, size: number) => React.ReactNode) | undefined} renderIcon
 * @returns {(svg: string, color: string, size: number) => React.ReactNode}
 */
export function storyIconRenderer(renderIcon) {
  return typeof renderIcon === 'function' ? renderIcon : builtInIcon
}
