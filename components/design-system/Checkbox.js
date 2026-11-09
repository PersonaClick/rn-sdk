import React from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * Checkbox — чекбокс дизайн-системы, 20x20.
 *
 * Источник: Figma Mobile SDK UI Kit, фрейм Checkbox (205:10128).
 * В макете только размер MD, поэтому размера в API нет.
 *
 * Галка в макете — штрих по пути M5 10 L8.75 13.75 L15 7.5 толщиной 2.
 * React Native не рисует пути без сторонней библиотеки, поэтому те же два
 * отрезка собраны из повёрнутых прямоугольников: длины и углы посчитаны из
 * исходных координат (5.30 под 45° и 8.84 под -45°), а не подобраны на глаз.
 *
 * Цвета по умолчанию — токены кита (следуют схеме). Хост, который рисует чекбокс в своих
 * цветах (форма попапа), передаёт `checkedColor` (заливка отмеченного), `checkColor` (галка и
 * черта), `uncheckedColor` (заливка пустого) и `borderColor` (рамка пустого); заданный цвет
 * заменяет свой токен, кроме заливки disabled — она всегда из токенов кита; незаданный
 * остаётся токеном.
 *
 * @param {{ state?: 'unchecked'|'checked'|'indeterminate', disabled?: boolean,
 *           onChange?: (next: string) => void, checkedColor?: string, checkColor?: string,
 *           uncheckedColor?: string, borderColor?: string, style?: object }} props
 */
export default function Checkbox({
  state = 'unchecked',
  disabled = false,
  onChange,
  checkedColor,
  checkColor,
  uncheckedColor,
  borderColor,
  style,
}) {
  const theme = usePersonalizationTheme()
  const filled = state !== 'unchecked'
  const paint = checkboxColors(theme.colors, { disabled, checkedColor, checkColor, uncheckedColor, borderColor })

  const box = (
    <View
      style={[
        styles.box,
        { borderRadius: theme.radius.sm },
        filled
          ? { backgroundColor: paint.checked }
          : { backgroundColor: paint.unchecked, borderWidth: 1, borderColor: paint.border },
        style,
      ]}
    >
      {state === 'checked' && (
        <>
          <View style={[styles.stroke, styles.checkShort, { backgroundColor: paint.check }]} />
          <View style={[styles.stroke, styles.checkLong, { backgroundColor: paint.check }]} />
        </>
      )}
      {state === 'indeterminate' && (
        <View style={[styles.stroke, styles.dash, { backgroundColor: paint.check }]} />
      )}
    </View>
  )

  if (disabled || typeof onChange !== 'function') return box

  return (
    <Pressable onPress={() => onChange(state === 'checked' ? 'unchecked' : 'checked')} hitSlop={8}>
      {box}
    </Pressable>
  )
}

/**
 * Цвета чекбокса: заданные хостом, иначе токены кита из `colors` (уже под схему); заливка
 * disabled — всегда токены кита.
 * `checked` — заливка отмеченного и неопределённого, `check` — галка и черта,
 * `unchecked` — заливка пустого, `border` — его рамка.
 */
export function checkboxColors(colors, { disabled = false, checkedColor, checkColor, uncheckedColor, borderColor } = {}) {
  return {
    checked: disabled ? colors.buttonPrimaryDisabled : checkedColor || colors.buttonPrimary,
    check: checkColor || colors.textLightPrimary,
    unchecked: disabled ? colors.backgroundInputDisabled : uncheckedColor || colors.backgroundInput,
    border: borderColor || colors.lineInput,
  }
}

const styles = StyleSheet.create({
  box: { width: 20, height: 20 },
  stroke: { position: 'absolute', height: 2, borderRadius: 1 },
  // (5,10) -> (8.75,13.75): длина 5.30, угол 45°, середина (6.875, 11.875)
  checkShort: { width: 5.3, left: 6.875 - 5.3 / 2, top: 11.875 - 1, transform: [{ rotate: '45deg' }] },
  // (8.75,13.75) -> (15,7.5): длина 8.84, угол -45°, середина (11.875, 10.625)
  checkLong: { width: 8.84, left: 11.875 - 8.84 / 2, top: 10.625 - 1, transform: [{ rotate: '-45deg' }] },
  // (5,10) -> (15,10)
  dash: { width: 10, left: 5, top: 9 },
})
