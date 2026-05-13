import { InteractionManager } from 'react-native'

export default class PushOrchestrator {
  /**
   * @param {{
   *   getMessaging: () => any | null,
   *   getToken: (messaging: any) => Promise<any>,
   *   getAPNSToken: (messaging: any) => Promise<any>,
   *   onMessage: (messaging: any, cb: Function) => (Function | void),
   *   setBackgroundMessageHandler: (messaging: any, cb: Function) => void,
   *   onNotificationOpenedApp: (messaging: any, cb: Function) => (Function | void),
   *   getInitialNotification: (messaging: any) => Promise<any>,
   *   onTokenRefresh: (messaging: any, cb: Function) => (Function | void),
   *   onNewToken: (token: string) => void,
   *   notifee: any,
   *   EventType: any,
   *   getPushData: (messageId: string, shopId: string) => Promise<any[]>,
   *   updPushData: (remoteMessage: any, shopId: string) => Promise<any>,
   *   notificationDelivered: (options: { code: string, type: string }) => Promise<any>,
   *   defaultClickListener: (event: any) => Promise<any>,
   *   defaultReceiveListener: (remoteMessage: any) => Promise<any>,
   *   defaultBgReceiveListener: (remoteMessage: any) => Promise<any>,
   *   getShopId: () => string,
   *   hasSeenMessageId: (messageId: string) => boolean,
   *   markMessageIdSeen: (messageId: string) => void,
   *   isDebug: () => boolean,
   * }} deps
   */
  constructor(deps) {
    this._deps = deps

    /** @type {Function | null} */
    this._clickListener = null
    /** @type {Function | null} */
    this._receiveListener = null
    /** @type {Function | null} */
    this._bgReceiveListener = null

    // Cold-start buffering: payload of the click that launched the app, kept so we
    // can replay it through a custom click listener that's registered after the
    // default has already consumed it (e.g. autoSendPushToken init).
    /** @type {any | null} */
    this._lastColdStart = null
    /** @type {boolean} */
    this._lastColdStartReplayed = false

    /** @type {boolean} */
    this._subscriptionsInstalled = false
    /** @type {Promise<boolean> | null} */
    this._installPromise = null

    /** @type {Promise<string|null> | null} */
    this._tokenPromise = null

    /** @type {ReturnType<typeof setTimeout> | null} */
    this._coldStartRetryHandle = null

    // Diagnostic counters for cold-start retries. Each install-time check or
    // retry appends `'ok'` or `'null'`, with the elapsed ms since install.
    // Exposed for probes; never read by production logic.
    /** @type {string[]} */
    this._coldStartFetchLog = []
    /** @type {number | null} */
    this._coldStartInstallTs = null
  }

  /**
   * Update one or more push event listeners. A listener is only replaced when a
   * truthy value is passed — `false` / `undefined` leaves the previous (or default)
   * listener in place.
   *
   * If a click listener is registered after a cold-start has already been delivered
   * to the default handler, the buffered cold-start payload is replayed through the
   * new click listener so late-registering hosts still receive the launch click.
   *
   * @param {{ click?: Function | false, receive?: Function | false, bgReceive?: Function | false }} listeners
   */
  setListeners({ click, receive, bgReceive } = {}) {
    const hadClick = !!this._clickListener
    if (click) this._clickListener = click
    if (receive) this._receiveListener = receive
    if (bgReceive) this._bgReceiveListener = bgReceive

    if (
      !hadClick &&
      click &&
      this._lastColdStart &&
      !this._lastColdStartReplayed
    ) {
      this._lastColdStartReplayed = true
      const payload = this._lastColdStart
      Promise.resolve()
        .then(() => click(payload))
        .catch((e) => {
          if (this._deps.isDebug()) {
            console.log('[PushOrchestrator] cold-start replay failed', e)
          }
        })
    }
  }

