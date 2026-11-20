package com.personaclick.reactnative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.personalization.core.CompletionListener
import com.personalization.core.SdkError
import com.personalization.core.SdkResult

/**
 * A native method's listener for JavaScript: [promise] resolves with the value as [convert] hands it over,
 * or rejects with the native error, once — as the native method completes.
 */
internal fun <T> completion(promise: Promise, convert: (T) -> Any?): CompletionListener<T> = CompletionListener { result ->
    when (result) {
        is SdkResult.Success -> {
            // A value the maps cannot hand over still settles the call: JavaScript must not wait for it.
            val value = try {
                jsValue(convert(result.value))
            } catch (e: Throwable) {
                promise.reject(DECODING, "The native result could not be handed to JavaScript: ${e.message ?: e.javaClass.simpleName}")
                return@CompletionListener
            }
            promise.resolve(value)
        }
        is SdkResult.Failure -> promise.reject(result.error)
    }
}

/**
 * Runs [block], the body of one of the module's methods with a promise: whatever it throws rejects [promise]
 * instead of leaving it unsettled — a JavaScript call that waits for it, the shop's start among them, would
 * wait forever. An argument of the wrong type is `invalidArgument`, and so is anything else unexpected: the
 * code iOS gives an unexpected error. A promise settled before the throw keeps its first answer.
 */
internal inline fun settling(promise: Promise, block: () -> Unit) {
    try {
        block()
    } catch (e: Throwable) {
        promise.reject(INVALID_ARGUMENT, e.message ?: e.javaClass.simpleName)
    }
}

/** The codes of JavaScript's `SdkError` the module gives itself. */
internal const val INVALID_ARGUMENT = "invalidArgument"
internal const val DECODING = "decoding"

/**
 * A tracking call's listener (`tracking.queued`): [promise] resolves with nothing once the native queue
 * accepted the event, as on iOS, or rejects with what refused it at once — `invalidArgument`, `shopBlocked`,
 * `notInitialized`. The server's answer comes later and does not reach it.
 */
internal fun accepted(promise: Promise): CompletionListener<Unit> = completion(promise) { null }

/** The native error's type as JavaScript's code, the name iOS gives it. */
internal val SdkError.jsCode: String
    get() = when (this) {
        SdkError.NotInitialized -> "notInitialized"
        SdkError.ShopBlocked -> "shopBlocked"
        is SdkError.InvalidArgument -> "invalidArgument"
        SdkError.Network -> "network"
        SdkError.Timeout -> "timeout"
        is SdkError.Http -> "http"
        SdkError.Decoding -> "decoding"
        SdkError.Cancelled -> "cancelled"
    }

/** Rejects with the native error's type as the code, as on iOS; an HTTP error carries its codes. */
internal fun Promise.reject(error: SdkError) {
    if (error is SdkError.Http) {
        val userInfo = Arguments.createMap().apply {
            putInt("httpCode", error.code)
            error.serverCode?.let { putString("serverCode", it) }
        }
        reject(error.jsCode, error.message, userInfo)
    } else {
        reject(error.jsCode, error.message)
    }
}
