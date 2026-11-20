import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// The same server answer gives the same models on Android and iOS. The two native modules hand over the
// native SDKs' released models, which keep "none" differently — Android none, iOS "", 0 or false; the
// shapes below are what each module hands for one answer. And the deprecated trackPurchase sends an
// attribution the two native purchases take differently as 4.0.26 sent it, on both. The native module is a
// fake; axios too, so nothing reaches a server.

jest.mock('axios', () => jest.fn())

jest.mock('../lib/native/bridge', () => ({
  nativeBridge: {},
  toSdkError: (e) => e,
  DEFAULT_STREAM: jest.requireActual('../lib/native/bridge').DEFAULT_STREAM,
}))

// eslint-disable-next-line import/first
import { nativeBridge as mockNative } from '../lib/native/bridge'
// eslint-disable-next-line import/first
import PersonaClick from '../index.js'

const SHOP = 'platform-shop'
const { NAMESPACE_METHODS } = jest.requireActual('../lib/native/bridge')

let listeners

function resetNative() {
  listeners = []
  for (const name of NAMESPACE_METHODS) mockNative[name] = jest.fn(async () => null)
  Object.assign(mockNative, {
    initializeShop: jest.fn(async () => ({ shopId: SHOP, state: 'initializing', deviceId: null, sessionId: null, segment: 'A' })),
    getDeviceId: jest.fn(async () => null),
    queueEvent: jest.fn(async () => undefined),
    setSource: jest.fn(async () => undefined),
    onStateChanged: jest.fn((listener) => {
      listeners.push(listener)
      return () => {}
    }),
  })
}

const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function readyShop() {
  const sdk = new PersonaClick(SHOP, 'android', false, false)
  await settle()
  listeners.forEach((listener) => listener({ shopId: SHOP, state: 'ready', deviceId: 'did', sessionId: 'sid', segment: 'A' }))
  await settle()
  return sdk
}

beforeEach(async () => {
  await AsyncStorage.clearAll()
  axios.mockReset()
  resetNative()
})

/** What each module hands for an order the server sent with few fields: `{ id, value, items: [{ price, item: { id, name, price } }] }`. */
const PRODUCT_COMMON = {
  id: 'p1', groupId: null, name: 'Boots', price: 10, priceFull: 0, salesRate: 0, relativeSalesRate: 0,
  rating: null, isNew: false, stockQuantity: null, discountFormatted: null,
}
const ANDROID_ORDER = {
  internalId: null, id: 'o1', date: null, value: '10.0', cashValue: null, bonusesValue: null, deliveryValue: null,
  promocode: null, deliveryDate: null, internalStatus: null, stream: null, channel: null, taxFree: null,
  deliveryType: null, deliveryAddress: null, orderStatus: null, paymentType: null,
  items: [{
    amount: null, price: '10.0', status: null, originalPrice: null, barcode: null, lineId: null, cancelReason: null,
    item: {
      ...PRODUCT_COMMON, brand: null, model: null, description: null, barcode: null, url: null, deeplinkAndroid: null,
      deeplinkIos: null, imageUrl: null, picture: null, resizedImages: null, priceFormatted: null,
      priceFullFormatted: null, oldPrice: null, oldPriceFormatted: null, oldPriceFull: null, oldPriceFullFormatted: null,
      currency: null, discountPercent: null, categoryIds: null, categories: null, params: null, locationIds: null,
    },
  }],
}
const IOS_ORDER = {
  internalId: 0, id: 'o1', date: '', value: '10.0', cashValue: null, bonusesValue: null, deliveryValue: null,
  promocode: null, deliveryDate: null, internalStatus: null, stream: null, channel: null, taxFree: false,
  deliveryType: null, deliveryAddress: null, orderStatus: null, paymentType: null,
  items: [{
    amount: 0, price: '10.0', status: null, originalPrice: null, barcode: null, lineId: null, cancelReason: null,
    item: {
      ...PRODUCT_COMMON, brand: '', model: '', description: '', barcode: '', url: '', deeplinkAndroid: null,
      deeplinkIos: '', imageUrl: '', picture: '', resizedImages: {}, priceFormatted: '',
      priceFullFormatted: '', oldPrice: 0, oldPriceFormatted: '', oldPriceFull: 0, oldPriceFullFormatted: '',
      currency: '', discountPercent: null, categoryIds: null, categories: null, params: null, locationIds: null,
    },
  }],
}