  /**
   * iOS-only: registers device for remote messages if needed.
   * @param {any} messaging
   * @param {string} platformOS
   * @returns {Promise<void>}
   */
  async ensureDeviceRegistered(messaging, platformOS) {
    if (platformOS !== 'ios' || !messaging) return

    /** @type {boolean | null} */
    let isRegistered = null

    try {
      if (typeof messaging?.isDeviceRegisteredForRemoteMessages === 'function') {
        isRegistered = await messaging.isDeviceRegisteredForRemoteMessages()
        if (isRegistered === true) return
      }
    } catch (e) {
      isRegistered = null
    }

    try {
      await messaging.registerDeviceForRemoteMessages()
    } catch (e) {
      if (isRegistered === false) throw e
      console.warn('[Firebase][registerDeviceForRemoteMessages] failed', e)
    }
  }

  /**
   * Fetches token and ensures subscriptions exist once token is known. Dedupes
   * concurrent calls.
   *
   * @param {{ messaging: any, pushType: string | null, platformOS: string }} args
   * @returns {Promise<string|null>}
   */
  async fetchToken(args) {
    if (this._tokenPromise) return this._tokenPromise

    this._tokenPromise = this._doFetchToken(args)
    try {
      return await this._tokenPromise
    } finally {
      this._tokenPromise = null
    }
  }

  /**
   * @param {{ messaging: any, pushType: string | null, platformOS: string }} args
   * @returns {Promise<string|null>}
   */
  async _doFetchToken({ messaging, pushType, platformOS }) {
    try {
      await this.ensureDeviceRegistered(messaging, platformOS)

      let token = null
      if (pushType === null && platformOS === 'ios') {
        token = await this._deps.getAPNSToken(messaging)
        if (this._deps.isDebug()) console.log('New APN token: ', token)
      } else {
        token = await this._deps.getToken(messaging)
        if (this._deps.isDebug()) console.log('New FCM token: ', token)
      }

      if (typeof token !== 'string' || token.length === 0) {
        console.warn('[Firebase][fetchToken] empty/invalid token received', {
          platformOS,
          pushType,
        })
        return null
      }

      await this.installSubscriptions()
      return token
    } catch (error) {
      console.error('[Firebase][fetchToken] initPushToken error', error)
      return null
    }
  }

  /**
   * Installs all push subscriptions and consumes any cold-start notification
   * exactly once. Idempotent: subsequent calls are no-ops once installed.
   *
   * On failure (e.g. messaging unavailable) returns false WITHOUT marking as
   * installed, so a later call retries cleanly. The `_installPromise` is cleared
   * in the outer caller's finally to avoid the synchronous-completion stickiness
   * that would otherwise pin a resolved-false promise.
   *
   * @returns {Promise<boolean>}
   */
  async installSubscriptions() {
    if (this._subscriptionsInstalled) return true
    if (this._installPromise) return this._installPromise

    this._installPromise = this._doInstallSubscriptions()
    try {
      return await this._installPromise
    } finally {
      this._installPromise = null
    }
  }

  /** @returns {Promise<boolean>} */
  async _doInstallSubscriptions() {
    try {
      const messaging = this._deps.getMessaging()
      const shopId = this._deps.getShopId()

      if (!messaging) {
        console.warn(
          '[PushOrchestrator] messaging unavailable, Firebase subscriptions skipped (will retry)'
        )
        return false
      }

      this._deps.onMessage(messaging, (remoteMessage) =>
        this._handleForegroundMessage(remoteMessage, shopId)
      )

      this._deps.setBackgroundMessageHandler(messaging, (remoteMessage) =>
        this._handleBackgroundMessage(remoteMessage, shopId)
      )

      this._deps.onNotificationOpenedApp(messaging, (remoteMessage) =>
        this._handleClickEvent(remoteMessage, shopId)
      )

      this._deps.onTokenRefresh(messaging, (token) =>
        this._handleTokenRefresh(token)
      )

      this._deps.notifee.onForegroundEvent((event) =>
        this._handleNotifeeForeground(event, shopId)
      )

      this._deps.notifee.onBackgroundEvent((event) =>
        this._handleNotifeeBackground(event)
      )

      await this._consumeColdStart(messaging, shopId)

      this._subscriptionsInstalled = true
      return true
    } catch (e) {
      if (this._deps.isDebug())
        console.log('Failed to setup push tracking subscriptions', e)
      return false
    }
  }

