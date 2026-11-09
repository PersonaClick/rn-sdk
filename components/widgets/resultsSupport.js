import { sdkResult } from './sdkResult'

/**
 * Общее ядро экранов выдачи — поиска (SearchResultsScreen) и категории (CategoryScreen) — без
 * UI: параметры запроса, фасеты ⇄ секции экрана фильтров, страницы выдачи и их загрузка.
 * Экраны отличаются только источником: запросом SDK, событием трекинга и источником по нажатию.
 */

export const SECTION_PRICE = 'price'
export const SECTION_BRANDS = 'brands'
export const SECTION_COLORS = 'colors'
export const SECTION_SIZES = 'sizes'
export const SECTION_FACET = 'facet:'

/** Применённые фильтры: бренды, цена (строками, как введена), цвета, размеры, фасеты магазина. */
export const EMPTY_APPLIED = Object.freeze({ brands: [], priceMin: '', priceMax: '', colors: [], sizes: [], facets: {} })

/** Сколько произвольных фасетов показывать без явного списка `facets`. */
export const DEFAULT_MAX_FACETS = 10

/**
 * Параметры запроса выдачи без номера страницы: `base` источника (у поиска — тип и запрос, у
 * категории — ничего), размер страницы, сортировка, локации и применённые фильтры. Ключи только
 * со значением: слой запросов SDK шлёт undefined строкой «undefined».
 *
 * @param {object} base
 * @param {object} applied см. EMPTY_APPLIED
 * @param {{ pageSize?: number, sortBy?: string|null, sortDir?: string|null, locations?: string }} options
 */
export function resultsRequestOptions(base, applied, { pageSize, sortBy, sortDir, locations }) {
  const facetValues = {}
  Object.entries(applied.facets).forEach(([name, values]) => {
    if (values.length) facetValues[name] = values
  })
  const options = { ...base, limit: pageSize }
  if (sortBy) options.sort_by = sortBy
  if (sortDir) options.sort_dir = sortDir
  if (locations) options.locations = locations
  if (applied.brands.length) options.brands = applied.brands.join(',')
  if (applied.priceMin.trim()) options.price_min = applied.priceMin.trim()
  if (applied.priceMax.trim()) options.price_max = applied.priceMax.trim()
  if (applied.colors.length) options.colors = applied.colors.join(',')
  if (applied.sizes.length) options.fashion_sizes = applied.sizes.join(',')
  if (Object.keys(facetValues).length) options.filters = JSON.stringify(facetValues)
  return options
}

/**
 * Какие произвольные фасеты (`filters` ответа) показать и в каком порядке.
 *
 * Явный список `facets` хоста главнее: его фасеты, что есть в ответе, в порядке хоста. Без него —
 * фасеты больше чем с одним значением по `count` (сколько товаров их имеют) по убыванию, при
 * равенстве — в порядке ответа, первые `maxFacets` (`null` или 0 — все): у категории их сотни, а
 * приоритета в ответе нет. Фасет с выбранными значениями показывается всегда, в конце, если не
 * попал в список, — иначе выбор не снять.
 *
 * @param {object} filters `filters` ответа: `{ [name]: { count, values: { [value]: count } } }`
 * @param {{ facets?: string[]|null, maxFacets?: number|null, checked?: Record<string, string[]> }} options
 * @returns {string[]}
 */
export function visibleFacets(filters, { facets = null, maxFacets = DEFAULT_MAX_FACETS, checked = {} } = {}) {
  const all = filters && typeof filters === 'object' ? filters : {}
  const has = (name) => Object.prototype.hasOwnProperty.call(all, name)
  const valueCount = (name) => Object.keys((all[name] && all[name].values) || {}).length
  let names
  if (facets) {
    names = facets.filter((name, index) => has(name) && facets.indexOf(name) === index)
  } else {
    names = Object.keys(all)
      .filter((name) => valueCount(name) > 1)
      .map((name, index) => ({ name, index, count: Number(all[name].count) || 0 }))
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .map((item) => item.name)
    if (maxFacets) names = names.slice(0, maxFacets)
  }
  Object.entries(checked).forEach(([name, values]) => {
    if (values && values.length && !names.includes(name)) names.push(name)
  })
  return names
}

/** Граница цены без хвоста «.0»: сервер отдаёт число, форматированной строки у него нет. */
const bound = (value) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined)

/** Непустая строка (после trim) или `undefined`. */
const nonEmpty = (value) => (typeof value === 'string' && value.trim() ? value : undefined)

