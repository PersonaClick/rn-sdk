import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// The contract's namespaces on the native SDK (`lib/namespaces`): each method calls the native
// module's method of its name with the shop first and its arguments as the module takes them, and
// hands back what the module resolved with or the SdkError it rejected with. The native module is a
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
// eslint-disable-next-line import/first
import { SdkError } from '../lib/facade/errors'

const SHOP = 'namespaces-shop'
const { NAMESPACE_METHODS } = jest.requireActual('../lib/native/bridge')

let listeners
let snapshot

function resetNative() {
  listeners = []
  snapshot = { shopId: SHOP, state: 'initializing', deviceId: null, sessionId: null, segment: 'A', agentEnabled: false }
  for (const name of NAMESPACE_METHODS) mockNative[name] = jest.fn(async () => ({ from: name }))
  Object.assign(mockNative, {
    initializeShop: jest.fn(async () => ({ ...snapshot })),
    getDeviceId: jest.fn(async () => snapshot.deviceId),
    queueEvent: jest.fn(async () => undefined),
    setSource: jest.fn(async () => undefined),
    setAutoPopupPresentation: jest.fn(),
    onStateChanged: jest.fn((listener) => {
      listeners.push(listener)
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    }),
  })
}

function nativeChanges(change) {
  snapshot = { ...snapshot, ...change }
  listeners.forEach((listener) => listener({ ...snapshot }))
}

const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function readyShop() {
  const sdk = new PersonaClick(SHOP, 'android', false, false)
  await settle()
  nativeChanges({ state: 'ready', deviceId: 'native-did', sessionId: 'native-sid' })
  await settle()
  return sdk
}

beforeEach(async () => {
  await AsyncStorage.clearAll()
  axios.mockReset()
  axios.mockImplementation(() => Promise.resolve({ data: { status: 'success' } }))
  resetNative()
})

/**
 * Every method of every namespace: the call, the native method and the arguments it gets after the
 * shop. Optional values not given are null; an enumeration's value is its wire value.
 */
