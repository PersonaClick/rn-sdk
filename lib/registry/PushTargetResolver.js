'use strict'

/**
 * Pure decision behind push routing (Release 4): which shop a push belongs to.
 *
 * The payload's `shop_id` names the target; with no `shop_id`, a single-instance app still works
 * (the one live shop is used). A `shop_id` that names no live instance, or an absent `shop_id` while
 * several shops are live, resolves to null — the push is dropped rather than delivered to the wrong
 * shop. Side-effect-free so the routing rules can be tested without dispatching a push.
 *
 * Mirrors the Android `PushTargetResolver` (`personalization-sdk`).
 *
 * @param {string | null | undefined} payloadShopId
 * @param {Set<string> | Iterable<string>} liveShopIds
 * @returns {string | null}
 */
export function resolve(payloadShopId, liveShopIds) {
  const live = liveShopIds instanceof Set ? liveShopIds : new Set(liveShopIds)

  if (payloadShopId != null) {
    return live.has(payloadShopId) ? payloadShopId : null
  }
  return live.size === 1 ? live.values().next().value : null
}

export default { resolve }
