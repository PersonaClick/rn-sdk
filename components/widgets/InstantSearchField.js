import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { awaitInstance } from '../../lib/facade/facade'
import InstantSearch from '../design-system/InstantSearch'
import { RecentSearches, createInstantSearchLoader, parentName } from './searchSupport'
import { toPersonalizationProduct } from './productSupport'

/**
 * InstantSearchField — мгновенный поиск с данными SDK: поле ввода, недавние запросы,
 * подсказки, категории и товары. Виджет сам ходит в `search({type: 'instant_search'})` /
 * `searchBlank()` и держит состояние.
 *
 * Паттерн InstantSearchField из Figma (страница 1:29): «компонент владеет вводом»,
 * источник — `searchInstant(query)`. Визуальный слой — InstantSearch.
 *
 * Инстанс SDK: `sdk` явно, иначе `shopId` выбирает магазин при нескольких зарегистрированных;
 * без него берётся единственный. Резолв — через `awaitInstance` фасада, дожидается регистрации.
 *
 * Пока запрос короче `minChars` показывается пустое состояние: история запросов
 * (локальная, по магазину, в AsyncStorage), а из `searchBlank` — товары и популярные
 * категории; популярные фразы (`suggests`) подставляются тегами, только если истории нет.
 * При вводе после `debounce` уходит instant-поиск: фразы из `queries` — тегами, категории
 * и товары — строками. Ответ на устаревший запрос отбрасывается. Ошибка — и отклонённый
 * промис, и ответ-ошибка метода SDK — уходит в `onError`, как в экране выдачи.
 *
 * Нажатие на товар или категорию запоминает источник `instant_search` (`trackSource`) и
 * отдаёт объект хосту; отправка кладёт фразу в историю и вызывает `onSubmit` — экран полной
 * выдачи открывает хост, событие `search` трекает SearchResultsScreen.
 *
 * @param {{ sdk?: object, shopId?: string, debounce?: number, minChars?: number,
 *           productsLimit?: number, categoriesLimit?: number, suggestionsLimit?: number,
 *           recentLimit?: number, recentCollapsed?: number,
 *           showRecent?: boolean, showSuggestions?: boolean, showCategories?: boolean,
 *           showProducts?: boolean, showImages?: boolean, locations?: string,
 *           placeholder?: string, cancelText?: string, recentLabel?: string, clearText?: string,
 *           moreText?: string, categoriesLabel?: string, productsLabel?: string,
 *           onSubmit?: (query: string) => void, onCancel?: Function,
 *           onProductPress?: (product: object) => void,
 *           onCategoryPress?: (category: { id: string|null, name: string, url: string|null }) => void,
 *           onError?: (error: unknown) => void,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function InstantSearchField({
  sdk: sdkProp,
  shopId,
  debounce = 300,
  minChars = 2,
  productsLimit = 5,
  categoriesLimit = 3,
  suggestionsLimit = 8,
  recentLimit = 10,
  recentCollapsed = 5,
  showRecent = true,
  showSuggestions = true,
  showCategories = true,
  showProducts = true,
  showImages = true,
  locations,
  placeholder,
  cancelText,
  recentLabel,
  clearText,
  moreText,
  categoriesLabel,
  productsLabel,
  onSubmit,
  onCancel,
  onProductPress,
  onCategoryPress,
  onError,
  renderIcon,
  style,
}) {
  const [resolvedSdk, setResolvedSdk] = useState(sdkProp ?? null)
  useEffect(() => {
    if (sdkProp) {
      setResolvedSdk(sdkProp)
      return undefined
    }
    return awaitInstance(shopId ?? null, (instance) => setResolvedSdk(instance))
  }, [sdkProp, shopId])
  const sdk = sdkProp ?? resolvedSdk

  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState([])
  const [recentExpanded, setRecentExpanded] = useState(false)
  const [blank, setBlank] = useState(null)
  const [instant, setInstant] = useState(null)
  const timer = useRef(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const loaderRef = useRef(null)
  if (!loaderRef.current) {
    loaderRef.current = createInstantSearchLoader({
      onBlank: setBlank,
      onInstant: setInstant,
      onError: (error) => onErrorRef.current && onErrorRef.current(error),
    })
  }
  const loader = loaderRef.current
  // После размонтирования ответы в полёте отбрасываются, onError не зовётся.
  useEffect(() => () => loader.cancel(), [loader])

  const store = useMemo(
    () => (sdk ? new RecentSearches(sdk.shop_id || shopId || 'default', recentLimit) : null),
    [sdk, shopId, recentLimit],
  )

  const typing = query.trim().length >= minChars

  // Инстанс появился: история из хранилища и пустое состояние с сервера.
  useEffect(() => {
    if (!sdk || !store) return undefined
    let alive = true
    store.load().then((items) => alive && setRecent(items))
    loader.blank(sdk)
    return () => {
      alive = false
    }
  }, [sdk, store, loader])

  const runInstant = useCallback(
    (text) => {
      if (sdk) loader.instant(sdk, text, locations)
    },
    [sdk, locations, loader],
  )

  const typed = useCallback(
    (text) => {
      setQuery(text)
      if (timer.current) clearTimeout(timer.current)
      if (text.trim().length < minChars) {
        loader.clearInstant()
        setInstant(null)
        return
      }
      timer.current = setTimeout(() => runInstant(text.trim()), debounce)
    },
    [minChars, debounce, runInstant, loader],
  )
  useEffect(() => () => timer.current && clearTimeout(timer.current), [])

  const submit = useCallback(
    (text) => {
      const trimmed = String(text || '').trim()
      if (!trimmed) return
      setRecentExpanded(false)
      if (store) store.add(trimmed).then(setRecent)
      onSubmit && onSubmit(trimmed)
    },
    [store, onSubmit],
  )

  const rememberSource = useCallback(() => {
    const text = query.trim()
    if (sdk && text) sdk.trackSource('instant_search', text)
  }, [sdk, query])

  // --- Раскладка данных по визуальному слою -----------------------------------------------------

  const products = (typing ? instant?.products : blank?.products) || []
  const categories = typing ? instant?.categories || [] : []
  const popular = !typing ? blank?.popular_categories || [] : []
  const queries = typing ? instant?.queries || [] : []

  const recentItems = !typing && showRecent ? recent : []
  const collapsed = !recentExpanded && recentItems.length > recentCollapsed
  const recentShown = collapsed ? recentItems.slice(0, recentCollapsed) : recentItems
  const suggestions = typing
    ? showSuggestions
      ? queries.map((item) => item.name).slice(0, suggestionsLimit)
      : []
    : showSuggestions && recentItems.length === 0
      ? (blank?.suggests || []).map((item) => item.name).slice(0, suggestionsLimit)
      : []

  const categoryRows = showCategories
    ? typing
      ? categories.slice(0, categoriesLimit).map((category) => ({
          id: category.id,
          title: category.name,
          subtitle: parentName(category, categories),
          raw: { id: category.id, name: category.name, url: category.url || null },
        }))
      : popular.slice(0, categoriesLimit).map((item) => ({
          id: item.url || item.name,
          title: item.name,
          raw: { id: null, name: item.name, url: item.url || null },
        }))
    : []
  const productRows = showProducts
    ? products.slice(0, productsLimit).map((product) => {
        const card = toPersonalizationProduct(product, null)
        return {
          id: card.id,
          title: card.name,
          subtitle: card.price,
          source: showImages ? card.source : undefined,
          raw: product,
        }
      })
    : []

  return (
    <InstantSearch
      query={query}
      placeholder={placeholder}
      cancelText={cancelText}
      onCancel={onCancel}
      onQueryChange={typed}
      onSubmit={submit}
      recentLabel={recentLabel}
      clearText={clearText}
      onClearRecent={() => store && store.clear().then(setRecent)}
      recentSearches={recentShown}
      moreText={collapsed ? moreText : undefined}
      onMoreRecent={() => setRecentExpanded(true)}
      onRecentPress={(item) => {
        setQuery(item)
        submit(item)
      }}
      onRecentRemove={(item) => store && store.remove(item).then(setRecent)}
      suggestions={suggestions}
      onSuggestionPress={(item) => {
        setQuery(item)
        submit(item)
      }}
      categoriesLabel={categoriesLabel}
      categories={categoryRows}
      onCategoryPress={(row) => {
        rememberSource()
        onCategoryPress && onCategoryPress(row.raw)
      }}
      productsLabel={productsLabel}
      products={productRows}
      onProductPress={(row) => {
        rememberSource()
        onProductPress && onProductPress(row.raw)
      }}
      renderIcon={renderIcon}
      style={style}
    />
  )
}
