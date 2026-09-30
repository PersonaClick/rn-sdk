import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * EmptyState — пустое состояние дизайн-системы.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Empty State (319:7736).
 * Горизонтальные отступы 16, вертикальные 92, текст по центру ступенью
 * XL/Default цветом Text/Secondary.
 *
 * Текст не зашит: в макете стоит «No results for your request.», но строку
 * подставляет потребитель — локализация остаётся на его стороне.
 *
 * @param {{ message: string, style?: object }} props
 */
export default function EmptyState({ message, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.message, { fontFamily: fontFor(theme, '400'), color: colors.textSecondary }]}>
        {message}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { fontSize: 20, lineHeight: 32, fontWeight: '400', textAlign: 'center' },
})
