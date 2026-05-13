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

const mockGetMessaging = jest.fn(() => ({ id: 'messaging' }))

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: (...args) => mockGetMessaging(...args),
  onMessage: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
  getToken: jest.fn().mockResolvedValue('fcm-token'),
  getAPNSToken: jest.fn().mockResolvedValue('apns-token'),
  deleteToken: jest.fn().mockResolvedValue(undefined),
  onNotificationOpenedApp: jest.fn(),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  onTokenRefresh: jest.fn().mockReturnValue(() => {}),
}))

jest.mock('@notifee/react-native', () => {
  const AuthorizationStatus = {
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  }
  return {
    __esModule: true,
    default: {
      createChannel: jest.fn().mockResolvedValue(undefined),
      requestPermission: jest
        .fn()
        .mockResolvedValue({ authorizationStatus: AuthorizationStatus.AUTHORIZED }),
      onForegroundEvent: jest.fn().mockReturnValue(() => {}),
      onBackgroundEvent: jest.fn(),
      getInitialNotification: jest.fn().mockResolvedValue(null),
    },
    AndroidImportance: { HIGH: 4 },
    AndroidStyle: { BIGPICTURE: 1 },
    EventType: { PRESS: 'press' },
    AuthorizationStatus,
  }
})

const mockLinkingOpenURL = jest.fn().mockResolvedValue(true)
const mockPermissionsRequest = jest.fn().mockResolvedValue('granted')
const mockPlatform = { OS: 'android', Version: 34 }

jest.mock('react-native', () => ({
  __esModule: true,
  Linking: { openURL: (...args) => mockLinkingOpenURL(...args) },
  PermissionsAndroid: {
    PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
    RESULTS: { GRANTED: 'granted' },
    request: (...args) => mockPermissionsRequest(...args),
  },
  Platform: mockPlatform,
  default: {
    Linking: { openURL: (...args) => mockLinkingOpenURL(...args) },
    PermissionsAndroid: {
      PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
      RESULTS: { GRANTED: 'granted' },
      request: (...args) => mockPermissionsRequest(...args),
    },
    Platform: mockPlatform,
  },
}))

const mockInitLocker = jest.fn().mockResolvedValue(null)
const mockSetInitLocker = jest.fn().mockResolvedValue(undefined)
const mockRequest = jest.fn().mockResolvedValue({ status: 'success' })
const mockGetSavedPushToken = jest.fn().mockResolvedValue(null)
const mockSavePushToken = jest.fn().mockResolvedValue(undefined)
const mockGetLastPushTokenSentDate = jest.fn().mockResolvedValue(null)
const mockSaveLastPushTokenSentDate = jest.fn().mockResolvedValue(undefined)

jest.mock('../lib/client.js', () => ({
  initLocker: (...args) => mockInitLocker(...args),
  request: (...args) => mockRequest(...args),
  setInitLocker: (...args) => mockSetInitLocker(...args),
  updSeance: jest.fn().mockResolvedValue(undefined),
  getPushData: jest.fn().mockResolvedValue([]),
  updPushData: jest.fn().mockResolvedValue(undefined),
  removePushMessage: jest.fn().mockResolvedValue(undefined),
  getData: jest.fn().mockResolvedValue(null),
  generateSid: jest.fn(() => 'sid-1'),
  getSavedPushToken: (...args) => mockGetSavedPushToken(...args),
  savePushToken: (...args) => mockSavePushToken(...args),
  getLastPushTokenSentDate: (...args) => mockGetLastPushTokenSentDate(...args),
  saveLastPushTokenSentDate: (...args) => mockSaveLastPushTokenSentDate(...args),
}))

const MainSDK = require('../MainSDK.js').default
const { deleteToken: firebaseDeleteToken } = require('@react-native-firebase/messaging')

const flushTasks = async () => {
  await new Promise((resolve) => setImmediate(resolve))
}

