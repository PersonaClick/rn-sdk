import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * Badge — бейдж дизайн-системы.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Badge (241:7434).
 *
 * Внимание: типографика бейджа не совпадает со ступенями PERSONALIZATION_TYPOGRAPHY —
 * кегль берётся с одной ступени, интерлиньяж с другой (20/24, 16/20, 14/16).
 * Поэтому размеры заданы здесь явно, а не переиспользуются.
 *
 * @param {{ label: string, size?: 'sm'|'md'|'lg', style?: object }} props
 */
/** Вид: warning — как в секции Badge, danger — бейдж скидки на карточке товара (Card/Product, 126:2263), тот же SM в цвете Semantic/Danger. */
export default function Badge({ label, size = 'lg', view = 'warning', style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const metrics = SIZES[size] || SIZES.lg

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: metrics.padH,
          paddingVertical: metrics.padV,
          borderRadius: theme.radius[metrics.radius],
          backgroundColor: view === 'danger' ? colors.semanticDanger : colors.semanticWarning,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fontFor(theme, '600'),
          fontSize: metrics.fontSize,
          lineHeight: metrics.lineHeight,
          fontWeight: '600',
          color: colors.textLightPrimary,
        }}
      >
        {label}
      </Text>
    </View>
  )
}

const SIZES = {
  lg: { padH: 12, padV: 8, radius: 'buttonLg', fontSize: 20, lineHeight: 24 },
  md: { padH: 8, padV: 4, radius: 'buttonMd', fontSize: 16, lineHeight: 20 },
  sm: { padH: 4, padV: 2, radius: 'buttonSm', fontSize: 14, lineHeight: 16 },
}

const styles = StyleSheet.create({
  container: { alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' },
})
