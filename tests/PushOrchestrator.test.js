import PushOrchestrator from '../lib/push/PushOrchestrator.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a fully-wired mock deps object.
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
    defaultClickListener: jest.fn().mockResolvedValue(undefined),
    defaultReceiveListener: jest.fn().mockResolvedValue(undefined),
    defaultBgReceiveListener: jest.fn().mockResolvedValue(undefined),
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
    const { orchestrator, messaging } = makeOrchestrator({
      getToken: jest.fn().mockResolvedValue(''),
    })
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const token = await orchestrator.fetchToken({ messaging, pushType: 'android', platformOS: 'android' })
    expect(token).toBeNull()
    warnSpy.mockRestore()
  })

  test('returns null when token is null', async () => {
    const { orchestrator, messaging } = makeOrchestrator({
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
// installSubscriptions — setup
// ---------------------------------------------------------------------------

describe('PushOrchestrator.installSubscriptions — subscription setup', () => {
  test('sets up all Firebase + Notifee listeners on first call', async () => {
    const { orchestrator, deps } = makeOrchestrator()
    const result = await orchestrator.installSubscriptions()
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
    await orchestrator.installSubscriptions()
    await orchestrator.installSubscriptions()
    expect(deps.onMessage).toHaveBeenCalledTimes(1)
    expect(deps.onTokenRefresh).toHaveBeenCalledTimes(1)
  })

  test('returns false and does not mark as installed when messaging is unavailable', async () => {
    const { orchestrator, deps } = makeOrchestrator({
      getMessaging: jest.fn().mockReturnValue(null),
    })
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await orchestrator.installSubscriptions()
    expect(result).toBe(false)
    expect(orchestrator._subscriptionsInstalled).toBe(false)
    expect(deps.onMessage).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  test('retries on the SAME orchestrator after messaging becomes available (regression: _installPromise stickiness)', async () => {
    const messaging = { id: 'm' }
    const getMessaging = jest
      .fn()
      .mockReturnValueOnce(null) // first call: not ready
      .mockReturnValue(messaging) // subsequent: ready
    const { orchestrator, deps } = makeOrchestrator({ getMessaging })

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await orchestrator.installSubscriptions()).toBe(false)
    expect(orchestrator._subscriptionsInstalled).toBe(false)
    expect(deps.onMessage).not.toHaveBeenCalled()

    expect(await orchestrator.installSubscriptions()).toBe(true)
    expect(orchestrator._subscriptionsInstalled).toBe(true)
    expect(deps.onMessage).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
  })

  test('deduplicates concurrent installSubscriptions calls', async () => {
    const { orchestrator, deps } = makeOrchestrator()
    const [r1, r2] = await Promise.all([
      orchestrator.installSubscriptions(),
      orchestrator.installSubscriptions(),
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
    const result = await orchestrator.installSubscriptions()
    expect(result).toBe(false)
    expect(orchestrator._subscriptionsInstalled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// onMessage handler (foreground receive)
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

  test('routes foreground message to default receive listener when no custom is set', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOnMessage()
    await orchestrator.installSubscriptions()
    const msg = { messageId: 'msg-1', data: { id: 'n1', type: 'web_push' } }
    await getHandler()(msg)
    expect(deps.notificationDelivered).toHaveBeenCalledWith({ code: 'n1', type: 'web_push' })
    expect(deps.defaultReceiveListener).toHaveBeenCalledWith(msg)
  })

  test('routes foreground message to custom receive listener when one is set via setListeners', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOnMessage()
    const customReceive = jest.fn().mockResolvedValue(undefined)
    orchestrator.setListeners({ receive: customReceive })
    await orchestrator.installSubscriptions()
    const msg = { messageId: 'msg-x', data: { id: 'n', type: 'web_push' } }
    await getHandler()(msg)
    expect(customReceive).toHaveBeenCalledWith(msg)
    expect(deps.defaultReceiveListener).not.toHaveBeenCalled()
  })

  test('deduplicates messages with same messageId', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOnMessage({
      hasSeenMessageId: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
    })
    await orchestrator.installSubscriptions()
    const msg = { messageId: 'dup-1', data: { id: 'n1', type: 'web_push' } }
    await getHandler()(msg)
    await getHandler()(msg)
    expect(deps.defaultReceiveListener).toHaveBeenCalledTimes(1)
  })

  test('marks messageId as seen after first delivery', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOnMessage()
    await orchestrator.installSubscriptions()
    const msg = { messageId: 'msg-2', data: { id: 'n2', type: 'web_push' } }
    await getHandler()(msg)
    expect(deps.markMessageIdSeen).toHaveBeenCalledWith('msg-2')
  })

  test('processes messages without messageId (no dedup applied)', async () => {
    const { orchestrator, deps, getHandler } = setupAndCaptureOnMessage()
    await orchestrator.installSubscriptions()
    const msg = { data: { id: 'n3', type: 'web_push' } }
    await getHandler()(msg)
    expect(deps.defaultReceiveListener).toHaveBeenCalledWith(msg)
    expect(deps.markMessageIdSeen).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// setBackgroundMessageHandler callback
// ---------------------------------------------------------------------------

describe('PushOrchestrator — setBackgroundMessageHandler callback', () => {
  function setupAndCapture(overrides = {}) {
    const { orchestrator, deps } = makeOrchestrator(overrides)
    let capturedHandler
    deps.setBackgroundMessageHandler.mockImplementation((_msg, handler) => {
      capturedHandler = handler
    })
    return { orchestrator, deps, getHandler: () => capturedHandler }
  }

  test('routes background message to default bg-receive listener when no custom is set', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    await orchestrator.installSubscriptions()
    const msg = { messageId: 'bg-msg-1', data: { id: 'n1', type: 'web_push' } }

    await getHandler()(msg)

    expect(deps.notificationDelivered).toHaveBeenCalledWith({ code: 'n1', type: 'web_push' })
    expect(deps.updPushData).toHaveBeenCalledWith(msg, 'shop-1')
    expect(deps.defaultBgReceiveListener).toHaveBeenCalledWith(msg)
  })

  test('routes background message to custom bg-receive listener when one is set', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    const customBgReceive = jest.fn().mockResolvedValue(undefined)
    orchestrator.setListeners({ bgReceive: customBgReceive })
    await orchestrator.installSubscriptions()
    const msg = { messageId: 'bg-x', data: { id: 'n', type: 'web_push' } }

    await getHandler()(msg)

    expect(customBgReceive).toHaveBeenCalledWith(msg)
    expect(deps.defaultBgReceiveListener).not.toHaveBeenCalled()
  })

  test('deduplicates background messages by messageId', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture({
      hasSeenMessageId: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
    })
    await orchestrator.installSubscriptions()
    const msg = { messageId: 'bg-dup-1', data: { id: 'n1', type: 'web_push' } }

    await getHandler()(msg)
    await getHandler()(msg)

    expect(deps.defaultBgReceiveListener).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// onNotificationOpenedApp handler (background → foreground click)
// ---------------------------------------------------------------------------

describe('PushOrchestrator — onNotificationOpenedApp handler', () => {
  function setupAndCapture(overrides = {}) {
    const { orchestrator, deps } = makeOrchestrator(overrides)
    let capturedHandler
    deps.onNotificationOpenedApp.mockImplementation((_msg, handler) => {
      capturedHandler = handler
      return () => {}
    })
    return { orchestrator, deps, getHandler: () => capturedHandler }
  }

  test('routes click to default click listener (not bg-receive) when no custom is set', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    await orchestrator.installSubscriptions()
    const msg = { messageId: 'bg-1', data: { id: 'n1', type: 'web_push' } }
    await getHandler()(msg)
    expect(deps.defaultClickListener).toHaveBeenCalledWith(msg)
    expect(deps.defaultBgReceiveListener).not.toHaveBeenCalled()
  })

  test('routes click to custom click listener when one is set', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    const customClick = jest.fn().mockResolvedValue(undefined)
    orchestrator.setListeners({ click: customClick })
    await orchestrator.installSubscriptions()
    const msg = { messageId: 'cust-1', data: { id: 'n', type: 'web_push' } }
    await getHandler()(msg)
    expect(customClick).toHaveBeenCalledWith(msg)
    expect(deps.defaultClickListener).not.toHaveBeenCalled()
  })

  test('calls updPushData before invoking click listener', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    await orchestrator.installSubscriptions()
    const msg = { messageId: 'bg-2', data: { id: 'n2', type: 'web_push' } }
    const callOrder = []
    deps.updPushData.mockImplementation(() => { callOrder.push('updPushData'); return Promise.resolve() })
    deps.defaultClickListener.mockImplementation(() => { callOrder.push('clickListener'); return Promise.resolve() })
    await getHandler()(msg)
    expect(callOrder).toEqual(['updPushData', 'clickListener'])
  })

  test('deduplicates by messageId', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture({
      hasSeenMessageId: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
    })
    await orchestrator.installSubscriptions()
    const msg = { messageId: 'dup-bg', data: {} }
    await getHandler()(msg)
    await getHandler()(msg)
    expect(deps.defaultClickListener).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// onTokenRefresh handler
// ---------------------------------------------------------------------------

describe('PushOrchestrator — onTokenRefresh handler', () => {
  function setupAndCapture(overrides = {}) {
    const { orchestrator, deps } = makeOrchestrator(overrides)
    let capturedHandler
    deps.onTokenRefresh.mockImplementation((_msg, handler) => {
      capturedHandler = handler
      return () => {}
    })
    return { orchestrator, deps, getHandler: () => capturedHandler }
  }

  test('calls onNewToken when a valid refreshed token arrives', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    await orchestrator.installSubscriptions()
    getHandler()('refreshed-token-xyz')
    expect(deps.onNewToken).toHaveBeenCalledWith('refreshed-token-xyz')
  })

  test('ignores empty token on refresh', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    await orchestrator.installSubscriptions()
    getHandler()('')
    expect(deps.onNewToken).not.toHaveBeenCalled()
  })

  test('ignores null/undefined token on refresh', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    await orchestrator.installSubscriptions()
    getHandler()(null)
    getHandler()(undefined)
    expect(deps.onNewToken).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Notifee onForegroundEvent
// ---------------------------------------------------------------------------

describe('PushOrchestrator — notifee onForegroundEvent', () => {
  function setupAndCapture(overrides = {}) {
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

  test('calls default click listener with raw { data } when no custom click is set', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    await orchestrator.installSubscriptions()
    await getHandler()(pressEvent({ id: 'n1', type: 'web_push' }))
    expect(deps.defaultClickListener).toHaveBeenCalledWith({ data: { id: 'n1', type: 'web_push' } })
  })

  test('fetches stored push data and passes it to custom click listener', async () => {
    const storedNotification = { id: 'stored-1', data: { id: 'n1' } }
    const { orchestrator, deps, getHandler } = setupAndCapture({
      getPushData: jest.fn().mockResolvedValue([storedNotification]),
    })
    const customClick = jest.fn().mockResolvedValue(undefined)
    orchestrator.setListeners({ click: customClick })
    await orchestrator.installSubscriptions()
    const data = { message_id: 'msg-123', id: 'n1', type: 'web_push' }
    await getHandler()(pressEvent(data))
    expect(deps.getPushData).toHaveBeenCalledWith('msg-123', 'shop-1')
    expect(customClick).toHaveBeenCalledWith(storedNotification)
  })

  test('uses google.message_id fallback for custom click lookup', async () => {
    const storedNotification = { id: 'stored-google', data: { id: 'n1' } }
    const { orchestrator, deps, getHandler } = setupAndCapture({
      getPushData: jest.fn().mockResolvedValue([storedNotification]),
    })
    const customClick = jest.fn().mockResolvedValue(undefined)
    orchestrator.setListeners({ click: customClick })
    await orchestrator.installSubscriptions()
    const data = { 'google.message_id': 'google-123', id: 'n1', type: 'web_push' }

    await getHandler()(pressEvent(data))

    expect(deps.getPushData).toHaveBeenCalledWith('google-123', 'shop-1')
    expect(customClick).toHaveBeenCalledWith(storedNotification)
  })

  test('uses gcm.message_id fallback for custom click lookup', async () => {
    const storedNotification = { id: 'stored-gcm', data: { id: 'n1' } }
    const { orchestrator, deps, getHandler } = setupAndCapture({
      getPushData: jest.fn().mockResolvedValue([storedNotification]),
    })
    const customClick = jest.fn().mockResolvedValue(undefined)
    orchestrator.setListeners({ click: customClick })
    await orchestrator.installSubscriptions()
    const data = { 'gcm.message_id': 'gcm-456', id: 'n1', type: 'web_push' }

    await getHandler()(pressEvent(data))

    expect(deps.getPushData).toHaveBeenCalledWith('gcm-456', 'shop-1')
    expect(customClick).toHaveBeenCalledWith(storedNotification)
  })

  test('falls back to raw { data } when stored push data is empty', async () => {
    const { orchestrator, getHandler } = setupAndCapture({
      getPushData: jest.fn().mockResolvedValue([]),
    })
    const customClick = jest.fn().mockResolvedValue(undefined)
    orchestrator.setListeners({ click: customClick })
    await orchestrator.installSubscriptions()
    const data = { message_id: 'msg-456', id: 'n1', type: 'web_push' }
    await getHandler()(pressEvent(data))
    expect(customClick).toHaveBeenCalledWith({ data })
  })

  test('ignores non-PRESS event types', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    await orchestrator.installSubscriptions()
    await getHandler()({ type: 'delivered', detail: { notification: { data: {} } } })
    expect(deps.defaultClickListener).not.toHaveBeenCalled()
  })

  test('ignores events without notification in detail', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    await orchestrator.installSubscriptions()
    await getHandler()({ type: 'press', detail: {} })
    expect(deps.defaultClickListener).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Notifee onBackgroundEvent
// ---------------------------------------------------------------------------

describe('PushOrchestrator — notifee onBackgroundEvent', () => {
  function setupAndCapture(overrides = {}) {
    const { orchestrator, deps } = makeOrchestrator(overrides)
    let capturedHandler
    deps.notifee.onBackgroundEvent.mockImplementation((handler) => {
      capturedHandler = handler
    })
    return { orchestrator, deps, getHandler: () => capturedHandler }
  }

  test('calls default click listener on PRESS event', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    await orchestrator.installSubscriptions()
    await getHandler()({ type: 'press', detail: { notification: { data: { id: 'n1' } } } })
    expect(deps.defaultClickListener).toHaveBeenCalledWith({ data: { id: 'n1' } })
  })

  test('routes to custom click listener when set', async () => {
    const { orchestrator, getHandler } = setupAndCapture()
    const customClick = jest.fn().mockResolvedValue(undefined)
    orchestrator.setListeners({ click: customClick })
    await orchestrator.installSubscriptions()
    await getHandler()({ type: 'press', detail: { notification: { data: { id: 'n2' } } } })
    expect(customClick).toHaveBeenCalledWith({ data: { id: 'n2' } })
  })

  test('ignores non-PRESS background events', async () => {
    const { orchestrator, deps, getHandler } = setupAndCapture()
    await orchestrator.installSubscriptions()
    await getHandler()({ type: 'delivered', detail: { notification: { data: {} } } })
    expect(deps.defaultClickListener).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Cold-start (FCM getInitialNotification)
// ---------------------------------------------------------------------------

describe('PushOrchestrator — FCM cold-start (getInitialNotification)', () => {
  test('calls click listener with FCM initial notification on cold start', async () => {
    const fcmMsg = { messageId: 'cold-1', data: { id: 'n1', type: 'web_push' } }
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
    })
    await orchestrator.installSubscriptions()
    expect(deps.defaultClickListener).toHaveBeenCalledWith(fcmMsg)
    expect(deps.updPushData).toHaveBeenCalledWith(fcmMsg, 'shop-1')
  })

  test('skips FCM initial notification if messageId already seen', async () => {
    const fcmMsg = { messageId: 'cold-dup', data: {} }
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
      hasSeenMessageId: jest.fn().mockReturnValue(true),
    })
    await orchestrator.installSubscriptions()
    expect(deps.defaultClickListener).not.toHaveBeenCalled()
  })

  test('handles FCM initial notification without messageId', async () => {
    const fcmMsg = { data: { id: 'n1', type: 'web_push' } }
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
    })
    await orchestrator.installSubscriptions()
    expect(deps.defaultClickListener).toHaveBeenCalledWith(fcmMsg)
  })

  test('handles FCM initial notification with empty messageId', async () => {
    const fcmMsg = { messageId: '', data: { id: 'n-empty', type: 'web_push' } }
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
    })
    await orchestrator.installSubscriptions()
    expect(deps.defaultClickListener).toHaveBeenCalledWith(fcmMsg)
    expect(deps.markMessageIdSeen).not.toHaveBeenCalled()
  })

  test('skips when getInitialNotification returns null', async () => {
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(null),
    })
    await orchestrator.installSubscriptions()
    expect(deps.defaultClickListener).not.toHaveBeenCalled()
    orchestrator._cancelColdStartRetry()
  })

  test('processes FCM cold-start only once across multiple installSubscriptions calls', async () => {
    const fcmMsg = { messageId: 'cold-once', data: {} }
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
    })
    await orchestrator.installSubscriptions()
    await orchestrator.installSubscriptions()
    expect(deps.getInitialNotification).toHaveBeenCalledTimes(1)
    expect(deps.defaultClickListener).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// FCM cold-start — deferred-native-intent recheck
//
// Some Android builds expose the launch intent's initial notification only
// after JS has already called getInitialNotification once. The orchestrator
// schedules a single deferred recheck (via InteractionManager + 5s safety
// timeout) that avoids contending with init-time UI work.
// ---------------------------------------------------------------------------

describe('PushOrchestrator — FCM cold-start recheck (deferred native intent)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('consumes cold-start that becomes available on the deferred recheck', async () => {
    const fcmMsg = { messageId: 'cold-late', data: { id: 'n-late', type: 'bulk' } }
    const getInitialNotification = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(fcmMsg)
    const { orchestrator, deps } = makeOrchestrator({ getInitialNotification })

    await orchestrator.installSubscriptions()
    expect(deps.defaultClickListener).not.toHaveBeenCalled()
    expect(orchestrator._lastColdStart).toBeNull()

    // InteractionManager.runAfterInteractions fires on the next event-loop tick
    // in the react-native preset's mock. The safety 5s timer is a no-op here.
    await jest.advanceTimersByTimeAsync(50)

    expect(getInitialNotification).toHaveBeenCalledTimes(2)
    expect(deps.defaultClickListener).toHaveBeenCalledWith(fcmMsg)
    expect(orchestrator._lastColdStart).toBe(fcmMsg)
  })

  test('replays buffered cold-start through host click listener registered before recheck fires', async () => {
    const fcmMsg = { messageId: 'cold-late-2', data: { id: 'n-late-2' } }
    const getInitialNotification = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(fcmMsg)
    const { orchestrator, deps } = makeOrchestrator({ getInitialNotification })

    await orchestrator.installSubscriptions()
    const hostClick = jest.fn()
    orchestrator.setListeners({ click: hostClick })

    await jest.advanceTimersByTimeAsync(50)

    expect(hostClick).toHaveBeenCalledWith(fcmMsg)
    expect(deps.defaultClickListener).not.toHaveBeenCalled()
  })

  test('runs exactly one deferred recheck when initial notification never appears', async () => {
    const getInitialNotification = jest.fn().mockResolvedValue(null)
    const { orchestrator, deps } = makeOrchestrator({ getInitialNotification })

    await orchestrator.installSubscriptions()
    // InteractionManager-driven recheck runs first (immediately in tests)
    await jest.advanceTimersByTimeAsync(50)
    // Safety 10s timeout fires next, but is no-op because recheck already ran
    await jest.advanceTimersByTimeAsync(5500)

    expect(getInitialNotification).toHaveBeenCalledTimes(2) // install + 1 recheck
    expect(deps.defaultClickListener).not.toHaveBeenCalled()
  })

  test('safety timeout fires recheck if InteractionManager is unavailable', async () => {
    // Simulate environment without InteractionManager by spying on the global
    // and forcing the safety timeout to be the only path.
    const RN = require('react-native')
    const original = RN.InteractionManager.runAfterInteractions
    RN.InteractionManager.runAfterInteractions = undefined

    try {
      const fcmMsg = { messageId: 'cold-fallback', data: {} }
      const getInitialNotification = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(fcmMsg)
      const { orchestrator, deps } = makeOrchestrator({ getInitialNotification })

      await orchestrator.installSubscriptions()
      // InteractionManager path skipped — only safety 5s timer remains
      await jest.advanceTimersByTimeAsync(50)
      expect(getInitialNotification).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(5000)
      expect(getInitialNotification).toHaveBeenCalledTimes(2)
      expect(deps.defaultClickListener).toHaveBeenCalledWith(fcmMsg)
    } finally {
      RN.InteractionManager.runAfterInteractions = original
    }
  })

  test('stops re-checking once a cold-start has been consumed', async () => {
    const fcmMsg = { messageId: 'cold-stop', data: {} }
    const getInitialNotification = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(fcmMsg)
      .mockResolvedValue(fcmMsg)
    const { orchestrator, deps } = makeOrchestrator({ getInitialNotification })

    await orchestrator.installSubscriptions()
    await jest.advanceTimersByTimeAsync(50)
    expect(deps.defaultClickListener).toHaveBeenCalledTimes(1)

    // Safety 10s timeout would fire, but recheckRan flag prevents double-poll
    await jest.advanceTimersByTimeAsync(5500)
    expect(deps.defaultClickListener).toHaveBeenCalledTimes(1)
    expect(getInitialNotification).toHaveBeenCalledTimes(2)
  })

  test('skips recheck when a different path (e.g. notifee cold-start) already set _lastColdStart', async () => {
    const getInitialNotification = jest.fn().mockResolvedValue(null)
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification,
      notifee: {
        onForegroundEvent: jest.fn().mockReturnValue(() => {}),
        onBackgroundEvent: jest.fn(),
        getInitialNotification: jest.fn().mockResolvedValue({
          notification: { data: { id: 'notifee-x' } },
        }),
      },
    })

    await orchestrator.installSubscriptions()
    expect(orchestrator._lastColdStart).toEqual({ data: { id: 'notifee-x' } })

    // InteractionManager-driven recheck observes _lastColdStart and exits
    await jest.advanceTimersByTimeAsync(50)
    expect(getInitialNotification).toHaveBeenCalledTimes(1)
  })

  test('does not schedule retry when FCM returns a payload on first call', async () => {
    const fcmMsg = { messageId: 'cold-fast', data: {} }
    const getInitialNotification = jest.fn().mockResolvedValue(fcmMsg)
    const { orchestrator } = makeOrchestrator({ getInitialNotification })

    await orchestrator.installSubscriptions()
    await jest.advanceTimersByTimeAsync(300)
    await jest.advanceTimersByTimeAsync(600)
    await jest.advanceTimersByTimeAsync(1200)

    expect(getInitialNotification).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Cold-start (Notifee getInitialNotification)
// ---------------------------------------------------------------------------

describe('PushOrchestrator — notifee cold-start', () => {
  test('calls click listener with notifee initial notification data', async () => {
    const { orchestrator, deps } = makeOrchestrator({
      notifee: {
        onForegroundEvent: jest.fn().mockReturnValue(() => {}),
        onBackgroundEvent: jest.fn(),
        getInitialNotification: jest.fn().mockResolvedValue({
          notification: { data: { id: 'notifee-cold-1', type: 'web_push' } },
        }),
      },
    })
    await orchestrator.installSubscriptions()
    expect(deps.defaultClickListener).toHaveBeenCalledWith({
      data: { id: 'notifee-cold-1', type: 'web_push' },
    })
  })

  test('skips when notifee getInitialNotification returns null', async () => {
    const { orchestrator, deps } = makeOrchestrator()
    await orchestrator.installSubscriptions()
    expect(deps.defaultClickListener).not.toHaveBeenCalled()
    orchestrator._cancelColdStartRetry()
  })
})

// ---------------------------------------------------------------------------
// setListeners + cold-start replay
// ---------------------------------------------------------------------------

describe('PushOrchestrator.setListeners', () => {
  test('stores listeners on the orchestrator', () => {
    const { orchestrator } = makeOrchestrator()
    const click = jest.fn()
    const receive = jest.fn()
    const bgReceive = jest.fn()
    orchestrator.setListeners({ click, receive, bgReceive })
    expect(orchestrator._clickListener).toBe(click)
    expect(orchestrator._receiveListener).toBe(receive)
    expect(orchestrator._bgReceiveListener).toBe(bgReceive)
  })

  test('falsy values do not overwrite previously-set listeners', () => {
    const { orchestrator } = makeOrchestrator()
    const click = jest.fn()
    orchestrator.setListeners({ click })
    orchestrator.setListeners({ click: false, receive: undefined })
    expect(orchestrator._clickListener).toBe(click)
  })

  test('replays buffered cold-start when a click listener is registered after default consumed it', async () => {
    const fcmMsg = { messageId: 'replay-cold', data: { id: 'n', type: 'web_push' } }
    const { orchestrator, deps } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
    })
    // No custom click → cold-start goes to default and is buffered
    await orchestrator.installSubscriptions()
    expect(deps.defaultClickListener).toHaveBeenCalledWith(fcmMsg)

    // Late registration: the buffered payload is replayed through the new click
    const customClick = jest.fn()
    orchestrator.setListeners({ click: customClick })
    // Replay is fired via Promise.resolve().then — flush microtasks
    await new Promise((resolve) => setImmediate(resolve))
    expect(customClick).toHaveBeenCalledWith(fcmMsg)
  })

  test('replays only once even if setListeners is called repeatedly', async () => {
    const fcmMsg = { messageId: 'replay-once', data: {} }
    const { orchestrator } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
    })
    await orchestrator.installSubscriptions()

    const click1 = jest.fn()
    orchestrator.setListeners({ click: click1 })
    await new Promise((resolve) => setImmediate(resolve))
    expect(click1).toHaveBeenCalledTimes(1)

    const click2 = jest.fn()
    orchestrator.setListeners({ click: click2 })
    await new Promise((resolve) => setImmediate(resolve))
    // No replay — already replayed once
    expect(click2).not.toHaveBeenCalled()
  })

  test('does NOT replay when click listener was already set BEFORE cold-start consumption', async () => {
    const fcmMsg = { messageId: 'no-replay', data: {} }
    const { orchestrator } = makeOrchestrator({
      getInitialNotification: jest.fn().mockResolvedValue(fcmMsg),
    })
    const customClick = jest.fn()
    orchestrator.setListeners({ click: customClick })
    await orchestrator.installSubscriptions()
    // Cold-start went directly to customClick; no replay
    expect(customClick).toHaveBeenCalledTimes(1)
  })
})
