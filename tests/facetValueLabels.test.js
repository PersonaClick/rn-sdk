import {
  EMPTY_APPLIED,
  appliedFilterTags,
  appliedFromSections,
  facetValueLabel,
  filterSections,
  resultsRequestOptions,
  valueObjectTitle,
} from '../components/widgets/resultsSupport'

// Labels of filter values on both result screens: the title of a JSON value, product counts, the
// host's labels. The kit relies on the format only, never on facet names or the language.

const STICKER = '{"slug": "super_price", "title": "Суперцена", "text_color": "#ffffff", "background_color": "#f48012", "priority": 1}'
const ANSWER = {
  brands: [{ name: 'Artel', count: 26 }, { name: 'Ava', count: 39 }, { name: 'NoCount' }, 'Plain'],
  industrial_filters: {
    colors: [{ color: 'red', count: 3 }, { color: 'blue' }],
    fashion_sizes: [{ size: 'M', count: 7 }],
  },
  filters: {
    stickers: { count: 30, values: { [STICKER]: 12, '{broken': 4, plain: 2 } },
    product_type: { count: 20, values: { regular: 18, mto: 2 } },
  },
}
const TEXTS = {
  priceTitle: 'Price', fromLabel: 'From', toLabel: 'to', brandsTitle: 'Brand', colorsTitle: 'Color', sizesTitle: 'Size',
}
const section = (sections, id) => sections.find((item) => item.id === id)
const labels = (sections, id) => section(sections, id).options.map((option) => option.label)

describe('Filter values — title of a JSON object', () => {
  test('a string with a JSON object and a non-empty string title shows the title', () => {
    expect(valueObjectTitle(STICKER)).toBe('Суперцена')
    expect(valueObjectTitle('  {"title": " Хит "}')).toBe('Хит')
  })

  test('anything else stays as it is', () => {
    for (const value of ['{broken', '{"slug": "x"}', '{"title": 5}', '{"title": ""}', '{"title": "  "}', '["title"]', 'regular', '']) {
      expect(valueObjectTitle(value)).toBeUndefined()
      expect(facetValueLabel('f', value)).toBe(value)
    }
  })

  test('the section shows the title, the request keeps the original value', () => {
    const sections = filterSections(ANSWER, EMPTY_APPLIED, TEXTS)
    const stickers = section(sections, 'facet:stickers')
    expect(stickers.options.map((option) => [option.id, option.label])).toEqual([
      [STICKER, 'Суперцена (12)'],
      ['{broken', '{broken (4)'],
      ['plain', 'plain (2)'],
    ])
    const checked = sections.map((item) =>
      item.id === 'facet:stickers' ? { ...item, options: item.options.map((option) => ({ ...option, checked: option.id === STICKER })) } : item,
    )
    const applied = appliedFromSections(checked)
    expect(applied.facets.stickers).toEqual([STICKER])
    expect(JSON.parse(resultsRequestOptions({}, applied, { pageSize: 20 }).filters)).toEqual({ stickers: [STICKER] })
  })
})

describe('Filter values — product counts', () => {
  test('facets, brands, colors and sizes show the count of the answer; none — no brackets', () => {
    const sections = filterSections(ANSWER, EMPTY_APPLIED, TEXTS)
    expect(labels(sections, 'brands')).toEqual(['Artel (26)', 'Ava (39)', 'NoCount', 'Plain'])
    expect(labels(sections, 'colors')).toEqual(['red (3)', 'blue'])
    expect(labels(sections, 'sizes')).toEqual(['M (7)'])
    expect(labels(sections, 'facet:product_type')).toEqual(['regular (18)', 'mto (2)'])
  })

  test('a checked value that the answer no longer has comes without a count', () => {
    const applied = { ...EMPTY_APPLIED, brands: ['Gone'], facets: { product_type: ['digital'] } }
    const sections = filterSections(ANSWER, applied, TEXTS)
    expect(labels(sections, 'brands')).toContain('Gone')
    expect(labels(sections, 'facet:product_type')).toEqual(['regular (18)', 'mto (2)', 'digital'])
  })

  test('showValueCounts: false shows labels only', () => {
    const sections = filterSections(ANSWER, EMPTY_APPLIED, { ...TEXTS, showValueCounts: false })
    expect(labels(sections, 'brands')).toEqual(['Artel', 'Ava', 'NoCount', 'Plain'])
    expect(labels(sections, 'colors')).toEqual(['red', 'blue'])
    expect(labels(sections, 'facet:stickers')).toEqual(['Суперцена', '{broken', 'plain'])
  })
})

describe('Filter values — labels of the host', () => {
  const facetValueTitle = (facet, value) =>
    facet === 'product_type' ? { regular: 'Обычный', mto: 'Под заказ' }[value] : facet === 'stickers' && value === 'plain' ? '' : null

  test('host label first, then the JSON title, then the value; the count goes to any of them', () => {
    const sections = filterSections(ANSWER, EMPTY_APPLIED, { ...TEXTS, facetValueTitle })
    expect(labels(sections, 'facet:product_type')).toEqual(['Обычный (18)', 'Под заказ (2)'])
    expect(labels(sections, 'facet:stickers')).toEqual(['Суперцена (12)', '{broken (4)', 'plain (2)'])
    expect(section(sections, 'facet:product_type').options.map((option) => option.id)).toEqual(['regular', 'mto'])
  })

  test('the host label is for facets only: brands, colors and sizes stay as they are', () => {
    const everything = () => 'Host'
    const sections = filterSections(ANSWER, EMPTY_APPLIED, { ...TEXTS, facetValueTitle: everything, showValueCounts: false })
    expect(labels(sections, 'brands')).toEqual(['Artel', 'Ava', 'NoCount', 'Plain'])
    expect(labels(sections, 'colors')).toEqual(['red', 'blue'])
    expect(labels(sections, 'facet:stickers')).toEqual(['Host', 'Host', 'Host'])
  })

  test('facet titles: the host one, or the default for null and empty', () => {
    const facetTitle = (name) => ({ stickers: 'Стикеры', product_type: '' }[name] ?? null)
    const sections = filterSections(ANSWER, EMPTY_APPLIED, { ...TEXTS, facetTitle })
    expect(section(sections, 'facet:stickers').title).toBe('Стикеры')
    expect(section(sections, 'facet:product_type').title).toBe('Product type')
  })
})

describe('Filter values — applied tags', () => {
  test('a tag has the label of the value without a count; removing it drops the original value', () => {
    const applied = { ...EMPTY_APPLIED, brands: ['Ava'], priceMin: '100', facets: { stickers: [STICKER, 'plain'], product_type: ['mto'] } }
    const tags = appliedFilterTags(applied, { priceTitle: 'Price', facetValueTitle: (facet, value) => (value === 'mto' ? 'Под заказ' : null) })
    expect(tags.map((tag) => tag.label)).toEqual(['Ava', 'Price 100', 'Суперцена', 'plain', 'Под заказ'])
    const next = tags[2].remove(applied)
    expect(next.facets).toEqual({ stickers: ['plain'], product_type: ['mto'] })
    expect(tags[1].remove(applied)).toMatchObject({ priceMin: '', priceMax: '' })
  })
})
