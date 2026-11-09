import React, { useState } from 'react'
import { View } from 'react-native'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'
import Title from './Title'
import Button from './Button'
import Dots from './Dots'
import ProductsList from './ProductsList'

/**
 * ProductsBlock — блок товаров: заголовок, товары, у карусели — точки. Товары даёт хост;
 * блок рекомендаций с данными SDK (widgets/RecommenderBlock) рисуется им же.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Card — Recommender/Carousel (90:655),
 * Recommender/Grid (126:1944), Recommender/List (126:2551).
 * У карусели заголовок с кнопкой «Show all» и точки под лентой, шаг блока 16;
 * у плитки и списка только заголовок, шаг 12. Пустой заголовок — без строки заголовка
 * (и без «Show all»).
 *
 * Собран из Title, Button, ProductsList, Dots.
 *
 * @param {{ layout?: 'carousel'|'grid'|'list', title?: string, showAllText?: string,
 *           onShowAll?: Function, showDots?: boolean, products: Array<object>,
 *           imageAspect?: 'square'|'landscape'|'portrait', showRating?: boolean,
 *           onProductAction?: (product: object) => void,
 *           onProductPress?: (product: object) => void,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function ProductsBlock({
  layout = 'carousel',
  title,
  showAllText,
  onShowAll,
  showDots = false,
  products = [],
  imageAspect = 'square',
  showRating = true,
  onProductAction,
  onProductPress,
  renderIcon,
  style,
}) {
  const [page, setPage] = useState(0)
  const carousel = layout === 'carousel'

  return (
    <View style={[{ gap: carousel ? 16 : 12 }, style]}>
      {title ? (
        <Title
          title={title}
          trailing={
            carousel && showAllText ? (
              <Button
                label={showAllText}
                size="sm"
                view="ghost"
                iconEnd={PERSONALIZATION_ICONS.angleLargeRight}
                renderIcon={renderIcon}
                onPress={onShowAll}
              />
            ) : null
          }
        />
      ) : null}
      <ProductsList
        layout={layout}
        products={products}
        imageAspect={imageAspect}
        showRating={showRating}
        onProductAction={onProductAction}
        onProductPress={onProductPress}
        onFirstVisibleChanged={carousel ? setPage : undefined}
        renderIcon={renderIcon}
      />
      {carousel && showDots ? <Dots count={products.length} selectedIndex={page} /> : null}
    </View>
  )
}
