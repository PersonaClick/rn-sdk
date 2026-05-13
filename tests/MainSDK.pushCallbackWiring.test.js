/**
 * Integration tests for initPush callback wiring.
 *
 * Unlike MainSDK.pushToken.test.js (which mocks _pushOrchestrator entirely),
 * these tests keep the real PushOrchestrator so the actual
 * `(event) => this.pushClickListener.call(this, event)` closure is exercised.
 *
 * Coverage gap addressed: no prior test verified that calling initPush(customCb)
 * actually routes a notification click/receive to customCb end-to-end.
 */

jest.mock('../index.js', () => ({
  SDK_PUSH_CHANNEL: 'PersonaClick',
  SDK_API_URL: 'https://api.personaclick.com/',
}))

jest.mock('../components/Popup/SdkPopupOverlay', () => ({
  prepareAndShow: jest.fn().mockResolvedValue(undefined),
  registerSDK: jest.fn(),
}))

jest.mock('../lib/notification', () => ({
  NotificationManager: { showNotification: jest.fn() },
}))

// ---------------------------------------------------------------------------
// Firebase mocks — variables must be declared before jest.mock so the babel
// hoisting transformation picks them up as mock-prefixed identifiers.
// ---------------------------------------------------------------------------
const mockGetMessaging = jest.fn().mockReturnValue({ id: 'messaging' })
const mockGetToken = jest.fn().mockResolvedValue('fcm-token')
const mockOnMessage = jest.fn().mockReturnValue(() => {})
const mockSetBackgroundMessageHandler = jest.fn()
const mockOnNotificationOpenedApp = jest.fn().mockReturnValue(() => {})
const mockGetInitialNotification = jest.fn().mockResolvedValue(null)
const mockOnTokenRefresh = jest.fn().mockReturnValue(() => {})

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: (...args) => mockGetMessaging(...args),
  getToken: (...args) => mockGetToken(...args),
  getAPNSToken: jest.fn().mockResolvedValue('apns-token'),
  onMessage: (...args) => mockOnMessage(...args),
  setBackgroundMessageHandler: (...args) => mockSetBackgroundMessageHandler(...args),
  onNotificationOpenedApp: (...args) => mockOnNotificationOpenedApp(...args),
  getInitialNotification: (...args) => mockGetInitialNotification(...args),
  onTokenRefresh: (...args) => mockOnTokenRefresh(...args),
  deleteToken: jest.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Notifee mocks
// ---------------------------------------------------------------------------
const mockNotifeeOnForegroundEvent = jest.fn().mockReturnValue(() => {})
const mockNotifeeOnBackgroundEvent = jest.fn()
const mockNotifeeGetInitialNotification = jest.fn().mockResolvedValue(null)

jest.mock('@notifee/react-native', () => {
  const AuthorizationStatus = { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 }
  return {
    __esModule: true,
    default: {
      createChannel: jest.fn().mockResolvedValue(undefined),
      requestPermission: jest
        .fn()
        .mockResolvedValue({ authorizationStatus: AuthorizationStatus.AUTHORIZED }),
      onForegroundEvent: (...args) => mockNotifeeOnForegroundEvent(...args),
      onBackgroundEvent: (...args) => mockNotifeeOnBackgroundEvent(...args),
      getInitialNotification: (...args) => mockNotifeeGetInitialNotification(...args),
    },
    AndroidImportance: { HIGH: 4 },
    AndroidStyle: { BIGPICTURE: 1 },
    EventType: { PRESS: 'press' },
    AuthorizationStatus,
  }
})

// ---------------------------------------------------------------------------
// React Native mocks
// ---------------------------------------------------------------------------
const mockPlatform = { OS: 'android', Version: 34 }
const mockPermissionsRequest = jest.fn().mockResolvedValue('granted')

