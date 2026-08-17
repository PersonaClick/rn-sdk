import PushRouter from './PushRouter'

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

    /** @type {Promise<string|null> | null} */
    this._tokenPromise = null
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
   * Installs the process-global push subscriptions. Delegates to the process-wide {@link PushRouter},
   * which installs the FCM/notifee handlers exactly once and routes every event to the instance its
   * `shop_id` names (Release 4, RN-13). Idempotent; single-instance behaviour is unchanged (the one
   * live shop is the fallback target). Signature and return type are preserved so callers are
   * untouched.
   *
   * @returns {Promise<boolean>}
   */
  async installSubscriptions() {
    return PushRouter.ensureInstalled(this._deps)
  }

  /**
   * Processes a single FCM cold-start payload for this instance: dedup by messageId, buffer for
   * replay, push backend tracking, dispatch through the click pipeline. Called by the router once it
   * has resolved which instance the cold-start belongs to.
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
    await this._deps.updPushData(fcmInitial, shopId)
    await this._dispatchClick(fcmInitial)
  }

  /**
   * Processes a notifee cold-start payload for this instance: buffers it for replay and dispatches
   * through the click pipeline. Called by the router once it has resolved the target instance.
   *
   * @param {{ data: object }} payload
   * @returns {Promise<void>}
   */
  async _processNotifeeColdStart(payload) {
    this._lastColdStart = payload
    await this._dispatchClick(payload)
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