const CALLS = [
  ['products.getInfo', (sdk) => sdk.products.getInfo('37'), 'productsGetInfo', ['37']],
  ['products.getList', (sdk) => sdk.products.getList({ categoryIds: ['5'], sortBy: 'salesRate', sortDir: 'asc', limit: 2, page: undefined }),
    'productsGetList', [{ categoryIds: ['5'], sortBy: 'sales_rate', sortDir: 'asc', limit: 2 }]],
  ['products.getList without a request', (sdk) => sdk.products.getList(), 'productsGetList', [null]],
  ['products.getCounters', (sdk) => sdk.products.getCounters('37'), 'productsGetCounters', ['37']],
  ['products.getCategory', (sdk) => sdk.products.getCategory('5', { sortBy: 'priceMargin', filters: { size: ['42'] } }),
    'productsGetCategory', ['5', { sortBy: 'price_margin', filters: { size: ['42'] } }]],
  ['collections.get', (sdk) => sdk.collections.get(12), 'collectionsGet', ['12']],
  ['recommendations.get', (sdk) => sdk.recommendations.get('block', { itemId: '37', limit: 4 }), 'recommendationsGet', ['block', { itemId: '37', limit: 4 }]],
  ['recommendations.get without a request', (sdk) => sdk.recommendations.get('block'), 'recommendationsGet', ['block', null]],
  ['search.blank', (sdk) => sdk.search.blank(), 'searchBlank', []],
  ['search.instant', (sdk) => sdk.search.instant('boots', { locations: ['msk'], excludedBrands: ['x'] }), 'searchInstant', ['boots', ['msk'], null, ['x']]],
  ['search.instant without params', (sdk) => sdk.search.instant('boots'), 'searchInstant', ['boots', null, null, null]],
  ['search.full', (sdk) => sdk.search.full('boots', { sortBy: 'relevance', disableClarification: true }), 'searchFull', ['boots', { sortBy: 'relevance', disableClarification: true }]],
  ['search.agentDialog', (sdk) => sdk.search.agentDialog({ sessionId: 2147483648 }), 'searchAgentDialog', [2147483648, null]],
  ['search.agent', (sdk) => sdk.search.agent('red shoes', { locations: ['msk'] }), 'searchAgent', ['red shoes', null, ['msk']]],
  ['cart.get', (sdk) => sdk.cart.get(), 'cartGet', []],
  ['cart.clear', (sdk) => sdk.cart.clear('secret', { externalId: 'ext-1' }), 'cartClear', ['secret', null, null, null, 'ext-1', null]],
  ['profile.get', (sdk) => sdk.profile.get(), 'profileGet', []],
  ['profile.set', (sdk) => sdk.profile.set({ firstName: 'Ann', gender: 'female', kids: [{ gender: 'male', birthday: '2020-01-02' }], age: undefined }),
    'profileSet', [{ firstName: 'Ann', gender: 'f', kids: [{ gender: 'm', birthday: '2020-01-02' }] }]],
  ['profile.getLastOrder', (sdk) => sdk.profile.getLastOrder(), 'profileGetLastOrder', []],
  ['profile.getOrders', (sdk) => sdk.profile.getOrders('secret', { email: 'a@b.c', dateFrom: '2026-01-01' }),
    'profileGetOrders', ['secret', null, 'a@b.c', null, null, null, '2026-01-01']],
  ['subscriptions.manage', (sdk) => sdk.subscriptions.manage({ email: 'a@b.c', emailBulk: true, smsChain: false }),
    'subscriptionsManage', [{ email: 'a@b.c', emailBulk: true, smsChain: false }]],
  ['subscriptions.check', (sdk) => sdk.subscriptions.check(), 'subscriptionsCheck', []],
  ['subscriptions.subscribeForPriceDrop', (sdk) => sdk.subscriptions.subscribeForPriceDrop('37', 99.5, { phone: '+100' }),
    'subscriptionsSubscribeForPriceDrop', ['37', 99.5, null, '+100']],
  ['subscriptions.unsubscribeFromPriceDrop', (sdk) => sdk.subscriptions.unsubscribeFromPriceDrop([]),
    'subscriptionsUnsubscribeFromPriceDrop', [[], null, null]],
  ['subscriptions.subscribeForBackInStock', (sdk) => sdk.subscriptions.subscribeForBackInStock('37', { fashionSize: 'XL' }, { email: 'a@b.c' }),
    'subscriptionsSubscribeForBackInStock', ['37', { fashionSize: 'XL' }, 'a@b.c', null]],
  ['subscriptions.unsubscribeFromBackInStock', (sdk) => sdk.subscriptions.unsubscribeFromBackInStock(['37', '38']),
    'subscriptionsUnsubscribeFromBackInStock', [['37', '38'], null, null]],
  ['segments.add', (sdk) => sdk.segments.add(12, { email: 'a@b.c' }), 'segmentsAdd', [12, 'a@b.c', null]],
  ['segments.remove', (sdk) => sdk.segments.remove(12), 'segmentsRemove', [12, null, null]],
  ['segments.get', (sdk) => sdk.segments.get(), 'segmentsGet', []],
  ['stories.get', (sdk) => sdk.stories.get('block'), 'storiesGet', ['block']],
  ['predict.getProbabilityToPurchase', (sdk) => sdk.predict.getProbabilityToPurchase(), 'predictGetProbabilityToPurchase', []],
  ['loyalty.join', (sdk) => sdk.loyalty.join('+100', { firstName: 'Ann', gender: 'female' }), 'loyaltyJoin', ['+100', 'Ann', null, 'f', null]],
  ['loyalty.getStatus', (sdk) => sdk.loyalty.getStatus('+100'), 'loyaltyGetStatus', ['+100']],
  ['loyalty.getPromotions', (sdk) => sdk.loyalty.getPromotions({ promoCodes: ['A'], chargeBonuses: false }),
    'loyaltyGetPromotions', [null, ['A'], false, null]],
  ['sliders.get', (sdk) => sdk.sliders.get('main', ['sale']), 'slidersGet', ['main', ['sale'], null]],
  ['reviews.createNps', (sdk) => sdk.reviews.createNps(9, 'ios_app', 'order', { orderId: '1' }), 'reviewsCreateNps', [9, 'ios_app', 'order', '1', null, null]],
  ['reviews.createCsat', (sdk) => sdk.reviews.createCsat(4, 'ios_app', 'delivery', { comment: 'ok' }), 'reviewsCreateCsat', [4, 'ios_app', 'delivery', null, 'ok', null]],
  ['reviews.createCes', (sdk) => sdk.reviews.createCes(2, 'ios_app', 'support', { label: 'chat' }), 'reviewsCreateCes', [2, 'ios_app', 'support', null, null, 'chat']],
  ['reviews.getNpsCategories', (sdk) => sdk.reviews.getNpsCategories(), 'reviewsGetNpsCategories', []],
  ['reviews.getNpsChannels', (sdk) => sdk.reviews.getNpsChannels(), 'reviewsGetNpsChannels', []],
  ['reviews.getCsatCampaigns', (sdk) => sdk.reviews.getCsatCampaigns(), 'reviewsGetCsatCampaigns', []],
  ['reviews.getCesCampaigns', (sdk) => sdk.reviews.getCesCampaigns(), 'reviewsGetCesCampaigns', []],
  ['reviews.getProductReviews', (sdk) => sdk.reviews.getProductReviews('37', 10), 'reviewsGetProductReviews', ['37', 10, null]],
  ['reviews.getClientReviews', (sdk) => sdk.reviews.getClientReviews('o1'), 'reviewsGetClientReviews', ['o1']],
]

