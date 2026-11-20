import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// With the native module the shop runs on the native SDK: it is initialized there, its tracking
// events go to the native SDK's tracking methods, and the requests that still go through JavaScript
// take the native device id and session. The native module is a fake here; axios too, so what reaches the
// network from JavaScript is exactly what the SDK would send. Nothing reaches a real server.

jest.mock('axios', () => jest.fn())

// The fake native module: one object the SDK holds, filled anew before each test.
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

const SHOP = 'native-shop'
const STORE = `@PersonaClick_${SHOP}_`

let listeners
let popupListeners
let snapshot

const { NAMESPACE_METHODS } = jest.requireActual('../lib/native/bridge')

function resetNative() {
  listeners = []
  popupListeners = []
  snapshot = { shopId: SHOP, state: 'initializing', deviceId: null, sessionId: null, segment: 'B' }
  for (const name of NAMESPACE_METHODS) mockNative[name] = jest.fn(async () => undefined)
  Object.assign(mockNative, {
    initializeShop: jest.fn(async () => ({ ...snapshot })),
    getDeviceId: jest.fn(async () => snapshot.deviceId),
    queueEvent: jest.fn(async () => undefined),
    setSource: jest.fn(async () => undefined),
    releaseShop: jest.fn(),
    onStateChanged: jest.fn((listener) => {
      listeners.push(listener)
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    }),
    onPopup: jest.fn((listener) => {
      popupListeners.push(listener)
      return () => {
        popupListeners = popupListeners.filter((l) => l !== listener)
      }
    }),
  })
}

/** The native SDK got a server popup: the module hands it over as the server sent it. */
function nativePopup(popup, shopId = SHOP) {
  popupListeners.forEach((listener) => listener({ shopId, popup }))
}

/** The native instance changes: every listener hears the shop's snapshot. */
function nativeChanges(change) {
  snapshot = { ...snapshot, ...change }
  listeners.forEach((listener) => listener({ ...snapshot }))
}

const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const sentPaths = () => axios.mock.calls.map(([config]) => config.url.replace('https://api.personaclick.com/', ''))

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
  axios.mockImplementation(() => Promise.resolve({ data: { recommends: ['p1'] } }))
  resetNative()
})

