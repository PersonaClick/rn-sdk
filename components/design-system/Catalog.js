import React from 'react'
import { View, StyleSheet } from 'react-native'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'
import ProductsList from './ProductsList'
import EmptyState from './EmptyState'
import Loader from './Loader'
import Count from './Count'
import Button from './Button'

/**
 * Catalog — экран каталога: заголовок, плитка или список товаров, внизу лоадер,
 * счётчик и кнопка «загрузить ещё».
 *
 * Источник: Figma Mobile SDK UI Kit, секция Card — Search results (167:4477) и
 * Category (167:4856). Оба одной формы, разница только в заголовке: у выдачи
 * SearchResultsTitle, у категории Title с переключателем вида. Поэтому заголовок
 * здесь — слот, а не вариант. Три нижних элемента в макете скрываемые
 * (showLoader, showCount, showLoadMore); во фреймах с лоадером (296:3544, 299:6606)
 * счётчика и кнопки нет — на время загрузки лоадер встаёт на их место. Шаг блока 12.
 *
 * Пустая выдача — страница SearchResultsScreen, Search Results/Empty State (319:7743):
 * заголовок тот же, вместо плитки EmptyState. Показывается, когда задан emptyText и
 * товаров нет.
 *
 * Ошибка загрузки в макете не нарисована, поэтому собрана из тех же деталей: текст errorText
 * в EmptyState и под ним кнопка retryText того же вида, что «загрузить ещё». Показывается
 * вместо плитки и пустого состояния, когда задан errorText и товаров нет.
 *
 * @param {{ header?: React.ReactNode, layout?: 'grid'|'list', products: Array<object>,
 *           imageAspect?: 'square'|'landscape'|'portrait', showRating?: boolean,
 *           onProductAction?: (product: object) => void, onProductPress?: (product: object) => void,
 *           emptyText?: string, errorText?: string, retryText?: string, onRetry?: Function,
 *           loading?: boolean,
 *           count?: { prefix: string, shown: number, separator: string, total: number },
 *           loadMoreText?: string, onLoadMore?: Function,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function Catalog({
  header,
  layout = 'grid',
  products = [],
  imageAspect = 'square',
  showRating = true,
  onProductAction,
  onProductPress,
  emptyText,
  errorText,
  retryText,
  onRetry,
  loading = false,
  count,
  loadMoreText,
  onLoadMore,
  renderIcon,
  style,
}) {
  return (
    <View style={[styles.column, style]}>
      {header}
      {products.length === 0 && errorText ? (
        <View style={styles.error}>
          <EmptyState message={errorText} style={styles.errorMessage} />
          {retryText ? (
            <Button
              label={retryText}
              size="md"
              view="secondary"
              iconStart={PERSONALIZATION_ICONS.arrowRotateCw}
              renderIcon={renderIcon}
              onPress={onRetry}
            />
          ) : null}
        </View>
      ) : products.length === 0 && emptyText ? (
        <EmptyState message={emptyText} />
      ) : (
        <ProductsList
          layout={layout}
          products={products}
          imageAspect={imageAspect}
          showRating={showRating}
          onProductAction={onProductAction}
          onProductPress={onProductPress}
          renderIcon={renderIcon}
        />
      )}
      {loading ? <Loader /> : null}
      {count && !loading ? (
        <Count prefix={count.prefix} shown={count.shown} separator={count.separator} total={count.total} />
      ) : null}
      {loadMoreText && !loading ? (
        <Button
          label={loadMoreText}
          size="md"
          view="secondary"
          iconStart={PERSONALIZATION_ICONS.arrowRotateCw}
          renderIcon={renderIcon}
          onPress={onLoadMore}
          style={styles.loadMore}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  column: { gap: 12 },
  loadMore: { alignSelf: 'stretch' },
  // Тот же вертикальный отступ 92, что у EmptyState, но вокруг текста с кнопкой.
  error: { paddingBottom: 92, alignItems: 'center', gap: 16 },
  errorMessage: { paddingBottom: 0, alignSelf: 'stretch' },
})
