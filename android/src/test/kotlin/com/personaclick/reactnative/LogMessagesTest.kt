package com.personaclick.reactnative

import com.personalization.LogLevel
import com.personalization.SdkLogMessage
import org.junit.Assert.assertEquals
import org.junit.Test

/** The native SDK's log message becomes the contract's `SdkLogMessage` JavaScript gets. */
class LogMessagesTest {

    @Test
    fun `a message has the contract's fields and level names`() {
        val map = LogMessages.map(
            SdkLogMessage(LogLevel.WARNING, "init_retry", "/init will be retried", "shop", mapOf("attempt" to 2, "path" to "init")),
        )
        assertEquals(
            mapOf(
                "level" to "warning",
                "code" to "init_retry",
                "message" to "/init will be retried",
                "shopId" to "shop",
                "context" to mapOf("attempt" to 2, "path" to "init"),
            ),
            map,
        )
    }

    @Test
    fun `a message about no shop has none, and a context value JavaScript cannot take is its text`() {
        val map = LogMessages.map(SdkLogMessage(LogLevel.DEBUG, "sdk_log", "text", null, mapOf("value" to StringBuilder("x"), "none" to null)))
        assertEquals(null, map["shopId"])
        assertEquals("debug", map["level"])
        assertEquals(mapOf("value" to "x", "none" to null), map["context"])
    }
}
