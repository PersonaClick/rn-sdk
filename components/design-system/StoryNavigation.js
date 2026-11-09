import React, { useRef } from 'react'
import { View, Pressable, StyleSheet, findNodeHandle } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'
import { PERSONALIZATION_SPACING } from '../../constants/spacing.constants'
import StoryProgress from './StoryProgress'
import { storyIconRenderer } from './storyIcons'

/**
 * StoryNavigation — шапка просмотра сторис: полоски слайдов и крестик.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories (1:32), компонент Navigation/Story.
 * Колонка с шагом 12: StoryProgress и строка высотой 32 с крестиком у правого края — кнопка
 * 32x32, иконка cross (глиф 18), Text/Secondary с прозрачностью 65 %.
 *
 * Над фотографией шапка светлая сама: просмотрщик рисует такие слайды тёмной схемой.
 * Крестик рисует `renderIcon` хоста, а без него — встроенная иконка (storyIcons).
 *
 * С `onShare` слева от крестика (зазор 8) — кнопка «Поделиться» того же вида: коробка 32 без
 * фона, иконка share, Text/Secondary 65 %. `onShare(anchor)` получает тег кнопки — к ней
 * привязывается поповер системного окна на iPad. Касание кнопок забирают они сами, слайд его
 * не видит (ни удержания, ни свайпа).
 *
 * @param {{ count: number, current?: number, progress?: number|object, onClose?: Function,
 *           closeLabel?: string, onShare?: (anchor: number|null) => void, shareLabel?: string,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function StoryNavigation({
  count,
  current = 0,
  progress = 0,
  onClose,
  closeLabel = 'Close',
  onShare,
  shareLabel = 'Share',
  renderIcon,
  style,
}) {
  const { colors } = usePersonalizationTheme()
  const icon = storyIconRenderer(renderIcon)
  const shareButton = useRef(null)
  return (
    <View style={[styles.column, style]}>
      <StoryProgress count={count} current={current} progress={progress} />
      <View style={styles.row}>
        {onShare ? (
          <Pressable
            ref={shareButton}
            onPress={() => onShare(nodeTag(shareButton.current))}
            hitSlop={SHARE_HIT_SLOP}
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel={shareLabel}
          >
            {icon(PERSONALIZATION_ICONS.share, colors.textSecondary, 32)}
          </Pressable>
        ) : null}
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        >
          {icon(PERSONALIZATION_ICONS.cross, colors.textSecondary, 32)}
        </Pressable>
      </View>
    </View>
  )
}

/** Тег нативной вьюхи кнопки; не вышло — `null` (поповер iPad тогда — по центру окна). */
function nodeTag(view) {
  try {
    return view ? findNodeHandle(view) : null
  } catch (error) {
    return null
  }
}

// Справа у «Поделиться» запаса нет: зазор до крестика покрывает запас крестика.
const SHARE_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 0 }

const styles = StyleSheet.create({
  column: { gap: 12 },
  row: { height: 32, flexDirection: 'row', justifyContent: 'flex-end', gap: PERSONALIZATION_SPACING.md },
  button: { width: 32, height: 32, opacity: 0.65 },
})
