package com.personaclick.reactnative

import com.personalization.Cancellable
import java.util.concurrent.ConcurrentHashMap

/**
 * Per shop, the module's subscriptions that tell JavaScript the instance's state and session. A shop
 * initialized again (a JavaScript reload) gets new ones and its earlier ones are cancelled; a released
 * shop's are cancelled and it is no longer told; the module's end cancels them all.
 */
internal class ShopSubscriptions {

    private val byShop = ConcurrentHashMap<String, Cancellable>()

    /** [subscription] is the shop's from now on; the one it had is cancelled. */
    fun replace(shopId: String, subscription: Cancellable) {
        byShop.put(shopId.trim(), subscription)?.cancel()
    }

    /** Cancels the shop's subscription: the module tells JavaScript nothing more of it. */
    fun release(shopId: String) {
        byShop.remove(shopId.trim())?.cancel()
    }

    /** The shops the module tells JavaScript about. */
    fun shopIds(): Set<String> = byShop.keys.toSet()

    fun cancelAll() {
        byShop.keys.toList().forEach(::release)
    }
}
