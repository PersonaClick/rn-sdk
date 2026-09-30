import React from 'react'
import { View, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * Dots — точки-индикатор карусели.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Navigation (90:660),
 * символы Dots (90:669) и Dot (90:685).
 * В макете нарисовано пять точек, число вынесено в API.
 *
 * @param {{ count: number, selectedIndex?: number, style?: object }} props
 */
export default function Dots({ count = 0, selectedIndex = 0, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: Math.max(0, count) }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              borderRadius: theme.radius.rounded,
              backgroundColor:
                index === selectedIndex ? colors.brandPrimary : colors.lineGeneric,
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  dot: { width: 16, height: 16 },
})