describe('init on the native SDK', () => {
  test('the shop is initialized natively with the device id and A/B group an earlier version kept; JavaScript sends no /init', async () => {
    await AsyncStorage.setItem(STORE, JSON.stringify({ did: 'old-did', seance: 'old-sid', sid: 'old-sid', expires: Date.now() + 1e6 }))
    await AsyncStorage.setItem(`${STORE}segment`, 'A')

    const sdk = new PersonaClick(SHOP, 'ios', false, false)
    await settle()

    expect(mockNative.initializeShop).toHaveBeenCalledWith({
      shopId: SHOP,
      stream: 'ios',
      apiDomain: null,
      appDomain: null,
      deviceId: 'old-did',
      segment: 'A',
      logLevel: null,
    })
    expect(sentPaths()).not.toContain('init')
    expect(sdk.isInit()).toBe(false)
  })

  test('the push token 4.x kept goes to the native SDK on its start, once: a token the native SDK has already does not', async () => {
    const { Platform } = require('react-native')
    const provider = Platform.OS === 'ios' ? 'apns' : 'fcm'
    await AsyncStorage.setItem(`${STORE}push_token`, 'kept-token')

    const sdk = new PersonaClick(SHOP, 'ios', false, false)
    await settle()

    expect(mockNative.notificationsSetPushToken).toHaveBeenCalledTimes(1)
    expect(mockNative.notificationsSetPushToken).toHaveBeenCalledWith(SHOP, 'kept-token', provider)
    expect(sdk.notifications.getPushToken(provider)).toEqual({ token: 'kept-token', provider })

    sdk.release()
    resetNative()
    snapshot = { ...snapshot, pushTokens: { [provider]: 'kept-token' } }
    new PersonaClick(SHOP, 'ios', false, false)
    await settle()
    expect(mockNative.notificationsSetPushToken).not.toHaveBeenCalled()
  })

  test('without a kept push token nothing goes to the native SDK at its start', async () => {
    new PersonaClick(SHOP, 'ios', false, false)
    await settle()

    expect(mockNative.notificationsSetPushToken).not.toHaveBeenCalled()
  })

  test('a shop whose app names no stream runs as react-native, natively and in its JavaScript requests', async () => {
    const sdk = new PersonaClick(SHOP, undefined, false, false)
    await settle()
    expect(mockNative.initializeShop).toHaveBeenCalledWith(expect.objectContaining({ shopId: SHOP, stream: 'react-native' }))

    nativeChanges({ state: 'ready', deviceId: 'native-did', sessionId: 'native-sid' })
    await settle()
    await sdk.recommend('block-1', { item: '37' })
    expect(axios.mock.calls[0][0].params).toMatchObject({ stream: 'react-native', did: 'native-did' })
  })

  test("an app's own stream is kept, natively and in the JavaScript requests", async () => {
    const sdk = await readyShop()
    expect(mockNative.initializeShop).toHaveBeenCalledWith(expect.objectContaining({ stream: 'android' }))

    await sdk.recommend('block-1', { item: '37' })
    expect(axios.mock.calls[0][0].params).toMatchObject({ stream: 'android' })
  })

  test('the instance is initialized once the native SDK has a device id, and takes its identity', async () => {
    const sdk = await readyShop()

    expect(sdk.isInit()).toBe(true)
    expect(sdk.deviceId).toBe('native-did')
    expect(sdk.userSeance).toBe('native-sid')
    expect(sdk.segment).toBe('B')
    await expect(sdk.getDeviceId()).resolves.toBe('native-did')
    // The stored identity follows the native one, the A/B group too.
    expect(JSON.parse(await AsyncStorage.getItem(STORE)).did).toBe('native-did')
    expect(await AsyncStorage.getItem(`${STORE}segment`)).toBe('B')
  })

  test('a request that still goes through JavaScript waits for the native device id and carries it and the session', async () => {
    const sdk = new PersonaClick(SHOP, 'android', false, false)
    await settle()
    // The stories of the UI kit's viewer still come through JavaScript.
    const stories = sdk.getStories('block-1')
    await settle()
    expect(sentPaths()).toEqual([])

    nativeChanges({ state: 'ready', deviceId: 'native-did', sessionId: 'native-sid' })
    await stories

    const [config] = axios.mock.calls[0]
    expect(config.url).toBe('https://api.personaclick.com/stories/block-1')
    expect(config.params).toMatchObject({ did: 'native-did', sid: 'native-sid', seance: 'native-sid' })
  })

  test('a new session of the native SDK reaches the requests', async () => {
    const sdk = await readyShop()
    nativeChanges({ sessionId: 'next-sid' })
    await settle()

    await sdk.getStories('block-1')
    expect(axios.mock.calls[0][0].params).toMatchObject({ sid: 'next-sid', seance: 'next-sid' })
  })

  test('a shop the native SDK refused sends no request', async () => {
    const sdk = new PersonaClick(SHOP, 'android', false, false)
    await settle()
    nativeChanges({ state: 'refused' })
    await settle()

    const result = await sdk.getStories('block-1')
    expect(result).toBeInstanceOf(Error)
    expect(sentPaths()).toEqual([])
  })

  test('a tracking source an earlier version stored moves to the native SDK once', async () => {
    const now = Math.floor(Date.now() / 1000)
    await AsyncStorage.multiSet([
      [`${STORE}timeStartSave`, String(now - 60)],
      [`${STORE}recomendedCode`, 'block-7'],
      [`${STORE}recomendedType`, 'dynamic'],
    ])

    new PersonaClick(SHOP, 'android', false, false)
    await settle()

    expect(mockNative.setSource).toHaveBeenCalledWith(SHOP, 'dynamic', 'block-7')
    expect(await AsyncStorage.getItem(`${STORE}recomendedCode`)).toBeNull()
  })

})

