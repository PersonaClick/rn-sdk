package com.personaclick.reactnative

import com.personalization.api.models.products.SortBy
import com.personalization.api.models.products.SortDirection
import com.personalization.api.models.profile.Gender
import com.personalization.api.models.tracking.TrackingSourceType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * What JavaScript hands the module — a map as `ReadableMap.toHashMap()` gives it, numbers as doubles —
 * becomes the native SDK's models with the contract's fields; a value of the wrong type, or a required one
 * missing, is `invalidArgument` before anything reaches the native SDK.
 */
class NamespaceArgsTest {

    private fun invalid(message: String, block: () -> Unit) {
        val error = assertThrows(BridgeArgumentException::class.java) { block() }
        assertEquals(message, error.message)
    }

    @Test
    fun `a source is its wire type and code`() {
        val source = NamespaceArgs.source(mapOf("type" to "instant_search", "code" to "shoes"))!!
        assertEquals(TrackingSourceType.INSTANT_SEARCH, source.type)
        assertEquals("shoes", source.code)
        assertNull(NamespaceArgs.source(null))
        invalid("Unknown source type: instantSearch") { NamespaceArgs.source(mapOf("type" to "instantSearch", "code" to "x")) }
        invalid("source.code is required") { NamespaceArgs.source(mapOf("type" to "dynamic")) }
    }

    @Test
    fun `slider and agent_search go as their wire values, for an event and for setSource alike`() {
        val slider = NamespaceArgs.source(mapOf("type" to "slider", "code" to "main_slider"))!!
        assertEquals("slider", slider.wireType)
        assertEquals("main_slider", slider.code)
        val agent = NamespaceArgs.sourceOf("agent_search", "42")
        assertEquals("agent_search", agent.wireType)
        assertEquals("42", agent.code)
        assertEquals(TrackingSourceType.WEB_PUSH_DIGEST, NamespaceArgs.sourceOf("web_push_digest", "d1").type)
        assertEquals("instant_search", NamespaceArgs.sourceOf("instant_search", "q").wireType)
        invalid("Unknown source type: agentSearch") { NamespaceArgs.sourceOf("agentSearch", "42") }
        invalid("Unknown source type: ") { NamespaceArgs.sourceOf("", "42") }
    }

    @Test
    fun `a tracking item counts 1 without a quantity and refuses a fractional one`() {
        val item = NamespaceArgs.trackingItem(mapOf("id" to "37", "price" to 100.5, "fashionSize" to "M"))
        assertEquals("37", item.id)
        assertEquals(1, item.quantity)
        assertEquals(100.5, item.price!!, 0.0)
        assertEquals("M", item.fashionSize)
        assertEquals(3, NamespaceArgs.trackingItem(mapOf("id" to "1", "quantity" to 3.0)).quantity)
        invalid("item.quantity must be a whole number") { NamespaceArgs.trackingItem(mapOf("id" to "1", "quantity" to 1.5)) }
        invalid("items[1].id must be a string") {
            NamespaceArgs.trackingItems(listOf(mapOf("id" to "1"), mapOf("id" to 2.0)))
        }
    }

    @Test
    fun `a purchase takes the contract's request with its items, attribution and free fields`() {
        val purchase = NamespaceArgs.purchase(
            mapOf(
                "orderId" to "o-1",
                "orderPrice" to 300.0,
                "items" to listOf(mapOf("id" to "37", "amount" to 2.0, "price" to 150.0, "lineId" to "l1")),
                "isTaxFree" to true,
                "promocode" to "SALE",
                "custom" to mapOf("gift" to "yes", "count" to 2.0),
                "recommendedBy" to mapOf("type" to "dynamic", "code" to "block"),
                "isGiftPackage" to true,
            ),
            NamespaceArgs.sourceOf("full_search", "shoes"),
        )
        val request = purchase.request
        assertEquals("o-1", request.orderId)
        assertEquals(300.0, request.orderPrice, 0.0)
        assertEquals("37", request.items.single().id)
        assertEquals(2, request.items.single().amount)
        assertEquals("l1", request.items.single().lineId)
        assertTrue(request.isTaxFree)
        assertTrue(request.isGiftPackage)
        assertEquals(mapOf("gift" to "yes", "count" to 2L), request.custom)
        assertEquals("dynamic", request.recommendedBy!!.type)
        assertEquals("block", request.recommendedBy!!.code)
        // The native SDK sends the request's own attribution, not the call's source.
        assertEquals("full_search", purchase.source!!.wireType)
        assertNull(request.deliveryType)
        invalid("request.items is required") { NamespaceArgs.purchase(mapOf("orderId" to "o", "orderPrice" to 1.0)) }
        invalid("request.items[0].price is required") {
            NamespaceArgs.purchase(mapOf("orderId" to "o", "orderPrice" to 1.0, "items" to listOf(mapOf("id" to "1", "amount" to 1.0))))
        }
    }

