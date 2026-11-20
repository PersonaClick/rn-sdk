import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// The instance's own methods of the contract (`sdk/contract/root.md`) on the native SDK: flush sends
// the native queue now, release stops the instance for good, deleteUserCredentials forgets the customer.
// What this JavaScript still holds — its copy of the device id and session, the stored identity, the
// push token it registers, the calls it sends itself — follows each of them. The native module and
// axios are fakes: nothing reaches a server.

jest.mock('axios', () => jest.fn())

jest.mock('../lib/native/bridge', () => ({
  nativeBridge: {},
  toSdkError: (e) => e,
  DEFAULT_STREAM: jest.requireActual('../lib/native/bridge').DEFAULT_STREAM,
}))

// eslint-disable-next-line import/first
import { nativeBridge as mockNative } from '../lib/native/bridge'
// eslint-disable-next-line import/first
import PersonaClick, { UnknownShopIdError } from '../index.js'
// eslint-disable-next-line import/first
import { SdkError } from '../lib/facade/errors'
// eslint-disable-next-line import/first
import registry from '../lib/registry/SdkRegistry'
// eslint-disable-next-line import/first
import { requestCache } from '../components/widgets/requestCache'

const SHOP = 'root-shop'
const OTHER = 'other-shop'
const STORE = `@PersonaClick_${SHOP}_`
const RECENT = `personalization.ui.recentSearches.${SHOP}`

let listeners
let snapshot

const { NAMESPACE_METHODS } = jest.requireActual('../lib/native/bridge')

