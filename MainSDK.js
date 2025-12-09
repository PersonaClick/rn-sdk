import { Linking } from 'react-native'
import { initLocker } from './lib/client'
import { request } from './lib/client'
import { setInitLocker } from './lib/client'
import { updSeance } from './lib/client'
import { getPushData } from './lib/client'
import { updPushData } from './lib/client'
import { removePushMessage } from './lib/client'
import { getData } from './lib/client'
import { generateSid } from './lib/client'
import { getSavedPushToken } from './lib/client'
import { savePushToken } from './lib/client'
import { getLastPushTokenSentDate } from './lib/client'
import { saveLastPushTokenSentDate } from './lib/client'
import { convertParams } from './lib/tracker'
import { NotificationManager } from './lib/notification'
import { PermissionsAndroid } from 'react-native'
import { Platform } from 'react-native'
import { getMessaging } from '@react-native-firebase/messaging'
import { onMessage } from '@react-native-firebase/messaging'
import { setBackgroundMessageHandler } from '@react-native-firebase/messaging'
import { getToken } from '@react-native-firebase/messaging'
import { getAPNSToken } from '@react-native-firebase/messaging'
import { deleteToken } from '@react-native-firebase/messaging'
import { onNotificationOpenedApp } from '@react-native-firebase/messaging'
import notifee from '@notifee/react-native'
import { AndroidImportance } from '@notifee/react-native'
import { AndroidStyle } from '@notifee/react-native'
import { EventType } from '@notifee/react-native'
import { AuthorizationStatus } from '@notifee/react-native'
import { SDK_PUSH_CHANNEL } from './index'
import Performer from './lib/performer'
import { blankSearchRequest } from './utils'
import { isOverOneWeekAgo } from './utils'

/**
 * @typedef {Object} Event
 * @property {string} type
 * @property {string} uri
 */

/**
 * @typedef {Object} GoogleData
 * @property {string} message_id
 * @property {string} ["gcm.message_id"]
 */

/**
 * @typedef {Object} DeviceInfo
 * @property {string} id
 */

/**
 * @typedef {Object} Data
 * @property {string} message_id
 * @property {string} ["google.message_id"]
 * @property {string} ["gcm.message_id"]
 * @property {string} from
 * @property {number} ttl
 * @property {number} sentTime
 * @property {string} id
 * @property {string | undefined} event
 * @property {string} type
 * @property {GoogleData} google
 */

/**
 * @typedef {Object} Notification
 * @property {Data} [data]
 * @property {boolean} userInteraction
 * @property {boolean} foreground
 * @property {string} channelId
 * @property {string} id
 * @property {string} message
 * @property {string} title
 */

export var DEBUG = false

class MainSDK extends Performer {
  /**
   * @param {string} shop_id
   * @param {string} stream
   * @param {boolean?} debug
   * @param {boolean?} autoSendPushToken
   * @param {DeviceInfo?} deviceInfo
   */
  constructor(
    shop_id,
    stream,
    debug = false,
    autoSendPushToken = true,
    deviceInfo = null
  ) {
    let queue = []
    super(queue)
    this.shop_id = shop_id
    this.stream = stream ?? null
    this.initialized = false
    DEBUG = debug
    this._push_type = null
    this.push_payload = []
    this.lastMessageIds = []
    this.autoSendPushToken = autoSendPushToken
    this.messaging = getMessaging()
    this.deviceInfo = deviceInfo
  }

  /**
   * @param {Function} command
   * @returns {void}
   */
  perform(command) {
    command()
  }

  /**
   * @returns {void}
   */
  init() {
    ;(async () => {
      try {
        if (!this.shop_id || typeof this.shop_id !== 'string') {
          const initError = new Error(
            'Parameter "shop_id" is required as a string.'
          )
          initError.name = 'Init error'
          throw initError
        }

        if (this.stream && typeof this.stream !== 'string') {
          const streamError = new Error('Parameter "stream" must be a string.')
          streamError.name = 'Init error'
          throw streamError
        }
        const storageData = await getData(this.shop_id)
        let response = null

        if (storageData?.did) {
          response = storageData
          if (
            !storageData?.seance ||
            !storageData?.expires ||
            new Date().getTime() > storageData?.expires
          ) {
            response.sid = response.seance = generateSid()
          }
        } else {
          let did

          if (this.deviceInfo && this.deviceInfo.id) {
            did = this.deviceInfo.id
          } else {
            try {
              const DeviceInfo = await import('react-native-device-info')
              did =
                Platform.OS === 'android'
                  ? await DeviceInfo.getAndroidId()
                  : (await DeviceInfo.syncUniqueId()) || ''
            } catch (e) {
              console.error(
                `Device ID is not present in init args, but also 'react-native-device-info' is not present: ${JSON.stringify(e, undefined, 2)}`
              )
              did = ''
            }
          }

          response = await request('init', this.shop_id, {
            params: {
              did,
              shop_id: this.shop_id,
              stream: this.stream,
            },
          })
        }

        updSeance(this.shop_id, response?.did, response?.seance).then(
          async () => {
            this.initialized = true
            this.performQueue()
            this.initPushChannelAndToken()
            if (this.isInit() && this.autoSendPushToken) {
              await this.sendPushToken()
            }
          }
        )
      } catch (error) {
        this.initialized = false
        return error
      }
    })()
  }

