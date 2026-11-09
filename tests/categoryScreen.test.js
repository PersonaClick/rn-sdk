import { createCategoryPagesLoader, categoryResponse } from '../components/widgets/categorySupport'
import {
  EMPTY_APPLIED,
  RESULTS_PAGES_INITIAL,
  filterSections,
  resultsPagesReducer,
  resultsRequestOptions,
  resultsView,
} from '../components/widgets/resultsSupport'
import { parseCategory } from '../types/catalogTypes'
import category from './fixtures/category.json'

// CategoryScreen without UI: the request, category view tracking, filter sections, errors, empty.

const SLUG = 'tehnika-dlja-kuhni'
const TEXTS = {
  emptyText: 'No products in this category.',
  errorText: 'Something went wrong. Check your connection and try again.',
  retryText: 'Retry',
  loadMoreText: 'Load more',
  infiniteScroll: false,
}
const SECTION_TEXTS = {
  facets: null, maxFacets: 10, facetTitle: (name) => name, priceTitle: 'Price', fromLabel: 'From', toLabel: 'to',
  brandsTitle: 'Brand', colorsTitle: 'Color', sizesTitle: 'Size',
}
const page = (from, total) => ({ products: [{ id: `${from}` }, { id: `${from + 1}` }], products_total: total })

// Like MainSDK.getCategory: the answer is parsed, the whole response is in `raw`; a failed request
// rejects, an error body of the server parses into an empty category.
function setup(answers) {
  let state = RESULTS_PAGES_INITIAL
  const queue = [...answers]
  const sdk = {
    track: jest.fn(),
    trackSource: jest.fn(),
    getCategory: jest.fn(() => {
      const next = queue.shift()
      if (next instanceof Error) return Promise.reject(next)
      return next instanceof Promise ? next : Promise.resolve(parseCategory(next))
    }),
  }
  const onError = jest.fn()
  const onFirstPage = jest.fn()
  const loader = createCategoryPagesLoader({
    dispatch: (action) => {
      state = resultsPagesReducer(state, action)
    },
    onFirstPage,
    onError,
  })
  return { sdk, loader, onError, onFirstPage, state: () => state, view: () => resultsView(state, TEXTS) }
}

const options = (applied = EMPTY_APPLIED, extra = {}) => resultsRequestOptions({}, applied, { pageSize: 20, ...extra })

describe('CategoryScreen — request', () => {
  test('carries the category, the page, brands, facets, price, sorting and locations', async () => {
    const t = setup([page(0, 4), page(2, 4)])
    const applied = { ...EMPTY_APPLIED, brands: ['Artel', 'Ava'], priceMin: ' 1000 ', priceMax: '5000', facets: { Тип: ['Чайник'], Цвет: [] } }
    const sent = options(applied, { sortBy: 'price', sortDir: 'asc', locations: '12' })
    await t.loader.start(t.sdk, SLUG, sent)
    await t.loader.page(t.sdk, t.view().loadMorePage, sent)
    const expected = {
      limit: 20,
      brands: 'Artel,Ava',
      price_min: '1000',
      price_max: '5000',
      sort_by: 'price',
      sort_dir: 'asc',
      locations: '12',
      filters: JSON.stringify({ Тип: ['Чайник'] }),
    }
    expect(t.sdk.getCategory.mock.calls).toEqual([
      [SLUG, { ...expected, page: 1 }],
      [SLUG, { ...expected, page: 2 }],
    ])
    expect(t.state().products.map((p) => p.id)).toEqual(['0', '1', '2', '3'])
  })

  test('without filters only the limit and the page are sent; no colors or sizes keys', async () => {
    const t = setup([page(0, 2)])
    await t.loader.start(t.sdk, SLUG, options())
    expect(t.sdk.getCategory).toHaveBeenCalledWith(SLUG, { limit: 20, page: 1 })
  })

  test('the answer is the raw response: products, total and facets come from it', async () => {
    const t = setup([category])
    await t.loader.start(t.sdk, SLUG, options())
    expect(t.state().total).toBe(category.products_total)
    expect(t.state().products).toHaveLength(category.products.length)
    expect(t.onFirstPage).toHaveBeenCalledWith(category)
  })

  test('no instance or no category: nothing requested, nothing tracked', async () => {
    const t = setup([])
    await t.loader.start(null, SLUG, options())
    await t.loader.start(t.sdk, '', options())
    await t.loader.page(t.sdk, 2, options())
    expect(t.sdk.getCategory).not.toHaveBeenCalled()
    expect(t.sdk.track).not.toHaveBeenCalled()
    expect(t.state()).toBe(RESULTS_PAGES_INITIAL)
  })
})

