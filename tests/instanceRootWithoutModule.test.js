import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// flush, release and deleteUserCredentials without the SDK's native module (Expo Go, an app not rebuilt
// after installing the SDK): this JavaScript sends each event at once, so flush has nothing to send;
// release stops this JavaScript's instance; deleteUserCredentials forgets what this JavaScript keeps in
// AsyncStorage and sends /init again for a new device id. Only axios is faked.

jest.mock('axios', () => jest.fn())

// eslint-disable-next-line import/first
import PersonaClick, { UnknownShopIdError } from '../index.js'
// eslint-disable-next-line import/first
import { nativeBridge } from '../lib/native/bridge'
// eslint-disable-next-line import/first
import registry from '../lib/registry/SdkRegistry'

const SHOP = 'no-module-root-shop'
const STORE = `@PersonaClick_${SHOP}_`
const RECENT = `personalization.ui.recentSearches.${SHOP}`

let dids
let pendingInit

/** /init hands out the next device id of `dids`; `hold` keeps the next answer until `release`. */
function answer(config) {
  if (config.url.endsWith('/init')) {
    const did = dids.shift()
    const reply = { data: { did, seance: `${did}-sid` } }
    if (pendingInit) {
      const hold = pendingInit
      pendingInit = null
      return new Promise((resolve) => {
        hold.release = () => resolve(reply)
      })
    }
    return Promise.resolve(reply)
  }
  return Promise.resolve({ data: { status: 'success' } })
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
  return sdk
}

beforeEach(async () => {
  await AsyncStorage.clearAll()
  dids = ['first-did', 'second-did', 'third-did']
  pendingInit = null
  axios.mockReset()
  axios.mockImplementation(answer)
  PersonaClick.reset()
  registry.reset()
})

test('there is no native module in this environment', () => {
  expect(nativeBridge).toBeNull()
})

test('flush resolves at once: each event was sent as it came', async () => {
  const sdk = await readyShop()
  axios.mockClear()

  await expect(sdk.flush()).resolves.toBeUndefined()
  expect(sentPaths()).toEqual([])
})

describe('release', () => {
  test('the instance leaves the registry and every later call rejects with notInitialized, sending nothing', async () => {
    const sdk = await readyShop()
    axios.mockClear()

    sdk.release()

    expect(PersonaClick.isInitialized(SHOP)).toBe(false)
    expect(() => PersonaClick.getInstance(SHOP)).toThrow(UnknownShopIdError)
    await expect(sdk.flush()).rejects.toMatchObject({ name: 'SdkError', type: 'notInitialized' })
    await expect(sdk.deleteUserCredentials()).rejects.toMatchObject({ type: 'notInitialized' })
    await expect(sdk.tracking.productView('37')).rejects.toMatchObject({ type: 'notInitialized' })
    await expect(sdk.notifications.trackDelivered('m1', 'bulk')).rejects.toMatchObject({ type: 'notInitialized' })
    await expect(sdk.recommend('block')).resolves.toMatchObject({ type: 'notInitialized' })
    await expect(sdk.getDeviceId()).rejects.toMatchObject({ type: 'notInitialized' })
    expect(sentPaths()).toEqual([])
  })

  test('an /init on its way is dropped, and the calls waiting for it settle at once', async () => {
    pendingInit = {}
    const hold = pendingInit
    const sdk = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    await settle()
    const stories = sdk.getStories('block-1')

    sdk.release()
    await expect(stories).resolves.toMatchObject({ type: 'notInitialized' })

    hold.release()
    await settle()
    expect(sdk.deviceId).toBeNull()
    expect(sdk.isInit()).toBe(false)
    expect(sentPaths()).toEqual(['init'])
  })

  test('a new initialize of the shop makes a fresh instance with the same customer', async () => {
    const sdk = await readyShop()
    sdk.release()

    const fresh = await readyShop()

    expect(fresh).not.toBe(sdk)
    expect(fresh.isInit()).toBe(true)
    // Release keeps the customer: the next /init goes with the stored device id.
    expect(sent('init')[1].params).toMatchObject({ did: 'first-did' })
  })
})

