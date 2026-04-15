jest.mock('../index.js', () => ({
  SDK_PUSH_CHANNEL: 'PersonaClick',
  SDK_API_URL: 'https://api.personaclick.com/',
}))

jest.mock('../components/Popup/SdkPopupOverlay', () => ({
  prepareAndShow: jest.fn().mockResolvedValue(undefined),
  registerSDK: jest.fn(),
}))

jest.mock('../lib/notification', () => ({
  NotificationManager: {
    showNotification: jest.fn(),
  },
}))

const mockOpenURL = jest.fn().mockResolvedValue(true)
const mockPlatform = { OS: 'android', Version: 34 }

jest.mock('react-native', () => ({
  __esModule: true,
  Linking: {
    openURL: (...args) => mockOpenURL(...args),
  },
  PermissionsAndroid: {
    PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
    RESULTS: { GRANTED: 'granted' },
    request: jest.fn().mockResolvedValue('granted'),
  },
  Platform: mockPlatform,
  default: {
    Linking: {
      openURL: (...args) => mockOpenURL(...args),
    },
    PermissionsAndroid: {
      PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
      RESULTS: { GRANTED: 'granted' },
      request: jest.fn().mockResolvedValue('granted'),
    },
    Platform: mockPlatform,
  },
}))

const mockGetPushData = jest.fn().mockResolvedValue([])
const mockRemovePushMessage = jest.fn().mockResolvedValue(undefined)
const mockRequest = jest.fn().mockResolvedValue({})

jest.mock('../lib/client.js', () => ({
  initLocker: jest.fn().mockResolvedValue(null),
  request: (...args) => mockRequest(...args),
  setInitLocker: jest.fn().mockResolvedValue(undefined),
  updSeance: jest.fn().mockResolvedValue(undefined),
  getPushData: (...args) => mockGetPushData(...args),
  updPushData: jest.fn().mockResolvedValue(undefined),
  removePushMessage: (...args) => mockRemovePushMessage(...args),
  getData: jest.fn().mockResolvedValue(null),
  generateSid: jest.fn(() => 'sid-1'),
  getSavedPushToken: jest.fn().mockResolvedValue(null),
  savePushToken: jest.fn().mockResolvedValue(undefined),
  getLastPushTokenSentDate: jest.fn().mockResolvedValue(null),
  saveLastPushTokenSentDate: jest.fn().mockResolvedValue(undefined),
}))

const MainSDK = require('../MainSDK.js').default

function createSdk() {
  const sdk = new MainSDK('shop-id', 'android', false, false)
  sdk.initialized = true
  sdk.push = jest.fn((command) => command())
  sdk._pushOrchestrator = {
    ensureTrackingSubscriptions: jest.fn().mockResolvedValue(true),
    fetchToken: jest.fn().mockResolvedValue('fcm-token-1'),
    setHasCustomClickListener: jest.fn(),
  }
  return sdk
}

