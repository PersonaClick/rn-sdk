package com.personaclick.reactnative

import com.personalization.Cancellable
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The module tells JavaScript the state of each shop it initialized: once per shop, until the shop is
 * released or the module ends.
 */
class ShopSubscriptionsTest {

    private val cancelled = mutableListOf<String>()

    private fun subscription(name: String) = Cancellable { cancelled += name }

    @Test
    fun `a shop initialized again keeps only its new subscription`() {
        val subscriptions = ShopSubscriptions()
        subscriptions.replace("shop", subscription("first"))
        subscriptions.replace("shop", subscription("second"))

        assertEquals(listOf("first"), cancelled)
        assertEquals(setOf("shop"), subscriptions.shopIds())
    }

    @Test
    fun `a released shop is no longer told and the other shops still are`() {
        val subscriptions = ShopSubscriptions()
        subscriptions.replace("a", subscription("a"))
        subscriptions.replace("b", subscription("b"))

        subscriptions.release(" a ")

        assertEquals(listOf("a"), cancelled)
        assertEquals(setOf("b"), subscriptions.shopIds())
    }

    @Test
    fun `releasing a shop it does not tell, or one released already, cancels nothing`() {
        val subscriptions = ShopSubscriptions()
        subscriptions.replace("a", subscription("a"))
        subscriptions.release("a")

        subscriptions.release("a")
        subscriptions.release("unknown")

        assertEquals(listOf("a"), cancelled)
        assertTrue(subscriptions.shopIds().isEmpty())
    }

    @Test
    fun `the module's end cancels every shop's subscription`() {
        val subscriptions = ShopSubscriptions()
        subscriptions.replace("a", subscription("a"))
        subscriptions.replace("b", subscription("b"))

        subscriptions.cancelAll()

        assertEquals(setOf("a", "b"), cancelled.toSet())
        assertTrue(subscriptions.shopIds().isEmpty())
    }
}
