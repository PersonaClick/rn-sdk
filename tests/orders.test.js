import PersonaClick from '../index.js'

const mockRequest = jest.fn()
jest.mock('../lib/client.js', () => {
  const actual = jest.requireActual('../lib/client.js')
  return {
    ...actual,
    request: (...args) => mockRequest(...args),
  }
})

describe('Orders - getLastOrderProducts', () => {
  let sdk

  const productJson = {
    id: '486',
    name: 'Demo product',
    brand: 'Demo brand',
    image_url: 'https://example.com/486.jpg',
    url: 'https://example.com/486',
    price: 199,
    price_formatted: '199 ₽',
    currency: '₽',
  }

  beforeEach(() => {
    mockRequest.mockImplementation((endpoint) => {
      if (endpoint === 'init') {
        return Promise.resolve({ did: 'jest-did', seance: 'jest-seance', segment: '' })
      }
      return Promise.resolve({})
    })
    sdk = new PersonaClick('357382bf66ac0ce2f1722677c59511', 'android', true)
    jest.spyOn(sdk, 'push').mockImplementation((callback) => {
      callback()
    })
    mockRequest.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('calls orders/last_for_user with shop_id and resolves parsed products', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'orders/last_for_user'
        ? Promise.resolve([productJson])
        : Promise.resolve({})
    )

    const products = await sdk.getLastOrderProducts()

    expect(mockRequest).toHaveBeenCalledWith(
      'orders/last_for_user',
      '357382bf66ac0ce2f1722677c59511',
      expect.objectContaining({
        params: expect.objectContaining({
          shop_id: '357382bf66ac0ce2f1722677c59511',
        }),
      })
    )
    expect(Array.isArray(products)).toBe(true)
    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      id: '486',
      name: 'Demo product',
      imageUrl: 'https://example.com/486.jpg',
      price: 199,
    })
  })

  test('resolves an empty array when the last order has no products', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'orders/last_for_user' ? Promise.resolve([]) : Promise.resolve({})
    )

    const products = await sdk.getLastOrderProducts()

    expect(products).toEqual([])
  })

  test('rejects when the request returns an error', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'orders/last_for_user'
        ? Promise.resolve(new Error('Request failed with status code 403'))
        : Promise.resolve({})
    )

    await expect(sdk.getLastOrderProducts()).rejects.toThrow(
      'Request failed with status code 403'
    )
  })
})

describe('Orders - getUserOrders', () => {
  let sdk

  // Mirrors the real `orders/by_user` envelope.
  const byUserResponse = {
    status: 'success',
    data: {
      orders: [
        {
          _id: 212253,
          id: 'order-abc',
          date: '2026-06-16T09:17:59.000Z',
          value: '8500.0',
          internal_status: 'new',
          stream: 'default',
          tax_free: false,
          items: [
            {
              amount: 1,
              price: '2500.0',
              status: 'created',
              barcode: '868',
              line_id: null,
              item: { id: '868', name: 'Headset', image_url: 'https://x/868.jpg', price: 14990 },
            },
          ],
        },
      ],
    },
  }

  beforeEach(() => {
    mockRequest.mockImplementation((endpoint) => {
      if (endpoint === 'init') {
        return Promise.resolve({ did: 'jest-did', seance: 'jest-seance', segment: '' })
      }
      return Promise.resolve({})
    })
    sdk = new PersonaClick('357382bf66ac0ce2f1722677c59511', 'android', true)
    jest.spyOn(sdk, 'push').mockImplementation((callback) => {
      callback()
    })
    mockRequest.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('calls orders/by_user with shop_secret and parses data.orders', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'orders/by_user' ? Promise.resolve(byUserResponse) : Promise.resolve({})
    )

    const orders = await sdk.getUserOrders({ shop_secret: 'secret', date_from: '2024-01-01' })

    expect(mockRequest).toHaveBeenCalledWith(
      'orders/by_user',
      '357382bf66ac0ce2f1722677c59511',
      expect.objectContaining({
        params: expect.objectContaining({
          shop_id: '357382bf66ac0ce2f1722677c59511',
          shop_secret: 'secret',
          date_from: '2024-01-01',
        }),
      })
    )
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({
      internalId: 212253,
      id: 'order-abc',
      value: '8500.0',
      internalStatus: 'new',
      taxFree: false,
    })
    expect(orders[0].items[0]).toMatchObject({ amount: 1, price: '2500.0', barcode: '868' })
    expect(orders[0].items[0].item).toMatchObject({ id: '868', name: 'Headset' })
  })

  test('resolves an empty array when there are no orders', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'orders/by_user'
        ? Promise.resolve({ status: 'success', data: { orders: [] } })
        : Promise.resolve({})
    )

    const orders = await sdk.getUserOrders({ shop_secret: 'secret' })
    expect(orders).toEqual([])
  })

  test('rejects when the request returns an error', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'orders/by_user'
        ? Promise.resolve(new Error('Request failed with status code 403'))
        : Promise.resolve({})
    )

    await expect(sdk.getUserOrders({ shop_secret: 'secret' })).rejects.toThrow(
      'Request failed with status code 403'
    )
  })
})
