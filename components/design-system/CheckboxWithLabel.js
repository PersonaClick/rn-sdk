import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import Checkbox from './Checkbox'

/**
 * CheckboxWithLabel — чекбокс с подписью.
 *
 * Источник: Figma Mobile SDK UI Kit, фрейм Checkbox with Label (205:10151).
 * Зазор 8, подпись 16/20 обычного начертания; в disabled подпись уходит
 * в Text/Hint.
 *
 * @param {{ label: string, state?: 'unchecked'|'checked'|'indeterminate',
 *           disabled?: boolean, onChange?: (next: string) => void, style?: object }} props
 */
export default function CheckboxWithLabel({ label, state = 'unchecked', disabled = false, onChange, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme

  const row = (
    <View style={[styles.row, style]}>
      <Checkbox state={state} disabled={disabled} />
      <Text
        style={[
          styles.label,
          { fontFamily: fontFor(theme, '400'), color: disabled ? colors.textHint : colors.textPrimary },
        ]}
      >
        {label}
      </Text>
    </View>
  )

  if (disabled || typeof onChange !== 'function') return row

  return (
    <Pressable onPress={() => onChange(state === 'checked' ? 'unchecked' : 'checked')}>
      {row}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, lineHeight: 20, fontWeight: '400' },
})
