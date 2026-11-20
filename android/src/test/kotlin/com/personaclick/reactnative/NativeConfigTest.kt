package com.personaclick.reactnative

import com.facebook.react.bridge.JavaOnlyMap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import com.personalization.LogLevel
import org.junit.Test

/** The configuration JavaScript starts a shop with becomes the native SDK's, with the module's defaults. */
class NativeConfigTest {

    @Test
    fun `a shop whose app names no stream runs as react-native`() {
        assertEquals("react-native", PersonaClickNativeModule.nativeConfig(JavaOnlyMap.of("shopId", "shop")).stream)
        assertEquals("react-native", PersonaClickNativeModule.nativeConfig(JavaOnlyMap.of("shopId", "shop", "stream", null)).stream)
        assertEquals("react-native", PersonaClickNativeModule.nativeConfig(JavaOnlyMap.of("shopId", "shop", "stream", "  ")).stream)
    }

    @Test
    fun `an app's own stream is kept`() {
        assertEquals("android", PersonaClickNativeModule.nativeConfig(JavaOnlyMap.of("shopId", "shop", "stream", "android")).stream)
        assertEquals("tv-app", PersonaClickNativeModule.nativeConfig(JavaOnlyMap.of("shopId", "shop", "stream", "tv-app")).stream)
    }

    @Test
    fun `the contract's config fields reach the native SDK`() {
        val config = PersonaClickNativeModule.nativeConfig(
            JavaOnlyMap.of(
                "shopId", "shop", "sendAdvertisingId", true, "needReInitialization", true,
                "storageKey", "app-store", "deviceId", "did-1", "logLevel", "info",
            )
        )
        assertTrue(config.sendAdvertisingId)
        assertTrue(config.needReInitialization)
        assertEquals("app-store", config.storageKey)
        assertEquals("did-1", config.deviceId)
        assertEquals(LogLevel.INFO, config.logLevel)
        assertFalse(PersonaClickNativeModule.nativeConfig(JavaOnlyMap.of("shopId", "shop")).sendAdvertisingId)
    }

    @Test
    fun `JavaScript shows the popups and hands over the token`() {
        val config = PersonaClickNativeModule.nativeConfig(JavaOnlyMap.of("shopId", "shop"))
        assertFalse(config.enableAutoPopupPresentation)
        assertFalse(config.autoSendPushToken)
    }
}
