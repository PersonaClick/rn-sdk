export default class PushOrchestrator {
  /**
   * @param {{
   *   getMessaging: () => any | null,
   *   getToken: (messaging: any) => Promise<any>,
   *   getAPNSToken: (messaging: any) => Promise<any>,
   *   onMessage: (messaging: any, cb: Function) => (Function | void),
   *   setBackgroundMessageHandler: (messaging: any, cb: Function) => void,
   *   onNotificationOpenedApp: (messaging: any, cb: Function) => (Function | void),
   *   notifee: any,
   *   EventType: any,
   *   getPushData: (messageId: string, shopId: string) => Promise<any[]>,
   *   updPushData: (remoteMessage: any, shopId: string) => Promise<any>,
   *   notificationDelivered: (options: { code: string, type: string }) => Promise<any>,
   *   pushReceivedListener: (remoteMessage: any) => Promise<any>,
   *   pushBgReceivedListener: (remoteMessage: any) => Promise<any>,
   *   pushClickListener: (event: any) => Promise<any>,
   *   getShopId: () => string,
   *   hasSeenMessageId: (messageId: string) => boolean,
   *   markMessageIdSeen: (messageId: string) => void,
   *   isDebug: () => boolean,
   * }} deps
   */
  constructor(deps) {
    this._deps = deps

    /** @type {boolean} */
    this._hasCustomPushClickListener = false

    /** @type {boolean} */
    this._trackingSubscribed = false
    /** @type {Promise<boolean> | null} */
    this._trackingPromise = null

    /** @type {Promise<string|null> | null} */
    this._tokenPromise = null

    /** @type {Function | null} */
    this._unsubOnMessage = null
    /** @type {Function | null} */
    this._unsubOnNotificationOpened = null
    /** @type {Function | null} */
    this._unsubNotifeeForeground = null

    /** @type {boolean} */
    this._backgroundMessageHandlerSet = false
    /** @type {boolean} */
    this._notifeeBackgroundHandlerSet = false
    /** @type {boolean} */
    this._notifeeInitialChecked = false
  }

  /**
   * @param {boolean} val
   */
  setHasCustomClickListener(val) {
    if (val) this._hasCustomPushClickListener = true
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

    // Prefer the callable API to avoid deprecated property access.
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
      // If SDK knows we are not registered, treat it as a hard failure.
      // Otherwise (unknown/older versions) ignore and let token fetch decide.
      if (isRegistered === false) throw e
      if (this._deps.isDebug()) console.log('registerDeviceForRemoteMessages failed', e)
    }
  }

  /**
   * Fetches token and ensures tracking subscriptions exist once token is known.
   * Dedupes concurrent calls.
   *
   * @param {{
   *   messaging: any,
   *   pushType: string | null,
   *   platformOS: string
   * }} args
   * @returns {Promise<string|null>}
   */
  async fetchToken(args) {
    if (this._tokenPromise) return this._tokenPromise

    const { messaging, pushType, platformOS } = args

    this._tokenPromise = (async () => {
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
          return null
        }

        await this.ensureTrackingSubscriptions()
        return token
      } catch (error) {
        console.log('initPushToken error', error)
        return null
      } finally {
        this._tokenPromise = null
      }
    })()

    return this._tokenPromise
  }

  /**
   * Installs push tracking subscriptions only once.
   *
   * @returns {Promise<boolean>}
   */
  async ensureTrackingSubscriptions() {
    if (this._trackingSubscribed) return true
    if (this._trackingPromise) return this._trackingPromise

    this._trackingPromise = (async () => {
      try {
        const messaging = this._deps.getMessaging()
        const shopId = this._deps.getShopId()

        if (messaging && !this._unsubOnMessage) {
          const unsub = this._deps.onMessage(messaging, async (remoteMessage) => {
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
            await this._deps.pushReceivedListener(remoteMessage)
          })

          this._unsubOnMessage = typeof unsub === 'function' ? unsub : () => {}
        }

        if (messaging && !this._backgroundMessageHandlerSet) {
          this._deps.setBackgroundMessageHandler(messaging, async (remoteMessage) => {
            const messageId = remoteMessage?.messageId
            if (messageId) {
              if (this._deps.hasSeenMessageId(messageId)) return false
              this._deps.markMessageIdSeen(messageId)
            }

            await this._deps.notificationDelivered({
              code: remoteMessage.data.id,
              type: remoteMessage.data.type,
            })
            if (this._deps.isDebug()) console.log('Background message delivered: ', remoteMessage)

            await this._deps.updPushData(remoteMessage, shopId)
            await this._deps.pushBgReceivedListener(remoteMessage)
          })
          this._backgroundMessageHandlerSet = true
        }

        if (messaging && !this._unsubOnNotificationOpened) {
          const unsub = this._deps.onNotificationOpenedApp(
            messaging,
            async (remoteMessage) => {
              const messageId = remoteMessage?.messageId
              if (messageId) {
                if (this._deps.hasSeenMessageId(messageId)) return false
                this._deps.markMessageIdSeen(messageId)
              }

              await this._deps.notificationDelivered({
                code: remoteMessage.data.id,
                type: remoteMessage.data.type,
              })
              if (this._deps.isDebug()) console.log('App opened via notification', remoteMessage)

              await this._deps.updPushData(remoteMessage, shopId)
              await this._deps.pushBgReceivedListener(remoteMessage)
            }
          )

          this._unsubOnNotificationOpened =
            typeof unsub === 'function' ? unsub : () => {}
        }

        if (!this._unsubNotifeeForeground) {
          const unsub = this._deps.notifee.onForegroundEvent(async ({ type, detail }) => {
            if (type !== this._deps.EventType.PRESS || !detail.notification) return

            const n = detail.notification
            const data = n.data || {}

            await this._deps.updPushData({ data, messageId: data.message_id }, shopId)

            if (!this._hasCustomPushClickListener) {
              await this._deps.pushClickListener({ data })
              return
            }

            const messageId =
              data.message_id || data['google.message_id'] || data['gcm.message_id']
            const stored = messageId ? await this._deps.getPushData(messageId, shopId) : []
            await this._deps.pushClickListener(
              stored && stored.length > 0 ? stored[0] : { data }
            )
          })

          this._unsubNotifeeForeground = typeof unsub === 'function' ? unsub : () => {}
        }

        if (!this._notifeeBackgroundHandlerSet) {
          this._deps.notifee.onBackgroundEvent(async ({ type, detail }) => {
            if (type === this._deps.EventType.PRESS && detail.notification) {
              const data = detail.notification.data || {}
              await this._deps.pushClickListener({ data })
            }
          })
          this._notifeeBackgroundHandlerSet = true
        }

        if (!this._notifeeInitialChecked) {
          const initial = await this._deps.notifee.getInitialNotification()
          if (initial?.notification) {
            const data = initial.notification.data || {}
            await this._deps.pushClickListener({ data })
          }
          this._notifeeInitialChecked = true
        }

        this._trackingSubscribed = true
        return true
      } catch (e) {
        if (this._deps.isDebug()) console.log('Failed to setup push tracking subscriptions', e)
        return false
      } finally {
        this._trackingPromise = null
      }
    })()

    return this._trackingPromise
  }
}

