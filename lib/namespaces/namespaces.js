'use strict'

import { SdkError } from '../facade/errors'
import { pushCallbacksOf } from '../push/pushCallbacks'

/**
 * The contract's namespaces of one shop (`sdk/contract/*.md`): `sdk.products`, `sdk.search`, … Each
 * method calls the native SDK's method of the same name through the native module and resolves with its
 * model — a map with the contract's field names — or rejects with an `SdkError`. The checks of the
 * arguments and the requests are the native SDK's; this file only hands the arguments over in the form
 * the native module takes: an optional value as `null`, an enumeration's value as its wire value.
 *
 * Without the native module (Expo Go, an app not rebuilt after installing the SDK) every method rejects
 * with `notInitialized`: the earlier methods of the SDK (`recommend`, `search`, …) still work there.
 * `tracking` lives in MainSDK, and `notifications` keeps the push events and the token in JavaScript
 * until pushes move to the native SDK.
 */

/** `SortBy` of the contract → its wire value; an unknown key (the set is open) goes as it is. */
const SORT_BY = { salesRate: 'sales_rate', priceMargin: 'price_margin' }

/** `Gender` of the contract → its wire value. */
const GENDER = { male: 'm', female: 'f' }

function invalid(message) {
  return new SdkError('invalidArgument', message)
}

/** An optional value as the native module takes it: `undefined` is `null`. */
const opt = (value) => (value === undefined ? null : value)

/** A plain object or `null`/`undefined` (`{}` then); anything else is `invalidArgument`. */
function options(value, name) {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) throw invalid(`${name} must be an object`)
  return value
}

/** A copy of a request without its `undefined` fields; `null` for none. */
function request(value, name) {
  if (value == null) return null
  const result = {}
  for (const [key, field] of Object.entries(options(value, name))) {
    if (field !== undefined) result[key] = field
  }
  return result
}

function requireString(value, name) {
  if (typeof value !== 'string') throw invalid(`${name} must be a string`)
  return value
}

function requireNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(`${name} must be a number`)
  return value
}

function optionalNumber(value, name) {
  return value == null ? null : requireNumber(value, name)
}

function requireStrings(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw invalid(`${name} must be a list of strings`)
  }
  return value
}

const optionalStrings = (value, name) => (value == null ? null : requireStrings(value, name))

/** The wire value of a `Gender`: the contract's name or the wire value itself. */
export function genderValue(value) {
  if (value == null) return value
  return GENDER[value] ?? value
}

/** The wire value of a `SortBy`. */
export function sortByValue(value) {
  if (value == null) return value
  return SORT_BY[value] ?? value
}

/** A listing or search request with its `sortBy` as the wire value. */
function sortedRequest(value, name) {
  const result = request(value, name)
  if (result?.sortBy != null) result.sortBy = sortByValue(result.sortBy)
  return result
}

/** A `ProfileUpdateRequest` with the genders as wire values. */
function profileRequest(value) {
  const result = request(value, 'request')
  if (result == null) throw invalid('request must be an object')
  if (result.gender != null) result.gender = genderValue(result.gender)
  if (Array.isArray(result.kids)) {
    result.kids = result.kids.map((kid) => (kid && typeof kid === 'object' ? { ...kid, gender: genderValue(kid.gender) ?? null } : kid))
  }
  return result
}

/** `email` and `phone` of a `ContactParams`. */
function contact(value) {
  const { email, phone } = options(value, 'contact')
  return [opt(email), opt(phone)]
}

/** A message's text fields: an empty one is none, as the iOS model keeps none (`""`). */
const MESSAGE_TEXTS = ['body', 'channel', 'code', 'date', 'icon', 'picture', 'sentAt', 'subject', 'type', 'url']
const MESSAGE_STATISTICS = ['opened', 'clicked', 'hardBounced', 'softBounced', 'complained', 'unsubscribed', 'purchased']

const isRecord = (value) => value != null && typeof value === 'object' && !Array.isArray(value)

/**
 * A message of the history, the same on both platforms: an empty text is none (iOS keeps `""`), the
 * mailing's id 0 is none (Android's model keeps 0 for none), and a statistic the answer leaves out is
 * `false` (Android's model keeps `false`, iOS's none).
 */
function historyMessage(message) {
  if (message == null || typeof message !== 'object') return message
  const result = { ...message }
  for (const key of MESSAGE_TEXTS) if (result[key] === '') result[key] = null
  if (result.campaignId === 0) result.campaignId = null
  if (isRecord(result.statistics)) {
    const statistics = { ...result.statistics }
    for (const key of MESSAGE_STATISTICS) statistics[key] = statistics[key] === true
    result.statistics = statistics
  }
  return result
}

/** A text of a released model: `""` is none, as iOS keeps none. */
const textOf = (value) => (value === '' || value === undefined ? null : value)

