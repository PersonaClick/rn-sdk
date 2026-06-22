// Real-network integration test: exercises the actual SDK code (MainSDK.loyaltyJoin /
// getLoyaltyStatus -> lib/client.request -> axios) against the live PersonaClick API.
// Unlike loyalty.test.js, the network layer is NOT mocked.
//
// Gated behind RUN_NETWORK_TESTS so the default unit run stays offline/deterministic.
import PersonaClick from '../index.js'

const SHOP_ID = process.env.TEST_SHOP_ID || 'c1140c8254976de297c3caf971701a'
const RUN = process.env.RUN_NETWORK_TESTS === '1'

const maybe = RUN ? describe : describe.skip

maybe('Loyalty (live API integration)', () => {
  let sdk

  beforeAll(() => {
    sdk = new PersonaClick(SHOP_ID, 'android', true)
  })

  test('getLoyaltyStatus returns a parsed envelope from the live API', async () => {
    const status = await sdk.getLoyaltyStatus('79991234567')
    console.log('[integration] getLoyaltyStatus →', JSON.stringify(status))
    expect(status).toHaveProperty('status')
    // The live API responds { status, payload: { member, level } }; `member` is a boolean.
    expect(typeof status.member === 'boolean' || status.member === null).toBe(true)
  }, 30000)

  test('loyaltyJoin returns a parsed envelope from the live API', async () => {
    const res = await sdk.loyaltyJoin({
      phone: '79991234567',
      email: 'demo@personaClick.ru',
      first_name: 'Demo',
      last_name: 'User',
    })
    console.log('[integration] loyaltyJoin →', JSON.stringify(res))
    expect(res).toHaveProperty('status')
    expect(res.status).toBe('success')
  }, 30000)
})