function createSdk() {
  const sdk = new MainSDK('shop-id', 'android', false, false)
  sdk.initialized = true
  sdk.push = jest.fn((command) => command())
  sdk._pushOrchestrator = {
    installSubscriptions: jest.fn().mockResolvedValue(true),
    fetchToken: jest.fn().mockResolvedValue('fcm-token-1'),
    setListeners: jest.fn(),
    _clickListener: null,
    _receiveListener: null,
    _bgReceiveListener: null,
    _deps: {
      defaultClickListener: () => {},
      defaultReceiveListener: () => {},
      defaultBgReceiveListener: () => {},
    },
  }
  return sdk
}

describe('MainSDK push token flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMessaging.mockReset().mockReturnValue({ id: 'messaging' })
    mockInitLocker.mockReset().mockResolvedValue(null)
    mockSetInitLocker.mockReset().mockResolvedValue(undefined)
    mockGetSavedPushToken.mockReset().mockResolvedValue(null)
    mockRequest.mockReset().mockResolvedValue({ status: 'success' })
    mockSavePushToken.mockReset().mockResolvedValue(undefined)
    mockGetLastPushTokenSentDate.mockReset().mockResolvedValue(null)
    mockSaveLastPushTokenSentDate.mockReset().mockResolvedValue(undefined)
    mockPermissionsRequest.mockReset().mockResolvedValue('granted')
    mockPlatform.OS = 'android'
    mockPlatform.Version = 34
  })

  test('getToken joins in-flight initPush promise', async () => {
    const sdk = createSdk()
    sdk._initPushPromise = Promise.resolve('joined-token')
    const initPushTokenSpy = jest.spyOn(sdk, 'initPushToken')

    const token = await sdk.getToken()

    expect(token).toBe('joined-token')
    expect(initPushTokenSpy).not.toHaveBeenCalled()
  })

  test('getToken falls back to initPushToken when there is no in-flight init', async () => {
    const sdk = createSdk()
    const initPushTokenSpy = jest
      .spyOn(sdk, 'initPushToken')
      .mockResolvedValue('direct-token')

    const token = await sdk.getToken()

    expect(token).toBe('direct-token')
    expect(initPushTokenSpy).toHaveBeenCalledTimes(1)
  })

  test('initPushToken returns memory token and ensures subscriptions', async () => {
    const sdk = createSdk()
    sdk._tokenCache = 'cached-memory-token'

    const token = await sdk.initPushToken(false)

    expect(token).toBe('cached-memory-token')
    expect(mockGetSavedPushToken).not.toHaveBeenCalled()
    expect(sdk._pushOrchestrator.installSubscriptions).toHaveBeenCalledTimes(
      1
    )
  })

  test('initPushToken returns saved token, updates cache, and ensures subscriptions', async () => {
    const sdk = createSdk()
    mockGetSavedPushToken.mockResolvedValue('saved-token')

    const token = await sdk.initPushToken(false)

    expect(token).toBe('saved-token')
    expect(sdk._tokenCache).toBe('saved-token')
    expect(mockGetSavedPushToken).toHaveBeenCalledWith('shop-id')
    expect(sdk._pushOrchestrator.installSubscriptions).toHaveBeenCalledTimes(
      1
    )
  })

  test('initPushToken returns null when permission wait resolves denied', async () => {
    const sdk = createSdk()
    sdk._pushPermissionState = 'requesting'
    const waitSpy = jest
      .spyOn(sdk, '_waitForPushPermissionResolution')
      .mockResolvedValue('denied')

    const token = await sdk.initPushToken(false)

    expect(token).toBeNull()
    expect(waitSpy).toHaveBeenCalledTimes(1)
    expect(sdk._pushOrchestrator.fetchToken).not.toHaveBeenCalled()
  })

  test('initPushToken returns null when permission wait times out', async () => {
    const sdk = createSdk()
    sdk._pushPermissionState = 'requesting'
    jest
      .spyOn(sdk, '_waitForPushPermissionResolution')
      .mockResolvedValue('timeout')

    const token = await sdk.initPushToken(false)

    expect(token).toBeNull()
    expect(sdk._pushOrchestrator.fetchToken).not.toHaveBeenCalled()
  })

  test('initPushToken returns null when messaging is unavailable', async () => {
    const sdk = createSdk()
    mockGetMessaging.mockImplementation(() => {
      throw new Error('firebase unavailable')
    })
    sdk.messaging = null

    const token = await sdk.initPushToken(false)

    expect(token).toBeNull()
    expect(sdk._pushOrchestrator.fetchToken).not.toHaveBeenCalled()
  })

  test('initPushToken handles fetchToken exceptions and returns null', async () => {
    const sdk = createSdk()
    sdk._pushOrchestrator.fetchToken.mockRejectedValue(new Error('fetch failed'))
    const setTokenSpy = jest.spyOn(sdk, 'setPushTokenNotification')

    const token = await sdk.initPushToken(false)

    expect(token).toBeNull()
    expect(setTokenSpy).not.toHaveBeenCalled()
  })

  test('initPushToken returns null when orchestrator returns empty token', async () => {
    const sdk = createSdk()
    sdk._pushOrchestrator.fetchToken.mockResolvedValue(null)
    const setTokenSpy = jest.spyOn(sdk, 'setPushTokenNotification')

    const token = await sdk.initPushToken(false)

    expect(token).toBeNull()
    expect(setTokenSpy).not.toHaveBeenCalled()
  })

  test('initPushToken(removeOld=true) clears old token and fetches a new one', async () => {
    const sdk = createSdk()
    sdk._tokenCache = 'old-token'
    const deleteTokenSpy = jest.spyOn(sdk, 'deleteToken').mockResolvedValue(undefined)
    const setTokenSpy = jest.spyOn(sdk, 'setPushTokenNotification')
    sdk._pushOrchestrator.fetchToken.mockResolvedValue('fresh-token')

    const token = await sdk.initPushToken(true)

    expect(token).toBe('fresh-token')
    expect(deleteTokenSpy).toHaveBeenCalledTimes(1)
    expect(sdk._tokenCache).toBe('fresh-token')
    expect(setTokenSpy).toHaveBeenCalledWith('fresh-token')
  })

  test('initPush applies lock short-circuit and still ensures subscriptions', async () => {
    const sdk = createSdk()
    mockInitLocker.mockResolvedValue({
      state: true,
      expires: Date.now() + 10000,
    })

    const token = await sdk.initPush()

    expect(token).toBe(false)
    expect(mockInitLocker).toHaveBeenCalledWith('shop-id')
    expect(sdk._pushOrchestrator.installSubscriptions).toHaveBeenCalledTimes(
      1
    )
  })

  test('initPush forwards custom click listener to orchestrator via setListeners', async () => {
    const sdk = createSdk()
    const customClick = jest.fn().mockResolvedValue(undefined)
    jest.spyOn(sdk, 'getPushPermission').mockResolvedValue(false)

    await sdk.initPush(customClick)

    expect(sdk._pushOrchestrator.setListeners).toHaveBeenCalledWith(
      expect.objectContaining({ click: customClick })
    )
  })

  test('initPush returns existing in-flight promise without new lock check', async () => {
    const sdk = createSdk()
    const inFlight = Promise.resolve('same-token')
    sdk._initPushPromise = inFlight

    const result = await sdk.initPush()

    expect(result).toBe('same-token')
    expect(mockInitLocker).not.toHaveBeenCalled()
  })

  test('initPush clears lock when permission denied', async () => {
    const sdk = createSdk()
    jest.spyOn(sdk, 'getPushPermission').mockResolvedValue(false)

    const token = await sdk.initPush()

    expect(token).toBeNull()
    expect(mockSetInitLocker).toHaveBeenCalledWith(true, 'shop-id')
    expect(mockSetInitLocker).toHaveBeenCalledWith(false, 'shop-id')
  })

  test('initPush success returns token and ensures subscriptions', async () => {
    const sdk = createSdk()
    jest.spyOn(sdk, 'getPushPermission').mockResolvedValue(true)
    jest.spyOn(sdk, 'initPushChannel').mockResolvedValue(undefined)
    jest.spyOn(sdk, 'initPushToken').mockResolvedValue('init-token')

    const token = await sdk.initPush()

    expect(token).toBe('init-token')
    expect(mockSetInitLocker).toHaveBeenCalledWith(true, 'shop-id')
    expect(sdk._pushOrchestrator.installSubscriptions).toHaveBeenCalledTimes(
      1
    )
  })

  test('setPushTokenNotification ignores invalid tokens', async () => {
    const sdk = createSdk()

    sdk.setPushTokenNotification('')
    await flushTasks()

    expect(mockRequest).not.toHaveBeenCalled()
  })

  test('setPushTokenNotification sends ios platform by default on iOS', async () => {
    const sdk = createSdk()
    mockPlatform.OS = 'ios'
    mockRequest.mockResolvedValue({ status: 'success' })

    sdk.setPushTokenNotification('ios-token')
    await flushTasks()

    expect(mockRequest).toHaveBeenCalledWith(
      'mobile_push_tokens',
      'shop-id',
      expect.objectContaining({
        method: 'POST',
        params: expect.objectContaining({
          token: 'ios-token',
          platform: 'ios',
        }),
      })
    )
    expect(mockSavePushToken).toHaveBeenCalledWith('ios-token', 'shop-id')
    expect(mockSaveLastPushTokenSentDate).toHaveBeenCalledTimes(1)
  })

  test('setPushTokenNotification forces android platform in firebase_only mode', async () => {
    const sdk = createSdk()
    mockPlatform.OS = 'ios'
    sdk.firebase_only(true)

    sdk.setPushTokenNotification('firebase-only-token')
    await flushTasks()

    expect(mockRequest).toHaveBeenCalledWith(
      'mobile_push_tokens',
      'shop-id',
      expect.objectContaining({
        params: expect.objectContaining({
          token: 'firebase-only-token',
          platform: 'android',
        }),
      })
    )
  })

  test('setPushTokenNotification does not persist token when backend rejects it', async () => {
    const sdk = createSdk()
    mockRequest.mockResolvedValue({ status: 'error' })

    sdk.setPushTokenNotification('rejected-token')
    await flushTasks()

    expect(mockRequest).toHaveBeenCalledTimes(1)
    expect(mockSavePushToken).not.toHaveBeenCalled()
    expect(mockSaveLastPushTokenSentDate).not.toHaveBeenCalled()
  })

  test('sendPushToken schedules full flow and stores last sent date when token exists', async () => {
    const sdk = createSdk()
    jest.spyOn(sdk, 'checkPushToken').mockResolvedValue(true)
    jest.spyOn(sdk, 'getPushPermission').mockResolvedValue(true)
    jest.spyOn(sdk, 'initPushChannel').mockResolvedValue(undefined)
    jest.spyOn(sdk, 'initPushToken').mockResolvedValue('flow-token')

    await sdk.sendPushToken()
    await flushTasks()

    expect(sdk.initPushChannel).toHaveBeenCalledTimes(1)
    expect(sdk.initPushToken).toHaveBeenCalledWith(false)
    expect(mockSaveLastPushTokenSentDate).toHaveBeenCalledTimes(1)
  })

  test('sendPushToken does nothing when checkPushToken returns false', async () => {
    const sdk = createSdk()
    jest.spyOn(sdk, 'checkPushToken').mockResolvedValue(false)
    const initPushChannelSpy = jest.spyOn(sdk, 'initPushChannel')

    await sdk.sendPushToken()
    await flushTasks()

    expect(initPushChannelSpy).not.toHaveBeenCalled()
    expect(mockSaveLastPushTokenSentDate).not.toHaveBeenCalled()
  })

  test('checkPushToken returns true when no last sent date exists', async () => {
    const sdk = createSdk()
    mockGetLastPushTokenSentDate.mockResolvedValue(null)

    const shouldSend = await sdk.checkPushToken()

    expect(shouldSend).toBe(true)
    expect(mockGetLastPushTokenSentDate).toHaveBeenCalledWith('shop-id')
  })

  test('deleteToken removes stored token and calls firebase deleteToken', async () => {
    const sdk = createSdk()
    sdk.messaging = { id: 'live-messaging' }

    await sdk.deleteToken()

    expect(mockSavePushToken).toHaveBeenCalledWith(false, 'shop-id')
    expect(firebaseDeleteToken).toHaveBeenCalledWith({ id: 'live-messaging' })
  })
})