describe('profile.getOrders', () => {
  test('an order the server sent with few fields is the same on both platforms: none is null, taxFree false', async () => {
    const sdk = await readyShop()
    mockNative.profileGetOrders.mockResolvedValueOnce([ANDROID_ORDER]).mockResolvedValueOnce([IOS_ORDER])

    const android = await sdk.profile.getOrders('secret', { email: 'a@b.c' })
    const ios = await sdk.profile.getOrders('secret', { email: 'a@b.c' })

    expect(android).toEqual(ios)
    expect(ios[0]).toMatchObject({ internalId: null, id: 'o1', date: null, value: '10.0', taxFree: false })
    expect(ios[0].items[0]).toMatchObject({ amount: null, price: '10.0' })
    expect(ios[0].items[0].item).toMatchObject({
      id: 'p1', name: 'Boots', brand: null, model: null, url: null, deeplinkIos: null, resizedImages: null,
      oldPrice: null, oldPriceFull: null, currency: null, price: 10, isNew: false,
    })
  })

  test('what the server sent stays: a tax-free order, an amount, an old price, the lines Android left out are an empty list', async () => {
    const sdk = await readyShop()
    const sent = {
      ...ANDROID_ORDER, internalId: 7, date: '2026-11-18', taxFree: true,
      items: [{ ...ANDROID_ORDER.items[0], amount: 2, item: { ...ANDROID_ORDER.items[0].item, oldPrice: 12, discountPercent: 15, resizedImages: { 120: 'https://img/120' } } }],
    }
    mockNative.profileGetOrders.mockResolvedValueOnce([sent, { ...ANDROID_ORDER, items: null }])

    const [order, empty] = await sdk.profile.getOrders('secret', { email: 'a@b.c' })

    expect(order).toMatchObject({ internalId: 7, date: '2026-11-18', taxFree: true })
    expect(order.items[0]).toMatchObject({ amount: 2 })
    expect(order.items[0].item).toMatchObject({ oldPrice: 12, discountPercent: 15, resizedImages: { 120: 'https://img/120' } })
    expect(empty.items).toEqual([])
  })
})

describe('profile.get', () => {
  test("no custom properties are an empty map on both platforms — the server's [] too, which iOS's model does not read", async () => {
    const sdk = await readyShop()
    const android = { id: '42', hasEmail: false, emailRegisteredAt: null, gender: null, computedGender: null, boughtSomething: false, customProperties: {} }
    // An iOS module of an earlier build: no map for the server's [], and an empty text as "".
    const ios = { ...android, emailRegisteredAt: '', customProperties: null }
    mockNative.profileGet.mockResolvedValueOnce(android).mockResolvedValueOnce(ios)

    const fromAndroid = await sdk.profile.get()
    const fromIos = await sdk.profile.get()

    expect(fromAndroid).toEqual(fromIos)
    expect(fromIos).toEqual({ ...android, customProperties: {} })
  })

  test('custom properties the server sent stay as they are', async () => {
    const sdk = await readyShop()
    mockNative.profileGet.mockResolvedValueOnce({ id: '42', customProperties: { tier: 'gold', points: 3 } })

    await expect(sdk.profile.get()).resolves.toMatchObject({ customProperties: { tier: 'gold', points: 3 } })
  })
})