jest.mock('react-native', () => ({
  __esModule: true,
  Linking: { openURL: jest.fn().mockResolvedValue(true) },
  PermissionsAndroid: {
    PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
    RESULTS: { GRANTED: 'granted' },
    request: (...args) => mockPermissionsRequest(...args),
  },
  Platform: mockPlatform,
  default: {
    Linking: { openURL: jest.fn().mockResolvedValue(true) },
    PermissionsAndroid: {
      PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
      RESULTS: { GRANTED: 'granted' },
      request: (...args) => mockPermissionsRequest(...args),
    },
    Platform: mockPlatform,
  },
}))

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------
const mockInitLocker = jest.fn().mockResolvedValue(null)
const mockSetInitLocker = jest.fn().mockResolvedValue(undefined)
const mockRequest = jest.fn().mockResolvedValue({ status: 'success' })

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
  getSavedPushToken: jest.fn().mockResolvedValue(null),
  savePushToken: jest.fn().mockResolvedValue(undefined),
  getLastPushTokenSentDate: jest.fn().mockResolvedValue(null),
  saveLastPushTokenSentDate: jest.fn().mockResolvedValue(undefined),
}))

const MainSDK = require('../MainSDK.js').default

// ---------------------------------------------------------------------------
// Factory — keeps the real PushOrchestrator to exercise the callback closure
// ---------------------------------------------------------------------------

