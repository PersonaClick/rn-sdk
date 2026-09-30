import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'

/**
 * Accordion — строка-аккордеон списка.
 *
 * Источник: Figma Mobile SDK UI Kit, секция List (241:10565), фрейм Accordion (241:10575).
 * Два варианта — Expanded=False и True, отличаются только направлением шеврона.
 *
 * Шеврон: React Native не рисует SVG сам, исходник отдаётся через renderIcon.
 *
 * @param {{ label: string, count?: number, expanded?: boolean, onToggle?: (expanded: boolean) => void,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function Accordion({ label, count, expanded = false, onToggle, renderIcon, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const chevron = expanded ? PERSONALIZATION_ICONS.angleUp : PERSONALIZATION_ICONS.angleDown

  return (
    <Pressable style={[styles.row, style]} onPress={() => onToggle && onToggle(!expanded)}>
      <Text style={[theme.typography.baseDefault, { color: colors.textPrimary }]}>
        {label}
      </Text>
      {typeof count === 'number' ? (
        <Text style={[theme.typography.baseDefault, { color: colors.textSecondary }]}>
          {`(${count})`}
        </Text>
      ) : null}
      <View style={styles.chevron}>
        {renderIcon ? renderIcon(chevron, colors.textPrimary, 24) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chevron: { width: 24, height: 24 },
})
