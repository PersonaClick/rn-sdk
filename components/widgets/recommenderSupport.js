import { toPersonalizationProduct } from './productSupport'
import { LOAD_STATUS, LoadState } from './loadState'
import { requestCache, requestCacheKey } from './requestCache'
import { sdkError, sdkResult } from './sdkResult'

/**
 * Блок рекомендаций без UI: источник, запрос, ключ кэша, что показать, загрузка и нажатие.
 * Виджет — RecommenderBlock.
 */

/** Значение параметра запроса: непустая строка, число — строкой; иначе `undefined` (не шлётся). */
function param(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return undefined
}

/**
 * Источник блока — ровно один: `code` (рекомендации) или `collectionId` (коллекция). Нет ни
 * одного или заданы оба — `{ error }`. `itemId`, `categoryId` («похожие», «с этим покупают») и
 * `locations` — только у рекомендаций; в запрос идут под именами API `item`, `category`,
 * `locations`, пустые не шлются (слой запросов отправил бы undefined строкой).
 *
 * @returns {{ kind: 'recommend', code: string, params: object }
 *   | { kind: 'collection', collectionId: string } | { error: Error }}
 */
export function recommenderSource({ code, collectionId, itemId, categoryId, locations } = {}) {
  const recommender = param(code)
  const collection = param(collectionId)
  if (recommender && collection) {
    return { error: new Error('PersonalizationRecommenderBlock: pass either code or collectionId, not both.') }
  }
  if (collection) return { kind: 'collection', collectionId: collection }
  if (!recommender) return { error: new Error('PersonalizationRecommenderBlock: code or collectionId is required.') }
  const params = {}
  if (param(itemId)) params.item = param(itemId)
  if (param(categoryId)) params.category = param(categoryId)
  if (param(locations)) params.locations = param(locations)
  return { kind: 'recommend', code: recommender, params }
}

/** Ключ общего кэша: магазин, вид запроса и всё, от чего зависит ответ. */
export function recommenderCacheKey(shopId, source) {
  if (source.kind === 'collection') {
    return requestCacheKey(shopId, 'collection', { collectionId: source.collectionId })
  }
  const { item, category, locations } = source.params
  return requestCacheKey(shopId, 'recommend', { code: source.code, itemId: item, categoryId: category, locations })
}

/** Ответ рекомендаций `extended`: объект со списком товаров `recommends`. */
const isRecommendResponse = (response) => !!response && typeof response === 'object' && Array.isArray(response.recommends)

const productsOnly = (list) => (Array.isArray(list) ? list.filter((item) => item && typeof item === 'object') : [])

/**
 * Запрос блока → `{ title, products }` с сырыми товарами API. Рекомендации —
 * `recommend(code, { extended: 1, … })`: заголовок и товары (`recommends`). Коллекция —
 * `getCollection(collectionId)`: товары без заголовка. Ответ-ошибка — отклонённый промис.
 *
 * @returns {Promise<{ title: string|null, products: object[] }>}
 */
export function loadRecommender(sdk, source) {
  if (source.kind === 'collection') {
    return sdkResult(sdk.getCollection(source.collectionId)).then((response) => {
      // Тело-ошибку getCollection не отклоняет, а разбирает как пустую коллекцию: оно в `raw`.
      const error = sdkError(response && response.raw)
      if (error) throw error
      return { title: null, products: productsOnly(response && response.products) }
    })
  }
  return sdkResult(sdk.recommend(source.code, { extended: 1, ...source.params }), isRecommendResponse).then(
    (response) => ({
      title: typeof response.title === 'string' ? response.title : null,
      products: productsOnly(response.recommends),
    }),
  )
}

/**
 * Что показать по ответу: товары кита (не больше `limit`), заголовок и виден ли блок.
 *
 * Заголовок: `title` не задан (undefined, null) — из ответа (у коллекции его нет), пустая
 * строка — без строки заголовка. Блок виден, только если товаров не меньше `minProducts` (и
 * хотя бы один); `count` — сколько показано, 0 у скрытого. `limit` не больше нуля — без обрезки.
 *
 * @param {{ title: string|null, products: object[] }|null} data
 * @param {{ title?: string|null, limit?: number, minProducts?: number, actionText?: string,
 *           os?: string }} [options]
 */
