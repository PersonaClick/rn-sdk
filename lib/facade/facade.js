'use strict'

import SdkRegistry from '../registry/SdkRegistry'
import { resolve, ResolutionType } from '../registry/InstanceResolver'
import * as PushPayloadParser from '../push/PushPayloadParser'
import { PushEvent } from '../push/PushEvent'
import { UnknownShopIdError, AmbiguousShopError } from './errors'

/**
 * Facade resolution logic behind the public `PersonaClick.*` API (Release 3). Kept in its own light module
 * — it imports only the registry + resolvers + errors, never `MainSDK`/`index` — so UI components
 * (StoriesList/StoryViewer) can import `awaitInstance` from here without pulling the SDK's heavy push
 * dependency graph into the stories subpath bundle.
 *
 * Constructing an SDK would require the `PersonaClick` class from `index.js`, which imports this module —
 * a cycle. The cycle is broken with an injected factory: `index.js` calls `setSdkFactory` at load
 * time. Any app that has a shop registered has necessarily loaded `index.js` (that is the only way
 * to call initialize/registerShops), so the factory is always set before a pending shop is
 * materialized.
 *
 * Mirrors the Android `PersonaClick` object.
 */

/** @type {Map<string, object>} shopId -> config (registered but not yet initialized). */
const pending = new Map()

/** @type {((config: object) => object) | null} */
let sdkFactory = null

/** @type {((shopId: string, event: string, options: object) => any) | null} */
let pushTracker = null

/**
 * Injects the SDK constructor (called once from `index.js`). Breaks the index <-> facade cycle.
 * @param {(config: object) => object} factory
 */
export function setSdkFactory(factory) {
  sdkFactory = factory
}

/**
 * Injects the standalone push tracker (called once from `index.js`). Lets `handlePush` track a push
 * for a registered-but-pending shop using its persisted identity — no construction/init — while this
 * light facade module keeps not importing `client`/`MainSDK` (so the stories subpath bundle stays
 * small). Same seam pattern as [setSdkFactory].
 * @param {(shopId: string, event: string, options: object) => any} tracker
 */
export function setPushTracker(tracker) {
  pushTracker = tracker
}

function build(config) {
  if (typeof sdkFactory !== 'function') {
    throw new Error(
      "PersonaClick SDK factory is not set. Import the SDK entry ('@personaClick/react-native-sdk') before resolving instances."
    )
  }
  return sdkFactory(config)
}

function missingMessage(shopId) {
  return (
    `No shop is registered for shopId=${shopId}. ` +
    'Call PersonaClick.initialize(...) or PersonaClick.registerShops(...) first.'
  )
}

function registeredShopIds() {
  return [...SdkRegistry.shopIds(), ...pending.keys()].sort()
}

/**
 * Initializes an SDK for [config] immediately and returns it. The instance registers itself (via the
 * SDK constructor), so it is also reachable through `getInstance`. Any pending registration for the
 * same shop is cleared. A re-init builds a new instance (last-writer-wins in the registry).
 *
 * @param {object} config - `{ shopId, stream?, debug?, autoSendPushToken?, apiDomain?, storageKey? }`
 * @returns {object} the SDK instance
 */
export function initialize(config) {
  const shopId = config && config.shopId
  if (!shopId || typeof shopId !== 'string') {
    throw new Error('PersonaClick.initialize: config.shopId is required (a non-empty string).')
  }
  const sdk = build(config)
  pending.delete(shopId)
  return sdk
}

/**
 * Registers [configs] without initializing them. Initialization is lazy — on the first `getInstance`
 * for a shop (the region case). Pass `{ eagerInit: true }` to initialize every shop up front (the
 * super-shop case).
 *
 * @param {object[]} configs
 * @param {{ eagerInit?: boolean }} [options]
 * @returns {void}
 */
export function registerShops(configs, options = {}) {
  const eagerInit = !!(options && options.eagerInit)
  ;(Array.isArray(configs) ? configs : []).forEach((config) => {
    if (!config || !config.shopId || typeof config.shopId !== 'string') return
    if (eagerInit) initialize(config)
    else pending.set(config.shopId, config)
  })
}

