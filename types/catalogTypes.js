/**
 * @typedef {Object} ProfileResponse
 * @property {string|null} id
 * @property {string|null} email
 * @property {string|null} phone
 * @property {string|null} firstName
 * @property {string|null} lastName
 * @property {boolean|null} hasEmail
 * @property {string|null} emailRegisteredAt
 * @property {string|null} gender
 * @property {string|null} computedGender
 * @property {boolean|null} boughtSomething
 * @property {Record<string, any>} customProperties
 * @property {Record<string, any>} raw - the full untouched response
 */

/**
 * Parse the `GET /profile` response. The profile is freeform; common fields are
 * surfaced explicitly and the full response is kept under `raw`.
 * @param {Record<string, any>} json
 * @returns {ProfileResponse}
 */
export function parseProfile(json) {
  if (!json || typeof json !== 'object') {
    return { customProperties: {}, raw: {} }
  }
  return {
    id: json.id ?? null,
    email: json.email ?? null,
    phone: json.phone ?? null,
    firstName: json.first_name ?? null,
    lastName: json.last_name ?? null,
    hasEmail: json.has_email ?? null,
    emailRegisteredAt: json.email_registered_at ?? null,
    gender: json.gender ?? null,
    computedGender: json.computed_gender ?? null,
    boughtSomething: json.bought_something ?? null,
    customProperties: json.custom_properties ?? {},
    raw: json,
  }
}

/**
 * @typedef {Object} ProductCounter
 * @property {number} view
 * @property {number} cart
 * @property {number} purchase
 */

/**
 * @typedef {Object} ProductCountersResponse
 * @property {ProductCounter|null} daily
 * @property {ProductCounter|null} now
 * @property {{ backInStock: number, priceDrop: number }} triggers
 */

/**
 * Parse the `GET /products/counters` response:
 * `{ daily, now, triggers: { back_in_stock, price_drop } }`.
 * @param {Record<string, any>} json
 * @returns {ProductCountersResponse}
 */
export function parseProductCounters(json) {
  const counter = (c) => ({
    view: c?.view ?? 0,
    cart: c?.cart ?? 0,
    purchase: c?.purchase ?? 0,
  })
  const triggers = json?.triggers ?? {}
  return {
    daily: json?.daily ? counter(json.daily) : null,
    now: json?.now ? counter(json.now) : null,
    triggers: {
      backInStock: triggers.back_in_stock ?? 0,
      priceDrop: triggers.price_drop ?? 0,
    },
  }
}

/**
 * @typedef {Object} CategoryResponse
 * @property {number} productsTotal
 * @property {Array<Record<string, any>>} products
 * @property {Array<Record<string, any>>} brands
 * @property {Record<string, any>} raw - the full untouched response
 */

/**
 * Parse the `GET /category/{slug}` response: `{ products_total, products, brands, ... }`.
 * @param {Record<string, any>} json
 * @returns {CategoryResponse}
 */
export function parseCategory(json) {
  if (!json || typeof json !== 'object') {
    return { productsTotal: 0, products: [], brands: [], raw: {} }
  }
  return {
    productsTotal: json.products_total ?? 0,
    products: Array.isArray(json.products) ? json.products : [],
    brands: Array.isArray(json.brands) ? json.brands : [],
    raw: json,
  }
}

/**
 * @typedef {Object} CollectionResponse
 * @property {Array<Record<string, any>>} products
 * @property {Record<string, any>} raw - the full untouched response
 */

/**
 * Parse the `GET /collection/{id}` response: `{ products: [...] }`.
 * @param {Record<string, any>} json
 * @returns {CollectionResponse}
 */
export function parseCollection(json) {
  if (!json || typeof json !== 'object') {
    return { products: [], raw: {} }
  }
  return {
    products: Array.isArray(json.products) ? json.products : [],
    raw: json,
  }
}