/**
 * A `Profile` the same on both platforms: an empty `id` or `emailRegisteredAt` is none, and no custom
 * properties — none in the answer, or the server's empty `[]` — is an empty map, as the contract has it.
 * @param {any} profile
 */
export function profileOf(profile) {
  if (!isRecord(profile)) return profile
  const result = { ...profile }
  for (const key of ['id', 'emailRegisteredAt']) if (result[key] === '') result[key] = null
  result.customProperties = isRecord(profile.customProperties) ? profile.customProperties : {}
  return result
}

const ORDER_TEXTS = [
  'id', 'date', 'value', 'cashValue', 'bonusesValue', 'deliveryValue', 'promocode', 'deliveryDate',
  'internalStatus', 'stream', 'channel', 'deliveryType', 'deliveryAddress', 'orderStatus', 'paymentType',
]
const ORDER_ITEM_TEXTS = ['price', 'status', 'originalPrice', 'barcode', 'lineId', 'cancelReason']
/** Numbers iOS's released product keeps as 0 for none, where Android's keeps none. */
const ORDER_PRODUCT_ZERO_IS_NONE = ['oldPrice', 'oldPriceFull', 'discountPercent']

/**
 * The product of an order's line, the same on both platforms: a text iOS keeps as `""` and Android as
 * none is none; an old price or a discount of 0 is none; no resized images are none. A field one
 * platform's released model does not have stays none there.
 */
function orderProduct(product) {
  if (!isRecord(product)) return product ?? null
  const result = {}
  for (const [key, value] of Object.entries(product)) result[key] = value === '' ? null : value
  for (const key of ORDER_PRODUCT_ZERO_IS_NONE) if (result[key] === 0) result[key] = null
  if (isRecord(result.resizedImages) && Object.keys(result.resizedImages).length === 0) result.resizedImages = null
  return result
}

/** A line of an order: a text `""` is none, an amount 0 is none (iOS keeps 0 for none, Android none). */
function orderItem(item) {
  if (!isRecord(item)) return item ?? null
  const result = { ...item }
  for (const key of ORDER_ITEM_TEXTS) result[key] = textOf(result[key])
  if (result.amount === 0 || result.amount === undefined) result.amount = null
  result.item = orderProduct(result.item)
  return result
}

/**
 * An `Order` the same on both platforms: the released models keep none differently — iOS `""`, 0 and
 * `false`, Android none. A text `""` is none, `internalId` 0 is none, `taxFree` the answer leaves out is
 * `false` (iOS cannot tell it from `false`), and no lines are an empty list.
 * @param {any} order
 */
export function orderOf(order) {
  if (!isRecord(order)) return order
  const result = { ...order }
  for (const key of ORDER_TEXTS) result[key] = textOf(result[key])
  if (result.internalId === 0 || result.internalId === undefined) result.internalId = null
  result.taxFree = result.taxFree === true
  result.items = Array.isArray(result.items) ? result.items.map(orderItem) : []
  return result
}

/**
 * The notification history as `{ status, messages }` (`NotificationHistory`). Both native modules hand
 * over `{ status, payload: { messages } }` with the same fields; an iOS module of an earlier build handed
 * the released iOS model, `{ notifications }`, without a message's channel and campaign, and is still read.
 * @param {any} history
 */
export function notificationsHistory(history) {
  const status = typeof history?.status === 'string' ? history.status : null
  if (Array.isArray(history?.payload?.messages)) return { status, messages: history.payload.messages.map(historyMessage) }
  if (Array.isArray(history?.notifications)) {
    return {
      status,
      messages: history.notifications.map((n) => historyMessage({
        body: n?.bodyData ?? null,
        campaignId: null,
        channel: null,
        code: n?.codeId ?? null,
        date: n?.dateString ?? null,
        icon: n?.icon ?? null,
        picture: n?.picture ?? null,
        sentAt: n?.dateSentAt ?? null,
        statistics: Array.isArray(n?.statistics) ? n.statistics[0] ?? null : n?.statistics ?? null,
        subject: n?.subject ?? null,
        type: n?.type ?? null,
        url: n?.url ?? null,
      })),
    }
  }
  return { status, messages: [] }
}

/**
 * `LoyaltyStatus`: a level without a `code` is no level — `null`, as the contract has it for the base
 * level and for one who is no member. A code is passed on as the native SDK has it, never made up.
 * @param {any} status
 */
export function loyaltyStatus(status) {
  if (status == null || typeof status !== 'object') return status
  const level = status.level
  if (level != null && typeof level === 'object' && level.code == null) return { ...status, level: null }
  return status
}

/**
 * Wraps each method: arguments the namespace cannot hand over reject with `invalidArgument`, as the
 * native SDK's own checks do, instead of throwing at the caller.
 * @param {Record<string, Function>} methods
 */