describe('every namespace on the native SDK', () => {
  test.each(CALLS)('%s calls the native method with the shop and its arguments, and hands back its result', async (_, call, method, args) => {
    const sdk = await readyShop()

    // The answer as the module gave it; a profile always has its custom properties, an empty map for none.
    const expected = method === 'profileGet' ? { from: method, customProperties: {} } : { from: method }
    await expect(call(sdk)).resolves.toEqual(expected)
    expect(mockNative[method]).toHaveBeenCalledTimes(1)
    expect(mockNative[method]).toHaveBeenCalledWith(SHOP, ...args)
  })

  test('the native SDK has a method for every method of the spec', () => {
    const called = new Set(CALLS.map(([, , method]) => method))
    // tracking and notifications have tests of their own
    const namespaceMethods = NAMESPACE_METHODS.filter((name) => !name.startsWith('tracking') && !name.startsWith('notifications'))
    expect(namespaceMethods.filter((name) => !called.has(name))).toEqual([])
  })

  test('a call before the native instance exists waits for it', async () => {
    const sdk = new PersonaClick(SHOP, 'android', false, false)
    const result = sdk.products.getInfo('37')
    await settle()

    await expect(result).resolves.toEqual({ from: 'productsGetInfo' })
    expect(sdk.isInit()).toBe(false)
  })

  test('the native error reaches the caller as it is: its type, HTTP code and server code', async () => {
    const sdk = await readyShop()
    mockNative.collectionsGet.mockRejectedValueOnce(new SdkError('http', 'The server answered 400', { httpCode: 400, serverCode: 'off' }))
    mockNative.profileGet.mockRejectedValueOnce(new SdkError('shopBlocked', 'The shop is blocked'))
    mockNative.cartClear.mockRejectedValueOnce(new SdkError('invalidArgument', 'no customer id'))

    await expect(sdk.collections.get('12')).rejects.toMatchObject({ name: 'SdkError', type: 'http', httpCode: 400, serverCode: 'off' })
    await expect(sdk.profile.get()).rejects.toMatchObject({ type: 'shopBlocked' })
    await expect(sdk.cart.clear('secret')).rejects.toMatchObject({ type: 'invalidArgument', message: 'no customer id' })
  })

  test('an argument the native module cannot take is invalidArgument, and nothing is called', async () => {
    const sdk = await readyShop()

    const errors = await Promise.all([
      sdk.products.getInfo(37),
      sdk.search.instant('boots', { locations: 'msk' }),
      sdk.segments.add('12'),
      sdk.reviews.createNps('9', 'ios_app', 'order'),
      sdk.profile.set(null),
      sdk.notifications.setPushToken('token', 'hms'),
      sdk.cart.clear('secret', 'ext-1'),
    ].map((p) => p.then(() => null, (e) => e)))

    errors.forEach((error) => expect(error).toMatchObject({ name: 'SdkError', type: 'invalidArgument' }))
    NAMESPACE_METHODS.forEach((name) => expect(mockNative[name]).not.toHaveBeenCalled())
  })

  test('a refused start of the native instance is what every call gets', async () => {
    mockNative.initializeShop.mockRejectedValueOnce(new SdkError('invalidArgument', 'shopId must not be empty'))
    const sdk = new PersonaClick(SHOP, 'android', false, false)
    await settle()

    await expect(sdk.stories.get('block')).rejects.toMatchObject({ type: 'invalidArgument' })
    expect(mockNative.storiesGet).not.toHaveBeenCalled()
  })
})

