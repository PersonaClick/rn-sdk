import React from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * StoryProgress — полоски слайдов сторис.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories (1:32), компонент Progress (шапка
 * Navigation/Story): n равных сегментов высотой 2, шаг 2, скругление 1. Пройденное —
 * Text/Secondary, дорожка — Line/Generic. Слайды до `current` залиты целиком, текущий — на
 * `progress` (0…1), следующие пустые.
 *
 * `progress` — число или Animated.Value (просмотрщик ведёт его анимацией; заливка тогда идёт
 * шириной в процентах, то есть JS-драйвером).
 *
 * @param {{ count: number, current?: number, progress?: number|object, style?: object }} props
 */
export default function StoryProgress({ count, current = 0, progress = 0, style }) {
  const { colors } = usePersonalizationTheme()
  const total = Math.max(0, Math.floor(Number(count) || 0))
  const animated = progress && typeof progress.interpolate === 'function'

  const fill = (index) => {
    if (index < current) return '100%'
    if (index > current) return '0%'
    if (animated) {
      return progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' })
    }
    return `${Math.max(0, Math.min(1, Number(progress) || 0)) * 100}%`
  }

  // Оба цвета полупрозрачные, поэтому заливка не лежит поверх дорожки (70 % поверх 20 % дали бы
  // темнее макета), а делит сегмент с ней: слева залитое, справа остаток дорожки.
  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={styles.segment}>
          <Animated.View style={[styles.part, { width: fill(index), backgroundColor: colors.textSecondary }]} />
          <View style={[styles.part, styles.rest, { backgroundColor: colors.lineGeneric }]} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  segment: { flex: 1, height: 2, borderRadius: 1, overflow: 'hidden', flexDirection: 'row' },
  part: { height: 2 },
  rest: { flex: 1 },
})