function createSdkWithRealOrchestrator() {
  const sdk = new MainSDK('shop-id', 'android', false, false)
  sdk.initialized = true
  sdk.push = jest.fn((command) => command())
  // Pre-populate token cache so initPushToken takes the fast path:
  // calls ensureTrackingSubscriptions() and returns without touching Firebase.
  sdk._tokenCache = 'cached-token'
  jest.spyOn(sdk, 'getPushPermission').mockResolvedValue(true)
  jest.spyOn(sdk, 'initPushChannel').mockResolvedValue(undefined)
  jest.spyOn(sdk, 'setPushTokenNotification').mockImplementation(() => {})
  return sdk
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initPush callback wiring — click', () => {
  let capturedOnNotifOpenedHandler
  let capturedNotifeeForegroundHandler
  let capturedNotifeeBackgroundHandler

  beforeEach(() => {
    jest.clearAllMocks()
    capturedOnNotifOpenedHandler = null
    capturedNotifeeForegroundHandler = null
    capturedNotifeeBackgroundHandler = null

    mockGetMessaging.mockReturnValue({ id: 'messaging' })
    mockGetInitialNotification.mockResolvedValue(null)
    mockNotifeeGetInitialNotification.mockResolvedValue(null)
    mockOnTokenRefresh.mockReturnValue(() => {})
    mockInitLocker.mockResolvedValue(null)
    mockSetInitLocker.mockResolvedValue(undefined)
    mockPlatform.OS = 'android'

    mockOnMessage.mockReturnValue(() => {})
    mockSetBackgroundMessageHandler.mockImplementation(() => {})

    mockOnNotificationOpenedApp.mockImplementation((_msg, handler) => {
      capturedOnNotifOpenedHandler = handler
      return () => {}
    })
    mockNotifeeOnForegroundEvent.mockImplementation((handler) => {
      capturedNotifeeForegroundHandler = handler
      return () => {}
    })
    mockNotifeeOnBackgroundEvent.mockImplementation((handler) => {
      capturedNotifeeBackgroundHandler = handler
    })
  })

  test('custom click callback is invoked when onNotificationOpenedApp fires', async () => {
    const sdk = createSdkWithRealOrchestrator()
    const customClick = jest.fn()

    await sdk.initPush(customClick)

    expect(capturedOnNotifOpenedHandler).not.toBeNull()
    const msg = { messageId: 'msg-1', data: { id: 'n1', type: 'web_push' } }
    await capturedOnNotifOpenedHandler(msg)

    expect(customClick).toHaveBeenCalledTimes(1)
    expect(customClick).toHaveBeenCalledWith(msg)
  })

  test('custom click callback is invoked via notifee foreground PRESS (falls back to raw data when no stored entry)', async () => {
    const sdk = createSdkWithRealOrchestrator()
    const customClick = jest.fn()

    await sdk.initPush(customClick)

    expect(capturedNotifeeForegroundHandler).not.toBeNull()
    const data = { message_id: 'msg-2', id: 'n2', type: 'web_push' }
    await capturedNotifeeForegroundHandler({
      type: 'press',
      detail: { notification: { data } },
    })

    expect(customClick).toHaveBeenCalledTimes(1)
    expect(customClick).toHaveBeenCalledWith({ data })
  })

  test('custom click callback is invoked via notifee background PRESS', async () => {
    const sdk = createSdkWithRealOrchestrator()
    const customClick = jest.fn()

    await sdk.initPush(customClick)

    expect(capturedNotifeeBackgroundHandler).not.toBeNull()
    const data = { id: 'n3', type: 'web_push' }
    await capturedNotifeeBackgroundHandler({
      type: 'press',
      detail: { notification: { data } },
    })

    expect(customClick).toHaveBeenCalledTimes(1)
    expect(customClick).toHaveBeenCalledWith({ data })
  })

  test('custom click callback is invoked for FCM cold-start notification', async () => {
    const coldStartMsg = { messageId: 'cold-1', data: { id: 'n4', type: 'web_push' } }
    mockGetInitialNotification.mockResolvedValue(coldStartMsg)

    const sdk = createSdkWithRealOrchestrator()
    const customClick = jest.fn()

    await sdk.initPush(customClick)

    expect(customClick).toHaveBeenCalledTimes(1)
    expect(customClick).toHaveBeenCalledWith(coldStartMsg)
  })

  // Verifies the fix for the cold-start race. Sequence:
  //   1. SDK auto-init runs initPush() with no user callback. installSubscriptions()
  //      consumes cold-start through the default click listener AND buffers the
  //      payload in PushOrchestrator._lastColdStart.
  //   2. Host app later calls sdk.initPush(myCallback). setListeners({ click })
  //      detects the buffered payload and replays it through myCallback.
  // Result: the click that launched the app reaches the host's callback even
  // when registered after auto-init.
  test('FCM cold-start click is REPLAYED to host callback registered after auto-init consumed default', async () => {
    const coldStartMsg = { messageId: 'cold-replay', data: { id: 'n', type: 'web_push' } }
    mockGetInitialNotification.mockResolvedValue(coldStartMsg)

    const sdk = createSdkWithRealOrchestrator()
    // Stand in for autoSendPushToken=true: the first call has no callback.
    await sdk.initPush()

    // Host code mounts later and registers its callback.
    const customClick = jest.fn()
    await sdk.initPush(customClick)

    // The buffered cold-start is replayed through customClick (microtask).
    await new Promise((resolve) => setImmediate(resolve))
    expect(customClick).toHaveBeenCalledWith(coldStartMsg)
  })

  test('callback set on second initPush call is invoked when subscriptions already exist from first call', async () => {
    const sdk = createSdkWithRealOrchestrator()

    // First call without a custom callback — sets up subscriptions
    await sdk.initPush()
    expect(capturedOnNotifOpenedHandler).not.toBeNull()

    // Second call with a custom callback — updates pushClickListener only;
    // ensureTrackingSubscriptions() returns immediately (_trackingSubscribed=true),
    // but the existing handler closure reads the updated property at call time.
    const customClick = jest.fn()
    await sdk.initPush(customClick)

    const msg = { messageId: 'msg-5', data: { id: 'n5', type: 'web_push' } }
    await capturedOnNotifOpenedHandler(msg)

    expect(customClick).toHaveBeenCalledTimes(1)
    expect(customClick).toHaveBeenCalledWith(msg)
  })

  test('default click behavior routes to onClickPush when no custom callback given', async () => {
    const sdk = createSdkWithRealOrchestrator()
    const onClickPushSpy = jest.spyOn(sdk, 'onClickPush').mockResolvedValue(undefined)

    await sdk.initPush()

    const msg = { messageId: 'msg-8', data: { id: 'n8', type: 'web_push' } }
    await capturedOnNotifOpenedHandler(msg)

    expect(onClickPushSpy).toHaveBeenCalledTimes(1)
    expect(onClickPushSpy).toHaveBeenCalledWith(msg)
  })
})

