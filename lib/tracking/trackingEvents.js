'use strict'

import { SdkError } from '../facade/errors'
import { buildPurchaseTrackingParams } from '../buildPurchaseTrackingParams'
import { buildTrackCustomEventParams } from '../buildTrackCustomEventParams'

/**
 * The events of the contract's `tracking` namespace (`sdk/contract/tracking.md`): each function
 * checks its arguments and returns the event — its path and its own fields. The device id, the
 * session, the segment, the stream and the stored source are not here: whoever sends the event adds
 * them (the native queue, or the SDK's request without the native module).
 */

/** `TrackingSourceType` of the contract → the wire value. */
const SOURCE_TYPES = {
  dynamic: 'dynamic',
  chain: 'chain',
  bulk: 'bulk',
  transactional: 'transactional',
  instantSearch: 'instant_search',
  fullSearch: 'full_search',
  stories: 'stories',
  webPushDigest: 'web_push_digest',
  slider: 'slider',
  agentSearch: 'agent_search',
}

/** Source types the server refuses in an event's `recommended_by` (it drops the whole event). */
const NOT_FOR_EVENTS = new Set(['transactional', 'web_push_digest'])

function invalid(message) {
  return new SdkError('invalidArgument', message)
}

/** The range of `time` and `value` of `custom`: the contract's integer as Android's `Int` holds it. */
const INT32_MIN = -2147483648
const INT32_MAX = 2147483647
const isInt32 = (value) => Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX

function requireString(value, name) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string' || value.trim() === '') throw invalid(`${name} must be a non-empty string`)
  return value
}

/**
 * The wire value of a source type: the contract's names (`instantSearch`) and the wire ones
 * (`instant_search`) are both taken.
 * @param {string} type
 * @returns {string}
 */
export function sourceTypeValue(type) {
  if (typeof type !== 'string') throw invalid('source.type must be a string')
  if (SOURCE_TYPES[type]) return SOURCE_TYPES[type]
  if (Object.values(SOURCE_TYPES).includes(type)) return type
  throw invalid(`Unknown source type: ${type}`)
}

/**
 * The `recommended_by` / `recommended_code` of an event's `source`; none without one.
 * @param {{ type: string, code: string } | undefined | null} source
 */
function sourceFields(source) {
  if (source == null) return {}
  if (typeof source !== 'object') throw invalid('source must be { type, code }')
  const type = sourceTypeValue(source.type)
  if (NOT_FOR_EVENTS.has(type)) throw invalid(`The server refuses an event with source ${source.type}`)
  return { recommended_by: type, recommended_code: requireString(source.code, 'source.code') }
}

/** The fields of the contract's `PurchaseTrackingRequest` and of its `PurchaseItem`. */
const PURCHASE_FIELDS = [
  'orderId',
  'orderPrice',
  'items',
  'deliveryType',
  'deliveryAddress',
  'paymentType',
  'isTaxFree',
  'promocode',
  'orderCash',
  'orderBonuses',
  'orderDelivery',
  'orderDiscount',
  'channel',
  'custom',
  'isGiftPackage',
]
const PURCHASE_ITEM_FIELDS = ['id', 'amount', 'price', 'lineId', 'fashionSize']

const isRecord = (value) => value != null && typeof value === 'object' && !Array.isArray(value)

function pick(value, fields) {
  const result = {}
  for (const field of fields) if (value[field] !== undefined) result[field] = value[field]
  return result
}

/**
 * The contract's `PurchaseTrackingRequest` of `tracking.purchase`: only its fields and its items'
 * fields go on. What 4.x's request had besides (`recommendedBy`, `recommendedSource`, `stream`,
 * `segment`, an item's `quantity`) is left out with a warning — the purchase's attribution is the
 * call's `source`; the deprecated `trackPurchase` still sends them. Anything but an object is handed on
 * as it is, for the check of whoever sends the event.
 * @param {unknown} request
 * @returns {unknown}
 */
export function contractPurchase(request) {
  if (!isRecord(request)) return request
  const result = pick(request, PURCHASE_FIELDS)
  const dropped = Object.keys(request).filter((key) => request[key] !== undefined && !PURCHASE_FIELDS.includes(key))
  if (Array.isArray(request.items)) {
    result.items = request.items.map((line, i) => {
      if (!isRecord(line)) return line
      for (const key of Object.keys(line)) {
        if (line[key] !== undefined && !PURCHASE_ITEM_FIELDS.includes(key)) dropped.push(`items[${i}].${key}`)
      }
      return pick(line, PURCHASE_ITEM_FIELDS)
    })
  }
  if (dropped.length > 0) {
    console.warn(
      `[SDK] tracking.purchase: ${dropped.join(', ')} not sent — not fields of PurchaseTrackingRequest; the attribution goes as the call's source`
    )
  }
  return result
}