/** Заголовок фасета по умолчанию: имя без подчёркиваний, с заглавной. */
export const defaultFacetTitle = (name) => {
  const spaced = name.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Заголовок фасета: от хоста (`facetTitle`), а пустой или null — по умолчанию. */
export function facetTitleOf(name, facetTitle) {
  return nonEmpty(facetTitle ? facetTitle(name) : undefined) || defaultFacetTitle(name)
}

/**
 * `title` значения-объекта: строка, которая начинается с `{` и разбирается в JSON-объект с
 * непустой строкой `title`. Иначе `undefined` — значение показывается как есть. Кит опирается
 * только на формат, не на имена фасетов.
 */
export function valueObjectTitle(value) {
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return undefined
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const title = nonEmpty(parsed.title)
    return title && title.trim()
  } catch (e) {
    return undefined
  }
}

/**
 * Подпись значения фасета без числа: от хоста (`facetValueTitle(facet, value)`, не пустая) →
 * `title` значения-объекта → значение как есть. В запрос уходит исходное значение.
 */
export function facetValueLabel(facet, value, facetValueTitle) {
  return nonEmpty(facetValueTitle ? facetValueTitle(facet, value) : undefined) || valueObjectTitle(value) || value
}

/** Число товаров у значения — «подпись (N)»; нет числа или числа выключены — подпись как есть. */
const withCount = (label, count, show) =>
  show && typeof count === 'number' && Number.isFinite(count) ? `${label} (${count})` : label

/**
 * Варианты секции: значения ответа и выбранные (выбранное могло пропасть из нового ответа).
 * `id` — исходное значение, `label` — подпись `labelOf` с числом `countOf`, если оно есть.
 */
const options = (values, checked, { labelOf = (value) => value, countOf = () => undefined, showCounts = true } = {}) => {
  const seen = new Set()
  return values
    .concat(checked)
    .filter((value) => !seen.has(value) && seen.add(value))
    .map((value) => ({ id: value, label: withCount(labelOf(value), countOf(value), showCounts), checked: checked.includes(value) }))
}

/** Число из списка ответа `[{ [key]: value, count }]` по значению. */
const countsBy = (items, key) => {
  const counts = new Map()
  items.forEach((item) => {
    if (item && typeof item === 'object' && item[key] && !counts.has(item[key])) counts.set(item[key], item.count)
  })
  return (value) => counts.get(value)
}

/**
 * Секции экрана фильтров из ответа первой страницы: диапазон цены (`price_range`), бренды, цвета
 * и размеры (`industrial_filters`, у категории их нет — секций тоже) и фасеты магазина
 * (`filters`, см. visibleFacets). Секция с выбранным значением есть, даже если ответ его не
 * принёс. Границы диапазона цены — подсказками: в запрос уходит только то, что ввёл пользователь.
 *
 * Подпись варианта — «подпись (N)», N — число товаров из ответа (`filters[name].values[value]`,
 * `brands[].count`, `count` цвета и размера); `showValueCounts: false` — без чисел. Подпись
 * значения фасета — facetValueLabel, у брендов, цветов и размеров — значение как есть.
 *
 * @param {object|null} source ответ первой страницы
 * @param {object} applied см. EMPTY_APPLIED
 * @param {{ facets?: string[]|null, maxFacets?: number|null,
 *           facetTitle?: (name: string) => string|null,
 *           facetValueTitle?: (facet: string, value: string) => string|null,
 *           showValueCounts?: boolean,
 *           priceTitle: string, fromLabel: string, toLabel: string, brandsTitle: string,
 *           colorsTitle: string, sizesTitle: string, showMoreText?: string,
 *           showLessText?: string }} texts
 */
