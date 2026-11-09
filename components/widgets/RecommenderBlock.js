import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Animated } from 'react-native'
import { awaitInstance, getInstance, isAmbiguousDefault, isInitialized } from '../../lib/facade/facade'
import ProductsBlock from '../design-system/ProductsBlock'
import { LOAD_STATUS } from './loadState'
import { requestCache } from './requestCache'
import {
  createRecommenderLoader,
  peekRecommenderState,
  recommenderCacheKey,
  recommenderProductTouched,
  recommenderSource,
  recommenderView,
} from './recommenderSupport'

/** Появление блока после загрузки, мс. Ответ из кэша появляется сразу. */
const FADE_IN = 150

/** Готовый инстанс без ожидания и побочных эффектов — чтобы ответ кэша показать с первого кадра. */
function readyInstance(shopId) {
  try {
    return isInitialized(shopId) ? getInstance(shopId) : null
  } catch (e) {
    return null
  }
}

/**
 * RecommenderBlock — блок рекомендаций с данными SDK: сам грузит товары и рисует их
 * блоком товаров кита (ProductsBlock) — каруселью, плиткой или списком.
 *
 * Паттерн Recommender block из Figma. Источник — ровно один: `code` — рекомендации
 * (`recommend(code, { extended: 1 })`, заголовок и товары; для «похожих» и «с этим покупают» —
 * `itemId`, `categoryId`, ещё `locations`) или `collectionId` — коллекция (`getCollection`,
 * товары без заголовка). Заголовок: `title` не задан — из ответа, пустая строка — без строки
 * заголовка. Товаров больше `limit` не показывается.
 *
 * Состояния: пока грузится — не рендерится (без скелетона); пришло не меньше `minProducts`
 * товаров — блок, появляется за 150 мс; меньше или пусто — скрыт; ошибка — скрыт и `onError`.
 * После ответа — `onLoaded(count)` (0 у скрытого блока).
 *
 * Загрузка — через общий кэш запросов (10 минут): блок, который лента пересоздала, показывает
 * ответ из кэша сразу, без запроса и без мигания. ref `reload()` — заново мимо кэша (`force`).
 * Новый источник, параметры запроса или инстанс — новая загрузка.
 *
 * Нажатие на товар (`onProductPress`) и на кнопку карточки (`actionText`, `onProductAction`) у
 * блока с `code` сначала запоминает источник `dynamic` с кодом (`trackSource`), потом отдаёт
 * товар кита хосту; у коллекции источник не ставится.
 *
 * Инстанс SDK: `sdk` явно, иначе `shopId` выбирает магазин при нескольких зарегистрированных;
 * без него берётся единственный (резолв — `awaitInstance` фасада). Несколько магазинов без
 * `shopId`, нет источника или заданы оба — `onError`, блок скрыт.
 *
 * @param {object} props см. PersonalizationRecommenderBlockProps в ui.d.ts
 */
function RecommenderBlock(
  {
    code,
    collectionId,
    itemId,
    categoryId,
    locations,
    sdk: sdkProp,
    shopId,
    layout = 'carousel',
    title,
    limit,
    minProducts = 1,
    imageAspect = 'square',
    actionText,
    showAllText,
    onShowAll,
    showDots = false,
    showRating = false,
    onProductPress,
    onProductAction,
    onLoaded,
    onError,
    renderIcon,
    style,
  },
  ref,
) {
  const callbacks = useRef({})
  callbacks.current = { onProductPress, onProductAction, onLoaded, onError }
  const report = useCallback((error) => callbacks.current.onError && callbacks.current.onError(error), [])

  const [resolvedSdk, setResolvedSdk] = useState(() => sdkProp ?? readyInstance(shopId ?? null))
  const [ambiguous, setAmbiguous] = useState(false)
  useEffect(() => {
    setAmbiguous(false)
    if (sdkProp) {
      setResolvedSdk(sdkProp)
      return undefined
    }
    if (isAmbiguousDefault(shopId ?? null)) {
      setAmbiguous(true)
      report(new Error('PersonalizationRecommenderBlock: several shops are registered — pass shopId or sdk.'))
      return undefined
    }
    return awaitInstance(shopId ?? null, (instance) => setResolvedSdk(instance))
  }, [sdkProp, shopId, report])
  // Инстанс прежнего магазина не грузит блок нового, пока тот не резолвился.
  const matches = resolvedSdk && (shopId == null || resolvedSdk.shop_id === shopId)
  const sdk = sdkProp ?? (ambiguous || !matches ? null : resolvedSdk)

  const source = useMemo(
    () => recommenderSource({ code, collectionId, itemId, categoryId, locations }),
    [code, collectionId, itemId, categoryId, locations],
  )
  useEffect(() => {
    if (source.error) report(source.error)
  }, [source, report])

  const viewOptions = useRef({})
  viewOptions.current = { title, limit, minProducts, actionText }
  const [state, setState] = useState(null)
  const loaderRef = useRef(null)
  if (!loaderRef.current) {
    loaderRef.current = createRecommenderLoader({
      cache: requestCache,
      viewOptions: () => viewOptions.current,
      onChange: setState,
      onLoaded: (count) => callbacks.current.onLoaded && callbacks.current.onLoaded(count),
      onError: report,
    })
  }
  const loader = loaderRef.current
  useEffect(() => {
    loader.start(sdk, source)
    return () => loader.cancel()
  }, [loader, sdk, source])
  useImperativeHandle(ref, () => ({ reload: () => loader.reload() }), [loader])

  // До эффекта загрузки (первый кадр, новый источник) — состояние по кэшу, без мигания.
  const key = sdk && !source.error ? recommenderCacheKey(sdk.shop_id, source) : null
  const current = state && state.key === key ? state : peekRecommenderState(requestCache, key)
  const data = current.status === LOAD_STATUS.CONTENT ? current.data : null
  const view = useMemo(
    () => recommenderView(data, { title, limit, minProducts, actionText }),
    [data, title, limit, minProducts, actionText],
  )

  // Появление: после загрузки — короткий fade, ответ кэша с первого кадра — сразу.
  const opacity = useRef(new Animated.Value(view.visible ? 1 : 0)).current
  const wasVisible = useRef(view.visible)
  useEffect(() => {
    if (view.visible && !wasVisible.current) {
      Animated.timing(opacity, { toValue: 1, duration: FADE_IN, useNativeDriver: true }).start()
    } else if (!view.visible) {
      opacity.setValue(0)
    }
    wasVisible.current = view.visible
  }, [view.visible, opacity])

  const productPressed = useCallback(
    (product) => recommenderProductTouched(sdk, source, product, callbacks.current.onProductPress),
    [sdk, source],
  )
  const productAction = useCallback(
    (product) => recommenderProductTouched(sdk, source, product, callbacks.current.onProductAction),
    [sdk, source],
  )

  if (!view.visible) return null

  return (
    <Animated.View style={[{ opacity }, style]}>
      <ProductsBlock
        layout={layout}
        title={view.title}
        products={view.products}
        imageAspect={imageAspect}
        showRating={showRating}
        showAllText={showAllText}
        onShowAll={onShowAll}
        showDots={showDots}
        onProductPress={onProductPress ? productPressed : undefined}
        onProductAction={onProductAction ? productAction : undefined}
        renderIcon={renderIcon}
      />
    </Animated.View>
  )
}

const PersonalizationRecommenderBlock = forwardRef(RecommenderBlock)
PersonalizationRecommenderBlock.displayName = 'PersonalizationRecommenderBlock'

export default PersonalizationRecommenderBlock
