import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * Count — счётчик «показано N из M».
 *
 * Источник: Figma Mobile SDK UI Kit, секция Navigation (90:660), символ Count (301:6810).
 * Слова — параметры, а не константы: локализация остаётся за интегратором.
 * В макете это «Showed 6 from 569».
 *
 * @param {{ prefix: string, shown: number, separator: string, total: number,
 *           style?: object }} props
 */
export default function Count({ prefix, shown, separator, total, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const regular = [theme.typography.baseDefault, { color: colors.textSecondary }]
  const strong = [theme.typography.baseEmphasized, { color: colors.textPrimary }]

  return (
    <View style={[styles.row, style]}>
      <Text style={regular}>{prefix}</Text>
      <Text style={strong}>{String(shown)}</Text>
      <Text style={regular}>{separator}</Text>
      <Text style={strong}>{String(total)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
})
