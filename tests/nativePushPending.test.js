import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// A push of a shop registered at the app's module scope but not started in this process: the native SDK
// takes it where it can (Android: the shop registered there too, its stored did, no /init); where it cannot
// (iOS answers null), JavaScript sends the event itself. Nothing reaches a server.

jest.mock('axios', () => jest.fn())
jest.mock('../lib/native/bridge', () => ({
  nativeBridge: {},
  toSdkError: (e) => e,
  DEFAULT_STREAM: jest.requireActual('../lib/native/bridge').DEFAULT_STREAM,
}))

// eslint-disable-next-line import/first
import { nativeBridge as mockNative } from '../lib/native/bridge'
// eslint-disable-next-line import/first
import PersonaClick, { PushEvent } from '../index.js'
// eslint-disable-next-line import/first
import registry from '../lib/registry/SdkRegistry'

const SHOP = 'lazy-shop'

const settle = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(async () => {
  await AsyncStorage.clearAll()
  registry.reset()
  PersonaClick.reset()
  axios.mockReset()
  axios.mockResolvedValue({ data: { status: 'success' } })
  Object.assign(mockNative, {
    registerShops: jest.fn(async () => true),
    handlePush: jest.fn(async (payload) => payload.shop_id),
  })
})

test('the shops registered without an instance are registered on the native SDK with the did JavaScript kept', async () => {
  await AsyncStorage.setItem(`@PersonaClick_${SHOP}_`, JSON.stringify({ did: 'kept-did' }))

  PersonaClick.registerShops([{ shopId: SHOP, stream: 'android', apiDomain: 'api.example.test' }])
  await settle()

  expect(mockNative.registerShops).toHaveBeenCalledWith([
    { shopId: SHOP, stream: 'android', apiDomain: 'api.example.test', appDomain: null, deviceId: 'kept-did' },
  ])
})

test('a push of such a shop goes to the native SDK with its data and event; JavaScript sends nothing', async () => {
  PersonaClick.registerShops([{ shopId: SHOP, stream: 'android' }])
  await settle()

  PersonaClick.handlePush({ messageId: 'm-1', data: { shop_id: SHOP, id: 'c1', type: 'bulk', title: 'T' } }, PushEvent.DELIVERED)
  await settle()

  expect(mockNative.handlePush).toHaveBeenCalledWith({ shop_id: SHOP, id: 'c1', type: 'bulk', title: 'T' }, 'delivered')
  expect(axios).not.toHaveBeenCalled()
  expect(registry.byShopId(SHOP)).toBeNull()
})

test('where the native SDK does not take it, JavaScript sends the event: the stored did, no session', async () => {
  mockNative.handlePush.mockResolvedValue(null)
  await AsyncStorage.setItem(`@PersonaClick_${SHOP}_`, JSON.stringify({ did: 'kept-did', seance: 'old', expires: Date.now() + 1e6 }))
  PersonaClick.registerShops([{ shopId: SHOP, stream: 'ios' }])
  await settle()

  PersonaClick.handlePush({ data: { shop_id: SHOP, id: 'c2', type: 'chain' } }, PushEvent.CLOSED)
  await settle()

  const [config] = axios.mock.calls[0]
  expect(config.url).toBe('https://api.personaclick.com/track/closed')
  expect(config.data).toMatchObject({ shop_id: SHOP, code: 'c2', type: 'chain', did: 'kept-did' })
  expect(config.data).not.toHaveProperty('sid')
  expect(config.data).not.toHaveProperty('seance')
})

test('a shop whose app names no stream is registered as react-native, and its push sent from JavaScript carries it', async () => {
  mockNative.handlePush.mockResolvedValue(null)
  PersonaClick.registerShops([{ shopId: SHOP }])
  await settle()

  expect(mockNative.registerShops).toHaveBeenCalledWith([
    { shopId: SHOP, stream: 'react-native', apiDomain: null, appDomain: null, deviceId: null },
  ])

  PersonaClick.handlePush({ data: { shop_id: SHOP, id: 'c3', type: 'bulk' } }, PushEvent.DELIVERED)
  await settle()

  expect(axios.mock.calls[0][0].data).toMatchObject({ shop_id: SHOP, code: 'c3', stream: 'react-native' })
})