describe('the popups of the native SDK are shown here, as 4.0 showed its own', () => {
  const popup = {
    id: 7, channels: ['mobile'], position: 'centered', delay: 0, html: '',
    components: '{"header":"Hello","text":"Body"}', web_push_system: false,
    popup_actions: '{"close":{"button_text":"Close"}}',
  }

  test('the overlay shows it and it is reported shown through the native tracking, not from here', async () => {
    const sdk = await readyShop()
    const overlay = jest.spyOn(require('../components/Popup/SdkPopupOverlay'), 'prepareAndShow')

    nativePopup(popup)
    await settle()

    // The instance listens for its own shop's popups: those held before it listened come to it too.
    expect(mockNative.onPopup).toHaveBeenCalledWith(expect.any(Function), SHOP)
    // The native SDK hands it over once its delay passed: not waited again here.
    expect(overlay).toHaveBeenCalledWith(sdk, popup, false, { delayWaited: true })
    expect(mockNative.trackingPopupShown).toHaveBeenCalledWith(SHOP, 7)
    expect(sentPaths()).toEqual([])
    overlay.mockRestore()
  })

  test("the app's delegate gets it as the server sent it, and the overlay shows nothing", async () => {
    const sdk = await readyShop()
    const delegate = jest.fn()
    sdk.popupPresentationDelegate = delegate
    const overlay = jest.spyOn(require('../components/Popup/SdkPopupOverlay'), 'prepareAndShow')

    nativePopup(popup)
    await settle()

    expect(delegate).toHaveBeenCalledWith(popup, sdk)
    expect(overlay).not.toHaveBeenCalled()
    // Shown by the app, reported by the app (sdk.trackPopupShown).
    expect(mockNative.trackingPopupShown).not.toHaveBeenCalled()
    overlay.mockRestore()
  })

  test('with the automatic presentation off it is not shown', async () => {
    const sdk = await readyShop()
    sdk.enableAutoPopupPresentation = false
    const overlay = jest.spyOn(require('../components/Popup/SdkPopupOverlay'), 'prepareAndShow')

    nativePopup(popup)
    await settle()

    expect(overlay).not.toHaveBeenCalled()
    overlay.mockRestore()
  })

  test('one that comes before the instance has its device id waits for it, as a popup of the /init answer did', async () => {
    const sdk = new PersonaClick(SHOP, 'android', false, false)
    await settle()
    const delegate = jest.fn()
    sdk.popupPresentationDelegate = delegate

    nativePopup(popup)
    await settle()
    expect(delegate).not.toHaveBeenCalled()

    nativeChanges({ state: 'ready', deviceId: 'native-did', sessionId: 'native-sid' })
    await settle()
    expect(delegate).toHaveBeenCalledWith(popup, sdk)
  })

  test("another shop's popup, and one after release, are not this instance's", async () => {
    const sdk = await readyShop()
    const delegate = jest.fn()
    sdk.popupPresentationDelegate = delegate

    nativePopup(popup, 'other-shop')
    await settle()
    sdk.release()
    nativePopup(popup)
    await settle()

    expect(delegate).not.toHaveBeenCalled()
  })
})

