import PushOrchestrator from '../lib/push/PushOrchestrator.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a fully-wired mock deps object.
 * Every dep is a jest.fn() so tests can assert on calls and override return values.
 *
 * @param {object} [overrides]
 * @returns {{ orchestrator: PushOrchestrator, deps: object, messaging: object }}
 */
function makeOrchestrator(overrides = {}) {
  const messaging = {
    isDeviceRegisteredForRemoteMessages: jest.fn().mockResolvedValue(true),
    registerDeviceForRemoteMessages: jest.fn().mockResolvedValue(undefined),
  }

  const deps = {
    getMessaging: jest.fn().mockReturnValue(messaging),
    getToken: jest.fn().mockResolvedValue('fcm-token-123'),
    getAPNSToken: jest.fn().mockResolvedValue('apns-token-456'),
    onMessage: jest.fn().mockReturnValue(() => {}),
    setBackgroundMessageHandler: jest.fn(),
    onNotificationOpenedApp: jest.fn().mockReturnValue(() => {}),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    onTokenRefresh: jest.fn().mockReturnValue(() => {}),
    onNewToken: jest.fn(),
    notifee: {
      onForegroundEvent: jest.fn().mockReturnValue(() => {}),
      onBackgroundEvent: jest.fn(),
      getInitialNotification: jest.fn().mockResolvedValue(null),
    },
    EventType: { PRESS: 'press' },
    getPushData: jest.fn().mockResolvedValue([]),
    updPushData: jest.fn().mockResolvedValue(undefined),
    notificationDelivered: jest.fn().mockResolvedValue(undefined),
    pushReceivedListener: jest.fn().mockResolvedValue(undefined),
    pushBgReceivedListener: jest.fn().mockResolvedValue(undefined),
    pushClickListener: jest.fn().mockResolvedValue(undefined),
    getShopId: jest.fn().mockReturnValue('shop-1'),
    hasSeenMessageId: jest.fn().mockReturnValue(false),
    markMessageIdSeen: jest.fn(),
    isDebug: jest.fn().mockReturnValue(false),
    ...overrides,
  }

  const orchestrator = new PushOrchestrator(deps)
  return { orchestrator, deps, messaging }
}

// ---------------------------------------------------------------------------
// ensureDeviceRegistered
// ---------------------------------------------------------------------------

