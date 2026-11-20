'use strict'

import { InteractionManager } from 'react-native'
import SdkRegistry from '../registry/SdkRegistry'
import { resolvePushRoute, trackPendingPush } from '../facade/facade'
import { shopId as parseShopId, typeAndCode } from './PushPayloadParser'
import { PushEvent } from './PushEvent'
import displayPush from './displayPush'
import { updPushData } from '../client'

/**
 * Notifee keeps one background event handler: each `notifee.onBackgroundEvent` replaces the one before. So
 * that the SDK's and the app's both run, the SDK wraps `notifee.onBackgroundEvent` once, as it is imported:
 * a handler the app sets afterwards takes the app's place beside the SDK's, and each event goes to both — the
 * SDK's handles its own notifications and never fails, the app's result (or failure) is the event's, as
 * without the SDK. A handler set before the SDK was imported cannot be kept: Notifee does not tell it.
 * @type {WeakMap<object, { sdk: Function | null, app: Function | null }>}
 */
const notifeeBackground = new WeakMap()

/**
 * The chain of `notifee`'s background handlers: `sdk`, `app`, `both` — the one Notifee holds — and
 * `register`, Notifee's own `onBackgroundEvent`. Made once per Notifee object.
 */
function chainNotifeeBackground(notifee) {
  let chain = notifeeBackground.get(notifee)
  if (chain) return chain
  const register = notifee.onBackgroundEvent
  chain = {
    sdk: null,
    app: null,
    register: (handler) => register.call(notifee, handler),
    both: (event) => {
      let sdk
      try {
        // The SDK's never fails; it runs at once, as when it was Notifee's only handler.
        sdk = chain.sdk ? Promise.resolve(chain.sdk(event)).catch(() => undefined) : undefined
      } catch (_) {
        sdk = undefined
      }
      let app
      try {
        app = chain.app ? chain.app(event) : undefined
      } catch (error) {
        app = Promise.reject(error)
      }
      return Promise.all([sdk, app]).then(([, result]) => result)
    },
  }
  notifee.onBackgroundEvent = (observer) => {
    // Notifee's own check of the argument, as before.
    if (typeof observer !== 'function') return chain.register(observer)
    chain.app = observer
    return chain.register(chain.both)
  }
  notifeeBackground.set(notifee, chain)
  return chain
}

/** How long a pending shop's push handling waits for its events once the push is drawn. */
export const PENDING_EVENTS_WAIT_MS = 10000

/** `call()` as a promise that never rejects: a failed event is told by its own sender, not by the push. */
function settled(call) {
  try {
    return Promise.resolve(call()).catch(() => undefined)
  } catch (_) {
    return Promise.resolve(undefined)
  }
}

