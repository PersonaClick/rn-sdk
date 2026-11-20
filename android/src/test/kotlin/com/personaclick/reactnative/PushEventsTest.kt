package com.personaclick.reactnative

import com.personalization.PushProvider
import com.personalization.core.PushEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/** The push events and providers JavaScript names reach the native SDK as its own; another name is refused. */
class PushEventsTest {

    @Test
    fun `the contract's events are the native ones`() {
        assertEquals(PushEvent.DELIVERED, PushEvents.of("delivered"))
        assertEquals(PushEvent.OPENED, PushEvents.of("opened"))
        assertEquals(PushEvent.CLICKED, PushEvents.of("clicked"))
        assertEquals(PushEvent.CLOSED, PushEvents.of("closed"))
        assertThrows(IllegalArgumentException::class.java) { PushEvents.of("received") }
    }

    @Test
    fun `fcm and hms are Android's providers, apns is not`() {
        assertEquals(PushProvider.FCM, PushEvents.provider("fcm"))
        assertEquals(PushProvider.HMS, PushEvents.provider("hms"))
        val error = assertThrows(IllegalArgumentException::class.java) { PushEvents.provider("apns") }
        assertEquals("provider must be fcm or hms on Android: apns", error.message)
    }
}
