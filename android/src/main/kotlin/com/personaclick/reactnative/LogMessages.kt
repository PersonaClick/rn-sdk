package com.personaclick.reactnative

import com.personalization.SdkLogMessage

/** The native SDK's log messages as JavaScript gets them: `SdkLogMessage` of the contract. */
internal object LogMessages {

    /**
     * `{ level, code, message, shopId, context }`: `level` the contract's name (`debug`, `info`,
     * `warning`, `error`), `shopId` null for a message about no one shop, `context` as the SDK gave it.
     */
    fun map(message: SdkLogMessage): Map<String, Any?> = linkedMapOf(
        "level" to message.level.name.lowercase(),
        "code" to message.code,
        "message" to message.message,
        "shopId" to message.shopId,
        "context" to message.context.mapValues { (_, value) -> contextValue(value) },
    )

    /** A context value JavaScript can take: a number, a boolean, a string, a list or map of them, or null. */
    private fun contextValue(value: Any?): Any? = when (value) {
        null, is Boolean, is Number, is String -> value
        is Map<*, *> -> value.entries.associate { (key, item) -> key.toString() to contextValue(item) }
        is List<*> -> value.map(::contextValue)
        else -> value.toString()
    }
}
