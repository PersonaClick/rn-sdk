import { createInstantSearchLoader } from '../components/widgets/searchSupport'

// InstantSearchField requests without UI: an SDK answer that is an error goes to onError, as on
// the search results screen, and stale answers are dropped.

const flush = () => new Promise((resolve) => setImmediate(resolve))

function setup() {
  const handlers = { onBlank: jest.fn(), onInstant: jest.fn(), onError: jest.fn() }
  return { handlers, loader: createInstantSearchLoader(handlers) }
}

// Like MainSDK.search / searchBlank: a failed request still resolves, with the error as the answer.
const sdkAnswering = (answer) => ({
  search: jest.fn(() => Promise.resolve(answer)),
  searchBlank: jest.fn(() => Promise.resolve(answer)),
})

describe('Instant search loader', () => {
  test('answers reach the screen; options carry locations only when given', async () => {
    const { handlers, loader } = setup()
    const sdk = sdkAnswering({ products: [{ id: '1' }] })
    loader.blank(sdk)
    loader.instant(sdk, 'tv')
    await flush()
    loader.instant(sdk, 'tv', '12')
    await flush()
    expect(handlers.onBlank).toHaveBeenCalledWith({ products: [{ id: '1' }] })
    expect(handlers.onInstant).toHaveBeenCalledTimes(2)
    expect(sdk.search.mock.calls).toEqual([
      [{ type: 'instant_search', search_query: 'tv' }],
      [{ type: 'instant_search', search_query: 'tv', locations: '12' }],
    ])
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  test('an empty answer is an empty object', async () => {
    const { handlers, loader } = setup()
    loader.instant(sdkAnswering(null), 'tv')
    await flush()
    expect(handlers.onInstant).toHaveBeenCalledWith({})
  })

  test.each([
    ['an Error the SDK resolved with', new Error('Network Error'), 'Network Error'],
    ['an error body', { status: 'error', message: 'Search is off' }, 'Search is off'],
    ['an HTTP error status', { status: 500 }, 'Request failed: 500'],
  ])('%s goes to onError and not to the screen', async (_, answer, message) => {
    const { handlers, loader } = setup()
    const sdk = sdkAnswering(answer)
    loader.blank(sdk)
    loader.instant(sdk, 'tv')
    await flush()
    expect(handlers.onBlank).not.toHaveBeenCalled()
    expect(handlers.onInstant).not.toHaveBeenCalled()
    expect(handlers.onError).toHaveBeenCalledTimes(2)
    expect(handlers.onError.mock.calls.map(([error]) => error.message)).toEqual([message, message])
  })

  test('a rejection and a synchronous throw go to onError too', async () => {
    const { handlers, loader } = setup()
    loader.blank({ searchBlank: () => Promise.reject(new Error('down')) })
    loader.instant({ search: () => { throw new Error('broken') } }, 'tv')
    await flush()
    expect(handlers.onError.mock.calls.map(([error]) => error.message).sort()).toEqual(['broken', 'down'])
  })

  test('a stale instant answer and its error are dropped; the blank one is not', async () => {
    const { handlers, loader } = setup()
    const pending = []
    const sdk = {
      search: jest.fn(() => new Promise((resolve) => pending.push(resolve))),
      searchBlank: jest.fn(() => new Promise((resolve) => pending.push(resolve))),
    }
    loader.blank(sdk)
    loader.instant(sdk, 'tv')
    loader.instant(sdk, 'tv set')
    pending[1](new Error('stale failure'))
    pending[2]({ products: [{ id: 'new' }] })
    pending[0]({ products: [{ id: 'blank' }] })
    await flush()
    expect(handlers.onInstant.mock.calls).toEqual([[{ products: [{ id: 'new' }] }]])
    expect(handlers.onBlank).toHaveBeenCalledWith({ products: [{ id: 'blank' }] })
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  test('clearInstant() drops the instant answer in flight; cancel() drops everything', async () => {
    const first = setup()
    const sdk = sdkAnswering({ products: [] })
    first.loader.blank(sdk)
    first.loader.instant(sdk, 'tv')
    first.loader.clearInstant()
    await flush()
    expect(first.handlers.onInstant).not.toHaveBeenCalled()
    expect(first.handlers.onBlank).toHaveBeenCalled()

    const second = setup()
    second.loader.blank(sdkAnswering(new Error('late')))
    second.loader.instant(sdk, 'tv')
    second.loader.cancel()
    await flush()
    expect(second.handlers.onBlank).not.toHaveBeenCalled()
    expect(second.handlers.onInstant).not.toHaveBeenCalled()
    expect(second.handlers.onError).not.toHaveBeenCalled()
  })
})
