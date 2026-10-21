import React, { useCallback } from 'react'
import { View, FlatList, StyleSheet } from 'react-native'
import StoryPreview from './StoryPreview'

/**
 * StoriesBar — лента сторис: StoryPreview в горизонтальной прокрутке.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories (1:32), блок Stories (светлый и тёмный):
 * шаг 16, поля 16 — поля хост меняет через `contentContainerStyle`.
 *
 * Сторис: `{ id, title, source?, state?, segments?, seenSegments? }` — состояние обложки и
 * сегменты как у StoryCover (`seenSegments` — индексы показанных слайдов или их число). Пока
 * `loading`, вместо сторис четыре скелетона (`skeletonCount`). Подпись — до двух строк.
 *
 * @param {{ stories?: Array<object>, loading?: boolean, skeletonCount?: number,
 *           onStoryPress?: (story: object, index: number) => void,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           contentContainerStyle?: object, style?: object }} props
 */
export default function StoriesBar({
  stories = [],
  loading = false,
  skeletonCount = 4,
  onStoryPress,
  renderIcon,
  contentContainerStyle,
  style,
}) {
  const data = loading
    ? Array.from({ length: Math.max(0, skeletonCount) }, (_, index) => ({ id: `skeleton-${index}`, state: 'skeleton' }))
    : stories

  const renderItem = useCallback(
    ({ item, index }) => (
      <StoryPreview
        title={item.title}
        source={item.source}
        state={item.state}
        segments={item.segments}
        seenSegments={item.seenSegments}
        onPress={onStoryPress && item.state !== 'skeleton' ? () => onStoryPress(item, index) : undefined}
        renderIcon={renderIcon}
      />
    ),
    [onStoryPress, renderIcon],
  )

  return (
    <FlatList
      horizontal
      data={data}
      keyExtractor={(item, index) => (item.id !== undefined && item.id !== null ? String(item.id) : String(index))}
      renderItem={renderItem}
      ItemSeparatorComponent={Gap}
      showsHorizontalScrollIndicator={false}
      scrollEnabled={!loading}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      style={style}
    />
  )
}

const Gap = () => <View style={styles.gap} />

const styles = StyleSheet.create({
  content: { padding: 16 },
  gap: { width: 16 },
})
