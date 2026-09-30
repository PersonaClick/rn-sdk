import React from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * ButtonGroup — группа кнопок (сегментированный переключатель).
 *
 * Источник: Figma Mobile SDK UI Kit, секция Button Group (185:5253):
 * фрейм Base Button (185:5315) — сегмент, фрейм Button Group (185:5484) — сама группа.
 *
 * В макете нарисован только случай на два сегмента (Grid/List) в размере MD,
 * сегмент же есть и в MD, и в SM — поэтому размер вынесен в API,
 * а число сегментов не ограничено.
 *
 * Иконки отдаются исходниками SVG, отрисовку задаёт потребитель через renderIcon.
 * У элемента есть отдельный activeIcon: в макете Grid оставляет ту же иконку,
 * а List подменяет её на залитую.
 *
 * @param {{ items: Array<{ icon: string, activeIcon?: string }>, selectedIndex?: number,
 *           size?: 'md'|'sm', onSelect?: (index: number) => void,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function ButtonGroup({
  items = [],
  selectedIndex = 0,
  size = 'md',
  onSelect,
  renderIcon,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const metrics = SIZES[size] || SIZES.md
  const side = metrics.iconSize + metrics.padding * 2

  return (
    <View
      style={[
        styles.container,
        { borderRadius: theme.radius.buttonMd, backgroundColor: colors.buttonSecondary },
        style,
      ]}
    >
      {items.map((item, index) => {
        const active = index === selectedIndex
        const tint = active ? colors.textInvertedPrimary : colors.textHint
        const svg = active ? item.activeIcon || item.icon : item.icon
        return (
          <Pressable
            key={index}
            onPress={() => onSelect && onSelect(index)}
            style={[
              styles.segment,
              {
                width: side,
                height: side,
                borderRadius: theme.radius[metrics.radius],
                backgroundColor: active ? colors.buttonPrimary : colors.backgroundTransparent,
              },
            ]}
          >
            {renderIcon ? renderIcon(svg, tint, metrics.iconSize) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const SIZES = {
  // Отступ сегмента: 6 в MD и 2 в SM, обоих значений нет в шкале спейсингов.
  md: { radius: 'segmentedMd', padding: 6, iconSize: 24 },
  sm: { radius: 'segmentedSm', padding: 2, iconSize: 20 },
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 2,
  },
  segment: { alignItems: 'center', justifyContent: 'center' },
})
