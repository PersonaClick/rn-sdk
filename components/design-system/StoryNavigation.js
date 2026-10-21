import React from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'
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
 * @param {{ count: number, current?: number, progress?: number|object, onClose?: Function,
 *           closeLabel?: string,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function StoryNavigation({
  count,
  current = 0,
  progress = 0,
  onClose,
  closeLabel = 'Close',
  renderIcon,
  style,
}) {
  const { colors } = usePersonalizationTheme()
  return (
    <View style={[styles.column, style]}>
      <StoryProgress count={count} current={current} progress={progress} />
      <View style={styles.row}>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        >
          {storyIconRenderer(renderIcon)(PERSONALIZATION_ICONS.cross, colors.textSecondary, 32)}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  column: { gap: 12 },
  row: { height: 32, flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: 32, height: 32, opacity: 0.65 },
})
