import { parseProduct } from './productTypes'

/**
 * @typedef {Object} OrderItem
 * @property {number} amount
 * @property {string} price - returned by the API as a string
 * @property {string|null} status
 * @property {string|null} originalPrice
 * @property {string|null} barcode
 * @property {string|null} lineId
 * @property {string|null} cancelReason
 * @property {import('./productTypes').Product|null} item - catalog product
 */

/**
 * @param {Record<string, any>} json
 * @returns {OrderItem}
 */
export function parseOrderItem(json) {
  if (!json || typeof json !== 'object') {
    return { amount: 0, price: '', status: null, originalPrice: null, barcode: null, lineId: null, cancelReason: null, item: null }
  }
  return {
    amount: typeof json.amount === 'number' ? json.amount : 0,
    price: json.price ?? '',
    status: json.status ?? null,
    originalPrice: json.original_price ?? null,
    barcode: json.barcode ?? null,
    lineId: json.line_id ?? null,
    cancelReason: json.cancel_reason ?? null,
    item: json.item && typeof json.item === 'object' ? parseProduct(json.item) : null,
  }
}

/**
 * @typedef {Object} Order
 * @property {number} internalId
 * @property {string} id
 * @property {string} date
 * @property {string} value - total, returned by the API as a string
 * @property {string|null} cashValue
 * @property {string|null} bonusesValue
 * @property {string|null} deliveryValue
 * @property {string|null} promocode
 * @property {string|null} deliveryDate
 * @property {string|null} internalStatus
 * @property {string|null} stream
 * @property {string|null} channel
 * @property {boolean} taxFree
 * @property {string|null} deliveryType
 * @property {string|null} deliveryAddress
 * @property {string|null} orderStatus
 * @property {string|null} paymentType
 * @property {OrderItem[]} items
 */

/**
 * @param {Record<string, any>} json
 * @returns {Order}
 */
export function parseOrder(json) {
  if (!json || typeof json !== 'object') {
    return { internalId: 0, id: '', date: '', value: '', items: [] }
  }
  return {
    internalId: typeof json._id === 'number' ? json._id : 0,
    id: json.id ?? '',
    date: json.date ?? '',
    value: json.value ?? '',
    cashValue: json.cash_value ?? null,
    bonusesValue: json.bonuses_value ?? null,
    deliveryValue: json.delivery_value ?? null,
    promocode: json.promocode ?? null,
    deliveryDate: json.delivery_date ?? null,
    internalStatus: json.internal_status ?? null,
    stream: json.stream ?? null,
    channel: json.channel ?? null,
    taxFree: json.tax_free === true,
    deliveryType: json.delivery_type ?? null,
    deliveryAddress: json.delivery_address ?? null,
    orderStatus: json.order_status ?? null,
    paymentType: json.payment_type ?? null,
    items: Array.isArray(json.items) ? json.items.map(parseOrderItem) : [],
  }
}

/**
 * Parse the `orders/by_user` response envelope: `{ status, data: { orders: [...] } }`.
 * @param {Record<string, any>} json
 * @returns {Order[]}
 */
export function parseUserOrdersResponse(json) {
  const orders = json?.data?.orders
  return Array.isArray(orders) ? orders.map(parseOrder) : []
}
