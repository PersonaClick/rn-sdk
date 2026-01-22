import REES46 from '../index.js'

jest.mock('react-native-device-info', () => {})
jest.mock('@react-native-firebase/messaging', () => {})
jest.mock('@react-native-async-storage/async-storage', () => {})

describe('Search', () => {
  let sdk

  beforeEach(() => {
    sdk = new REES46('357382bf66ac0ce2f1722677c59511', 'android', true)
    jest.spyOn(sdk, 'push').mockImplementation((callback) => {
      callback()
    })

    jest.clearAllMocks()
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
})
