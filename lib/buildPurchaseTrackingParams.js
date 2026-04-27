'use strict'

/**
 * Wire keys for `push` purchase (`event` = `purchase`).
 * @readonly
 */
export const PURCHASE_TRACKING_WIRE = Object.freeze({
  EVENT: 'event',
  ITEMS: 'items',
  ID: 'id',
  AMOUNT: 'amount',
  PRICE: 'price',
  QUANTITY: 'quantity',
  LINE_ID: 'line_id',
  FASHION_SIZE: 'fashion_size',
  ORDER_ID: 'order_id',
  ORDER_PRICE: 'order_price',
  DELIVERY_TYPE: 'delivery_type',
  DELIVERY_ADDRESS: 'delivery_address',
  PAYMENT_TYPE: 'payment_type',
  TAX_FREE: 'tax_free',
  PROMOCODE: 'promocode',
  ORDER_CASH: 'order_cash',
  ORDER_BONUSES: 'order_bonuses',
  ORDER_DELIVERY: 'order_delivery',
  ORDER_DISCOUNT: 'order_discount',
  CHANNEL: 'channel',
  CUSTOM: 'custom',
  RECOMMENDED_SOURCE: 'recommended_source',
  RECOMMENDED_BY: 'recommended_by',
  RECOMMENDED_CODE: 'recommended_code',
  STREAM: 'stream',
  SEGMENT: 'segment',
})

const RESERVED_PURCHASE_CUSTOM = new Set([
  'shop_id',
  'did',
  'seance',
  'sid',
  'segment',
  'stream',
  'event',
  'time',
  'category',
  'label',
  'value',
  'source',
  'payload',
  'from',
  'code',
  PURCHASE_TRACKING_WIRE.ITEMS,
  PURCHASE_TRACKING_WIRE.ORDER_ID,
  PURCHASE_TRACKING_WIRE.ORDER_PRICE,
  PURCHASE_TRACKING_WIRE.DELIVERY_TYPE,
  PURCHASE_TRACKING_WIRE.DELIVERY_ADDRESS,
  PURCHASE_TRACKING_WIRE.PAYMENT_TYPE,
  PURCHASE_TRACKING_WIRE.TAX_FREE,
  PURCHASE_TRACKING_WIRE.PROMOCODE,
  PURCHASE_TRACKING_WIRE.ORDER_CASH,
  PURCHASE_TRACKING_WIRE.ORDER_BONUSES,
  PURCHASE_TRACKING_WIRE.ORDER_DELIVERY,
  PURCHASE_TRACKING_WIRE.ORDER_DISCOUNT,
  PURCHASE_TRACKING_WIRE.CHANNEL,
  PURCHASE_TRACKING_WIRE.CUSTOM,
  PURCHASE_TRACKING_WIRE.RECOMMENDED_SOURCE,
  PURCHASE_TRACKING_WIRE.RECOMMENDED_BY,
  PURCHASE_TRACKING_WIRE.RECOMMENDED_CODE,
])

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * Builds the JSON body fragment for `push` purchase tracking (strict contract).
 * Does not include `shop_id` / `did` / session fields — the HTTP client adds those like `track()`.
 *
 * @param {Record<string, unknown>} request — strict shape; see `PurchaseTrackingRequest` in types.
 * @returns {Record<string, unknown>}
 */
