import router, { PENDING_EVENTS_WAIT_MS } from '../lib/push/PushRouter.js'
import registry from '../lib/registry/SdkRegistry.js'
import { registerShops, reset as resetFacade } from '../lib/facade/facade.js'
import { trackPush } from '../lib/push/trackPush.js'
import displayPush from '../lib/push/displayPush.js'

// A pending shop has no instance/orchestrator, so the router handles its push standalone (track +
// display). Mock those so the assertions don't need a real firebase/notifee/network stack.
jest.mock('../lib/push/trackPush.js', () => ({ trackPush: jest.fn() }))
jest.mock('../lib/push/displayPush.js', () => {
  const fn = jest.fn().mockResolvedValue(undefined)
  return { __esModule: true, default: fn, displayPush: fn }
})

// Process-global push router (Release 4, RN-13). Fake orchestrators (registered via the SdkRegistry)
// capture which instance each event reaches, so install-once + routing-by-shop_id + the drop rules
// are pinned without a real firebase/notifee stack. Mirror of the Android/iOS push routing tests.

function makeGlobalDeps() {
  const captured = {}
  const messaging = { id: 'messaging' }
  const deps = {
    getMessaging: jest.fn().mockReturnValue(messaging),
    onMessage: jest.fn((_m, cb) => {
      captured.onMessage = cb
      return () => {}
    }),
    setBackgroundMessageHandler: jest.fn((_m, cb) => {
      captured.bg = cb
    }),
    onNotificationOpenedApp: jest.fn((_m, cb) => {
      captured.click = cb
      return () => {}
    }),
    onTokenRefresh: jest.fn((_m, cb) => {
      captured.tokenRefresh = cb
      return () => {}
    }),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    notifee: {
      onForegroundEvent: jest.fn((cb) => {
        captured.notifeeFg = cb
        return () => {}
      }),
      onBackgroundEvent: jest.fn((cb) => {
        captured.notifeeBg = cb
      }),
      getInitialNotification: jest.fn().mockResolvedValue(null),
    },
    isDebug: jest.fn().mockReturnValue(false),
  }
  return { deps, captured, messaging }
}

function fakeOrchestrator() {
  return {
    _handleForegroundMessage: jest.fn(),
    _handleBackgroundMessage: jest.fn(),
    _handleClickEvent: jest.fn(),
    _handleTokenRefresh: jest.fn(),
    _handleNotifeeForeground: jest.fn(),
    _handleNotifeeBackground: jest.fn(),
    _processFcmColdStart: jest.fn().mockResolvedValue(undefined),
    _processNotifeeColdStart: jest.fn().mockResolvedValue(undefined),
  }
}

function registerShop(shopId) {
  const orchestrator = fakeOrchestrator()
  registry.register(shopId, { shop_id: shopId, _pushOrchestrator: orchestrator })
  return orchestrator
}

const fcm = (shopId, id = '10', type = 'web') => ({ messageId: `m-${id}`, data: { shop_id: shopId, id, type } })
const notifeeEvent = (shopId) => ({ type: 'press', detail: { notification: { data: { shop_id: shopId } } } })

beforeEach(() => {
  registry.reset()
  router.reset()
  resetFacade()
  trackPush.mockClear()
  displayPush.mockClear()
})

