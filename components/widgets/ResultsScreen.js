import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { View, FlatList, StyleSheet } from 'react-native'
import { awaitInstance } from '../../lib/facade/facade'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import Catalog from '../design-system/Catalog'
import Filters from '../design-system/Filters'
import SearchResultsTitle from '../design-system/SearchResultsTitle'
import { toPersonalizationProduct } from './productSupport'
import {
  DEFAULT_MAX_FACETS,
  EMPTY_APPLIED,
  RESULTS_ERROR_TEXT,
  RESULTS_PAGES_INITIAL,
  RESULTS_RETRY_TEXT,
  appliedFilterTags,
  appliedFromSections,
  filterSections,
  resultsPagesReducer,
  resultsRequestOptions,
  resultsView,
} from './resultsSupport'

/**
 * ResultsScreen — общее ядро экранов выдачи с данными SDK (SearchResultsScreen, CategoryScreen):
 * заголовок с числом найденного, плитка ⇄ список, теги применённых фильтров, счётчик,
 * «загрузить ещё» или бесконечная прокрутка, пустое состояние, ошибка с «Повторить» и экран
 * фильтров. Наружу не отдаётся: экраны задают источник и свои тексты по умолчанию.
 *
 * Источник — `source` (запрос поиска, id категории; пустой — ничего не грузится), его параметры
 * без фильтров — `requestBase`, загрузчик страниц — `createLoader` (запрос SDK и трекинг новой
 * первой страницы), `onProductTap(sdk, product)` — что сделать до `onProductPress` (источник
 * трекинга).
 *
 * Подписи вариантов фильтров и тегов — см. filterSections и appliedFilterTags.
 *
 * Новая первая страница — новый источник, сортировка, фильтры или инстанс. Инстанс SDK: `sdk`
 * явно, иначе `shopId` (или единственный зарегистрированный) через `awaitInstance` фасада.
 */
