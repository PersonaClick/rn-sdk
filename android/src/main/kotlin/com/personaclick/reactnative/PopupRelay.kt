package com.personaclick.reactnative

import android.os.SystemClock
import com.personalization.sdk.data.models.dto.popUp.PopupActions
import com.personalization.sdk.data.models.dto.popUp.PopupDto
import org.json.JSONObject

/**
 * The server popups of the native SDK for JavaScript, which shows them as 4.0 did — `<SdkPopupOverlay>` or the
 * app's `popupPresentationDelegate`: the native SDK shows none. A popup that comes while JavaScript cannot
 * hear it (no React instance yet, a reload) is held up to [HOLD_MS] and handed over once a listener is added.
 */
internal class PopupRelay(
    private val emit: (shopId: String, popup: Map<String, Any?>) -> Boolean,
    private val now: () -> Long = { SystemClock.elapsedRealtime() },
) {

    private class Held(val shopId: String, val popup: Map<String, Any?>, val at: Long)

    /** In the order the popups came. */
    private val held = ArrayList<Held>()

    /** Hands [popup] of [shopId] to JavaScript, or holds it while JavaScript cannot hear it. */
    fun relay(shopId: String, popup: Map<String, Any?>) {
        if (!emit(shopId, popup)) synchronized(held) { held += Held(shopId, popup, now()) }
    }

    /** A listener was added: the popups still fresh go to it, in the order they came. */
    fun replay() {
        val waiting = synchronized(held) { held.toList().also { held.clear() } }
        waiting.filter { now() - it.at <= HOLD_MS }.forEach { relay(it.shopId, it.popup) }
    }

    /** [shopId] was released: none of its popups is held any more. */
    fun drop(shopId: String) {
        synchronized(held) { held.removeAll { it.shopId == shopId } }
    }

    companion object {
        const val HOLD_MS = 60_000L
    }
}

/** A popup as the server sends it in an answer: its fields under the server's names, as 4.0 handed them over. */
internal object PopupMaps {

    fun popup(p: PopupDto): Map<String, Any?> = linkedMapOf(
        "id" to p.id,
        "channels" to p.channels,
        "position" to p.position.value,
        "delay" to p.delay,
        "html" to p.html,
        // The server sends both as JSON strings.
        "components" to p.components?.let { c ->
            JSONObject()
                .put("header", c.header)
                .put("text", c.text)
                .put("image", c.image)
                .put("button", c.button)
                .put("header_enabled", c.headerEnabled)
                .put("text_enabled", c.textEnabled)
                .put("image_enabled", c.imageEnabled)
                .toString()
        },
        "web_push_system" to p.webPushSystem,
        "popup_actions" to p.popupActions?.let { actions(it).toString() },
    )

    private fun actions(a: PopupActions): JSONObject = JSONObject().apply {
        a.link?.let { link ->
            put(
                "link",
                JSONObject()
                    .put("link_android", link.linkAndroid)
                    .put("link_ios", link.linkIos)
                    .put("link_web", link.linkWeb)
                    .put("button_text", link.buttonText),
            )
        }
        a.close?.let { put("close", JSONObject().put("button_text", it.buttonText)) }
        a.pushSubscribe?.let { put("system_mobile_push_subscribe", JSONObject().put("button_text", it.buttonText)) }
    }
}