describe('PushRouter.ensureInstalled — install once', () => {
  test('installs the global handlers exactly once, even across instances', async () => {
    const { deps } = makeGlobalDeps()
    const notifeeRegistration = deps.notifee.onBackgroundEvent
    registerShop('shop-a')

    expect(await router.ensureInstalled(deps)).toBe(true)
    // A second instance calling ensureInstalled (even with a different deps object) is a no-op.
    const { deps: deps2 } = makeGlobalDeps()
    expect(await router.ensureInstalled(deps2)).toBe(true)

    expect(deps.onMessage).toHaveBeenCalledTimes(1)
    expect(deps.setBackgroundMessageHandler).toHaveBeenCalledTimes(1)
    expect(deps.onNotificationOpenedApp).toHaveBeenCalledTimes(1)
    expect(deps.onTokenRefresh).toHaveBeenCalledTimes(1)
    expect(deps.notifee.onForegroundEvent).toHaveBeenCalledTimes(1)
    // Notifee's own registration: the SDK wraps the property to keep an app's handler beside its own.
    expect(notifeeRegistration).toHaveBeenCalledTimes(1)
    expect(deps2.onMessage).not.toHaveBeenCalled()
  })

  test('returns false without installing when messaging is unavailable', async () => {
    const { deps } = makeGlobalDeps()
    deps.getMessaging.mockReturnValue(null)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await router.ensureInstalled(deps)).toBe(false)
    expect(router._installed).toBe(false)
    expect(deps.onMessage).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('PushRouter — routing by shop_id', () => {
  test('a foreground message reaches only the instance its shop_id names', async () => {
    const { deps, captured } = makeGlobalDeps()
    const a = registerShop('shop-a')
    const b = registerShop('shop-b')
    await router.ensureInstalled(deps)

    captured.onMessage(fcm('shop-b'))

    expect(b._handleForegroundMessage).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ shop_id: 'shop-b' }) }), 'shop-b')
    expect(a._handleForegroundMessage).not.toHaveBeenCalled()
  })

  test('background and click events route by shop_id too', async () => {
    const { deps, captured } = makeGlobalDeps()
    const a = registerShop('shop-a')
    const b = registerShop('shop-b')
    await router.ensureInstalled(deps)

    captured.bg(fcm('shop-a'))
    captured.click(fcm('shop-b'))

    expect(a._handleBackgroundMessage).toHaveBeenCalledWith(expect.anything(), 'shop-a')
    expect(b._handleBackgroundMessage).not.toHaveBeenCalled()
    expect(b._handleClickEvent).toHaveBeenCalledWith(expect.anything(), 'shop-b')
    expect(a._handleClickEvent).not.toHaveBeenCalled()
  })

  test('notifee foreground/background events route by shop_id', async () => {
    const { deps, captured } = makeGlobalDeps()
    const a = registerShop('shop-a')
    const b = registerShop('shop-b')
    await router.ensureInstalled(deps)

    captured.notifeeFg(notifeeEvent('shop-a'))
    captured.notifeeBg(notifeeEvent('shop-b'))

    expect(a._handleNotifeeForeground).toHaveBeenCalledWith(expect.anything(), 'shop-a')
    expect(b._handleNotifeeForeground).not.toHaveBeenCalled()
    expect(b._handleNotifeeBackground).toHaveBeenCalled()
    expect(a._handleNotifeeBackground).not.toHaveBeenCalled()
  })
})

describe('PushRouter — drop rules and fallback', () => {
  test('a message for an unknown shop is dropped', async () => {
    const { deps, captured } = makeGlobalDeps()
    const a = registerShop('shop-a')
    await router.ensureInstalled(deps)

    captured.onMessage(fcm('shop-x'))

    expect(a._handleForegroundMessage).not.toHaveBeenCalled()
  })

  test('no shop_id while several shops are live drops the message', async () => {
    const { deps, captured } = makeGlobalDeps()
    const a = registerShop('shop-a')
    const b = registerShop('shop-b')
    await router.ensureInstalled(deps)

    captured.onMessage({ data: { id: '1' } }) // no shop_id

    expect(a._handleForegroundMessage).not.toHaveBeenCalled()
    expect(b._handleForegroundMessage).not.toHaveBeenCalled()
  })

  test('no shop_id with a single live shop falls back to it', async () => {
    const { deps, captured } = makeGlobalDeps()
    const a = registerShop('shop-a')
    await router.ensureInstalled(deps)

    captured.onMessage({ data: { id: '1', type: 'web' } }) // no shop_id, single shop

    expect(a._handleForegroundMessage).toHaveBeenCalledWith(expect.anything(), 'shop-a')
  })
})

describe('PushRouter — token refresh fan-out', () => {
  test('a refreshed token is delivered to every live instance', async () => {
    const { deps, captured } = makeGlobalDeps()
    const a = registerShop('shop-a')
    const b = registerShop('shop-b')
    await router.ensureInstalled(deps)

    captured.tokenRefresh('new-token')

    expect(a._handleTokenRefresh).toHaveBeenCalledWith('new-token')
    expect(b._handleTokenRefresh).toHaveBeenCalledWith('new-token')
  })

  test('an empty token is ignored', async () => {
    const { deps, captured } = makeGlobalDeps()
    const a = registerShop('shop-a')
    await router.ensureInstalled(deps)

    captured.tokenRefresh('')

    expect(a._handleTokenRefresh).not.toHaveBeenCalled()
  })
})