/** Initializes a pending registration for [shopId], or returns the live instance if already up. */
function materialize(shopId) {
  const config = pending.get(shopId)
  if (config) {
    pending.delete(shopId)
    return initialize(config)
  }
  const live = SdkRegistry.byShopId(shopId)
  if (live) return live
  throw new UnknownShopIdError(missingMessage(shopId))
}

/**
 * Returns the SDK for [shopId], initializing a pending registration on first use. With no [shopId],
 * returns the single instance when exactly one shop is registered.
 *
 * @param {string | null} [shopId]
 * @returns {object}
 * @throws {AmbiguousShopError} when [shopId] is null and more than one shop is registered.
 * @throws {UnknownShopIdError} when the shop is unknown — nothing registered, or no such shop.
 */
export function getInstance(shopId = null) {
  const resolution = resolve(shopId, SdkRegistry.shopIds(), new Set(pending.keys()))
  switch (resolution.type) {
    case ResolutionType.EXISTING: {
      const sdk = SdkRegistry.byShopId(resolution.shopId)
      if (sdk) return sdk
      throw new UnknownShopIdError(missingMessage(resolution.shopId))
    }
    case ResolutionType.PENDING:
      return materialize(resolution.shopId)
    case ResolutionType.AMBIGUOUS:
      throw new AmbiguousShopError(
        'More than one shop is registered — call PersonaClick.getInstance(shopId) with an explicit id. ' +
          `Registered: ${JSON.stringify(registeredShopIds())}.`
      )
    case ResolutionType.NOT_REGISTERED:
    default:
      throw new UnknownShopIdError(
        shopId != null
          ? missingMessage(shopId)
          : 'No shop has been registered. Call PersonaClick.initialize(...) or PersonaClick.registerShops(...) first.'
      )
  }
}

/**
 * True when an instance is available for [shopId] — or, with no [shopId], when exactly one shop is
 * initialized so the default is unambiguous. A pending (registered-not-initialized) shop is not
 * counted as initialized.
 *
 * @param {string | null} [shopId]
 * @returns {boolean}
 */
export function isInitialized(shopId = null) {
  if (shopId != null) return SdkRegistry.byShopId(shopId) != null
  return SdkRegistry.shopIds().size === 1
}

/**
 * Delivers the instance for [shopId] to [onReady] as soon as it is available — immediately if it is
 * already initialized, otherwise once it is (a pending registration is materialized on the spot).
 * With no [shopId] the single default instance is used, waiting for the first one when nothing is
 * registered yet. Returns a cancel function; call it when the waiter goes away (e.g. a component
 * unmounts) so [onReady] is not held.
 *
 * UI-friendly variant: an ambiguous default (no shopId, several shops) does NOT resolve — it warns
 * and returns without calling [onReady], rather than throwing (mirrors iOS `awaitInstance`; throwing
 * inside a React effect would crash the host). Callers that want the throw use `getInstance()`.
 *
 * @param {string | null} shopId
 * @param {(sdk: object) => void} onReady
 * @returns {() => void} cancel
 */
export function awaitInstance(shopId = null, onReady) {
  if (typeof onReady !== 'function') {
    throw new Error('PersonaClick.awaitInstance: onReady callback is required.')
  }
  const resolution = resolve(shopId, SdkRegistry.shopIds(), new Set(pending.keys()))
  switch (resolution.type) {
    case ResolutionType.EXISTING: {
      const sdk = SdkRegistry.byShopId(resolution.shopId)
      if (sdk) onReady(sdk)
      return () => {}
    }
    case ResolutionType.PENDING:
      onReady(materialize(resolution.shopId))
      return () => {}
    case ResolutionType.AMBIGUOUS:
      console.warn(
        'PersonaClick.awaitInstance: more than one shop is registered and no shopId was given — ambiguous, ' +
          'not resolving. Pass an explicit shopId. Registered: ' + JSON.stringify(registeredShopIds())
      )
      return () => {}
    case ResolutionType.NOT_REGISTERED:
    default:
      // Nothing matches yet — wake up on the first matching registration.
      return SdkRegistry.onNextRegister(shopId, onReady)
  }
}

