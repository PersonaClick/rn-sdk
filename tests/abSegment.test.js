import PersonaClick from '../index.js'

const mockRequest = jest.fn()
jest.mock('../lib/client.js', () => {
  const actual = jest.requireActual('../lib/client.js')
  return {
    ...actual,
    request: (...args) => mockRequest(...args),
  }
})

const SHOP_ID = '357382bf66ac0ce2f1722677c59511'

/** Params of the one request made to [endpoint]. */
const paramsOf = (endpoint) => {
  const calls = mockRequest.mock.calls.filter(([url]) => url === endpoint)
  expect(calls).toHaveLength(1)
  return calls[0][2].params
}

// The device's A/B segment goes with the requests whose answer or statistics depend on it,
// as on Android, iOS and the JS SDK.
describe('A/B segment', () => {
  let sdk

  beforeEach(() => {
    // No /init: the segment is set by hand below.
    jest.spyOn(PersonaClick.prototype, 'init').mockImplementation(() => {})
    mockRequest.mockImplementation(() => Promise.resolve({}))
    sdk = new PersonaClick(SHOP_ID, 'android', true)
    sdk.segment = 'B'
    jest.spyOn(sdk, 'push').mockImplementation((callback) => callback())
  })

  afterEach(() => {
    jest.restoreAllMocks()
    mockRequest.mockReset()
  })

  test('recommend sends it: a block under an A/B test answers an error without it', async () => {
    await sdk.recommend('block-code', { item: '486' })

    expect(paramsOf('recommend/block-code')).toMatchObject({ segment: 'B', item: '486' })
  })

  test('search sends it', async () => {
    await sdk.search({ type: 'full_search', search_query: 'shirt' })

    expect(paramsOf('search')).toMatchObject({ segment: 'B', search_query: 'shirt' })
  })

  test('track, trackEvent and trackPurchase send it', async () => {
    sdk.track('view', { id: '486' })
    sdk.trackEvent('demo_event')
    sdk.trackPurchase({ orderId: '1', orderPrice: 199, items: [{ id: '486', amount: 1, price: 199 }] })
    await new Promise(setImmediate)

    const pushes = mockRequest.mock.calls.filter(([url]) => url === 'push').map((call) => call[2].params)
    expect(pushes).toHaveLength(2)
    pushes.forEach((params) => expect(params.segment).toBe('B'))
    expect(paramsOf('push/custom').segment).toBe('B')
  })

  test("a purchase's own segment wins", async () => {
    sdk.trackPurchase({
      orderId: '1',
      orderPrice: 199,
      items: [{ id: '486', amount: 1, price: 199 }],
      segment: 'A',
    })
    await new Promise(setImmediate)

    expect(paramsOf('push').segment).toBe('A')
  })
})
