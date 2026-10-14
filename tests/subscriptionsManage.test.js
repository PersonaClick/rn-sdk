import PersonaClick from '../index.js'
import axios from 'axios'

// subscriptions('manage', …) hands its flags to /subscriptions/manage as they are, so every channel
// the API knows — Telegram, WhatsApp, Max and Wallet included — is reachable. Only axios is faked.

jest.mock('axios', () => jest.fn())

const manageBody = () => {
  const call = axios.mock.calls.find(([config]) => config.url.endsWith('/subscriptions/manage'))
  return call && call[0].data
}

describe('subscriptions("manage")', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    axios.mockReset()
    axios.mockImplementation((config) =>
      Promise.resolve({ data: config.url.endsWith('/init') ? { did: 'did-1', seance: 's-1' } : { status: 'success' } })
    )
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  test('Telegram, WhatsApp, Max and Wallet flags go under their keys', async () => {
    const flags = {
      telegram_bulk: true,
      telegram_chain: false,
      telegram_transactional: true,
      whatsapp_bulk: false,
      whatsapp_chain: true,
      whatsapp_transactional: false,
      max_bulk: true,
      max_chain: false,
      max_transactional: true,
      wallet_bulk: false,
    }
    const sdk = new PersonaClick('shop-subscriptions', 'android', false, false)

    sdk.subscriptions('manage', { phone: '+79990000000', ...flags })
    for (let i = 0; i < 20; i++) await jest.advanceTimersByTimeAsync(0)

    expect(manageBody()).toEqual(expect.objectContaining({ shop_id: 'shop-subscriptions', phone: '+79990000000', ...flags }))
  })
})