export function filterSections(source, applied, texts) {
  const response = source || {}
  const { showMoreText, showLessText } = texts
  const showCounts = texts.showValueCounts !== false
  const sections = []
  if (response.price_range || applied.priceMin || applied.priceMax) {
    const range = response.price_range || {}
    sections.push({
      id: SECTION_PRICE, kind: 'range', title: texts.priceTitle, fromLabel: texts.fromLabel, toLabel: texts.toLabel,
      from: applied.priceMin, to: applied.priceMax,
      fromPlaceholder: bound(range.min), toPlaceholder: bound(range.max),
    })
  }
  const brandItems = response.brands || []
  const brands = brandItems.map((brand) => (typeof brand === 'string' ? brand : brand && brand.name)).filter(Boolean)
  if (brands.length || applied.brands.length) {
    const countOf = countsBy(brandItems, 'name')
    sections.push({
      id: SECTION_BRANDS, kind: 'options', title: texts.brandsTitle,
      options: options(brands, applied.brands, { countOf, showCounts }), showMoreText, showLessText,
    })
  }
  const industrial = response.industrial_filters || {}
  const colorItems = industrial.colors || []
  const colors = colorItems.map((item) => item && item.color).filter(Boolean)
  if (colors.length || applied.colors.length) {
    const countOf = countsBy(colorItems, 'color')
    sections.push({
      id: SECTION_COLORS, kind: 'options', title: texts.colorsTitle,
      options: options(colors, applied.colors, { countOf, showCounts }), showMoreText, showLessText,
    })
  }
  const sizeItems = industrial.fashion_sizes || []
  const sizes = sizeItems.map((item) => item && item.size).filter(Boolean)
  if (sizes.length || applied.sizes.length) {
    const countOf = countsBy(sizeItems, 'size')
    sections.push({
      id: SECTION_SIZES, kind: 'options', title: texts.sizesTitle,
      options: options(sizes, applied.sizes, { countOf, showCounts }), showMoreText, showLessText,
    })
  }
  const filters = response.filters || {}
  visibleFacets(filters, { facets: texts.facets, maxFacets: texts.maxFacets, checked: applied.facets }).forEach((name) => {
    const counts = (filters[name] && filters[name].values) || {}
    sections.push({
      id: SECTION_FACET + name, kind: 'options', title: facetTitleOf(name, texts.facetTitle),
      options: options(Object.keys(counts), applied.facets[name] || [], {
        labelOf: (value) => facetValueLabel(name, value, texts.facetValueTitle),
        countOf: (value) => (Object.prototype.hasOwnProperty.call(counts, value) ? counts[value] : undefined),
        showCounts,
      }),
      showMoreText, showLessText,
    })
  })
  return sections
}

