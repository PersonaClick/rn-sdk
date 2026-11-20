import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// Without the SDK's native module (Expo Go, an app not rebuilt after installing the SDK) the shop runs
// on this JavaScript, as before: the earlier methods send their requests themselves, the namespaces
// that need the native SDK reject with notInitialized and send nothing, and what lives in JavaScript —
// tracking, the push events and the token, the A/B group — still works. Only axios is faked.

jest.mock('axios', () => jest.fn())

// eslint-disable-next-line import/first
import PersonaClick from '../index.js'
// eslint-disable-next-line import/first
import { nativeBridge } from '../lib/native/bridge'

const SHOP = 'no-module-shop'

function answer(config) {
  if (config.url.endsWith('/init')) return Promise.resolve({ data: { did: 'js-did', seance: 'js-sid' } })
  if (config.url.includes('/recommend/')) return Promise.resolve({ data: { recommends: ['p1'], title: 'Block' } })
  return Promise.resolve({ data: { status: 'success' } })
}

const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function readyShop() {
  const sdk = new PersonaClick(SHOP, 'android', false, false)
  await settle()
  return sdk
}

const sentPaths = () => axios.mock.calls.map(([config]) => config.url.replace('https://api.personaclick.com/', ''))

beforeEach(async () => {
  await AsyncStorage.clearAll()
  axios.mockReset()
  axios.mockImplementation(answer)
})

test('there is no native module in this environment', () => {
  expect(nativeBridge).toBeNull()
})

test('the namespaces that need the native SDK reject with notInitialized and send nothing', async () => {
  const sdk = await readyShop()
  axios.mockClear()

  const calls = [
    sdk.products.getInfo('37'),
    sdk.collections.get('12'),
    sdk.recommendations.get('block'),
    sdk.search.full('boots'),
    sdk.cart.get(),
    sdk.profile.get(),
    sdk.subscriptions.check(),
    sdk.segments.get(),
    sdk.notifications.getHistory('secret', 'email'),
    sdk.stories.get('block'),
    sdk.predict.getProbabilityToPurchase(),
    sdk.loyalty.getStatus('+100'),
    sdk.sliders.get('main'),
    sdk.reviews.getNpsChannels(),
  ]
  const errors = await Promise.all(calls.map((call) => call.then(() => null, (e) => e)))

  errors.forEach((error) => expect(error).toMatchObject({ name: 'SdkError', type: 'notInitialized' }))
  expect(errors[0].message).toMatch(/native module/)
  expect(sentPaths()).toEqual([])
})

test('the earlier methods go through JavaScript, unchanged', async () => {
  const sdk = await readyShop()

  const recommended = await sdk.recommend('block-1', { item: '37' })
  sdk.segments('add', { segment_id: 12 })
  sdk.subscriptions('manage', { email: 'a@b.c', email_bulk: true })
  await settle()

  expect(recommended).toEqual({ recommends: ['p1'], title: 'Block' })
  expect(sentPaths()).toEqual(expect.arrayContaining(['init', 'recommend/block-1', 'segments/add', 'subscriptions/manage']))
  const manage = axios.mock.calls.find(([config]) => config.url.endsWith('subscriptions/manage'))[0]
  expect(manage.data ?? manage.params).toMatchObject({ email: 'a@b.c', email_bulk: true })
})

test('tracking, the push events and the A/B group live in JavaScript and still work', async () => {
  const sdk = await readyShop()
  axios.mockClear()

  await sdk.tracking.productView('37')
  await sdk.notifications.trackClicked('c1', 'chain')

  expect(sentPaths()).toEqual(['push', 'track/clicked'])
  expect(['A', 'B']).toContain(sdk.segments.getAbGroup())
  expect(sdk.search.agentEnabled).toBe(false)
})