    @Test
    fun `a purchase's recommendedBy of slider or agent_search is its source, in place of the call's`() {
        fun purchase(recommendedBy: Map<String, Any?>?, source: String? = null) = NamespaceArgs.purchase(
            mapOf(
                "orderId" to "o-1",
                "orderPrice" to 100.0,
                "items" to listOf(mapOf("id" to "37", "amount" to 1.0, "price" to 100.0)),
                "recommendedBy" to recommendedBy,
            ),
            source?.let { NamespaceArgs.sourceOf(it, "call") },
        )

        val slider = purchase(mapOf("type" to "slider", "code" to "main_slider"), source = "dynamic")
        assertNull(slider.request.recommendedBy)
        assertEquals("slider", slider.source!!.wireType)
        assertEquals("main_slider", slider.source!!.code)
        // Without a code it goes with "", as on iOS.
        val agent = purchase(mapOf("type" to "agent_search"))
        assertEquals("agent_search", agent.source!!.wireType)
        assertEquals("", agent.source!!.code)
        // Without its own the purchase goes with the call's source; without either, with none.
        assertEquals("dynamic", purchase(null, source = "dynamic").source!!.wireType)
        assertNull(purchase(null).source)
        invalid("Unknown recommendedBy type: agentSearch") { purchase(mapOf("type" to "agentSearch", "code" to "1")) }
    }

    @Test
    fun `a listing request carries its lists, filters, sorting and pages`() {
        val request = NamespaceArgs.productsList(
            mapOf(
                "categoryIds" to listOf("10"),
                "brands" to listOf("acme"),
                "priceMin" to 100.0,
                "filters" to mapOf("color" to listOf("red", "blue")),
                "sortBy" to "sales_rate",
                "sortDir" to "asc",
                "limit" to 20.0,
                "page" to 2.0,
            ),
        )
        assertEquals(listOf("10"), request.categoryIds)
        assertEquals(listOf("acme"), request.brands)
        assertEquals(100.0, request.priceMin!!, 0.0)
        assertEquals(mapOf("color" to listOf("red", "blue")), request.filters)
        assertEquals(SortBy.SALES_RATE, request.sortBy)
        assertEquals(SortDirection.ASC, request.sortDir)
        assertEquals(20, request.limit)
        assertEquals(2, request.page)
        assertEquals(NamespaceArgs.productsList(null), NamespaceArgs.productsList(emptyMap()))
        invalid("request.sortDir must be asc or desc") { NamespaceArgs.productsList(mapOf("sortDir" to "up")) }
        invalid("request.filters.color[0] must be a string") { NamespaceArgs.productsList(mapOf("filters" to mapOf("color" to listOf(1.0)))) }
        invalid("request.brands must be an array") { NamespaceArgs.category(mapOf("brands" to "acme")) }
    }

    @Test
    fun `a recommendation request keeps the native defaults`() {
        val defaults = NamespaceArgs.recommendation(null)
        assertTrue(defaults.extended)
        assertFalse(defaults.withLocations)
        val request = NamespaceArgs.recommendation(mapOf("itemId" to "37", "limit" to 5.0, "extended" to false, "withLocations" to true))
        assertEquals("37", request.itemId)
        assertEquals(5, request.limit)
        assertFalse(request.extended)
        assertTrue(request.withLocations)
    }

    @Test
    fun `a full search request takes every field of the contract`() {
        val request = NamespaceArgs.searchFull(
            mapOf(
                "excludedBrands" to listOf("x"),
                "colors" to listOf("red"),
                "fashionSizes" to listOf("M"),
                "disableClarification" to true,
                "categoryLimit" to 3.0,
                "brandLimit" to 4.0,
                "sortBy" to "relevance",
            ),
        )
        assertEquals(listOf("x"), request.excludedBrands)
        assertEquals(listOf("red"), request.colors)
        assertEquals(listOf("M"), request.fashionSizes)
        assertTrue(request.disableClarification)
        assertEquals(3, request.categoryLimit)
        assertEquals(4, request.brandLimit)
        assertEquals(SortBy.RELEVANCE, request.sortBy)
    }

