'use strict'

import { Platform } from 'react-native'
import { typeAndCode } from './PushPayloadParser'

/**
 * The app's push callbacks (`sdk/contract/notifications.md`): a shop's own (`notifications.setCallbacks`)
 * and the shared ones of every shop (`PersonaClick.setPushCallbacks`), a shop's own callback of an event winning
 * over the shared one. A callback hears a push event the SDK saw itself — a push its handlers received,
 * drew, saw tapped or dismissed, or `PersonaClick.handlePush` — once the event was accepted (the native queue
 * took it; without the native module the server answered), once per event of a message in the process;
 * never the `notifications.track*` calls of the app. `onToken` hears each new token the SDK's own push
 * registration got, once per token and provider.
 */

const CALLBACKS = { delivered: 'onDelivered', opened: 'onOpened', clicked: 'onClicked', closed: 'onClosed' }
const FIELDS = ['onDelivered', 'onOpened', 'onClicked', 'onClosed', 'onToken']

/** The shared callbacks of every shop. */
let shared = null
/** The events told: `<shopId>|<event>|<code>`. */
const toldEvents = new Set()
/** The tokens told: `<provider>|<token>`. */
const toldTokens = new Set()

/**
 * `PushCallbacks` as the SDK keeps them: only the fields that are functions; null for none at all.
 * @param {any} callbacks
 * @param {string} name the method, for its warning
 * @returns {Record<string, Function> | null}
 */
export function pushCallbacksOf(callbacks, name) {
  if (callbacks == null) return null
  if (typeof callbacks !== 'object') {
    console.warn(`[SDK] ${name}: the callbacks must be an object of functions; none are set`)
    return null
  }
  const result = {}
  for (const field of FIELDS) {
    const value = callbacks[field]
    if (value == null) continue
    if (typeof value === 'function') result[field] = value
    else console.warn(`[SDK] ${name}: ${field} is no function and is left out`)
  }
  return Object.keys(result).length > 0 ? result : null
}

/** `PersonaClick.setPushCallbacks`: replaces the shared callbacks; null removes them. */
export function setSharedPushCallbacks(callbacks) {
  shared = pushCallbacksOf(callbacks, 'PersonaClick.setPushCallbacks')
}

const text = (value) => (typeof value === 'string' && value !== '' ? value : null)

/** An object, or one a JSON string holds; null otherwise. */
function objectOf(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch (_) {
      return null
    }
  }
  return null
}

/** A list, or one a JSON string holds; null otherwise. */
function listOf(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : null
    } catch (_) {
      return null
    }
  }
  return null
}

function dataOf(message) {
  if (!message || typeof message !== 'object') return {}
  return message.data && typeof message.data === 'object' ? message.data : message
}

/**
 * `PushPayload` of the contract from a push as it came — an FCM message (`data` with string values,
 * `notification`) or an APNs `userInfo` (`src`, `event` objects, `aps.alert`) — or null for a push that is
 * not the SDK's (no `id` and `type`).
 * @param {any} message
 * @param {string | null} [shopId] the shop the push went to
 * @returns {object | null}
 */
export function pushPayload(message, shopId = null) {
  const { code, type } = typeAndCode(message)
  if (code == null || code === '' || type == null || type === '') return null
  const data = dataOf(message)
  const alert = objectOf(objectOf(data.aps ?? message?.aps)?.alert)
  const notification = message?.notification && typeof message.notification === 'object' ? message.notification : {}
  const urls = listOf(data.action_urls) ?? []
  const actions = (listOf(data.actions) ?? [])
    .map((action, index) => {
      if (!action || typeof action !== 'object') return null
      return {
        id: action.action != null ? String(action.action) : '',
        title: action.title != null ? String(action.title) : '',
        url: text(urls[index]),
      }
    })
    .filter(Boolean)
  const event = objectOf(data.event ?? message?.event)
  const target = event
    ? { type: event.type != null ? String(event.type) : '', uri: event.uri != null ? String(event.uri) : '', payload: objectOf(event.payload) ?? {} }
    : null
  const strings = {}
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue
    strings[key] = typeof value === 'string' ? value : JSON.stringify(value)
  }
  return {
    shopId: shopId ?? text(data.shop_id) ?? null,
    code: String(code),
    type: String(type),
    title: text(data.title) ?? text(notification.title) ?? text(alert?.title),
    body: text(data.body) ?? text(notification.body) ?? text(alert?.body),
    icon: text(data.icon),
    image: text(data.image) ?? text(data.image_url),
    actions,
    target,
    source: text(data.source),
    sound: text(Platform.OS === 'ios' ? data.ios_sound_file : data.android_sound_file),
    data: strings,
  }
}

function call(callback, value, name) {
  try {
    callback(value)
  } catch (error) {
    console.error(`[SDK] The push callback ${name} threw (callback_failed):`, error?.message ?? error)
  }
}

/**
 * Tells the app a push event the SDK saw itself, once it was accepted: the shop's own callback of the
 * event, else the shared one. Once per event of a message in the process.
 * @param {{ _pushCallbacks?: object } | null} sdk the shop's instance; null for a shop without one
 * @param {string} shopId
 * @param {string} event `delivered`, `opened`, `clicked` or `closed`
 * @param {any} message the push as it came
 * @returns {void}
 */
export function tellPushEvent(sdk, shopId, event, message) {
  const name = CALLBACKS[event]
  if (!name) return
  const payload = pushPayload(message, shopId)
  if (!payload) return
  const key = `${shopId}|${event}|${payload.code}`
  if (toldEvents.has(key)) return
  toldEvents.add(key)
  const callback = sdk?._pushCallbacks?.[name] ?? shared?.[name]
  if (callback) call(callback, payload, name)
}

/**
 * Tells the app a new token the SDK's own push registration got: the shop's `onToken`, else the shared
 * one. Once per token and provider in the process.
 * @param {{ _pushCallbacks?: object } | null} sdk
 * @param {{ token: string, provider: string }} token
 * @returns {void}
 */
export function tellPushToken(sdk, token) {
  if (!token || typeof token.token !== 'string' || token.token === '') return
  const own = sdk?._pushCallbacks?.onToken
  const callback = own ?? shared?.onToken
  if (!callback) return
  // A shop's own callback hears the token once for that shop; the shared one once in the process.
  const key = `${own ? sdk.shop_id : '*'}|${token.provider}|${token.token}`
  if (toldTokens.has(key)) return
  toldTokens.add(key)
  call(callback, { token: token.token, provider: token.provider }, 'onToken')
}

/** Test-only: forgets what was told and the shared callbacks. */
export function resetPushCallbacks() {
  shared = null
  toldEvents.clear()
  toldTokens.clear()
}

export default { setSharedPushCallbacks, tellPushEvent, tellPushToken, pushPayload, pushCallbacksOf }
