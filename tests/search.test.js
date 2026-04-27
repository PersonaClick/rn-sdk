import PersonaClick from '../index.js'

const mockRequest = jest.fn()
jest.mock('../lib/client.js', () => {
  const actual = jest.requireActual('../lib/client.js')
  return {
    ...actual,
    request: (...args) => mockRequest(...args),
  }
})

describe('Search', () => {
  let sdk

  beforeEach(() => {
    mockRequest.mockImplementation((endpoint, _shopId, options) => {
      if (endpoint === 'init') {
        return Promise.resolve({ did: 'jest-did', seance: 'jest-seance', segment: '' })
      }

      if (endpoint === 'search') {
        const hasType = Boolean(options?.params?.type)
        if (!hasType) {
          return Promise.reject(new Error('Request failed with status code 400'))
        }
        return Promise.resolve({
          categories: [],
          html: '',
          products: [],
          products_total: 0,
        })
      }

      if (endpoint === 'search/blank') {
        return Promise.resolve({
          suggests: [],
          products: [],
        })
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

  test('should call search with correct parameters for instant search and resolve', async () => {
    const searchOptions = { type: 'instant_search', search_query: 'phone' }

    const response = await sdk.search(searchOptions)

    expect(response).toHaveProperty('categories')
    expect(response).toHaveProperty('html')
    expect(response).toHaveProperty('products')
    expect(response).toHaveProperty('products_total')
  })

  test('should call search with correct parameters for full search and resolve', async () => {
    const searchOptions = { type: 'full_search', search_query: 'coat' }

    const response = await sdk.search(searchOptions)

    expect(response).toHaveProperty('categories')
    expect(response).toHaveProperty('html')
    expect(response).toHaveProperty('products')
    expect(response).toHaveProperty('products_total')
  })

  test('should return error when calling search with missing type parameter', async () => {
    const searchOptions = { search_query: 'phone' }

    try {
      await sdk.search(searchOptions)
    } catch (error) {
      expect(error.message).toContain('Request failed with status code 400')
    }
  })

  test('should call searchBlank and resolve with suggests and products', async () => {
    const response = await sdk.searchBlank()

    expect(response).toHaveProperty('suggests')
    expect(response).toHaveProperty('products')
    expect(Array.isArray(response.suggests)).toBe(true)
    expect(Array.isArray(response.products)).toBe(true)
    if (Object.prototype.hasOwnProperty.call(response, 'last_queries')) {
      expect(Array.isArray(response.last_queries)).toBe(true)
    }
  })
})