describe('PushOrchestrator.ensureDeviceRegistered', () => {
  test('does nothing on Android', async () => {
    const { orchestrator, messaging } = makeOrchestrator()
    await orchestrator.ensureDeviceRegistered(messaging, 'android')
    expect(messaging.registerDeviceForRemoteMessages).not.toHaveBeenCalled()
  })

  test('skips registration when already registered on iOS', async () => {
    const { orchestrator, messaging } = makeOrchestrator()
    messaging.isDeviceRegisteredForRemoteMessages.mockResolvedValue(true)
    await orchestrator.ensureDeviceRegistered(messaging, 'ios')
    expect(messaging.registerDeviceForRemoteMessages).not.toHaveBeenCalled()
  })

  test('calls registerDeviceForRemoteMessages when not registered on iOS', async () => {
    const { orchestrator, messaging } = makeOrchestrator()
    messaging.isDeviceRegisteredForRemoteMessages.mockResolvedValue(false)
    messaging.registerDeviceForRemoteMessages.mockResolvedValue(undefined)
    await orchestrator.ensureDeviceRegistered(messaging, 'ios')
    expect(messaging.registerDeviceForRemoteMessages).toHaveBeenCalledTimes(1)
  })

  test('throws when registration fails and isRegistered is definitively false', async () => {
    const { orchestrator, messaging } = makeOrchestrator()
    messaging.isDeviceRegisteredForRemoteMessages.mockResolvedValue(false)
    messaging.registerDeviceForRemoteMessages.mockRejectedValue(new Error('APNs error'))
    await expect(orchestrator.ensureDeviceRegistered(messaging, 'ios')).rejects.toThrow('APNs error')
  })

  test('warns (does not throw) when registration fails and registration status is unknown', async () => {
    const { orchestrator, messaging } = makeOrchestrator()
    // isDeviceRegisteredForRemoteMessages throws → isRegistered stays null
    messaging.isDeviceRegisteredForRemoteMessages.mockRejectedValue(new Error('unsupported'))
    messaging.registerDeviceForRemoteMessages.mockRejectedValue(new Error('register failed'))
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(orchestrator.ensureDeviceRegistered(messaging, 'ios')).resolves.toBeUndefined()
    warnSpy.mockRestore()
  })

  test('does nothing when messaging is null', async () => {
    const { orchestrator } = makeOrchestrator()
    await expect(orchestrator.ensureDeviceRegistered(null, 'ios')).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// fetchToken
// ---------------------------------------------------------------------------

describe('PushOrchestrator.fetchToken', () => {
  test('returns FCM token on Android', async () => {
    const { orchestrator, deps, messaging } = makeOrchestrator()
    const token = await orchestrator.fetchToken({ messaging, pushType: 'android', platformOS: 'android' })
    expect(token).toBe('fcm-token-123')
    expect(deps.getToken).toHaveBeenCalledWith(messaging)
    expect(deps.getAPNSToken).not.toHaveBeenCalled()
  })

  test('returns APNs token on iOS when pushType is null (default mode)', async () => {
    const { orchestrator, deps, messaging } = makeOrchestrator()
    const token = await orchestrator.fetchToken({ messaging, pushType: null, platformOS: 'ios' })
    expect(token).toBe('apns-token-456')
    expect(deps.getAPNSToken).toHaveBeenCalledWith(messaging)
    expect(deps.getToken).not.toHaveBeenCalled()
  })

  test('returns FCM token on iOS when pushType is set (firebase_only mode)', async () => {
    const { orchestrator, deps, messaging } = makeOrchestrator()
    const token = await orchestrator.fetchToken({ messaging, pushType: 'android', platformOS: 'ios' })
    expect(token).toBe('fcm-token-123')
    expect(deps.getToken).toHaveBeenCalledWith(messaging)
    expect(deps.getAPNSToken).not.toHaveBeenCalled()
  })

  test('returns null when token is empty string', async () => {
    const { orchestrator, deps, messaging } = makeOrchestrator({
      getToken: jest.fn().mockResolvedValue(''),
    })
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const token = await orchestrator.fetchToken({ messaging, pushType: 'android', platformOS: 'android' })
    expect(token).toBeNull()
    warnSpy.mockRestore()
  })

  test('returns null when token is null', async () => {
    const { orchestrator, deps, messaging } = makeOrchestrator({
      getToken: jest.fn().mockResolvedValue(null),
    })
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const token = await orchestrator.fetchToken({ messaging, pushType: 'android', platformOS: 'android' })
    expect(token).toBeNull()
    warnSpy.mockRestore()
  })

  test('returns null and logs error when token fetch throws', async () => {
    const { orchestrator, messaging } = makeOrchestrator({
      getToken: jest.fn().mockRejectedValue(new Error('network error')),
    })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const token = await orchestrator.fetchToken({ messaging, pushType: 'android', platformOS: 'android' })
    expect(token).toBeNull()
    errorSpy.mockRestore()
  })

  test('deduplicates concurrent fetchToken calls — only one actual token fetch', async () => {
    const { orchestrator, deps, messaging } = makeOrchestrator()
    // Fire two concurrent calls
    const [t1, t2] = await Promise.all([
      orchestrator.fetchToken({ messaging, pushType: 'android', platformOS: 'android' }),
      orchestrator.fetchToken({ messaging, pushType: 'android', platformOS: 'android' }),
    ])
    expect(t1).toBe('fcm-token-123')
    expect(t2).toBe('fcm-token-123')
    expect(deps.getToken).toHaveBeenCalledTimes(1)
  })

  test('allows a second independent fetchToken call after the first completes', async () => {
    const { orchestrator, deps, messaging } = makeOrchestrator()
    await orchestrator.fetchToken({ messaging, pushType: 'android', platformOS: 'android' })
    await orchestrator.fetchToken({ messaging, pushType: 'android', platformOS: 'android' })
    // Second call re-enters (promise was reset in finally), but subscriptions already set
    expect(deps.getToken).toHaveBeenCalledTimes(2)
  })

  test('calls ensureDeviceRegistered before fetching on iOS', async () => {
    const { orchestrator, messaging } = makeOrchestrator()
    messaging.isDeviceRegisteredForRemoteMessages.mockResolvedValue(false)
    await orchestrator.fetchToken({ messaging, pushType: null, platformOS: 'ios' })
    expect(messaging.registerDeviceForRemoteMessages).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// ensureTrackingSubscriptions — setup
// ---------------------------------------------------------------------------

describe('PushOrchestrator.ensureTrackingSubscriptions — subscription setup', () => {
  test('sets up all Firebase listeners on first call', async () => {
    const { orchestrator, deps } = makeOrchestrator()
    const result = await orchestrator.ensureTrackingSubscriptions()
    expect(result).toBe(true)
    expect(deps.onMessage).toHaveBeenCalledTimes(1)
    expect(deps.setBackgroundMessageHandler).toHaveBeenCalledTimes(1)
    expect(deps.onNotificationOpenedApp).toHaveBeenCalledTimes(1)
    expect(deps.onTokenRefresh).toHaveBeenCalledTimes(1)
    expect(deps.notifee.onForegroundEvent).toHaveBeenCalledTimes(1)
    expect(deps.notifee.onBackgroundEvent).toHaveBeenCalledTimes(1)
  })

  test('is idempotent — second call returns true without re-subscribing', async () => {
    const { orchestrator, deps } = makeOrchestrator()
    await orchestrator.ensureTrackingSubscriptions()
    await orchestrator.ensureTrackingSubscriptions()
    expect(deps.onMessage).toHaveBeenCalledTimes(1)
    expect(deps.onTokenRefresh).toHaveBeenCalledTimes(1)
  })

  test('returns false and does not mark as subscribed when messaging is unavailable', async () => {
    const { orchestrator, deps } = makeOrchestrator({
      getMessaging: jest.fn().mockReturnValue(null),
    })
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await orchestrator.ensureTrackingSubscriptions()
    expect(result).toBe(false)
    expect(orchestrator._trackingSubscribed).toBe(false)
    expect(deps.onMessage).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  test('retries subscriptions after messaging becomes available', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    // First orchestrator with no messaging → should fail gracefully
    const { orchestrator: orch1, deps: deps1 } = makeOrchestrator({
      getMessaging: jest.fn().mockReturnValue(null),
    })
    const r1 = await orch1.ensureTrackingSubscriptions()
    expect(r1).toBe(false)
    expect(orch1._trackingSubscribed).toBe(false)
    expect(deps1.onMessage).not.toHaveBeenCalled()

    // Second orchestrator with messaging available → should succeed
    const { orchestrator: orch2, deps: deps2 } = makeOrchestrator()
    const r2 = await orch2.ensureTrackingSubscriptions()
    expect(r2).toBe(true)
    expect(orch2._trackingSubscribed).toBe(true)
    expect(deps2.onMessage).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
    logSpy.mockRestore()
  })

  test('deduplicates concurrent ensureTrackingSubscriptions calls', async () => {
    const { orchestrator, deps } = makeOrchestrator()
    const [r1, r2] = await Promise.all([
      orchestrator.ensureTrackingSubscriptions(),
      orchestrator.ensureTrackingSubscriptions(),
    ])
    expect(r1).toBe(true)
    expect(r2).toBe(true)
    expect(deps.onMessage).toHaveBeenCalledTimes(1)
  })

  test('returns false when listener setup throws unexpectedly', async () => {
    const { orchestrator } = makeOrchestrator({
      onMessage: jest.fn(() => {
        throw new Error('subscription setup failed')
      }),
    })
    const result = await orchestrator.ensureTrackingSubscriptions()
    expect(result).toBe(false)
    expect(orchestrator._trackingSubscribed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ensureTrackingSubscriptions — onMessage (foreground receive)
// ---------------------------------------------------------------------------

describe('PushOrchestrator — onMessage handler', () => {
  function setupAndCaptureOnMessage(overrides = {}) {
    const { orchestrator, deps } = makeOrchestrator(overrides)
    let capturedHandler
    deps.onMessage.mockImplementation((_msg, handler) => {
      capturedHandler = handler
      return () => {}
    })
    return { orchestrator, deps, getHandler: () => capturedHandler }
  }

  test('calls notificationDelivered and pushReceivedListener on foreground message', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOnMessage()
    await orchestrator.ensureTrackingSubscriptions()
    const msg = { messageId: 'msg-1', data: { id: 'n1', type: 'web_push' } }
    await getHandler()(msg)
    expect(deps.notificationDelivered).toHaveBeenCalledWith({ code: 'n1', type: 'web_push' })
    expect(deps.pushReceivedListener).toHaveBeenCalledWith(msg)
  })

  test('deduplicates messages with same messageId', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOnMessage({
      hasSeenMessageId: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
    })
    await orchestrator.ensureTrackingSubscriptions()
    const msg = { messageId: 'dup-1', data: { id: 'n1', type: 'web_push' } }
    await getHandler()(msg)
    await getHandler()(msg)
    expect(deps.pushReceivedListener).toHaveBeenCalledTimes(1)
  })

  test('marks messageId as seen after first delivery', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOnMessage()
    await orchestrator.ensureTrackingSubscriptions()
    const msg = { messageId: 'msg-2', data: { id: 'n2', type: 'web_push' } }
    await getHandler()(msg)
    expect(deps.markMessageIdSeen).toHaveBeenCalledWith('msg-2')
  })

  test('processes messages without messageId (no dedup applied)', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOnMessage()
    await orchestrator.ensureTrackingSubscriptions()
    const msg = { data: { id: 'n3', type: 'web_push' } }
    await getHandler()(msg)
    expect(deps.pushReceivedListener).toHaveBeenCalledWith(msg)
    expect(deps.markMessageIdSeen).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// ensureTrackingSubscriptions — setBackgroundMessageHandler
// ---------------------------------------------------------------------------

describe('PushOrchestrator — setBackgroundMessageHandler callback', () => {
  function setupAndCaptureBackgroundMessage(overrides = {}) {
    const { orchestrator, deps } = makeOrchestrator(overrides)
    let capturedHandler
    deps.setBackgroundMessageHandler.mockImplementation((_msg, handler) => {
      capturedHandler = handler
    })
    return { orchestrator, deps, getHandler: () => capturedHandler }
  }

  test('calls notificationDelivered and pushBgReceivedListener for background message', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureBackgroundMessage()
    await orchestrator.ensureTrackingSubscriptions()
    const msg = { messageId: 'bg-msg-1', data: { id: 'n1', type: 'web_push' } }

    await getHandler()(msg)

    expect(deps.notificationDelivered).toHaveBeenCalledWith({
      code: 'n1',
      type: 'web_push',
    })
    expect(deps.updPushData).toHaveBeenCalledWith(msg, 'shop-1')
    expect(deps.pushBgReceivedListener).toHaveBeenCalledWith(msg)
  })

  test('deduplicates background messages by messageId', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureBackgroundMessage({
      hasSeenMessageId: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
    })
    await orchestrator.ensureTrackingSubscriptions()
    const msg = { messageId: 'bg-dup-1', data: { id: 'n1', type: 'web_push' } }

    await getHandler()(msg)
    await getHandler()(msg)

    expect(deps.pushBgReceivedListener).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// ensureTrackingSubscriptions — onNotificationOpenedApp (background click)
// ---------------------------------------------------------------------------

describe('PushOrchestrator — onNotificationOpenedApp handler', () => {
  function setupAndCaptureOpenedApp(overrides = {}) {
    const { orchestrator, deps } = makeOrchestrator(overrides)
    let capturedHandler
    deps.onNotificationOpenedApp.mockImplementation((_msg, handler) => {
      capturedHandler = handler
      return () => {}
    })
    return { orchestrator, deps, getHandler: () => capturedHandler }
  }

  test('calls pushClickListener (not pushBgReceivedListener) when app opened via notification', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOpenedApp()
    await orchestrator.ensureTrackingSubscriptions()
    const msg = { messageId: 'bg-1', data: { id: 'n1', type: 'web_push' } }
    await getHandler()(msg)
    expect(deps.pushClickListener).toHaveBeenCalledWith(msg)
    expect(deps.pushBgReceivedListener).not.toHaveBeenCalled()
  })

  test('calls updPushData before invoking click listener', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOpenedApp()
    await orchestrator.ensureTrackingSubscriptions()
    const msg = { messageId: 'bg-2', data: { id: 'n2', type: 'web_push' } }
    const callOrder = []
    deps.updPushData.mockImplementation(() => { callOrder.push('updPushData'); return Promise.resolve() })
    deps.pushClickListener.mockImplementation(() => { callOrder.push('pushClickListener'); return Promise.resolve() })
    await getHandler()(msg)
    expect(callOrder).toEqual(['updPushData', 'pushClickListener'])
  })

  test('deduplicates by messageId', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOpenedApp({
      hasSeenMessageId: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
    })
    await orchestrator.ensureTrackingSubscriptions()
    const msg = { messageId: 'dup-bg', data: {} }
    await getHandler()(msg)
    await getHandler()(msg)
    expect(deps.pushClickListener).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// ensureTrackingSubscriptions — onTokenRefresh
// ---------------------------------------------------------------------------

describe('PushOrchestrator — onTokenRefresh handler', () => {
  function setupAndCaptureTokenRefresh(overrides = {}) {
    const { orchestrator, deps } = makeOrchestrator(overrides)
    let capturedHandler
    deps.onTokenRefresh.mockImplementation((_msg, handler) => {
      capturedHandler = handler
      return () => {}
    })
    return { orchestrator, deps, getHandler: () => capturedHandler }
  }

  test('calls onNewToken when a valid refreshed token arrives', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureTokenRefresh()
    await orchestrator.ensureTrackingSubscriptions()
    getHandler()('refreshed-token-xyz')
    expect(deps.onNewToken).toHaveBeenCalledWith('refreshed-token-xyz')
  })

  test('ignores empty token on refresh', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureTokenRefresh()
    await orchestrator.ensureTrackingSubscriptions()
    getHandler()('')
    expect(deps.onNewToken).not.toHaveBeenCalled()
  })

  test('ignores null/undefined token on refresh', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureTokenRefresh()
    await orchestrator.ensureTrackingSubscriptions()
    getHandler()(null)
    getHandler()(undefined)
    expect(deps.onNewToken).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// ensureTrackingSubscriptions — notifee foreground PRESS
// ---------------------------------------------------------------------------

describe('PushOrchestrator — notifee onForegroundEvent', () => {
  function setupAndCaptureForeground(overrides = {}) {
    const { orchestrator, deps } = makeOrchestrator(overrides)
    let capturedHandler
    deps.notifee.onForegroundEvent.mockImplementation((handler) => {
      capturedHandler = handler
      return () => {}
    })
    return { orchestrator, deps, getHandler: () => capturedHandler }
  }

  const pressEvent = (data = {}) => ({
    type: 'press',
    detail: { notification: { data } },
  })

  test('calls pushClickListener directly when no custom click listener', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureForeground()
    await orchestrator.ensureTrackingSubscriptions()
    await getHandler()(pressEvent({ id: 'n1', type: 'web_push' }))
    expect(deps.pushClickListener).toHaveBeenCalledWith({ data: { id: 'n1', type: 'web_push' } })
  })

  test('fetches stored push data and passes it to custom click listener', async () => {
    const storedNotification = { id: 'stored-1', data: { id: 'n1' } }
    const { orchestrator, deps, getHandler } = setupAndCaptureForeground({
      getPushData: jest.fn().mockResolvedValue([storedNotification]),
    })
    orchestrator.setHasCustomClickListener(true)
    await orchestrator.ensureTrackingSubscriptions()
    const data = { message_id: 'msg-123', id: 'n1', type: 'web_push' }
    await getHandler()(pressEvent(data))
    expect(deps.getPushData).toHaveBeenCalledWith('msg-123', 'shop-1')
    expect(deps.pushClickListener).toHaveBeenCalledWith(storedNotification)
  })

  test('uses google.message_id fallback for custom click lookup', async () => {
    const storedNotification = { id: 'stored-google', data: { id: 'n1' } }
    const { orchestrator, deps, getHandler } = setupAndCaptureForeground({
      getPushData: jest.fn().mockResolvedValue([storedNotification]),
    })
    orchestrator.setHasCustomClickListener(true)
    await orchestrator.ensureTrackingSubscriptions()
    const data = { 'google.message_id': 'google-123', id: 'n1', type: 'web_push' }

    await getHandler()(pressEvent(data))

    expect(deps.getPushData).toHaveBeenCalledWith('google-123', 'shop-1')
    expect(deps.pushClickListener).toHaveBeenCalledWith(storedNotification)
  })

  test('uses gcm.message_id fallback for custom click lookup', async () => {
    const storedNotification = { id: 'stored-gcm', data: { id: 'n1' } }
    const { orchestrator, deps, getHandler } = setupAndCaptureForeground({
      getPushData: jest.fn().mockResolvedValue([storedNotification]),
    })
    orchestrator.setHasCustomClickListener(true)
    await orchestrator.ensureTrackingSubscriptions()
    const data = { 'gcm.message_id': 'gcm-456', id: 'n1', type: 'web_push' }

    await getHandler()(pressEvent(data))

    expect(deps.getPushData).toHaveBeenCalledWith('gcm-456', 'shop-1')
    expect(deps.pushClickListener).toHaveBeenCalledWith(storedNotification)
  })

  test('falls back to raw data when stored push data is empty', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureForeground({
      getPushData: jest.fn().mockResolvedValue([]),
    })
    orchestrator.setHasCustomClickListener(true)
    await orchestrator.ensureTrackingSubscriptions()
    const data = { message_id: 'msg-456', id: 'n1', type: 'web_push' }
    await getHandler()(pressEvent(data))
    expect(deps.pushClickListener).toHaveBeenCalledWith({ data })
  })

  test('ignores non-PRESS event types', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureForeground()
    await orchestrator.ensureTrackingSubscriptions()
    await getHandler()({ type: 'delivered', detail: { notification: { data: {} } } })
    expect(deps.pushClickListener).not.toHaveBeenCalled()
  })

  test('ignores events without notification in detail', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureForeground()
    await orchestrator.ensureTrackingSubscriptions()
    await getHandler()({ type: 'press', detail: {} })
    expect(deps.pushClickListener).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// ensureTrackingSubscriptions — notifee background PRESS
// ---------------------------------------------------------------------------

describe('PushOrchestrator — notifee onBackgroundEvent', () => {
  function setupAndCaptureBackground(overrides = {}) {
    const { orchestrator, deps } = makeOrchestrator(overrides)
    let capturedHandler
    deps.notifee.onBackgroundEvent.mockImplementation((handler) => {
      capturedHandler = handler
    })
    return { orchestrator, deps, getHandler: () => capturedHandler }
  }

  test('calls pushClickListener on PRESS event', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureBackground()
    await orchestrator.ensureTrackingSubscriptions()
    await getHandler()({ type: 'press', detail: { notification: { data: { id: 'n1' } } } })
    expect(deps.pushClickListener).toHaveBeenCalledWith({ data: { id: 'n1' } })
  })

  test('ignores non-PRESS background events', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureBackground()
    await orchestrator.ensureTrackingSubscriptions()
    await getHandler()({ type: 'delivered', detail: { notification: { data: {} } } })
    expect(deps.pushClickListener).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// ensureTrackingSubscriptions — cold-start (FCM getInitialNotification)
// ---------------------------------------------------------------------------

describe('PushOrchestrator — FCM cold-start (getInitialNotification)', () => {
  test('calls pushClickListener with FCM initial notification on cold start', async () => {
    const fcmMsg = { messageId: 'cold-1', data: { id: 'n1', type: 'web_push' } }
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
    })
    await orchestrator.ensureTrackingSubscriptions()
    expect(deps.pushClickListener).toHaveBeenCalledWith(fcmMsg)
    expect(deps.updPushData).toHaveBeenCalledWith(fcmMsg, 'shop-1')
  })

  test('skips FCM initial notification if messageId already seen', async () => {
    const fcmMsg = { messageId: 'cold-dup', data: {} }
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
      hasSeenMessageId: jest.fn().mockReturnValue(true),
    })
    await orchestrator.ensureTrackingSubscriptions()
    expect(deps.pushClickListener).not.toHaveBeenCalled()
  })

  test('handles FCM initial notification without messageId', async () => {
    const fcmMsg = { data: { id: 'n1', type: 'web_push' } }
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
    })
    await orchestrator.ensureTrackingSubscriptions()
    expect(deps.pushClickListener).toHaveBeenCalledWith(fcmMsg)
  })

  test('handles FCM initial notification with empty messageId', async () => {
    const fcmMsg = { messageId: '', data: { id: 'n-empty', type: 'web_push' } }
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
    })
    await orchestrator.ensureTrackingSubscriptions()
    expect(deps.pushClickListener).toHaveBeenCalledWith(fcmMsg)
    expect(deps.markMessageIdSeen).not.toHaveBeenCalled()
  })

  test('skips when getInitialNotification returns null', async () => {
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(null),
    })
    await orchestrator.ensureTrackingSubscriptions()
    expect(deps.pushClickListener).not.toHaveBeenCalled()
  })

  test('processes FCM cold-start only once across multiple ensureTrackingSubscriptions calls', async () => {
    const fcmMsg = { messageId: 'cold-once', data: {} }
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
    })
    await orchestrator.ensureTrackingSubscriptions()
    await orchestrator.ensureTrackingSubscriptions()
    expect(deps.getInitialNotification).toHaveBeenCalledTimes(1)
    expect(deps.pushClickListener).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// ensureTrackingSubscriptions — cold-start (notifee getInitialNotification)
// ---------------------------------------------------------------------------

describe('PushOrchestrator — notifee cold-start', () => {
  test('calls pushClickListener with notifee initial notification data', async () => {
    const { orchestrator, deps } = makeOrchestrator({
      notifee: {
        onForegroundEvent: jest.fn().mockReturnValue(() => {}),
        onBackgroundEvent: jest.fn(),
        getInitialNotification: jest.fn().mockResolvedValue({
          notification: { data: { id: 'notifee-cold-1', type: 'web_push' } },
        }),
      },
    })
    await orchestrator.ensureTrackingSubscriptions()
    expect(deps.pushClickListener).toHaveBeenCalledWith({
      data: { id: 'notifee-cold-1', type: 'web_push' },
    })
  })

  test('skips when notifee getInitialNotification returns null', async () => {
    const { orchestrator, deps } = makeOrchestrator()
    await orchestrator.ensureTrackingSubscriptions()
    expect(deps.pushClickListener).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// setHasCustomClickListener
// ---------------------------------------------------------------------------

describe('PushOrchestrator.setHasCustomClickListener', () => {
  test('sets flag to true when called with true', () => {
    const { orchestrator } = makeOrchestrator()
    orchestrator.setHasCustomClickListener(true)
    expect(orchestrator._hasCustomPushClickListener).toBe(true)
  })

  test('does not set flag when called with false', () => {
    const { orchestrator } = makeOrchestrator()
    orchestrator.setHasCustomClickListener(false)
    expect(orchestrator._hasCustomPushClickListener).toBe(false)
  })

  test('cannot unset once true (one-way flag)', () => {
    const { orchestrator } = makeOrchestrator()
    orchestrator.setHasCustomClickListener(true)
    orchestrator.setHasCustomClickListener(false)
    expect(orchestrator._hasCustomPushClickListener).toBe(true)
  })
})