describe('deleteUserCredentials', () => {
  test('forgets what this JavaScript keeps and asks /init for a new device id', async () => {
    const sdk = await readyShop()
    expect(sdk.deviceId).toBe('first-did')
    sdk.tracking.setSource({ type: 'dynamic', code: 'block-7' })
    await AsyncStorage.multiSet([
      [`${STORE}push_token_last_sent_date`, new Date().toISOString()],
      [RECENT, JSON.stringify(['boots'])],
    ])
    await settle()

    await sdk.deleteUserCredentials()

    expect(await AsyncStorage.getItem(`${STORE}recomendedCode`)).toBeNull()
    expect(await AsyncStorage.getItem(`${STORE}push_token_last_sent_date`)).toBeNull()
    expect(await AsyncStorage.getItem(RECENT)).toBeNull()
    expect(await AsyncStorage.getItem(`${STORE}segment`)).not.toBeNull()

    await settle()
    const inits = sent('init')
    expect(inits).toHaveLength(2)
    expect(inits[1].params.did).toBeUndefined()
    expect(sdk.deviceId).toBe('second-did')
    expect(sdk.isInit()).toBe(true)
    expect((await stored()).did).toBe('second-did')
  })

  test('the calls made meanwhile wait for the new device id', async () => {
    const sdk = await readyShop()
    pendingInit = {}
    const hold = pendingInit

    await sdk.deleteUserCredentials()
    const delivered = sdk.notifications.trackDelivered('m1', 'bulk')
    await settle()
    expect(sentPaths()).toEqual(['init', 'init'])

    hold.release()
    await delivered
    expect(sent('track/delivered')[0].data).toMatchObject({ did: 'second-did' })
  })

  test('an /init answer from before the call does not bring the forgotten customer back', async () => {
    pendingInit = {}
    const hold = pendingInit
    const sdk = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    await settle()

    await sdk.deleteUserCredentials()
    await settle()
    expect(sdk.deviceId).toBe('second-did')

    // The first /init answers late, with its device id.
    hold.release()
    await settle()
    expect(sdk.deviceId).toBe('second-did')
    expect((await stored()).did).toBe('second-did')
  })

  test('the push token this JavaScript registered goes to the next customer', async () => {
    const sdk = await readyShop()
    await sdk.notifications.setPushToken('fcm-token', 'fcm')
    axios.mockClear()

    await sdk.deleteUserCredentials()
    await settle()

    expect(sentPaths()).toEqual(['init', 'mobile_push_tokens'])
    expect(sent('mobile_push_tokens')[0].params).toMatchObject({ token: 'fcm-token', did: 'second-did' })
  })
})

describe('state without the native module', () => {
  test('initializing until /init brings the device id, then ready; release makes it notInitialized', async () => {
    const sdk = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    const heard = []
    sdk.onStateChange((state) => heard.push(state))
    await settle()

    expect(sdk.state).toBe('ready')
    expect(sdk.deviceId).toBe('first-did')
    expect(sdk.sessionId).toBe('first-did-sid')
    sdk.release()
    expect(heard).toEqual(['initializing', 'ready', 'notInitialized'])
  })

  test('a refusing shop is refused', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    axios.mockImplementation((config) =>
      config.url.endsWith('/init')
        ? Promise.reject(Object.assign(new Error('Not Found'), { isAxiosError: true, response: { status: 404, data: {} } }))
        : Promise.resolve({ data: {} })
    )
    const sdk = PersonaClick.initialize({ shopId: SHOP, stream: 'android', autoSendPushToken: false })
    await settle()

    expect(sdk.state).toBe('refused')
    errors.mockRestore()
  })
})