  /**
   * @returns {boolean}
   */
  isInit = () => this.initialized

  /**
   * @returns {Promise<string | undefined>}
   */
  getToken = () => {
    return this.initPushToken()
      .then((token) => {
        if (DEBUG) console.log(token)
        return token
      })
      .catch((error) => {
        console.error(error)
      })
  }

  /**
   * @param {import('@react-native-firebase/messaging').RemoteMessage} remoteMessage
   * @returns {Promise<void>}
   */
  pushReceivedListener = async function (remoteMessage) {
    await this.showNotification(remoteMessage)
  }

  /**
   * @param {import('@react-native-firebase/messaging').RemoteMessage} remoteMessage
   * @returns {Promise<void>}
   */
  pushBgReceivedListener = async function (remoteMessage) {
    await this.showNotification(remoteMessage)
  }

  /**
   * @returns {Promise<void>}
   */
  pushClickListener = async function (event) {
    await this.onClickPush(event)
  }

  track(event, options) {
    this.push(async () => {
      try {
        const queryParams = await convertParams(event, options)
        return await request('push', this.shop_id, {
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          params: {
            shop_id: this.shop_id,
            stream: this.stream,
            ...queryParams,
          },
        })
      } catch (error) {
        return error
      }
    })
  }

  /**
   * @param {string} event
   * @param {Record<string, any>} options
   * @returns {void}
   */
  trackEvent(event, options) {
    this.push(async () => {
      try {
        let queryParams = { event: event }
        if (options) {
          queryParams = Object.assign(queryParams, options)
        }

        return await request('push/custom', this.shop_id, {
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          params: {
            shop_id: this.shop_id,
            stream: this.stream,
            ...queryParams,
          },
        })
      } catch (error) {
        return error
      }
    })
  }

  /**
   * Track user clicked/tapped on notification
   * @param {NotificationEventOptions} options
   */
  notificationClicked(options) {
    return this.notificationTrack('clicked', options)
  }

  /**
   * Track notification shown to user
   * @param {NotificationEventOptions} options
   */
  notificationOpened(options) {
    return this.notificationTrack('opened', options)
  }

  /**
   * Track notification delivered to user device
   * @param {NotificationEventOptions} options
   */
  notificationDelivered(options) {
    return this.notificationTrack('delivered', options)
  }

