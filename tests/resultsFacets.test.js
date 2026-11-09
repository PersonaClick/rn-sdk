import {
  DEFAULT_MAX_FACETS,
  EMPTY_APPLIED,
  filterSections,
  resultsRequestOptions,
  visibleFacets,
} from '../components/widgets/resultsSupport'
import searchFull from './fixtures/search_full.json'

// Facets of both result screens (search and category): which ones the filters screen shows and in
// what order. Answers carry hundreds of facets and no priority.

const values = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`v${i}`, 1]))
const facet = (count, n = 2) => ({ count, values: values(n) })

// 15 facets with several values, counts 1..15 in response order, and single-valued ones.
const MANY = Object.fromEntries([
  ...Array.from({ length: 15 }, (_, i) => [`f${i + 1}`, facet(i + 1)]),
  ['single', facet(100, 1)],
  ['empty', { count: 100, values: {} }],
])

const SECTION_TEXTS = {
  facetTitle: (name) => name, priceTitle: 'Price', fromLabel: 'From', toLabel: 'to',
  brandsTitle: 'Brand', colorsTitle: 'Color', sizesTitle: 'Size',
}

describe('Result screens — facets', () => {
  test('by count descending, only with more than one value, first 10 by default', () => {
    expect(DEFAULT_MAX_FACETS).toBe(10)
    expect(visibleFacets(MANY)).toEqual(['f15', 'f14', 'f13', 'f12', 'f11', 'f10', 'f9', 'f8', 'f7', 'f6'])
  })

  test('maxFacets cuts the list; null or 0 shows them all', () => {
    expect(visibleFacets(MANY, { maxFacets: 3 })).toEqual(['f15', 'f14', 'f13'])
    expect(visibleFacets(MANY, { maxFacets: null })).toHaveLength(15)
    expect(visibleFacets(MANY, { maxFacets: 0 })).toHaveLength(15)
  })

  test('equal counts keep the order of the answer; a count that is not a number counts as 0', () => {
    const filters = { b: facet(5), a: facet(5), c: { values: values(3) }, d: facet('7') }
    expect(visibleFacets(filters)).toEqual(['d', 'b', 'a', 'c'])
  })

  test('the host list wins: its order, single-valued too, no limit, unknown names skipped', () => {
    const facets = ['f1', 'single', 'missing', 'f15', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f1']
    expect(visibleFacets(MANY, { facets, maxFacets: 2 })).toEqual(['f1', 'single', 'f15', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10'])
  })

  test('a facet with checked values stays, at the end, even outside the list or the answer', () => {
    const checked = { f1: ['v0'], gone: ['x'], f15: ['v1'], f2: [] }
    expect(visibleFacets(MANY, { maxFacets: 2, checked })).toEqual(['f15', 'f14', 'f1', 'gone'])
  })

  test('no filters in the answer: nothing', () => {
    expect(visibleFacets(undefined)).toEqual([])
    expect(visibleFacets(null, { facets: ['a'] })).toEqual([])
  })

  test('the same rule on the search answer: sections follow it', () => {
    const answer = { ...searchFull, filters: { ...searchFull.filters, ...MANY } }
    const sections = filterSections(answer, EMPTY_APPLIED, { ...SECTION_TEXTS, facets: null, maxFacets: 2 })
    expect(sections.map((section) => section.id)).toEqual(['price', 'brands', 'facet:f15', 'facet:f14'])
    const host = filterSections(answer, EMPTY_APPLIED, { ...SECTION_TEXTS, facets: ['merchant', 'f3'], maxFacets: 2 })
    expect(host.map((section) => section.id)).toEqual(['price', 'brands', 'facet:merchant', 'facet:f3'])
  })
})

describe('Result screens — request options', () => {
  test('the search base stays, filters are added only when set', () => {
    const base = { type: 'full_search', search_query: 'tv' }
    expect(resultsRequestOptions(base, EMPTY_APPLIED, { pageSize: 20 })).toEqual({ ...base, limit: 20 })
    const applied = { ...EMPTY_APPLIED, colors: ['red'], sizes: ['M', 'L'], facets: { a: ['1'], b: [] } }
    expect(resultsRequestOptions(base, applied, { pageSize: 10, sortBy: 'discount', sortDir: 'desc' })).toEqual({
      ...base,
      limit: 10,
      sort_by: 'discount',
      sort_dir: 'desc',
      colors: 'red',
      fashion_sizes: 'M,L',
      filters: '{"a":["1"]}',
    })
  })
})
