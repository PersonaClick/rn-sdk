package com.personaclick.reactnative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * A value of [ModelMaps] as React Native hands it to JavaScript: a map as a [WritableMap], a list as a
 * [WritableArray], every number as a double (JavaScript has no other).
 */
internal fun jsValue(value: Any?): Any? = when (value) {
    is Map<*, *> -> jsMap(value)
    is List<*> -> jsArray(value)
    is Number -> value.toDouble()
    is Enum<*> -> value.name
    else -> value
}

private fun jsMap(map: Map<*, *>): WritableMap = Arguments.createMap().apply {
    map.forEach { (key, value) ->
        val name = key.toString()
        when (val js = jsValue(value)) {
            null -> putNull(name)
            is Boolean -> putBoolean(name, js)
            is Double -> putDouble(name, js)
            is String -> putString(name, js)
            is WritableMap -> putMap(name, js)
            is WritableArray -> putArray(name, js)
            else -> putString(name, js.toString())
        }
    }
}

private fun jsArray(list: List<*>): WritableArray = Arguments.createArray().apply {
    list.forEach { value ->
        when (val js = jsValue(value)) {
            null -> pushNull()
            is Boolean -> pushBoolean(js)
            is Double -> pushDouble(js)
            is String -> pushString(js)
            is WritableMap -> pushMap(js)
            is WritableArray -> pushArray(js)
            else -> pushString(js.toString())
        }
    }
}