  /**
   * Reads the cold-start notification (FCM or Notifee) and dispatches it once
   * through the click pipeline. Buffers the payload for potential replay if the
   * host registers a custom click listener later via setListeners().
   *
   * If FCM's `getInitialNotification` returns null on the first call, schedules
   * non-blocking retries with backoff. On some Android devices the native side
   * has not yet populated the launch-intent's initial notification by the time
   * JS reaches this point — without retries the cold-start click is silently lost.
   *
   * @param {any} messaging
   * @param {string} shopId
   * @returns {Promise<void>}
   */
  async _consumeColdStart(messaging, shopId) {
    this._coldStartInstallTs = Date.now()
    if (messaging) {
      const fcmInitial = await this._deps.getInitialNotification(messaging)
      this._coldStartFetchLog.push(`install:${fcmInitial ? 'ok' : 'null'}@0ms`)
      if (fcmInitial) {
        await this._processFcmColdStart(fcmInitial, shopId)
      } else {
        this._scheduleColdStartRecheck(messaging, shopId)
      }
    }

    const notifeeInitial = await this._deps.notifee.getInitialNotification()
    if (notifeeInitial?.notification) {
      const data = notifeeInitial.notification.data || {}
      const payload = { data }
      this._lastColdStart = payload
      this._cancelColdStartRetry()
      await this._dispatchClick(payload)
    }
  }

  /**
   * Processes a single FCM cold-start payload: dedup by messageId, buffer,
   * push backend tracking, dispatch through the click pipeline.
   *
   * @param {any} fcmInitial
   * @param {string} shopId
   * @returns {Promise<void>}
   */
  async _processFcmColdStart(fcmInitial, shopId) {
    const messageId = fcmInitial?.messageId
    if (messageId && this._deps.hasSeenMessageId(messageId)) return
    if (messageId) this._deps.markMessageIdSeen(messageId)

    if (this._deps.isDebug())
      console.log('App cold-started via FCM notification', fcmInitial)

    this._lastColdStart = fcmInitial
    this._cancelColdStartRetry()
    await this._deps.updPushData(fcmInitial, shopId)
    await this._dispatchClick(fcmInitial)
  }

  _cancelColdStartRetry() {
    if (this._coldStartRetryHandle) {
      clearTimeout(this._coldStartRetryHandle)
      this._coldStartRetryHandle = null
    }
  }

  _elapsedMs() {
    return this._coldStartInstallTs
      ? Date.now() - this._coldStartInstallTs
      : 0
  }

