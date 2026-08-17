'use strict'

import { InteractionManager } from 'react-native'
import SdkRegistry from '../registry/SdkRegistry'
import { resolvePushRoute } from '../facade/facade'
import { shopId as parseShopId } from './PushPayloadParser'
import { PushEvent } from './PushEvent'
import { trackPush } from './trackPush'
import displayPush from './displayPush'
import { updPushData } from '../client'

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
    if (!this._deps) this._deps = deps
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
        if (r.orchestrator) return r.orchestrator._handleNotifeeForeground(event, r.shopId)
        return this._handlePendingNotifee(event, r.shopId, r.stream)
      }))

      this._deps.notifee.onBackgroundEvent(this._safe((event) => {
        const r = this._routeNotifee(event)
        if (!r) return
        if (r.orchestrator) return r.orchestrator._handleNotifeeBackground(event)
        return this._handlePendingNotifee(event, r.shopId, r.stream)
      }))

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
   * Handles a push for a registered-but-pending shop with no instance: persist it, track delivery, and
   * display it. Tracks use the shop's persisted did (see trackPush) — no `/init`, no token, no profile.
   */
  async _handlePendingReceive(remoteMessage, shopId, stream) {
    const data = (remoteMessage && remoteMessage.data) || {}
    await updPushData(remoteMessage, shopId)
    trackPush(shopId, PushEvent.DELIVERED, { code: data.id, type: data.type, stream })
    trackPush(shopId, PushEvent.OPENED, { code: data.id, type: data.type, stream })
    await displayPush(remoteMessage)
  }

  /** Tracks a click on a pending shop's push (navigation stays with the host). Returns the track
   * promise so a headless caller can await it. */
  _handlePendingClick(remoteMessage, shopId, stream) {
    const data = (remoteMessage && remoteMessage.data) || {}
    return trackPush(shopId, PushEvent.CLICKED, { code: data.id, type: data.type, stream })
  }

  /** A notifee press on a pending shop's notification is a click. Returns the track promise (or
   * undefined for a non-press event) — the caller runs in a headless task and awaits it. */
  _handlePendingNotifee(event, shopId, stream) {
    if (!event || event.type !== this._deps.EventType.PRESS) return
    const data =
      (event.detail && event.detail.notification && event.detail.notification.data) || {}
    return trackPush(shopId, PushEvent.CLICKED, { code: data.id, type: data.type, stream })
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