describe('MainSDK onClickPush', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPlatform.OS = 'android'
    mockPlatform.Version = 34
    mockGetPushData.mockReset().mockResolvedValue([])
    mockRemovePushMessage.mockReset().mockResolvedValue(undefined)
    mockRequest.mockReset().mockResolvedValue({})
    mockOpenURL.mockReset().mockResolvedValue(true)
  })

  test('returns false when push data is missing', async () => {
    const sdk = createSdk()

    const result = await sdk.onClickPush({ data: { message_id: 'm-1' } })

    expect(result).toBe(false)
    expect(mockGetPushData).toHaveBeenCalledWith('m-1', 'shop-id')
    expect(mockRemovePushMessage).not.toHaveBeenCalled()
  })

  test('returns false when event is missing but still tracks click', async () => {
    const sdk = createSdk()
    const notificationClickedSpy = jest
      .spyOn(sdk, 'notificationClicked')
      .mockResolvedValue(undefined)
    mockGetPushData.mockResolvedValue([{ data: { event: '' } }])

    const result = await sdk.onClickPush({
      data: { message_id: 'm-2', id: 'n-2', type: 'web_push' },
    })

    expect(result).toBe(false)
    expect(mockRemovePushMessage).toHaveBeenCalledWith('m-2', 'shop-id')
    expect(notificationClickedSpy).toHaveBeenCalledWith({
      code: 'n-2',
      type: 'web_push',
    })
  })

  test('opens web url when event type is web', async () => {
    const sdk = createSdk()
    jest.spyOn(sdk, 'notificationClicked').mockResolvedValue(undefined)
    mockGetPushData.mockResolvedValue([
      { data: { event: JSON.stringify({ type: 'web', uri: 'https://example.com' }) } },
    ])

    await sdk.onClickPush({
      data: { message_id: 'm-web', id: 'n-web', type: 'web_push' },
    })

    expect(mockOpenURL).toHaveBeenCalledTimes(2)
    expect(mockOpenURL).toHaveBeenCalledWith('https://example.com')
  })

  test('resolves product url via API and opens it', async () => {
    const sdk = createSdk()
    jest.spyOn(sdk, 'notificationClicked').mockResolvedValue(undefined)
    mockGetPushData.mockResolvedValue([
      { data: { event: JSON.stringify({ type: 'product', uri: 'sku-123' }) } },
    ])
    mockRequest.mockResolvedValueOnce({ url: 'https://example.com/product/sku-123' })

    await sdk.onClickPush({
      data: { message_id: 'm-product', id: 'n-product', type: 'web_push' },
    })

    expect(mockRequest).toHaveBeenCalledWith(
      'products/get?item_id=sku-123&shop_id=shop-id',
      'shop-id',
      expect.objectContaining({
        method: 'GET',
      })
    )
    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://example.com/product/sku-123'
    )
  })

  test('resolves category url via API and opens it', async () => {
    const sdk = createSdk()
    jest.spyOn(sdk, 'notificationClicked').mockResolvedValue(undefined)
    mockGetPushData.mockResolvedValue([
      { data: { event: JSON.stringify({ type: 'category', uri: 'cat-22' }) } },
    ])
    mockRequest.mockResolvedValueOnce({
      categories: [
        { id: 'cat-1', url: 'https://example.com/cat-1' },
        { id: 'cat-22', url: 'https://example.com/cat-22' },
      ],
    })

    await sdk.onClickPush({
      data: { message_id: 'm-category', id: 'n-category', type: 'web_push' },
    })

    expect(mockRequest).toHaveBeenCalledWith(
      'category/cat-22?shop_id=shop-id',
      'shop-id',
      expect.objectContaining({
        method: 'GET',
      })
    )
    expect(mockOpenURL).toHaveBeenCalledWith('https://example.com/cat-22')
  })

  test('returns error when product API request fails', async () => {
    const sdk = createSdk()
    jest.spyOn(sdk, 'notificationClicked').mockResolvedValue(undefined)
    const apiError = new Error('product lookup failed')
    mockGetPushData.mockResolvedValue([
      { data: { event: JSON.stringify({ type: 'product', uri: 'sku-fail' }) } },
    ])
    mockRequest.mockRejectedValueOnce(apiError)

    const result = await sdk.onClickPush({
      data: { message_id: 'm-fail', id: 'n-fail', type: 'web_push' },
    })

    expect(result).toBe(apiError)
    expect(mockOpenURL).not.toHaveBeenCalled()
  })

  test('extracts message id from google.message_id fallback', async () => {
    const sdk = createSdk()
    mockGetPushData.mockResolvedValue([])

    await sdk.onClickPush({
      data: { 'google.message_id': 'google-mid-77' },
    })

    expect(mockGetPushData).toHaveBeenCalledWith('google-mid-77', 'shop-id')
  })

  test('extracts message id from gcm.message_id fallback', async () => {
    const sdk = createSdk()
    mockGetPushData.mockResolvedValue([])

    await sdk.onClickPush({
      data: { 'gcm.message_id': 'gcm-mid-88' },
    })

    expect(mockGetPushData).toHaveBeenCalledWith('gcm-mid-88', 'shop-id')
  })
})
