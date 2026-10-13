import PersonaClick from '../index.js'

// A failed /init must not leave the SDK dead for the session. Before the fix every call queued
// before or after a failed init (recommend() included) waited for an init that never came: its
// promise neither resolved nor rejected. Now the queue is released on the first failure — calls go
// out with the cached did, or none on a fresh install, as on Android — and /init is retried in the
// background on network errors and 5xx (5 retries, 1 s more pause each time, as on Android). A
// refused init (4xx) is covered end to end in MainSDK.initRefused.test.js. Offline (as NetInfo,
// faked here, knows) /init is not sent at all until the network is back.

const mockRequest = jest.fn()
const mockGetData = jest.fn()
const mockSetShopRefused = jest.fn()
const mockNetInfo = { state: { isConnected: true }, listeners: new Set() }

jest.mock('../lib/client.js', () => {
  const actual = jest.requireActual('../lib/client.js')
  return {
    ...actual,
    request: (...args) => mockRequest(...args),
    getData: (...args) => mockGetData(...args),
    updSeance: () => Promise.resolve(),
    setShopRefused: (...args) => mockSetShopRefused(...args),
  }
})

jest.mock(
  '@react-native-community/netinfo',
  () => ({
    fetch: () => Promise.resolve(mockNetInfo.state),
    addEventListener: (listener) => {
      mockNetInfo.listeners.add(listener)
      listener(mockNetInfo.state)
      return () => mockNetInfo.listeners.delete(listener)
    },
  }),
  { virtual: true }
)

function setNetwork(isConnected) {
  mockNetInfo.state = { isConnected }
  for (const listener of [...mockNetInfo.listeners]) listener(mockNetInfo.state)
}

/** Whether a call made the shop refused (a `null` refusal only lifts the mark). */
const refused = () => mockSetShopRefused.mock.calls.some(([, refusal]) => refusal != null)

/** What lib/client `request` hands back when axios fails: the axios error itself, not a rejection. */
function networkError() {
  const error = new Error('Network Error')
  error.code = 'ERR_NETWORK'
  error.isAxiosError = true
  return error
}

function httpError(status, data) {
  const error = new Error(`Request failed with status code ${status}`)
  error.isAxiosError = true
  error.response = { status, data }
  return error
}

const initCalls = () => mockRequest.mock.calls.filter(([endpoint]) => endpoint === 'init').length

/** Lets the SDK's async init chain run without moving the clock. */
const settle = () => jest.advanceTimersByTimeAsync(0)

/** Resolves to `{ value }` or `'pending'` — a hung promise shows up as 'pending', not a test timeout. */
async function outcome(promise) {
  let result = 'pending'
  promise.then((value) => (result = { value }), (error) => (result = { error }))
  for (let i = 0; i < 20; i++) await settle()
  return result
}