export default function ResultsScreen({
  sdk: sdkProp,
  shopId,
  source,
  requestBase,
  createLoader,
  onProductTap,
  title,
  pageSize = 20,
  sortBy = null,
  sortDir = null,
  locations,
  infiniteScroll = false,
  showFilters = true,
  showSort = true,
  facets = null,
  maxFacets = DEFAULT_MAX_FACETS,
  productActionText,
  showRating = false,
  layout: initialLayout = 'grid',
  imageAspect = 'square',
  onBack,
  onSortPress,
  onProductPress,
  onProductAction,
  onError,
  foundPrefix,
  foundSuffix,
  countPrefix = 'Showing',
  countSeparator = 'of',
  loadMoreText = 'Load more',
  emptyText,
  errorText = RESULTS_ERROR_TEXT,
  retryText = RESULTS_RETRY_TEXT,
  filtersTitle = 'Filters',
  resetText = 'Reset',
  applyText = 'Apply',
  showMoreText = 'Show more',
  showLessText = 'Show less',
  priceTitle = 'Price',
  fromLabel = 'From',
  toLabel = 'to',
  brandsTitle = 'Brand',
  colorsTitle = 'Color',
  sizesTitle = 'Size',
  facetTitle,
  facetValueTitle,
  showValueCounts = true,
  renderIcon,
  style,
}) {
  const { colors } = usePersonalizationTheme()
  const [resolvedSdk, setResolvedSdk] = useState(sdkProp ?? null)
  useEffect(() => {
    if (sdkProp) {
      setResolvedSdk(sdkProp)
      return undefined
    }
    return awaitInstance(shopId ?? null, (instance) => setResolvedSdk(instance))
  }, [sdkProp, shopId])
  const sdk = sdkProp ?? resolvedSdk

  const [layout, setLayout] = useState(initialLayout)
  const [pages, dispatch] = useReducer(resultsPagesReducer, RESULTS_PAGES_INITIAL)
  const { products, total, loading } = pages
  const [facetSource, setFacetSource] = useState(null)
  const [applied, setApplied] = useState(EMPTY_APPLIED)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const loaderRef = useRef(null)
  if (!loaderRef.current) {
    loaderRef.current = createLoader({
      dispatch,
      onFirstPage: (response) => setFacetSource(response),
      onError: (error) => onErrorRef.current && onErrorRef.current(error),
    })
  }
  const loader = loaderRef.current
  // После размонтирования ответы в полёте отбрасываются, onError не зовётся. В StrictMode эффект
  // перезапускается вместе с эффектом первой страницы, и та грузится заново.
  useEffect(() => () => loader.cancel(), [loader])

  // Параметры запроса без номера страницы.
  const requestOptions = (currentApplied) =>
    resultsRequestOptions(requestBase, currentApplied, { pageSize, sortBy, sortDir, locations })

  // Первая страница заново: новый источник, сортировка, фильтры или инстанс. Сброс снимает и
  // лоадер: ответ на прежний запрос будет отброшен и сам его уже не снимет.
  useEffect(() => {
    loader.start(sdk, source, requestOptions(applied))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk, source, sortBy, sortDir, applied])

  const view = resultsView(pages, { emptyText, errorText, retryText, loadMoreText, infiniteScroll })

  // Кнопка под выдачей: следующая страница или повтор упавшей.
  const loadMore = () => {
    if (source) loader.page(sdk, view.loadMorePage, requestOptions(applied))
  }

  // Бесконечная прокрутка; после ошибки догрузка только кнопкой.
  const endReached = () => {
    if (view.autoLoadMore) loadMore()
  }

  const retryFirstPage = () => {
    if (source) loader.page(sdk, 1, requestOptions(applied))
  }

  const productTapped = (product) => {
    if (sdk && onProductTap) onProductTap(sdk, product)
    onProductPress && onProductPress(product)
  }

  const findProduct = (card) => products.find((item) => String(item.id) === card.id)

  const appliedTags = useMemo(
    () =>
      appliedFilterTags(applied, { priceTitle, facetValueTitle }).map((tag) => ({
        label: tag.label,
        onRemove: () => setApplied(tag.remove),
      })),
    [applied, priceTitle, facetValueTitle],
  )

  // Секции собираются при открытии экрана фильтров — из ответа первой страницы.
  const filterSectionsShown = useMemo(
    () =>
      filtersOpen
        ? filterSections(facetSource, applied, {
            facets, maxFacets, facetTitle, facetValueTitle, showValueCounts, priceTitle, fromLabel, toLabel,
            brandsTitle, colorsTitle, sizesTitle, showMoreText, showLessText,
          })
        : [],
    [filtersOpen], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const header = (
    <SearchResultsTitle
      title={title}
      selectedViewIndex={layout === 'grid' ? 0 : 1}
      onViewChange={(index) => setLayout(index === 0 ? 'grid' : 'list')}
      onBack={onBack}
      onFilters={() => setFiltersOpen(true)}
      onSort={onSortPress}
      showFiltersButton={showFilters}
      showSortButton={showSort}
      results={{ prefix: foundPrefix, count: view.foundCount, suffix: foundSuffix }}
      filters={appliedTags}
      renderIcon={renderIcon}
    />
  )

  const catalog = (
    <Catalog
      header={header}
      layout={layout}
      products={products.map((product) => toPersonalizationProduct(product, productActionText))}
      imageAspect={imageAspect}
      showRating={showRating}
      // Не во время загрузки первой страницы, не для пустого источника и не после ошибки.
      emptyText={view.emptyText}
      errorText={view.errorText}
      retryText={view.retryText}
      onRetry={retryFirstPage}
      loading={loading}
      count={products.length ? { prefix: countPrefix, shown: products.length, separator: countSeparator, total } : undefined}
      loadMoreText={view.loadMoreText}
      onLoadMore={loadMore}
      onProductPress={(card) => {
        const product = findProduct(card)
        if (product) productTapped(product)
      }}
      onProductAction={(card) => {
        const product = findProduct(card)
        if (product && onProductAction) onProductAction(product)
      }}
      renderIcon={renderIcon}
    />
  )

  return (
    <View style={[styles.screen, { backgroundColor: colors.backgroundGeneric }, style]}>
      {/* Внешний скролл — FlatList, а не ScrollView: плитка и список внутри сами FlatList,
          и вложение в ScrollView той же ориентации RN считает ошибкой. */}
      <FlatList
        data={[0]}
        keyExtractor={() => 'catalog'}
        renderItem={() => catalog}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.5}
        onEndReached={endReached}
      />
      {filtersOpen ? (
        <View style={[styles.overlay, styles.content, { backgroundColor: colors.backgroundGeneric }]}>
          <Filters
            style={styles.filters}
            title={filtersTitle}
            sections={filterSectionsShown}
            resetText={resetText}
            applyText={applyText}
            onClose={() => setFiltersOpen(false)}
            onReset={() => {
              setFiltersOpen(false)
              setApplied(EMPTY_APPLIED)
            }}
            onApply={(sections) => {
              setFiltersOpen(false)
              setApplied(appliedFromSections(sections))
            }}
            renderIcon={renderIcon}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16 },
  overlay: { ...StyleSheet.absoluteFillObject },
  // Экран фильтров на всю высоту: заголовок и кнопки на месте, прокручиваются секции.
  filters: { flex: 1 },
})
