package com.personaclick.reactnative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.personalization.core.SdkError
import com.personalization.core.SdkResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A tracking call settles as the native `tracking.queued` listener hears it: resolved with nothing once the
 * queue accepted the event, or rejected at once with the error's type as the code, the name iOS gives it.
 */
class CompletionsTest {

    /** What JavaScript's promise heard. */
    private class FakePromise : Promise {
        val resolved = mutableListOf<Any?>()
        val rejected = mutableListOf<Pair<String?, String?>>()

        override fun resolve(value: Any?) {
            resolved += value
        }

        override fun reject(code: String, message: String?) {
            rejected += code to message
        }

        override fun reject(code: String, throwable: Throwable?) = reject(code, throwable?.message)
        override fun reject(code: String, message: String?, throwable: Throwable?) = reject(code, message)
        override fun reject(throwable: Throwable) = reject("throwable", throwable.message)
        override fun reject(throwable: Throwable, userInfo: WritableMap) = reject("throwable", throwable.message)
        override fun reject(code: String, userInfo: WritableMap) = reject(code, null as String?)
        override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) = reject(code, throwable?.message)
        override fun reject(code: String, message: String?, userInfo: WritableMap) = reject(code, message)
        override fun reject(code: String?, message: String?, throwable: Throwable?, userInfo: WritableMap?) =
            reject(code ?: "", message)
        @Deprecated("The interface's own")
        override fun reject(message: String) = reject("", message)
    }

    @Test
    fun `an accepted event resolves the promise with nothing`() {
        val promise = FakePromise()

        accepted(promise).onComplete(SdkResult.Success(Unit))

        assertEquals(listOf<Any?>(null), promise.resolved)
        assertTrue(promise.rejected.isEmpty())
    }

    @Test
    fun `an event refused at once rejects with the error's type`() {
        val invalid = FakePromise()
        accepted(invalid).onComplete(SdkResult.Failure(SdkError.InvalidArgument("itemId is empty")))
        assertEquals(listOf("invalidArgument" to "itemId is empty"), invalid.rejected)

        val blocked = FakePromise()
        accepted(blocked).onComplete(SdkResult.Failure(SdkError.ShopBlocked))
        assertEquals("shopBlocked", blocked.rejected.single().first)

        val released = FakePromise()
        accepted(released).onComplete(SdkResult.Failure(SdkError.NotInitialized))
        assertEquals("notInitialized", released.rejected.single().first)
        assertTrue(released.resolved.isEmpty())
    }

    @Test
    fun `a method with a result resolves with it as JavaScript takes it`() {
        val promise = FakePromise()

        completion<String?>(promise) { it }.onComplete(SdkResult.Success(null))

        assertNull(promise.resolved.single())
    }

    @Test
    fun `a method body that throws anything still settles its promise, with invalidArgument`() {
        val unexpected = FakePromise()
        settling(unexpected) { throw IllegalStateException("the instance is in a bad state") }
        assertEquals(listOf("invalidArgument" to "the instance is in a bad state"), unexpected.rejected)

        val error = FakePromise()
        settling(error) { throw StackOverflowError() }
        assertEquals(listOf("invalidArgument" to "StackOverflowError"), error.rejected)

        val wrongType = FakePromise()
        settling(wrongType) { throw BridgeArgumentException("item.quantity must be a whole number") }
        assertEquals(listOf("invalidArgument" to "item.quantity must be a whole number"), wrongType.rejected)
    }

    @Test
    fun `a method body that settles itself is not rejected again, and one that returns early leaves its answer`() {
        val promise = FakePromise()
        settling(promise) { promise.resolve("done") }
        assertEquals(listOf<Any?>("done"), promise.resolved)
        assertTrue(promise.rejected.isEmpty())
    }

    @Test
    fun `a result the maps cannot hand over rejects with decoding instead of leaving the promise unsettled`() {
        val promise = FakePromise()

        completion<String>(promise) { throw ClassCastException("not a map") }.onComplete(SdkResult.Success("value"))

        assertTrue(promise.resolved.isEmpty())
        assertEquals("decoding", promise.rejected.single().first)
        assertTrue(promise.rejected.single().second!!.contains("not a map"))
    }

    @Test
    fun `every native error has the code iOS gives it`() {
        val codes = listOf(
            SdkError.NotInitialized,
            SdkError.ShopBlocked,
            SdkError.InvalidArgument("x"),
            SdkError.Network,
            SdkError.Timeout,
            SdkError.Http(500, "boom"),
            SdkError.Decoding,
            SdkError.Cancelled,
        ).map { it.jsCode }

        assertEquals(
            listOf("notInitialized", "shopBlocked", "invalidArgument", "network", "timeout", "http", "decoding", "cancelled"),
            codes,
        )
    }
}
