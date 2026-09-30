import React from 'react'
import { View, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'

/**
 * FavoritesBadge — метка «в избранном»: звезда в круге цвета Semantic/Warning, 24x24.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Badge, символ Favorites (391:17117).
 *
 * @param {{ renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function FavoritesBadge({ renderIcon, style }) {
  const { colors } = usePersonalizationTheme()
  return (
    <View style={[styles.badge, { backgroundColor: colors.semanticWarning }, style]}>
      {renderIcon ? renderIcon(PERSONALIZATION_ICONS.starFill, colors.textLightPrimary, 16) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // Звезда 16 плюс поле 4 с каждой стороны.
  badge: { width: 24, height: 24, borderRadius: 12, padding: 4 },
})