describe('local values', () => {
  test('search.agentEnabled follows the native instance', async () => {
    const sdk = await readyShop()
    expect(sdk.search.agentEnabled).toBe(false)

    nativeChanges({ agentEnabled: true })
    await settle()
    expect(sdk.search.agentEnabled).toBe(true)
  })

  test('segments.getAbGroup is the device A/B group of the native instance, read at once', async () => {
    const sdk = await readyShop()
    expect(sdk.segments.getAbGroup()).toBe('A')

    nativeChanges({ segment: 'B' })
    await settle()
    expect(sdk.segments.getAbGroup()).toBe('B')
    expect(sdk.getCurrentSegment()).toBe('B')
  })
})

describe('notifications', () => {
  const statistics = { clicked: false, complained: false, hardBounced: false, opened: true, purchased: false, softBounced: false, unsubscribed: false }
  const message = { body: 'Hi', campaignId: 3, channel: 'email', code: 'c1', date: '2026-11-01', icon: null, picture: null, sentAt: '2026-11-01T10:00:00Z', statistics, subject: 'S', type: 'bulk', url: null }

  test('getHistory calls the native method; both modules hand the same answer, read as { status, messages }', async () => {
    const sdk = await readyShop()
    // Android's module and iOS's alike: the answer's status, each message's channel, campaign and statistics.
    mockNative.notificationsGetHistory.mockResolvedValueOnce({ status: 'success', payload: { messages: [message] } })

    const history = await sdk.notifications.getHistory('secret', 'email', { email: 'a@b.c', limit: 5 })

    expect(mockNative.notificationsGetHistory).toHaveBeenCalledWith(SHOP, 'secret', 'email', null, 'a@b.c', null, null, null, 5, null, null, null)
    expect(history).toEqual({ status: 'success', messages: [message] })
  })

  test("a history message's empty text is none, on both platforms", async () => {
    const sdk = await readyShop()
    // Android's module hands the server's "" as it is; iOS's model keeps none as "".
    mockNative.notificationsGetHistory.mockResolvedValueOnce({
      status: 'success',
      payload: { messages: [{ ...message, icon: '', picture: '', url: '', channel: '', subject: '' }] },
    })

    const history = await sdk.notifications.getHistory('secret', 'email', { email: 'a@b.c' })

    expect(history.messages).toEqual([{ ...message, icon: null, picture: null, url: null, channel: null, subject: null }])
  })

  test('getHistory still reads the released iOS model an iOS module of an earlier build hands over', async () => {
    const sdk = await readyShop()
    mockNative.notificationsGetHistory.mockResolvedValueOnce({
      notifications: [{ type: 'bulk', codeId: 'c1', dateString: '2026-11-01', dateSentAt: '2026-11-01T10:00:00Z', subject: 'S', bodyData: 'Hi', url: null, icon: null, picture: null, campaignsIds: ['Spring'], statistics: [statistics] }],
    })

    const history = await sdk.notifications.getHistory('secret', 'email', { email: 'a@b.c' })

    expect(history).toEqual({ status: null, messages: [{ ...message, campaignId: null, channel: null }] })
  })

  test('a history without messages is an empty list', async () => {
    const sdk = await readyShop()
    mockNative.notificationsGetHistory.mockResolvedValueOnce({ status: 'success', payload: { messages: [] } })

    await expect(sdk.notifications.getHistory('secret', 'email', { email: 'a@b.c' })).resolves.toEqual({ status: 'success', messages: [] })
  })

  test('the push events go through the native SDK and resolve once its queue took them; JavaScript sends none', async () => {
    const sdk = await readyShop()
    mockNative.notificationsTrack.mockResolvedValue(null)

    await expect(sdk.notifications.trackDelivered('c1', 'bulk')).resolves.toBeUndefined()
    await sdk.notifications.trackOpened('c1', 'bulk')
    await sdk.notifications.trackClicked('c1', 'bulk')
    await sdk.notifications.trackClosed('c1', 'bulk')
    await settle()

    expect(mockNative.notificationsTrack.mock.calls).toEqual([
      [SHOP, 'delivered', 'c1', 'bulk'],
      [SHOP, 'opened', 'c1', 'bulk'],
      [SHOP, 'clicked', 'c1', 'bulk'],
      [SHOP, 'closed', 'c1', 'bulk'],
    ])
    // The native click stores the source itself.
    expect(mockNative.setSource).not.toHaveBeenCalled()
    expect(axios).not.toHaveBeenCalled()
  })

  test('the earlier push methods go to the native SDK too', async () => {
    const sdk = await readyShop()

    sdk.notificationDelivered({ code: 'c2', type: 'chain' })
    sdk.notificationClicked({ code: 'c2', type: 'chain' })
    await settle()

    expect(mockNative.notificationsTrack).toHaveBeenCalledWith(SHOP, 'delivered', 'c2', 'chain')
    expect(mockNative.notificationsTrack).toHaveBeenCalledWith(SHOP, 'clicked', 'c2', 'chain')
    expect(axios).not.toHaveBeenCalled()
  })

  test('a push the SDK draws or sees tapped goes with its code as a string, a number and an APNs src too', async () => {
    const sdk = await readyShop()

    await sdk.showNotification({ messageId: 'm-1', data: { id: 15, type: 'bulk', title: 'Sale' } })
    sdk._pushSeen('clicked', { data: { src: { id: 16, type: 'chain' } } })
    await settle()

    expect(mockNative.notificationsTrack).toHaveBeenCalledWith(SHOP, 'opened', '15', 'bulk')
    expect(mockNative.notificationsTrack).toHaveBeenCalledWith(SHOP, 'clicked', '16', 'chain')
  })

  test('a push event without its code or type is invalidArgument and is not sent', async () => {
    const sdk = await readyShop()

    await expect(sdk.notifications.trackClicked('', 'bulk')).rejects.toMatchObject({ type: 'invalidArgument' })
    await expect(sdk.notifications.trackOpened('c1')).rejects.toMatchObject({ type: 'invalidArgument' })
    expect(axios).not.toHaveBeenCalled()
  })

  test('setPushToken goes to the native SDK with its provider, and getPushToken reads it back', async () => {
    const sdk = await readyShop()
    expect(sdk.notifications.getPushToken()).toBeNull()

    await sdk.notifications.setPushToken('fcm-token', 'fcm')

    expect(mockNative.notificationsSetPushToken).toHaveBeenCalledWith(SHOP, 'fcm-token', 'fcm')
    expect(axios).not.toHaveBeenCalled()
    expect(sdk.notifications.getPushToken()).toEqual({ token: 'fcm-token', provider: 'fcm' })
    expect(sdk.notifications.getPushToken('apns')).toBeNull()
  })

  describe('the providers of a platform', () => {
    const { Platform } = require('react-native')
    const platform = Platform.OS
    afterEach(() => {
      Platform.OS = platform
    })

    test.each([
      ['android', 'hms', 'apns'],
      ['android', 'fcm', 'apns'],
      ['ios', 'apns', 'hms'],
      ['ios', 'fcm', 'hms'],
    ])('on %s %s goes to the native SDK, %s is invalidArgument', async (os, provider, other) => {
      Platform.OS = os
      const sdk = await readyShop()

      await sdk.notifications.setPushToken('token-1', provider)
      await expect(sdk.notifications.setPushToken('token-2', other)).rejects.toMatchObject({ type: 'invalidArgument' })

      expect(mockNative.notificationsSetPushToken.mock.calls).toEqual([[SHOP, 'token-1', provider]])
      expect(sdk.notifications.getPushToken(provider)).toEqual({ token: 'token-1', provider })
    })
  })

  test('the token of the SDK\'s own push registration goes to the native SDK too, and a provider it has none of is refused', async () => {
    const sdk = await readyShop()

    sdk.setPushTokenNotification('own-token')
    await settle()

    expect(mockNative.notificationsSetPushToken).toHaveBeenCalledWith(SHOP, 'own-token', expect.stringMatching(/^(apns|fcm)$/))
    await expect(sdk.notifications.setPushToken('t', 'hms')).rejects.toMatchObject({ type: 'invalidArgument' })
    expect(axios).not.toHaveBeenCalled()
  })
})

