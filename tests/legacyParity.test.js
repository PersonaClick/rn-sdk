import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// The released (deprecated) methods with the native module behave as in 4.0.26: the same requests from
// this JavaScript — only the device id and the session are the native SDK's — and the same results, the
// server's keys outside the models and its errors included. The fixture was recorded from 4.0.26 with the
// same scenarios and the same mocked server (`legacyScenarios.js`). Nothing reaches a server.

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
import registry from '../lib/registry/SdkRegistry'

const { answer, scenarios, serialize, requestOf } = require('./legacyScenarios')
const recorded = require('./fixtures/legacy-4.0.26.json')
const { NAMESPACE_METHODS } = jest.requireActual('../lib/native/bridge')

const SHOP = 'parity-shop'
let listeners

const settle = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function resetNative() {
  listeners = []
  for (const name of NAMESPACE_METHODS) mockNative[name] = jest.fn(async () => { throw new Error(`the native ${name} must not be called`) })
  Object.assign(mockNative, {
    initializeShop: jest.fn(async () => ({ shopId: SHOP, state: 'ready', deviceId: 'native-did', sessionId: 'native-sid', segment: 'B' })),
    getDeviceId: jest.fn(async () => 'native-did'),
    queueEvent: jest.fn(async () => undefined),
    setSource: jest.fn(async () => undefined),
    setAutoPopupPresentation: jest.fn(),
    onStateChanged: jest.fn((listener) => {
      listeners.push(listener)
      return () => {}
    }),
  })
}

beforeEach(async () => {
  await AsyncStorage.clearAll()
  registry.reset()
  resetNative()
})

describe.each(Object.keys(scenarios))('%s', (name) => {
  test('sends what 4.0.26 sent and returns what it returned', async () => {
    const scenario = scenarios[name]
    axios.mockReset()
    axios.mockImplementation((config) => {
      const failure = scenario.fail?.(config)
      if (failure) return Promise.reject(failure)
      return Promise.resolve({ data: answer(config) })
    })
    const sdk = new PersonaClick(SHOP, 'android', false, false)
    await settle()
    expect(sdk.isInit()).toBe(true)
    const before = axios.mock.calls.length
    let result
    try {
      result = { resolved: serialize(await scenario.call(sdk)) }
    } catch (e) {
      result = { rejected: serialize(e) }
    }
    await settle()
    const requests = axios.mock.calls.slice(before).map(([config]) => requestOf(config)).filter((r) => r.url !== '/init')

    expect(requests).toEqual(recorded[name].requests)
    expect(result).toEqual(recorded[name].result)
    // The device id and the session of these requests are the native SDK's.
    axios.mock.calls.slice(before).forEach(([config]) => {
      const fields = { ...(config.params || {}), ...(typeof config.data === 'object' ? config.data : {}) }
      expect(fields.did).toBe('native-did')
    })
    for (const method of NAMESPACE_METHODS) expect(mockNative[method]).not.toHaveBeenCalled()
  })
})
