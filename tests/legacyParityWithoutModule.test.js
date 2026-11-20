import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// Without the native module the released methods are 4.0.26's, requests and results alike (see
// legacyParity.test.js and legacyScenarios.js). Nothing reaches a server.

jest.mock('axios', () => jest.fn())

// eslint-disable-next-line import/first
import PersonaClick from '../index.js'
// eslint-disable-next-line import/first
import { nativeBridge } from '../lib/native/bridge'
// eslint-disable-next-line import/first
import registry from '../lib/registry/SdkRegistry'

const { answer, scenarios, serialize, requestOf } = require('./legacyScenarios')
const recorded = require('./fixtures/legacy-4.0.26.json')

const SHOP = 'parity-shop'

const settle = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(async () => {
  await AsyncStorage.clearAll()
  await AsyncStorage.setItem(`@PersonaClick_${SHOP}_segment`, 'B')
  registry.reset()
})

test('there is no native module in this environment', () => {
  expect(nativeBridge).toBeNull()
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
  })
})