function guarded(methods) {
  const result = {}
  for (const [name, method] of Object.entries(methods)) {
    result[name] = (...args) => {
      try {
        return method(...args)
      } catch (error) {
        return Promise.reject(error)
      }
    }
  }
  return result
}

/**
 * The namespaces of `sdk`.
 * @param {import('../../MainSDK').default} sdk
 */
export function createNamespaces(sdk) {
  const call = (method, ...args) => sdk._nativeCall(method, ...args)

  const products = guarded({
    getInfo: (itemId) => call('productsGetInfo', requireString(itemId, 'itemId')),
    getList: (listRequest) => call('productsGetList', sortedRequest(listRequest, 'request')),
    getCounters: (itemId) => call('productsGetCounters', requireString(itemId, 'itemId')),
    getCategory: (categoryId, categoryRequest) =>
      call('productsGetCategory', requireString(categoryId, 'categoryId'), sortedRequest(categoryRequest, 'request')),
  })

  const collections = guarded({
    get: (collectionId) =>
      call('collectionsGet', typeof collectionId === 'number' ? String(collectionId) : requireString(collectionId, 'collectionId')),
  })

  const recommendations = guarded({
    get: (code, recommendationRequest) =>
      call('recommendationsGet', requireString(code, 'code'), request(recommendationRequest, 'request')),
  })

  const search = guarded({
    blank: () => call('searchBlank'),
    instant: (query, params) => {
      const { locations, excludedMerchants, excludedBrands } = options(params, 'params')
      return call(
        'searchInstant',
        requireString(query, 'query'),
        optionalStrings(locations, 'locations'),
        optionalStrings(excludedMerchants, 'excludedMerchants'),
        optionalStrings(excludedBrands, 'excludedBrands'),
      )
    },
    full: (query, fullRequest) => call('searchFull', requireString(query, 'query'), sortedRequest(fullRequest, 'request')),
    agentDialog: (params) => {
      const { sessionId, locations } = options(params, 'params')
      return call('searchAgentDialog', optionalNumber(sessionId, 'sessionId'), optionalStrings(locations, 'locations'))
    },
    agent: (message, params) => {
      const { sessionId, locations } = options(params, 'params')
      return call(
        'searchAgent',
        requireString(message, 'message'),
        optionalNumber(sessionId, 'sessionId'),
        optionalStrings(locations, 'locations'),
      )
    },
  })
  // Whether the last /init turned the search agent on: the native SDK's value, kept with the shop's state.
  Object.defineProperty(search, 'agentEnabled', { enumerable: true, get: () => sdk._agentEnabled === true })

  const cart = guarded({
    get: () => call('cartGet'),
    clear: (shopSecret, params) => {
      const { email, phone, loyaltyId, externalId, telegramId } = options(params, 'params')
      return call('cartClear', requireString(shopSecret, 'shopSecret'), opt(email), opt(phone), opt(loyaltyId), opt(externalId), opt(telegramId))
    },
  })

  const profile = guarded({
    get: () => call('profileGet').then(profileOf),
    set: (updateRequest) => {
      const body = profileRequest(updateRequest)
      sdk._popupsV3Hook('onContextChange', 'profile', 'set', updateRequest)
      return call('profileSet', body)
    },
    getLastOrder: () => call('profileGetLastOrder'),
    getOrders: (shopSecret, params) => {
      const { did, email, phone, loyaltyId, externalId, dateFrom } = options(params, 'params')
      return call(
        'profileGetOrders',
        requireString(shopSecret, 'shopSecret'),
        opt(did), opt(email), opt(phone), opt(loyaltyId), opt(externalId), opt(dateFrom),
      ).then((orders) => (Array.isArray(orders) ? orders.map(orderOf) : orders))
    },
  })

  const subscriptions = guarded({
    manage: (updateRequest) => {
      const body = request(updateRequest, 'request')
      if (body == null) throw invalid('request must be an object')
      sdk._popupsV3Hook('onContextChange', 'subscription', 'manage', updateRequest)
      return call('subscriptionsManage', body)
    },
    check: () => call('subscriptionsCheck'),
    subscribeForPriceDrop: (itemId, currentPrice, params) =>
      call('subscriptionsSubscribeForPriceDrop', requireString(itemId, 'itemId'), requireNumber(currentPrice, 'currentPrice'), ...contact(params)),
    unsubscribeFromPriceDrop: (itemIds, params) =>
      call('subscriptionsUnsubscribeFromPriceDrop', requireStrings(itemIds, 'itemIds'), ...contact(params)),
    subscribeForBackInStock: (itemId, properties, params) =>
      call('subscriptionsSubscribeForBackInStock', requireString(itemId, 'itemId'), request(properties, 'properties'), ...contact(params)),
    unsubscribeFromBackInStock: (itemIds, params) =>
      call('subscriptionsUnsubscribeFromBackInStock', requireStrings(itemIds, 'itemIds'), ...contact(params)),
  })

  const segments = guarded({
    add: (segmentId, params) => {
      sdk._popupsV3Hook('onContextChange', 'segment', 'add', { segment_id: segmentId })
      return call('segmentsAdd', requireNumber(segmentId, 'segmentId'), ...contact(params))
    },
    remove: (segmentId, params) => {
      sdk._popupsV3Hook('onContextChange', 'segment', 'remove', { segment_id: segmentId })
      return call('segmentsRemove', requireNumber(segmentId, 'segmentId'), ...contact(params))
    },
    get: () => call('segmentsGet'),
  })
  // The device's A/B group: a local value, read at once.
  segments.getAbGroup = () => sdk.segment || ''

  const notifications = guarded({
    trackDelivered: (code, type) => sdk._pushEvent('delivered', code, type),
    trackOpened: (code, type) => sdk._pushEvent('opened', code, type),
    trackClicked: (code, type) => sdk._pushEvent('clicked', code, type),
    trackClosed: (code, type) => sdk._pushEvent('closed', code, type),
    // `apns` and `fcm` on iOS, `fcm` and `hms` on Android.
    setPushToken: (token, provider) => sdk._setPushToken(requireString(token, 'token'), provider),
    getHistory: (shopSecret, type, params) => {
      const { phone, email, externalId, loyaltyId, channel, limit, page, dateFrom, did } = options(params, 'params')
      return call(
        'notificationsGetHistory',
        requireString(shopSecret, 'shopSecret'),
        requireString(type, 'type'),
        opt(phone), opt(email), opt(externalId), opt(loyaltyId), opt(channel),
        optionalNumber(limit, 'limit'), optionalNumber(page, 'page'),
        opt(dateFrom), opt(did),
      ).then(notificationsHistory)
    },
  })
  // The push token the SDK knows for the shop, read at once.
  notifications.getPushToken = (provider) => sdk._pushToken(provider)
  // The shop's push callbacks: a new call replaces them, none (or `{}`) removes them.
  notifications.setCallbacks = (callbacks) => {
    sdk._pushCallbacks = pushCallbacksOf(callbacks, 'notifications.setCallbacks')
  }

  const stories = guarded({
    get: (code) => call('storiesGet', requireString(code, 'code')),
  })

  const predict = guarded({
    getProbabilityToPurchase: () => call('predictGetProbabilityToPurchase'),
  })

  const loyalty = guarded({
    join: (phone, params) => {
      const { firstName, lastName, gender, birthday } = options(params, 'params')
      return call('loyaltyJoin', requireString(phone, 'phone'), opt(firstName), opt(lastName), opt(genderValue(gender)), opt(birthday))
    },
    getStatus: (phone) => call('loyaltyGetStatus', requireString(phone, 'phone')).then(loyaltyStatus),
    getPromotions: (params) => {
      const { locationId, promoCodes, chargeBonuses, currentTime } = options(params, 'params')
      return call('loyaltyGetPromotions', opt(locationId), optionalStrings(promoCodes, 'promoCodes'), opt(chargeBonuses), opt(currentTime))
    },
  })

  const sliders = guarded({
    get: (code, tags, locationId) =>
      call('slidersGet', requireString(code, 'code'), optionalStrings(tags, 'tags'), opt(locationId)),
  })

  const poll = (method, subject) => (rate, channel, target, params) => {
    const { orderId, comment, label } = options(params, 'params')
    return call(method, requireNumber(rate, 'rate'), requireString(channel, 'channel'), requireString(target, subject), opt(orderId), opt(comment), opt(label))
  }

  const reviews = guarded({
    createNps: poll('reviewsCreateNps', 'category'),
    createCsat: poll('reviewsCreateCsat', 'campaign'),
    createCes: poll('reviewsCreateCes', 'campaign'),
    getNpsCategories: () => call('reviewsGetNpsCategories'),
    getNpsChannels: () => call('reviewsGetNpsChannels'),
    getCsatCampaigns: () => call('reviewsGetCsatCampaigns'),
    getCesCampaigns: () => call('reviewsGetCesCampaigns'),
    getProductReviews: (itemId, limit, offset) =>
      call('reviewsGetProductReviews', requireString(itemId, 'itemId'), optionalNumber(limit, 'limit'), optionalNumber(offset, 'offset')),
    getClientReviews: (orderId) => call('reviewsGetClientReviews', requireString(orderId, 'orderId')),
  })

  return {
    products,
    collections,
    recommendations,
    search,
    cart,
    profile,
    subscriptions,
    segments,
    notifications,
    stories,
    predict,
    loyalty,
    sliders,
    reviews,
  }
}