describe('the models as the contract has them on both platforms', () => {
  const storyProduct = { id: 'p1', name: 'Shoe', brand: '', price: 10, oldPrice: null, discountPercent: 0 }

  test("stories.get: a slide's and a text block's style the block does not set is \"\", as the contract and the natives have it", async () => {
    const sdk = await readyShop()
    mockNative.storiesGet.mockResolvedValueOnce({
      id: '1',
      stories: [{
        id: '7',
        name: 'Sale',
        slides: [{
          id: '70',
          type: 'image',
          background: 'https://img',
          backgroundColor: '',
          preview: '',
          duration: 10,
          elements: [
            { type: 'textBlock', text: 'Hi', fontType: '', textAlign: '', textColor: '', backgroundColor: '', promocode: null },
            { type: 'button', title: 'Go', link: '', background: '', color: '' },
            { type: 'product', title: '', item: storyProduct },
          ],
        }, {
          id: '71', type: 'video', background: 'https://v', backgroundColor: '#FF0000', preview: 'https://p', duration: 5, elements: [],
        }],
      }],
    })

    const block = await sdk.stories.get('code')

    const [first, second] = block.stories[0].slides
    expect(first).toMatchObject({ backgroundColor: '', preview: '' })
    expect(first.elements[0]).toEqual({
      type: 'textBlock', text: 'Hi', fontType: '', textAlign: '', textColor: '', backgroundColor: '', promocode: null,
    })
    // A button's and a product's texts stay "" too.
    expect(first.elements[1]).toEqual({ type: 'button', title: 'Go', link: '', background: '', color: '' })
    expect(first.elements[2]).toEqual({ type: 'product', title: '', item: storyProduct })
    expect(second).toMatchObject({ backgroundColor: '#FF0000', preview: 'https://p' })
    expect(mockNative.storiesGet).toHaveBeenCalledWith(SHOP, 'code')
  })

  test('the search agent: the answer is the native SDKs\', a reason the agent did not give "" on both platforms', async () => {
    const sdk = await readyShop()
    const product = (reason) => ({ id: 'p1', name: 'Shoe', price: 10, oldPrice: null, reason })
    const message = { id: 2, role: 'assistant', content: 'Look', products: [product(''), product('Fits')] }
    const dialogAnswer = {
      sessions: [{ id: 1, title: 'Shoes', messages: [] }],
      session: { id: 1, title: 'Shoes', messages: [{ id: 1, role: 'user', content: 'Shoes', products: [] }, message] },
    }
    mockNative.searchAgentDialog.mockResolvedValueOnce(dialogAnswer)
    mockNative.searchAgent.mockResolvedValueOnce({ session: { id: 1, messages: [] }, message })

    const dialog = await sdk.search.agentDialog()
    const answer = await sdk.search.agent('Shoes')

    expect(dialog).toEqual(dialogAnswer)
    expect(answer).toEqual({ session: { id: 1, messages: [] }, message })
    expect(answer.message.products.map((p) => p.reason)).toEqual(['', 'Fits'])
  })

  test('an agent message without an id comes with a null id, not dropped and not 0', async () => {
    const sdk = await readyShop()
    const message = { id: null, role: 'assistant', content: 'Look', createdAt: null, products: [] }
    mockNative.searchAgentDialog.mockResolvedValueOnce({ sessions: [], session: { id: 1, title: 'Shoes', messages: [message] } })
    mockNative.searchAgent.mockResolvedValueOnce({ session: { id: 1, messages: [] }, message })

    const dialog = await sdk.search.agentDialog()
    const answer = await sdk.search.agent('Shoes')

    expect(dialog.session.messages).toEqual([message])
    expect(answer.message.id).toBeNull()
  })

  test('a loyalty level without a code is no level; a code is passed on as the native SDK has it', async () => {
    const sdk = await readyShop()
    mockNative.loyaltyGetStatus
      .mockResolvedValueOnce({ isMember: true, level: { code: null, name: null, expirationDate: null } })
      .mockResolvedValueOnce({ isMember: true, level: { code: 'gold', name: 'Gold', expirationDate: '2027-01-01' } })
      .mockResolvedValueOnce({ isMember: false, level: null })

    await expect(sdk.loyalty.getStatus('+100')).resolves.toEqual({ isMember: true, level: null })
    await expect(sdk.loyalty.getStatus('+100')).resolves.toEqual({
      isMember: true, level: { code: 'gold', name: 'Gold', expirationDate: '2027-01-01' },
    })
    await expect(sdk.loyalty.getStatus('+100')).resolves.toEqual({ isMember: false, level: null })
  })

  test('a dialog without sessions keeps its null session', async () => {
    const sdk = await readyShop()
    mockNative.searchAgentDialog.mockResolvedValueOnce({ sessions: [], session: null })

    await expect(sdk.search.agentDialog()).resolves.toEqual({ sessions: [], session: null })
  })
})

describe('the namespaces keep the earlier methods of the same name', () => {
  test('search, cart, segments and subscriptions are callable as before and carry the namespace', async () => {
    const sdk = await readyShop()

    expect(typeof sdk.search).toBe('function')
    expect(typeof sdk.search.full).toBe('function')
    expect(typeof sdk.cart).toBe('function')
    expect(typeof sdk.cart.get).toBe('function')
    expect(typeof sdk.segments).toBe('function')
    expect(typeof sdk.segments.add).toBe('function')
    expect(typeof sdk.subscriptions).toBe('function')
    expect(typeof sdk.subscriptions.manage).toBe('function')
  })
})