test("tracking.purchase sends only the contract's fields, its attribution from the call's source; trackPurchase 4.x's request", async () => {
  const sdk = await readyShop()
  axios.mockClear()
  const warnings = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const legacy = {
    orderId: 'o1',
    orderPrice: 20,
    items: [{ id: 'p1', amount: 1, price: 20, quantity: 2, lineId: 'l1' }],
    paymentType: 'card',
    recommendedBy: { type: 'dynamic', code: 'block_a' },
    recommendedSource: { from: 'x' },
    stream: 'web',
    segment: 'Z',
  }

  await sdk.tracking.purchase(legacy, { type: 'fullSearch', code: 'boots' })
  sdk.trackPurchase(legacy)
  await settle()

  const bodies = axios.mock.calls.map(([config]) => config.data ?? config.params)
  expect(sentPaths()).toEqual(['push', 'push'])
  expect(bodies[0]).toMatchObject({
    event: 'purchase',
    order_id: 'o1',
    order_price: 20,
    items: [{ id: 'p1', amount: 1, price: 20, line_id: 'l1' }],
    payment_type: 'card',
    recommended_by: 'full_search',
    recommended_code: 'boots',
    stream: 'android',
  })
  expect(bodies[0].items[0]).not.toHaveProperty('quantity')
  expect(bodies[0]).not.toHaveProperty('recommended_source')
  expect(bodies[0].segment).not.toBe('Z')
  expect(warnings).toHaveBeenCalledTimes(1)
  // The deprecated method sends 4.x's fields, as 4.0.26 did.
  expect(bodies[1]).toMatchObject({
    items: [{ id: 'p1', amount: 1, price: 20, quantity: 2, line_id: 'l1' }],
    recommended_by: 'dynamic',
    recommended_code: 'block_a',
    recommended_source: { from: 'x' },
    stream: 'web',
    segment: 'Z',
  })
  warnings.mockRestore()
})

describe('setPushToken from JavaScript', () => {
  const { Platform } = require('react-native')
  const platform = Platform.OS
  afterEach(() => {
    Platform.OS = platform
  })

  test('on Android an HMS token goes with push_provider huawei, and an APNs one is invalidArgument', async () => {
    Platform.OS = 'android'
    const sdk = await readyShop()
    axios.mockClear()

    await sdk.notifications.setPushToken('hms-token', 'hms')
    await expect(sdk.notifications.setPushToken('apns-token', 'apns')).rejects.toMatchObject({ type: 'invalidArgument' })

    expect(sentPaths()).toEqual(['mobile_push_tokens'])
    const [config] = axios.mock.calls[0]
    expect(config.data ?? config.params).toMatchObject({ token: 'hms-token', platform: 'android', push_provider: 'huawei' })
    expect(sdk.notifications.getPushToken()).toEqual({ token: 'hms-token', provider: 'hms' })
  })
})

test('without the native module slider and agentSearch go as the server takes them', async () => {
  const sdk = await readyShop()
  axios.mockClear()

  await sdk.tracking.productView('37', { type: 'slider', code: 'main_slider' })
  await sdk.tracking.addToFavorites('38', { type: 'agentSearch', code: '42' })

  const bodies = axios.mock.calls.map(([config]) => config.data ?? config.params)
  expect(bodies[0]).toMatchObject({ event: 'view', recommended_by: 'slider', recommended_code: 'main_slider' })
  expect(bodies[1]).toMatchObject({ event: 'wish', recommended_by: 'agent_search', recommended_code: '42' })
})

test('tracking.custom takes the contract integers as both native SDKs do, whole and of 32 bits; trackEvent sends what 4.x sent', async () => {
  const sdk = await readyShop()
  axios.mockClear()

  await expect(sdk.tracking.custom('promo', { value: 9.99 })).rejects.toMatchObject({ type: 'invalidArgument', message: expect.stringMatching(/value/) })
  await expect(sdk.tracking.custom('promo', { time: 4102444800 })).rejects.toMatchObject({ type: 'invalidArgument', message: expect.stringMatching(/time/) })
  expect(sentPaths()).toEqual([])

  await sdk.tracking.custom('promo', { time: 2147483647, value: -2147483648 })
  sdk.trackEvent('promo', { time: 4102444800, value: 9.99 })
  await settle()

  const params = axios.mock.calls.map(([config]) => config.data)
  expect(params[0]).toMatchObject({ event: 'promo', time: 2147483647, value: -2147483648 })
  expect(params[1]).toMatchObject({ event: 'promo', time: 4102444800, value: 9.99 })
  expect(sentPaths()).toEqual(['push/custom', 'push/custom'])
})