describe('CategoryScreen — category view', () => {
  test('tracked once: not on pages, filters, sorting or Retry', async () => {
    const t = setup([page(0, 6), new Error('offline'), page(2, 6), page(0, 6), page(0, 6), new Error('offline'), page(0, 6)])
    await t.loader.start(t.sdk, SLUG, options())
    await t.loader.page(t.sdk, 2, options())
    await t.loader.page(t.sdk, t.view().loadMorePage, options())
    await t.loader.start(t.sdk, SLUG, options({ ...EMPTY_APPLIED, brands: ['Ava'] }))
    await t.loader.start(t.sdk, SLUG, options(EMPTY_APPLIED, { sortBy: 'discount', sortDir: 'desc' }))
    await t.loader.start(t.sdk, SLUG, options())
    await t.loader.page(t.sdk, 1, options())
    expect(t.sdk.getCategory).toHaveBeenCalledTimes(7)
    expect(t.sdk.track.mock.calls).toEqual([['category', SLUG]])
    expect(t.sdk.trackSource).not.toHaveBeenCalled()
  })

  test('another category or another instance is a new view', async () => {
    const t = setup([page(0, 2), page(0, 2), page(0, 2)])
    const other = { ...t.sdk, track: jest.fn() }
    await t.loader.start(t.sdk, SLUG, options())
    await t.loader.start(t.sdk, 'kofevarki', options())
    await t.loader.start(other, 'kofevarki', options())
    expect(t.sdk.track.mock.calls).toEqual([['category', SLUG], ['category', 'kofevarki']])
    expect(other.track.mock.calls).toEqual([['category', 'kofevarki']])
  })
})

describe('CategoryScreen — filter sections from the category answer', () => {
  test('price and brands; no color or size sections without industrial_filters', () => {
    const sections = filterSections(category, EMPTY_APPLIED, SECTION_TEXTS)
    expect(sections.map((section) => section.id)).toEqual(['price', 'brands'])
    expect(sections[0]).toMatchObject({ kind: 'range', fromPlaceholder: '190', toPlaceholder: '1863890' })
    expect(sections[1].options.map((option) => option.id)).toEqual(category.brands.map((brand) => brand.name))
  })

  test('facets with more than one value come from `filters`; applied values stay checked', () => {
    const answer = {
      ...category,
      filters: {
        ...category.filters,
        Тип: { count: 40, values: { Чайник: 30, Тостер: 10 } },
        Цвет: { count: 25, values: { Белый: 20, Черный: 5 } },
      },
    }
    const applied = { ...EMPTY_APPLIED, brands: ['AULA'], facets: { Цвет: ['Черный'] } }
    const sections = filterSections(answer, applied, SECTION_TEXTS)
    expect(sections.map((section) => section.id)).toEqual(['price', 'brands', 'facet:Тип', 'facet:Цвет'])
    expect(sections[1].options.find((option) => option.id === 'AULA').checked).toBe(true)
    expect(sections[3].options).toEqual([
      { id: 'Белый', label: 'Белый (20)', checked: false },
      { id: 'Черный', label: 'Черный (5)', checked: true },
    ])
  })
})

describe('CategoryScreen — errors and the empty category', () => {
  test('a failed first page shows the error with Retry; Retry loads it', async () => {
    const t = setup([new Error('Network Error'), page(0, 2)])
    await t.loader.start(t.sdk, SLUG, options())
    expect(t.onError).toHaveBeenCalledTimes(1)
    expect(t.view()).toMatchObject({ errorText: TEXTS.errorText, retryText: 'Retry', emptyText: undefined })
    await t.loader.page(t.sdk, 1, options())
    expect(t.view()).toMatchObject({ errorText: undefined, emptyText: TEXTS.emptyText })
    expect(t.state().products).toHaveLength(2)
  })

  test('an error body is a failure, not an empty category', async () => {
    for (const body of [{ status: 'error', message: 'Incorrect shop credentials' }, { status: 404 }]) {
      const t = setup([body])
      await t.loader.start(t.sdk, SLUG, options())
      expect(t.onError).toHaveBeenCalledTimes(1)
      expect(t.onError.mock.calls[0][0].response).toEqual(body)
      expect(t.view()).toMatchObject({ errorText: TEXTS.errorText, emptyText: undefined })
    }
  })

  test('a failed next page turns Load more into Retry for that page', async () => {
    const t = setup([page(0, 6), new Error('timeout'), page(2, 6)])
    await t.loader.start(t.sdk, SLUG, options())
    expect(t.view()).toMatchObject({ loadMoreText: 'Load more', loadMorePage: 2 })
    await t.loader.page(t.sdk, 2, options())
    expect(t.view()).toMatchObject({ loadMoreText: 'Retry', loadMorePage: 2 })
    await t.loader.page(t.sdk, t.view().loadMorePage, options())
    expect(t.view()).toMatchObject({ loadMoreText: 'Load more', loadMorePage: 3 })
    expect(t.state().products).toHaveLength(4)
  })

  test('an empty category shows the empty text', async () => {
    const t = setup([{ products: [], products_total: 0 }])
    await t.loader.start(t.sdk, SLUG, options())
    expect(t.onError).not.toHaveBeenCalled()
    expect(t.view()).toMatchObject({ emptyText: TEXTS.emptyText, errorText: undefined, loadMoreText: undefined })
  })

  test('categoryResponse: raw of a parsed answer, a plain response as is, errors thrown', () => {
    expect(categoryResponse(parseCategory(category))).toBe(category)
    expect(categoryResponse(category)).toBe(category)
    expect(() => categoryResponse(parseCategory({ status: 'error' }))).toThrow()
    expect(() => categoryResponse(new Error('x'))).toThrow('x')
  })
})