/** Секции после «Применить» → применённые фильтры. */
export function appliedFromSections(sections) {
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

/**
 * Теги применённых фильтров: подпись и `remove(applied)` — применённые фильтры без этого тега.
 * Значение фасета подписано как в экране фильтров (facetValueLabel), но без числа; цена —
 * «<priceTitle> от – до».
 *
 * @param {object} applied см. EMPTY_APPLIED
 * @param {{ priceTitle: string, facetValueTitle?: (facet: string, value: string) => string|null }} texts
 * @returns {Array<{ label: string, remove: (applied: object) => object }>}
 */
export function appliedFilterTags(applied, { priceTitle, facetValueTitle }) {
  const tags = []
  const without = (list, value) => list.filter((item) => item !== value)
  applied.brands.forEach((brand) => tags.push({ label: brand, remove: (prev) => ({ ...prev, brands: without(prev.brands, brand) }) }))
  if (applied.priceMin || applied.priceMax) {
    const range = [applied.priceMin, applied.priceMax].filter(Boolean).join(' – ')
    tags.push({ label: `${priceTitle} ${range}`, remove: (prev) => ({ ...prev, priceMin: '', priceMax: '' }) })
  }
  applied.colors.forEach((color) => tags.push({ label: color, remove: (prev) => ({ ...prev, colors: without(prev.colors, color) }) }))
  applied.sizes.forEach((size) => tags.push({ label: size, remove: (prev) => ({ ...prev, sizes: without(prev.sizes, size) }) }))
  Object.entries(applied.facets).forEach(([name, values]) =>
    values.forEach((value) =>
      tags.push({
        label: facetValueLabel(name, value, facetValueTitle),
        remove: (prev) => ({ ...prev, facets: { ...prev.facets, [name]: without(prev.facets[name] || [], value) } }),
      }),
    ),
  )
  return tags
}

/**
 * Страницы выдачи: пришедшие товары, всего найдено, последняя загруженная страница, идёт ли
 * загрузка и какая страница упала (`failedPage`).
 *
 * `loaded` — первая страница пришла без ошибки: только тогда пустая выдача значит «ничего не
 * нашлось». Новая первая страница (источник, сортировка, фильтры, инстанс) — `reset`.
 */
export const RESULTS_PAGES_INITIAL = Object.freeze({
  products: [],
  total: 0,
  page: 0,
  loading: false,
  loaded: false,
  failedPage: null,
})

export function resultsPagesReducer(state, action) {
  switch (action.type) {
    case 'reset':
      return RESULTS_PAGES_INITIAL
    case 'request':
      return { ...state, loading: true, failedPage: null }
    case 'success':
      return {
        ...state,
        loading: false,
        failedPage: null,
        page: action.page,
        total: action.total || 0,
        products: action.page === 1 ? action.items : state.products.concat(action.items),
        loaded: state.loaded || action.page === 1,
      }
    case 'failure':
      return { ...state, loading: false, failedPage: action.page }
    default:
      return state
  }
}

export const RESULTS_ERROR_TEXT = 'Something went wrong. Check your connection and try again.'
export const RESULTS_RETRY_TEXT = 'Retry'

/** Непустой текст, иначе текст по умолчанию. */
const textOr = (value, fallback) => (typeof value === 'string' && value.trim() ? value : fallback)

/**
 * Что показать под заголовком выдачи — пропсы Catalog — и какую страницу грузит кнопка.
 *
 * Первая страница упала — вместо пустого экрана текст ошибки и «Повторить» (страница 1).
 * Упала следующая — «Load more» становится «Повторить» и грузит ту же страницу, в том числе
 * при бесконечной прокрутке: сама она после ошибки не догружает. Пустые `errorText` и
 * `retryText` (null, пустая строка) заменяются текстами по умолчанию: без кнопки из ошибки не
 * выйти. Число найденного (`foundCount`) — только когда первая страница ответила: на лоадере,
 * после новых фильтров или сортировки и после ошибки «Найдено 0» вводило бы в заблуждение.
 *
 * @param {object} state состояние resultsPagesReducer
 * @param {{ emptyText: string, errorText: string, retryText: string, loadMoreText: string,
 *           infiniteScroll: boolean }} options
 */
export function resultsView(state, { emptyText, errorText, retryText, loadMoreText, infiniteScroll }) {
  const firstPageFailed = state.failedPage === 1
  const nextPageFailed = state.failedPage != null && state.failedPage > 1
  const hasMore = state.products.length > 0 && state.products.length < state.total
  const retry = textOr(retryText, RESULTS_RETRY_TEXT)
  return {
    foundCount: state.loaded ? state.total : undefined,
    emptyText: state.loaded ? emptyText : undefined,
    errorText: firstPageFailed ? textOr(errorText, RESULTS_ERROR_TEXT) : undefined,
    retryText: firstPageFailed ? retry : undefined,
    loadMoreText: nextPageFailed ? retry : hasMore && !infiniteScroll ? loadMoreText : undefined,
    loadMorePage: nextPageFailed ? state.failedPage : state.page + 1,
    autoLoadMore: infiniteScroll && hasMore && state.failedPage == null,
  }
}

/** Ответ выдачи ожидаемой формы: объект со списком товаров. */
export const isResultsResponse = (response) => !!response && typeof response === 'object' && Array.isArray(response.products)

/**
 * Загрузка страниц выдачи без UI: запрос источника, результат — действиями resultsPagesReducer.
 * Ответ устаревшего запроса отбрасывается (счётчик `seq`).
 *
 * Источник: `request(sdk, key, options)` — вызов SDK со страницей в `options`, `key` — запрос
 * поиска или id категории; `onStart(sdk, key)` — трекинг новой первой страницы. Сбой — и
 * отклонённый промис, и ответ-ошибка (см. sdkResult), и ответ без списка товаров — становится
 * `failure` упавшей страницы и уходит в `onError`.
 *
 * @param {{ dispatch: (action: object) => void,
 *           request: (sdk: object, key: string, options: object) => any,
 *           onStart?: (sdk: object, key: string) => void,
 *           onFirstPage?: (response: object) => void, onError?: (error: unknown) => void }} handlers
 */
export function createResultsPagesLoader({ dispatch, request, onStart, onFirstPage, onError }) {
  let seq = 0
  let loading = false
  let key = ''

  const load = (sdk, page, options) => {
    const current = ++seq
    loading = true
    dispatch({ type: 'request' })
    let call
    try {
      call = request(sdk, key, { ...options, page })
    } catch (error) {
      call = Promise.reject(error)
    }
    return sdkResult(call, isResultsResponse).then(
      (response) => {
        if (current !== seq) return
        loading = false
        dispatch({ type: 'success', page, items: response.products, total: response.products_total })
        if (page === 1 && onFirstPage) onFirstPage(response)
      },
      (error) => {
        if (current !== seq) return
        loading = false
        // Упавшая страница: первая — текст ошибки с «Повторить», следующая — «Повторить»
        // вместо «Load more».
        dispatch({ type: 'failure', page })
        if (onError) onError(error)
      },
    )
  }

  return {
    get loading() {
      return loading
    },

    /**
     * Новая первая страница (источник, сортировка, фильтры, инстанс): сброс, `onStart` и
     * загрузка. Без инстанса или источника — только сброс; ответ прежнего запроса отбрасывается.
     */
    start(sdk, sourceKey, options) {
      dispatch({ type: 'reset' })
      key = sourceKey || ''
      if (!sdk || !key) {
        seq += 1
        loading = false
        return Promise.resolve()
      }
      if (onStart) onStart(sdk, key)
      return load(sdk, 1, options)
    },

    /** Страница того же источника по кнопке — следующая или повтор упавшей; без `onStart`. */
    page(sdk, page, options) {
      if (!sdk || !key || loading) return Promise.resolve()
      return load(sdk, page, options)
    },

    /** Размонтирование: ответы в полёте больше не доходят ни до экрана, ни до `onError`. */
    cancel() {
      seq += 1
      loading = false
    },
  }
}