describe('initPush callback wiring — receive', () => {
  let capturedOnMessageHandler
  let capturedBgMessageHandler

  beforeEach(() => {
    jest.clearAllMocks()
    capturedOnMessageHandler = null
    capturedBgMessageHandler = null

    mockGetMessaging.mockReturnValue({ id: 'messaging' })
    mockGetInitialNotification.mockResolvedValue(null)
    mockNotifeeGetInitialNotification.mockResolvedValue(null)
    mockOnTokenRefresh.mockReturnValue(() => {})
    mockInitLocker.mockResolvedValue(null)
    mockSetInitLocker.mockResolvedValue(undefined)
    mockPlatform.OS = 'android'

    mockOnNotificationOpenedApp.mockReturnValue(() => {})
    mockNotifeeOnForegroundEvent.mockReturnValue(() => {})
    mockNotifeeOnBackgroundEvent.mockImplementation(() => {})

    mockOnMessage.mockImplementation((_msg, handler) => {
      capturedOnMessageHandler = handler
      return () => {}
    })
    mockSetBackgroundMessageHandler.mockImplementation((_msg, handler) => {
      capturedBgMessageHandler = handler
    })
  })

  test('custom receive callback is invoked when onMessage fires', async () => {
    const sdk = createSdkWithRealOrchestrator()
    const customReceive = jest.fn()

    await sdk.initPush(false, customReceive)

    expect(capturedOnMessageHandler).not.toBeNull()
    const msg = { messageId: 'msg-6', data: { id: 'n6', type: 'web_push' } }
    await capturedOnMessageHandler(msg)

    expect(customReceive).toHaveBeenCalledTimes(1)
    expect(customReceive).toHaveBeenCalledWith(msg)
  })

  test('custom background-receive callback is invoked when background message handler fires', async () => {
    const sdk = createSdkWithRealOrchestrator()
    const customBgReceive = jest.fn()

    await sdk.initPush(false, false, customBgReceive)

    expect(capturedBgMessageHandler).not.toBeNull()
    const msg = { messageId: 'msg-7', data: { id: 'n7', type: 'web_push' } }
    await capturedBgMessageHandler(msg)

    expect(customBgReceive).toHaveBeenCalledTimes(1)
    expect(customBgReceive).toHaveBeenCalledWith(msg)
  })
})

// ---------------------------------------------------------------------------
// Edge-case reproductions for "click callback not invoked" reports.
// Each test maps to a category in the bug-analysis matrix:
//   A — race conditions between auto-init and host registration
//   B — handler registration failures
//   D — semantic edge cases / false-negatives
// ---------------------------------------------------------------------------