describe('PushRouter — cold start routing', () => {
  test('an FCM cold-start is routed to the instance its shop_id names', async () => {
    const { deps } = makeGlobalDeps()
    const a = registerShop('shop-a')
    const b = registerShop('shop-b')
    const coldStart = fcm('shop-b', 'cold')
    deps.getInitialNotification.mockResolvedValue(coldStart)

    await router.ensureInstalled(deps)

    expect(b._processFcmColdStart).toHaveBeenCalledWith(coldStart, 'shop-b')
    expect(a._processFcmColdStart).not.toHaveBeenCalled()
  })

  test('a notifee cold-start is routed by shop_id', async () => {
    const { deps } = makeGlobalDeps()
    const a = registerShop('shop-a')
    const b = registerShop('shop-b')
    deps.notifee.getInitialNotification.mockResolvedValue({
      notification: { data: { shop_id: 'shop-a' } },
    })

    await router.ensureInstalled(deps)

    expect(a._processNotifeeColdStart).toHaveBeenCalledWith({ data: { shop_id: 'shop-a' } })
    expect(b._processNotifeeColdStart).not.toHaveBeenCalled()
  })

  test('an FCM cold-start for an unknown shop is dropped', async () => {
    const { deps } = makeGlobalDeps()
    const a = registerShop('shop-a')
    deps.getInitialNotification.mockResolvedValue(fcm('shop-x', 'cold'))

    await router.ensureInstalled(deps)

    expect(a._processFcmColdStart).not.toHaveBeenCalled()
  })
})

describe('PushRouter — a registered-but-pending shop is handled without init (not dropped)', () => {
  test('a message for a pending shop is tracked and displayed standalone, no orchestrator', async () => {
    registerShops([{ shopId: 'shop-lazy', stream: 'android' }]) // pending — no instance/orchestrator
    const { deps, captured } = makeGlobalDeps()
    registerShop('shop-a') // a live shop so the router installs its handlers
    await router.ensureInstalled(deps)

    await captured.onMessage(fcm('shop-lazy'))

    expect(trackPush).toHaveBeenCalledWith(
      'shop-lazy',
      'delivered',
      expect.objectContaining({ code: '10', type: 'web', stream: 'android' }),
    )
    expect(displayPush).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ shop_id: 'shop-lazy' }) }),
    )
  })

  test('a pending shop\'s push is drawn at once, before its delivered event is answered; opened follows delivered', async () => {
    registerShops([{ shopId: 'shop-lazy', stream: 'android' }])
    const { deps, captured } = makeGlobalDeps()
    registerShop('shop-a')
    await router.ensureInstalled(deps)
    let answerDelivered
    trackPush.mockImplementation((shopId, event) => (event === 'delivered'
      ? new Promise((resolve) => { answerDelivered = resolve })
      : Promise.resolve({ status: 'success' })))
    const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

    const handled = captured.bg(fcm('shop-lazy'))
    await flush()

    expect(displayPush).toHaveBeenCalledTimes(1)
    expect(trackPush.mock.calls.map(([, event]) => event)).toEqual(['delivered'])

    answerDelivered({ status: 'success' })
    await handled
    expect(trackPush.mock.calls.map(([, event]) => event)).toEqual(['delivered', 'opened'])
    trackPush.mockReset()
  })

  test('a delivered event that hangs holds the headless task at most PENDING_EVENTS_WAIT_MS', async () => {
    jest.useFakeTimers()
    try {
      registerShops([{ shopId: 'shop-lazy', stream: 'android' }])
      const { deps, captured } = makeGlobalDeps()
      registerShop('shop-a')
      await router.ensureInstalled(deps)
      trackPush.mockImplementation(() => new Promise(() => {}))
      let done = false

      const handled = captured.bg(fcm('shop-lazy')).then(() => { done = true })
      for (let i = 0; i < 20; i++) await Promise.resolve()
      expect(displayPush).toHaveBeenCalledTimes(1)
      expect(done).toBe(false)

      jest.advanceTimersByTime(PENDING_EVENTS_WAIT_MS)
      await handled
      expect(done).toBe(true)
      // Opened waits for delivered: it has not gone.
      expect(trackPush.mock.calls.map(([, event]) => event)).toEqual(['delivered'])
    } finally {
      trackPush.mockReset()
      jest.useRealTimers()
    }
  })

  test('a background message for a pending shop is also tracked and displayed', async () => {
    registerShops([{ shopId: 'shop-lazy', stream: 'android' }])
    const { deps, captured } = makeGlobalDeps()
    registerShop('shop-a')
    await router.ensureInstalled(deps)

    await captured.bg(fcm('shop-lazy'))

    expect(trackPush).toHaveBeenCalledWith('shop-lazy', 'delivered', expect.anything())
    expect(displayPush).toHaveBeenCalled()
  })

  test('a click on a pending shop is tracked (navigation stays with the host)', async () => {
    registerShops([{ shopId: 'shop-lazy', stream: 'android' }])
    const { deps, captured } = makeGlobalDeps()
    registerShop('shop-a')
    await router.ensureInstalled(deps)

    await captured.click(fcm('shop-lazy'))

    expect(trackPush).toHaveBeenCalledWith(
      'shop-lazy',
      'clicked',
      expect.objectContaining({ code: '10', type: 'web', stream: 'android' }),
    )
  })
})

