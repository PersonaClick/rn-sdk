import PersonaClick from '../index.js'

const mockRequest = jest.fn()
jest.mock('../lib/client.js', () => {
  const actual = jest.requireActual('../lib/client.js')
  return {
    ...actual,
    request: (...args) => mockRequest(...args),
  }
})

const SHOP_ID = '357382bf66ac0ce2f1722677c59511'

function createSdk() {
  mockRequest.mockImplementation((endpoint) => {
    if (endpoint === 'init') {
      return Promise.resolve({ did: 'jest-did', seance: 'jest-seance', segment: '' })
    }
    return Promise.resolve({})
  })
  const sdk = new PersonaClick(SHOP_ID, 'android', true)
  jest.spyOn(sdk, 'push').mockImplementation((callback) => {
    callback()
  })
  mockRequest.mockClear()
  return sdk
}

describe('Catalog - getProfile', () => {
  let sdk
  beforeEach(() => { sdk = createSdk() })
  afterEach(() => { jest.clearAllMocks() })

  test('GETs profile with shop_id and parses common fields', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'profile'
        ? Promise.resolve({
            id: '8001909',
            has_email: false,
            bought_something: false,
            custom_properties: { vip: '1' },
          })
        : Promise.resolve({})
    )

    const profile = await sdk.getProfile()

    expect(mockRequest).toHaveBeenCalledWith(
      'profile',
      SHOP_ID,
      expect.objectContaining({
        params: expect.objectContaining({ shop_id: SHOP_ID }),
      })
    )
    expect(profile.id).toBe('8001909')
    expect(profile.hasEmail).toBe(false)
    expect(profile.boughtSomething).toBe(false)
    expect(profile.customProperties).toEqual({ vip: '1' })
  })

  test('rejects when the request returns an error', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'profile'
        ? Promise.resolve(new Error('Request failed with status code 400'))
        : Promise.resolve({})
    )
    await expect(sdk.getProfile()).rejects.toThrow('Request failed with status code 400')
  })
})

describe('Catalog - getProductCounters', () => {
  let sdk
  beforeEach(() => { sdk = createSdk() })
  afterEach(() => { jest.clearAllMocks() })

  test('GETs products/counters with item and parses counters', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'products/counters'
        ? Promise.resolve({
            daily: { view: 3, cart: 1, purchase: 0 },
            now: { view: 5, cart: 0, purchase: 0 },
            triggers: { back_in_stock: 0, price_drop: 10 },
          })
        : Promise.resolve({})
    )

    const counters = await sdk.getProductCounters('300275')

    expect(mockRequest).toHaveBeenCalledWith(
      'products/counters',
      SHOP_ID,
      expect.objectContaining({
        params: expect.objectContaining({ shop_id: SHOP_ID, item: '300275' }),
      })
    )
    expect(counters.daily).toEqual({ view: 3, cart: 1, purchase: 0 })
    expect(counters.now.view).toBe(5)
    expect(counters.triggers).toEqual({ backInStock: 0, priceDrop: 10 })
  })
})

describe('Catalog - getCategory', () => {
  let sdk
  beforeEach(() => { sdk = createSdk() })
  afterEach(() => { jest.clearAllMocks() })

  test('GETs category/{slug} with params and parses products', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'category/smartfony-i-gadzhety'
        ? Promise.resolve({
            products_total: 2208,
            products: [{ id: '300275', name: 'Phone' }],
            brands: [{ name: 'Apple', count: 12 }],
          })
        : Promise.resolve({})
    )

    const category = await sdk.getCategory('smartfony-i-gadzhety', { limit: 5 })

    expect(mockRequest).toHaveBeenCalledWith(
      'category/smartfony-i-gadzhety',
      SHOP_ID,
      expect.objectContaining({
        params: expect.objectContaining({ shop_id: SHOP_ID, limit: 5 }),
      })
    )
    expect(category.productsTotal).toBe(2208)
    expect(category.products).toHaveLength(1)
    expect(category.products[0].id).toBe('300275')
    expect(category.brands[0].name).toBe('Apple')
  })

  test('defaults to empty lists when response is malformed', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'category/x' ? Promise.resolve(null) : Promise.resolve({})
    )
    const category = await sdk.getCategory('x')
    expect(category.productsTotal).toBe(0)
    expect(category.products).toEqual([])
    expect(category.brands).toEqual([])
  })
})

describe('Catalog - getCollection', () => {
  let sdk
  beforeEach(() => { sdk = createSdk() })
  afterEach(() => { jest.clearAllMocks() })

  test('GETs collection/{id} with shop_id and parses products', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'collection/1'
        ? Promise.resolve({
            products: [
              { id: '868', _id: '131887', name: 'Logitech H150', brand: 'Logitech', price: 14990 },
            ],
          })
        : Promise.resolve({})
    )

    const collection = await sdk.getCollection('1')

    expect(mockRequest).toHaveBeenCalledWith(
      'collection/1',
      SHOP_ID,
      expect.objectContaining({
        params: expect.objectContaining({ shop_id: SHOP_ID }),
      })
    )
    expect(collection.products).toHaveLength(1)
    expect(collection.products[0].id).toBe('868')
    expect(collection.raw).toBeDefined()
  })

  test('defaults to empty products when response is malformed', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'collection/x' ? Promise.resolve(null) : Promise.resolve({})
    )
    const collection = await sdk.getCollection('x')
    expect(collection.products).toEqual([])
  })
})
