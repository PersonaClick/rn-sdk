import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// The root of the contract (`sdk/contract/root.md`) on the native SDK: the facade's `instance`,
// `register`, `isInitialized` and its `PersonaClickError`; the instance's `shopId`, `deviceId`, `sessionId`,
// `state` and `onStateChange`; `PersonaClickConfig` handed to the native SDK. The native module and axios are
// fakes: nothing reaches a server.

jest.mock('axios', () => jest.fn())

jest.mock('../lib/native/bridge', () => ({
  nativeBridge: {},
  toSdkError: (e) => e,
  DEFAULT_STREAM: jest.requireActual('../lib/native/bridge').DEFAULT_STREAM,
}))

// eslint-disable-next-line import/first
import { nativeBridge as mockNative } from '../lib/native/bridge'
// eslint-disable-next-line import/first
import PersonaClick, { PersonaClickError, UnknownShopIdError, AmbiguousShopError } from '../index.js'
// eslint-disable-next-line import/first
import registry from '../lib/registry/SdkRegistry'

const SHOP = 'contract-root-shop'
const OTHER = 'contract-other-shop'

let listeners
let logListeners = []
let snapshot

const { NAMESPACE_METHODS } = jest.requireActual('../lib/native/bridge')

function resetNative() {
  listeners = []
  logListeners = []
  snapshot = { shopId: SHOP, state: 'initializing', deviceId: null, sessionId: null, segment: 'B' }
  for (const name of NAMESPACE_METHODS) mockNative[name] = jest.fn(async () => undefined)
  Object.assign(mockNative, {
    initializeShop: jest.fn(async (config) => ({ ...snapshot, shopId: config.shopId })),
    getDeviceId: jest.fn(async () => snapshot.deviceId),
    queueEvent: jest.fn(async () => undefined),
    setSource: jest.fn(async () => undefined),
    releaseShop: jest.fn(),
    registerShops: jest.fn(async () => true),
    setLogHandler: jest.fn(),
    onLog: jest.fn((listener) => {
      logListeners.push(listener)
      return () => {
        logListeners = logListeners.filter((l) => l !== listener)
      }
    }),
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

beforeEach(async () => {
  await AsyncStorage.clearAll()
  axios.mockReset()
  axios.mockImplementation(() => Promise.resolve({ data: { status: 'success' } }))
  PersonaClick.reset()
  registry.reset()
  resetNative()
})

describe('the facade', () => {
  test('instance, register and isInitialized are the contract\'s; getInstance and registerShops stay', async () => {
    PersonaClick.register([{ shopId: SHOP, autoSendPushToken: false }, { shopId: OTHER, autoSendPushToken: false }])

    expect(PersonaClick.isInitialized(SHOP)).toBe(false)
    const sdk = PersonaClick.instance(SHOP)
    expect(PersonaClick.isInitialized(SHOP)).toBe(true)
    expect(PersonaClick.getInstance(SHOP)).toBe(sdk)
    PersonaClick.registerShops([{ shopId: 'third-shop', autoSendPushToken: false }])
    expect(PersonaClick.instance('third-shop').shopId).toBe('third-shop')
  })

  test('a lookup the app gets wrong throws a PersonaClickError: unknownShop, ambiguousShop', () => {
    PersonaClick.register([{ shopId: SHOP }, { shopId: OTHER }])

    const thrown = (call) => {
      try {
        call()
      } catch (error) {
        return error
      }
      return null
    }
    const ambiguous = thrown(() => PersonaClick.instance())
    const unknown = thrown(() => PersonaClick.instance('no-such-shop'))

    expect(ambiguous).toBeInstanceOf(PersonaClickError)
    expect(ambiguous).toBeInstanceOf(AmbiguousShopError)
    expect(ambiguous.type).toBe('ambiguousShop')
    expect(unknown).toBeInstanceOf(PersonaClickError)
    expect(unknown).toBeInstanceOf(UnknownShopIdError)
    expect(unknown.type).toBe('unknownShop')
  })

  test('initialize of a live shop returns it, and the native SDK starts it once', async () => {
    const sdk = PersonaClick.initialize({ shopId: SHOP, autoSendPushToken: false })
    await settle()
    expect(PersonaClick.initialize({ shopId: SHOP, autoSendPushToken: false })).toBe(sdk)
    await settle()

    expect(mockNative.initializeShop).toHaveBeenCalledTimes(1)
  })
})

describe('the instance', () => {
  test('shopId, deviceId and sessionId: the native identity, null while there is none', async () => {
    const sdk = PersonaClick.initialize({ shopId: SHOP, autoSendPushToken: false })
    await settle()

    expect(sdk.shopId).toBe(SHOP)
    expect(sdk.shop_id).toBe(SHOP)
    expect(sdk.deviceId).toBeNull()
    expect(sdk.sessionId).toBeNull()

    nativeChanges({ state: 'ready', deviceId: 'native-did', sessionId: 'native-sid' })
    await settle()

    expect(sdk.deviceId).toBe('native-did')
    expect(sdk.sessionId).toBe('native-sid')
    expect(sdk.userSeance).toBe('native-sid')
  })

  test('state follows the native instance; onStateChange tells it at once and then each change', async () => {
    const sdk = PersonaClick.initialize({ shopId: SHOP, autoSendPushToken: false })
    const heard = []
    const unsubscribe = sdk.onStateChange((state) => heard.push([state, sdk.deviceId]))
    expect(heard).toEqual([['initializing', null]])
    await settle()

    nativeChanges({ state: 'retrying' })
    nativeChanges({ state: 'ready', deviceId: 'native-did', sessionId: 'native-sid' })
    nativeChanges({ sessionId: 'next-sid' })
    await settle()

    // The listener of `ready` reads the device id that came with it.
    expect(heard).toEqual([['initializing', null], ['retrying', null], ['ready', 'native-did']])
    expect(sdk.state).toBe('ready')

    unsubscribe()
    nativeChanges({ state: 'retrying' })
    expect(heard).toHaveLength(3)
    expect(sdk.state).toBe('retrying')
  })

  test('a refused shop is refused; a released instance is notInitialized', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const refused = PersonaClick.initialize({ shopId: SHOP, autoSendPushToken: false })
    const other = PersonaClick.initialize({ shopId: OTHER, autoSendPushToken: false })
    await settle()
    const heard = []
    other.onStateChange((state) => heard.push(state))

    nativeChanges({ state: 'refused' })
    other.release()

    expect(refused.state).toBe('refused')
    expect(other.state).toBe('notInitialized')
    expect(heard).toEqual(['initializing', 'notInitialized'])
    errors.mockRestore()
  })

  test('a listener that throws is logged, and the others still hear', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const sdk = PersonaClick.initialize({ shopId: SHOP, autoSendPushToken: false })
    await settle()
    const heard = []
    sdk.onStateChange(() => {
      throw new Error('boom')
    })
    sdk.onStateChange((state) => heard.push(state))

    nativeChanges({ state: 'ready', deviceId: 'native-did' })

    expect(heard).toEqual(['initializing', 'ready'])
    expect(errors).toHaveBeenCalledWith(expect.stringMatching(/callback_failed/), 'boom')
    errors.mockRestore()
  })
})

describe('PersonaClickConfig on the native SDK', () => {
  test('logLevel, sendAdvertisingId, needReInitialization, storageKey and deviceId go to the native SDK', async () => {
    PersonaClick.initialize({
      shopId: SHOP,
      autoSendPushToken: false,
      logLevel: 'info',
      sendAdvertisingId: true,
      needReInitialization: false,
      storageKey: 'app-store',
      deviceId: 'app-did',
    })
    await settle()

    expect(mockNative.initializeShop).toHaveBeenCalledWith(expect.objectContaining({
      shopId: SHOP,
      logLevel: 'info',
      sendAdvertisingId: true,
      needReInitialization: false,
      storageKey: 'app-store',
      deviceId: 'app-did',
    }))
  })

  test('the device id JavaScript kept wins over the config\'s; needReInitialization sends none', async () => {
    await AsyncStorage.setItem(`@PersonaClick_${SHOP}_`, JSON.stringify({ did: 'kept-did', seance: 's' }))
    PersonaClick.initialize({ shopId: SHOP, autoSendPushToken: false, deviceId: 'app-did' })
    PersonaClick.initialize({ shopId: OTHER, autoSendPushToken: false, deviceId: 'app-did', needReInitialization: true })
    await settle()

    const configs = Object.fromEntries(mockNative.initializeShop.mock.calls.map(([config]) => [config.shopId, config]))
    expect(configs[SHOP].deviceId).toBe('kept-did')
    expect(configs[OTHER].deviceId).toBeNull()
    expect(configs[OTHER].needReInitialization).toBe(true)
  })

  test('debug is logLevel debug; a logLevel that is no LogLevel is not taken', async () => {
    const warnings = jest.spyOn(console, 'warn').mockImplementation(() => {})
    PersonaClick.initialize({ shopId: SHOP, autoSendPushToken: false, debug: true })
    PersonaClick.initialize({ shopId: OTHER, autoSendPushToken: false, logLevel: 'verbose' })
    await settle()

    const configs = Object.fromEntries(mockNative.initializeShop.mock.calls.map(([config]) => [config.shopId, config]))
    expect(configs[SHOP].logLevel).toBe('debug')
    expect(configs[OTHER].logLevel === null || configs[OTHER].logLevel === 'debug').toBe(true)
    expect(warnings).toHaveBeenCalledWith(expect.stringMatching(/invalid_config/))
    warnings.mockRestore()
  })

  test('enableAutoPopupPresentation of the config is the instance\'s', async () => {
    const off = PersonaClick.initialize({ shopId: SHOP, autoSendPushToken: false, enableAutoPopupPresentation: false })
    const on = PersonaClick.initialize({ shopId: OTHER, autoSendPushToken: false })

    expect(off.enableAutoPopupPresentation).toBe(false)
    expect(on.enableAutoPopupPresentation).toBe(true)
  })

  test('a registered shop goes to the native SDK with its storage key and log level', async () => {
    PersonaClick.register([{ shopId: SHOP, storageKey: 'app-store', logLevel: 'error', deviceId: 'app-did' }])
    await settle()

    expect(mockNative.registerShops).toHaveBeenCalledWith([
      expect.objectContaining({ shopId: SHOP, storageKey: 'app-store', logLevel: 'error', deviceId: 'app-did' }),
    ])
  })
})

describe('PersonaClick.setLogHandler', () => {
  afterEach(() => PersonaClick.setLogHandler(null))

  test('the native SDKs\' messages reach the handler as SdkLogMessage; null stops them', () => {
    const messages = []
    PersonaClick.setLogHandler((message) => messages.push(message))

    expect(mockNative.setLogHandler).toHaveBeenLastCalledWith(true)
    logListeners.forEach((listener) => listener({
      level: 'warning', code: 'init_retry', message: '/init will be retried', shopId: SHOP, context: { attempt: 2 },
    }))
    logListeners.forEach((listener) => listener({ level: 'debug', code: 'request', message: 'GET init', shopId: null }))
    expect(messages).toEqual([
      { level: 'warning', code: 'init_retry', message: '/init will be retried', shopId: SHOP, context: { attempt: 2 } },
      { level: 'debug', code: 'request', message: 'GET init', shopId: null, context: {} },
    ])

    PersonaClick.setLogHandler(null)
    expect(mockNative.setLogHandler).toHaveBeenLastCalledWith(false)
    expect(logListeners).toHaveLength(0)
  })

  test('a new handler replaces the one before; one that throws is told to the console only', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const first = jest.fn()
    PersonaClick.setLogHandler(first)
    PersonaClick.setLogHandler(() => {
      throw new Error('boom')
    })

    logListeners.forEach((listener) => listener({ level: 'error', code: 'init_refused', message: 'refused', shopId: SHOP }))

    expect(first).not.toHaveBeenCalled()
    expect(logListeners).toHaveLength(1)
    expect(errors).toHaveBeenCalledWith(expect.stringMatching(/log_handler_failed/), 'boom')
    expect(() => PersonaClick.setLogHandler('nope')).toThrow(TypeError)
    errors.mockRestore()
  })
})