describe('PushRouter — a dismissed notification is closed', () => {
  const dismissed = (shopId) => ({ type: 'dismissed', detail: { notification: { data: { shop_id: shopId, id: '11', type: 'bulk' } } } })

  test('a live shop hears it through its orchestrator, in the foreground and the background', async () => {
    const { deps, captured } = makeGlobalDeps()
    deps.EventType = { PRESS: 'press', DISMISSED: 'dismissed' }
    const a = { ...fakeOrchestrator(), _handleNotifeeDismissed: jest.fn() }
    registry.register('shop-a', { shop_id: 'shop-a', _pushOrchestrator: a })
    await router.ensureInstalled(deps)

    await captured.notifeeFg(dismissed('shop-a'))
    await captured.notifeeBg(dismissed('shop-a'))

    expect(a._handleNotifeeDismissed).toHaveBeenCalledTimes(2)
    expect(a._handleNotifeeForeground).not.toHaveBeenCalled()
  })

  test('a pending shop gets closed without an instance', async () => {
    registerShops([{ shopId: 'shop-lazy', stream: 'android' }])
    const { deps, captured } = makeGlobalDeps()
    deps.EventType = { PRESS: 'press', DISMISSED: 'dismissed' }
    registerShop('shop-a')
    await router.ensureInstalled(deps)

    await captured.notifeeBg(dismissed('shop-lazy'))

    expect(trackPush).toHaveBeenCalledWith('shop-lazy', 'closed', expect.objectContaining({ code: '11', type: 'bulk', stream: 'android' }))
  })
})