describe('tracking through the native tracking methods', () => {
  test('each contract method calls the native method of its name with the wire values', async () => {
    const sdk = await readyShop()

    await sdk.tracking.productView('p1', { type: 'instantSearch', code: 'shoes' })
    await sdk.tracking.categoryView(17)
    await sdk.tracking.search('boots', ['p1', 'p2'])
    await sdk.tracking.addToCart({ id: 'p1', quantity: 2, price: 10.5, fashionSize: undefined })
    await sdk.tracking.syncCart([])
    await sdk.tracking.removeFromCart('p1')
    await sdk.tracking.addToFavorites('p1')
    await sdk.tracking.syncFavorites(['p1', 'p2'])
    await sdk.tracking.removeFromFavorites('p2')
    await sdk.tracking.purchase({ orderId: 'o1', orderPrice: 20, items: [{ id: 'p1', amount: 1, price: 20 }] }, { type: 'dynamic', code: 'b1' })
    await sdk.tracking.storyView('42', 7)
    await sdk.tracking.storyClick('42', '7', 'block')
    await sdk.tracking.bannerView(15, 'main_slider')
    await sdk.tracking.bannerClick('15', 'main_slider')
    await sdk.tracking.popupShown(9)
    await sdk.tracking.custom('promo_viewed', { label: 'spring', value: 3, customFields: { tier: 'gold', skip: undefined } })

    expect(mockNative.trackingProductView).toHaveBeenCalledWith(SHOP, 'p1', { type: 'instant_search', code: 'shoes' })
    expect(mockNative.trackingCategoryView).toHaveBeenCalledWith(SHOP, '17')
    expect(mockNative.trackingSearch).toHaveBeenCalledWith(SHOP, 'boots', ['p1', 'p2'])
    expect(mockNative.trackingAddToCart).toHaveBeenCalledWith(SHOP, { id: 'p1', quantity: 2, price: 10.5 }, null)
    expect(mockNative.trackingSyncCart).toHaveBeenCalledWith(SHOP, [])
    expect(mockNative.trackingRemoveFromCart).toHaveBeenCalledWith(SHOP, 'p1')
    expect(mockNative.trackingAddToFavorites).toHaveBeenCalledWith(SHOP, 'p1', null)
    expect(mockNative.trackingSyncFavorites).toHaveBeenCalledWith(SHOP, ['p1', 'p2'])
    expect(mockNative.trackingRemoveFromFavorites).toHaveBeenCalledWith(SHOP, 'p2')
    expect(mockNative.trackingPurchase).toHaveBeenCalledWith(
      SHOP,
      { orderId: 'o1', orderPrice: 20, items: [{ id: 'p1', amount: 1, price: 20 }] },
      { type: 'dynamic', code: 'b1' },
    )
    expect(mockNative.trackingStoryView).toHaveBeenCalledWith(SHOP, '42', '7', null)
    expect(mockNative.trackingStoryClick).toHaveBeenCalledWith(SHOP, '42', '7', 'block')
    expect(mockNative.trackingBannerView).toHaveBeenCalledWith(SHOP, '15', 'main_slider')
    expect(mockNative.trackingBannerClick).toHaveBeenCalledWith(SHOP, '15', 'main_slider')
    expect(mockNative.trackingPopupShown).toHaveBeenCalledWith(SHOP, 9)
    expect(mockNative.trackingCustom).toHaveBeenCalledWith(SHOP, 'promo_viewed', null, null, 'spring', 3, { tier: 'gold' })
    // Neither the native queue's raw entry nor JavaScript sends them.
    expect(mockNative.queueEvent).not.toHaveBeenCalled()
    expect(sentPaths()).toEqual([])
  })

  test('a call resolves with nothing as soon as the native queue took the event, on either platform', async () => {
    const sdk = await readyShop()
    // Android's module resolves with null once tracking.queued heard the queue accept the event.
    mockNative.trackingCustom.mockResolvedValueOnce(null)
    let heldAnswer
    mockNative.trackingProductView.mockImplementationOnce(() => new Promise((resolve) => {
      heldAnswer = resolve
    }))

    await expect(sdk.tracking.custom('unknown_event')).resolves.toBeUndefined()
    const view = sdk.tracking.productView('p1')
    let settled = false
    view.then(() => {
      settled = true
    })
    await settle()
    expect(settled).toBe(false)
    heldAnswer(undefined)
    await expect(view).resolves.toBeUndefined()
    expect(sentPaths()).toEqual([])
  })

  test('calls wait for the native instance, not for its device id', async () => {
    const sdk = new PersonaClick(SHOP, 'android', false, false)
    const accepted = sdk.tracking.productView('p1')
    await settle()

    await accepted
    expect(mockNative.trackingProductView).toHaveBeenCalledWith(SHOP, 'p1', null)
    expect(sdk.isInit()).toBe(false)
  })

  test('the native SDK checks the arguments: its refusal reaches the caller as an SdkError', async () => {
    const sdk = await readyShop()
    mockNative.trackingProductView.mockRejectedValueOnce(new SdkError('invalidArgument', 'itemId is empty'))

    await expect(sdk.tracking.productView('')).rejects.toMatchObject({ type: 'invalidArgument', message: 'itemId is empty' })
    expect(mockNative.trackingProductView).toHaveBeenCalledWith(SHOP, '', null)
  })

  test('a source type no platform has is refused before the native SDK', async () => {
    const sdk = await readyShop()

    await expect(sdk.tracking.productView('p1', { type: 'nowhere', code: 'x' })).rejects.toMatchObject({ type: 'invalidArgument' })
    expect(mockNative.trackingProductView).not.toHaveBeenCalled()
  })

  test('a shop the native SDK refused gets shopBlocked', async () => {
    const sdk = await readyShop()
    mockNative.trackingCategoryView.mockRejectedValueOnce(new SdkError('shopBlocked', 'The shop is blocked'))

    await expect(sdk.tracking.categoryView('c1')).rejects.toMatchObject({ type: 'shopBlocked' })
  })

  test('setSource stores the source in the native SDK', async () => {
    const sdk = await readyShop()
    sdk.tracking.setSource({ type: 'fullSearch', code: 'boots' })
    await settle()

    expect(mockNative.setSource).toHaveBeenCalledWith(SHOP, 'full_search', 'boots')
  })
})

