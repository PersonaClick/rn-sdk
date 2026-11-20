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
 * The `{ code, type }` a notification track carries — `code` is the push `id`, `type` its mailing
 * type — matching what the SDK's own push handlers send. Each is a string: a number the payload carries
 * (APNs keeps the JSON types the server sent) is written as one, as the iOS parser does; anything else is
 * `undefined`.
 * @param {object} payload
 * @returns {{ code: string | undefined, type: string | undefined }}
 */
export function typeAndCode(payload) {
  const data = dataOf(payload)
  let code = textOf(data.id) ?? legacyNestedId(data.id)
  let type = textOf(data.type)
  if (code == null || type == null) {
    // A direct APNs push keeps them in `src`, an object (or its JSON string, as a data value).
    const src = objectOf(data.src ?? (payload && payload.src))
    code = code ?? textOf(src?.id)
    type = type ?? textOf(src?.type)
  }
  return { code, type }
}

/**
 * The push's `event` — what a tap opens, `{ type, uri }` — or null: an object in an APNs push, its JSON
 * string in an FCM one.
 * @param {object} payload the push, or its `data`
 * @returns {{ type?: string, uri?: string } | null}
 */
export function eventOf(payload) {
  return objectOf(dataOf(payload).event)
}

/** A string as it is, a finite number written as one; `undefined` for anything else. */
function textOf(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

/** An `id` sent as an object `{ "id": "…" }`, a shape older payloads used (the iOS parser reads it too). */
function legacyNestedId(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? textOf(value.id) : undefined
}

/** An object, or one a JSON string holds; null otherwise. */
function objectOf(value) {
  if (value && typeof value === 'object') return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch (_) {
      return null
    }
  }
  return null
}

export default { shopId, typeAndCode, eventOf }
