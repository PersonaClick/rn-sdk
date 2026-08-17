'use strict'

/**
 * Process-wide registry of SDK instances — one per `shop_id`.
 *
 * Groundwork for multi-instance (Release 1). For now it carries no public surface: it owns the
 * routing state (an ordered fan-out set + a "current" default pointer + a `shopId -> instance`
 * mapping) so the plumbing to resolve an instance by `shop_id` is in place while single-instance
 * behaviour is unchanged. The public `PersonaClick.initialize/getInstance/registerShops` API is layered
 * on top later (Release 3).
 *
 * Mirrors the Android `SdkRegistry`, minus the locking: JavaScript runs on a single-threaded event
 * loop and none of these methods await, so `register` / `onNextRegister` cannot interleave — the
 * TOCTOU the Kotlin version guards with a lock cannot occur here. Awaiter callbacks are still fired
 * after the state mutation completes, since a host's `onReady` may re-enter the registry.
 *
 * References are held **strongly** (unlike iOS, which holds weakly): the whole point of the API is
 * that a host no longer keeps its own reference to the SDK. `reset()` clears everything for tests.
 */
class SdkRegistry {
  constructor() {
    /** @type {Array<object>} ordered fan-out set (most-recently-registered last). */
    this._instances = []
    /** @type {Map<string, object>} shopId -> instance. */
    this._byShop = new Map()
    /** @type {Array<{ shopId: string | null, onReady: (sdk: object) => void }>} */
    this._awaiting = []
    /** @type {object | null} the current default instance. */
    this._current = null
  }

  /**
   * Records an initialized [sdk] for [shopId]: it joins the push fan-out set and becomes the current
   * default. Re-registering the same instance keeps a single entry; a new instance for an already
   * known [shopId] replaces the mapping (last writer wins) and evicts the superseded instance from
   * the fan-out set, so a re-init does not leave the old object receiving push tokens.
   *
   * @param {string} shopId
   * @param {object} sdk
   * @returns {void}
   */
  register(shopId, sdk) {
    if (!shopId || typeof shopId !== 'string' || sdk == null) return

    // Move sdk to the end of the ordered fan-out set.
    const existingIdx = this._instances.indexOf(sdk)
    if (existingIdx !== -1) this._instances.splice(existingIdx, 1)
    this._instances.push(sdk)

    // A re-init builds a new SDK for the same shop: drop the one it supersedes, or it lingers in the
    // fan-out set forever — still fed push tokens and inflating all()/count().
    const previous = this._byShop.get(shopId)
    this._byShop.set(shopId, sdk)
    if (previous != null && previous !== sdk) {
      const prevIdx = this._instances.indexOf(previous)
      if (prevIdx !== -1) this._instances.splice(prevIdx, 1)
    }

    this._current = sdk

    const toNotify = this._takeMatchingAwaiters(shopId)
    toNotify.forEach((awaiter) => awaiter.onReady(sdk))
  }

  /**
   * Removes and returns the awaiters matching [shopId] (a null-shopId awaiter matches any shop).
   * @param {string} shopId
   * @returns {Array<{ shopId: string | null, onReady: (sdk: object) => void }>}
   */
  _takeMatchingAwaiters(shopId) {
    if (this._awaiting.length === 0) return []
    const matched = []
    const remaining = []
    for (const awaiter of this._awaiting) {
      if (awaiter.shopId == null || awaiter.shopId === shopId) matched.push(awaiter)
      else remaining.push(awaiter)
    }
    if (matched.length > 0) this._awaiting = remaining
    return matched
  }

  /**
   * Subscribes to the next `register` matching [shopId] (null matches the first registration of any
   * shop). Re-checks the live state first: if the instance already arrived, fires [onReady]
   * immediately instead of waiting for a signal that has already passed. Returns a handle that
   * removes the subscription; call it when the waiter goes away (e.g. a view unmounts) so the
   * callback is not leaked.
   *
   * @param {string | null} shopId
   * @param {(sdk: object) => void} onReady
   * @returns {() => void} cancel
   */
  onNextRegister(shopId, onReady) {
    const alreadyLive = shopId != null ? this._byShop.get(shopId) : this._current
    if (alreadyLive != null) {
      onReady(alreadyLive)
      return () => {}
    }
    const awaiter = { shopId: shopId ?? null, onReady }
    this._awaiting.push(awaiter)
    return () => {
      const idx = this._awaiting.indexOf(awaiter)
      if (idx !== -1) this._awaiting.splice(idx, 1)
    }
  }

  /**
   * Drops [sdk] from the fan-out set and the shop mapping. `current` is intentionally left as-is,
   * matching the legacy release semantics.
   * @param {object} sdk
   * @returns {void}
   */
  unregister(sdk) {
    const idx = this._instances.indexOf(sdk)
    if (idx !== -1) this._instances.splice(idx, 1)
    for (const [key, value] of this._byShop) {
      if (value === sdk) this._byShop.delete(key)
    }
  }

  /** @returns {Array<object>} snapshot of every registered instance — the push-token fan-out set. */
  all() {
    return this._instances.slice()
  }

  /** @returns {object | null} the current default instance, or null when nothing is registered. */
  current() {
    return this._current
  }

  /**
   * @param {string} shopId
   * @returns {object | null} the instance registered for [shopId], or null if none.
   */
  byShopId(shopId) {
    return this._byShop.get(shopId) ?? null
  }

  /** @returns {Set<string>} shop ids with a live, registered instance. */
  shopIds() {
    return new Set(this._byShop.keys())
  }

  /** @returns {number} number of registered instances. */
  count() {
    return this._instances.length
  }

  /** Clears all state. Test-only: the registry is a process singleton. */
  reset() {
    this._instances = []
    this._byShop = new Map()
    this._awaiting = []
    this._current = null
  }
}

/** Process-wide singleton. */
const sdkRegistry = new SdkRegistry()

export default sdkRegistry
export { SdkRegistry }