/** `promise`, or nothing once `ms` passed, whichever comes first. */
function atMost(promise, ms) {
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Process-global push router (Release 4, RN-13).
 *
 * Native push delivery (FCM background handler, notifee background event) is process-global — there
 * is a single slot per app — and the foreground listeners are additive. With one `PushOrchestrator`
 * per instance each installing its own handlers, a second instance would either overwrite the first
 * (background) or double-process every push (foreground), and each would track to its own shop
 * regardless of which shop the push is for.
 *
 * The router installs those handlers exactly once and routes every event to the instance its
 * `shop_id` names: `PushPayloadParser` reads the id, `PushTargetResolver` + `SdkRegistry` resolve the
 * live instance, and the event is dispatched to that instance's orchestrator. No `shop_id` with a
 * single live shop still resolves (fallback); an unknown shop — or no `shop_id` while several are
 * live — drops the push instead of delivering it to the wrong one.
 *
 * The per-instance handling logic stays on `PushOrchestrator` (dedup, listeners, tracking); only the
 * install + cold-start consumption live here. The global firebase/notifee functions are identical
 * across instances, so the first caller's `deps` are captured.
 */
class PushRouter {
  constructor() {
    /** @type {object | null} global firebase/notifee deps, captured on first ensureInstalled. */
    this._deps = null
    /** @type {boolean} */
    this._installed = false
    /** @type {Promise<boolean> | null} */
    this._installPromise = null

    /** @type {boolean} whether a cold-start has been found and routed. */
    this._coldStartFound = false
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._coldStartRetryHandle = null
    /** @type {number | null} */
    this._coldStartInstallTs = null
    /** Diagnostic breadcrumbs for cold-start retries; never read by production logic. @type {string[]} */
    this._coldStartFetchLog = []
  }

  /**
   * Installs the process-global handlers exactly once and returns whether they are installed.
   * Idempotent — a call from any instance after the first is a no-op. On failure (messaging
   * unavailable) returns false without marking installed, so a later call retries cleanly.
   *
   * @param {object} deps - the orchestrator's deps; only the global subset is used
   *   (getMessaging, onMessage, setBackgroundMessageHandler, onNotificationOpenedApp, onTokenRefresh,
   *   getInitialNotification, notifee, EventType, isDebug).
   * @returns {Promise<boolean>}
   */
  async ensureInstalled(deps) {
    if (this._installed) return true
    // The background handler set at import had only the global functions: an instance's deps replace them.
    if (!this._deps || this._partialDeps) {
      this._deps = deps
      this._partialDeps = false
    }
    if (this._installPromise) return this._installPromise

    this._installPromise = this._doInstall()
    try {
      return await this._installPromise
    } finally {
      this._installPromise = null
    }
  }

  /** @returns {Promise<boolean>} */
  async _doInstall() {
    try {
      const messaging = this._deps.getMessaging()
      if (!messaging) {
        console.warn(
          '[PushRouter] messaging unavailable, Firebase subscriptions skipped (will retry)'
        )
        return false
      }

      // Every handler below runs inside the HOST's process — several (the FCM background handler,
      // notifee's background event) as headless tasks whose return value the platform `.then()`s.
      // `_safe` wraps each so SDK push code can never crash the app: the wrapper always resolves to a
      // Promise (so a bare `return`/undefined can't throw "'then' of undefined") and swallows any throw
      // or rejection. A push handler failing must never take the host process down.
      this._deps.onMessage(messaging, this._safe((remoteMessage) => {
        const r = this._route(parseShopId(remoteMessage))
        if (!r) return
        if (r.orchestrator) return r.orchestrator._handleForegroundMessage(remoteMessage, r.shopId)
        return this._handlePendingReceive(remoteMessage, r.shopId, r.stream)
      }))

      this._deps.setBackgroundMessageHandler(messaging, this._safe((remoteMessage) => {
        const r = this._route(parseShopId(remoteMessage))
        if (!r) return
        if (r.orchestrator) return r.orchestrator._handleBackgroundMessage(remoteMessage, r.shopId)
        return this._handlePendingReceive(remoteMessage, r.shopId, r.stream)
      }))

      this._deps.onNotificationOpenedApp(messaging, this._safe((remoteMessage) => {
        const r = this._route(parseShopId(remoteMessage))
        if (!r) return
        if (r.orchestrator) return r.orchestrator._handleClickEvent(remoteMessage, r.shopId)
        return this._handlePendingClick(remoteMessage, r.shopId, r.stream)
      }))

      this._deps.onTokenRefresh(messaging, this._safe((token) => this._fanOutTokenRefresh(token)))

      this._deps.notifee.onForegroundEvent(this._safe((event) => {
        const r = this._routeNotifee(event)
        if (!r) return
        if (r.orchestrator) {
          if (this._isDismissed(event)) return r.orchestrator._handleNotifeeDismissed(event)
          return r.orchestrator._handleNotifeeForeground(event, r.shopId)
        }
        return this._handlePendingNotifee(event, r.shopId, r.stream)
      }))

      this._installNotifeeBackground()

      await this._consumeColdStart(messaging)

      this._installed = true
      return true
    } catch (e) {
      if (this._deps && typeof this._deps.isDebug === 'function' && this._deps.isDebug()) {
        console.log('[PushRouter] Failed to setup push tracking subscriptions', e)
      }
      return false
    }
  }

  /**
   * Wraps a host-facing push handler so SDK code can NEVER crash the app. The returned function is
   * async — it always resolves to a Promise, which RNFB/notifee `.then()` when they run these as
   * headless tasks (a bare `return`/undefined would otherwise throw "'then' of undefined") — and it
   * catches any throw or rejection, swallowing it (logged in debug) so a handler failure never
   * propagates into the host's messaging thread.
   * @param {(...args: any[]) => any} fn
   * @returns {(...args: any[]) => Promise<any>}
   */
  _safe(fn) {
    return async (...args) => {
      try {
        return await fn(...args)
      } catch (e) {
        if (this._deps && typeof this._deps.isDebug === 'function' && this._deps.isDebug()) {
          console.log('[PushRouter] push handler error (ignored)', e)
        }
      }
    }
  }

  /**
   * Resolves which instance a push belongs to. Returns `{ orchestrator, shopId }` for the target, or
   * null to drop (unknown shop, or ambiguous with no shop_id while several are live).
   * @param {string | null} payloadShopId
   * @returns {{ orchestrator: object, shopId: string } | null}
   */
  _route(payloadShopId) {
    const route = resolvePushRoute(payloadShopId)
    if (!route) return null
    if (route.live) {
      const sdk = SdkRegistry.byShopId(route.shopId)
      const orchestrator = sdk && sdk._pushOrchestrator
      return orchestrator ? { orchestrator, shopId: route.shopId } : null
    }
    // Registered but not initialized: handled standalone (track + display) — no instance built, so a
    // lazily-registered shop's push is not dropped just because it is not live yet.
    return { pending: true, shopId: route.shopId, stream: route.stream }
  }

  /**
   * Handles a push for a registered-but-pending shop with no instance: persist it, draw it, and track it
   * delivered and — drawn by the SDK — opened, in that order. The push is drawn at once: `delivered` goes
   * as it comes but is not waited for, and `opened` follows it. The events go without an instance: the
   * native SDK's own push handling where it can, else the shop's persisted did — no `/init`, no token, no
   * profile. A headless task waits for the events at most `PENDING_EVENTS_WAIT_MS`, so a request that hangs
   * does not hold the task.
   */
  async _handlePendingReceive(remoteMessage, shopId, stream) {
    const options = { ...typeAndCode(remoteMessage), stream }
    await updPushData(remoteMessage, shopId)
    const delivered = settled(() => trackPendingPush(shopId, PushEvent.DELIVERED, options, remoteMessage))
    try {
      await displayPush(remoteMessage)
    } catch (error) {
      // Not drawn: not opened either.
      await atMost(delivered, PENDING_EVENTS_WAIT_MS)
      throw error
    }
    const opened = delivered.then(() => settled(() => trackPendingPush(shopId, PushEvent.OPENED, options, remoteMessage)))
    await atMost(opened, PENDING_EVENTS_WAIT_MS)
  }

  /** Tracks a click on a pending shop's push (navigation stays with the host). Returns the track
   * promise so a headless caller can await it. */
  _handlePendingClick(remoteMessage, shopId, stream) {
    const { code, type } = typeAndCode(remoteMessage)
    return trackPendingPush(shopId, PushEvent.CLICKED, { code, type, stream }, remoteMessage)
  }

  /** A notifee press on a pending shop's notification is a click, a dismissal is `closed`. Returns the
   * track promise (or undefined for another event) — the caller runs in a headless task and awaits it. */
  _handlePendingNotifee(event, shopId, stream) {
    const pressed = event && event.type === this._deps.EventType.PRESS
    if (!pressed && !this._isDismissed(event)) return
    const data =
      (event.detail && event.detail.notification && event.detail.notification.data) || {}
    const { code, type } = typeAndCode(data)
    return trackPendingPush(shopId, pressed ? PushEvent.CLICKED : PushEvent.CLOSED, { code, type, stream }, { data })
  }

  /** A notification dismissed without a tap: Notifee's `DISMISSED`. */
  _isDismissed(event) {
    const dismissed = this._deps && this._deps.EventType && this._deps.EventType.DISMISSED
    return !!event && dismissed != null && event.type === dismissed
  }

  /**
   * Notifee's background events (a tap, a dismissal while the app is not in front), routed by shop — beside
   * the app's own background handler, which keeps hearing every event (`chainNotifeeBackground`).
   */
  _installNotifeeBackground() {
    const chain = chainNotifeeBackground(this._deps.notifee)
    chain.sdk = this._safe((event) => {
      const r = this._routeNotifee(event)
      if (!r) return
      if (r.orchestrator) {
        if (this._isDismissed(event)) return r.orchestrator._handleNotifeeDismissed(event)
        return r.orchestrator._handleNotifeeBackground(event)
      }
      return this._handlePendingNotifee(event, r.shopId, r.stream)
    })
    chain.register(chain.both)
  }

  /**
   * The SDK's own background handler, set when the SDK is imported — at the app's module scope, before
   * a process a push started runs any screen — so that such a push is handled without the app's code:
   * a shop registered then (`registerShops` at module scope) gets it drawn and tracked with no instance.
   * An app that sets its own Firebase background handler later replaces that one; a Notifee background
   * handler the app sets later runs beside the SDK's. Never throws: without Firebase in the app it does
   * nothing.
   * @param {object} deps getMessaging, setBackgroundMessageHandler, notifee, EventType, isDebug
   * @returns {boolean} whether it was set
   */
  installBackgroundHandler(deps) {
    try {
      if (!this._deps) {
        this._deps = deps
        this._partialDeps = true
      }
      const messaging = deps.getMessaging()
      if (!messaging) return false
      deps.setBackgroundMessageHandler(messaging, this._safe((remoteMessage) => {
        const r = this._route(parseShopId(remoteMessage))
        if (!r) return
        if (r.orchestrator) return r.orchestrator._handleBackgroundMessage(remoteMessage, r.shopId)
        return this._handlePendingReceive(remoteMessage, r.shopId, r.stream)
      }))
      this._installNotifeeBackground()
      return true
    } catch (e) {
      return false
    }
  }

  /** Resolves a notifee event by the `shop_id` in its notification data. */
  _routeNotifee(event) {
    const data = (event && event.detail && event.detail.notification && event.detail.notification.data) || {}
    return this._route(data.shop_id ?? null)
  }

  /** Token refresh fans out to every live instance — each re-registers the token to its own shop. */
  _fanOutTokenRefresh(token) {
    if (typeof token !== 'string' || token.length === 0) return
    SdkRegistry.all().forEach((sdk) => {
      const orch = sdk && sdk._pushOrchestrator
      if (orch) orch._handleTokenRefresh(token)
    })
  }

  // --- cold start (process-global: read once here, route by shop_id) -----

  /**
   * Reads the cold-start notification (FCM or notifee) once and routes it to the instance its
   * `shop_id` names, dispatching through that instance's click pipeline. If FCM's initial
   * notification is null on the first read, schedules non-blocking retries (some Android builds
   * populate the launch intent 2–5s after JS init).
   * @param {any} messaging
   * @returns {Promise<void>}
   */
  async _consumeColdStart(messaging) {
    this._coldStartInstallTs = Date.now()
    if (messaging) {
      const fcmInitial = await this._deps.getInitialNotification(messaging)
      this._coldStartFetchLog.push(`install:${fcmInitial ? 'ok' : 'null'}@0ms`)
      if (fcmInitial) {
        await this._processFcmColdStart(fcmInitial)
      } else {
        this._scheduleColdStartRecheck(messaging)
      }
    }

    const notifeeInitial = await this._deps.notifee.getInitialNotification()
    if (notifeeInitial && notifeeInitial.notification) {
      const data = notifeeInitial.notification.data || {}
      const r = this._route(data.shop_id ?? null)
      if (r) {
        this._coldStartFound = true
        this._cancelColdStartRetry()
        if (r.orchestrator) await r.orchestrator._processNotifeeColdStart({ data })
        else this._handlePendingClick({ data }, r.shopId, r.stream)
      }
    }
  }

  /** Routes an FCM cold-start payload to the resolved instance's per-instance cold-start handling. */
  async _processFcmColdStart(fcmInitial) {
    const r = this._route(parseShopId(fcmInitial))
    if (!r) return
    this._coldStartFound = true
    this._cancelColdStartRetry()
    if (r.orchestrator) return r.orchestrator._processFcmColdStart(fcmInitial, r.shopId)
    // Cold start = the tap that launched the app; track the click on the pending shop.
    this._handlePendingClick(fcmInitial, r.shopId, r.stream)
  }

  _cancelColdStartRetry() {
    if (this._coldStartRetryHandle) {
      clearTimeout(this._coldStartRetryHandle)
      this._coldStartRetryHandle = null
    }
  }

  _elapsedMs() {
    return this._coldStartInstallTs ? Date.now() - this._coldStartInstallTs : 0
  }

  /**
   * Schedules a single deferred re-read of FCM's initial notification, gated by InteractionManager
   * so it waits until UI animations settle, with a 5s safety timeout. Ported from the per-instance
   * orchestrator; now checks the router-level `_coldStartFound` flag and routes by shop_id.
   * @param {any} messaging
   */
  _scheduleColdStartRecheck(messaging) {
    const runRecheck = async (source) => {
      this._coldStartRetryHandle = null
      if (this._coldStartFound) {
        this._coldStartFetchLog.push(`recheck:skipped(found:${source})@${this._elapsedMs()}ms`)
        return
      }
      try {
        const fcmInitial = await this._deps.getInitialNotification(messaging)
        this._coldStartFetchLog.push(
          `recheck(${source}):${fcmInitial ? 'ok' : 'null'}@${this._elapsedMs()}ms`
        )
        if (fcmInitial) {
          await this._processFcmColdStart(fcmInitial)
        }
      } catch (e) {
        this._coldStartFetchLog.push(`recheck(${source}):error@${this._elapsedMs()}ms`)
        if (this._deps && typeof this._deps.isDebug === 'function' && this._deps.isDebug()) {
          console.log('[PushRouter] cold-start recheck failed', e)
        }
      }
    }

    let interactionHandle = null
    let recheckRan = false

    // Primary path: wait until UI interactions/animations settle.
    if (
      typeof InteractionManager !== 'undefined' &&
      InteractionManager &&
      typeof InteractionManager.runAfterInteractions === 'function'
    ) {
      const task = InteractionManager.runAfterInteractions(() => {
        if (recheckRan) return
        recheckRan = true
        interactionHandle = null
        if (this._coldStartRetryHandle) {
          clearTimeout(this._coldStartRetryHandle)
          this._coldStartRetryHandle = null
        }
        runRecheck('interactions-idle')
      })
      interactionHandle = task && typeof task.cancel === 'function' ? task : null
    }

    // Safety fallback: always fire by 5s post-install.
    this._coldStartRetryHandle = setTimeout(() => {
      this._coldStartRetryHandle = null
      if (recheckRan) return
      recheckRan = true
      if (interactionHandle) {
        try {
          interactionHandle.cancel()
        } catch (e) {
          /* ignore */
        }
      }
      runRecheck('timeout-5s')
    }, 5000)

    if (this._coldStartRetryHandle && typeof this._coldStartRetryHandle.unref === 'function') {
      this._coldStartRetryHandle.unref()
    }
  }

  /** Test-only: clears install state and any pending cold-start retry. */
  reset() {
    this._cancelColdStartRetry()
    this._deps = null
    this._partialDeps = false
    this._installed = false
    this._installPromise = null
    this._coldStartFound = false
    this._coldStartInstallTs = null
    this._coldStartFetchLog = []
  }
}

/** Process-wide singleton. */
const pushRouter = new PushRouter()

export default pushRouter
export { PushRouter }
