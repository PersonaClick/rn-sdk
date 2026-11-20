import { Linking } from 'react-native'
import { initLocker } from './lib/client'
import { request } from './lib/client'
import { setInitLocker } from './lib/client'
import { updSeance } from './lib/client'
import { getPushData } from './lib/client'
import { updPushData } from './lib/client'
import { removePushMessage } from './lib/client'
import { getData } from './lib/client'
import { migrateLegacyIdentity } from './lib/client'
import { generateSid } from './lib/client'
import { setShopRefused } from './lib/client'
import { setNativeIdentity } from './lib/client'
import { retireLegacyIdentity } from './lib/client'
import { setShopHosts, appHostOf } from './lib/client'
import { knownOffline, waitForReconnect } from './lib/network'
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
import { getInitialNotification } from '@react-native-firebase/messaging'
import { onTokenRefresh } from '@react-native-firebase/messaging'
import notifee from '@notifee/react-native'
import { AndroidImportance } from '@notifee/react-native'
import { AndroidStyle } from '@notifee/react-native'
import { EventType } from '@notifee/react-native'
import { AuthorizationStatus } from '@notifee/react-native'
import { SDK_PUSH_CHANNEL } from './index'
import PushOrchestrator from './lib/push/PushOrchestrator'
import displayPush from './lib/push/displayPush'
import Performer from './lib/performer'
import { nativeBridge, DEFAULT_STREAM } from './lib/native/bridge'
import { trackingEvents, sourceTypeValue, contractPurchase } from './lib/tracking/trackingEvents'
import { SdkError } from './lib/facade/errors'
import { blankSearchRequest } from './utils'
import { isOverOneWeekAgo } from './utils'
import { getStorageKey } from './utils'
import { SDK_API_URL } from './index'
import { parseCartItem, parseProduct, parseProductInfo, parseProductsListResponse } from './types/productTypes'
import { parseUserOrdersResponse, parseOrder } from './types/orderTypes'
import { parseLoyaltyJoinResponse, parseLoyaltyStatus } from './types/loyaltyTypes'
import { parseProfile, parseProductCounters, parseCategory, parseCollection } from './types/catalogTypes'
import { prepareAndShow, registerSDK } from './components/Popup/SdkPopupOverlay'
import PopupLogic from './lib/popup'
import { buildTrackCustomEventParams } from './lib/buildTrackCustomEventParams'
import { buildPurchasePredictQueryParams } from './lib/buildPurchasePredictQueryParams'
import { buildPurchaseTrackingParams } from './lib/buildPurchaseTrackingParams.js'
import SdkRegistry from './lib/registry/SdkRegistry'
import { createNamespaces } from './lib/namespaces/namespaces'
import { requestCache } from './components/widgets/requestCache'
import { recentSearchesKey } from './components/widgets/searchSupport'
import { typeAndCode, eventOf } from './lib/push/PushPayloadParser'
import { tellPushEvent, tellPushToken, pushCallbacksOf } from './lib/push/pushCallbacks'

/** Minimum allowed NPS/review rate (1–10). */
const REVIEW_RATE_MIN = 1
/** Maximum allowed NPS/review rate (1–10). */
const REVIEW_RATE_MAX = 10

/** Source tracking TTL in seconds (48 hours, matches iOS). */
const SOURCE_TTL_SECONDS = 48 * 60 * 60
const SOURCE_STORAGE_KEYS = {
  timeStartSave: 'timeStartSave',
  recomendedCode: 'recomendedCode',
  recomendedType: 'recomendedType',
}

const PUSH_PERMISSION_WAIT_TIMEOUT_MS = 12000
const PUSH_PERMISSION_STATE_WAIT_POLL_MS = 200

// A failed /init is retried this many times, waiting INIT_RETRY_DELAY_MS longer before each retry
// (1 s, 2 s, ... 5 s) — the same policy as the Android SDK.
const INIT_MAX_RETRIES = 5
const INIT_RETRY_DELAY_MS = 1000
// An /init hanging without an error must not hold the SDK: past this it counts as a network error.
const INIT_TIMEOUT_MS = 10000
// 4xx statuses that mean "later", not "no".
const RETRYABLE_CLIENT_STATUSES = [408, 429]

/**
 * What an /init answer means. 'ok' — a did came. 'refused' — the server said no: a 4xx (other than
 * 408/429) or an error body; asking again will not help. 'failed' — anything else, worth retrying:
 * no answer, a timeout, a 5xx, a 408/429, a page without a did (a captive portal answers 200 HTML).
 * @param {any} response what lib/client `request` returned
 * @returns {'ok'|'refused'|'failed'}
 */
function initOutcome(response) {
  if (response instanceof Error) {
    const status = response.response?.status
    const clientError = status >= 400 && status < 500
    return clientError && !RETRYABLE_CLIENT_STATUSES.includes(status) ? 'refused' : 'failed'
  }
  if (response?.did) return 'ok'
  if (response && typeof response === 'object' && response.message) return 'refused'
  return 'failed'
}

/**
 * The error every call of a shop gets once its /init was refused: names the shop and the server's
 * reason instead of a bare "Request failed with status code 404".
 * @param {string} shop_id
 * @param {Error|object} failure the axios error or the error body
 * @returns {Error}
 */
function initRefusal(shop_id, failure) {
  const status = failure?.response?.status
  const reason = failure?.response?.data?.message || failure?.message || 'unknown reason'
  const refusal = new Error(
    `Requests of shop ${shop_id} are not sent: init was refused${status ? ` (HTTP ${status})` : ''}: ${reason}`
  )
  refusal.name = 'Init error'
  refusal.cause = failure
  return refusal
}

/**
 * Reads saved source params from AsyncStorage. If valid (within 48h), returns { source: { from, code } }; otherwise clears storage and returns {}.
 * @param {string} shop_id
 * @returns {Promise<{ source?: { from: string, code: string } }>}
 */
async function getSourceParams(shop_id) {
  const keyTime = getStorageKey(SOURCE_STORAGE_KEYS.timeStartSave, shop_id)
  const keyCode = getStorageKey(SOURCE_STORAGE_KEYS.recomendedCode, shop_id)
  const keyType = getStorageKey(SOURCE_STORAGE_KEYS.recomendedType, shop_id)
  try {
    const [[, timeVal], [, codeVal], [, typeVal]] = await AsyncStorage.multiGet([keyTime, keyCode, keyType])
    const timeStart = timeVal != null ? Number(timeVal) : NaN
    const savedCode = codeVal ?? ''
    const savedType = typeVal ?? ''
    const nowSec = Date.now() / 1000
    if (Number.isNaN(timeStart) || savedCode === '' || savedType === '' || nowSec - timeStart > SOURCE_TTL_SECONDS) {
      await AsyncStorage.multiRemove([keyTime, keyCode, keyType])
      return {}
    }
    return { source: { from: savedType, code: savedCode } }
  } catch (_) {
    return {}
  }
}

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

/**
 * Popups v3 hook: the engine is attached by `PersonalizationPopups.of(sdk)` (internal/v3) and stays
 * absent otherwise. A failing hook never breaks the SDK call that triggered it.
 * @param {MainSDK} sdk
 * @param {string} hook
 * @param {...any} args
 */
function popupsV3Hook(sdk, hook, ...args) {
  const engine = sdk._popupsV3
  if (!engine || typeof engine[hook] !== 'function') return
  try {
    engine[hook](...args)
  } catch (error) {
    if (DEBUG) console.warn(`[Popups v3] ${hook} failed:`, error)
  }
}

/** A list from the API's form (a list or a comma-separated string); `undefined` for none. */
function listOf(value) {
  if (value == null || value === '') return undefined
  if (Array.isArray(value)) return value.map(String)
  return String(value).split(',').map((item) => item.trim()).filter(Boolean)
}

