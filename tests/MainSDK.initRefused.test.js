import PersonaClick from '../index.js'
import axios from 'axios'
import { request, setShopRefused } from '../lib/client.js'

// When the server refuses /init (a 4xx — an unknown or disabled shop) the SDK must not keep calling
// it: for the rest of the session no request of that shop is sent, and every call settles at once
// with an error naming the refusal instead of hanging. Here only axios is faked, so what reaches the
// network is exactly what the SDK would send.

jest.mock('axios', () => jest.fn())

const sent = () => axios.mock.calls.map(([config]) => config.url.replace('https://api.personaclick.com/', ''))

function refusedInit(config) {
  const error = new Error('Request failed with status code 404')
  error.isAxiosError = true
  error.response = { status: 404, data: { status: 'error', message: `Shop uniqid:${config.params.shop_id} not found` } }
  return Promise.reject(error)
}

/** Resolves to `{ value }`, `{ error }` or `'pending'` — a hung promise shows up as 'pending'. */
async function outcome(promise) {
  let result = 'pending'
  promise.then((value) => (result = { value }), (error) => (result = { error }))
  for (let i = 0; i < 20; i++) await jest.advanceTimersByTimeAsync(0)
  return result
}

describe('MainSDK when the server refuses /init', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    axios.mockReset()
    axios.mockImplementation((config) =>
      config.url.endsWith('/init') ? refusedInit(config) : Promise.resolve({ data: { recommends: ['p1'] } })
    )
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  test('calls are not sent and settle at once with the refusal', async () => {
    const sdk = new PersonaClick('shop-refused', 'android', false, false)
    const [recommended, listed] = await Promise.all([
      outcome(sdk.recommend('block-1')),
      outcome(sdk.getProductsList({})),
    ])
    await jest.advanceTimersByTimeAsync(60000)

    expect(sent()).toEqual(['init'])
    // recommend() hands errors back as its result; the other methods reject with them.
    expect(recommended.value).toBeInstanceOf(Error)
    expect(recommended.value.message).toBe(
      'Requests of shop shop-refused are not sent: init was refused (HTTP 404): Shop uniqid:shop-refused not found'
    )
    expect(listed.error).toBe(recommended.value)
    expect(sdk.isInit()).toBe(false)
  })

  test('/init goes out with a timeout, so a hung connection counts as a network error', async () => {
    new PersonaClick('shop-timeout', 'android', false, false)
    await jest.advanceTimersByTimeAsync(0)

    expect(axios.mock.calls[0][0]).toEqual(expect.objectContaining({ timeout: 10000 }))
  })

  test('an SDK replaced by a re-init of its shop stops and does not refuse the new one', async () => {
    const replies = [
      () => Promise.reject(Object.assign(new Error('Service Unavailable'), { isAxiosError: true, response: { status: 503 } })),
      () => Promise.resolve({ data: { did: 'did-new', seance: 's-new' } }),
    ]
    axios.mockImplementation((config) =>
      config.url.endsWith('/init')
        ? (replies.shift() ?? refusedInit)(config)
        : Promise.resolve({ data: { recommends: ['p1'] } })
    )
    new PersonaClick('shop-race', 'android', false, false)
    await jest.advanceTimersByTimeAsync(0)
    const replacement = new PersonaClick('shop-race', 'android', false, false)
    await jest.advanceTimersByTimeAsync(0)

    await jest.advanceTimersByTimeAsync(60000)
    expect(await outcome(replacement.recommend('block-1'))).toEqual({ value: { recommends: ['p1'] } })
    expect(sent()).toEqual(['init', 'init', 'recommend/block-1'])
  })

  test('a new init of the shop gives it another chance', async () => {
    const refused = new PersonaClick('shop-again', 'android', false, false)
    await outcome(refused.recommend('block-1'))

    axios.mockImplementation((config) =>
      Promise.resolve({ data: config.url.endsWith('/init') ? { did: 'did-1', seance: 's-1' } : { recommends: ['p1'] } })
    )
    const sdk = new PersonaClick('shop-again', 'android', false, false)

    expect(await outcome(sdk.recommend('block-1'))).toEqual({ value: { recommends: ['p1'] } })
    expect(sent()).toEqual(['init', 'init', 'recommend/block-1'])
  })
})

describe('request() of a refused shop', () => {
  beforeEach(() => {
    axios.mockReset()
    axios.mockResolvedValue({ data: {} })
  })

  afterEach(() => setShopRefused('shop-x', null))

  test('returns the refusal without sending; init and other shops still go out', async () => {
    const refusal = new Error('refused')
    setShopRefused('shop-x', refusal)

    expect(await request('recommend/b', 'shop-x', { params: {} })).toBe(refusal)
    await request('init', 'shop-x', { params: {} })
    await request('recommend/b', 'shop-y', { params: {} })

    expect(axios).toHaveBeenCalledTimes(2)
  })
})