describe('the earlier tracking methods on the native SDK', () => {
  test('they call the native tracking methods with the same values as before', async () => {
    const sdk = await readyShop()

    sdk.track('view', { id: 'p1', recommended_by: 'dynamic', recommended_code: 'b1' })
    sdk.track('category', 'c1')
    sdk.track('cart', [{ id: 'p1', quantity: 2, price: 5 }])
    sdk.track('cart', { id: 'p2', amount: 3 })
    sdk.track('remove_from_cart', 'p2')
    sdk.track('wish', ['p1', 'p3'])
    sdk.track('wish', 'p4')
    sdk.track('remove_wish', 'p4')
    sdk.track('search', { query: 'boots', results: ['p1'] })
    sdk.trackEvent('promo_viewed', { label: 'spring' })
    sdk.trackPurchase({ orderId: 'o1', orderPrice: 20, items: [{ id: 'p1', amount: 1, price: 20 }] })
    sdk.trackSource('full_search', 'boots')
    await sdk.trackStoryView('42', '7', 'code')
    await sdk.trackPopupShown(9)
    await settle()

    expect(mockNative.trackingProductView).toHaveBeenCalledWith(SHOP, 'p1', { type: 'dynamic', code: 'b1' })
    expect(mockNative.trackingCategoryView).toHaveBeenCalledWith(SHOP, 'c1')
    expect(mockNative.trackingSyncCart).toHaveBeenCalledWith(SHOP, [{ id: 'p1', quantity: 2, price: 5 }])
    expect(mockNative.trackingAddToCart).toHaveBeenCalledWith(SHOP, { id: 'p2', quantity: 3 }, null)
    expect(mockNative.trackingRemoveFromCart).toHaveBeenCalledWith(SHOP, 'p2')
    expect(mockNative.trackingSyncFavorites).toHaveBeenCalledWith(SHOP, ['p1', 'p3'])
    expect(mockNative.trackingAddToFavorites).toHaveBeenCalledWith(SHOP, 'p4', null)
    expect(mockNative.trackingRemoveFromFavorites).toHaveBeenCalledWith(SHOP, 'p4')
    expect(mockNative.trackingSearch).toHaveBeenCalledWith(SHOP, 'boots', ['p1'])
    // trackEvent goes as 4.x built it, through the native queue's raw entry.
    expect(mockNative.queueEvent).toHaveBeenCalledWith(SHOP, 'push/custom', { event: 'promo_viewed', label: 'spring' })
    expect(mockNative.trackingCustom).not.toHaveBeenCalled()
    expect(mockNative.trackingPurchase).toHaveBeenCalledWith(
      SHOP, { orderId: 'o1', orderPrice: 20, items: [{ id: 'p1', amount: 1, price: 20 }] }, null,
    )
    expect(mockNative.setSource).toHaveBeenCalledWith(SHOP, 'full_search', 'boots')
    expect(mockNative.trackingStoryView).toHaveBeenCalledWith(SHOP, '42', '7', 'code')
    expect(mockNative.trackingPopupShown).toHaveBeenCalledWith(SHOP, 9)
    expect(mockNative.queueEvent).toHaveBeenCalledTimes(1)
    expect(sentPaths()).toEqual([])
  })

  test('trackEvent sends what 4.x sent: a fractional value and a time past 32 bits go, the custom fields at the top and in payload', async () => {
    const sdk = await readyShop()
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const warnings = jest.spyOn(console, 'warn').mockImplementation(() => {})

    sdk.trackEvent('promo_viewed', { time: 4102444800, value: 9.99, category: 'promo', customFields: { tier: 'gold', none: null } })
    sdk.trackEvent('promo_viewed', { unknown: 1 })
    sdk.trackEvent('')
    await settle()

    expect(mockNative.queueEvent).toHaveBeenCalledTimes(1)
    expect(mockNative.queueEvent).toHaveBeenCalledWith(SHOP, 'push/custom', {
      event: 'promo_viewed', time: 4102444800, value: 9.99, category: 'promo', tier: 'gold', payload: { tier: 'gold' },
    })
    expect(mockNative.trackingCustom).not.toHaveBeenCalled()
    // What 4.x refused before sending is refused as it was: logged, nothing goes.
    expect(errors).toHaveBeenCalledWith('trackEvent: unknown param keys: unknown')
    expect(errors).toHaveBeenCalledWith('trackEvent: event must not be empty')
    expect(sentPaths()).toEqual([])
    errors.mockRestore()
    warnings.mockRestore()
  })

  test('tracking.custom hands the module time and value as they are; the module takes whole 32-bit numbers on both platforms', async () => {
    const sdk = await readyShop()
    mockNative.trackingCustom.mockRejectedValueOnce(new SdkError('invalidArgument', 'time must be a whole number'))

    await expect(sdk.tracking.custom('promo_viewed', { time: 4102444800 })).rejects.toMatchObject({ type: 'invalidArgument' })
    expect(mockNative.trackingCustom).toHaveBeenCalledWith(SHOP, 'promo_viewed', 4102444800, null, null, null, null)
    expect(mockNative.queueEvent).not.toHaveBeenCalled()
  })

  test('trackSource stores what 4.x stored: the native SDK keeps a source it takes, a code as a string, a contract name by its wire value', async () => {
    const sdk = await readyShop()

    sdk.trackSource('dynamic', 42)
    sdk.trackSource('instantSearch', 'boots')
    await settle()

    expect(mockNative.setSource).toHaveBeenNthCalledWith(1, SHOP, 'dynamic', '42')
    expect(mockNative.setSource).toHaveBeenNthCalledWith(2, SHOP, 'instant_search', 'boots')
    expect(await AsyncStorage.getItem(`${STORE}recomendedType`)).toBeNull()
  })

  test('trackSource hands slider and agent_search to the native SDK by their wire values, as any source it takes', async () => {
    const sdk = await readyShop()
    const warnings = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await AsyncStorage.multiSet([
      [`${STORE}timeStartSave`, String(Math.floor(Date.now() / 1000) - 60)],
      [`${STORE}recomendedCode`, 'n-1'],
      [`${STORE}recomendedType`, 'newsletter'],
    ])

    sdk.trackSource('slider', 'main_slider')
    sdk.trackSource('agentSearch', 12)
    await settle()

    expect(mockNative.setSource).toHaveBeenNthCalledWith(1, SHOP, 'slider', 'main_slider')
    expect(mockNative.setSource).toHaveBeenNthCalledWith(2, SHOP, 'agent_search', '12')
    // The new source replaces one kept 4.x's way.
    expect(await AsyncStorage.getItem(`${STORE}recomendedType`)).toBeNull()
    expect(warnings).not.toHaveBeenCalled()
    warnings.mockRestore()
  })

  test('a source the native SDK does not take is stored as 4.x stored it, and a later one it takes replaces it', async () => {
    const sdk = await readyShop()
    const warnings = jest.spyOn(console, 'warn').mockImplementation(() => {})

    sdk.trackSource('newsletter', 'n-1')
    await settle()

    expect(mockNative.setSource).not.toHaveBeenCalled()
    expect(await AsyncStorage.getItem(`${STORE}recomendedType`)).toBe('newsletter')
    expect(await AsyncStorage.getItem(`${STORE}recomendedCode`)).toBe('n-1')
    expect(Number(await AsyncStorage.getItem(`${STORE}timeStartSave`))).toBeGreaterThan(0)
    expect(warnings).toHaveBeenCalled()

    sdk.trackSource('dynamic', 'block-1')
    await settle()
    expect(mockNative.setSource).toHaveBeenCalledWith(SHOP, 'dynamic', 'block-1')
    expect(await AsyncStorage.getItem(`${STORE}recomendedType`)).toBeNull()
    warnings.mockRestore()
  })

  test.each([
    ['slider', 'slider'],
    ['agent_search', 'agent_search'],
    ['agentSearch', 'agent_search'],
  ])('a stored %s source moves to the native SDK at the start by its wire value and goes from AsyncStorage', async (stored, wire) => {
    const now = Math.floor(Date.now() / 1000)
    await AsyncStorage.multiSet([
      [`${STORE}timeStartSave`, String(now - 60)],
      [`${STORE}recomendedCode`, 'main_slider'],
      [`${STORE}recomendedType`, stored],
    ])

    const sdk = new PersonaClick(SHOP, 'android', false, false)
    await settle()

    expect(mockNative.setSource).toHaveBeenCalledWith(SHOP, wire, 'main_slider')
    expect(await AsyncStorage.getItem(`${STORE}recomendedType`)).toBeNull()
    expect(await AsyncStorage.getItem(`${STORE}recomendedCode`)).toBeNull()
    sdk.release()
  })

  test('a stored source the native SDK refuses stays for a later start', async () => {
    const now = Math.floor(Date.now() / 1000)
    await AsyncStorage.multiSet([
      [`${STORE}timeStartSave`, String(now - 60)],
      [`${STORE}recomendedCode`, 'n-1'],
      [`${STORE}recomendedType`, 'newsletter'],
    ])
    mockNative.setSource.mockRejectedValueOnce(new SdkError('invalidArgument', 'Unknown source type: newsletter'))

    const sdk = new PersonaClick(SHOP, 'android', false, false)
    await settle()

    expect(mockNative.setSource).toHaveBeenCalledWith(SHOP, 'newsletter', 'n-1')
    expect(await AsyncStorage.getItem(`${STORE}recomendedType`)).toBe('newsletter')
    sdk.release()
  })

  test('what no native tracking method covers goes through the native queue with the fields as before', async () => {
    const sdk = await readyShop()

    sdk.track('purchase', { order: 'o9', order_price: 30, products: [{ id: 'p1', quantity: 2 }], search_segment: 'x' })
    sdk.track('recone_view', { id: 'c7', inventory: 'i1', position: 2 })
    sdk.track('view', { id: 'p1', recommended_by: 'trigger_mail', recommended_code: 'm1' })
    await settle()

    expect(mockNative.queueEvent).toHaveBeenCalledWith(SHOP, 'push', {
      event: 'purchase', order_id: 'o9', order_price: 30, items: [{ id: 'p1', quantity: 2 }], segment_ab: 'x',
    })
    expect(mockNative.queueEvent).toHaveBeenCalledWith(SHOP, 'push', {
      event: 'recone_view', campaign: 'c7', inventory: 'i1', position: 2,
    })
    expect(mockNative.queueEvent).toHaveBeenCalledWith(SHOP, 'push', {
      event: 'view', items: [{ id: 'p1' }], recommended_by: 'trigger_mail', recommended_code: 'm1',
    })
    expect(mockNative.trackingProductView).not.toHaveBeenCalled()
  })

  test('slider and agentSearch reach the native module by their wire values: the events, setSource, a purchase and the earlier track', async () => {
    const sdk = await readyShop()
    const order = { orderId: 'o1', orderPrice: 20, items: [{ id: 'p1', amount: 1, price: 20 }] }

    await sdk.tracking.productView('37', { type: 'slider', code: 'main_slider' })
    await sdk.tracking.productView('38', { type: 'agentSearch', code: '12' })
    await sdk.tracking.addToCart({ id: 'p1' }, { type: 'agentSearch', code: '42' })
    await sdk.tracking.addToFavorites('p2', { type: 'agent_search', code: '43' })
    await sdk.tracking.purchase(order, { type: 'slider', code: 'main_slider' })
    sdk.tracking.setSource({ type: 'agentSearch', code: '1' })
    sdk.track('view', { id: 'p3', recommended_by: 'slider', recommended_code: 'main_slider' })
    sdk.track('cart', { id: 'p4', recommended_by: 'agent_search', recommended_code: '7' })
    await settle()

    expect(mockNative.trackingProductView).toHaveBeenNthCalledWith(1, SHOP, '37', { type: 'slider', code: 'main_slider' })
    expect(mockNative.trackingProductView).toHaveBeenNthCalledWith(2, SHOP, '38', { type: 'agent_search', code: '12' })
    expect(mockNative.trackingAddToCart).toHaveBeenNthCalledWith(1, SHOP, { id: 'p1' }, { type: 'agent_search', code: '42' })
    expect(mockNative.trackingAddToFavorites).toHaveBeenCalledWith(SHOP, 'p2', { type: 'agent_search', code: '43' })
    expect(mockNative.trackingPurchase).toHaveBeenCalledWith(SHOP, order, { type: 'slider', code: 'main_slider' })
    expect(mockNative.setSource).toHaveBeenCalledWith(SHOP, 'agent_search', '1')
    // The earlier track goes through the native tracking methods too, no longer through the raw queue.
    expect(mockNative.trackingProductView).toHaveBeenNthCalledWith(3, SHOP, 'p3', { type: 'slider', code: 'main_slider' })
    expect(mockNative.trackingAddToCart).toHaveBeenNthCalledWith(2, SHOP, { id: 'p4' }, { type: 'agent_search', code: '7' })
    expect(mockNative.queueEvent).not.toHaveBeenCalled()
  })

  test("tracking.purchase hands the native SDK only the contract's fields; trackPurchase all of 4.x's request", async () => {
    const sdk = await readyShop()
    const warnings = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const legacy = {
      orderId: 'o1',
      orderPrice: 20,
      items: [{ id: 'p1', amount: 1, price: 20, quantity: 2, lineId: 'l1', fashionSize: 'M' }],
      deliveryType: 'courier',
      deliveryAddress: 'Main st.',
      paymentType: 'card',
      isTaxFree: true,
      promocode: 'SPRING',
      orderCash: 15,
      orderBonuses: 5,
      orderDelivery: 3,
      orderDiscount: 2,
      channel: 'app',
      custom: { tier: 'gold' },
      recommendedBy: { type: 'dynamic', code: 'block_a' },
      recommendedSource: { from: 'x' },
      stream: 'web',
      segment: 'A',
      isGiftPackage: true,
    }

    await sdk.tracking.purchase(legacy, { type: 'fullSearch', code: 'boots' })
    sdk.trackPurchase(legacy)
    await settle()

    expect(mockNative.trackingPurchase).toHaveBeenNthCalledWith(1, SHOP, {
      orderId: 'o1',
      orderPrice: 20,
      items: [{ id: 'p1', amount: 1, price: 20, lineId: 'l1', fashionSize: 'M' }],
      deliveryType: 'courier',
      deliveryAddress: 'Main st.',
      paymentType: 'card',
      isTaxFree: true,
      promocode: 'SPRING',
      orderCash: 15,
      orderBonuses: 5,
      orderDelivery: 3,
      orderDiscount: 2,
      channel: 'app',
      custom: { tier: 'gold' },
      isGiftPackage: true,
    }, { type: 'full_search', code: 'boots' })
    expect(warnings).toHaveBeenCalledTimes(1)
    expect(warnings.mock.calls[0][0]).toMatch(/recommendedBy, recommendedSource, stream, segment, items\[0\]\.quantity not sent/)
    // The deprecated method: 4.x's request as it is, the native module reads its attribution.
    expect(mockNative.trackingPurchase).toHaveBeenNthCalledWith(2, SHOP, legacy, null)
    expect(sentPaths()).toEqual([])
    warnings.mockRestore()
  })

  test('a contract purchase warns about nothing', async () => {
    const sdk = await readyShop()
    const warnings = jest.spyOn(console, 'warn').mockImplementation(() => {})

    await sdk.tracking.purchase({ orderId: 'o1', orderPrice: 20, items: [{ id: 'p1', amount: 1, price: 20 }], channel: undefined })

    expect(mockNative.trackingPurchase).toHaveBeenCalledWith(
      SHOP, { orderId: 'o1', orderPrice: 20, items: [{ id: 'p1', amount: 1, price: 20 }] }, null,
    )
    expect(warnings).not.toHaveBeenCalled()
    warnings.mockRestore()
  })

  test('a refusal of the native SDK is logged, as the check before was', async () => {
    const sdk = await readyShop()
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockNative.trackingPurchase.mockRejectedValueOnce(new SdkError('invalidArgument', 'orderId is empty'))

    sdk.trackPurchase({ orderId: '', orderPrice: 1, items: [] })
    await settle()

    expect(errors).toHaveBeenCalledWith('[SDK] trackPurchase failed:', 'orderId is empty')
    errors.mockRestore()
  })
})