    @Test
    fun `a profile update takes the wire gender, kids, cars and free properties`() {
        val request = NamespaceArgs.profileUpdate(
            mapOf(
                "email" to "someone@example.com",
                "gender" to "f",
                "age" to 30.0,
                "birthday" to "",
                "kids" to listOf(mapOf("gender" to "m", "birthday" to "2020-01-02")),
                "cars" to listOf(mapOf("brand" to "Lada", "model" to "Niva")),
                "customProperties" to mapOf("tier" to "gold", "visits" to 3.0, "tags" to listOf("a", 1.5)),
            ),
        )
        assertEquals(Gender.FEMALE, request.gender)
        assertEquals(30, request.age)
        assertEquals("", request.birthday)
        assertEquals(Gender.MALE, request.kids!!.single().gender)
        assertEquals("Niva", request.cars!!.single().model)
        assertNull(request.cars!!.single().vds)
        assertEquals(mapOf("tier" to "gold", "visits" to 3L, "tags" to listOf("a", 1.5)), request.customProperties)
        invalid("request.gender must be m or f") { NamespaceArgs.profileUpdate(mapOf("gender" to "female")) }
        invalid("request.age must be a number") { NamespaceArgs.profileUpdate(mapOf("age" to "30")) }
        invalid("request.kids[0] must be an object") { NamespaceArgs.profileUpdate(mapOf("kids" to listOf("2020-01-02"))) }
    }

    @Test
    fun `a subscriptions update leaves out the channels not given`() {
        val request = NamespaceArgs.subscriptionsUpdate(mapOf("email" to "a@b.c", "emailBulk" to true, "walletChain" to false))
        assertEquals("a@b.c", request.email)
        assertEquals(true, request.emailBulk)
        assertEquals(false, request.walletChain)
        assertNull(request.smsBulk)
        invalid("request.smsBulk must be a boolean") { NamespaceArgs.subscriptionsUpdate(mapOf("smsBulk" to "yes")) }
        assertEquals("M", NamespaceArgs.backInStock(mapOf("fashionSize" to "M"))!!.fashionSize)
        assertNull(NamespaceArgs.backInStock(null))
    }

    @Test
    fun `numbers that must be whole and lists of strings`() {
        assertEquals(12, NamespaceArgs.wholeInt(12.0, "segmentId"))
        assertNull(NamespaceArgs.wholeInt(null, "limit"))
        assertEquals(9_000_000_000L, NamespaceArgs.wholeLong(9.0E9, "sessionId"))
        invalid("rate must be a whole number") { NamespaceArgs.wholeInt(7.5, "rate") }
        invalid("popupId must be a whole number") { NamespaceArgs.wholeInt(3.0E10, "popupId") }
        assertEquals(listOf("a", "b"), NamespaceArgs.stringList(listOf("a", "b"), "tags"))
        invalid("tags[1] must be a string") { NamespaceArgs.stringList(listOf("a", null), "tags") }
        assertEquals(Gender.MALE, NamespaceArgs.gender("m"))
        assertEquals(mapOf("n" to 1L, "f" to 1.5, "nested" to mapOf("k" to 2L)), NamespaceArgs.free(mapOf("n" to 1.0, "f" to 1.5, "nested" to mapOf("k" to 2.0))))
    }

    @Test
    fun `time and value of tracking custom take 32 bits, the range iOS takes them in too`() {
        assertEquals(Int.MAX_VALUE, NamespaceArgs.wholeInt(2_147_483_647.0, "time"))
        assertEquals(Int.MIN_VALUE, NamespaceArgs.wholeInt(-2_147_483_648.0, "value"))
        invalid("time must be a whole number") { NamespaceArgs.wholeInt(2_147_483_648.0, "time") }
        invalid("value must be a whole number") { NamespaceArgs.wholeInt(-2_147_483_649.0, "value") }
        invalid("value must be a whole number") { NamespaceArgs.wholeInt(1.5, "value") }
    }
}
