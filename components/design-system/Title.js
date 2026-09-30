import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * Title — заголовок блока.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Title (167:3802).
 * Все четыре заголовка на странице — один и тот же ряд «слева иконка, заголовок,
 * справа управление», отличается только содержимое по краям:
 * Recommender block (157:5176) — кнопка «Show all», Category (167:3812) — группа кнопок,
 * Filters (204:8340) — кнопка-крестик, Search results (167:3807) — кнопка «назад» и группа.
 * Поэтому края здесь — произвольные узлы, а не фиксированные варианты.
 *
 * @param {{ title: string, leading?: React.ReactNode, trailing?: React.ReactNode,
 *           style?: object }} props
 */
export default function Title({ title, leading, trailing, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  return (
    <View style={[styles.row, style]}>
      {leading}
      <Text
        style={[theme.typography.xl2Emphasized, styles.title, { color: colors.textPrimary }]}
      >
        {title}
      </Text>
      {trailing}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { flex: 1 },
})
