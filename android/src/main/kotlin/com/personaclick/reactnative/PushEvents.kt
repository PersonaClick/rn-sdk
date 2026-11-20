package com.personaclick.reactnative

import com.personalization.PushProvider
import com.personalization.core.PushEvent

/** The push events and providers as JavaScript names them: the contract's names. */
internal object PushEvents {

    /** @throws IllegalArgumentException for a name that is no push event. */
    fun of(name: String): PushEvent = when (name) {
        "delivered" -> PushEvent.DELIVERED
        "opened" -> PushEvent.OPENED
        "clicked" -> PushEvent.CLICKED
        "closed" -> PushEvent.CLOSED
        else -> throw IllegalArgumentException("Unknown push event: $name")
    }

    /** @throws IllegalArgumentException for a provider Android does not have (`apns`). */
    fun provider(name: String): PushProvider =
        PushProvider.fromId(name) ?: throw IllegalArgumentException("provider must be fcm or hms on Android: $name")
}
