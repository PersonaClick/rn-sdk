import PersonaClick, { SDK_API_URL, SDK_APP_HOST } from '../index.js'
import axios from 'axios'

// The purchase prediction lives on the account's host, API v3: the SDK asks it there and reads the
// prediction from `payload`. Only axios is faked, so what reaches the network is what the SDK sends.

jest.mock('axios', () => jest.fn())

const SHOP = 'shop-predict'

function answer(config) {
  if (config.url.endsWith('/init')) return Promise.resolve({ data: { did: 'did-1', seance: 'sid-1' } })
  return Promise.resolve({ data: predictAnswer })
}

let predictAnswer

async function readyShop() {
  const sdk = new PersonaClick(SHOP, 'android', false, false)
  for (let i = 0; i < 30; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  return sdk
}

beforeEach(() => {
  axios.mockReset()
  axios.mockImplementation(answer)
})

test('the prediction goes to API v3 on the account host and is read from payload', async () => {
  predictAnswer = { status: 'success', payload: { probability: 0.42, client_id: '123' } }
  const sdk = await readyShop()

  const result = await sdk.getProbabilityToPurchase({ email: 'a@example.com' })

  expect(result).toEqual({ probability: 0.42, client_id: '123' })
  const [config] = axios.mock.calls.find(([c]) => c.url.includes('probability-to-purchase'))
  expect(config.url).toBe(`https://${SDK_APP_HOST}/api/v3/cdp/users/probability-to-purchase`)
  expect(config.method).toBe('GET')
  expect(config.params).toMatchObject({ shop_id: SHOP, did: 'did-1', email: 'a@example.com' })
})

test('a visitor the shop does not know has no client id', async () => {
  predictAnswer = { status: 'success', payload: { probability: 0, client_id: null } }
  const sdk = await readyShop()

  await expect(sdk.getProbabilityToPurchase()).resolves.toEqual({ probability: 0, client_id: null })
})

test('a shop without the service rejects with the server message', async () => {
  const sdk = await readyShop()
  axios.mockImplementation((config) => {
    if (config.url.endsWith('/init')) return Promise.resolve({ data: { did: 'did-1', seance: 'sid-1' } })
    const error = new Error('Request failed with status code 402')
    error.response = { status: 402, data: { status: 'fail', message: 'Payment required' } }
    return Promise.reject(error)
  })

  await expect(sdk.getProbabilityToPurchase()).rejects.toThrow('Request failed with status code 402')
})

test('an answer without payload rejects', async () => {
  predictAnswer = { probability: 0.3, client_id: '1' }
  const sdk = await readyShop()

  await expect(sdk.getProbabilityToPurchase()).rejects.toThrow('The purchase prediction answer could not be read')
})

test("the account's host by default is the API's with app. for api., built from the API's address", () => {
  // Written so that a build for another domain, which rewrites the API's address whole, still passes.
  expect(`https://${SDK_APP_HOST}/`).toBe(SDK_API_URL.replace('://api.', '://app.'))
  expect(`https://${SDK_APP_HOST}/`).toBe('https://api.personaclick.com/'.replace('://api.', '://app.'))
})