export function recommenderView(data, { title, limit, minProducts = 1, actionText, os } = {}) {
  const all = data ? data.products : []
  const max = Math.floor(Number(limit))
  const shown = max > 0 ? all.slice(0, max) : all
  const visible = shown.length > 0 && shown.length >= (Math.floor(Number(minProducts)) || 1)
  return {
    visible,
    count: visible ? shown.length : 0,
    title: title != null ? String(title) : (data && data.title) || '',
    products: visible ? shown.map((product) => toPersonalizationProduct(product, actionText, os)) : [],
  }
}

/** Ответ в состояние загрузки с ключом: пустой список — Empty. */
function settled(key, data) {
  return { key, ...(data && data.products.length ? LoadState.content(data) : LoadState.empty) }
}

/**
 * Состояние ключа без запроса: свежий ответ кэша — сразу Content/Empty, иначе Loading;
 * без ключа (нет инстанса или источника) — Idle. Виджет рисует его до эффекта загрузки, чтобы
 * блок, пересозданный лентой, показал ответ с первого кадра.
 */
export function peekRecommenderState(cache, key) {
  if (key == null) return { key: null, ...LoadState.idle }
  const cached = cache.peek(key)
  return cached === undefined ? { key, ...LoadState.loading } : settled(key, cached)
}

/**
 * Нажатие на товар или на кнопку карточки («в корзину» прямо из блока — главный случай
 * атрибуции): у блока с кодом — источник `dynamic` с кодом блока (атрибуция следующих событий,
 * 48 ч), потом товар хосту (`callback`). У коллекции источник не ставится.
 */
export function recommenderProductTouched(sdk, source, product, callback) {
  if (sdk && source && source.kind === 'recommend' && typeof sdk.trackSource === 'function') {
    try {
      sdk.trackSource('dynamic', source.code)
    } catch (e) {
      // Атрибуция — не причина ронять нажатие.
    }
  }
  if (callback) callback(product)
}

/**
 * Загрузка блока. Свежий ответ кэша — сразу, без запроса и без Loading (блок, пересозданный
 * лентой, не мигает); иначе Loading (блок скрыт) и запрос через общий кэш: одинаковые блоки
 * ждут один ответ. Состояние — LoadState с ключом кэша, чтобы виджет не показал ответ
 * прежнего источника.
 *
 * После каждого ответа — `onLoaded(count)` (сколько показано, 0 у скрытого блока, по текущим
 * `viewOptions()`) или `onError(error)`. `reload()` грузит заново с `force` — мимо кэша и мимо
 * запроса в полёте; показанный ответ остаётся на экране до нового. `cancel()` — размонтирование:
 * ответ в полёте больше никуда не доходит.
 *
 * @param {{ cache?: object, viewOptions?: () => object, onChange?: (state: object) => void,
 *           onLoaded?: (count: number) => void, onError?: (error: unknown) => void }} [options]
 */
export function createRecommenderLoader({ cache = requestCache, viewOptions = () => ({}), onChange, onLoaded, onError } = {}) {
  let state = { key: null, ...LoadState.idle }
  let request = null // { key, loader } последней загрузки — для reload()
  let unsubscribe = null

  const set = (next) => {
    state = next
    if (onChange) onChange(next)
  }

  const settle = (next) => {
    set(next)
    if (next.status === LOAD_STATUS.ERROR) {
      if (onError) onError(next.error)
    } else if (onLoaded) {
      onLoaded(recommenderView(next.data || null, viewOptions()).count)
    }
  }

  const stop = () => {
    if (unsubscribe) unsubscribe()
    unsubscribe = null
  }

  const fetch = (force) => {
    stop()
    const { key, loader } = request
    // Повтор при показанном ответе его не прячет: новый ответ просто заменит его.
    const keep = force && state.key === key && state.status === LOAD_STATUS.CONTENT
    if (!keep) set({ key, ...LoadState.loading })
    unsubscribe = cache.subscribe(key, loader, {
      force,
      onValue: (data) => settle(settled(key, data)),
      onError: (error) => settle({ key, ...LoadState.error(error) }),
    })
  }

  return {
    get state() {
      return state
    },

    /** Новый источник или инстанс. Без них — Idle, блок скрыт. */
    start(sdk, source) {
      stop()
      if (!sdk || !source || source.error) {
        request = null
        set({ key: null, ...LoadState.idle })
        return
      }
      const key = recommenderCacheKey(sdk.shop_id, source)
      request = { key, loader: () => loadRecommender(sdk, source) }
      const cached = cache.peek(key)
      if (cached !== undefined) settle(settled(key, cached))
      else fetch(false)
    },

    /** Заново с `force`. До первой загрузки — ничего. */
    reload() {
      if (request) fetch(true)
    },

    cancel() {
      stop()
      request = null
    },
  }
}
