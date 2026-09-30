import React, { useCallback, useRef } from 'react'
import { View, FlatList, StyleSheet } from 'react-native'
import ProductCard from './ProductCard'

/**
 * ProductsList — лента, плитка и список карточек товара на одном FlatList.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Card — Products Carousel (203:6296)
 * и Products Grid (203:4766) в видах Grid и List.
 * Карусель — карточки carousel горизонтально с шагом 16; плитка — карточки grid
 * в две колонки с шагом 16 по обеим осям; список — карточки list столбиком с шагом 16.
 *
 * Товар: { id, name, price, source?, brand?, rating?: { value, reviews }, oldPrice?,
 * discount?, actionText? } — строки уже отформатированы, локализация за интегратором.
 *
 * @param {{ layout?: 'carousel'|'grid'|'list', products: Array<object>,
 *           imageAspect?: 'square'|'landscape'|'portrait',
 *           onProductAction?: (product: object) => void,
 *           onProductPress?: (product: object) => void,
 *           onFirstVisibleChanged?: (index: number) => void,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function ProductsList({
  layout = 'carousel',
  products = [],
  imageAspect = 'square',
  onProductAction,
  onProductPress,
  onFirstVisibleChanged,
  renderIcon,
  style,
}) {
  const lastFirst = useRef(-1)
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const first = viewableItems.length ? viewableItems[0].index : -1
    if (first >= 0 && first !== lastFirst.current) {
      lastFirst.current = first
      onFirstVisibleChanged && onFirstVisibleChanged(first)
    }
  }).current

  const renderItem = useCallback(
    ({ item }) => (
      <View style={layout === 'grid' ? styles.gridCell : undefined}>
        <ProductCard
          type={layout}
          source={item.source}
          imageAspect={imageAspect}
          brand={item.brand}
          name={item.name}
          rating={item.rating}
          price={item.price}
          oldPrice={item.oldPrice}
          discount={item.discount}
          actionText={item.actionText}
          onAction={onProductAction ? () => onProductAction(item) : undefined}
          onPress={onProductPress ? () => onProductPress(item) : undefined}
          renderIcon={renderIcon}
        />
      </View>
    ),
    [layout, imageAspect, onProductAction, onProductPress, renderIcon]
  )

  const carousel = layout === 'carousel'
  return (
    <FlatList
      key={layout}
      data={products}
      keyExtractor={(item, index) => item.id || String(index)}
      renderItem={renderItem}
      horizontal={carousel}
      numColumns={layout === 'grid' ? 2 : 1}
      showsHorizontalScrollIndicator={false}
      // Плитка и список сами не скроллят: их высоту задаёт содержимое,
      // прокрутка остаётся за экраном хоста.
      scrollEnabled={carousel}
      ItemSeparatorComponent={carousel ? HorizontalGap : VerticalGap}
      columnWrapperStyle={layout === 'grid' ? styles.gridRow : undefined}
      onViewableItemsChanged={carousel ? onViewableItemsChanged : undefined}
      viewabilityConfig={carousel ? VIEWABILITY : undefined}
      style={style}
    />
  )
}

const VIEWABILITY = { itemVisiblePercentThreshold: 100 }
const HorizontalGap = () => <View style={styles.horizontalGap} />
const VerticalGap = () => <View style={styles.verticalGap} />

const styles = StyleSheet.create({
  horizontalGap: { width: 16 },
  verticalGap: { height: 16 },
  gridRow: { gap: 16 },
  gridCell: { flex: 1 },
})
