'use strict'

/**
 * Pure extraction of routing fields from a push payload (Release 4). A payload may be a full FCM
 * remote message (fields under `.data`) or an already-flattened data object — both are accepted.
 * Side-effect-free so `PersonaClick.handlePush` routing can be tested without dispatching a push.
 *
 * Mirrors the iOS `PushPayloadParser`.
 */

/** Returns the `data` bag of a payload, tolerating both `{ data: {...} }` and a flat object. */
function dataOf(payload) {
  if (!payload || typeof payload !== 'object') return {}
  return payload.data && typeof payload.data === 'object' ? payload.data : payload
}

/**
 * The `shop_id` a push belongs to, or null when absent.
 * @param {object} payload
 * @returns {string | null}
 */
export function shopId(payload) {
  const data = dataOf(payload)
  return data.shop_id ?? (payload && payload.shop_id) ?? null
}

/**
 * The `{ code, type }` a notification track carries — `code` is the push `id`, `type` its content
 * type — matching what the SDK's own push handlers send.
 * @param {object} payload
 * @returns {{ code: string | undefined, type: string | undefined }}
 */
export function typeAndCode(payload) {
  const data = dataOf(payload)
  return { code: data.id, type: data.type }
}

export default { shopId, typeAndCode }