describe('initPush callback wiring — edge-case reproductions', () => {
  let capturedOnNotifOpenedHandler
  let capturedOnMessageHandler
  let capturedBgMessageHandler

  beforeEach(() => {
    jest.clearAllMocks()
    capturedOnNotifOpenedHandler = null
    capturedOnMessageHandler = null
    capturedBgMessageHandler = null

    mockGetMessaging.mockReturnValue({ id: 'messaging' })
    mockGetInitialNotification.mockResolvedValue(null)
    mockNotifeeGetInitialNotification.mockResolvedValue(null)
    mockOnTokenRefresh.mockReturnValue(() => {})
    mockInitLocker.mockResolvedValue(null)
    mockSetInitLocker.mockResolvedValue(undefined)
    mockPlatform.OS = 'android'

    mockNotifeeOnForegroundEvent.mockReturnValue(() => {})
    mockNotifeeOnBackgroundEvent.mockImplementation(() => {})

    mockOnNotificationOpenedApp.mockImplementation((_msg, handler) => {
      capturedOnNotifOpenedHandler = handler
      return () => {}
    })
    mockOnMessage.mockImplementation((_msg, handler) => {
      capturedOnMessageHandler = handler
      return () => {}
    })
    mockSetBackgroundMessageHandler.mockImplementation((_msg, handler) => {
      capturedBgMessageHandler = handler
    })
  })

  // -------------------------------------------------------------------------
  // A1: Receive race — message that arrives between auto-init and host
  // registration is delivered through the default pushReceivedListener
  // (showNotification), not the custom callback.
  // -------------------------------------------------------------------------
  test('A1: foreground message before host registers receive callback hits default, not custom', async () => {
    const sdk = createSdkWithRealOrchestrator()
    const showNotificationSpy = jest
      .spyOn(sdk, 'showNotification')
      .mockResolvedValue(undefined)

    // Auto-init: no callback
    await sdk.initPush()
    expect(capturedOnMessageHandler).not.toBeNull()

    // Message arrives BEFORE host registers receive callback → default handles it
    const earlyMsg = { messageId: 'a1-early', data: { id: 'n', type: 'web_push' } }
    await capturedOnMessageHandler(earlyMsg)
    expect(showNotificationSpy).toHaveBeenCalledWith(earlyMsg)

    // Host registers callback later
    const customReceive = jest.fn()
    await sdk.initPush(false, customReceive)

    // New messages now reach the custom callback (closure dispatch is fine for ongoing)
    const lateMsg = { messageId: 'a1-late', data: { id: 'n', type: 'web_push' } }
    await capturedOnMessageHandler(lateMsg)
    expect(customReceive).toHaveBeenCalledTimes(1)
    expect(customReceive).toHaveBeenCalledWith(lateMsg)
    // The early message was lost to default
    expect(customReceive).not.toHaveBeenCalledWith(earlyMsg)
  })

  // -------------------------------------------------------------------------
  // A2: in-flight join — host calls initPush(cb) while auto-init is paused
  // before ensureTrackingSubscriptions runs. pushClickListener is replaced
  // before cold-start fires, so the cb DOES receive the cold-start.
  // -------------------------------------------------------------------------
  test('A2: initPush(cb) joining in-flight auto-init delivers cold-start to cb when registered before ensureTrackingSubscriptions', async () => {
    const coldStartMsg = { messageId: 'a2-cold', data: { id: 'n', type: 'web_push' } }
    mockGetInitialNotification.mockResolvedValue(coldStartMsg)

    const sdk = createSdkWithRealOrchestrator()

    // Pin auto-init at getPushPermission so we control when it resumes.
    let permissionRequested = false
    let resolvePermission
    sdk.getPushPermission.mockImplementation(() => {
      permissionRequested = true
      return new Promise((resolve) => {
        resolvePermission = () => resolve(true)
      })
    })

    // Start auto-init (no callback) — runs until it hits getPushPermission
    const autoInitPromise = sdk.initPush()
    while (!permissionRequested) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setImmediate(resolve))
    }

    // Auto-init is now paused; _initPushPromise is set.
    // Host registers cb — sets pushClickListener, joins the in-flight promise.
    const customClick = jest.fn()
    const userPromise = sdk.initPush(customClick)

    // Resume auto-init. ensureTrackingSubscriptions runs the cold-start path
    // with pushClickListener = customClick.
    resolvePermission()
    await Promise.all([autoInitPromise, userPromise])

    expect(customClick).toHaveBeenCalledWith(coldStartMsg)
  })

  // -------------------------------------------------------------------------
  // A3: under active init lock, initPush(cb) returns false but still saves
  // the callback and ensures tracking subscriptions. Future clicks reach cb.
  // -------------------------------------------------------------------------
  test('A3: locked initPush(cb) saves callback and still wires up subscriptions for future clicks', async () => {
    mockInitLocker.mockResolvedValue({ state: true, expires: Date.now() + 10000 })

    const sdk = createSdkWithRealOrchestrator()
    const customClick = jest.fn()

    const result = await sdk.initPush(customClick)

    expect(result).toBe(false)
    expect(sdk.pushClickListener).toBe(customClick)
    expect(capturedOnNotifOpenedHandler).not.toBeNull()

    // Future clicks reach the custom callback
    const msg = { messageId: 'a3-1', data: { id: 'n', type: 'web_push' } }
    await capturedOnNotifOpenedHandler(msg)
    expect(customClick).toHaveBeenCalledWith(msg)
  })

  // -------------------------------------------------------------------------
  // B1: Firebase messaging unavailable — ensureTrackingSubscriptions returns
  // false WITHOUT registering any handlers. Callback is stored but never fires.
  // -------------------------------------------------------------------------
  test('B1: when getMessaging() returns null, no Firebase handlers are registered (callback is silently inert)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockGetMessaging.mockReturnValue(null)

    const sdk = createSdkWithRealOrchestrator()
    const customClick = jest.fn()

    await sdk.initPush(customClick)

    // Callback is stored on the SDK instance...
    expect(sdk.pushClickListener).toBe(customClick)
    // ...but neither Firebase nor Notifee handlers were registered.
    expect(capturedOnNotifOpenedHandler).toBeNull()
    expect(capturedOnMessageHandler).toBeNull()
    expect(capturedBgMessageHandler).toBeNull()

    warnSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // B1 recovery: a subsequent initPush call after messaging becomes available
  // does register the handlers and clicks reach the callback.
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // B1 recovery FIX verification.
  //
  // The previous PushOrchestrator stored an in-flight promise like:
  //   this._trackingPromise = (async () => { try {...} finally { _trackingPromise = null } })()
  // On the messaging=null path the IIFE had no awaits, so the finally clause
  // (`_trackingPromise = null`) ran during RHS evaluation BEFORE the outer
  // assignment landed — the outer assignment then overwrote `null` with the
  // resolved-false promise, leaving every subsequent call short-circuited.
  //
  // The new installSubscriptions clears _installPromise OUTSIDE the IIFE, in the
  // outer caller's finally, after `await`. That makes recovery work.
  // -------------------------------------------------------------------------
  test('B1 recovery: subsequent initPush after messaging becomes available registers handlers', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const sdk = createSdkWithRealOrchestrator()
    const customClick = jest.fn()

    mockGetMessaging.mockReturnValue(null)
    await sdk.initPush(customClick)
    expect(capturedOnNotifOpenedHandler).toBeNull()

    mockGetMessaging.mockReturnValue({ id: 'messaging' })
    await sdk.initPush(customClick)
    expect(capturedOnNotifOpenedHandler).not.toBeNull()

    const msg = { messageId: 'b1-recovered', data: { id: 'n', type: 'web_push' } }
    await capturedOnNotifOpenedHandler(msg)
    expect(customClick).toHaveBeenCalledWith(msg)

    warnSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // B2: permission denied — initPush returns null without ensureTracking-
  // Subscriptions. Callback is stored but no handlers exist.
  // -------------------------------------------------------------------------
  test('B2: when push permission is denied, initPush returns null and registers no handlers', async () => {
    const sdk = createSdkWithRealOrchestrator()
    sdk.getPushPermission.mockResolvedValue(false)

    const customClick = jest.fn()
    const result = await sdk.initPush(customClick)

    expect(result).toBeNull()
    expect(sdk.pushClickListener).toBe(customClick)
    // No subscriptions installed because the permission gate short-circuits.
    expect(capturedOnNotifOpenedHandler).toBeNull()
  })

  // -------------------------------------------------------------------------
  // D1: dedup by messageId — same message id fires the click callback once,
  // not on every redelivery. Easy to misread as "callback didn't fire".
  // -------------------------------------------------------------------------
  test('D1: same messageId fires custom click callback only once (deduplication)', async () => {
    const sdk = createSdkWithRealOrchestrator()
    const customClick = jest.fn()

    await sdk.initPush(customClick)

    const msg = { messageId: 'd1-dup', data: { id: 'n', type: 'web_push' } }
    await capturedOnNotifOpenedHandler(msg)
    await capturedOnNotifOpenedHandler(msg) // same messageId — dropped

    expect(customClick).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // D2: custom receive callback FULLY REPLACES the default behavior. The
  // default would have called showNotification (Notifee). With a custom
  // receiver, no UI is shown — and therefore no click can happen later.
  // -------------------------------------------------------------------------
  test('D2: custom receive callback replaces default — showNotification is NOT called', async () => {
    const sdk = createSdkWithRealOrchestrator()
    const showNotificationSpy = jest
      .spyOn(sdk, 'showNotification')
      .mockResolvedValue(undefined)
    const customReceive = jest.fn()

    await sdk.initPush(false, customReceive)

    const msg = { messageId: 'd2-1', data: { id: 'n', type: 'web_push' } }
    await capturedOnMessageHandler(msg)

    expect(customReceive).toHaveBeenCalledWith(msg)
    expect(showNotificationSpy).not.toHaveBeenCalled()
  })
})
