// Real-network integration test: exercises the actual SDK code (MainSDK.getProfile /
// getProductCounters / getCategory -> lib/client.request -> axios) against the live
// PersonaClick API. Unlike catalog.test.js, the network layer is NOT mocked.
//
// Gated behind RUN_NETWORK_TESTS so the default unit run stays offline/deterministic.
import PersonaClick from '../index.js'

const SHOP_ID = process.env.TEST_SHOP_ID || 'c1140c8254976de297c3caf971701a'
const RUN = process.env.RUN_NETWORK_TESTS === '1'

const CATEGORY_SLUG = 'smartfony-i-gadzhety'
const ITEM_ID = '300275'
const COLLECTION_ID = '1'

const maybe = RUN ? describe : describe.skip

maybe('Catalog read (live API integration)', () => {
  let sdk

  beforeAll(() => {
    sdk = new PersonaClick(SHOP_ID, 'android', true)
  })

  test('getProfile returns a parsed profile from the live API', async () => {
    const profile = await sdk.getProfile()
    console.log('[integration] getProfile →', JSON.stringify(profile.raw))
    expect(profile).toHaveProperty('customProperties')
    expect(profile).toHaveProperty('raw')
  }, 30000)

  test('getProductCounters returns parsed counters from the live API', async () => {
    const counters = await sdk.getProductCounters(ITEM_ID)
    console.log('[integration] getProductCounters →', JSON.stringify(counters))
    expect(counters).toHaveProperty('triggers')
    expect(typeof counters.triggers.priceDrop).toBe('number')
  }, 30000)

  test('getCategory returns products from the live API', async () => {
    const category = await sdk.getCategory(CATEGORY_SLUG, { limit: 5 })
    console.log('[integration] getCategory → total', category.productsTotal, 'products', category.products.length)
    expect(category.productsTotal).toBeGreaterThan(0)
    expect(category.products.length).toBeGreaterThan(0)
  }, 30000)

  test('getCollection returns products from the live API', async () => {
    const collection = await sdk.getCollection(COLLECTION_ID)
    console.log('[integration] getCollection → products', collection.products.length)
    expect(collection.products.length).toBeGreaterThan(0)
  }, 30000)
})
