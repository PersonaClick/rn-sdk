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

describe('Loyalty - loyaltyJoin', () => {
  let sdk

  beforeEach(() => {
    sdk = createSdk()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('POSTs loyalty/members/join with shop_id and member fields, parses envelope', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'loyalty/members/join'
        ? Promise.resolve({ status: 'success', payload: { member_id: 42 } })
        : Promise.resolve({})
    )

    const res = await sdk.loyaltyJoin({
      phone: '79991234567',
      email: 'en@personaClick.ru',
      first_name: 'Ivan',
      last_name: 'Petrov',
    })

    expect(mockRequest).toHaveBeenCalledWith(
      'loyalty/members/join',
      SHOP_ID,
      expect.objectContaining({
        method: 'POST',
        params: expect.objectContaining({
          shop_id: SHOP_ID,
          phone: '79991234567',
          email: 'en@personaClick.ru',
          first_name: 'Ivan',
          last_name: 'Petrov',
        }),
      })
    )
    expect(res).toEqual({ status: 'success', payload: { member_id: 42 } })
  })

  test('rejects when the request returns an error', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'loyalty/members/join'
        ? Promise.resolve(new Error('Request failed with status code 422'))
        : Promise.resolve({})
    )

    await expect(sdk.loyaltyJoin({ phone: '79991234567' })).rejects.toThrow(
      'Request failed with status code 422'
    )
  })
})

describe('Loyalty - getLoyaltyStatus', () => {
  let sdk

  beforeEach(() => {
    sdk = createSdk()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('GETs loyalty/members/status with shop_id and identifier, parses payload', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'loyalty/members/status'
        ? Promise.resolve({
            status: 'success',
            payload: {
              member: true,
              level: { name: 'Gold', code: 'gold', expiration_date: null },
            },
          })
        : Promise.resolve({})
    )

    const status = await sdk.getLoyaltyStatus('79991234567')

    expect(mockRequest).toHaveBeenCalledWith(
      'loyalty/members/status',
      SHOP_ID,
      expect.objectContaining({
        params: expect.objectContaining({
          shop_id: SHOP_ID,
          identifier: '79991234567',
        }),
      })
    )
    expect(status).toEqual({
      status: 'success',
      member: true,
      level: { name: 'Gold', code: 'gold', expirationDate: null },
    })
  })

  test('returns null level when the payload has no level', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'loyalty/members/status'
        ? Promise.resolve({ status: 'success', payload: { member: false } })
        : Promise.resolve({})
    )

    const status = await sdk.getLoyaltyStatus('79991234567')
    expect(status).toEqual({ status: 'success', member: false, level: null })
  })

  test('rejects when the request returns an error', async () => {
    mockRequest.mockImplementation((endpoint) =>
      endpoint === 'loyalty/members/status'
        ? Promise.resolve(new Error('Request failed with status code 404'))
        : Promise.resolve({})
    )

    await expect(sdk.getLoyaltyStatus('79991234567')).rejects.toThrow(
      'Request failed with status code 404'
    )
  })
})
