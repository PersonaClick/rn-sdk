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
 * @param {{ state?: 'unchecked'|'checked'|'indeterminate', disabled?: boolean,
 *           onChange?: (next: string) => void, style?: object }} props
 */
export default function Checkbox({ state = 'unchecked', disabled = false, onChange, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const filled = state !== 'unchecked'

  const box = (
    <View
      style={[
        styles.box,
        { borderRadius: theme.radius.sm },
        filled
          ? { backgroundColor: disabled ? colors.buttonPrimaryDisabled : colors.buttonPrimary }
          : {
              backgroundColor: disabled ? colors.backgroundInputDisabled : colors.backgroundInput,
              borderWidth: 1,
              borderColor: colors.lineInput,
            },
        style,
      ]}
    >
      {state === 'checked' && (
        <>
          <View style={[styles.stroke, styles.checkShort, { backgroundColor: colors.textLightPrimary }]} />
          <View style={[styles.stroke, styles.checkLong, { backgroundColor: colors.textLightPrimary }]} />
        </>
      )}
      {state === 'indeterminate' && (
        <View style={[styles.stroke, styles.dash, { backgroundColor: colors.textLightPrimary }]} />
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
