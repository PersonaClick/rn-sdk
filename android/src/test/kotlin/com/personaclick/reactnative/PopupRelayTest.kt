package com.personaclick.reactnative

import com.personalization.sdk.data.models.dto.popUp.CloseAction
import com.personalization.sdk.data.models.dto.popUp.Components
import com.personalization.sdk.data.models.dto.popUp.Link
import com.personalization.sdk.data.models.dto.popUp.PopupActions
import com.personalization.sdk.data.models.dto.popUp.PopupDto
import com.personalization.sdk.data.models.dto.popUp.Position
import com.personalization.sdk.data.models.dto.popUp.PushSubscribe
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The native SDK's server popups reach JavaScript as the server sends them, and none is lost while
 * JavaScript cannot hear it for a while.
 */
class PopupRelayTest {

    private val popup = PopupDto(
        id = 7,
        channels = listOf("mobile"),
        position = Position.BOTTOM,
        delay = 2,
        html = "<p>Hi</p>",
        components = Components(
            text = "Text", image = "https://img", button = "Go", header = "Header",
            textEnabled = "true", imageEnabled = "false", headerEnabled = "true",
        ),
        webPushSystem = false,
        popupActions = PopupActions(
            link = Link(linkIos = "app://ios", linkWeb = "https://web", buttonText = "Open", linkAndroid = "app://android"),
            close = CloseAction(buttonText = "Close"),
            pushSubscribe = PushSubscribe(buttonText = "Subscribe"),
        ),
    )

    @Test
    fun `a popup has the server's fields, components and actions as the JSON strings the server sends`() {
        val map = PopupMaps.popup(popup)

        assertEquals(7, map["id"])
        assertEquals(listOf("mobile"), map["channels"])
        assertEquals("fixed_bottom", map["position"])
        assertEquals(2, map["delay"])
        assertEquals("<p>Hi</p>", map["html"])
        assertEquals(false, map["web_push_system"])
        val components = JSONObject(map["components"] as String)
        assertEquals("Header", components.getString("header"))
        assertEquals("true", components.getString("text_enabled"))
        val actions = JSONObject(map["popup_actions"] as String)
        assertEquals("app://android", actions.getJSONObject("link").getString("link_android"))
        assertEquals("Open", actions.getJSONObject("link").getString("button_text"))
        assertEquals("Close", actions.getJSONObject("close").getString("button_text"))
        assertEquals("Subscribe", actions.getJSONObject("system_mobile_push_subscribe").getString("button_text"))
    }

    @Test
    fun `a popup without components or actions has none, and a position the SDK does not know is empty`() {
        val map = PopupMaps.popup(popup.copy(components = null, popupActions = null, position = Position.UNKNOWN))

        assertNull(map["components"])
        assertNull(map["popup_actions"])
        assertEquals("", map["position"])
    }

    @Test
    fun `a popup JavaScript cannot hear yet is held and handed over once a listener comes, in order`() {
        var listening = false
        val heard = mutableListOf<Pair<String, Any?>>()
        val relay = PopupRelay(emit = { shopId, p -> if (listening) heard += shopId to p["id"]; listening }, now = { 0L })

        relay.relay("a", mapOf("id" to 1))
        relay.relay("b", mapOf("id" to 2))
        assertTrue(heard.isEmpty())

        listening = true
        relay.replay()
        relay.relay("a", mapOf("id" to 3))

        assertEquals(listOf("a" to 1, "b" to 2, "a" to 3), heard)
    }

    @Test
    fun `a held popup older than a minute, or of a released shop, is not handed over`() {
        var time = 0L
        var listening = false
        val heard = mutableListOf<Any?>()
        val relay = PopupRelay(emit = { _, p -> if (listening) heard += p["id"]; listening }, now = { time })

        relay.relay("a", mapOf("id" to 1))
        relay.relay("b", mapOf("id" to 2))
        time = 30_000L
        relay.relay("a", mapOf("id" to 3))
        relay.drop("b")
        time = 61_000L
        listening = true
        relay.replay()

        assertEquals(listOf<Any?>(3), heard)
    }
}
