/**
 * Custom event body for push/custom — parity with iOS/Android (TrackCustomEventPayloadHelper).
 * @typedef {Record<string, unknown>} CustomFieldsMap
 */

/** Keys that must not appear in customFields (reserved for SDK / standard event fields). */
export const RESERVED_CUSTOM_EVENT_KEYS = new Set([
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
])

/** Allowed keys on the optional second argument to trackEvent. */
const ALLOWED_TRACK_EVENT_PARAM_KEYS = new Set([
  'time',
  'category',
  'label',
  'value',
  'customFields',
])

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Filters custom field entries (skip blank keys, null / undefined values).
 * @param {unknown} map
 * @returns {Record<string, unknown>}
 */
export function effectiveCustomFields(map) {
  if (!map || !isPlainObject(map)) {
    return {}
  }
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [key, value] of Object.entries(map)) {
    if (typeof key !== 'string' || key.trim() === '') {
      continue
    }
    if (value === null || value === undefined) {
      continue
    }
    out[key] = value
  }
  return out
}

/**
 * @param {string} event
 * @param {Record<string, unknown> | undefined} params
 * @returns {Record<string, unknown>}
 */
export function buildTrackCustomEventParams(event, params) {
  if (typeof event !== 'string') {
    throw new Error('trackEvent: event must be a string')
  }
  if (event.trim() === '') {
    throw new Error('trackEvent: event must not be empty')
  }

  if (params !== undefined && params !== null) {
    if (!isPlainObject(params)) {
      throw new Error('trackEvent: second argument must be a plain object')
    }
    const unknownKeys = Object.keys(params).filter((k) => !ALLOWED_TRACK_EVENT_PARAM_KEYS.has(k))
    if (unknownKeys.length > 0) {
      const sorted = [...unknownKeys].sort().join(', ')
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(`trackEvent: unknown param keys: ${sorted}`)
      }
      throw new Error(`trackEvent: unknown param keys: ${sorted}`)
    }
  }

  /** @type {Record<string, unknown>} */
  const out = { event }

  if (!params) {
    return out
  }

  const { time, category, label, value, customFields } = params

  if (time !== undefined) {
    if (typeof time !== 'number' || !Number.isFinite(time)) {
      throw new Error('trackEvent: time must be a finite number')
    }
    out.time = time
  }

  if (category !== undefined) {
    if (typeof category !== 'string') {
      throw new Error('trackEvent: category must be a string')
    }
    out.category = category
  }

  if (label !== undefined) {
    if (typeof label !== 'string') {
      throw new Error('trackEvent: label must be a string')
    }
    out.label = label
  }

  if (value !== undefined) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('trackEvent: value must be a finite number')
    }
    out.value = value
  }

  if (customFields !== undefined) {
    if (!isPlainObject(customFields)) {
      throw new Error('trackEvent: customFields must be a plain object')
    }
    const effective = effectiveCustomFields(customFields)
    const collisions = Object.keys(effective).filter((k) => RESERVED_CUSTOM_EVENT_KEYS.has(k))
    if (collisions.length > 0) {
      const sorted = [...collisions].sort().join(', ')
      throw new Error(`trackEvent: customFields contains reserved keys: ${sorted}`)
    }
    if (Object.keys(effective).length > 0) {
      Object.assign(out, effective)
      out.payload = { ...effective }
    }
  }

  return out
}