/** A number from the API's form (a number or a numeric string); `undefined` for none. */
function numberOf(value) {
  if (value == null || value === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

/**
 * What every call of an instance gets after its `release()`.
 * @returns {SdkError}
 */
function releasedError() {
  return new SdkError('notInitialized', 'The SDK instance was released: initialize the shop again')
}

/**
 * The error of an event this JavaScript sent itself, as an `SdkError`: a refused shop is
 * `shopBlocked`, an answer of the server `http`, no answer `network`.
 * @param {any} error
 * @returns {SdkError}
 */
function directError(error) {
  if (error instanceof SdkError) return error
  if (error?.name === 'Init error') return new SdkError('shopBlocked', error.message)
  const status = error?.response?.status ?? (typeof error?.status === 'number' ? error.status : null)
  if (status) return new SdkError('http', error?.message ?? `HTTP ${status}`, { httpCode: status })
  return new SdkError('network', error?.message ?? String(error))
}

/**
 * The `recommendedBy` types of the deprecated `trackPurchase` both native purchases take alike — `slider`
 * and `agent_search` as the purchase's raw source on both. Both refuse `web_push_digest` as a purchase's
 * source, and iOS's `transactional` too, where Android's sends it: such a type, and one neither knows,
 * goes as 4.x built it.
 */
const NATIVE_PURCHASE_ATTRIBUTIONS = new Set(['dynamic', 'chain', 'bulk', 'instant_search', 'full_search', 'stories', 'slider', 'agent_search'])

/** A push as the SDK's handlers know it from `{ code, type }` only. */
const pushOf = (options) => ({ data: { id: options?.code, type: options?.type } })

/** `LogLevel` of the contract. */
export const LOG_LEVELS = ['debug', 'info', 'warning', 'error', 'none']

/**
 * A `PersonaClickConfig.logLevel`, or null for none; one that is no `LogLevel` is not taken — the SDK goes on
 * with the default, as the contract has it for a config value (`invalid_config`).
 */
function logLevelOf(value) {
  if (value == null) return null
  if (LOG_LEVELS.includes(value)) return value
  console.warn(`[SDK] logLevel ${JSON.stringify(value)} is not one of ${LOG_LEVELS.join(', ')}: the default stays (invalid_config)`)
  return null
}

/** The flags and keys of `PersonaClickConfig` the native SDK takes, each only when the app gave it. */
function configFlags(options) {
  const flags = {}
  for (const key of ['sendAdvertisingId', 'needReInitialization']) {
    if (typeof options[key] === 'boolean') flags[key] = options[key]
  }
  if (typeof options.storageKey === 'string' && options.storageKey.trim() !== '') flags.storageKey = options.storageKey
  return flags
}

/** An id of a tracking call as the native module takes it: a number as a string; anything else as it is. */
const idArg = (value) => (typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '')

/**
 * An event's `source` with the wire value of its type, or null for none. The native module hands `slider`
 * and `agent_search` to the native SDKs as their bridge-only raw sources, which go as these wire values.
 */
function sourceArg(source) {
  if (source == null) return null
  if (typeof source !== 'object') throw new SdkError('invalidArgument', 'source must be { type, code }')
  return { type: sourceTypeValue(source.type), code: idArg(source.code) }
}

/** A `TrackingItem` without its `undefined` fields. */
function itemArg(item) {
  if (item == null || typeof item !== 'object') return item
  const result = { id: idArg(item.id) }
  for (const key of ['quantity', 'price', 'fashionSize']) if (item[key] != null) result[key] = item[key]
  return result
}

/** A request without its `undefined` fields. */
function requestArg(value) {
  if (value == null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value))
}

/**
 * The contract's tracking methods → the native module's: its method and its arguments after the shop.
 * The checks of the arguments are the native SDK's.
 */
const NATIVE_TRACKING = {
  productView: (itemId, source) => ['trackingProductView', idArg(itemId), sourceArg(source)],
  categoryView: (categoryId) => ['trackingCategoryView', idArg(categoryId)],
  search: (query, results) => ['trackingSearch', idArg(query), Array.isArray(results) ? results.map(String) : null],
  addToCart: (item, source) => ['trackingAddToCart', itemArg(item), sourceArg(source)],
  syncCart: (items) => ['trackingSyncCart', Array.isArray(items) ? items.map(itemArg) : items],
  removeFromCart: (itemId) => ['trackingRemoveFromCart', idArg(itemId)],
  addToFavorites: (itemId, source) => ['trackingAddToFavorites', idArg(itemId), sourceArg(source)],
  syncFavorites: (itemIds) => ['trackingSyncFavorites', Array.isArray(itemIds) ? itemIds.map(idArg) : itemIds],
  removeFromFavorites: (itemId) => ['trackingRemoveFromFavorites', idArg(itemId)],
  // Only the contract's fields: the native module still reads 4.x's for the deprecated `trackPurchase`.
  purchase: (request, source) => ['trackingPurchase', requestArg(contractPurchase(request)), sourceArg(source)],
  storyView: (storyId, slideId, code) => ['trackingStoryView', idArg(storyId), idArg(slideId), code ?? null],
  storyClick: (storyId, slideId, code) => ['trackingStoryClick', idArg(storyId), idArg(slideId), code ?? null],
  bannerView: (bannerId, code) => ['trackingBannerView', idArg(bannerId), idArg(code)],
  bannerClick: (bannerId, code) => ['trackingBannerClick', idArg(bannerId), idArg(code)],
  popupShown: (popupId) => ['trackingPopupShown', popupId],
  custom: (event, params) => {
    const { time, category, label, value, customFields } = params ?? {}
    return ['trackingCustom', idArg(event), time ?? null, category ?? null, label ?? null, value ?? null, requestArg(customFields) ?? null]
  },
}

/**
 * The contract's `tracking` namespace of `sdk` (`sdk/contract/tracking.md`). With the native module each
 * method calls the native SDK's method of the same name, which checks the arguments and queues the event;
 * the promise resolves once the native queue accepted the event, on both platforms — the server's answer
 * comes later and does not reject it. Without the module this JavaScript builds and sends the event and
 * resolves on the server's answer. Every rejection is an `SdkError`.
 * @param {MainSDK} sdk
 */
function createTracking(sdk) {
  const api = {}
  for (const [name, build] of Object.entries(trackingEvents)) {
    api[name] = (...args) => {
      let call
      try {
        call = sdk._native ? NATIVE_TRACKING[name](...args) : build(...args)
      } catch (error) {
        return Promise.reject(error)
      }
      if (name === 'purchase') popupsV3Hook(sdk, 'onPurchase')
      if (name === 'custom') popupsV3Hook(sdk, 'onTrackEvent', args[0])
      // Android's module resolves with null, iOS's with nothing: the same void on both.
      return (sdk._native ? sdk._nativeCall(...call) : sdk._sendEvent(call)).then(() => undefined)
    }
  }
  api.setSource = (source) => {
    try {
      if (source == null || typeof source !== 'object') throw new SdkError('invalidArgument', 'source must be { type, code }')
      sdk._setSource(sourceTypeValue(source.type), source.code)
    } catch (error) {
      console.error('[SDK] tracking.setSource:', error?.message ?? error)
    }
  }
  return api
}

class MainSDK extends Performer {
  /**
   * @param {string} shop_id
   * @param {string} stream
   * @param {boolean?} debug
   * @param {boolean?} autoSendPushToken
   * @param {DeviceInfo?} deviceInfo
   * @param {{ apiDomain?: string, appDomain?: string, logLevel?: string, sendAdvertisingId?: boolean,
   *   needReInitialization?: boolean, deviceId?: string, storageKey?: string,
   *   enableAutoPopupPresentation?: boolean }?} hosts the API's hosts and the rest of `PersonaClickConfig`, for the
   *   native SDK
   */
  constructor(
    shop_id,
    stream,
    debug = false,
    autoSendPushToken = true,
    deviceInfo = null,
    hosts = null
  ) {
    let queue = []
    super(queue)
    this.shop_id = shop_id
    this.stream = stream ?? null
    /** The device id; `''` while there is none (`deviceId` reads it as null). */
    this._deviceId = ''
    this.userSeance = ''
    /** `SdkState` of the contract: `notInitialized`, `initializing`, `ready`, `retrying`, `refused`. */
    this._state = 'initializing'
    /** The listeners of `onStateChange`. */
    this._stateListeners = new Set()
    this.segment = ''
    this.initialized = false
    // DEBUG is a process-global logging flag shared by every instance (and read by lib/client).
    // With multiple shops it is sticky-on: enabling debug on any instance turns it on for all, and a
    // later instance constructed without debug does not turn it back off (was last-writer-wins).
    if (debug) DEBUG = true
    this._push_type = null
    this.push_payload = []
    this.lastMessageIds = []
    this.autoSendPushToken = autoSendPushToken
    this.deviceInfo = deviceInfo
    this._hosts = hosts
    // The shop's hosts, for the requests this JavaScript sends too.
    if (this.shop_id && typeof this.shop_id === 'string') setShopHosts(this.shop_id, hosts)
    /** Whether the native SDK's last /init turned the search agent on (`search.agentEnabled`). */
    this._agentEnabled = false

    /**
     * The native SDKs' bridge: with it the shop runs on the native SDK — its init, device id, session
     * and the queue of tracking events; without it (Expo Go, an app not rebuilt) on this JavaScript.
     */
    this._native = nativeBridge
    // On the native SDK a shop the app names no stream for runs as `react-native`, its JavaScript requests
    // too; without the module the SDK sends what 4.x sent.
    if (this._native && (this.stream == null || this.stream === '')) this.stream = DEFAULT_STREAM
    /** Settles once the native instance exists (`initializeShop` answered). */
    this._nativeStart = null
    this._stopNativeEvents = null
    this._stopNativePopups = null

    /** Set by `release()`: every later call rejects with `notInitialized`. */
    this._released = false
    /**
     * The device id `deleteUserCredentials()` forgot: a snapshot of the native instance taken before its
     * wipe may still bring it, and it must not come back. Cleared by the next device id.
     */
    this._forgottenDeviceId = null
    /** Each init of this JavaScript (`init`, `deleteUserCredentials`): an earlier one's answer is stale. */
    this._initGeneration = 0
    /** The push registration runs once per instance, not again for the device id of the next customer. */
    this._pushStarted = false

    /**
     * The contract's tracking events (`sdk/contract/tracking.md`).
     * @type {ReturnType<typeof createTracking>}
     */
    this.tracking = createTracking(this)

    // The contract's other namespaces: `sdk.products`, `sdk.search`, … (`lib/namespaces`). Where a
    // released method has the namespace's name (`search`, `cart`, `segments`, `subscriptions`), the
    // namespace is that method with the namespace's methods on it: `sdk.search(options)` still works
    // beside `sdk.search.full(query)`.
    for (const [name, api] of Object.entries(createNamespaces(this))) {
      const released = MainSDK.prototype[name]
      if (typeof released === 'function') {
        const callable = (...args) => released.apply(this, args)
        Object.defineProperties(callable, Object.getOwnPropertyDescriptors(api))
        this[name] = callable
      } else {
        this[name] = api
      }
    }

    // See the accessor: if set, the SDK does not show popups by itself and hands them to the host app.
    this.popupPresentationDelegate = null
    /** The push callbacks of the shop (`notifications.setCallbacks`). */
    this._pushCallbacks = null

    /**
     * Whether the SDK presents popups by itself. Off — the popups the SDK shows by itself stay hidden
     * (one shown by hand is shown all the same). May be changed at any time — off, say, while a screen
     * of the app must not be covered.
     * @type {boolean}
     */
    this.enableAutoPopupPresentation = hosts?.enableAutoPopupPresentation !== false

    // Firebase is initialized automatically by native modules
    // Initialize messaging lazily when needed
    this.messaging = null
    this._pushPermissionState = 'idle'
    this._pushPermissionPromise = null
    // In-memory token cache: avoids AsyncStorage race when getToken() is called
    // immediately after initPushToken() (savePushToken runs after backend response).
    this._tokenCache = null
    // Overridable hook: reads the persisted push token from AsyncStorage.
    // Can be replaced (e.g. in e2e tests) to bypass AsyncStorage synchronously.
    this._getSavedPushToken = getSavedPushToken
    // Tracks the in-flight initPush() promise so getToken() can await it
    // when called concurrently (e.g. autoSendPushToken race in init()).
    this._initPushPromise = null

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
      getInitialNotification,
      onTokenRefresh,
      onNewToken: (token) => {
        this._tokenCache = token
        this._tokenProvider = null
        tellPushToken(this, { token, provider: this._ownTokenProvider() })
        this.setPushTokenNotification(token)
      },
      notifee,
      EventType,
      getPushData,
      updPushData,
      // The pushes the SDK sees itself: their events, and once accepted the app's push callbacks.
      notificationDelivered: (options, message) => this._pushSeen('delivered', message ?? pushOf(options)),
      notificationClicked: (options, message) => this._pushSeen('clicked', message ?? pushOf(options)),
      notificationClosed: (options, message) => this._pushSeen('closed', message ?? pushOf(options)),
      defaultClickListener: (event) => this.onClickPush(event),
      defaultReceiveListener: (remoteMessage) =>
        this.showNotification(remoteMessage),
      defaultBgReceiveListener: (remoteMessage) =>
        this.showNotification(remoteMessage),
      getShopId: () => this.shop_id,
      hasSeenMessageId: (messageId) => this.lastMessageIds.includes(messageId),
      markMessageIdSeen: (messageId) => {
        this.lastMessageIds.push(messageId)
      },
      isDebug: () => DEBUG,
    })

    // Multi-instance groundwork (Release 1): make this instance reachable by `shop_id` through the
    // process-wide registry. No public surface yet and single-instance behaviour is unchanged — the
    // host still holds its own reference. A re-init for the same shop replaces the mapping.
    if (this.shop_id && typeof this.shop_id === 'string') {
      SdkRegistry.register(this.shop_id, this)
    }
  }

  /**
   * @param {Function} command
   * @returns {void}
   */
  perform(command) {
    // One broken command must not stop the queue: the ones after it would wait forever.
    try {
      command()
    } catch (error) {
      console.error('[SDK] Command failed:', error)
    }
  }

  /**
   * Whether the SDK presents popups by itself; see the constructor. The popups of the native SDK's
   * answers come here too, and are shown as any other.
   * @type {boolean}
   */
  get enableAutoPopupPresentation() {
    return this._autoPopups
  }

  set enableAutoPopupPresentation(enabled) {
    this._autoPopups = enabled
  }

  /**
   * Popup presentation delegate: if set, the SDK does not show popups by itself and hands their
   * payload — as the server sends it — to the host app, the popups of the native SDK's answers too.
   * @type {((popup: any, sdk: MainSDK) => void) | null}
   */
  get popupPresentationDelegate() {
    return this._popupDelegate
  }

  set popupPresentationDelegate(delegate) {
    this._popupDelegate = delegate
  }

  /**
   * A server popup the native SDK got — of the `/init` answer or of an event's — shown as this JavaScript
   * shows its own: `<SdkPopupOverlay>`, or the app's `popupPresentationDelegate`. The native SDK shows
   * none, and hands it over once its `delay` passed, so it is not waited again here. It waits for the
   * instance's init, as a popup of this JavaScript's own `/init` does.
   * @param {object} popup the popup with the server's field names
   * @returns {void}
   */
  _showNativePopup(popup) {
    if (this._released || this._superseded() || !popup) return
    this.push(() => {
      if (this._released) return
      this.checkAndShowPopup({ popup }, false, { delayWaited: true }).catch((error) => {
        if (DEBUG) console.error('[MainSDK] A popup of the native SDK was not shown:', error)
      })
    })
  }

  /**
   * @param {string} context
   * @param {any} error
   * @returns {void}
   */
  _logFirebaseError(context, error) {
    const code = error?.code || 'unknown'
    const message = error?.message || String(error)
    console.warn(`[Firebase][${context}] code=${code} message=${message}`, error)
  }

  /**
   * @param {'idle' | 'requesting' | 'granted' | 'denied'} nextState
   * @param {string} source
   * @returns {void}
   */
  _setPushPermissionState(nextState, source) {
    const prevState = this._pushPermissionState
    this._pushPermissionState = nextState
    if (DEBUG && prevState !== nextState) {
      console.log(
        `[PushPermission] state: ${prevState} -> ${nextState} (source=${source})`
      )
    }
  }

  /**
   * @param {'permission_denied' | 'permission_timeout' | 'messaging_unavailable' | 'token_empty' | 'push_token_error'} reason
   * @param {Record<string, any>} [extra]
   * @returns {void}
   */
  _logPushNullReason(reason, extra = {}) {
    console.warn('[PushToken] Returning null', {
      reason,
      permissionState: this._pushPermissionState,
      ...extra,
    })
  }

  /**
   * @returns {Promise<boolean>}
   */
  async _requestPushPermissionInternal() {
    if (Platform.OS === 'android') {
      // Android < 13 (API < 33): POST_NOTIFICATIONS permission does not exist.
      // FCM token is always available; no permission dialog is needed.
      if (Platform.Version < 33) {
        if (DEBUG) console.log('[PushPermission] Android < 13: permission not required, auto-grant')
        return true
      }

      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        )
        return granted === PermissionsAndroid.RESULTS.GRANTED
      } catch (err) {
        this._logFirebaseError('PermissionsAndroid.request', err)
        return false
      }
    }

    // iOS / other platforms: use notifee
    try {
      const settings = await notifee.requestPermission()

      if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
        if (DEBUG) console.log('User denied permissions request')
        return false
      }

      if (
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
      ) {
        if (DEBUG) console.log('User granted permissions request')
        return true
      }

      return false
    } catch (error) {
      this._logFirebaseError('notifee.requestPermission', error)
      return false
    }
  }

  /**
   * @returns {Promise<boolean>}
   */
  async _requestPushPermissionOnce() {
    if (this._pushPermissionPromise) {
      return this._pushPermissionPromise
    }

    this._setPushPermissionState('requesting', 'request_start')
    this._pushPermissionPromise = (async () => {
      const granted = await this._requestPushPermissionInternal()
      this._setPushPermissionState(granted ? 'granted' : 'denied', 'request_end')
      return granted
    })().finally(() => {
      this._pushPermissionPromise = null
    })

    return this._pushPermissionPromise
  }

  /**
   * @param {number} timeoutMs
   * @returns {Promise<'granted' | 'denied' | 'timeout'>}
   */
  async _waitForPushPermissionResolution(timeoutMs = PUSH_PERMISSION_WAIT_TIMEOUT_MS) {
    if (this._pushPermissionState === 'granted') return 'granted'
    if (this._pushPermissionState === 'denied') return 'denied'
    if (this._pushPermissionState !== 'requesting') return 'denied'

    if (DEBUG) {
      console.log(
        `[PushPermission] waiting for decision (timeoutMs=${timeoutMs})`
      )
    }

    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (this._pushPermissionState === 'granted') return 'granted'
      if (this._pushPermissionState === 'denied') return 'denied'
      await new Promise((resolve) =>
        setTimeout(resolve, PUSH_PERMISSION_STATE_WAIT_POLL_MS)
      )
    }

    return 'timeout'
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
      this._logFirebaseError('getMessaging', error)
      this.messaging = null
    }
  }

  _ensureMessaging() {
    if (!this.messaging) {
      this._initMessaging()
    }
    return this.messaging
  }

  /** The instance's shop (`shopId` of the contract); `shop_id` is the same. */
  get shopId() {
    return this.shop_id
  }

  /** The device id (`did`); null while the shop has none. */
  get deviceId() {
    return this._deviceId || null
  }

  set deviceId(value) {
    this._deviceId = value == null ? '' : String(value)
  }

  /** The session id (`sid`); null while there is none. */
  get sessionId() {
    return this.userSeance || null
  }

  /**
   * The init's state (`SdkState` of the contract): `initializing` until the device id is there,
   * `ready`, `retrying` while `/init` is repeated, `refused` when the shop refused the SDK,
   * `notInitialized` after `release()`.
   * @returns {'notInitialized'|'initializing'|'ready'|'retrying'|'refused'}
   */
  get state() {
    return this._state
  }

  /**
   * Calls `listener` with the current state at once and then with each change, until the function it
   * returns is called. An exception of the listener is caught and logged.
   * @param {(state: string) => void} listener
   * @returns {() => void} unsubscribes
   */
  onStateChange(listener) {
    if (typeof listener !== 'function') throw new TypeError('onStateChange: listener must be a function')
    const entry = (state) => {
      try {
        listener(state)
      } catch (error) {
        console.error('[SDK] An onStateChange listener threw (callback_failed):', error?.message ?? error)
      }
    }
    this._stateListeners.add(entry)
    entry(this._state)
    return () => {
      this._stateListeners.delete(entry)
    }
  }

  /** @param {string} state */
  _setState(state) {
    if (!state || state === this._state) return
    this._state = state
    for (const listener of [...this._stateListeners]) listener(state)
  }

  /**
   * @returns {void}
   */
  init() {
    if (this._native) {
      this._initNative()
      return
    }
    this._startInit()
  }

  /**
   * Init in this JavaScript (without the native module): /init until it brings a device id. A later
   * start — `deleteUserCredentials` makes one — makes the answer of an earlier one stale.
   * @param {{ withoutDeviceId?: boolean }} [options] `withoutDeviceId`: ask for a new device id, as after
   *   `deleteUserCredentials`; neither the stored one nor `deviceInfo.id` goes
   * @returns {void}
   */
  _startInit(options = {}) {
    const generation = ++this._initGeneration
    if (!this._released) this._setState('initializing')
    ;(async () => {
      // A new init gives a refused shop another chance.
      setShopRefused(this.shop_id, null)
      if (DEBUG) console.log('[SDK Init] Starting initialization...')

      const configError = this._initConfigError()
      if (configError) {
        // No request of this shop can work: settle every call at once, send nothing.
        this._refuse(configError)
        return configError
      }
      if (DEBUG) console.log('[SDK Init] Shop ID:', this.shop_id, 'Stream:', this.stream)

      try {
        const response = await this._requestInit(generation, options)
        if (response && !this._initStale(generation)) await this._initSucceeded(response, generation)
      } catch (error) {
        // A later init (or the release) decides about the calls now.
        if (this._initStale(generation)) return error
        // Not initialized unless /init succeeded; either way calls must not wait.
        this._releaseQueue()
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
   * Init on the native SDK: it sends /init, keeps the device id, the session and the queue of events.
   * This JavaScript hands it the identity an earlier version of the SDK kept — the device id, the
   * A/B group and a tracking source younger than 48 hours — and follows its state: the calls that
   * still go through this JavaScript wait for its device id and take it, and its session, from it.
   * @returns {void}
   */
  _initNative() {
    setShopRefused(this.shop_id, null)
    let started
    this._nativeStart = new Promise((resolve, reject) => {
      started = { resolve, reject }
    })
    // Nobody may be waiting for it: its failure is told by the calls that wait.
    this._nativeStart.catch(() => {})
    ;(async () => {
      const configError = this._initConfigError()
      if (configError) {
        this._refuse(configError)
        started.reject(new SdkError('invalidArgument', configError.message))
        return
      }
      await this.initializeSegment()
      await migrateLegacyIdentity(this.shop_id)
      const stored = await getData(this.shop_id)
      const options = this._hosts ?? {}
      // `needReInitialization` forgets the device id: none goes, or the native SDK would take it back.
      const deviceId = options.needReInitialization ? null : stored?.did || options.deviceId || this.deviceInfo?.id || null
      // Released before the native instance was asked for: it gets none.
      if (this._released) {
        started.reject(releasedError())
        return
      }
      this._stopNativeEvents?.()
      this._stopNativeEvents = this._native.onStateChanged((snapshot) => {
        if (snapshot?.shopId === this.shop_id) this._applyNative(snapshot)
      })
      this._stopNativePopups?.()
      // The shop's popups, those the native module held before this instance listened among them.
      this._stopNativePopups = this._native.onPopup?.((event) => {
        if (event?.shopId === this.shop_id) this._showNativePopup(event.popup)
      }, this.shop_id) ?? null
      try {
        const snapshot = await this._native.initializeShop({
          shopId: this.shop_id,
          stream: this.stream,
          apiDomain: this._hosts?.apiDomain ?? null,
          appDomain: this._hosts?.appDomain ?? null,
          deviceId,
          segment: this.segment || null,
          // The shop's logLevel; without one the SDK's debug flag.
          logLevel: logLevelOf(options.logLevel) ?? (DEBUG ? 'debug' : null),
          ...configFlags(options),
        })
        // Released while the native instance started: the release reached it after the start.
        if (this._released) {
          started.reject(releasedError())
          return
        }
        started.resolve()
        this._applyNative(snapshot)
        await this._moveStoredSource()
        await this._moveStoredPushToken()
      } catch (error) {
        if (!this._released) this._refuse(error)
        started.reject(this._released ? releasedError() : error)
      }
    })()
  }

  /**
   * The native instance's snapshot `{ state, deviceId, sessionId, segment }`: this JavaScript's copy
   * of its identity, for the calls that still go through it.
   * @param {{ state: string, deviceId: string|null, sessionId: string|null, segment: string|null }} snapshot
   * @returns {void}
   */
  _applyNative(snapshot) {
    if (this._superseded()) {
      this._stopNativeEvents?.()
      this._stopNativePopups?.()
      return
    }
    const { state, segment, agentEnabled } = snapshot
    let { deviceId, sessionId } = snapshot
    if (deviceId && deviceId === this._forgottenDeviceId) {
      // Taken before deleteUserCredentials wiped it: that customer is forgotten, here and on the disk.
      deviceId = null
      sessionId = null
    } else if (deviceId) {
      this._forgottenDeviceId = null
    }
    if (typeof agentEnabled === 'boolean') this._agentEnabled = agentEnabled
    this._applyNativeTokens(snapshot)
    if (deviceId) this.deviceId = deviceId
    if (sessionId) this.userSeance = sessionId
    if (segment && segment !== this.segment) {
      this.segment = segment
      // The stored group follows the native one: the next start hands over the same group.
      AsyncStorage.setItem(getStorageKey('segment', this.shop_id), segment).catch(() => {})
    }
    setNativeIdentity(this.shop_id, { did: this._deviceId, sid: this.userSeance })
    // The stored identity follows the native one: a push tracked without the instance, and a return
    // to an earlier version of the SDK, find the same device id.
    if (deviceId) updSeance(this.shop_id, deviceId, sessionId || '')
    // After the identity: a listener of the state reads the device id and the session it came with.
    if (typeof state === 'string' && !this._released) this._setState(state)
    if (state === 'refused') {
      this._refuse(initRefusal(this.shop_id, { message: 'the shop refused the SDK' }))
      return
    }
    if (this.deviceId && (state === 'ready' || state === 'retrying')) {
      if (!this.initialized) this._nativeReady()
    } else if (state === 'retrying') {
      // /init did not go through and is repeated: calls do not wait for it, as before.
      this._releaseQueue()
    }
  }

  /**
   * The native instance has its device id: the calls waiting in this JavaScript go, and the push
   * registration starts, as after this JavaScript's own /init.
   * @returns {Promise<void>}
   */
  async _nativeReady() {
    this.initialized = true
    setShopRefused(this.shop_id, null)
    try {
      this._initMessaging()
    } catch (error) {
      console.error('[SDK Init] Messaging setup failed:', error)
    }
    this.performQueue()
    // Once per instance: the next customer's device id does not ask for the permission again — the
    // token goes to it from deleteUserCredentials.
    if (this.autoSendPushToken && !this._pushStarted) {
      this._pushStarted = true
      try {
        await this.initPush()
      } catch (error) {
        console.error('[SDK Init] Push registration failed:', error)
      }
    }
  }

  /**
   * A tracking source an earlier version stored, younger than 48 hours, goes to the native SDK once;
   * its 48 hours start again there.
   * @returns {Promise<void>}
   */
  async _moveStoredSource() {
    const { source } = await getSourceParams(this.shop_id)
    if (!source) return
    let type = source.from
    try {
      type = sourceTypeValue(source.from)
    } catch (_) {
      // Handed as it was stored: the native SDK tells whether it takes it.
    }
    try {
      await this._native.setSource(this.shop_id, type, source.code)
    } catch (error) {
      if (DEBUG) console.warn('[SDK Init] The stored tracking source did not move:', error)
      // A source the native SDK does not take — a type it does not know (`trackSource`) — stays as 4.x
      // stored it, until its 48 hours are over.
      if (error?.type === 'invalidArgument' || error?.code === 'invalidArgument') return
    }
    await AsyncStorage.multiRemove(this._legacySourceKeys()).catch(() => {})
  }

  /** The keys 4.x kept the tracking source of the shop under. */
  _legacySourceKeys() {
    const shop_id = this.shop_id
    return [
      getStorageKey(SOURCE_STORAGE_KEYS.timeStartSave, shop_id),
      getStorageKey(SOURCE_STORAGE_KEYS.recomendedCode, shop_id),
      getStorageKey(SOURCE_STORAGE_KEYS.recomendedType, shop_id),
    ]
  }

  /**
   * The push token an earlier version of the SDK registered for the shop and kept in AsyncStorage goes to the
   * native SDK on its start, unless the native SDK has it already: the native SDK then knows the shop's
   * token — `getPushToken`, its weekly resend — though the app's push registration finds the kept token and
   * sends nothing itself. The native SDK sends a token new to it at once. Never throws.
   * @returns {Promise<void>}
   */
  async _moveStoredPushToken() {
    try {
      const token = await this._getSavedPushToken(this.shop_id)
      if (typeof token !== 'string' || token.trim() === '') return
      // The provider the SDK's own registration uses: 4.x kept the token it got so.
      const provider = this._ownTokenProvider()
      if (this._nativePushTokens?.[provider] === token) return
      await this._setPushToken(token, provider)
    } catch (error) {
      if (DEBUG) console.warn('[SDK Init] The stored push token did not move:', error?.message ?? error)
    }
  }

  /**
   * A tracking event `{ path, body }` of the shop, or null for none: into the native SDK's queue,
   * resolving once it is accepted; without the native module, sent at once.
   * @param {{ path: string, body: object } | null} event
   * @returns {Promise<void>}
   */
  _sendEvent(event) {
    if (this._released) return Promise.reject(releasedError())
    if (!event) return Promise.resolve()
    if (!this._native) return this._sendEventDirectly(event)
    return this._inOrder(() => () => this._queueNow(event))
  }

  /** An event into the shop's native queue now: for a call whose turn came (`_inOrder`). */
  _queueNow(event) {
    return this._native.queueEvent(this.shop_id, event.path, event.body)
  }

  /**
   * A call of the native module, handed over in the order the app made the calls: once the native instance
   * exists and the calls made before it were handed over — not answered. `prepare` builds the call — at once,
   * or later, as `track` does from its options — and returns the function that makes it; a call whose
   * arguments are not ready yet holds the ones made after it, so `track(…)` and `tracking.*` called one after
   * the other reach the native SDK in that order. A failed call holds back nothing.
   * @template T
   * @param {() => ((() => T | Promise<T>) | Promise<() => T | Promise<T>>)} prepare
   * @param {{ startFailure?: (error: any) => any, hold?: boolean }} [options] `startFailure`: the error a
   *   call gets when the native instance did not start; the start's own by default. `hold`: the calls made
   *   after it wait until it settled, not only until it was handed over
   * @returns {Promise<T>}
   */
  _inOrder(prepare, options = {}) {
    if (this._released) return Promise.reject(releasedError())
    if (!this._nativeStart) return Promise.reject(new SdkError('notInitialized', 'The SDK is not initialized'))
    let ready
    try {
      ready = Promise.resolve(prepare())
    } catch (error) {
      ready = Promise.reject(error)
    }
    // Told through the call's own promise below.
    ready.catch(() => {})
    const start = options.startFailure
      ? this._nativeStart.catch((error) => {
        throw options.startFailure(error)
      })
      : this._nativeStart
    let result
    const turn = (this._nativeTail ?? Promise.resolve())
      .then(() => start)
      .then(() => ready)
      .then((make) => {
        // A call made before release() that waited: a later instance of the shop owns the native one now.
        if (this._released) throw releasedError()
        result = make()
      })
    const done = turn.then(() => result)
    this._nativeTail = (options.hold ? done : turn).catch(() => {})
    return done
  }

  /**
   * A method of the native module for this shop (`specs/NativePersonaClick.ts`), once the native instance
   * exists. Without the native module — Expo Go, an app not rebuilt after installing the SDK — it
   * rejects with `notInitialized`: the namespaces need the native SDK.
   * @param {string} method
   * @param {...any} args the method's arguments after the shop
   * @returns {Promise<any>}
   */
  _nativeCall(method, ...args) {
    if (!this._native) {
      return Promise.reject(new SdkError(
        'notInitialized',
        "The SDK's native module is not in this app (Expo Go, or an app not rebuilt after installing the SDK): the namespaces need it",
      ))
    }
    // In the order the app made its calls (`_inOrder`).
    return this._inOrder(() => () => this._native[method](this.shop_id, ...args))
  }

  /**
   * Settles once the native instance exists. Rejects with `notInitialized` after `release()`, or when
   * the native instance did not start (an invalid config).
   * @returns {Promise<void>}
   */
  _nativeInstance() {
    return this._withNativeInstance(() => undefined)
  }

  /**
   * `work` once the native instance exists, one step after its start as a namespace's call takes: what the
   * app calls in one go reaches the native module in the order it called it. Rejects as `_nativeInstance`.
   * @template T
   * @param {() => T | Promise<T>} work
   * @returns {Promise<T>}
   */
  _withNativeInstance(work, options = {}) {
    return this._inOrder(() => work, {
      ...options,
      startFailure: (error) => this._released
        ? releasedError()
        : new SdkError('notInitialized', `The SDK is not initialized: ${error?.message ?? error}`),
    })
  }

  /** Tells the popups v3 engine, if the host attached one; see `popupsV3Hook`. */
  _popupsV3Hook(hook, ...args) {
    popupsV3Hook(this, hook, ...args)
  }

  /**
   * A push event the SDK saw itself — a push its handlers received, drew, saw tapped or dismissed, or
   * `PersonaClick.handlePush` routed here — sent as `notifications.track*` sends it; once it was accepted the
   * app's push callback of the event hears it (`notifications.setCallbacks`, else
   * `PersonaClick.setPushCallbacks`). Does not wait: the SDK's push handling goes on meanwhile. A push without
   * `id` and `type` is not the SDK's: nothing goes.
   * @param {'delivered'|'opened'|'clicked'|'closed'} event
   * @param {any} message the push as it came
   * @returns {void}
   */
  _pushSeen(event, message) {
    const { code, type } = typeAndCode(message)
    if (code == null || code === '' || type == null || type === '') return
    this._pushEvent(event, String(code), String(type))
      .then(() => tellPushEvent(this, this.shop_id, event, message))
      .catch((error) => {
        if (DEBUG) console.warn(`[SDK] notification ${event} failed:`, error?.message ?? error)
      })
  }

  /**
   * A push event the app reports itself (`notifications.track*`), sent by this JavaScript until pushes
   * move to the native SDK: it resolves on the server's answer. A click also stores the mailing as the
   * tracking source for 48 hours, as the native SDKs do.
   * @param {'delivered'|'opened'|'clicked'|'closed'} event
   * @param {string} code the push's `id`
   * @param {string} type the push's `type`: `bulk`, `chain`, `transactional`
   * @returns {Promise<void>}
   */
  _pushEvent(event, code, type) {
    if (typeof code !== 'string' || code.trim() === '') {
      return Promise.reject(new SdkError('invalidArgument', 'code must be a non-empty string'))
    }
    if (typeof type !== 'string' || type.trim() === '') {
      return Promise.reject(new SdkError('invalidArgument', 'type must be a non-empty string'))
    }
    // The native SDK: through the shop's queue, once per message in the process, with the A/B group
    // and no session; a click stores the source itself. Resolves once the queue took it.
    if (this._native) return this._nativeCall('notificationsTrack', event, code, type).then(() => undefined)
    if (event === 'clicked') {
      try {
        this._setSource(sourceTypeValue(type), code)
      } catch (_) {
        // A type that is no source (`digest`) stores none.
      }
    }
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          // A push event carries no session: the server does not read it there.
          const response = await this._request(`track/${event}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            params: { shop_id: this.shop_id, stream: this.stream, segment: this.segment || undefined, code, type },
            withoutSession: true,
          })
          if (response instanceof Error) {
            reject(directError(response))
            return
          }
          await this.checkAndShowPopup(response)
          resolve()
        } catch (error) {
          reject(directError(error))
        }
      })
    })
  }

  /**
   * Registers `token` of `provider` for the shop's pushes (`notifications.setPushToken`). With the native
   * module through the native SDK, by the contract's rules: a new token goes at once, the same one at
   * most once a week, `platform` and `push_provider` as the platform has them. Without it, from this
   * JavaScript.
   * `apns` and `fcm` on iOS, `fcm` and `hms` on Android; another is `invalidArgument`.
   * @param {string} token
   * @param {'apns'|'fcm'|'hms'} provider
   * @returns {Promise<void>}
   */
  _setPushToken(token, provider) {
    if (typeof token !== 'string' || token.trim() === '') {
      return Promise.reject(new SdkError('invalidArgument', 'token must not be empty'))
    }
    const providers = Platform.OS === 'ios' ? ['apns', 'fcm'] : ['fcm', 'hms']
    if (!providers.includes(provider)) {
      return Promise.reject(new SdkError('invalidArgument', `provider must be ${providers.join(' or ')} on ${Platform.OS}: ${provider}`))
    }
    if (!this._native) {
      const platform = Platform.OS === 'ios' ? (provider === 'apns' ? 'ios' : 'ios_firebase') : 'android'
      const pushProvider = Platform.OS === 'ios' ? undefined : provider === 'hms' ? 'huawei' : 'firebase'
      return this._sendPushTokenTo(token, platform, pushProvider, provider)
    }
    return this._nativeCall('notificationsSetPushToken', token, provider).then(() => {
      this._tokenCache = token
      this._tokenProvider = provider
      savePushToken(token, this.shop_id).catch(() => {})
    })
  }

  /**
   * The provider of a token the SDK's own push registration got: APNs on iOS, unless `firebase_only`
   * asked for FCM; FCM on Android.
   * @returns {'apns'|'fcm'}
   */
  _ownTokenProvider() {
    return Platform.OS === 'ios' && this._push_type === null ? 'apns' : 'fcm'
  }

  /**
   * `mobile_push_tokens` from this JavaScript, without the native module.
   * @param {string} token
   * @param {string} platform the `platform` of `mobile_push_tokens`
   * @param {string} [pushProvider] its `push_provider`
   * @param {'apns'|'fcm'} [provider] the provider the token is kept under
   * @returns {Promise<void>}
   */
  _sendPushTokenTo(token, platform, pushProvider, provider) {
    if (token.trim() === '') return Promise.reject(new SdkError('invalidArgument', 'token must not be empty'))
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const params = { shop_id: this.shop_id, stream: this.stream, token, platform }
          if (pushProvider) params.push_provider = pushProvider
          const response = await this._request('mobile_push_tokens', {
            method: 'POST',
            params,
          })
          if (response instanceof Error) {
            reject(directError(response))
            return
          }
          this._tokenCache = token
          this._tokenProvider = provider ?? (platform === 'ios' ? 'apns' : 'fcm')
          await savePushToken(token, this.shop_id)
          await saveLastPushTokenSentDate(new Date(), this.shop_id)
          resolve()
        } catch (error) {
          reject(directError(error))
        }
      })
    })
  }

  /**
   * The push token the SDK knows for the shop (`notifications.getPushToken`), or null: the one this
   * JavaScript registered in this run — `fcm` on Android and with `firebase_only`, `apns` otherwise, or
   * the provider `setPushToken` was given — else the one the native SDK keeps for the shop from an
   * earlier start. With `provider`, that provider's token; without, the one sent last.
   * @param {'apns'|'fcm'|'hms'} [provider]
   * @returns {{ token: string, provider: 'apns'|'fcm'|'hms' } | null}
   */
  _pushToken(provider) {
    let own = null
    if (typeof this._tokenCache === 'string' && this._tokenCache !== '') {
      // The provider it was registered with; a token Firebase gave is FCM's unless iOS sends APNs ones.
      own = { token: this._tokenCache, provider: this._tokenProvider ?? (Platform.OS === 'ios' && this._push_type === null ? 'apns' : 'fcm') }
    }
    if (provider == null) return own ?? this._nativePushToken ?? null
    if (own && own.provider === provider) return own
    const token = this._nativePushTokens?.[provider]
    return typeof token === 'string' && token !== '' ? { token, provider } : null
  }

  /**
   * The push tokens of the native SDK's snapshot (`pushToken`, `pushTokens`): what it keeps for the shop,
   * from an earlier start too. A snapshot of a module without them changes nothing.
   * @param {any} snapshot
   * @returns {void}
   */
  _applyNativeTokens(snapshot) {
    if (snapshot?.pushTokens != null && typeof snapshot.pushTokens === 'object') {
      this._nativePushTokens = { ...snapshot.pushTokens }
    }
    if (snapshot && 'pushToken' in snapshot) {
      const last = snapshot.pushToken
      this._nativePushToken = last && typeof last.token === 'string' && last.token !== '' && typeof last.provider === 'string'
        ? { token: last.token, provider: last.provider }
        : null
    }
  }

  /**
   * An event sent by this JavaScript, as before the native SDK: it resolves on the server's answer
   * and shows a popup of the answer.
   * @param {{ path: string, body: object }} event
   * @returns {Promise<void>}
   */
  _sendEventDirectly({ path, body }) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const params = { shop_id: this.shop_id, stream: this.stream, segment: this.segment, ...body }
          if (path === 'push') Object.assign(params, await getSourceParams(this.shop_id))
          const response = await this._request(path, {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            params,
          })
          if (response instanceof Error) {
            reject(directError(response))
            return
          }
          await this.checkAndShowPopup(response)
          resolve()
        } catch (error) {
          reject(directError(error))
        }
      })
    })
  }

  /**
   * Stores the tracking source for 48 hours: in the native SDK, or without it in this JavaScript.
   * @param {string} type the wire value
   * @param {string} code
   * @returns {void}
   */
  _setSource(type, code) {
    if (this._released) throw releasedError()
    if (typeof code !== 'string' || code.trim() === '') {
      throw new SdkError('invalidArgument', 'source.code must be a non-empty string')
    }
    if (this._native) {
      this._sendSourceToNative(type, code)
      return
    }
    const shop_id = this.shop_id
    AsyncStorage.multiSet([
      [getStorageKey(SOURCE_STORAGE_KEYS.timeStartSave, shop_id), String(Math.floor(Date.now() / 1000))],
      [getStorageKey(SOURCE_STORAGE_KEYS.recomendedCode, shop_id), code],
      [getStorageKey(SOURCE_STORAGE_KEYS.recomendedType, shop_id), type],
    ]).catch(() => {})
  }

  _sendSourceToNative(type, code) {
    // In the order of the calls: the events sent before it keep the source they had, those after take it.
    this._withNativeInstance(() => this._native.setSource(this.shop_id, type, code))
      .catch((error) => console.error('[SDK] The tracking source was not stored:', error?.message ?? error))
  }

  /**
   * @returns {Error|null} what is wrong with the shop_id / stream the SDK was built with
   */
  _initConfigError() {
    let message = null
    if (!this.shop_id || typeof this.shop_id !== 'string') {
      message = 'Parameter "shop_id" is required as a string.'
    } else if (this.stream && typeof this.stream !== 'string') {
      message = 'Parameter "stream" must be a string.'
    }
    if (!message) return null
    const error = new Error(message)
    error.name = 'Init error'
    return error
  }

  /**
   * Sends /init until it brings a did or a final answer. Offline (as NetInfo knows) it is not sent at
   * all — it goes out when the network is back. No answer, a timeout, a 5xx, a 408/429 or a page
   * without a did are retried INIT_MAX_RETRIES times; once they run out, the next reconnect starts
   * over (with NetInfo; without it the SDK stays uninitialized until the next launch). Calls never
   * wait for any of this: the queue is released on the first miss.
   * @param {number} generation the init this request belongs to (`_startInit`)
   * @param {{ withoutDeviceId?: boolean }} [options] see `_startInit`
   * @returns {Promise<object|null>} the init response with a did, or null — refused, given up, a later
   *   SDK for the same shop took over, a later init started, or the instance was released
   */
  async _requestInit(generation = this._initGeneration, options = {}) {
    // JS SDK behavior: initialize segment before init request
    await this.initializeSegment()

    // One-time adoption of a pre-partition (v1) install's identity into this shop's partition, so
    // an existing single-shop user keeps their did on upgrade instead of being re-registered by the
    // server. Runs before the identity read below, so the first /init goes out with the old did.
    await migrateLegacyIdentity(this.shop_id)

    const storageData = await getData(this.shop_id)
    if (DEBUG) console.log('[SDK Init] Storage data:', storageData)

    let did = ''

    // Device-id policy (parity with the Android/iOS/web SDKs): never seed the did with a
    // hardware id. The did comes from the per-shop cache, or an explicit host-provided
    // `deviceInfo.id`; otherwise it stays empty and the first `/init` goes out with no did, so the
    // server assigns one — distinct per shop_id. Seeding a device-global id (getAndroidId /
    // syncUniqueId) made every shop on a device share one did/seance, breaking multi-instance
    // isolation. The server-assigned did is persisted per shop (updSeance below), so existing
    // installs keep their did and are never silently re-identified.
    if (options.withoutDeviceId) {
      // deleteUserCredentials: the server hands out a new did.
    } else if (storageData?.did) {
      did = storageData.did
      if (DEBUG) console.log('[SDK Init] Using cached device ID for request:', did)
    } else if (this.deviceInfo && this.deviceInfo.id) {
      did = this.deviceInfo.id
    }

    const params = {
      shop_id: this.shop_id,
      stream: this.stream,
    }
    if (did) {
      params.did = did
    }
    // Popups v3 test mode: the /init flag must count popups in the "Test" status too.
    if (this._popupsV3 && this._popupsV3.testMode) {
      params.testmode = true
    }

    let retries = 0
    for (;;) {
      if (this._initStale(generation)) return null
      if (await knownOffline()) {
        if (this._initStale(generation)) return null
        this._releaseQueue()
        this._setState('retrying')
        if (DEBUG) console.log('[SDK Init] Offline: init waits for the network')
        await waitForReconnect()
        retries = 0
        continue
      }

      if (DEBUG) console.log('[SDK Init] Making init request to API...')
      // A fresh copy each time: request() writes did/seance into the params it is given.
      const response = await this._request('init', { params: { ...params }, timeout: INIT_TIMEOUT_MS })
      if (DEBUG) console.log('[SDK Init] /init answered')
      if (this._initStale(generation)) return null

      const outcome = initOutcome(response)
      if (outcome === 'ok') return response
      if (outcome === 'refused') {
        this._refuse(initRefusal(this.shop_id, response))
        return null
      }

      this._releaseQueue()
      this._setState('retrying')
      if (retries >= INIT_MAX_RETRIES) {
        console.error('[SDK Init] Initialization failed, retries are over:', response)
        if (!(await waitForReconnect())) return null
        retries = 0
        continue
      }
      retries++
      if (DEBUG) console.warn(`[SDK Init] Init failed, retry ${retries} of ${INIT_MAX_RETRIES}:`, response?.message ?? '')
      await new Promise((resolve) => setTimeout(resolve, INIT_RETRY_DELAY_MS * retries))
    }
  }

  /**
   * /init gave a did: the SDK is initialized. What follows — the popup, messaging, push
   * registration — can fail on its own without undoing that.
   * @param {object} response
   * @param {number} [generation] the init it answers (`_startInit`)
   * @returns {Promise<void>}
   */
  async _initSucceeded(response, generation = this._initGeneration) {
    const didToUse = response.did
    this.deviceId = didToUse
    this.userSeance = response?.seance || response?.sid || ''
    if (!this.segment && response?.segment) {
      this.segment = response.segment
    }

    if (DEBUG) console.log('[SDK Init] Updating session...')
    await updSeance(this.shop_id, didToUse, response?.seance)
    // deleteUserCredentials or release came meanwhile: this device id is no longer the instance's.
    if (this._initStale(generation)) return

    this.initialized = true
    this._setState('ready')
    if (DEBUG) console.log('[SDK Init] SDK initialized successfully!')
    // Popups v3 flag: the engine (if the host enabled it) starts with it.
    this._popupsV3Flag = response?.popups_v3 === true
    popupsV3Hook(this, 'onInit')

    try {
      // Check for popup in init response
      await this.checkAndShowPopup(response)
      // Initialize messaging after SDK is initialized
      this._initMessaging()
    } catch (error) {
      console.error('[SDK Init] Popup or messaging setup failed:', error)
    }
    this.performQueue()
    // Once per instance: the next customer's device id does not ask for the permission again — the
    // token goes to it from deleteUserCredentials.
    if (this.autoSendPushToken && !this._pushStarted) {
      this._pushStarted = true
      try {
        // Explicitly request push permission and register token on init.
        // This will show the system prompt on first launch if needed.
        await this.initPush()
      } catch (error) {
        console.error('[SDK Init] Push registration failed:', error)
      }
    }
  }

  /**
   * The shop's init is refused for good: every call settles at once with `refusal`, nothing is sent.
   * @param {Error} refusal
   * @returns {void}
   */
  _refuse(refusal) {
    this.initialized = false
    this._setState('refused')
    setShopRefused(this.shop_id, refusal)
    this._releaseQueue()
    console.error('[SDK Init] Initialization failed:', refusal)
  }

  /**
   * A later SDK for the same shop (a re-init) took over, or this one was released: its init must not
   * touch the shop.
   * @returns {boolean}
   */
  _superseded() {
    return SdkRegistry.byShopId(this.shop_id) !== this
  }

  /**
   * The init of `generation` in this JavaScript no longer counts: a later one started
   * (`deleteUserCredentials`), or the instance was superseded or released.
   * @param {number} generation
   * @returns {boolean}
   */
  _initStale(generation) {
    return this._superseded() || generation !== this._initGeneration
  }

  /**
   * @returns {boolean}
   */
  isInit = () => this.initialized

  /**
   * Init failed: the commands queued for it, and every later one, run without waiting. After a
   * network error they go out with the cached did, or none on a fresh install, as the Android SDK
   * does; after a refusal their requests return it without being sent. Otherwise each of them (a
   * recommend() too) would wait for the rest of the session, neither resolving nor rejecting.
   * @returns {void}
   */
  _releaseQueue() {
    if (this.queueReleased) return
    this.queueReleased = true
    this.performQueue()
  }

  /**
   * A request of this shop through this JavaScript (`lib/client` `request`). After `release()` it is
   * not sent: it resolves with `notInitialized`, as `request` resolves with its errors.
   * @param {string} url
   * @param {object} [options]
   * @returns {Promise<any>}
   */
  _request(url, options) {
    if (this._released) return Promise.resolve(releasedError())
    return request(url, this.shop_id, options)
  }

  // The instance — `sdk/contract/root.md`.

  /**
   * Sends the events waiting in the shop's queue now, without waiting for the queue's own triggers.
   * Resolves once each event queued at the call was tried: sent, dropped, or kept for later — no
   * network, the native instance not ready yet, or a server that asked to wait. It promises no delivery.
   *
   * Without the SDK's native module (Expo Go, an app not rebuilt) there is no queue — each event is
   * sent at once — and it resolves at once.
   *
   * @returns {Promise<void>} rejects only with `SdkError` `notInitialized`: after `release()`, or when
   *   the native instance did not start
   */
  flush() {
    if (this._released) return Promise.reject(releasedError())
    if (!this._native) return Promise.resolve()
    // Android's module resolves with null, iOS's with nothing: the same void on both. The native module
    // flushes after the events the app sent before, on each platform.
    return this._withNativeInstance(() => this._native.flush(this.shop_id))
      .then(() => undefined)
  }

  /**
   * Stops the instance: nothing more is sent, the events not sent yet stay in the queue on the device
   * for the next start, and the instance leaves the registry — `PersonaClick.isInitialized(shopId)` is false,
   * `PersonaClick.getInstance(shopId)` throws, pushes of the shop are no longer routed to it. Every later call
   * of the instance rejects with `SdkError` `notInitialized` (an earlier method that resolves with its
   * errors resolves with it); calls waiting for the init settle so at once. A new
   * `PersonaClick.initialize` of the shop makes a fresh instance. Releasing twice does nothing.
   *
   * An instance a later `PersonaClick.initialize` of the shop replaced leaves the native instance to the
   * later one.
   *
   * @returns {void}
   */
  release() {
    if (this._released) return
    const owner = !this._superseded()
    this._released = true
    this._setState('notInitialized')
    SdkRegistry.unregister(this)
    this._stopNativeEvents?.()
    this._stopNativeEvents = null
    this._stopNativePopups?.()
    this._stopNativePopups = null
    this.initialized = false
    // Popups v3, when the host turned them on: no list, trigger or manual show of this instance.
    if (this._popupsV3) {
      try {
        this._popupsV3.enabled = false
      } catch (_) {
        // The engine's own failure must not stop the release.
      }
    }
    if (owner && this._native) this._native.releaseShop(this.shop_id)
    // What waits for the init runs now and settles as not initialized: _request sends nothing.
    this.queueReleased = true
    this.performQueue()
  }

  /**
   * Forgets the shop's customer on this device: the device id, the session, the events not sent yet,
   * the saved `/init` answer, the tracking source, the date the push token was last sent, and the
   * search widget's recent searches and the widgets' answers kept in memory. The push token, the A/B
   * group, the stories' state and the popups shown stay: they belong to the device. The instance stays
   * usable and asks `/init` for a new device id at once: the calls that go through this JavaScript
   * (the push events, `getStories`, …) wait for it, and the push token this JavaScript registered goes
   * to the next customer once it is there. Other shops keep their customers.
   *
   * Resolves once the data is wiped, not waiting for the new device id. Without the SDK's native module
   * this JavaScript forgets what it keeps itself (AsyncStorage) and sends `/init` again.
   *
   * @returns {Promise<void>} rejects only with `SdkError` `notInitialized`: after `release()`, or when
   *   the native instance did not start
   */
  deleteUserCredentials() {
    if (this._released) return Promise.reject(releasedError())
    if (!this._native) return this._forgetCustomerHere()
    // The native module wipes after the events the app sent before, and the calls made after wait until the
    // wipe is over (`hold`): their events are the next customer's, on Android too, whose wipe starts after
    // the native call returns and would take an event accepted meanwhile.
    return this._withNativeInstance(async () => {
      // A re-init of the shop made another JavaScript instance over the same native one: it forgets too.
      const current = SdkRegistry.byShopId(this.shop_id)
      const holders = current && current !== this ? [this, current] : [this]
      const kept = holders.map((sdk) => sdk._identityKept())
      holders.forEach((sdk) => sdk._forgetIdentity())
      try {
        await this._native.deleteUserCredentials(this.shop_id)
      } catch (error) {
        // Nothing was wiped: the customer comes back, and the calls that waited for the next one go.
        holders.forEach((sdk, i) => sdk._restoreIdentity(kept[i]))
        throw error
      }
      await this._forgetStoredCustomer()
      ;(current ?? this)._sendPushTokenAgain()
    }, { hold: true })
  }

  /**
   * `deleteUserCredentials` without the native module: this JavaScript keeps the customer itself.
   * @returns {Promise<void>}
   */
  async _forgetCustomerHere() {
    // A re-init of the shop made another JavaScript instance: it forgets too, and asks for the next
    // device id — a replaced instance does not init.
    const current = SdkRegistry.byShopId(this.shop_id)
    this._forgetIdentity()
    if (current && current !== this) current._forgetIdentity()
    setShopRefused(this.shop_id, null)
    await this._forgetStoredCustomer()
    if (current) {
      current._startInit({ withoutDeviceId: true })
      current._sendPushTokenAgain()
    }
  }

  /**
   * The customer this instance holds in memory goes: its device id — a snapshot of the native instance
   * taken before the wipe does not bring it back — and session. The instance waits for the next
   * customer's device id: its calls through this JavaScript queue until it is there.
   * @returns {void}
   */
  _forgetIdentity() {
    if (this.deviceId) this._forgottenDeviceId = this.deviceId
    this.deviceId = ''
    this.userSeance = ''
    if (this._native) setNativeIdentity(this.shop_id, { did: '', sid: '' })
    // One a later instance of the shop replaced does not follow the native state, and would never hear
    // the new device id: its calls take the shop's identity as they come.
    if (!this._superseded()) {
      this.initialized = false
      this.queueReleased = false
    }
  }

  /**
   * What `_forgetIdentity` drops, for `_restoreIdentity`.
   * @returns {{ deviceId: string, sessionId: string, initialized: boolean, queueReleased: boolean }}
   */
  _identityKept() {
    return {
      deviceId: this._deviceId,
      sessionId: this.userSeance,
      initialized: this.initialized,
      queueReleased: this.queueReleased,
    }
  }

  /**
   * The native wipe failed, so nothing was wiped: the customer `kept` before `_forgetIdentity` comes back —
   * unless the native instance told another device id meanwhile — and the calls of this JavaScript that
   * waited for the next device id go, as they went before.
   * @param {{ deviceId: string, sessionId: string, initialized: boolean, queueReleased: boolean }} kept
   * @returns {void}
   */
  _restoreIdentity(kept) {
    this._forgottenDeviceId = null
    if (!this._deviceId && kept.deviceId) {
      this.deviceId = kept.deviceId
      this.userSeance = kept.sessionId
      if (this._native) setNativeIdentity(this.shop_id, { did: this._deviceId, sid: this.userSeance })
    }
    if (!this.initialized && !this.queueReleased && (kept.initialized || kept.queueReleased)) {
      this.initialized = kept.initialized
      this.queueReleased = kept.queueReleased
      this.performQueue()
    }
  }

  /**
   * The customer this JavaScript keeps on the device (AsyncStorage) goes: the device id and session
   * of the shop's partition — unless the next customer's device id is there already — the tracking
   * source, the date the push token was last sent and the search widget's recent searches. The
   * identity of the store before partitions is marked taken, so that no later start adopts it, and the
   * widgets' answers in memory go.
   * @returns {Promise<void>}
   */
  async _forgetStoredCustomer() {
    const shop_id = this.shop_id
    try {
      const stored = await getData(shop_id)
      const keys = [
        getStorageKey(SOURCE_STORAGE_KEYS.timeStartSave, shop_id),
        getStorageKey(SOURCE_STORAGE_KEYS.recomendedCode, shop_id),
        getStorageKey(SOURCE_STORAGE_KEYS.recomendedType, shop_id),
        getStorageKey('push_token_last_sent_date', shop_id),
        recentSearchesKey(shop_id),
      ]
      // The native SDK's /init may have brought the next customer's device id already.
      const current = SdkRegistry.byShopId(shop_id)?.deviceId || this.deviceId
      if (!current || stored?.did !== current) keys.push(getStorageKey('', shop_id))
      await AsyncStorage.multiRemove(keys)
    } catch (error) {
      console.error('[SDK] The stored customer data was not all deleted:', error?.message ?? error)
    }
    await retireLegacyIdentity()
    requestCache.clear()
  }

  /**
   * The push token this JavaScript registered for the shop goes again, to the next customer: it waits
   * in the queue for the new device id. Nothing without a token.
   * @returns {Promise<void>}
   */
  async _sendPushTokenAgain() {
    try {
      const token = this._tokenCache || (await this._getSavedPushToken(this.shop_id))
      if (typeof token !== 'string' || token === '') return
      await this._setPushToken(token, this._tokenProvider ?? this._ownTokenProvider())
    } catch (error) {
      console.error('[SDK] The push token did not go to the next customer:', error?.message ?? error)
    }
  }

  /**
   * Gets the current device ID, ensuring it's synchronized with storage
   * @returns {Promise<string>} The device ID
   */
  async getDeviceId() {
    if (this._released) throw releasedError()
    if (this._native) {
      if (this.deviceId) return this.deviceId
      const deviceId = await this._nativeStart
        ?.then(() => this._native.getDeviceId(this.shop_id))
        .catch(() => null)
      return deviceId || ''
    }
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
   * Returns the current push token.
   * If initPush() is actively running (e.g. triggered by autoSendPushToken during init()),
   * waits for it to complete instead of racing against it.
   * @returns {Promise<string | null>}
   */
  getToken = async () => {
    try {
      if (this._initPushPromise) {
        // Join the in-flight initPush() — no deadlock because initPushToken()
        // inside initPush() does not read _initPushPromise.
        const token = await this._initPushPromise
        if (DEBUG) console.log('[SDK] Push token', token ? 'received' : 'missing')
        return typeof token === 'string' ? token : null
      }
      const token = await this.initPushToken()
      if (DEBUG) console.log('[SDK] Push token', token ? 'received' : 'missing')
      return token ?? null
    } catch (error) {
      console.error(error)
      return null
    }
  }

  /**
   * @deprecated Use `initPush(click, ...)` to register a click handler. Kept as
   * a proxy to PushOrchestrator's listener so existing direct accessors keep
   * working.
   */
  get pushClickListener() {
    return this._pushOrchestrator._clickListener ?? this._pushOrchestrator._deps.defaultClickListener
  }
  set pushClickListener(fn) {
    this._pushOrchestrator.setListeners({ click: fn })
  }

  /**
   * @deprecated Use `initPush(_, receive, _)` instead.
   */
  get pushReceivedListener() {
    return this._pushOrchestrator._receiveListener ?? this._pushOrchestrator._deps.defaultReceiveListener
  }
  set pushReceivedListener(fn) {
    this._pushOrchestrator.setListeners({ receive: fn })
  }

  /**
   * @deprecated Use `initPush(_, _, bgReceive)` instead.
   */
  get pushBgReceivedListener() {
    return this._pushOrchestrator._bgReceiveListener ?? this._pushOrchestrator._deps.defaultBgReceiveListener
  }
  set pushBgReceivedListener(fn) {
    this._pushOrchestrator.setListeners({ bgReceive: fn })
  }

  track(event, options) {
    if (event === 'purchase') popupsV3Hook(this, 'onPurchase')
    if (this._native) {
      // Its turn is taken now, while its fields are built: a `tracking.*` call made after it goes after it.
      this._inOrder(() => convertParams(event, options).then((body) => () => this._trackNatively(body)))
        .catch((error) => console.error('[SDK] track failed:', error?.message ?? error))
      return
    }
    this.push(async () => {
      try {
        const queryParams = await convertParams(event, options)
        const sourceParams = await getSourceParams(this.shop_id)
        Object.assign(queryParams, sourceParams)
        const response = await this._request('push', {
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          params: {
            shop_id: this.shop_id,
            stream: this.stream,
            segment: this.segment,
            ...queryParams,
          },
        })
        // Check for popup in response
        await this.checkAndShowPopup(response)
        return response
      } catch (error) {
        return error
      }
    })
  }

  /**
   * An event of `track(event, options)` — its fields as `convertParams` made them — on the native SDK:
   * through the native `tracking` method of its meaning, which checks it. What no such method covers
   * goes through the native queue with the fields as before: the free-form purchase of
   * `track('purchase', …)` (items without a price, `segment_ab`), `recone_view` and `recone_click`, and
   * a view or a cart with a `recommended_by` that is no source type of the contract. Handed to the native
   * module at once: `track` calls it when its turn came (`_inOrder`).
   * @param {Record<string, any>} body
   * @returns {Promise<void>}
   */
  _trackNatively(body) {
    const items = Array.isArray(body.items) ? body.items : []
    const id = (item) => String(item?.id ?? '')
    const item = (value) => {
      const result = { id: id(value) }
      const quantity = numberOf(value?.quantity)
      const price = numberOf(value?.price)
      if (quantity != null) result.quantity = quantity
      if (price != null) result.price = price
      return result
    }
    let source = null
    if (body.recommended_by != null) {
      try {
        source = { type: sourceTypeValue(body.recommended_by), code: String(body.recommended_code ?? '') }
      } catch (_) {
        return this._queueNow({ path: 'push', body })
      }
    }
    switch (body.event) {
      case 'view':
        return this._native.trackingProductView(this.shop_id, id(items[0]), source)
      case 'category':
        return this._native.trackingCategoryView(this.shop_id, String(body.category_id ?? ''))
      case 'search':
        return this._native.trackingSearch(this.shop_id, String(body.search_query ?? ''), listOf(body.results) ?? null)
      case 'cart':
        return body.full_cart
          ? this._native.trackingSyncCart(this.shop_id, items.map(item))
          : this._native.trackingAddToCart(this.shop_id, item(items[0]), source)
      case 'remove_from_cart':
        return this._native.trackingRemoveFromCart(this.shop_id, id(items[0]))
      case 'wish':
        return body.full_wish
          ? this._native.trackingSyncFavorites(this.shop_id, items.map(id))
          : this._native.trackingAddToFavorites(this.shop_id, id(items[0]), source)
      case 'remove_wish':
        return this._native.trackingRemoveFromFavorites(this.shop_id, id(items[0]))
      default:
        return this._queueNow({ path: 'push', body })
    }
  }

  /**
   * Strict purchase tracking (`push`, `event` = `purchase`) with 4.x's request.
   * @deprecated Use `tracking.purchase(request, source)`.
   * @param {import('./types/purchaseTracking').LegacyPurchaseTrackingRequest} purchaseRequest
   * @returns {void}
   */
  trackPurchase(purchaseRequest) {
    if (this._native && this._legacyPurchaseGoesRaw(purchaseRequest)) {
      // An attribution Android's and iOS's purchase take differently, or not at all (`web_push_digest`,
      // `transactional`, a type neither knows): the event as 4.x built it, through the native queue's raw
      // entry, the same on both platforms — as 4.0.26 sent it.
      let body
      try {
        body = buildPurchaseTrackingParams(purchaseRequest)
      } catch (err) {
        console.error(err?.message ?? err)
        return
      }
      popupsV3Hook(this, 'onPurchase')
      this._sendEvent({ path: 'push', body })
        .catch((error) => console.error('[SDK] trackPurchase failed:', error?.message ?? error))
      return
    }
    if (this._native) {
      // The whole 4.x request, `recommendedBy`, `recommendedSource`, `stream`, `segment` and the items'
      // `quantity` with it: the native module reads them, where `tracking.purchase` sends only the
      // contract's fields. The native SDK checks the request; its refusal is told here, as the check
      // before was.
      popupsV3Hook(this, 'onPurchase')
      this._nativeCall('trackingPurchase', requestArg(purchaseRequest), null)
        .catch((error) => console.error('[SDK] trackPurchase failed:', error?.message ?? error))
      return
    }
    /** @type {Record<string, unknown>} */
    let queryParams
    try {
      queryParams = buildPurchaseTrackingParams(purchaseRequest)
    } catch (err) {
      console.error(err?.message ?? err)
      return
    }
    popupsV3Hook(this, 'onPurchase')

    this.push(async () => {
      try {
        const sourceParams = await getSourceParams(this.shop_id)
        Object.assign(queryParams, sourceParams)
        const response = await this._request('push', {
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          params: {
            shop_id: this.shop_id,
            stream: this.stream,
            segment: this.segment,
            ...queryParams,
          },
        })
        await this.checkAndShowPopup(response)
        return response
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[SDK] trackPurchase failed:', error)
        return error
      }
    })
  }

  /**
   * Whether the deprecated `trackPurchase` sends `request` as 4.x built it rather than through the native
   * purchase: when it names a `recommendedBy` whose type is not one both native purchases take alike.
   * @param {any} request
   * @returns {boolean}
   */
  _legacyPurchaseGoesRaw(request) {
    const by = request?.recommendedBy
    if (by == null || typeof by !== 'object') return false
    return !(typeof by.type === 'string' && NATIVE_PURCHASE_ATTRIBUTIONS.has(by.type))
  }

  /**
   * @param {string} event
   * @param {import('./types/customEventParams').CustomEventParams | undefined} [params]
   * @returns {void}
   */
  trackEvent(event, params) {
    /** @type {Record<string, unknown>} */
    let queryParams
    try {
      queryParams = buildTrackCustomEventParams(event, params)
    } catch (err) {
      console.error(err?.message ?? err)
      return
    }
    popupsV3Hook(this, 'onTrackEvent', event)

    if (this._native) {
      // The event as 4.x built it, through the native queue's raw entry: a `time` or `value` with a
      // fraction, or past 32 bits, goes as it went, where `tracking.custom` takes whole 32-bit numbers. The
      // stored source stays out: the server does not read it on `push/custom`.
      this._sendEvent({ path: 'push/custom', body: queryParams })
        .catch((error) => console.error('[SDK] trackEvent failed:', error?.message ?? error))
      return
    }

    this.push(async () => {
      try {
        const sourceParams = await getSourceParams(this.shop_id)
        Object.assign(queryParams, sourceParams)

        const response = await this._request('push/custom', {
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          params: {
            shop_id: this.shop_id,
            stream: this.stream,
            segment: this.segment,
            ...queryParams,
          },
        })
        // Check for popup in response
        await this.checkAndShowPopup(response)
        return response
      } catch (error) {
        return error
      }
    })
  }

  /**
   * Saves recommendation source (type and code). For the next 48 hours, track() and trackEvent() will automatically include source in params.
   * @param {string} source - Source type (e.g. 'dynamic', 'full_search', 'instant_search', 'stories', 'chain', 'transactional', 'bulk', 'web_push_digest').
   * @param {string} code - Source code (e.g. recommender block code, search query, stories code).
   */
  trackSource(source, code) {
    if (this._native) {
      if (this._released) {
        console.error('[SDK] trackSource:', releasedError().message)
        return
      }
      const type = String(source ?? '')
      const text = String(code ?? '')
      let wire = null
      try {
        wire = sourceTypeValue(type)
      } catch (_) {
        // A type the SDK does not know: 4.x stored it all the same.
      }
      if (wire != null && text.trim() !== '') {
        // The native SDK keeps it and adds it to the shop's `push` events for 48 hours, as 4.x did; one 4.x's
        // way kept before goes — the new source replaces it.
        this._sendSourceToNative(wire, text)
        AsyncStorage.multiRemove(this._legacySourceKeys()).catch(() => {})
        return
      }
      // What the native SDKs do not take — a type they do not know, an empty code — is stored as 4.x stored
      // it, and the events do not carry it.
      console.warn(
        `[SDK] trackSource: the native SDK does not take the source ${JSON.stringify(type)} with the code ${JSON.stringify(text)}: it is stored, and the events do not carry it`
      )
    }
    const shop_id = this.shop_id
    const keyTime = getStorageKey(SOURCE_STORAGE_KEYS.timeStartSave, shop_id)
    const keyCode = getStorageKey(SOURCE_STORAGE_KEYS.recomendedCode, shop_id)
    const keyType = getStorageKey(SOURCE_STORAGE_KEYS.recomendedType, shop_id)
    const timeSec = Math.floor(Date.now() / 1000)
    AsyncStorage.multiSet([
      [keyTime, String(timeSec)],
      [keyCode, String(code ?? '')],
      [keyType, String(source ?? '')],
    ]).catch(() => {})
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
    if (['delivered', 'opened', 'clicked', 'closed'].includes(event)) {
      // The `notifications` namespace: the same request, from this JavaScript until pushes move to the
      // native SDK.
      this._pushEvent(event, options?.code, options?.type)
        .catch((error) => { if (DEBUG) console.warn(`[SDK] notification ${event} failed:`, error?.message ?? error) })
      return
    }
    this.push(async () => {
      try {
        const res = await this._request(`track/${event}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          params: {
            shop_id: this.shop_id,
            stream: this.stream,
            ...options,
          },
        })
        // Check for popup in response
        await this.checkAndShowPopup(res)
        return res
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
      this.push(async () => {
        try {
          const res = await this._request(`recommend/${recommender_code}`, {
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
              // A block under an A/B test answers an error without it.
              segment: this.segment,
              recommender_code,
              ...options,
            },
          })
          // Check for popup in response
          await this.checkAndShowPopup(res)
          resolve(res)
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * GET api/v3/cdp/users/probability-to-purchase on the account's host — predicted purchase
   * probability for the current visitor. The shop needs the CDP service: without it the call rejects
   * with the server's message (HTTP 402).
   *
   * @param {import('./types/purchasePredict').PurchasePredictParams} [params={}] — Optional `email`, `phone`, `telegram_id`, `loyalty_id` (API names). Empty object uses only SDK `did` / session.
   * @returns {Promise<import('./types/purchasePredict').PurchasePredictResponse>}
   */
  getProbabilityToPurchase(params = {}) {
    // `predict.getProbabilityToPurchase`; the native SDK finds the visitor by the device only, so a
    // visitor named by a contact still goes through this JavaScript.
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          // On the native SDK its own device id: the stored one may be a forgotten customer's.
          const storageData = this._native ? null : await getData(this.shop_id)
          const deviceId = storageData?.did || this.deviceId || ''
          if (deviceId && deviceId !== this.deviceId) {
            this.deviceId = deviceId
          }
          const extra = buildPurchasePredictQueryParams(params)
          const res = await this._request(`https://${appHostOf(this.shop_id)}/api/v3/cdp/users/probability-to-purchase`, {
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
              did: deviceId,
              ...extra,
            },
          })
          // request() resolves even on errors — reject on Error instance or API error message
          if (res instanceof Error) {
            reject(res)
            return
          }
          // `{ status: 'success', payload: { probability, client_id } }`; an error is `{ status, message }`.
          const payload = res?.payload
          if (!payload || typeof payload.probability !== 'number') {
            reject(new Error(res?.message || 'The purchase prediction answer could not be read'))
            return
          }
          resolve({ probability: payload.probability, client_id: payload.client_id ?? null })
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
          // Get current deviceId from storage to ensure it's up-to-date. On the native SDK its own
          // device id: the stored one may be a customer deleteUserCredentials forgot meanwhile.
          const storageData = this._native ? null : await getData(this.shop_id)
          const deviceId = storageData?.did || this.deviceId || ''
          if (deviceId && deviceId !== this.deviceId) {
            this.deviceId = deviceId
          }
          
          const requestParams = {
            shop_id: this.shop_id,
            did: deviceId,
          }
          
          this._request(`stories/${code}`, {
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
    // On the native SDK it resolves once the event is accepted into its queue, not on the answer.
    if (this._native) return this.tracking.storyView(storyId, slideId, code)
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
          
          this._request('track/stories', {
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
          }).then(async (res) => {
            // Check for popup in response
            await this.checkAndShowPopup(res)
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
    if (this._native) return this.tracking.storyClick(storyId, slideId, code)
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
          
          this._request('track/stories', {
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
          }).then(async (res) => {
            // Check for popup in response
            await this.checkAndShowPopup(res)
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
          this._request('products/cart', {
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
   * Returns cart items from the API as typed CartItem array (productId, quantity).
   * For raw API response use cart().
   * @returns {Promise<import('./types/productTypes').CartItem[]>}
   */
  getProductsFromCart() {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const res = await this._request('products/cart', {
            params: { shop_id: this.shop_id },
          })
          if (res instanceof Error) {
            reject(res)
            return
          }
          const items = res?.data?.items ?? res?.items ?? []
          const parsed = Array.isArray(items) ? items.map(parseCartItem) : []
          resolve(parsed)
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /**
   * Fetches full product info by id.
   * @param {string} id - Product id (item_id).
   * @returns {Promise<import('./types/productTypes').ProductInfo>}
   */
  getProductInfo(id) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const res = await this._request('products/get', {
            params: {
              shop_id: this.shop_id,
              item_id: id,
            },
          })
          if (res instanceof Error) {
            reject(res)
            return
          }
          resolve(parseProductInfo(res))
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /**
   * Fetches products list with optional filters (brands, merchants, categories, etc.).
   * @param {Object} [options]
   * @param {string} [options.brands]
   * @param {string} [options.merchants]
   * @param {string} [options.categories]
   * @param {string} [options.locations]
   * @param {number} [options.limit]
   * @param {number} [options.page]
   * @param {Record<string, any>} [options.filters] - Sent as JSON string to API.
   * @returns {Promise<import('./types/productTypes').ProductsListResponse>}
   */
  getProductsList(options = {}) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const params = { shop_id: this.shop_id }
          if (options.brands != null) params.brands = options.brands
          if (options.merchants != null) params.merchants = options.merchants
          if (options.categories != null) params.categories = options.categories
          if (options.locations != null) params.locations = options.locations
          if (options.limit != null) params.limit = String(options.limit)
          if (options.page != null) params.page = String(options.page)
          if (options.filters != null && typeof options.filters === 'object') {
            params.filters = JSON.stringify(options.filters)
          }
          const res = await this._request('products', { params })
          if (res instanceof Error) {
            reject(res)
            return
          }
          resolve(parseProductsListResponse(res))
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /**
   * Fetches the products of the user's last order.
   * The `orders/last_for_user` endpoint returns a top-level array of products.
   * @param {Object} [options] - Optional extra params (e.g. email, phone).
   * @returns {Promise<import('./types/productTypes').Product[]>}
   */
  getLastOrderProducts(options = {}) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const res = await this._request('orders/last_for_user', {
            params: {
              shop_id: this.shop_id,
              segment: this.segment || null,
              ...options,
            },
          })
          if (res instanceof Error) {
            reject(res)
            return
          }
          resolve(Array.isArray(res) ? res.map(parseProduct) : [])
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /**
   * Fetches the list of the user's orders (`orders/by_user`), ascending by date and internal id.
   *
   * Requires `shop_secret` in `options`. The user is identified by `did` (added automatically)
   * or by `email` / `phone` / `loyalty_id` / `external_id`. Optional `date_from` (YYYY-MM-DD).
   *
   * NOTE: `shop_secret` is a server-side secret key; shipping it inside a mobile app exposes it.
   * Use only in trusted contexts.
   *
   * Response envelope `{ status, data: { orders: [...] } }` is parsed to a list of orders.
   *
   * @param {Object} options - Must include `shop_secret`; may include identifiers and `date_from`.
   * @returns {Promise<import('./types/orderTypes').Order[]>}
   */
  getUserOrders(options = {}) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const res = await this._request('orders/by_user', {
            params: {
              shop_id: this.shop_id,
              ...options,
            },
          })
          if (res instanceof Error) {
            reject(res)
            return
          }
          resolve(parseUserOrdersResponse(res))
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /**
   * Joins the loyalty program (`loyalty/members/join`).
   *
   * `shop_id` is added automatically. `phone` is required by the endpoint;
   * `email`, `first_name`, `last_name` are optional.
   *
   * @param {Object} params - Member fields; must include `phone`.
   * @returns {Promise<import('./types/loyaltyTypes').LoyaltyJoinResponse>}
   */
  loyaltyJoin(params = {}) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const res = await this._request('loyalty/members/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
              ...params,
            },
          })
          if (res instanceof Error) {
            reject(res)
            return
          }
          resolve(parseLoyaltyJoinResponse(res))
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /**
   * Fetches the loyalty membership status (`loyalty/members/status`).
   *
   * `shop_id` is added automatically.
   *
   * @param {string} identifier - Member identifier (phone).
   * @returns {Promise<import('./types/loyaltyTypes').LoyaltyStatus>}
   */
  getLoyaltyStatus(identifier) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const res = await this._request('loyalty/members/status', {
            params: {
              shop_id: this.shop_id,
              identifier,
            },
          })
          if (res instanceof Error) {
            reject(res)
            return
          }
          resolve(parseLoyaltyStatus(res))
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /**
   * Fetches view/cart/purchase counters and trigger counts for a product
   * (`GET /products/counters`).
   *
   * @param {string} item - Product item id.
   * @returns {Promise<import('./types/catalogTypes').ProductCountersResponse>}
   */
  getProductCounters(item) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const res = await this._request('products/counters', {
            params: {
              shop_id: this.shop_id,
              item,
            },
          })
          if (res instanceof Error) {
            reject(res)
            return
          }
          resolve(parseProductCounters(res))
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /**
   * Fetches a category listing (`GET /category/{category}`).
   *
   * `shop_id`, `did`, `sid` are added automatically. [category] is the category
   * slug (not a numeric id). Optional `params` are sent as they are: `limit`, `page`,
   * `brands`, `locations`, `filters` (facets as a JSON string), `price_min`, `price_max`,
   * `sort_by`, `sort_dir`.
   *
   * @param {string} category - Category slug (path segment).
   * @param {Object} [params={}] - Optional filter/paging params.
   * @returns {Promise<import('./types/catalogTypes').CategoryResponse>}
   */
  getCategory(category, params = {}) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const res = await this._request(`category/${category}`, {
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
              ...params,
            },
          })
          if (res instanceof Error) {
            reject(res)
            return
          }
          resolve(parseCategory(res))
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /**
   * Fetches a configured product collection (`GET /collection/{id}`).
   *
   * `shop_id`, `did` are added automatically. [collectionId] is configured in the
   * dashboard. Optional `params` may include `location`, `email`, `phone`,
   * `external_id`, `loyalty_id`.
   *
   * @param {string|number} collectionId - Collection id (path segment).
   * @param {Object} [params={}] - Optional identity/location params.
   * @returns {Promise<import('./types/catalogTypes').CollectionResponse>}
   */
  getCollection(collectionId, params = {}) {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const res = await this._request(`collection/${collectionId}`, {
            params: {
              shop_id: this.shop_id,
              ...params,
            },
          })
          if (res instanceof Error) {
            reject(res)
            return
          }
          resolve(parseCollection(res))
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /**
   * Clears local cart product state keys (prefix cart.product.) from AsyncStorage.
   * Use when resetting "in cart" UI state, e.g. after order or logout.
   * @returns {Promise<void>}
   */
  resetCartProductStates() {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const prefix = getStorageKey('cart.product.', this.shop_id)
          const allKeys = await AsyncStorage.getAllKeys()
          const keysToRemove = allKeys.filter((k) => typeof k === 'string' && k.startsWith(prefix))
          if (keysToRemove.length > 0) {
            await AsyncStorage.multiRemove(keysToRemove)
          }
          resolve()
        } catch (e) {
          reject(e)
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
      this.push(async () => {
        try {
          const res = await this._request('search', {
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
              segment: this.segment,
              ...options,
            },
          })
          // Check for popup in response
          await this.checkAndShowPopup(res)
          resolve(res)
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
   * Sends a review (NPS) to the API.
   *
   * @param {number} rate - Rating value, must be between 1 and 10 (inclusive).
   * @param {string} [channel] - Channel code (e.g. 'android_app', 'ios_app', 'web_popup', 'email'). If omitted or empty, uses 'android_app' or 'ios_app' from platform.
   * @param {string} category - Category identifier (e.g. 'order').
   * @param {string} [orderId] - Optional order identifier.
   * @param {string} [comment] - Optional comment text.
   * @returns {Promise<void>} - Resolves on success, rejects on validation or request error.
   */
  review(rate, channel, category, orderId, comment) {
    return new Promise((resolve, reject) => {
      const numRate = Number(rate)
      if (typeof rate !== 'number' && typeof rate !== 'string') {
        reject(new Error('Error: rating can be between 1 and 10 only'))
        return
      }
      if (Number.isNaN(numRate) || numRate < REVIEW_RATE_MIN || numRate > REVIEW_RATE_MAX) {
        reject(new Error('Error: rating can be between 1 and 10 only'))
        return
      }
      this.push(async () => {
        try {
          const channelValue = (channel != null && channel !== '')
            ? channel
            // The app's platform (4.x read the stream: every stream but `android` gave `ios_app`).
            : (Platform.OS === 'android' ? 'android_app' : 'ios_app')
          await this._request('nps/create', {
            method: 'POST',
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
              rate: numRate,
              channel: channelValue,
              category: category ?? '',
              order_id: orderId ?? '',
              comment: comment ?? '',
            },
          })
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * Fetches the list of NPS channels available for the shop (for use with review).
   *
   * @returns {Promise<Array<Record<string, any>>>} - A promise that resolves with the list of channels.
   */
  getNpsChannels() {
    return new Promise((resolve, reject) => {
      this.push(() => {
        try {
          this._request('nps/channels', {
            method: 'GET',
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
            },
          }).then((res) => {
            resolve(Array.isArray(res) ? res : (res?.channels ?? res ?? []))
          }).catch(reject)
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * Fetches the list of NPS categories available for the shop (for use with review).
   *
   * @returns {Promise<Array<Record<string, any>>>} - A promise that resolves with the list of categories.
   */
  getNpsCategories() {
    return new Promise((resolve, reject) => {
      this.push(() => {
        try {
          this._request('nps/categories', {
            method: 'GET',
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
            },
          }).then((res) => {
            resolve(Array.isArray(res) ? res : (res?.categories ?? res ?? []))
          }).catch(reject)
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * @param {Record<string, any>} params
   * @returns {void}
   */
  setProfile(params) {
    popupsV3Hook(this, 'onContextChange', 'profile', 'set', params)
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
        const res = await this._request('profile/set', {
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          params: {
            shop_id: this.shop_id,
            stream: this.stream,
            ...params,
          },
        })
        // Check for popup in response
        await this.checkAndShowPopup(res)
        return res
      } catch (error) {
        return error
      }
    })
  }

  /**
   * Fetches the stored user profile (`GET /profile`).
   *
   * `shop_id` and `did` are added automatically. The response is parsed into a
   * normalized object; the full untouched payload is available under `raw`.
   *
   * @returns {Promise<import('./types/catalogTypes').ProfileResponse>}
   */
  getProfile() {
    return new Promise((resolve, reject) => {
      this.push(async () => {
        try {
          const res = await this._request('profile', {
            method: 'GET',
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
            },
          })
          if (res instanceof Error) {
            reject(res)
            return
          }
          resolve(parseProfile(res))
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
    // The native SDK sends it by the contract's rules (once a week, the platform's fields).
    if (this._native) {
      this._setPushToken(token, this._ownTokenProvider())
        .catch((error) => console.warn('[SDK] The push token was not sent:', error?.message ?? error))
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

        return await this._request('mobile_push_tokens', {
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
    return this._requestPushPermissionOnce()
  }

  /**
   * @param {boolean} removeOld
   * @returns {Promise<string | null>}
   */
  async initPushToken(removeOld = false) {
    if (removeOld) {
      await this.deleteToken()
      this._tokenCache = null
    }

    // Fast path: in-memory cache populated on the same JS run (avoids AsyncStorage race).
    if (!removeOld && this._tokenCache) {
      if (DEBUG) console.log('[SDK] FCM token from memory cache')
      await this._pushOrchestrator.installSubscriptions()
      return this._tokenCache
    }

    const savedToken = await this._getSavedPushToken(this.shop_id)
    if (savedToken) {
      if (DEBUG) console.log('[SDK] Stored FCM token')
      this._tokenCache = savedToken
      // Even when token is already cached, ensure tracking subscriptions are installed.
      await this._pushOrchestrator.installSubscriptions()
      return savedToken
    }

    if (Platform.OS === 'android' && this._pushPermissionState === 'requesting') {
      const permissionDecision = await this._waitForPushPermissionResolution()
      if (permissionDecision === 'denied') {
        this._logPushNullReason('permission_denied')
        return null
      }
      if (permissionDecision === 'timeout') {
        this._logPushNullReason('permission_timeout', {
          timeoutMs: PUSH_PERMISSION_WAIT_TIMEOUT_MS,
        })
        return null
      }
    }

    const messaging = this._ensureMessaging()
    if (!messaging) {
      this._logPushNullReason('messaging_unavailable')
      return null
    }

    let token = null
    try {
      token = await this._pushOrchestrator.fetchToken({
        messaging,
        pushType: this._push_type,
        platformOS: Platform.OS,
      })
    } catch (error) {
      this._logFirebaseError('initPushToken.fetchToken', error)
      this._logPushNullReason('push_token_error')
      return null
    }

    if (!token) {
      this._logPushNullReason('token_empty')
      return null
    }
    // Cache immediately so getToken() called right after won't race with AsyncStorage write.
    this._tokenCache = token
    // A token the provider handed the SDK's own registration: the app's onToken hears it.
    tellPushToken(this, { token, provider: this._ownTokenProvider() })
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
      // Keep in sync with displayPush's channel — without an explicit sound the channel is silent
      // (Notifee default) and pushes only vibrate. Frozen after first creation → reinstall to apply.
      sound: 'default',
      vibration: true,
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
   * @returns {Promise<string | null | false>} The token on success, null if permission denied/token unavailable, false if already locked.
   */
  async initPush(
    notifyClick = false,
    notifyReceive = false,
    notifyBgReceive = false
  ) {
    if (this._released) throw releasedError()
    // Always allow updating listeners, even if initPush() is called repeatedly.
    // Replays a buffered cold-start through `notifyClick` if the default already
    // consumed it (e.g. autoSendPushToken auto-init ran first).
    this._pushOrchestrator.setListeners({
      click: notifyClick || undefined,
      receive: notifyReceive || undefined,
      bgReceive: notifyBgReceive || undefined,
    })

    // The push handlers go in first: a push that comes while the permission or the token is being asked
    // for is handled, not lost.
    await this._pushOrchestrator.installSubscriptions()

    if (this._initPushPromise) {
      return this._initPushPromise
    }

    const lock = await initLocker(this.shop_id)
    if (
      lock &&
      lock.hasOwnProperty('state') &&
      lock.state === true &&
      new Date().getTime() < lock.expires
    ) {
      return false
    }

    this._initPushPromise = (async () => {
      try {
        await setInitLocker(true, this.shop_id)

        const granted = await this.getPushPermission()
        if (!granted) {
          await setInitLocker(false, this.shop_id)
          return null
        }

        await this.initPushChannel()
        const token = await this.initPushToken(false)

        if (!token) {
          await setInitLocker(false, this.shop_id)
        }

        return token ?? null
      } finally {
        this._initPushPromise = null
      }
    })()

    return this._initPushPromise
  }

  /**
   * Show push notification to user
   * @param {{ data: { id: string, type: string }}} message
   * @returns {Promise<void>}
   */
  async showNotification(message) {
    if (DEBUG) console.log('[SDK] Show notification')
    await updPushData(message, this.shop_id)
    // Drawn by the SDK: `opened`, and the app's onOpened once it was accepted.
    this._pushSeen('opened', message)
    // Rendering lives in displayPush (shared with the PushRouter's pending-shop path) so a live shop
    // and a not-yet-initialized shop show identical notifications.
    await displayPush(message)
  }

  /**
   * @param {string} trigger_name
   * @param {Record<string, any>} data
   * @returns {void}
   */
  triggers(trigger_name, data) {
    popupsV3Hook(this, 'onContextChange', 'subscription', trigger_name, data)
    this.push(async () => {
      try {
        return await this._request(`subscriptions/${trigger_name}`, {
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
    this._tokenCache = null
    this._nativePushToken = null
    this._nativePushTokens = null
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
    if (action !== 'get') popupsV3Hook(this, 'onContextChange', 'segment', action, data)
    return new Promise((resolve, reject) => {
      this.push(() => {
        try {
          this._request(`segments/${action}`, {
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
      notification?.data?.message_id ||
      notification?.data?.['google.message_id'] ||
      notification?.data?.['gcm.message_id']
    let push
    if (messageId) {
      const pushData = await getPushData(messageId, this.shop_id)
      if (!Array.isArray(pushData) || pushData.length === 0) return false
      push = pushData[0]
      await removePushMessage(messageId, this.shop_id)
    } else {
      // A direct APNs push has no message id — no stored push is its own: the tap's push is, when it is the
      // SDK's (its `src`), not the first push kept.
      const { code, type } = typeAndCode(notification)
      if (!code || !type) return false
      push = notification
    }
    // The SDK's own handling of a tap: `clicked`, and the app's onClicked once it was accepted.
    this._pushSeen('clicked', notification)

    // An object in an APNs push, its JSON string in an FCM one.
    /** @type {Event | null} */
    const message_event = eventOf(push)
    if (!message_event) return false
    let message_url = ''
    switch (message_event.type) {
      case 'web':
        message_url = message_event.uri
        break
      case 'product':
        try {
          await this._request(
            `products/get?item_id=${message_event.uri}&shop_id=${this.shop_id}`,
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
          await this._request(
            `category/${message_event.uri}?shop_id=${this.shop_id}`,
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

  /**
   * Track popup shown event and mark popup as shown in storage.
   * Intended for host app usage in delegate mode (when popup is presented by the host app).
   *
   * @param {number} popupId
   * @returns {Promise<void>}
   */
  async trackPopupShown(popupId) {
    if (!popupId || typeof popupId !== 'number') {
      console.warn('[MainSDK] trackPopupShown: invalid popupId')
      return
    }

    try {
      if (this._released) throw releasedError()
      const shopId = this.shop_id
      if (this._native) {
        await this.tracking.popupShown(popupId)
        await PopupLogic.markPopupAsShown(popupId, shopId)
        return
      }
      const storageData = await getData(shopId)
      const deviceId = storageData?.did || this.deviceId || ''
      const seance = storageData?.seance || storageData?.sid || this.userSeance || ''

      await PopupLogic.trackPopupShown(popupId, shopId, deviceId, seance)
      await PopupLogic.markPopupAsShown(popupId, shopId)
    } catch (error) {
      console.error('[MainSDK] trackPopupShown error:', error)
    }
  }

  /**
   * Check response for popup data and show popup if present
   * @param {Object} response - API response
   * @param {boolean} manual - Whether popup is shown manually
   * @param {{ delayWaited?: boolean }} [options] `delayWaited`: the popup's `delay` passed already — the
   *   native SDK hands a popup over once it did — so it is shown at once
   * @returns {Promise<void>}
   */
  async checkAndShowPopup(response, manual = false, options = {}) {
    if (DEBUG) console.log('[MainSDK] checkAndShowPopup called, response:', response ? 'exists' : 'null', 'initialized:', this.initialized)
    
    if (!response || !this.initialized) {
      if (DEBUG) console.log('[MainSDK] checkAndShowPopup skipped: response=', !!response, 'initialized=', this.initialized)
      return
    }

    // Check if response contains popup data
    // Popup should have id and either html or components
    if (DEBUG) console.log('[MainSDK] Checking for popup in response, response.popup:', response.popup ? 'exists' : 'missing')
    
    if (response.popup && typeof response.popup === 'object' && response.popup.id) {
      if (DEBUG) console.log('[MainSDK] Popup found with id:', response.popup.id)
      
      const hasHtml = response.popup.html && typeof response.popup.html === 'string'
      const hasComponents = response.popup.components && (typeof response.popup.components === 'string' || typeof response.popup.components === 'object')
      
      if (DEBUG) console.log('[MainSDK] Popup data check - hasHtml:', hasHtml, 'hasComponents:', hasComponents)
      
      if (hasHtml || hasComponents) {
        // Delegate mode: if delegate is set, do not auto-present popups.
        // Host app is responsible for UI and tracking `popup/showed`.
        if (this.popupPresentationDelegate && typeof this.popupPresentationDelegate === 'function') {
          try {
            const popupId = response.popup.id
            const wasShown = await PopupLogic.wasPopupShown(popupId, this.shop_id)
            if (wasShown) {
              if (DEBUG) console.log(`[MainSDK] Popup ${popupId} was already shown, skipping delegate call`)
              return
            }

            if (DEBUG) console.log('[MainSDK] Popup detected in response, forwarding to delegate...')
            this.popupPresentationDelegate(response.popup, this)
          } catch (error) {
            if (DEBUG) console.error('[MainSDK] Error forwarding popup to delegate:', error)
          }
          return
        }

        if (!manual && this.enableAutoPopupPresentation === false) {
          if (DEBUG) console.log('[MainSDK] Popup skipped: automatic popup presentation is off')
          return
        }

        if (DEBUG) console.log('[MainSDK] Popup detected in response, preparing to show...')
        try {
          if (options.delayWaited) await prepareAndShow(this, response.popup, manual, { delayWaited: true })
          else await prepareAndShow(this, response.popup, manual)
          if (DEBUG) console.log('[MainSDK] prepareAndShow completed')
        } catch (error) {
          if (DEBUG) console.error('[MainSDK] Error showing popup:', error)
        }
      } else {
        if (DEBUG) console.warn('[MainSDK] Popup data found but missing both html and components')
      }
    } else {
      if (DEBUG) console.log('[MainSDK] No popup found in response')
    }
  }
}

export default MainSDK