describe('PushRouter — the SDK\'s own background handler, set at import', () => {
  test('a push that starts the process is drawn and tracked for a shop registered at module scope', async () => {
    registerShops([{ shopId: 'shop-lazy', stream: 'android' }])
    const { deps, captured } = makeGlobalDeps()

    expect(router.installBackgroundHandler(deps)).toBe(true)
    await captured.bg(fcm('shop-lazy'))

    expect(trackPush).toHaveBeenCalledWith('shop-lazy', 'delivered', expect.objectContaining({ code: '10', type: 'web' }))
    expect(trackPush).toHaveBeenCalledWith('shop-lazy', 'opened', expect.objectContaining({ code: '10', type: 'web' }))
    expect(displayPush).toHaveBeenCalled()
  })

  test("an app's Notifee background handler set after the SDK's runs beside it: both hear each event", async () => {
    registerShops([{ shopId: 'shop-lazy', stream: 'android' }])
    const { deps, captured } = makeGlobalDeps()
    deps.EventType = { PRESS: 'press', DISMISSED: 'dismissed' }
    router.installBackgroundHandler(deps)
    const appHandler = jest.fn(async () => 'handled by the app')

    // What the app writes after importing the SDK.
    deps.notifee.onBackgroundEvent(appHandler)
    const press = { type: 'press', detail: { notification: { data: { shop_id: 'shop-lazy', id: '11', type: 'bulk' } } } }
    const result = await captured.notifeeBg(press)

    expect(appHandler).toHaveBeenCalledWith(press)
    expect(trackPush).toHaveBeenCalledWith('shop-lazy', 'clicked', expect.objectContaining({ code: '11', type: 'bulk' }))
    // The event's result is the app's, as without the SDK.
    expect(result).toBe('handled by the app')

    // A later handler of the app takes its place; the SDK's stays.
    const nextHandler = jest.fn()
    deps.notifee.onBackgroundEvent(nextHandler)
    await captured.notifeeBg(press)
    expect(nextHandler).toHaveBeenCalledTimes(1)
    expect(appHandler).toHaveBeenCalledTimes(1)
    expect(trackPush.mock.calls.filter(([, event]) => event === 'clicked')).toHaveLength(2)
  })

  test("an app's handler that fails fails its event, as without the SDK; the SDK's handling still runs", async () => {
    registerShops([{ shopId: 'shop-lazy', stream: 'android' }])
    const { deps, captured } = makeGlobalDeps()
    deps.EventType = { PRESS: 'press', DISMISSED: 'dismissed' }
    router.installBackgroundHandler(deps)
    deps.notifee.onBackgroundEvent(() => { throw new Error('the app failed') })
    const press = { type: 'press', detail: { notification: { data: { shop_id: 'shop-lazy', id: '12', type: 'bulk' } } } }

    await expect(captured.notifeeBg(press)).rejects.toThrow('the app failed')
    expect(trackPush).toHaveBeenCalledWith('shop-lazy', 'clicked', expect.objectContaining({ code: '12' }))
  })

  test('without Firebase it sets nothing and does not throw', () => {
    const { deps } = makeGlobalDeps()
    deps.getMessaging.mockImplementation(() => {
      throw new Error('No Firebase App')
    })

    expect(router.installBackgroundHandler(deps)).toBe(false)
  })

  test('an instance installing later replaces the global functions it had', async () => {
    const { deps: early } = makeGlobalDeps()
    router.installBackgroundHandler({ getMessaging: early.getMessaging, setBackgroundMessageHandler: early.setBackgroundMessageHandler, notifee: early.notifee, isDebug: early.isDebug })
    const { deps } = makeGlobalDeps()
    registerShop('shop-a')

    expect(await router.ensureInstalled(deps)).toBe(true)
    expect(deps.onMessage).toHaveBeenCalledTimes(1)
  })
})

describe('PushRouter — SDK handlers never crash the host', () => {
  // RNFB / notifee run several handlers as headless tasks and call `.then()` on the return value, so a
  // handler must ALWAYS return a Promise and must never throw into the host thread. `_safe` guarantees
  // both — a failing push is a swallowed no-op, never an app crash.
  test('a dropped push returns a resolved Promise, never undefined (headless .then() cannot throw)', async () => {
    const { deps, captured } = makeGlobalDeps()
    registerShop('shop-a')
    await router.ensureInstalled(deps)

    const result = captured.bg(fcm('zzz-unknown-shop')) // no route → dropped
    expect(result && typeof result.then).toBe('function')
    await expect(result).resolves.toBeUndefined()
  })

  test('a throwing instance handler is swallowed — the wrapped handler still resolves', async () => {
    const { deps, captured } = makeGlobalDeps()
    const a = registerShop('shop-a')
    a._handleBackgroundMessage.mockImplementation(() => {
      throw new Error('boom')
    })
    await router.ensureInstalled(deps)

    // The error is caught inside _safe, so nothing rejects into the headless task.
    await expect(captured.bg(fcm('shop-a'))).resolves.toBeUndefined()
  })

  test('a rejecting async instance handler is swallowed too', async () => {
    const { deps, captured } = makeGlobalDeps()
    const a = registerShop('shop-a')
    a._handleForegroundMessage.mockRejectedValue(new Error('async boom'))
    await router.ensureInstalled(deps)

    await expect(captured.onMessage(fcm('shop-a'))).resolves.toBeUndefined()
  })
})