/** A `TrackingItem` of the contract → an item of the request. */
function item(value, name = 'item') {
  if (value == null || typeof value !== 'object') throw invalid(`${name} must be { id, quantity?, price?, fashionSize? }`)
  const result = { id: requireString(value.id, `${name}.id`) }
  if (value.quantity != null) {
    if (!Number.isInteger(value.quantity)) throw invalid(`${name}.quantity must be an integer`)
    result.amount = value.quantity
  }
  if (value.price != null) {
    if (typeof value.price !== 'number' || !(value.price >= 0)) throw invalid(`${name}.price must be a number not below 0`)
    result.price = value.price
  }
  if (value.fashionSize != null) result.fashion_size = requireString(value.fashionSize, `${name}.fashionSize`)
  return result
}

function list(value, name) {
  if (!Array.isArray(value)) throw invalid(`${name} must be an array`)
  return value
}

/** A positive integer of a story event, or null when the server would not take it. */
function storyNumber(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function storyEvent(event, storyId, slideId, code) {
  requireString(storyId, 'storyId')
  requireString(slideId, 'slideId')
  if (code != null) requireString(code, 'code')
  const story = storyNumber(storyId)
  const slide = storyNumber(slideId)
  // A product campaign's virtual slide (`{story_id}_{index}`) or another id the server does not
  // take: the event is not sent, and that is no error.
  if (story == null || slide == null) return null
  const body = { event, story_id: story, slide_id: String(slide) }
  if (code != null) body.code = code
  return { path: 'track/stories', body }
}

function bannerEvent(event, bannerId, code) {
  const banner = storyNumber(requireString(bannerId, 'bannerId'))
  if (banner == null) throw invalid('bannerId must be a positive integer')
  return { path: 'track/slider', body: { event, banner_id: banner, recommended_code: requireString(code, 'code') } }
}

/**
 * The contract's tracking events. Each returns `{ path, body }`, or null for an event that is not
 * sent and is no error; throws `SdkError('invalidArgument')` for wrong arguments.
 */
export const trackingEvents = {
  productView: (itemId, source) => ({
    path: 'push',
    body: { event: 'view', items: [{ id: requireString(itemId, 'itemId') }], ...sourceFields(source) },
  }),

  categoryView: (categoryId) => ({
    path: 'push',
    body: { event: 'category', category_id: requireString(categoryId, 'categoryId') },
  }),

  search: (query, results) => {
    const body = { event: 'search', search_query: requireString(query, 'query') }
    if (results != null) body.results = list(results, 'results').map(String).join(',')
    return { path: 'push', body }
  },

  addToCart: (cartItem, source) => ({
    path: 'push',
    body: { event: 'cart', items: [item(cartItem)], ...sourceFields(source) },
  }),

  syncCart: (items) => ({
    path: 'push',
    body: { event: 'cart', items: list(items, 'items').map((value, i) => item(value, `items[${i}]`)), full_cart: true },
  }),

  removeFromCart: (itemId) => ({
    path: 'push',
    body: { event: 'remove_from_cart', items: [{ id: requireString(itemId, 'itemId') }] },
  }),

  addToFavorites: (itemId, source) => ({
    path: 'push',
    body: { event: 'wish', items: [{ id: requireString(itemId, 'itemId') }], ...sourceFields(source) },
  }),

  syncFavorites: (itemIds) => ({
    path: 'push',
    body: {
      event: 'wish',
      items: list(itemIds, 'itemIds').map((id, i) => ({ id: requireString(id, `itemIds[${i}]`) })),
      full_wish: true,
    },
  }),

  removeFromFavorites: (itemId) => ({
    path: 'push',
    body: { event: 'remove_wish', items: [{ id: requireString(itemId, 'itemId') }] },
  }),

  purchase: (request, source) => {
    let body
    try {
      body = buildPurchaseTrackingParams(contractPurchase(request))
    } catch (error) {
      throw invalid(error?.message ?? String(error))
    }
    return { path: 'push', body: { ...body, ...sourceFields(source) } }
  },

  storyView: (storyId, slideId, code) => storyEvent('view', storyId, slideId, code),

  storyClick: (storyId, slideId, code) => storyEvent('click', storyId, slideId, code),

  bannerView: (bannerId, code) => bannerEvent('view', bannerId, code),

  bannerClick: (bannerId, code) => bannerEvent('click', bannerId, code),

  popupShown: (popupId) => {
    if (!Number.isInteger(popupId) || popupId <= 0) throw invalid('popupId must be a positive integer')
    return { path: 'popup/showed', body: { popup: popupId } }
  },

  custom: (event, params) => {
    let body
    try {
      body = buildTrackCustomEventParams(event, params)
    } catch (error) {
      throw invalid(error?.message ?? String(error))
    }
    // The contract's integers, of the width both native SDKs take: Android's `custom` has `Int`.
    for (const key of ['time', 'value']) {
      if (body[key] !== undefined && !isInt32(body[key])) {
        throw invalid(`${key} must be a whole number from ${INT32_MIN} to ${INT32_MAX}`)
      }
    }
    return { path: 'push/custom', body }
  },
}
