import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import ProductImage from './ProductImage'
import Rating from './Rating'
import Badge from './Badge'
import Button from './Button'

/**
 * ProductCard — карточка товара.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Card, фрейм Product (126:2263):
 * carousel — колонка 220, grid — колонка на всю ширину ячейки, list — строка с картинкой
 * шириной 120 и ценой с кнопкой внизу справа. Пропорция картинки — imageAspect: на
 * странице ProductCard (88:69) карточка нарисована с 4:3, 1:1 и 3:4, и её высота идёт
 * за картинкой.
 * У трёх типов разная типографика названия, цены и старой цены, поэтому она задана
 * в таблице. Старая цена карусели — 16/24 по страницам ProductCard и Product Carousel;
 * мастер-компонент Product там же даёт 14/20 — расхождение в макете, взяты страницы.
 *
 * Собрана из готовых блоков: ProductImage, Rating, Badge (скидка, вид danger), Button.
 *
 * @param {{ type?: 'carousel'|'grid'|'list', source?: object,
 *           imageAspect?: 'square'|'landscape'|'portrait', brand?: string, name: string,
 *           rating?: { value: string, reviews: number }, price: string, oldPrice?: string,
 *           discount?: string, actionText?: string, onAction?: Function, onPress?: Function,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function ProductCard({
  type = 'carousel',
  source,
  imageAspect = 'square',
  brand,
  name,
  rating,
  price,
  oldPrice,
  discount,
  actionText,
  onAction,
  onPress,
  renderIcon,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const metrics = TYPES[type] || TYPES.carousel

  const nameBlock = (gap) => (
    <View style={{ gap }}>
      {brand ? (
        <Text style={[theme.typography.xsDefault, { color: colors.textSecondary }]}>{brand}</Text>
      ) : null}
      <Text
        style={[theme.typography[metrics.name], { color: colors.textPrimary }]}
        numberOfLines={2}
      >
        {name}
      </Text>
    </View>
  )
  const ratingRow = rating ? (
    <Rating value={rating.value} reviews={rating.reviews} renderIcon={renderIcon} />
  ) : null
  const priceText = (
    <Text style={[theme.typography[metrics.price], { color: colors.textPrimary }]}>{price}</Text>
  )
  const oldPriceText = oldPrice ? (
    <Text
      style={[
        theme.typography[metrics.oldPrice],
        { fontFamily: fontFor(theme, '400'), color: colors.textHint, textDecorationLine: 'line-through' },
      ]}
    >
      {oldPrice}
    </Text>
  ) : null
  const discountBadge = discount ? <Badge label={discount} size="sm" view="danger" /> : null
  const action = actionText ? (
    <Button label={actionText} size="md" view="primary" onPress={onAction} style={metrics.button} />
  ) : null

  // List: картинка шириной 120 слева, справа колонка — название с рейтингом сверху,
  // цена с кнопкой снизу. Высота строки — большее из картинки и текста.
  // Нажатие на карточку целиком (не на кнопку) — открыть товар.
  const Root = onPress ? Pressable : View

  if (type === 'list') {
    return (
      <Root onPress={onPress} style={[styles.listRow, style]}>
        <ProductImage source={source} aspect={imageAspect} style={styles.listImage} />
        <View style={styles.listColumn}>
          <View style={{ gap: 4 }}>
            {nameBlock(2)}
            {ratingRow}
          </View>
          <View style={styles.listBottom}>
            <View>
              <View style={styles.priceLine}>
                {priceText}
                {discountBadge}
              </View>
              {oldPriceText}
            </View>
            {action}
          </View>
        </View>
      </Root>
    )
  }

  // Carousel и Grid: картинка, название, рейтинг, цена, кнопка — колонкой с шагом 8.
  // У колонок скидка лежит на картинке: отступ 8 у carousel и 4 у grid.
  // Колонка из двух групп: верх (картинка, название, рейтинг) и низ (цена, кнопка).
  // В ряду или карусели карточки тянутся до самой высокой, и лишнее уходит между
  // группами — цена с кнопкой у соседей остаются на одной линии, даже когда название
  // ушло на две строки. В макете такой случай не нарисован: там названия в одну строку.
  return (
    <Root onPress={onPress} style={[styles.column, type === 'carousel' && styles.carousel, style]}>
      <View style={styles.group}>
        <View>
          <ProductImage source={source} aspect={imageAspect} />
          {discountBadge ? (
            <View style={[styles.imageBadge, { top: metrics.badgeInset, right: metrics.badgeInset }]}>
              {discountBadge}
            </View>
          ) : null}
        </View>
        {nameBlock(2)}
        {ratingRow}
      </View>
      <View style={styles.group}>
        <View style={styles.priceRow}>
          {priceText}
          {oldPriceText}
        </View>
        {action}
      </View>
    </Root>
  )
}

const TYPES = {
  carousel: { name: 'baseDefault', price: 'xlEmphasized', oldPrice: 'baseDefault', badgeInset: 8, button: { alignSelf: 'stretch' } },
  grid: { name: 'baseDefault', price: 'lgEmphasized', oldPrice: 'smDefault', badgeInset: 4, button: { alignSelf: 'stretch' } },
  list: { name: 'smDefault', price: 'baseEmphasized', oldPrice: 'smDefault', badgeInset: 0, button: undefined },
}

const styles = StyleSheet.create({
  column: { gap: 8, flexGrow: 1, justifyContent: 'space-between' },
  group: { gap: 8 },
  carousel: { width: 220 },
  imageBadge: { position: 'absolute' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  listRow: { flexDirection: 'row', gap: 12 },
  listImage: { width: 120 },
  listColumn: { flex: 1, justifyContent: 'space-between' },
  listBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