function resetNative() {
  listeners = []
  snapshot = { shopId: SHOP, state: 'initializing', deviceId: null, sessionId: null, segment: 'B' }
  for (const name of NAMESPACE_METHODS) mockNative[name] = jest.fn(async () => undefined)
  Object.assign(mockNative, {
    initializeShop: jest.fn(async (config) => ({ ...snapshot, shopId: config.shopId })),
    getDeviceId: jest.fn(async () => snapshot.deviceId),
    queueEvent: jest.fn(async () => undefined),
    setSource: jest.fn(async () => undefined),
    setAutoPopupPresentation: jest.fn(),
    flush: jest.fn(async () => undefined),
    releaseShop: jest.fn(),
    // The native wipe: the device id and the session go; /init for the next one starts.
    deleteUserCredentials: jest.fn(async () => {
      snapshot = { ...snapshot, state: 'initializing', deviceId: null, sessionId: null }
    }),
    onStateChanged: jest.fn((listener) => {
      listeners.push(listener)
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    }),
  })
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
const sent = (path) => axios.mock.calls.map(([config]) => config).filter((config) => config.url.endsWith(`/${path}`))
const stored = async () => JSON.parse(await AsyncStorage.getItem(STORE))

async function readyShop() {
  const sdk = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
  await settle()
  nativeChanges({ state: 'ready', deviceId: 'native-did', sessionId: 'native-sid' })
  await settle()
  return sdk
}

beforeEach(async () => {
  await AsyncStorage.clearAll()
  axios.mockReset()
  axios.mockImplementation(() => Promise.resolve({ data: { status: 'success' } }))
  PersonaClick.reset()
  registry.reset()
  resetNative()
})

describe('flush', () => {
  test('asks the native SDK to send the shop queue and settles as it does', async () => {
    const sdk = await readyShop()
    // Android's module resolves with null.
    mockNative.flush.mockResolvedValueOnce(null)

    await expect(sdk.flush()).resolves.toBeUndefined()
    expect(mockNative.flush).toHaveBeenCalledWith(SHOP)
  })

  test('waits for the native instance, not for its device id', async () => {
    const sdk = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    const flushed = sdk.flush()
    await settle()

    await flushed
    expect(mockNative.flush).toHaveBeenCalledWith(SHOP)
    expect(mockNative.initializeShop.mock.invocationCallOrder[0]).toBeLessThan(mockNative.flush.mock.invocationCallOrder[0])
    expect(sdk.isInit()).toBe(false)
  })

  test('an instance whose native start failed rejects with notInitialized', async () => {
    mockNative.initializeShop.mockRejectedValueOnce(new SdkError('invalidArgument', 'shopId must not be empty'))
    const sdk = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    await settle()

    await expect(sdk.flush()).rejects.toMatchObject({ name: 'SdkError', type: 'notInitialized' })
    expect(mockNative.flush).not.toHaveBeenCalled()
  })

  test('the native refusal reaches the caller as an SdkError', async () => {
    const sdk = await readyShop()
    mockNative.flush.mockRejectedValueOnce(new SdkError('notInitialized', 'released'))

    await expect(sdk.flush()).rejects.toMatchObject({ type: 'notInitialized', message: 'released' })
  })
})

describe('release', () => {
  test('releases the native instance and takes the shop out of the registry', async () => {
    const sdk = await readyShop()

    expect(sdk.release()).toBeUndefined()

    expect(mockNative.releaseShop).toHaveBeenCalledWith(SHOP)
    expect(PersonaClick.isInitialized(SHOP)).toBe(false)
    expect(() => PersonaClick.getInstance(SHOP)).toThrow(UnknownShopIdError)
    expect(sdk.isInit()).toBe(false)
  })

  test('every later call rejects with notInitialized and nothing reaches the native SDK or the network', async () => {
    const sdk = await readyShop()
    sdk.release()
    const calledBefore = mockNative.productsGetInfo.mock.calls.length

    const rejections = [
      sdk.flush(),
      sdk.deleteUserCredentials(),
      sdk.products.getInfo('37'),
      sdk.recommendations.get('block'),
      sdk.tracking.productView('37'),
      sdk.notifications.trackClicked('m1', 'bulk'),
      sdk.notifications.setPushToken('token', 'fcm'),
      sdk.getDeviceId(),
      sdk.initPush(),
    ]
    for (const call of rejections) {
      await expect(call).rejects.toMatchObject({ name: 'SdkError', type: 'notInitialized' })
    }
    // An earlier method that resolves with its errors resolves with it.
    await expect(sdk.getStories('block-1')).resolves.toMatchObject({ name: 'SdkError', type: 'notInitialized' })
    sdk.tracking.setSource({ type: 'dynamic', code: 'b1' })
    await settle()

    expect(mockNative.productsGetInfo.mock.calls.length).toBe(calledBefore)
    expect(mockNative.flush).not.toHaveBeenCalled()
    expect(mockNative.deleteUserCredentials).not.toHaveBeenCalled()
    expect(mockNative.trackingProductView).not.toHaveBeenCalled()
    expect(mockNative.setSource).not.toHaveBeenCalled()
    expect(sentPaths()).toEqual([])
  })

  test('calls waiting for the device id settle at once, as not initialized', async () => {
    const sdk = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    await settle()
    const stories = sdk.getStories('block-1')
    const clicked = sdk.notifications.trackClicked('m1', 'bulk')

    sdk.release()

    await expect(stories).resolves.toMatchObject({ type: 'notInitialized' })
    await expect(clicked).rejects.toMatchObject({ type: 'notInitialized' })
    expect(sentPaths()).toEqual([])
  })

  test('the native state no longer reaches the released instance', async () => {
    const sdk = await readyShop()
    sdk.release()

    nativeChanges({ deviceId: 'someone-else', sessionId: 'other-sid' })

    expect(listeners).toEqual([])
    expect(sdk.deviceId).toBe('native-did')
  })

  test('a new initialize of the shop makes a fresh instance, which works', async () => {
    const sdk = await readyShop()
    sdk.release()

    const fresh = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    await settle()
    nativeChanges({ state: 'ready' })
    await settle()

    expect(fresh).not.toBe(sdk)
    expect(PersonaClick.getInstance(SHOP)).toBe(fresh)
    expect(mockNative.initializeShop).toHaveBeenCalledTimes(2)
    expect(mockNative.releaseShop.mock.invocationCallOrder[0]).toBeLessThan(mockNative.initializeShop.mock.invocationCallOrder[1])
    // Release keeps the customer: the fresh instance has the same device id.
    expect(fresh.deviceId).toBe('native-did')
    await fresh.products.getInfo('37')
    expect(mockNative.productsGetInfo).toHaveBeenCalledWith(SHOP, '37')
    await expect(sdk.products.getInfo('37')).rejects.toMatchObject({ type: 'notInitialized' })
  })

  test('released before the native instance was asked for: none is made', async () => {
    const sdk = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    sdk.release()
    await settle()

    expect(mockNative.initializeShop).not.toHaveBeenCalled()
    expect(mockNative.onStateChanged).not.toHaveBeenCalled()
  })

  test('released while the native instance started: the calls that waited for it reject', async () => {
    let start
    mockNative.initializeShop.mockImplementationOnce(() => new Promise((resolve) => {
      start = resolve
    }))
    const sdk = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    await settle()
    const info = sdk.products.getInfo('37')

    sdk.release()
    start({ ...snapshot })

    await expect(info).rejects.toMatchObject({ type: 'notInitialized' })
    expect(mockNative.productsGetInfo).not.toHaveBeenCalled()
    expect(mockNative.releaseShop).toHaveBeenCalledWith(SHOP)
  })

  test('releasing twice does nothing more', async () => {
    const sdk = await readyShop()
    sdk.release()
    sdk.release()

    expect(mockNative.releaseShop).toHaveBeenCalledTimes(1)
  })

  test('an instance a later construction of the shop replaced leaves the native instance to the later one', async () => {
    const earlier = await readyShop()
    // The deprecated constructor replaces the shop's instance; PersonaClick.initialize keeps the live one.
    const later = new PersonaClick(SHOP, 'android', false, false)
    await settle()

    earlier.release()

    expect(mockNative.releaseShop).not.toHaveBeenCalled()
    expect(PersonaClick.getInstance(SHOP)).toBe(later)
    await later.products.getInfo('37')
    expect(mockNative.productsGetInfo).toHaveBeenCalledWith(SHOP, '37')
  })

  test('another shop keeps its instance', async () => {
    const sdk = await readyShop()
    const other = PersonaClick.initialize({ shopId: OTHER, stream: 'android', autoSendPushToken: false })
    await settle()

    sdk.release()

    expect(PersonaClick.getInstance(OTHER)).toBe(other)
    expect(mockNative.releaseShop).toHaveBeenCalledTimes(1)
    expect(mockNative.releaseShop).toHaveBeenCalledWith(SHOP)
  })

  test('the popups v3 the host turned on stop', async () => {
    const sdk = await readyShop()
    sdk._popupsV3 = { enabled: true }

    sdk.release()

    expect(sdk._popupsV3.enabled).toBe(false)
  })
})

describe('the order the app calls in', () => {
  test('tracking, flush and deleteUserCredentials reach the native module in the order the app called them', async () => {
    const sdk = await readyShop()
    const order = []
    const note = (name) => (...args) => {
      order.push(name)
      return Promise.resolve(undefined)
    }
    mockNative.trackingProductView.mockImplementation(note('view p1'))
    mockNative.trackingCategoryView.mockImplementation(note('category c1'))
    mockNative.flush.mockImplementation(note('flush'))
    mockNative.deleteUserCredentials.mockImplementation(note('deleteUserCredentials'))
    mockNative.trackingRemoveFromCart.mockImplementation(note('remove p1'))

    const calls = [
      sdk.tracking.productView('p1'),
      sdk.flush(),
      sdk.tracking.categoryView('c1'),
      sdk.deleteUserCredentials(),
      sdk.tracking.removeFromCart('p1'),
    ]
    await Promise.all(calls)

    expect(order).toEqual(['view p1', 'flush', 'category c1', 'deleteUserCredentials', 'remove p1'])
  })

  test('a call made after deleteUserCredentials waits until the wipe is over: its event is the next customer\'s, on both platforms', async () => {
    const sdk = await readyShop()
    let finishWipe
    mockNative.deleteUserCredentials.mockImplementationOnce(() => new Promise((resolve) => {
      finishWipe = resolve
    }))

    const wipe = sdk.deleteUserCredentials()
    const after = sdk.tracking.categoryView('c2')
    await settle()

    expect(mockNative.deleteUserCredentials).toHaveBeenCalledTimes(1)
    expect(mockNative.trackingCategoryView).not.toHaveBeenCalled()

    finishWipe()
    await wipe
    await after
    expect(mockNative.trackingCategoryView).toHaveBeenCalledWith(SHOP, 'c2')
  })

  test('a failed wipe holds back nothing after it', async () => {
    const sdk = await readyShop()
    mockNative.deleteUserCredentials.mockRejectedValueOnce(new SdkError('network', 'boom'))

    const wipe = sdk.deleteUserCredentials()
    const after = sdk.tracking.categoryView('c3')

    await expect(wipe).rejects.toMatchObject({ type: 'network' })
    await after
    expect(mockNative.trackingCategoryView).toHaveBeenCalledWith(SHOP, 'c3')
  })

  test('the earlier track, whose fields are built first, keeps its place among the tracking calls and the source', async () => {
    const sdk = await readyShop()
    const order = []
    const note = (name) => (...args) => {
      order.push(`${name} ${args[1]}${typeof args[2] === 'string' ? ` ${args[2]}` : ''}`)
      return Promise.resolve(undefined)
    }
    mockNative.trackingProductView.mockImplementation(note('view'))
    mockNative.trackingCategoryView.mockImplementation(note('category'))
    mockNative.setSource.mockImplementation(note('source'))
    mockNative.queueEvent.mockImplementation(note('queue'))

    sdk.track('view', { id: 'p1' })
    sdk.tracking.categoryView('c1')
    sdk.trackSource('dynamic', 'block-1')
    sdk.track('recone_view', { id: 'c7', inventory: 'i1', position: 2 })
    sdk.tracking.productView('p2')
    await settle()

    expect(order).toEqual(['view p1', 'category c1', 'source dynamic block-1', 'queue push', 'view p2'])
  })

  test('a call whose fields could not be built holds back none after it', async () => {
    const sdk = await readyShop()
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const warnings = jest.spyOn(console, 'warn').mockImplementation(() => {})

    sdk.track('purchase', null)
    await sdk.tracking.categoryView('c1')

    expect(mockNative.trackingCategoryView).toHaveBeenCalledWith(SHOP, 'c1')
    errors.mockRestore()
    warnings.mockRestore()
  })
})

describe('deleteUserCredentials', () => {
  async function storeCustomer() {
    await AsyncStorage.multiSet([
      [`${STORE}timeStartSave`, String(Math.floor(Date.now() / 1000))],
      [`${STORE}recomendedCode`, 'block-7'],
      [`${STORE}recomendedType`, 'dynamic'],
      [`${STORE}push_token_last_sent_date`, new Date().toISOString()],
      [`${STORE}push_token`, 'device-token'],
      [RECENT, JSON.stringify(['boots'])],
    ])
  }

  test('the native SDK forgets the customer, and so does this JavaScript: its copy, the stored identity and the customer keys', async () => {
    const sdk = await readyShop()
    await storeCustomer()
    expect((await stored()).did).toBe('native-did')

    await sdk.deleteUserCredentials()

    expect(mockNative.deleteUserCredentials).toHaveBeenCalledWith(SHOP)
    expect(sdk.deviceId).toBeNull()
    expect(sdk.userSeance).toBe('')
    expect(sdk.isInit()).toBe(false)
    expect(await AsyncStorage.getItem(STORE)).toBeNull()
    expect(await AsyncStorage.getItem(`${STORE}recomendedCode`)).toBeNull()
    expect(await AsyncStorage.getItem(`${STORE}timeStartSave`)).toBeNull()
    expect(await AsyncStorage.getItem(`${STORE}push_token_last_sent_date`)).toBeNull()
    expect(await AsyncStorage.getItem(RECENT)).toBeNull()
    // The device's: the push token and the A/B group stay.
    expect(await AsyncStorage.getItem(`${STORE}push_token`)).toBe('device-token')
    expect(await AsyncStorage.getItem(`${STORE}segment`)).toBe('B')
    expect(sdk.segments.getAbGroup()).toBe('B')
  })

  test('the next device id the native /init brings is the instance\'s, and it is stored', async () => {
    const sdk = await readyShop()
    await sdk.deleteUserCredentials()

    nativeChanges({ state: 'ready', deviceId: 'next-did', sessionId: 'next-sid' })
    await settle()

    expect(sdk.deviceId).toBe('next-did')
    expect(sdk.userSeance).toBe('next-sid')
    expect(sdk.isInit()).toBe(true)
    await expect(sdk.getDeviceId()).resolves.toBe('next-did')
    expect((await stored()).did).toBe('next-did')
  })

  test('a snapshot taken before the native wipe does not bring the forgotten device id back', async () => {
    const sdk = await readyShop()
    mockNative.deleteUserCredentials.mockImplementationOnce(async () => {
      // A session change told before the wipe, heard while it runs.
      nativeChanges({ sessionId: 'late-sid' })
      snapshot = { ...snapshot, state: 'initializing', deviceId: null, sessionId: null }
    })

    await sdk.deleteUserCredentials()
    await settle()

    expect(sdk.deviceId).toBeNull()
    expect(sdk.userSeance).toBe('')
    expect(await AsyncStorage.getItem(STORE)).toBeNull()

    nativeChanges({ state: 'ready', deviceId: 'next-did', sessionId: 'next-sid' })
    await settle()
    expect(sdk.deviceId).toBe('next-did')
  })

  test('a device id the native /init brought before the call ended stays stored', async () => {
    const sdk = await readyShop()
    mockNative.deleteUserCredentials.mockImplementationOnce(async () => {
      nativeChanges({ state: 'ready', deviceId: 'next-did', sessionId: 'next-sid' })
      await settle()
    })

    await sdk.deleteUserCredentials()

    expect(sdk.deviceId).toBe('next-did')
    expect((await stored()).did).toBe('next-did')
  })

  test('the calls through this JavaScript wait for the next device id and carry it', async () => {
    const sdk = await readyShop()
    await sdk.deleteUserCredentials()

    const stories = sdk.getStories('block-1')
    await settle()
    expect(sentPaths()).toEqual([])

    nativeChanges({ state: 'ready', deviceId: 'next-did', sessionId: 'next-sid' })
    await stories
    expect(sent('stories/block-1')[0].params).toMatchObject({ did: 'next-did', sid: 'next-sid' })
  })

  test('the push token the SDK registered goes to the next customer: the native SDK sends it once its device id is there', async () => {
    const sdk = await readyShop()
    await sdk.notifications.setPushToken('fcm-token', 'fcm')
    mockNative.notificationsSetPushToken.mockClear()

    await sdk.deleteUserCredentials()
    await settle()

    expect(mockNative.notificationsSetPushToken).toHaveBeenCalledWith(SHOP, 'fcm-token', 'fcm')
    expect(mockNative.deleteUserCredentials.mock.invocationCallOrder[0])
      .toBeLessThan(mockNative.notificationsSetPushToken.mock.invocationCallOrder[0])
    expect(sentPaths()).toEqual([])
  })

  test('a push token stored by an earlier start goes too; without one nothing goes', async () => {
    await AsyncStorage.setItem(`${STORE}push_token`, 'stored-token')
    const sdk = await readyShop()
    await sdk.deleteUserCredentials()
    await settle()
    expect(mockNative.notificationsSetPushToken).toHaveBeenCalledWith(SHOP, 'stored-token', expect.stringMatching(/^(apns|fcm)$/))

    await AsyncStorage.removeItem(`${STORE}push_token`)
    sdk._tokenCache = null
    mockNative.notificationsSetPushToken.mockClear()
    await sdk.deleteUserCredentials()
    await settle()
    expect(mockNative.notificationsSetPushToken).not.toHaveBeenCalled()
  })

  test('the next start hands the native SDK no device id, the identity of the store before partitions neither', async () => {
    // An identity from before partitions no shop adopted: this shop had its own device id.
    await AsyncStorage.setItem('@PersonaClick', JSON.stringify({ did: 'legacy-did', seance: 'legacy-sid' }))
    await AsyncStorage.setItem(STORE, JSON.stringify({ did: 'native-did' }))
    const sdk = await readyShop()
    expect(mockNative.initializeShop.mock.calls[0][0].deviceId).toBe('native-did')
    await sdk.deleteUserCredentials()

    // The next launch.
    registry.reset()
    PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    await settle()

    // Neither its own forgotten device id nor the one from before partitions.
    expect(mockNative.initializeShop).toHaveBeenLastCalledWith(expect.objectContaining({ shopId: SHOP, deviceId: null }))
  })

  test('the widgets\' answers kept in memory go', async () => {
    const sdk = await readyShop()
    await requestCache.load('root-shop|recommend|x', async () => ({ recommends: ['p1'] }))
    expect(requestCache.peek('root-shop|recommend|x')).toBeDefined()

    await sdk.deleteUserCredentials()

    expect(requestCache.peek('root-shop|recommend|x')).toBeUndefined()
  })

  test('another shop keeps its customer', async () => {
    const sdk = await readyShop()
    await AsyncStorage.setItem(`@PersonaClick_${OTHER}_`, JSON.stringify({ did: 'other-did' }))
    await AsyncStorage.setItem(`personalization.ui.recentSearches.${OTHER}`, JSON.stringify(['hat']))

    await sdk.deleteUserCredentials()

    expect(JSON.parse(await AsyncStorage.getItem(`@PersonaClick_${OTHER}_`)).did).toBe('other-did')
    expect(await AsyncStorage.getItem(`personalization.ui.recentSearches.${OTHER}`)).not.toBeNull()
  })

  test('an instance a later construction replaced forgets with the later one, which takes the next device id', async () => {
    const earlier = await readyShop()
    const later = new PersonaClick(SHOP, 'android', false, false)
    await settle()
    expect(later.deviceId).toBe('native-did')

    await earlier.deleteUserCredentials()
    expect(later.deviceId).toBeNull()
    expect(earlier.deviceId).toBeNull()

    nativeChanges({ state: 'ready', deviceId: 'next-did', sessionId: 'next-sid' })
    await settle()
    expect(later.deviceId).toBe('next-did')
    expect(later.isInit()).toBe(true)
  })

  test('the native refusal reaches the caller as an SdkError', async () => {
    const sdk = await readyShop()
    mockNative.deleteUserCredentials.mockRejectedValueOnce(new SdkError('notInitialized', 'released'))

    await expect(sdk.deleteUserCredentials()).rejects.toMatchObject({ name: 'SdkError', type: 'notInitialized' })
  })

  test('a native wipe that failed keeps the customer: the calls made meanwhile and after it go with the device id they had', async () => {
    const sdk = await readyShop()
    let fail
    mockNative.deleteUserCredentials.mockImplementationOnce(() => new Promise((resolve, reject) => {
      fail = () => reject(new SdkError('cancelled', 'the wipe did not run'))
    }))

    const wipe = sdk.deleteUserCredentials()
    await settle()
    // Called while the wipe runs: it waits for the next customer's device id.
    const during = sdk.getStories('block-1')
    await settle()
    expect(sentPaths()).toEqual([])

    fail()
    await expect(wipe).rejects.toMatchObject({ type: 'cancelled' })
    await during
    const after = sdk.getStories('block-2')
    await after

    expect(sdk.deviceId).toBe('native-did')
    expect(sdk.userSeance).toBe('native-sid')
    expect(sdk.isInit()).toBe(true)
    expect(sent('stories/block-1')[0].params).toMatchObject({ did: 'native-did', sid: 'native-sid' })
    expect(sent('stories/block-2')[0].params).toMatchObject({ did: 'native-did', sid: 'native-sid' })
    expect((await stored()).did).toBe('native-did')
  })

  test('a device id the native SDK told while the failed wipe ran stays', async () => {
    const sdk = await readyShop()
    mockNative.deleteUserCredentials.mockImplementationOnce(async () => {
      nativeChanges({ state: 'ready', deviceId: 'other-did', sessionId: 'other-sid' })
      await settle()
      throw new SdkError('network', 'boom')
    })

    await expect(sdk.deleteUserCredentials()).rejects.toMatchObject({ type: 'network' })

    expect(sdk.deviceId).toBe('other-did')
    expect(sdk.userSeance).toBe('other-sid')
    expect(sdk.isInit()).toBe(true)
  })

  test('an instance whose native start failed rejects with notInitialized and forgets nothing', async () => {
    await AsyncStorage.setItem(STORE, JSON.stringify({ did: 'kept-did' }))
    mockNative.initializeShop.mockRejectedValueOnce(new SdkError('invalidArgument', 'bad config'))
    const sdk = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    await settle()

    await expect(sdk.deleteUserCredentials()).rejects.toMatchObject({ type: 'notInitialized' })
    expect(mockNative.deleteUserCredentials).not.toHaveBeenCalled()
    expect((await stored()).did).toBe('kept-did')
  })
})
