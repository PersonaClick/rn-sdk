'use strict'

import { request } from '../client'

/**
 * Fires a push lifecycle track (`track/delivered` | `track/opened` | `track/clicked`) for a shop
 * WITHOUT constructing or initializing an SDK instance.
 *
 * The request reads the shop's persisted did/seance from AsyncStorage (see `client.getData`), so a
 * registered-but-not-initialized (pending) shop's push is tracked with no `/init` round-trip, no
 * push-token re-registration and no profile call — the RN analog of the native light push-context
 * init (`SDK.initializeForPush`). RN's network layer is standalone (`request()` takes a `shop_id`),
 * so unlike native there is nothing to materialize: the track goes out on the persisted identity
 * directly.
 *
 * @param {string} shopId
 * @param {string} event - a `PushEvent` value (`delivered` | `opened` | `clicked`)
 * @param {{ code?: string, type?: string, stream?: string }} [options]
 * @returns {Promise<any>}
 */
export async function trackPush(shopId, event, options = {}) {
  try {
    return await request(`track/${event}`, shopId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      params: { shop_id: shopId, ...options },
    })
  } catch (error) {
    return error
  }
}

export default trackPush
