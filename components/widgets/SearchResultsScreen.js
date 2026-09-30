import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, FlatList, ScrollView, StyleSheet } from 'react-native'
import { awaitInstance } from '../../lib/facade/facade'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import Catalog from '../design-system/Catalog'
import Filters from '../design-system/Filters'
import SearchResultsTitle from '../design-system/SearchResultsTitle'
import { toCardProduct } from './searchSupport'

const SECTION_PRICE = 'price'
const SECTION_BRANDS = 'brands'
const SECTION_COLORS = 'colors'
const SECTION_SIZES = 'sizes'
const SECTION_FACET = 'facet:'

const EMPTY_APPLIED = { brands: [], priceMin: '', priceMax: '', colors: [], sizes: [], facets: {} }

/** Граница цены без хвоста «.0»: сервер отдаёт число, форматированной строки у него нет. */
const bound = (value) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined)

const defaultFacetTitle = (name) => {
  const spaced = name.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * SearchResultsScreen — экран полной выдачи с данными SDK: заголовок с числом найденного,
 * плитка ⇄ список, теги применённых фильтров, счётчик, «загрузить ещё» или бесконечная
 * прокрутка, пустое состояние и экран фильтров. Виджет сам ходит в
 * `search({type: 'full_search'})` и держит состояние.
 *
 * Паттерн SearchResultsScreen из Figma (страница 1:30), источник — `searchFull(query)`.
 * Визуальный слой — SearchResultsTitle в заголовке Catalog; фильтры — Filters поверх выдачи
 * внутри этого же виджета, так что экран занимает весь отведённый ему экран хоста.
 *
 * Инстанс SDK: `sdk` явно, иначе `shopId` (или единственный зарегистрированный) через
 * `awaitInstance` фасада.
 *
 * Фасеты строятся из ответа: диапазон цены (`price_range`), бренды, цвета и размеры
 * (`industrial_filters`) и произвольные фасеты магазина (`filters`), из которых показываются
 * только те, где больше одного значения. Применённые значения идут тегами в заголовок и
 * параметрами в следующий запрос. Заголовок произвольного фасета — его имя через `facetTitle`.
 *
 * Сортировки: кнопка в заголовке отдаёт `onSortPress` хосту (пикер в макете не нарисован),
 * выбранное хост кладёт в `sortBy` / `sortDir`. Каждый новый запрос трекается событием
 * `search`; нажатие на карточку запоминает источник `full_search` и отдаёт товар через
 * `onProductPress`, кнопка карточки — через `onProductAction`.
 *
 * @param {{ sdk?: object, shopId?: string, query: string, titleText?: string, pageSize?: number,
 *           sortBy?: string|null, sortDir?: string|null, locations?: string,
 *           infiniteScroll?: boolean, showFilters?: boolean, showSort?: boolean,
 *           facets?: string[]|null, productActionText?: string,
 *           layout?: 'grid'|'list', imageAspect?: 'square'|'landscape'|'portrait',
 *           onBack?: Function, onSortPress?: Function,
 *           onProductPress?: (product: object) => void, onProductAction?: (product: object) => void,
 *           onError?: (error: unknown) => void,
 *           foundPrefix?: string, foundSuffix?: string, countPrefix?: string, countSeparator?: string,
 *           loadMoreText?: string, emptyText?: string, filtersTitle?: string, resetText?: string,
 *           applyText?: string, showMoreText?: string, showLessText?: string, priceTitle?: string,
 *           fromLabel?: string, toLabel?: string, brandsTitle?: string, colorsTitle?: string,
 *           sizesTitle?: string, facetTitle?: (name: string) => string,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function SearchResultsScreen({
  sdk: sdkProp,
  shopId,
  query,
  titleText,
  pageSize = 20,
  sortBy = null,
  sortDir = null,
  locations,
  infiniteScroll = false,
  showFilters = true,
  showSort = true,
  facets = null,
  productActionText,
  layout: initialLayout = 'grid',
  imageAspect = 'square',
  onBack,
  onSortPress,
  onProductPress,
  onProductAction,
  onError,
  foundPrefix = 'Found',
  foundSuffix = 'products',
  countPrefix = 'Showing',
  countSeparator = 'of',
  loadMoreText = 'Load more',
  emptyText = 'No results for your request.',
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
  facetTitle = defaultFacetTitle,
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
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  // Первая страница пришла без ошибки: только тогда пустая выдача значит «ничего не нашлось».
  const [loaded, setLoaded] = useState(false)
  const [facetSource, setFacetSource] = useState(null)
  const [applied, setApplied] = useState(EMPTY_APPLIED)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const seq = useRef(0)
  const loadingRef = useRef(false)

  const text = (query || '').trim()

  const request = useCallback(
    (nextPage, currentApplied) => {
      if (!sdk || !text) return
      const current = ++seq.current
      loadingRef.current = true
      setLoading(true)
      const facetValues = {}
      Object.entries(currentApplied.facets).forEach(([name, values]) => {
        if (values.length) facetValues[name] = values
      })
      const options = {
        type: 'full_search',
        search_query: text,
        page: nextPage,
        limit: pageSize,
      }
      if (sortBy) options.sort_by = sortBy
      if (sortDir) options.sort_dir = sortDir
      if (locations) options.locations = locations
      if (currentApplied.brands.length) options.brands = currentApplied.brands.join(',')
      if (currentApplied.priceMin.trim()) options.price_min = currentApplied.priceMin.trim()
      if (currentApplied.priceMax.trim()) options.price_max = currentApplied.priceMax.trim()
      if (currentApplied.colors.length) options.colors = currentApplied.colors.join(',')
      if (currentApplied.sizes.length) options.fashion_sizes = currentApplied.sizes.join(',')
      if (Object.keys(facetValues).length) options.filters = JSON.stringify(facetValues)
      sdk
        .search(options)
        .then((response) => {
          if (current !== seq.current) return
          loadingRef.current = false
          setLoading(false)
          const items = (response && response.products) || []
          setPage(nextPage)
          setTotal((response && response.products_total) || 0)
          setProducts((prev) => (nextPage === 1 ? items : prev.concat(items)))
          if (nextPage === 1) {
            setFacetSource(response || {})
            setLoaded(true)
          }
        })
        .catch((error) => {
          if (current !== seq.current) return
          loadingRef.current = false
          setLoading(false)
          onError && onError(error)
        })
    },
    [sdk, text, pageSize, sortBy, sortDir, locations, onError],
  )

  // Первая страница заново: новый запрос, сортировка, фильтры или инстанс.
  useEffect(() => {
    setProducts([])
    setTotal(0)
    setPage(0)
    setLoaded(false)
    if (!sdk || !text) {
      // Ответ на прежний запрос будет отброшен и лоадер уже не снимет — снимаем здесь,
      // иначе он крутится, а loadMore заблокирован.
      seq.current += 1
      loadingRef.current = false
      setLoading(false)
      return
    }
    sdk.track('search', text)
    request(1, applied)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk, text, sortBy, sortDir, applied])

  const loadMore = useCallback(() => {
    if (!text || loadingRef.current || products.length >= total) return
    request(page + 1, applied)
  }, [text, products.length, total, page, applied, request])

  const hasMore = products.length > 0 && products.length < total

  const productTapped = (product) => {
    if (sdk && text) sdk.trackSource('full_search', text)
    onProductPress && onProductPress(product)
  }

  const findProduct = (card) => products.find((item) => String(item.id) === card.id)

  // --- Фасеты ⇄ секции экрана фильтров -----------------------------------------------------------

  const options = (values, checked) => {
    const seen = new Set()
    return values
      .concat(checked)
      .filter((value) => !seen.has(value) && seen.add(value))
      .map((value) => ({ id: value, label: value, checked: checked.includes(value) }))
  }

  const buildSections = () => {
    const source = facetSource || {}
    const sections = []
    if (source.price_range || applied.priceMin || applied.priceMax) {
      // Границы диапазона — подсказками: в запрос уходит только то, что ввёл пользователь.
      const range = source.price_range || {}
      sections.push({
        id: SECTION_PRICE, kind: 'range', title: priceTitle, fromLabel, toLabel,
        from: applied.priceMin, to: applied.priceMax,
        fromPlaceholder: bound(range.min), toPlaceholder: bound(range.max),
      })
    }
    const brands = (source.brands || []).map((brand) => (typeof brand === 'string' ? brand : brand.name)).filter(Boolean)
    if (brands.length || applied.brands.length) {
      sections.push({ id: SECTION_BRANDS, kind: 'options', title: brandsTitle, options: options(brands, applied.brands), showMoreText, showLessText })
    }
    const colorValues = ((source.industrial_filters || {}).colors || []).map((item) => item.color).filter(Boolean)
    if (colorValues.length || applied.colors.length) {
      sections.push({ id: SECTION_COLORS, kind: 'options', title: colorsTitle, options: options(colorValues, applied.colors), showMoreText, showLessText })
    }
    const sizes = ((source.industrial_filters || {}).fashion_sizes || []).map((item) => item.size).filter(Boolean)
    if (sizes.length || applied.sizes.length) {
      sections.push({ id: SECTION_SIZES, kind: 'options', title: sizesTitle, options: options(sizes, applied.sizes), showMoreText, showLessText })
    }
    Object.entries(source.filters || {}).forEach(([name, facet]) => {
      const values = Object.keys((facet && facet.values) || {})
      const checked = applied.facets[name] || []
      const visible = facets ? facets.includes(name) : values.length > 1
      if (!visible && !checked.length) return
      sections.push({ id: SECTION_FACET + name, kind: 'options', title: facetTitle(name), options: options(values, checked), showMoreText, showLessText })
    })
    return sections
  }

  const fromSections = (sections) => {
    const next = { ...EMPTY_APPLIED, facets: {} }
    sections.forEach((section) => {
      if (section.kind === 'range') {
        if (section.id === SECTION_PRICE) {
          next.priceMin = (section.from || '').trim()
          next.priceMax = (section.to || '').trim()
        }
        return
      }
      const checked = section.options.filter((option) => option.checked).map((option) => option.id)
      if (section.id === SECTION_BRANDS) next.brands = checked
      else if (section.id === SECTION_COLORS) next.colors = checked
      else if (section.id === SECTION_SIZES) next.sizes = checked
      else if (section.id.startsWith(SECTION_FACET)) next.facets[section.id.slice(SECTION_FACET.length)] = checked
    })
    return next
  }

  const appliedTags = useMemo(() => {
    const tags = []
    applied.brands.forEach((brand) =>
      tags.push({ label: brand, onRemove: () => setApplied((prev) => ({ ...prev, brands: prev.brands.filter((b) => b !== brand) })) }),
    )
    if (applied.priceMin || applied.priceMax) {
      const label = [applied.priceMin, applied.priceMax].filter(Boolean).join(' – ')
      tags.push({ label: `${priceTitle} ${label}`, onRemove: () => setApplied((prev) => ({ ...prev, priceMin: '', priceMax: '' })) })
    }
    applied.colors.forEach((color) =>
      tags.push({ label: color, onRemove: () => setApplied((prev) => ({ ...prev, colors: prev.colors.filter((c) => c !== color) })) }),
    )
    applied.sizes.forEach((size) =>
      tags.push({ label: size, onRemove: () => setApplied((prev) => ({ ...prev, sizes: prev.sizes.filter((s) => s !== size) })) }),
    )
    Object.entries(applied.facets).forEach(([name, values]) =>
      values.forEach((value) =>
        tags.push({
          label: value,
          onRemove: () => setApplied((prev) => ({ ...prev, facets: { ...prev.facets, [name]: (prev.facets[name] || []).filter((v) => v !== value) } })),
        }),
      ),
    )
    return tags
  }, [applied, priceTitle])

  const filterSections = useMemo(() => (filtersOpen ? buildSections() : []), [filtersOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <SearchResultsTitle
      title={titleText || query}
      selectedViewIndex={layout === 'grid' ? 0 : 1}
      onViewChange={(index) => setLayout(index === 0 ? 'grid' : 'list')}
      onBack={onBack}
      onFilters={() => setFiltersOpen(true)}
      onSort={onSortPress}
      showFiltersButton={showFilters}
      showSortButton={showSort}
      results={{ prefix: foundPrefix, count: total, suffix: foundSuffix }}
      filters={appliedTags}
      renderIcon={renderIcon}
    />
  )

  const catalog = (
    <Catalog
      header={header}
      layout={layout}
      products={products.map((product) => toCardProduct(product, productActionText))}
      imageAspect={imageAspect}
      // Не во время загрузки первой страницы, не для пустого запроса и не после ошибки.
      emptyText={loaded ? emptyText : undefined}
      loading={loading}
      count={products.length ? { prefix: countPrefix, shown: products.length, separator: countSeparator, total } : undefined}
      loadMoreText={hasMore && !infiniteScroll ? loadMoreText : undefined}
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
        onEndReached={() => infiniteScroll && loadMore()}
      />
      {filtersOpen ? (
        <ScrollView style={[styles.overlay, { backgroundColor: colors.backgroundGeneric }]} contentContainerStyle={styles.content}>
          <Filters
            title={filtersTitle}
            sections={filterSections}
            resetText={resetText}
            applyText={applyText}
            onClose={() => setFiltersOpen(false)}
            onReset={() => {
              setFiltersOpen(false)
              setApplied(EMPTY_APPLIED)
            }}
            onApply={(sections) => {
              setFiltersOpen(false)
              setApplied(fromSections(sections))
            }}
            renderIcon={renderIcon}
          />
        </ScrollView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16 },
  overlay: { ...StyleSheet.absoluteFillObject },
})