  /**
   * Send notification track
   * @param {'opened' | 'clicked' | 'delivered'} event
   * @param {{ type: 'bulk' | 'chain' | 'transactional' | string, code: string }} options
   */
  notificationTrack(event, options) {
    this.push(async () => {
      try {
        return await request(`track/${event}`, this.shop_id, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          params: {
            shop_id: this.shop_id,
            stream: this.stream,
            ...options,
          },
        })
      } catch (error) {
        return error
      }
    })
  }

  /**
   * @param {string} recommender_code
   * @param {Record<string, any>} options
   * @returns {Promise<any>}
   */
  recommend(recommender_code, options) {
    return new Promise((resolve, reject) => {
      this.push(() => {
        try {
          request(`recommend/${recommender_code}`, this.shop_id, {
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
              recommender_code,
              ...options,
            },
          }).then((res) => {
            resolve(res)
          })
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * @returns {Promise<any>}
   */
  cart() {
    return new Promise((resolve, reject) => {
      this.push(() => {
        try {
          request('products/cart', this.shop_id, {
            params: {
              shop_id: this.shop_id,
            },
          }).then((res) => {
            resolve(res)
          })
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * Executes a search with the given parameters.
   *
   * @param {SearchOptions|undefined} [options] - An object of parameters for the search or undefined.
   * @returns {Promise<SearchResponse>} - A promise that resolves with the search results.
   * @throws {Error} - Error thrown when the request fails.
   */
  search(options) {
    return new Promise((resolve, reject) => {
      this.push(() => {
        try {
          request('search', this.shop_id, {
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
              ...options,
            },
          }).then((res) => {
            resolve(res)
          })
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * Executes a blank search.
   *
   * @returns {Promise<Record<string, any>} - A promise with the request result.
   */
  searchBlank() {
    return blankSearchRequest(this.shop_id, this.stream)
  }

  /**
   * @param {Record<string, any>} params
   * @returns {void}
   */
  setProfile(params) {
    this.push(async () => {
      if (
        params.hasOwnProperty('birthday') &&
        !params.birthday.match(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        delete params.birthday
      }
      for (let key in params) {
        if (typeof params[key] === 'object') {
          params[key] = JSON.stringify(params[key])
        }
      }
      try {
        return await request('profile/set', this.shop_id, {
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          params: {
            shop_id: this.shop_id,
            stream: this.stream,
            ...params,
          },
        })
      } catch (error) {
        return error
      }
    })
  }

  /**
   * @returns {Promise<any>}
   */
  getProfile() {
    return new Promise((resolve, reject) => {
      this.push(() => {
        try {
          request('profile', this.shop_id, {
            method: 'GET',
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
            },
          }).then((res) => {
            resolve(res)
          })
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * Checks if the last sent date of the push token is over one week ago and if push permissions should be asked.
   * @returns {Promise<boolean>} A promise that resolves to true if a new token needs to be sent, false otherwise.
   */
  async checkPushToken() {
    const lastSentDate = await getLastPushTokenSentDate(this.shop_id)
    return !lastSentDate || isOverOneWeekAgo(lastSentDate)
  }

  /**
   * Sends a new push token if permissions are granted.
   * @returns {Promise<void>} A promise that resolves when the token sending process is complete.
   */
  async sendPushToken() {
    try {
      if (await this.checkPushToken()) {
        this.push(async () => {
          if (await this.getPushPermission()) {
            this.initPushChannel()
            await this.initPushToken(false)
            await saveLastPushTokenSentDate(new Date(), this.shop_id)
          }
        })
      }
    } catch (error) {
      console.error('Error sending token:', error)
    }
  }

  /**
   * @param {string} token
   * @returns {void}
   */
  setPushTokenNotification(token) {
    this.push(async () => {
      try {
        let platform

        if (this._push_type !== null) {
          platform = this._push_type
        } else {
          if (Platform.OS === 'ios') {
            platform = 'ios'
          } else {
            platform = 'android'
          }
        }

        if (DEBUG) console.log(`Push token platform: '${platform}'`)

        return await request('mobile_push_tokens', this.shop_id, {
          method: 'POST',
          params: {
            shop_id: this.shop_id,
            stream: this.stream,
            token,
            platform,
          },
        }).then(async (data) => {
          if (data.status === 'success') {
            await savePushToken(token, this.shop_id)
            await saveLastPushTokenSentDate(new Date(), this.shop_id)
          }
          return data
        })
      } catch (error) {
        return error
      }
    })
  }

  firebase_only(val) {
    this._push_type = val ? 'android' : null
  }

  /**
   * Are push notificaitons allowed
   * @returns {Promise<boolean>}
   */
  async getPushPermission() {
    let result = false
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            ? PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            : PermissionsAndroid.PERMISSIONS.POST_NOTIFICATION
        )
        result = granted === PermissionsAndroid.RESULTS.GRANTED
      } catch (err) {
        console.log(err)
      }
    } else {
      const settings = await notifee.requestPermission()

      if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
        if (DEBUG) console.log('User denied permissions request')
        return false
      } else if (
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED
      ) {
        if (DEBUG) console.log('User granted permissions request')
        return true
      } else if (
        settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
      ) {
        if (DEBUG) console.log('User provisionally granted permissions request')
        return true
      }

      return false
    }
  }

  /**
   * @param {boolean} removeOld
   * @returns {Promise<string, Error>}
   */
  async initPushToken(removeOld = false) {
    let savedToken = await getSavedPushToken(this.shop_id)
    if (removeOld) {
      await this.deleteToken()
      savedToken = false
    }

    if (savedToken) {
      if (DEBUG) console.log('Old valid FCM token: ', savedToken)
      return savedToken
    }

    let pushToken

    if (this._push_type === null && Platform.OS === 'ios') {
      getAPNSToken(this.messaging).then((token) => {
        if (DEBUG) console.log('New APN token: ', token)
        this.setPushTokenNotification(token)
        pushToken = token
      })
    } else {
      getToken(this.messaging).then((token) => {
        if (DEBUG) console.log('New FCM token: ', token)
        this.setPushTokenNotification(token)
        pushToken = token
      })
    }
    return pushToken
  }

  /**
   * @returns {Promise<void>}
   */
  async initPushChannel() {
    await notifee.createChannel({
      id: SDK_PUSH_CHANNEL,
      name: 'RNSDK channel',
      importance: AndroidImportance.HIGH,
    })
  }

  /**
   * @returns {void}
   */
  initPushChannelAndToken() {
    this.push(async () => {
      const granted = await this.getPushPermission()
      if (!granted) return
      await this.initPushChannel()
      await this.initPushToken(false)
    })
  }

  /**
   * Init push
   * @param {boolean | Function} notifyClick
   * @param {boolean | Function} notifyReceive
   * @param {boolean | Function} notifyBgReceive
   * @returns {Promise<boolean>}
   */
  async initPush(
    notifyClick = false,
    notifyReceive = false,
    notifyBgReceive = false
  ) {
    const lock = await initLocker(this.shop_id)
    if (
      lock &&
      lock.hasOwnProperty('state') &&
      lock.state === true &&
      new Date().getTime() < lock.expires
    ) {
      return false
    }

    await setInitLocker(true, this.shop_id)

    this.initPushChannelAndToken()
    if (notifyClick) this.pushClickListener = notifyClick
    if (notifyReceive) this.pushReceivedListener = notifyReceive
    if (notifyBgReceive) this.pushBgReceivedListener = notifyBgReceive

    // Register handler
    onMessage(this.messaging, async (remoteMessage) => {
      if (this.lastMessageIds.includes(remoteMessage.messageId)) {
        return false
      } else {
        this.lastMessageIds.push(remoteMessage.messageId)
      }

      await this.notificationDelivered({
        code: remoteMessage.data.id,
        type: remoteMessage.data.type,
      })
      if (DEBUG) console.log('Message delivered: ', remoteMessage)

      await updPushData(remoteMessage, this.shop_id)
      await this.pushReceivedListener(remoteMessage)
    })

    // Register background handler
    setBackgroundMessageHandler(this.messaging, async (remoteMessage) => {
      if (this.lastMessageIds.includes(remoteMessage.messageId)) {
        return false
      } else {
        this.lastMessageIds.push(remoteMessage.messageId)
      }

      await this.notificationDelivered({
        code: remoteMessage.data.id,
        type: remoteMessage.data.type,
      })
      if (DEBUG) console.log('Background message delivered: ', remoteMessage)

      await updPushData(remoteMessage, this.shop_id)
      await this.pushBgReceivedListener(remoteMessage)
    })

    // Register background handler
    onNotificationOpenedApp(this.messaging, async (remoteMessage) => {
      if (this.lastMessageIds.includes(remoteMessage.messageId)) {
        return false
      } else {
        this.lastMessageIds.push(remoteMessage.messageId)
      }

      await this.notificationDelivered({
        code: remoteMessage.data.id,
        type: remoteMessage.data.type,
      })
      if (DEBUG) console.log('App opened via notification', remoteMessage)

      await updPushData(remoteMessage, this.shop_id)
      await this.pushBgReceivedListener(remoteMessage)
    })

    /** Subscribe to click notification */
    notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS && detail.notification) {
        const n = detail.notification
        const data = n.data || {}
        await updPushData({ data, messageId: data.message_id }, this.shop_id)
        if (!notifyClick) {
          await this.pushClickListener({ data })
        } else {
          const messageId =
            data.message_id ||
            data['google.message_id'] ||
            data['gcm.message_id']
          const stored = await getPushData(messageId, this.shop_id)
          await this.pushClickListener(
            stored && stored.length > 0 ? stored[0] : { data }
          )
        }
      }
    })

    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS && detail.notification) {
        const data = detail.notification.data || {}
        await this.pushClickListener({ data })
      }
    })

    const initial = await notifee.getInitialNotification()
    if (initial?.notification) {
      const data = initial.notification.data || {}
      await this.pushClickListener({ data })
    }
  }

  /**
   * Show push notification to user
   * @param {{ data: { id: string, type: string }}} message
   * @returns {Promise<void>}
   */
  async showNotification(message) {
    if (DEBUG) console.log('Show notification: ', message)
    await updPushData(message, this.shop_id)
    await this.notificationOpened({
      code: message.data.id,
      type: message.data.type,
    })
    await this.initPushChannel()
    const data = {
      ...(message.messageId && { message_id: message.messageId }),
      ...(message.data.id && { id: message.data.id }),
      ...(message.data.type && { type: message.data.type }),
      ...(message.data.icon && { icon: message.data.icon }),
      ...(message.data.image_url && { image: message.data.image_url }),
      ...(message.data.image && { image: message.data.image }),
      ...(message.from && { from: message.from }),
      ...(message.sentTime && { sentTime: `${message.sentTime}` }),
      ...(message.ttl && { ttl: `${message.ttl}` }),
    }
    const android = {
      channelId: SDK_PUSH_CHANNEL,
      pressAction: { id: 'default' },
      ...(message.data.icon && { largeIcon: message.data.icon }),
      ...(message.data.image && {
        type: AndroidStyle.BIGPICTURE,
        picture: message.data.image,
      }),
    }
    await notifee.displayNotification({
      title: message.data.title,
      body: message.data.body,
      data,
      android,
    })
  }

  /**
   * @param {string} trigger_name
   * @param {Record<string, any>} data
   * @returns {void}
   */
  triggers(trigger_name, data) {
    this.push(async () => {
      try {
        return await request(`subscriptions/${trigger_name}`, this.shop_id, {
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          params: Object.assign(
            {
              shop_id: this.shop_id,
              stream: this.stream,
            },
            data
          ),
        })
      } catch (error) {
        return error
      }
    })
  }

  /**
   * @returns {Promise<void>}
   */
  async deleteToken() {
    return savePushToken(false, this.shop_id).then(async () => {
      await deleteToken(this.messaging)
    })
  }

  /**
   * @param {string} action
   * @param {Record<string, any>} data
   * @returns {void}
   */
  subscriptions(action, data) {
    this.triggers(action, data)
  }

  /**
   * @param {string} action
   * @param {Record<string, any>} data
   */
  segments(action, data) {
    return new Promise((resolve, reject) => {
      this.push(() => {
        try {
          request(`segments/${action}`, this.shop_id, {
            headers: { 'Content-Type': 'application/json' },
            method: action === 'get' ? 'GET' : 'POST',
            params: Object.assign(
              {
                shop_id: this.shop_id,
                stream: this.stream,
              },
              data
            ),
          }).then((res) => {
            resolve(res)
          })
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * @param {import('react-native-push-notification').ReceivedNotification} [notification]
   * @returns {Promise<boolean | Error | void>}
   */
  async onClickPush(notification) {
    const messageId =
      notification.data?.message_id ||
      notification.data?.['google.message_id'] ||
      notification.data?.['gcm.message_id']
    let pushData = await getPushData(messageId, this.shop_id)
    if (pushData.length === 0) return false

    await removePushMessage(messageId, this.shop_id)
    this.notificationClicked({
      code: notification?.data?.id,
      type: notification?.data?.type,
    })

    const event = pushData[0].data.event
    if (!event) return false

    /** @type {Event | null} */
    const message_event = JSON.parse(event)
    let message_url = ''
    switch (message_event.type) {
      case 'web':
        message_url = message_event.uri
        break
      case 'product':
        try {
          await request(
            `products/get?item_id=${message_event.uri}&shop_id=${this.shop_id}`,
            this.shop_id,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              params: {
                shop_id: this.shop_id,
                stream: this.stream,
              },
            }
          ).then((data) => {
            message_url = data.url
          })
        } catch (error) {
          return error
        }
        break
      case 'category':
        try {
          await request(
            `category/${message_event.uri}?shop_id=${this.shop_id}`,
            this.shop_id,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              params: {
                shop_id: this.shop_id,
                stream: this.stream,
              },
            }
          ).then((data) => {
            message_url = data.categories.find(
              (x) => x.id === message_event.uri
            ).url
          })
        } catch (error) {
          return error
        }
        break
    }

    const supported = await Linking.openURL(message_url)
    if (supported) {
      await Linking.openURL(message_url)
    } else {
      console.log(`error open URL: ${message_url}`)
    }
  }

  /**
   * @param {import('@notifee/react-native').Notification} [params]
   */
  async showInAppNotification(params) {
    NotificationManager.showNotification(params)
  }
}

export default MainSDK