describe('notifications.getHistory', () => {
  test('a message the server sent without its campaign and statistics is the same on both platforms', async () => {
    const sdk = await readyShop()
    const texts = { type: 'bulk', code: 'c1', date: '2026-11-01', sentAt: null, subject: 'S', body: 'Hi', url: null, icon: null, picture: null, channel: 'email' }
    // Android's model keeps 0 and false for none; iOS's none.
    const android = { ...texts, campaignId: 0, statistics: { opened: false, clicked: true, hardBounced: false, softBounced: false, complained: false, unsubscribed: false, purchased: false } }
    const ios = { ...texts, sentAt: '', url: '', campaignId: null, statistics: { opened: null, clicked: true, hardBounced: null, softBounced: null, complained: null, unsubscribed: null, purchased: null } }
    mockNative.notificationsGetHistory
      .mockResolvedValueOnce({ status: 'success', payload: { messages: [android] } })
      .mockResolvedValueOnce({ status: 'success', payload: { messages: [ios] } })

    const fromAndroid = await sdk.notifications.getHistory('secret', 'email', { email: 'a@b.c' })
    const fromIos = await sdk.notifications.getHistory('secret', 'email', { email: 'a@b.c' })

    expect(fromAndroid).toEqual(fromIos)
    expect(fromIos.messages[0]).toMatchObject({
      campaignId: null,
      statistics: { opened: false, clicked: true, hardBounced: false, softBounced: false, complained: false, unsubscribed: false, purchased: false },
    })
  })
})

describe('the deprecated trackPurchase', () => {
  const request = (recommendedBy) => ({
    orderId: 'o1', orderPrice: 20, items: [{ id: 'p1', amount: 1, price: 20 }], ...(recommendedBy && { recommendedBy }),
  })

  test.each([
    ['web_push_digest', { type: 'web_push_digest', code: 'digest-7' }],
    ['transactional', { type: 'transactional', code: 'm-1' }],
    ['a type neither native SDK knows', { type: 'newsletter', code: 'n-1' }],
    ['no type', { code: 'n-1' }],
  ])('with %s sends what 4.0.26 sent, through the native queue on both platforms', async (_, recommendedBy) => {
    const sdk = await readyShop()

    sdk.trackPurchase(request(recommendedBy))
    await settle()

    expect(mockNative.trackingPurchase).not.toHaveBeenCalled()
    const body = {
      event: 'purchase', order_id: 'o1', order_price: 20, items: [{ id: 'p1', amount: 1, price: 20 }],
      ...(recommendedBy.type && { recommended_by: recommendedBy.type }),
      recommended_code: recommendedBy.code,
    }
    expect(mockNative.queueEvent).toHaveBeenCalledWith(SHOP, 'push', body)
  })

  test('with an attribution both native purchases take alike, or none, it goes through the native purchase', async () => {
    const sdk = await readyShop()

    sdk.trackPurchase(request({ type: 'dynamic', code: 'block-1' }))
    sdk.trackPurchase(request({ type: 'slider', code: 'main' }))
    sdk.trackPurchase(request({ type: 'agent_search', code: '12' }))
    sdk.trackPurchase(request())
    await settle()

    expect(mockNative.trackingPurchase).toHaveBeenCalledWith(SHOP, request({ type: 'dynamic', code: 'block-1' }), null)
    expect(mockNative.trackingPurchase).toHaveBeenCalledWith(SHOP, request({ type: 'slider', code: 'main' }), null)
    expect(mockNative.trackingPurchase).toHaveBeenCalledWith(SHOP, request({ type: 'agent_search', code: '12' }), null)
    expect(mockNative.trackingPurchase).toHaveBeenCalledWith(SHOP, request(), null)
    expect(mockNative.queueEvent).not.toHaveBeenCalled()
  })

  test('what 4.x refused before sending is refused as it was', async () => {
    const sdk = await readyShop()
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})

    sdk.trackPurchase({ orderId: '', orderPrice: 20, items: [], recommendedBy: { type: 'web_push_digest', code: 'd' } })
    await settle()

    expect(errors).toHaveBeenCalled()
    expect(mockNative.queueEvent).not.toHaveBeenCalled()
    expect(mockNative.trackingPurchase).not.toHaveBeenCalled()
    errors.mockRestore()
  })
})
