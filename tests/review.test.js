import PersonaClick from '../index.js'

const mockRequest = jest.fn()
jest.mock('../lib/client.js', () => {
  const actual = jest.requireActual('../lib/client.js')
  return {
    ...actual,
    request: (...args) => mockRequest(...args),
  }
})

describe('Review', () => {
  let sdk

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

  test('should call review with valid rate and resolve', async () => {
    await sdk.review(5, 'mobile', 'order')

    expect(mockRequest).toHaveBeenCalledWith(
      'nps/create',
      '357382bf66ac0ce2f1722677c59511',
      expect.objectContaining({
        method: 'POST',
        params: expect.objectContaining({
          rate: 5,
          channel: 'mobile',
          category: 'order',
          order_id: '',
          comment: '',
        }),
      })
    )
  })

  test('should call review with optional orderId and comment', async () => {
    await sdk.review(8, 'mobile', 'order', 'order_123', 'Great experience')

    expect(mockRequest).toHaveBeenCalledWith(
      'nps/create',
      '357382bf66ac0ce2f1722677c59511',
      expect.objectContaining({
        method: 'POST',
        params: expect.objectContaining({
          rate: 8,
          channel: 'mobile',
          category: 'order',
          order_id: 'order_123',
          comment: 'Great experience',
        }),
      })
    )
  })

  test('should reject when rate is less than 1', async () => {
    await expect(sdk.review(0, 'mobile', 'order')).rejects.toThrow(
      'Error: rating can be between 1 and 10 only'
    )
    expect(mockRequest.mock.calls.filter((c) => c[0] === 'nps/create')).toHaveLength(0)
  })

  test('should reject when rate is greater than 10', async () => {
    await expect(sdk.review(11, 'mobile', 'order')).rejects.toThrow(
      'Error: rating can be between 1 and 10 only'
    )
    expect(mockRequest.mock.calls.filter((c) => c[0] === 'nps/create')).toHaveLength(0)
  })

  describe('without a channel, the channel of the app\'s platform', () => {
    const { Platform } = require('react-native')
    const platform = Platform.OS
    afterEach(() => {
      Platform.OS = platform
    })

    const channelSent = () => mockRequest.mock.calls.find((c) => c[0] === 'nps/create')[2].params.channel

    test.each([
      ['android', 'android_app'],
      ['ios', 'ios_app'],
    ])('on %s it is %s, whatever the stream', async (os, channel) => {
      Platform.OS = os
      sdk.stream = 'react-native'
      await sdk.review(7, '', 'order')
      expect(channelSent()).toBe(channel)
    })
  })
})