describe('notifications.getPushToken', () => {
  test('the token the native SDK keeps for the shop from an earlier start; one registered now wins', async () => {
    snapshot = { ...snapshot, pushToken: { token: 'stored-fcm', provider: 'fcm' }, pushTokens: { fcm: 'stored-fcm', apns: 'stored-apns' } }
    const sdk = PersonaClick.initialize({ shopId: SHOP, autoSendPushToken: false })
    await settle()

    expect(sdk.notifications.getPushToken()).toEqual({ token: 'stored-fcm', provider: 'fcm' })
    expect(sdk.notifications.getPushToken('apns')).toEqual({ token: 'stored-apns', provider: 'apns' })
    expect(sdk.notifications.getPushToken('hms')).toBeNull()
    // Read with the snapshot: no namespace method of the module is called for it.
    expect(mockNative.notificationsGetPushToken).not.toHaveBeenCalled()

    await sdk.notifications.setPushToken('new-fcm', 'fcm')

    expect(sdk.notifications.getPushToken()).toEqual({ token: 'new-fcm', provider: 'fcm' })
    expect(sdk.notifications.getPushToken('fcm')).toEqual({ token: 'new-fcm', provider: 'fcm' })
    expect(sdk.notifications.getPushToken('apns')).toEqual({ token: 'stored-apns', provider: 'apns' })
  })

  test('a module without the tokens in its snapshot: only the token registered in this run', async () => {
    const sdk = PersonaClick.initialize({ shopId: SHOP, autoSendPushToken: false })
    await settle()

    expect(sdk.notifications.getPushToken()).toBeNull()
  })
})
