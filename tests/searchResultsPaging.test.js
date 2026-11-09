import {
  SEARCH_ERROR_TEXT,
  SEARCH_PAGES_INITIAL,
  SEARCH_RETRY_TEXT,
  searchPagesReducer,
  searchResultsView,
} from '../components/widgets/searchSupport'

// SearchResultsScreen paging without UI: what the catalogue shows after a failed first or next page.

const TEXTS = {
  emptyText: 'No results for your request.',
  errorText: 'Something went wrong. Check your connection and try again.',
  retryText: 'Retry',
  loadMoreText: 'Load more',
  infiniteScroll: false,
}

const run = (...actions) => actions.reduce(searchPagesReducer, SEARCH_PAGES_INITIAL)
const items = (from, count) => Array.from({ length: count }, (_, i) => ({ id: String(from + i) }))
const firstPage = [{ type: 'request' }, { type: 'success', page: 1, items: items(0, 20), total: 50 }]

describe('SearchResultsScreen — first page', () => {
  test('while loading: no empty text, no error, no button', () => {
    const state = run({ type: 'request' })
    expect(state.loading).toBe(true)
    expect(searchResultsView(state, TEXTS)).toMatchObject({
      emptyText: undefined,
      errorText: undefined,
      loadMoreText: undefined,
    })
  })

  test('the found count is unknown until the first page answers, and after it fails', () => {
    expect(searchResultsView(run({ type: 'request' }), TEXTS).foundCount).toBeUndefined()
    expect(searchResultsView(run(...firstPage), TEXTS).foundCount).toBe(50)
    expect(searchResultsView(run(...firstPage, { type: 'reset' }, { type: 'request' }), TEXTS).foundCount).toBeUndefined()
    expect(searchResultsView(run({ type: 'request' }, { type: 'failure', page: 1 }), TEXTS).foundCount).toBeUndefined()
  })

  test('the found count stays while the next page loads', () => {
    const state = run(...firstPage, { type: 'request' })
    expect(searchResultsView(state, TEXTS).foundCount).toBe(50)
  })

  test('an empty answer shows the empty text', () => {
    const state = run({ type: 'request' }, { type: 'success', page: 1, items: [], total: 0 })
    expect(searchResultsView(state, TEXTS)).toMatchObject({ emptyText: TEXTS.emptyText, errorText: undefined })
  })

  test('a failure shows the error text with Retry instead of a blank screen', () => {
    const state = run({ type: 'request' }, { type: 'failure', page: 1 })
    expect(state.loading).toBe(false)
    const view = searchResultsView(state, TEXTS)
    expect(view).toMatchObject({
      errorText: TEXTS.errorText,
      retryText: 'Retry',
      emptyText: undefined,
      loadMoreText: undefined,
    })
  })

  test('Retry loads the first page again: the error goes, the loader shows, then the products', () => {
    const retrying = run({ type: 'request' }, { type: 'failure', page: 1 }, { type: 'request' })
    expect(retrying.loading).toBe(true)
    expect(searchResultsView(retrying, TEXTS).errorText).toBeUndefined()

    const done = searchPagesReducer(retrying, { type: 'success', page: 1, items: items(0, 20), total: 50 })
    expect(done.products).toHaveLength(20)
    expect(searchResultsView(done, TEXTS)).toMatchObject({ errorText: undefined, loadMoreText: 'Load more', loadMorePage: 2 })
  })

  test('a new query resets the error', () => {
    const state = run({ type: 'request' }, { type: 'failure', page: 1 }, { type: 'reset' })
    expect(state).toBe(SEARCH_PAGES_INITIAL)
    expect(searchResultsView(state, TEXTS).errorText).toBeUndefined()
  })
})

describe('SearchResultsScreen — next page', () => {
  test('a failure turns Load more into Retry for the same page; the loader is hidden', () => {
    const state = run(...firstPage, { type: 'request' }, { type: 'failure', page: 2 })
    expect(state.loading).toBe(false)
    expect(state.products).toHaveLength(20)
    expect(searchResultsView(state, TEXTS)).toMatchObject({
      loadMoreText: 'Retry',
      loadMorePage: 2,
      errorText: undefined,
    })
  })

  test('Retry repeats that page and appends it; Load more comes back', () => {
    const state = run(
      ...firstPage,
      { type: 'request' },
      { type: 'failure', page: 2 },
      { type: 'request' },
      { type: 'success', page: 2, items: items(20, 20), total: 50 },
    )
    expect(state.products.map((p) => p.id)).toEqual(items(0, 40).map((p) => p.id))
    expect(searchResultsView(state, TEXTS)).toMatchObject({ loadMoreText: 'Load more', loadMorePage: 3 })
  })

  test('with infinite scroll: no button until a page fails, then Retry and no auto loading', () => {
    const texts = { ...TEXTS, infiniteScroll: true }
    const loaded = run(...firstPage)
    expect(searchResultsView(loaded, texts)).toMatchObject({ loadMoreText: undefined, autoLoadMore: true })

    const failed = run(...firstPage, { type: 'request' }, { type: 'failure', page: 2 })
    expect(searchResultsView(failed, texts)).toMatchObject({ loadMoreText: 'Retry', loadMorePage: 2, autoLoadMore: false })
  })

  test('the last page has no button', () => {
    const state = run({ type: 'request' }, { type: 'success', page: 1, items: items(0, 5), total: 5 })
    expect(searchResultsView(state, TEXTS)).toMatchObject({ loadMoreText: undefined, autoLoadMore: false })
  })
})

describe('SearchResultsScreen — error texts', () => {
  test('null or empty errorText / retryText fall back to the defaults, so Retry is always there', () => {
    const firstFailed = run({ type: 'request' }, { type: 'failure', page: 1 })
    const nextFailed = run(...firstPage, { type: 'request' }, { type: 'failure', page: 2 })
    for (const blank of [null, undefined, '', '   ']) {
      const texts = { ...TEXTS, errorText: blank, retryText: blank, infiniteScroll: true }
      expect(searchResultsView(firstFailed, texts)).toMatchObject({
        errorText: SEARCH_ERROR_TEXT,
        retryText: SEARCH_RETRY_TEXT,
      })
      expect(searchResultsView(nextFailed, texts)).toMatchObject({ loadMoreText: SEARCH_RETRY_TEXT, autoLoadMore: false })
    }
    expect(SEARCH_ERROR_TEXT).toBe('Something went wrong. Check your connection and try again.')
    expect(SEARCH_RETRY_TEXT).toBe('Retry')
  })

  test('given texts are used as is', () => {
    const state = run({ type: 'request' }, { type: 'failure', page: 1 })
    const texts = { ...TEXTS, errorText: 'Ошибка', retryText: 'Повторить' }
    expect(searchResultsView(state, texts)).toMatchObject({ errorText: 'Ошибка', retryText: 'Повторить' })
  })
})