export function buildPurchaseTrackingParams(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('trackPurchase: request object is required')
  }
  const { orderId, orderPrice, items } = request
  if (!isNonEmptyString(orderId)) {
    throw new Error('trackPurchase: orderId must be a non-empty string')
  }
  if (!isFiniteNumber(orderPrice)) {
    throw new Error('trackPurchase: orderPrice must be a finite number')
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('trackPurchase: items must be a non-empty array')
  }

  /** @type {Record<string, unknown>} */
  const out = {
    [PURCHASE_TRACKING_WIRE.EVENT]: 'purchase',
    [PURCHASE_TRACKING_WIRE.ORDER_ID]: orderId.trim(),
    [PURCHASE_TRACKING_WIRE.ORDER_PRICE]: orderPrice,
    [PURCHASE_TRACKING_WIRE.ITEMS]: [],
  }

  for (const line of items) {
    if (!line || typeof line !== 'object') {
      throw new Error('trackPurchase: each item must be an object')
    }
    if (!isNonEmptyString(line.id)) {
      throw new Error('trackPurchase: each item.id must be a non-empty string')
    }
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      throw new Error('trackPurchase: each item.amount must be an integer > 0')
    }
    if (!isFiniteNumber(line.price)) {
      throw new Error('trackPurchase: each item.price must be a finite number')
    }
    /** @type {Record<string, unknown>} */
    const row = {
      [PURCHASE_TRACKING_WIRE.ID]: line.id.trim(),
      [PURCHASE_TRACKING_WIRE.AMOUNT]: line.amount,
      [PURCHASE_TRACKING_WIRE.PRICE]: line.price,
    }
    if (line.quantity != null && Number.isInteger(line.quantity)) {
      row[PURCHASE_TRACKING_WIRE.QUANTITY] = line.quantity
    }
    if (isNonEmptyString(line.lineId)) {
      row[PURCHASE_TRACKING_WIRE.LINE_ID] = line.lineId.trim()
    }
    if (isNonEmptyString(line.fashionSize)) {
      row[PURCHASE_TRACKING_WIRE.FASHION_SIZE] = line.fashionSize.trim()
    }
    out[PURCHASE_TRACKING_WIRE.ITEMS].push(row)
  }

  if (isNonEmptyString(request.deliveryType)) {
    out[PURCHASE_TRACKING_WIRE.DELIVERY_TYPE] = request.deliveryType.trim()
  }
  if (isNonEmptyString(request.deliveryAddress)) {
    out[PURCHASE_TRACKING_WIRE.DELIVERY_ADDRESS] = request.deliveryAddress.trim()
  }
  if (isNonEmptyString(request.paymentType)) {
    out[PURCHASE_TRACKING_WIRE.PAYMENT_TYPE] = request.paymentType.trim()
  }
  if (request.isTaxFree === true) {
    out[PURCHASE_TRACKING_WIRE.TAX_FREE] = true
  }
  if (isNonEmptyString(request.promocode)) {
    out[PURCHASE_TRACKING_WIRE.PROMOCODE] = request.promocode.trim()
  }
  if (request.orderCash != null && isFiniteNumber(request.orderCash)) {
    out[PURCHASE_TRACKING_WIRE.ORDER_CASH] = request.orderCash
  }
  if (request.orderBonuses != null && isFiniteNumber(request.orderBonuses)) {
    out[PURCHASE_TRACKING_WIRE.ORDER_BONUSES] = request.orderBonuses
  }
  if (request.orderDelivery != null && isFiniteNumber(request.orderDelivery)) {
    out[PURCHASE_TRACKING_WIRE.ORDER_DELIVERY] = request.orderDelivery
  }
  if (request.orderDiscount != null && isFiniteNumber(request.orderDiscount)) {
    out[PURCHASE_TRACKING_WIRE.ORDER_DISCOUNT] = request.orderDiscount
  }
  if (isNonEmptyString(request.channel)) {
    out[PURCHASE_TRACKING_WIRE.CHANNEL] = request.channel.trim()
  }

  if (request.custom != null && typeof request.custom === 'object' && !Array.isArray(request.custom)) {
    const keys = Object.keys(request.custom)
    const collisions = keys.filter((k) => RESERVED_PURCHASE_CUSTOM.has(k))
    if (collisions.length > 0) {
      throw new Error(
        `trackPurchase: custom contains reserved keys: ${collisions.sort().join(', ')}`
      )
    }
    if (keys.length > 0) {
      out[PURCHASE_TRACKING_WIRE.CUSTOM] = request.custom
    }
  }

  if (
    request.recommendedSource != null &&
    typeof request.recommendedSource === 'object' &&
    !Array.isArray(request.recommendedSource) &&
    Object.keys(request.recommendedSource).length > 0
  ) {
    out[PURCHASE_TRACKING_WIRE.RECOMMENDED_SOURCE] = request.recommendedSource
  }

  if (request.recommendedBy != null && typeof request.recommendedBy === 'object') {
    const rb = request.recommendedBy
    if (isNonEmptyString(rb.type)) {
      out[PURCHASE_TRACKING_WIRE.RECOMMENDED_BY] = rb.type.trim()
    }
    if (isNonEmptyString(rb.code)) {
      out[PURCHASE_TRACKING_WIRE.RECOMMENDED_CODE] = rb.code.trim()
    }
  }

  if (isNonEmptyString(request.stream)) {
    out[PURCHASE_TRACKING_WIRE.STREAM] = request.stream.trim()
  }
  if (isNonEmptyString(request.segment)) {
    out[PURCHASE_TRACKING_WIRE.SEGMENT] = request.segment.trim()
  }

  return out
}