/**
 * Routes a push to the shop it belongs to and tracks [event] on it. The target is the payload's
 * `shop_id`; with no `shop_id` a single registered shop still resolves, but an unknown shop — or an
 * absent `shop_id` while several shops are registered — drops the push instead of tracking it on the
 * wrong one. Tracking-only: navigation/display stay with the host's messaging service (mirrors iOS).
 *
 * Resolution matches `getInstance` (live OR pending). A push for a registered-but-not-initialized
 * (pending) shop is tracked WITHOUT initializing it: RN's `request()` reads the shop's persisted
 * did/seance from AsyncStorage, so the delivery is tracked with no `/init`, no token re-registration
 * and no profile call — the RN equivalent of the native light push-context bring-up. This is what lets
 * a lazily-registered shop's push be tracked when the app is not running, without heavy init.
 *
 * @param {object} payload - FCM remote message (fields under `.data`) or a flat data object.
 * @param {string} event - a `PushEvent` value (`delivered` | `opened` | `clicked`).
 * @returns {void}
 */
export function handlePush(payload, event) {
  if (event !== PushEvent.DELIVERED && event !== PushEvent.OPENED && event !== PushEvent.CLICKED) {
    console.warn(
      `PersonaClick.handlePush: unknown event "${event}". Use PushEvent.DELIVERED / OPENED / CLICKED.`
    )
    return
  }

  // Public entry point a host calls from its own messaging service — never let a failure here (a
  // malformed payload, a tracker error) throw into the host and crash it. Mirrors the native SDKs,
  // whose messaging services wrap push handling in try/catch for the same reason.
  try {
    const resolution = resolve(PushPayloadParser.shopId(payload), SdkRegistry.shopIds(), new Set(pending.keys()))
    const { code, type } = PushPayloadParser.typeAndCode(payload)

    switch (resolution.type) {
      case ResolutionType.EXISTING: {
        const sdk = SdkRegistry.byShopId(resolution.shopId)
        if (sdk) dispatchToInstance(sdk, event, { code, type })
        return
      }
      case ResolutionType.PENDING: {
        // A registered-but-not-initialized shop: track on its persisted identity, no construction/init.
        const config = pending.get(resolution.shopId)
        if (pushTracker) pushTracker(resolution.shopId, event, { code, type, stream: config && config.stream })
        return
      }
      case ResolutionType.AMBIGUOUS:
      case ResolutionType.NOT_REGISTERED:
      default:
        return // drop: unknown shop, or ambiguous (no shop_id while several are registered)
    }
  } catch (e) {
    console.warn('PersonaClick.handlePush: ignored a push-handling error', e)
  }
}

/**
 * Push-routing resolution for the process-global `PushRouter`: which shop a push belongs to, and
 * whether it is live or only registered (pending). Returns null to drop (unknown shop, or ambiguous
 * with no shop_id while several are registered). Lets the router handle a pending shop's push without
 * initializing it — parity with `handlePush` — rather than dropping it because no instance is live.
 *
 * @param {string | null | undefined} payloadShopId
 * @returns {{ shopId: string, live: boolean, stream?: string } | null}
 */
export function resolvePushRoute(payloadShopId) {
  const resolution = resolve(payloadShopId, SdkRegistry.shopIds(), new Set(pending.keys()))
  switch (resolution.type) {
    case ResolutionType.EXISTING:
      return { shopId: resolution.shopId, live: true }
    case ResolutionType.PENDING: {
      const config = pending.get(resolution.shopId)
      return { shopId: resolution.shopId, live: false, stream: config && config.stream }
    }
    default:
      return null // AMBIGUOUS / NOT_REGISTERED — drop rather than deliver to the wrong shop
  }
}

/** Dispatches an already-validated event to a live instance's track method. */
function dispatchToInstance(sdk, event, options) {
  switch (event) {
    case PushEvent.DELIVERED:
      if (typeof sdk.notificationDelivered === 'function') sdk.notificationDelivered(options)
      break
    case PushEvent.OPENED:
      if (typeof sdk.notificationOpened === 'function') sdk.notificationOpened(options)
      break
    case PushEvent.CLICKED:
      if (typeof sdk.notificationClicked === 'function') sdk.notificationClicked(options)
      break
  }
}

/** Test-only: drops pending registrations. Live instances live in SdkRegistry (reset separately). */
export function reset() {
  pending.clear()
}

/** Test-only: shops registered lazily and not yet initialized. */
export function pendingShopIds() {
  return new Set(pending.keys())
}
