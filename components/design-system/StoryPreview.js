import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import StoryCover from './StoryCover'
import Shimmer from './Shimmer'

/**
 * StoryPreview — сторис в ленте: обложка и подпись под ней.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories (1:32), компонент Story/Preview.
 * Колонка шириной 88 с шагом 8: StoryCover и подпись Regular 12/16 (ступень XS) с трекингом,
 * по центру, Text/Primary, шириной с обложку, до двух строк с многоточием в конце (C14).
 *
 * Скелетон — обложка-скелетон и вместо подписи плашка 64x8 со скруглением 5 и бликом. Плашка
 * стоит по центру строки высотой 16, чтобы лента не прыгала, когда сторис загрузятся.
 *
 * @param {{ title?: string, source?: object, state?: 'default'|'pinned'|'viewed'|'skeleton',
 *           segments?: number, seenSegments?: number|number[], onPress?: Function,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function StoryPreview({
  title,
  source,
  state = 'default',
  segments,
  seenSegments,
  onPress,
  renderIcon,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const skeleton = state === 'skeleton'

  const label = skeleton ? (
    <View style={styles.labelSlot}>
      <Shimmer style={[styles.labelSkeleton, { backgroundColor: colors.neutral50 }]} />
    </View>
  ) : (
    <Text
      style={[theme.typography.xsDefault, styles.label, { color: colors.textPrimary }]}
      numberOfLines={2}
      ellipsizeMode="tail"
    >
      {title}
    </Text>
  )

  const Root = onPress && !skeleton ? Pressable : View
  return (
    <Root
      onPress={onPress}
      style={[styles.column, style]}
      accessibilityRole={onPress && !skeleton ? 'button' : undefined}
      accessibilityLabel={skeleton ? undefined : title}
    >
      <StoryCover
        source={source}
        state={state}
        segments={segments}
        seenSegments={seenSegments}
        renderIcon={renderIcon}
      />
      {label}
    </Root>
  )
}

const styles = StyleSheet.create({
  column: { width: 88, gap: 8, alignItems: 'center' },
  label: { width: 88, textAlign: 'center' },
  labelSlot: { height: 16, justifyContent: 'center' },
  labelSkeleton: { width: 64, height: 8, borderRadius: 5 },
})
