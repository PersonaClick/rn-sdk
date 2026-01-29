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
import AsyncStorage from '@react-native-async-storage/async-storage'
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
import PushOrchestrator from './lib/push/PushOrchestrator'
import Performer from './lib/performer'
import { blankSearchRequest } from './utils'
import { isOverOneWeekAgo } from './utils'
import { getStorageKey } from './utils'
import { SDK_API_URL } from './index'

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
    this.deviceId = ''
    this.userSeance = ''
    this.segment = ''
    this.initialized = false
    DEBUG = debug
    this._push_type = null
    this.push_payload = []
    this.lastMessageIds = []
    this.autoSendPushToken = autoSendPushToken
    this.deviceInfo = deviceInfo
    
    // Firebase is initialized automatically by native modules
    // Initialize messaging lazily when needed
    this.messaging = null

    /**
     * Internal push orchestration (device registration, token fetch, tracking subscriptions).
     * @type {PushOrchestrator}
     */
    this._pushOrchestrator = new PushOrchestrator({
      getMessaging: () => this._ensureMessaging(),
      getToken,
      getAPNSToken,
      onMessage,
      setBackgroundMessageHandler,
      onNotificationOpenedApp,
      notifee,
      EventType,
      getPushData,
      updPushData,
      notificationDelivered: (options) => this.notificationDelivered(options),
      pushReceivedListener: (remoteMessage) =>
        this.pushReceivedListener.call(this, remoteMessage),
      pushBgReceivedListener: (remoteMessage) =>
        this.pushBgReceivedListener.call(this, remoteMessage),
      pushClickListener: (event) => this.pushClickListener.call(this, event),
      getShopId: () => this.shop_id,
      hasSeenMessageId: (messageId) => this.lastMessageIds.includes(messageId),
      markMessageIdSeen: (messageId) => {
        this.lastMessageIds.push(messageId)
      },
      isDebug: () => DEBUG,
    })
  }

  /**
   * @param {Function} command
   * @returns {void}
   */
  perform(command) {
    command()
  }

  async initializeSegment() {
    const key = getStorageKey('segment', this.shop_id)
    const segments = ['A', 'B']

    try {
      const stored = await AsyncStorage.getItem(key)
      if (stored && segments.includes(stored)) {
        this.segment = stored
        return stored
      }

      const generated = segments[Math.round(Math.random())]
      this.segment = generated
      await AsyncStorage.setItem(key, generated)
      return generated
    } catch (error) {
      const generated = segments[Math.round(Math.random())]
      this.segment = generated
      return generated
    }
  }

  _initMessaging() {
    // Initialize Firebase messaging lazily
    try {
      // Firebase initialization is the host app responsibility.
      this.messaging = getMessaging()
    } catch (error) {
      console.warn('Firebase messaging initialization failed:', error)
      this.messaging = null
    }
  }

  _ensureMessaging() {
    if (!this.messaging) {
      this._initMessaging()
    }
    return this.messaging
  }

  /**
   * @returns {void}
   */
  init() {
    ;(async () => {
      try {
        if (DEBUG) console.log('[SDK Init] Starting initialization...')
        
        if (!this.shop_id || typeof this.shop_id !== 'string') {
          const initError = new Error(
            'Parameter "shop_id" is required as a string.'
          )
          initError.name = 'Init error'
          if (DEBUG) console.error('[SDK Init] Error:', initError)
          throw initError
        }

        if (this.stream && typeof this.stream !== 'string') {
          const streamError = new Error('Parameter "stream" must be a string.')
          streamError.name = 'Init error'
          if (DEBUG) console.error('[SDK Init] Error:', streamError)
          throw streamError
        }
        
        if (DEBUG) console.log('[SDK Init] Shop ID:', this.shop_id, 'Stream:', this.stream)

        // JS SDK behavior: initialize segment before init request
        await this.initializeSegment()
        
        const storageData = await getData(this.shop_id)
        if (DEBUG) console.log('[SDK Init] Storage data:', storageData)
        
        let response = null

        if (storageData?.did) {
          if (DEBUG) console.log('[SDK Init] Using cached device ID:', storageData.did)
          this.deviceId = storageData.did
          response = storageData
          if (
            !storageData?.seance ||
            !storageData?.expires ||
            new Date().getTime() > storageData?.expires
          ) {
            response.sid = response.seance = generateSid()
            if (DEBUG) console.log('[SDK Init] Generated new session ID:', response.sid)
          }
        } else {
          if (DEBUG) console.log('[SDK Init] Making init request to API...')
          let did = ''

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
                `Device ID is not present in init args, but also 'react-native-device-info' is not present: ${JSON.stringify(
                  e,
                  undefined,
                  2
                )}`
              )
              did = ''
            }
          }

          const params = {
            shop_id: this.shop_id,
            stream: this.stream,
          }
          if (did) {
            params.did = did
          }

          response = await request('init', this.shop_id, { params })
          
          if (DEBUG) console.log('[SDK Init] API response:', response)
          
          // Check if response is an error
          if (response instanceof Error || (response && response.message)) {
            const error = response instanceof Error ? response : new Error(response.message || 'Init request failed')
            if (DEBUG) console.error('[SDK Init] API error:', error)
            this.initialized = false
            throw error
          }
        }

        if (!response || (!response.did && !storageData?.did)) {
          const error = new Error('Invalid response from init: missing device ID')
          if (DEBUG) console.error('[SDK Init] Error:', error, 'Response:', response)
          this.initialized = false
          throw error
        }

        const didToUse = response?.did || storageData?.did || ''
        this.deviceId = didToUse
        this.userSeance = response?.seance || response?.sid || ''
        if (!this.segment && response?.segment) {
          this.segment = response.segment
        }

        if (DEBUG) console.log('[SDK Init] Updating session...')
        await updSeance(this.shop_id, didToUse, response?.seance)
        
        this.initialized = true
        if (DEBUG) console.log('[SDK Init] SDK initialized successfully!')
        
        // Initialize messaging after SDK is initialized
        this._initMessaging()
        this.performQueue()
        if (this.isInit() && this.autoSendPushToken) {
          // Explicitly request push permission and register token on init.
          // This will show the system prompt on first launch if needed.
          await this.initPush()
        }
      } catch (error) {
        this.initialized = false
        console.error('[SDK Init] Initialization failed:', error)
        if (DEBUG) {
          console.error('[SDK Init] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          })
        }
        return error
      }
    })()
  }

  /**
   * @returns {boolean}
   */
  isInit = () => this.initialized

  /**
   * Gets the current device ID, ensuring it's synchronized with storage
   * @returns {Promise<string>} The device ID
   */
  async getDeviceId() {
    // Always get the latest deviceId from storage to ensure synchronization
    const storageData = await getData(this.shop_id)
    const deviceId = storageData?.did || this.deviceId || ''
    // Update instance variable for consistency
    if (deviceId && deviceId !== this.deviceId) {
      this.deviceId = deviceId
    }
    return deviceId
  }

  /**
   * @returns {Promise<string | null>}
   */
  getToken = async () => {
    try {
      const token = await this.initPushToken()
      if (DEBUG) console.log(token)
      return token ?? null
    } catch (error) {
      console.error(error)
      return null
    }
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
   * Fetch stories data for a given code
   * @param {string} code - Stories code identifier
   * @returns {Promise<Object>} - Promise that resolves with stories data
   */
  getStories(code) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          // Get current deviceId from storage to ensure it's up-to-date
          const storageData = await getData(this.shop_id)
          const deviceId = storageData?.did || this.deviceId || ''
          if (deviceId && deviceId !== this.deviceId) {
            this.deviceId = deviceId
          }
          
          const requestParams = {
            shop_id: this.shop_id,
            did: deviceId,
          }
          
          console.log('[getStories] Making request with params:', {
            url: `stories/${code}`,
            shop_id: this.shop_id,
            did: deviceId,
            code: code,
            fullUrl: `${SDK_API_URL}stories/${code}`
          })
          
          request(`stories/${code}`, this.shop_id, {
            params: requestParams,
          }).then((res) => {
            // Transform snake_case to camelCase for backgroundColor and elements
            if (res?.stories) {
              res.stories.forEach(story => {
                if (story.slides) {
                  story.slides.forEach(slide => {
                    // Convert background_color to backgroundColor
                    if (slide.background_color && !slide.backgroundColor) {
                      slide.backgroundColor = slide.background_color
                    }
                    
                    // Parse duration (convert to number if string, match iOS SDK: Int in seconds, default 10)
                    if (slide.duration !== undefined) {
                      slide.duration = typeof slide.duration === 'string' ? parseInt(slide.duration, 10) || 10 : slide.duration
                    } else {
                      // If duration is missing, set default 10 seconds (like iOS SDK)
                      slide.duration = 10
                    }
                    
                    // Convert snake_case to camelCase for elements
                    if (slide.elements && Array.isArray(slide.elements)) {
                      slide.elements.forEach(element => {
                        // text_input -> textInput
                        if (element.text_input !== undefined && element.textInput === undefined) {
                          element.textInput = element.text_input
                        }
                        // text_color -> textColor
                        if (element.text_color !== undefined && element.textColor === undefined) {
                          element.textColor = element.text_color
                        }
                        // text_background_color -> textBackgroundColor
                        if (element.text_background_color !== undefined && element.textBackgroundColor === undefined) {
                          element.textBackgroundColor = element.text_background_color
                        }
                        // text_background_color_opacity -> textBackgroundColorOpacity
                        if (element.text_background_color_opacity !== undefined && element.textBackgroundColorOpacity === undefined) {
                          element.textBackgroundColorOpacity = element.text_background_color_opacity
                        }
                        // text_align -> textAlignment
                        if (element.text_align !== undefined && element.textAlignment === undefined) {
                          element.textAlignment = element.text_align
                        }
                        // text_line_spacing -> textLineSpacing (convert to number)
                        if (element.text_line_spacing !== undefined && element.textLineSpacing === undefined) {
                          const spacing = element.text_line_spacing
                          element.textLineSpacing = typeof spacing === 'string' ? parseFloat(spacing) || 0 : spacing
                        }
                        // text_bold -> textBold
                        if (element.text_bold !== undefined && element.textBold === undefined) {
                          element.textBold = element.text_bold
                        }
                        // font_size -> fontSize (convert to number)
                        if (element.font_size !== undefined && element.fontSize === undefined) {
                          const size = element.font_size
                          element.fontSize = typeof size === 'string' ? parseFloat(size) || undefined : size
                        }
                        // font_type -> fontType
                        if (element.font_type !== undefined && element.fontType === undefined) {
                          element.fontType = element.font_type
                        }
                        // y_offset -> yOffset (convert to number)
                        if (element.y_offset !== undefined && element.yOffset === undefined) {
                          const offset = element.y_offset
                          element.yOffset = typeof offset === 'string' ? parseFloat(offset) || 0 : offset
                        }
                      })
                    }
                  })
                }
              })
            }
            
            console.log('[getStories] API response received:', {
              status: res?.status,
              hasStories: !!res?.stories,
              storiesCount: res?.stories?.length || 0,
              stories: res?.stories?.map((story, idx) => ({
                index: idx,
                id: story.id,
                name: story.name,
                avatar: story.avatar,
                slidesCount: story.slides?.length || 0,
                slides: story.slides?.map((slide, slideIdx) => ({
                  slideIndex: slideIdx,
                  id: slide.id,
                  background: slide.background,
                  backgroundColor: slide.backgroundColor,
                  background_color: slide.background_color,
                  type: slide.type,
                  elementsCount: slide.elements?.length || 0,
                  elements: slide.elements?.map(el => ({
                    type: el.type,
                    title: el.title,
                    textInput: el.textInput
                  }))
                }))
              }))
            })
            
            // Check for duplicate stories
            if (res?.stories && res.stories.length > 0) {
              const storyIds = res.stories.map(s => s.id)
              const uniqueIds = new Set(storyIds)
              if (storyIds.length !== uniqueIds.size) {
                console.warn('[getStories] WARNING: Duplicate story IDs found!', {
                  totalStories: storyIds.length,
                  uniqueStories: uniqueIds.size,
                  duplicates: storyIds.filter((id, idx) => storyIds.indexOf(id) !== idx),
                  allIds: storyIds
                })
              }
              
              // Check for identical stories
              const storyStrings = res.stories.map(s => JSON.stringify(s))
              const uniqueStories = new Set(storyStrings)
              if (storyStrings.length !== uniqueStories.size) {
                console.warn('[getStories] WARNING: Identical story objects found!', {
                  totalStories: storyStrings.length,
                  uniqueStories: uniqueStories.size,
                  duplicatesCount: storyStrings.length - uniqueStories.size
                })
              }
            }
            
            console.log('[getStories] Full API response:', JSON.stringify(res, null, 2))
            resolve(res)
          }).catch((error) => {
            console.error('[getStories] Request error:', error)
            reject(error)
          })
        } catch (error) {
          console.error('[getStories] Error:', error)
          reject(error)
        }
      })
    })
  }

  /**
   * Track story slide view event
   * @param {string|number} storyId - Story identifier (string id or numeric ids)
   * @param {string|number} slideId - Slide identifier (string id or numeric ids)
   * @param {string} code - Stories code
   * @returns {Promise<Object>} - Promise that resolves with tracking response
   */
  trackStoryView(storyId, slideId, code) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          // Get current deviceId from storage to ensure it's up-to-date
          const storageData = await getData(this.shop_id)
          const deviceId = storageData?.did || this.deviceId || ''
          if (deviceId && deviceId !== this.deviceId) {
            this.deviceId = deviceId
          }
          
          // Validate that storyId is a positive integer (API requires number)
          const numericStoryId = Number(storyId)
          if (isNaN(numericStoryId) || numericStoryId <= 0 || !Number.isInteger(numericStoryId)) {
            console.warn('Invalid story_id for tracking:', storyId, 'Expected positive integer')
            reject(new Error(`Invalid story_id: ${storyId}. Expected positive integer.`))
            return
          }
          
          // Validate that slideId is a positive integer
          const numericSlideId = Number(slideId)
          if (isNaN(numericSlideId) || numericSlideId <= 0 || !Number.isInteger(numericSlideId)) {
            console.warn('Invalid slide_id for tracking:', slideId, 'Expected positive integer')
            reject(new Error(`Invalid slide_id: ${slideId}. Expected positive integer.`))
            return
          }
          
          request('track/stories', this.shop_id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            params: {
              shop_id: this.shop_id,
              did: deviceId,
              seance: this.userSeance,
              sid: this.userSeance,
              segment: this.segment,
              story_id: numericStoryId,
              slide_id: numericSlideId,
              code: code,
              event: 'view',
            },
          }).then((res) => {
            resolve(res)
          }).catch((error) => {
            reject(error)
          })
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * Track story slide click event
   * @param {string|number} storyId - Story identifier (string id or numeric ids)
   * @param {string|number} slideId - Slide identifier (string id or numeric ids)
   * @param {string} code - Stories code
   * @returns {Promise<Object>} - Promise that resolves with tracking response
   */
  trackStoryClick(storyId, slideId, code) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          // Get current deviceId from storage to ensure it's up-to-date
          const storageData = await getData(this.shop_id)
          const deviceId = storageData?.did || this.deviceId || ''
          if (deviceId && deviceId !== this.deviceId) {
            this.deviceId = deviceId
          }
          
          // Validate that storyId is a positive integer (API requires number)
          const numericStoryId = Number(storyId)
          if (isNaN(numericStoryId) || numericStoryId <= 0 || !Number.isInteger(numericStoryId)) {
            console.warn('Invalid story_id for tracking:', storyId, 'Expected positive integer')
            reject(new Error(`Invalid story_id: ${storyId}. Expected positive integer.`))
            return
          }
          
          // Validate that slideId is a positive integer
          const numericSlideId = Number(slideId)
          if (isNaN(numericSlideId) || numericSlideId <= 0 || !Number.isInteger(numericSlideId)) {
            console.warn('Invalid slide_id for tracking:', slideId, 'Expected positive integer')
            reject(new Error(`Invalid slide_id: ${slideId}. Expected positive integer.`))
            return
          }
          
          // Debug logging
          console.log('trackStoryClick called with:', {
            storyId: numericStoryId,
            slideId: numericSlideId,
            code: code
          })
          
          request('track/stories', this.shop_id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            params: {
              shop_id: this.shop_id,
              did: deviceId,
              seance: this.userSeance,
              sid: this.userSeance,
              segment: this.segment,
              story_id: numericStoryId,
              slide_id: numericSlideId,
              code: code,
              event: 'click',
            },
          }).then((res) => {
            resolve(res)
          }).catch((error) => {
            reject(error)
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
            await this.initPushChannel()
            const token = await this.initPushToken(false)
            if (token) {
              await saveLastPushTokenSentDate(new Date(), this.shop_id)
            }
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
    if (typeof token !== 'string' || token.length === 0) {
      if (DEBUG) console.log('Push token is empty, skipping send')
      return
    }

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
   * @returns {Promise<string | null>}
   */
  async initPushToken(removeOld = false) {
    let savedToken = await getSavedPushToken(this.shop_id)
    if (removeOld) {
      await this.deleteToken()
      savedToken = false
    }

    if (savedToken) {
      if (DEBUG) console.log('Old valid FCM token: ', savedToken)
      // Even when token is already cached, ensure tracking subscriptions are installed.
      await this._pushOrchestrator.ensureTrackingSubscriptions()
      return savedToken
    }

    const messaging = this._ensureMessaging()
    if (!messaging) {
      console.warn('Firebase messaging not available')
      return null
    }

    const token = await this._pushOrchestrator.fetchToken({
      messaging,
      pushType: this._push_type,
      platformOS: Platform.OS,
    })

    if (!token) return null
    this.setPushTokenNotification(token)
    return token
  }

  /**
   * @returns {Promise<void>}
   */
  async initPushChannel() {
    if (Platform.OS !== 'android') return
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
    // Always allow updating listeners, even if initPush() is called repeatedly.
    if (notifyClick) {
      this.pushClickListener = notifyClick
      this._pushOrchestrator.setHasCustomClickListener(true)
    }
    if (notifyReceive) this.pushReceivedListener = notifyReceive
    if (notifyBgReceive) this.pushBgReceivedListener = notifyBgReceive

    const lock = await initLocker(this.shop_id)
    if (
      lock &&
      lock.hasOwnProperty('state') &&
      lock.state === true &&
      new Date().getTime() < lock.expires
    ) {
      // Ensure subscriptions exist even if init is locked.
      await this._pushOrchestrator.ensureTrackingSubscriptions()
      return false
    }

    await setInitLocker(true, this.shop_id)
    const granted = await this.getPushPermission()
    if (!granted) return false

    await this.initPushChannel()
    await this.initPushToken(false)

    await this._pushOrchestrator.ensureTrackingSubscriptions()
    return true
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
      const messaging = this._ensureMessaging()
      if (messaging) {
        await deleteToken(messaging)
      }
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
                segment: this.segment || null,
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

  getCurrentSegment() {
    return this.segment
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