  /**
   * Schedules a single deferred re-check of FCM's `getInitialNotification`,
   * gated by InteractionManager so the check waits until UI animations and
   * gesture handling settle. This avoids contending with the init-time popup
   * presentation for JS-thread time when the SDK's host renders something
   * heavy immediately after init.
   *
   * A safety timeout (5s after install) bounds the wait so we never miss
   * the cold-start if InteractionManager never reports idle (e.g. user keeps
   * scrolling/tapping continuously). Empirically some Android builds populate
   * the launch-intent's initial notification 2–5s after JS init, so the
   * window must be more generous than the initial install moment.
   *
   * @param {any} messaging
   * @param {string} shopId
   */
  _scheduleColdStartRecheck(messaging, shopId) {
    const runRecheck = async (source) => {
      this._coldStartRetryHandle = null
      if (this._lastColdStart) {
        this._coldStartFetchLog.push(
          `recheck:skipped(buffered:${source})@${this._elapsedMs()}ms`
        )
        return
      }
      try {
        const fcmInitial = await this._deps.getInitialNotification(messaging)
        this._coldStartFetchLog.push(
          `recheck(${source}):${fcmInitial ? 'ok' : 'null'}@${this._elapsedMs()}ms`
        )
        if (fcmInitial) {
          await this._processFcmColdStart(fcmInitial, shopId)
        }
      } catch (e) {
        this._coldStartFetchLog.push(
          `recheck(${source}):error@${this._elapsedMs()}ms`
        )
        if (this._deps.isDebug())
          console.log('[PushOrchestrator] cold-start recheck failed', e)
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
        // InteractionManager fired first — cancel safety timeout.
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

    if (typeof this._coldStartRetryHandle?.unref === 'function') {
      this._coldStartRetryHandle.unref()
    }
  }

  // --- Subscription handlers ---------------------------------------------

  async _handleForegroundMessage(remoteMessage, shopId) {
    const messageId = remoteMessage?.messageId
    if (messageId) {
      if (this._deps.hasSeenMessageId(messageId)) return false
      this._deps.markMessageIdSeen(messageId)
    }

    await this._deps.notificationDelivered({
      code: remoteMessage.data.id,
      type: remoteMessage.data.type,
    })
    if (this._deps.isDebug()) console.log('Message delivered: ', remoteMessage)

    await this._deps.updPushData(remoteMessage, shopId)
    await this._dispatchReceive(remoteMessage)
  }

  async _handleBackgroundMessage(remoteMessage, shopId) {
    const messageId = remoteMessage?.messageId
    if (messageId) {
      if (this._deps.hasSeenMessageId(messageId)) return false
      this._deps.markMessageIdSeen(messageId)
    }

    await this._deps.notificationDelivered({
      code: remoteMessage.data.id,
      type: remoteMessage.data.type,
    })
    if (this._deps.isDebug())
      console.log('Background message delivered: ', remoteMessage)

    await this._deps.updPushData(remoteMessage, shopId)
    await this._dispatchBgReceive(remoteMessage)
  }

  async _handleClickEvent(remoteMessage, shopId) {
    const messageId = remoteMessage?.messageId
    if (messageId) {
      if (this._deps.hasSeenMessageId(messageId)) return false
      this._deps.markMessageIdSeen(messageId)
    }

    if (this._deps.isDebug()) console.log('App opened via notification', remoteMessage)

    await this._deps.updPushData(remoteMessage, shopId)
    await this._dispatchClick(remoteMessage)
  }

  _handleTokenRefresh(token) {
    if (typeof token === 'string' && token.length > 0) {
      if (this._deps.isDebug()) console.log('[Firebase] Token refreshed:', token)
      this._deps.onNewToken(token)
    }
  }

  async _handleNotifeeForeground({ type, detail }, shopId) {
    if (type !== this._deps.EventType.PRESS || !detail.notification) return

    const data = detail.notification.data || {}
    await this._deps.updPushData({ data, messageId: data.message_id }, shopId)

    if (!this._clickListener) {
      await this._dispatchClick({ data })
      return
    }

    const messageId =
      data.message_id || data['google.message_id'] || data['gcm.message_id']
    const stored = messageId
      ? await this._deps.getPushData(messageId, shopId)
      : []
    await this._dispatchClick(
      stored && stored.length > 0 ? stored[0] : { data }
    )
  }

  async _handleNotifeeBackground({ type, detail }) {
    if (type === this._deps.EventType.PRESS && detail.notification) {
      const data = detail.notification.data || {}
      await this._dispatchClick({ data })
    }
  }

  // --- Dispatch helpers --------------------------------------------------

  /** @param {any} event */
  _dispatchClick(event) {
    return (this._clickListener ?? this._deps.defaultClickListener)(event)
  }

  /** @param {any} event */
  _dispatchReceive(event) {
    return (this._receiveListener ?? this._deps.defaultReceiveListener)(event)
  }

  /** @param {any} event */
  _dispatchBgReceive(event) {
    return (this._bgReceiveListener ?? this._deps.defaultBgReceiveListener)(event)
  }
}
