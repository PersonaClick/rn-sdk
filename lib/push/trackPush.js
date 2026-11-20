'use strict'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { request } from '../client'
import { getStorageKey } from '../../utils'

/**
 * Fires a push lifecycle track (`track/delivered` | `track/opened` | `track/clicked` | `track/closed`) for a
 * shop WITHOUT constructing or initializing an SDK instance, from this JavaScript.
 *
 * The request reads the shop's persisted did from AsyncStorage (see `client.getData`), so a
 * registered-but-not-initialized (pending) shop's push is tracked with no `/init` round-trip, no
 * push-token re-registration and no profile call. As every push event it carries the A/B group the shop
 * kept and no session. With the native module the push goes to the native SDK first (`PersonaClick.handlePush`
 * there); this is what is left when the native SDK cannot take it (iOS: a shop it has not started).
 *
 * @param {string} shopId
 * @param {string} event - a `PushEvent` value (`delivered` | `opened` | `clicked` | `closed`)
 * @param {{ code?: string, type?: string, stream?: string }} [options]
 * @returns {Promise<any>}
 */
export async function trackPush(shopId, event, options = {}) {
  try {
    let segment
    try {
      segment = (await AsyncStorage.getItem(getStorageKey('segment', shopId))) || undefined
    } catch (_) {
      segment = undefined
    }
    return await request(`track/${event}`, shopId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      params: { shop_id: shopId, ...(segment && { segment }), ...options },
      withoutSession: true,
    })
  } catch (error) {
    return error
  }
}

export default trackPush
