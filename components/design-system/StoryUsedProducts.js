import React, { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'
import Button from './Button'
import ProductsList from './ProductsList'
import { storyIconRenderer } from './storyIcons'

/**
 * StoryUsedProducts — низ слайда с товарами: кнопка «Used products» и лист с каруселью.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories (1:32), компонент Used Products.
 *
 * Свёрнуто — строка высотой 64 с полями 16: по центру пилюля (Button SM Secondary со скруглением
 * Rounded и иконкой angle-large-up 20 в конце, текст SemiBold 14/24) с подписью `showText`
 * (у сервера — `labels.show_carousel`, по умолчанию «Used products»).
 * Развёрнуто — лист Background/Card: карусель кита (ProductsList, карточки carousel шириной 220,
 * поля 16/0/16/16, шаг 16) и та же строка с `hideText` (`labels.hide_carousel`) и
 * angle-large-down.
 *
 * В начале строки — слот `leading` (кнопка звука видео-слайда) поверх строки; пилюля стоит по
 * центру строки и со звуком, и без него.
 *
 * Развёрнутость можно вести снаружи (`expanded` + `onToggle`) или оставить компоненту.
 *
 * Развёрнутый лист сам забирает касания своей пустой части: тап по листу мимо карточек не
 * долетает до просмотра (там тап вне листа закрывает его, а листать слайды при открытом листе
 * нельзя — B5). Стрелки пилюли без `renderIcon` рисуются встроенными иконками (storyIcons);
 * карточки карусели получают `renderIcon` хоста как есть.
 *
 * @param {{ products?: Array<object>, expanded?: boolean, onToggle?: (expanded: boolean) => void,
 *           showText?: string, hideText?: string, leading?: React.ReactNode,
 *           onProductPress?: (product: object) => void,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function StoryUsedProducts({
  products = [],
  expanded: expandedProp,
  onToggle,
  showText = 'Used products',
  hideText = 'Hide products',
  leading,
  onProductPress,
  renderIcon,
  style,
}) {
  const { colors } = usePersonalizationTheme()
  const [own, setOwn] = useState(false)
  const controlled = typeof expandedProp === 'boolean'
  const expanded = controlled ? expandedProp : own

  const toggle = () => {
    const next = !expanded
    if (!controlled) setOwn(next)
    onToggle && onToggle(next)
  }

  const row = (
    <View style={styles.row}>
      <Button
        label={expanded ? hideText : showText}
        size="sm"
        view="secondary"
        rounded
        iconEnd={expanded ? PERSONALIZATION_ICONS.angleLargeDown : PERSONALIZATION_ICONS.angleLargeUp}
        renderIcon={storyIconRenderer(renderIcon)}
        onPress={toggle}
        // Кнопка кита стоит `alignSelf: 'flex-start'` (она рассчитана на ряд) — без этого пилюля
        // прижималась к левому краю вместо центра строки.
        style={styles.pill}
      />
      {leading ? <View style={styles.leading}>{leading}</View> : null}
    </View>
  )

  if (!expanded) return <View style={style}>{row}</View>

  return (
    <View
      style={[{ backgroundColor: colors.backgroundCard }, style]}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => true}
    >
      <ProductsList
        layout="carousel"
        products={products}
        onProductPress={onProductPress}
        renderIcon={renderIcon}
        contentContainerStyle={styles.carousel}
      />
      {row}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { height: 64, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  pill: { alignSelf: 'center' },
  leading: { position: 'absolute', left: 16, top: 16, height: 32, justifyContent: 'center' },
  carousel: { paddingTop: 16, paddingRight: 0, paddingBottom: 16, paddingLeft: 16 },
})
