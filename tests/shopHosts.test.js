import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// apiDomain and appDomain reach the requests this JavaScript sends too, not only the native SDK's: a shop
// on another cluster gets every request there. Without them, the default hosts. Only axios is faked.

jest.mock('axios', () => jest.fn())

// eslint-disable-next-line import/first
import PersonaClick from '../index.js'
// eslint-disable-next-line import/first
import registry from '../lib/registry/SdkRegistry'

const settle = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const urls = () => axios.mock.calls.map(([config]) => config.url)

beforeEach(async () => {
  await AsyncStorage.clearAll()
  registry.reset()
  PersonaClick.reset()
  axios.mockReset()
  axios.mockImplementation((config) =>
    Promise.resolve({ data: config.url.endsWith('/init') ? { did: 'd', seance: 's' } : { status: 'success', payload: { probability: 0.5 } } }))
})

test('a shop with apiDomain and appDomain sends its requests there', async () => {
  const sdk = PersonaClick.initialize({ shopId: 'region-shop', stream: 'android', autoSendPushToken: false, apiDomain: 'https://api.region.example/', appDomain: 'app.region.example' })
  await settle()
  await sdk.recommend('block-1', { item: '37' })
  await sdk.getProbabilityToPurchase({ email: 'jane@example.com' })

  expect(urls()).toEqual([
    'https://api.region.example/init',
    'https://api.region.example/recommend/block-1',
    'https://app.region.example/api/v3/cdp/users/probability-to-purchase',
  ])
})

test('a shop without them uses the default hosts', async () => {
  const sdk = PersonaClick.initialize({ shopId: 'default-shop', stream: 'android', autoSendPushToken: false })
  await settle()
  await sdk.recommend('block-1', { item: '37' })

  expect(urls()).toEqual(['https://api.personaclick.com/init', 'https://api.personaclick.com/recommend/block-1'])
})

test("a registered shop's push sent from JavaScript, before it has an instance, goes to its apiDomain", async () => {
  PersonaClick.register([
    { shopId: 'lazy-region', stream: 'android', apiDomain: 'https://api.region.example/' },
    { shopId: 'lazy-default', stream: 'android' },
  ])

  await expect(PersonaClick.handlePush({ data: { shop_id: 'lazy-region', id: 'c1', type: 'bulk' } }, 'delivered')).resolves.toBe('lazy-region')
  await expect(PersonaClick.handlePush({ data: { shop_id: 'lazy-default', id: 'c2', type: 'bulk' } }, 'delivered')).resolves.toBe('lazy-default')
  await settle()

  expect(urls()).toEqual(['https://api.region.example/track/delivered', 'https://api.personaclick.com/track/delivered'])
  expect(registry.byShopId('lazy-region')).toBeNull()
})

test('registering a shop again does not take the hosts of its live instance', async () => {
  const sdk = PersonaClick.initialize({ shopId: 'live-region', stream: 'android', autoSendPushToken: false, apiDomain: 'api.region.example' })
  await settle()
  PersonaClick.register([{ shopId: 'live-region', stream: 'android' }])
  await sdk.recommend('block-1', { item: '37' })

  expect(urls()).toEqual(['https://api.region.example/init', 'https://api.region.example/recommend/block-1'])
})
