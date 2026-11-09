import {
  SEARCH_PAGES_INITIAL,
  createSearchPagesLoader,
  searchPagesReducer,
  searchResultsView,
} from '../components/widgets/searchSupport'

// SearchResultsScreen loading without UI: the loader, the reducer and the view wired as on screen.

const TEXTS = {
  emptyText: 'No results for your request.',
  errorText: 'Something went wrong. Check your connection and try again.',
  retryText: 'Retry',
  loadMoreText: 'Load more',
  infiniteScroll: false,
}
const OPTIONS = { type: 'full_search', search_query: 'tv', limit: 2 }
const page = (from, total) => ({ products: [{ id: `${from}` }, { id: `${from + 1}` }], products_total: total })

function setup(answers) {
  let state = SEARCH_PAGES_INITIAL
  const queue = [...answers]
  const sdk = {
    track: jest.fn(),
    // Like MainSDK.search: a failed request still resolves, with the error as the answer.
    search: jest.fn(() => {
      const next = queue.shift()
      return next instanceof Promise ? next : Promise.resolve(next)
    }),
  }
  const onError = jest.fn()
  const onFirstPage = jest.fn()
  const loader = createSearchPagesLoader({
    dispatch: (action) => {
      state = searchPagesReducer(state, action)
    },
    onFirstPage,
    onError,
  })
  return { sdk, loader, onError, onFirstPage, state: () => state, view: () => searchResultsView(state, TEXTS) }
}

describe('SearchResultsScreen loader — answers that are errors', () => {
  test('a first page resolved with an Error shows the error with Retry and calls onError', async () => {
    const error = new Error('Network Error')
    const t = setup([error])
    await t.loader.start(t.sdk, 'tv', OPTIONS)
    expect(t.onError).toHaveBeenCalledWith(error)
    expect(t.view()).toMatchObject({ errorText: TEXTS.errorText, retryText: 'Retry', emptyText: undefined })
    expect(t.state().loading).toBe(false)
  })

  test('an error body or an answer without products is a failure, not "no results"', async () => {
    for (const answer of [{ status: 'error', message: 'Incorrect shop credentials' }, { status: 400 }, '<html>', {}]) {
      const t = setup([answer])
      await t.loader.start(t.sdk, 'tv', OPTIONS)
      expect(t.onError).toHaveBeenCalledTimes(1)
      expect(t.view().errorText).toBe(TEXTS.errorText)
      expect(t.view().emptyText).toBeUndefined()
    }
  })

  test('a next page resolved with an Error turns Load more into Retry for that page', async () => {
    const t = setup([page(0, 6), new Error('timeout')])
    await t.loader.start(t.sdk, 'tv', OPTIONS)
    expect(t.onFirstPage).toHaveBeenCalledTimes(1)
    await t.loader.page(t.sdk, t.view().loadMorePage, OPTIONS)
    expect(t.sdk.search).toHaveBeenLastCalledWith({ ...OPTIONS, page: 2 })
    expect(t.onError).toHaveBeenCalledTimes(1)
    expect(t.view()).toMatchObject({ loadMoreText: 'Retry', loadMorePage: 2 })
    expect(t.state().products).toHaveLength(2)
  })

  test('a rejected search and a search that throws are failures too', async () => {
    const t = setup([Promise.reject(new Error('rejected'))])
    await t.loader.start(t.sdk, 'tv', OPTIONS)
    expect(t.view().errorText).toBe(TEXTS.errorText)

    const throwing = setup([])
    throwing.sdk.search.mockImplementation(() => {
      throw new Error('sync')
    })
    await throwing.loader.start(throwing.sdk, 'tv', OPTIONS)
    expect(throwing.onError).toHaveBeenCalledTimes(1)
    expect(throwing.view().errorText).toBe(TEXTS.errorText)
  })

  test('a normal empty answer is "no results"', async () => {
    const t = setup([{ products: [], products_total: 0 }])
    await t.loader.start(t.sdk, 'tv', OPTIONS)
    expect(t.onError).not.toHaveBeenCalled()
    expect(t.view()).toMatchObject({ emptyText: TEXTS.emptyText, errorText: undefined })
  })

  test('no instance or no text: reset only, nothing requested', async () => {
    const t = setup([])
    await t.loader.start(null, 'tv', OPTIONS)
    await t.loader.start(t.sdk, '', OPTIONS)
    expect(t.sdk.search).not.toHaveBeenCalled()
    expect(t.sdk.track).not.toHaveBeenCalled()
    expect(t.state()).toBe(SEARCH_PAGES_INITIAL)
  })

  test('an answer of an outdated request is dropped', async () => {
    let finishFirst
    const t = setup([new Promise((resolve) => (finishFirst = resolve)), page(10, 2)])
    const first = t.loader.start(t.sdk, 'tv', OPTIONS)
    await t.loader.start(t.sdk, 'tv', { ...OPTIONS, sort_by: 'price' })
    finishFirst(new Error('late'))
    await first
    expect(t.onError).not.toHaveBeenCalled()
    expect(t.state().products.map((p) => p.id)).toEqual(['10', '11'])
  })

  test('after cancel (unmount) answers in flight reach neither the screen nor onError', async () => {
    let finish
    const t = setup([page(0, 6), new Promise((resolve) => (finish = resolve))])
    await t.loader.start(t.sdk, 'tv', OPTIONS)
    const pending = t.loader.page(t.sdk, 2, OPTIONS)
    const before = t.state()
    t.loader.cancel()
    finish(new Error('late'))
    await pending
    expect(t.onError).not.toHaveBeenCalled()
    expect(t.state()).toBe(before)

    const success = setup([new Promise((resolve) => (finish = resolve))])
    const first = success.loader.start(success.sdk, 'tv', OPTIONS)
    success.loader.cancel()
    finish(page(0, 2))
    await first
    expect(success.onFirstPage).not.toHaveBeenCalled()
    expect(success.state().products).toEqual([])
  })

  test('Retry repeats the request but does not track the search event again', async () => {
    const t = setup([new Error('offline'), page(0, 6), new Error('offline'), page(2, 6)])
    await t.loader.start(t.sdk, 'tv', OPTIONS)
    expect(t.sdk.track).toHaveBeenCalledTimes(1)
    expect(t.sdk.track).toHaveBeenCalledWith('search', 'tv')

    // First page: Retry.
    await t.loader.page(t.sdk, 1, OPTIONS)
    expect(t.sdk.search).toHaveBeenCalledTimes(2)
    expect(t.sdk.track).toHaveBeenCalledTimes(1)

    // Next page fails, then Retry of that page.
    await t.loader.page(t.sdk, t.view().loadMorePage, OPTIONS)
    expect(t.view().loadMoreText).toBe('Retry')
    await t.loader.page(t.sdk, t.view().loadMorePage, OPTIONS)
    expect(t.sdk.search.mock.calls.map(([options]) => options.page)).toEqual([1, 1, 2, 2])
    expect(t.sdk.track).toHaveBeenCalledTimes(1)
    expect(t.state().products).toHaveLength(4)
  })

  test('a button press while a page is loading does nothing', async () => {
    let finish
    const t = setup([page(0, 6), new Promise((resolve) => (finish = resolve))])
    await t.loader.start(t.sdk, 'tv', OPTIONS)
    const pending = t.loader.page(t.sdk, 2, OPTIONS)
    await t.loader.page(t.sdk, 2, OPTIONS)
    expect(t.sdk.search).toHaveBeenCalledTimes(2)
    finish(page(2, 6))
    await pending
  })
})