describe('MainSDK when /init fails', () => {
  let initReplies

  beforeEach(() => {
    jest.useFakeTimers()
    mockRequest.mockReset()
    mockGetData.mockReset()
    mockSetShopRefused.mockReset()
    mockNetInfo.state = { isConnected: true }
    mockNetInfo.listeners.clear()
    mockGetData.mockResolvedValue({ did: 'did-cached' })
    initReplies = []
    mockRequest.mockImplementation((endpoint) => {
      if (endpoint === 'init') {
        return Promise.resolve(initReplies.length > 0 ? initReplies.shift() : networkError())
      }
      if (endpoint.startsWith('recommend/')) {
        return Promise.resolve({ recommends: ['p1', 'p2'] })
      }
      return Promise.resolve({})
    })
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  test('a recommend() asked before the failure still resolves', async () => {
    const sdk = new PersonaClick('shop-a', 'android', false, false)
    const recommendation = sdk.recommend('block-1', { item: 'p0' })

    expect(await outcome(recommendation)).toEqual({ value: { recommends: ['p1', 'p2'] } })
    expect(sdk.isInit()).toBe(false)
  })

  test('a recommend() asked after the failure resolves too', async () => {
    const sdk = new PersonaClick('shop-a', 'android', false, false)
    await settle()

    expect(await outcome(sdk.recommend('block-1'))).toEqual({ value: { recommends: ['p1', 'p2'] } })
  })

  test('a fresh install without a did is not blocked either', async () => {
    mockGetData.mockResolvedValue({})
    const sdk = new PersonaClick('shop-fresh', 'android', false, false)

    expect(await outcome(sdk.recommend('block-1'))).toEqual({ value: { recommends: ['p1', 'p2'] } })
  })

  test('a network error is retried and a later success initializes the SDK', async () => {
    initReplies = [networkError(), networkError(), { did: 'did-server', seance: 'seance-server' }]
    const sdk = new PersonaClick('shop-a', 'android', false, false)
    await settle()
    expect(initCalls()).toBe(1)

    await jest.advanceTimersByTimeAsync(1000)
    expect(initCalls()).toBe(2)
    await jest.advanceTimersByTimeAsync(2000)
    expect(initCalls()).toBe(3)

    expect(sdk.isInit()).toBe(true)
    expect(sdk.deviceId).toBe('did-server')
  })

  test('a 5xx is retried, at most five times', async () => {
    initReplies = Array.from({ length: 10 }, () => httpError(503, 'Service Unavailable'))
    const sdk = new PersonaClick('shop-a', 'android', false, false)

    await jest.advanceTimersByTimeAsync(60000)

    expect(initCalls()).toBe(6)
    expect(sdk.isInit()).toBe(false)
  })

  test('offline, /init is not sent until the network is back; calls do not wait for it', async () => {
    mockNetInfo.state = { isConnected: false }
    initReplies = [{ did: 'did-server', seance: 'seance-server' }]
    const sdk = new PersonaClick('shop-a', 'android', false, false)

    expect(await outcome(sdk.recommend('block-1'))).toEqual({ value: { recommends: ['p1', 'p2'] } })
    await jest.advanceTimersByTimeAsync(60000)
    expect(initCalls()).toBe(0)

    setNetwork(true)
    await settle()
    expect(initCalls()).toBe(1)
    expect(sdk.isInit()).toBe(true)
  })

  test('once the retries are over, the next reconnect starts over', async () => {
    initReplies = [...Array.from({ length: 6 }, networkError), { did: 'did-server', seance: 'seance-server' }]
    const sdk = new PersonaClick('shop-a', 'android', false, false)
    await jest.advanceTimersByTimeAsync(60000)
    expect(initCalls()).toBe(6)

    setNetwork(false)
    setNetwork(true)
    await settle()

    expect(initCalls()).toBe(7)
    expect(sdk.isInit()).toBe(true)
  })

  test('a page without a did (a captive portal answers 200 HTML) is retried, not a refusal', async () => {
    initReplies = ['<html>Log in to the Wi-Fi</html>', { did: 'did-server', seance: 'seance-server' }]
    const sdk = new PersonaClick('shop-a', 'android', false, false)

    await jest.advanceTimersByTimeAsync(1000)

    expect(initCalls()).toBe(2)
    expect(sdk.isInit()).toBe(true)
    expect(refused()).toBe(false)
  })

  test('a 429 is retried, not a refusal', async () => {
    initReplies = [httpError(429, 'Too Many Requests'), { did: 'did-server', seance: 'seance-server' }]
    const sdk = new PersonaClick('shop-a', 'android', false, false)

    await jest.advanceTimersByTimeAsync(1000)

    expect(sdk.isInit()).toBe(true)
    expect(refused()).toBe(false)
  })

  test('a push registration failing after a good init leaves the SDK initialized', async () => {
    jest.spyOn(PersonaClick.prototype, 'initPush').mockRejectedValue(new Error('no notification channel'))
    initReplies = [{ did: 'did-server', seance: 'seance-server' }]
    const sdk = new PersonaClick('shop-a', 'android', false, true)

    expect(await outcome(sdk.recommend('block-1'))).toEqual({ value: { recommends: ['p1', 'p2'] } })
    expect(PersonaClick.prototype.initPush).toHaveBeenCalled()
    expect(sdk.isInit()).toBe(true)
    expect(refused()).toBe(false)
  })

  test('every attempt gets its own params and a timeout', async () => {
    initReplies = [networkError(), { did: 'did-server', seance: 'seance-server' }]
    new PersonaClick('shop-a', 'android', false, false)
    await jest.advanceTimersByTimeAsync(1000)

    const [first, second] = mockRequest.mock.calls.filter(([endpoint]) => endpoint === 'init')
    expect(first[2].params).not.toBe(second[2].params)
    expect(second[2].params).toEqual({ shop_id: 'shop-a', stream: 'android', did: 'did-cached' })
    expect(first[2].timeout).toBe(10000)
  })

  test('a queued command that throws does not hold the ones after it', async () => {
    const sdk = new PersonaClick('shop-a', 'android', false, false)
    sdk.push(() => {
      throw new Error('broken command')
    })

    expect(await outcome(sdk.recommend('block-1'))).toEqual({ value: { recommends: ['p1', 'p2'] } })
  })
})
