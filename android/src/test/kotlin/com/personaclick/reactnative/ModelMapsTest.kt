package com.personaclick.reactnative

import com.personalization.api.models.loyalty.LoyaltyLevel
import com.personalization.api.models.loyalty.LoyaltyPromotion
import com.personalization.api.models.loyalty.LoyaltyRewardType
import com.personalization.api.models.loyalty.LoyaltyStatus
import com.personalization.api.models.predict.PurchaseProbability
import com.personalization.api.models.products.PriceInterval
import com.personalization.api.models.products.Product
import com.personalization.api.models.products.ProductCategory
import com.personalization.api.models.products.ProductsListResponse
import com.personalization.api.models.products.SearchFilter
import com.personalization.api.models.profile.Gender
import com.personalization.api.models.profile.Profile
import com.personalization.api.models.recommendations.RecommendationResponse
import com.personalization.api.models.search.AgentMessage
import com.personalization.api.models.search.AgentMessageRole
import com.personalization.api.models.search.AgentProduct
import com.personalization.api.models.search.AgentResponse
import com.personalization.api.models.search.AgentSession
import com.personalization.api.models.segments.Segment
import com.personalization.api.models.sliders.Slider
import com.personalization.api.models.sliders.SliderBanner
import com.personalization.api.models.stories.StoriesBlock
import com.personalization.api.models.stories.Story
import com.personalization.api.models.stories.StoryButtonElement
import com.personalization.api.models.stories.StoryProductElement
import com.personalization.api.models.stories.StorySlide
import com.personalization.api.models.stories.StorySlideType
import com.personalization.api.models.stories.StoryTextBlockElement
import com.personalization.api.models.subscriptions.SubscriptionStatus
import com.personalization.api.responses.cart.CartItem
import com.personalization.api.responses.orders.Order
import com.personalization.api.responses.orders.OrderItem
import com.personalization.api.responses.products.counters.ProductCounter
import com.personalization.api.responses.products.counters.ProductCountersResponse
import com.personalization.api.responses.products.product.ProductParam
import com.personalization.api.responses.reviews.ClientReview
import com.personalization.api.responses.reviews.ProductRatingSummary
import com.personalization.api.responses.reviews.ProductReview
import com.personalization.api.responses.reviews.ProductReviewsResponse
import com.personalization.api.responses.reviews.ReviewState
import com.personalization.api.responses.search.Brand
import com.personalization.api.responses.search.PriceRange
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The native SDK's models as JavaScript gets them: the contract's field names, every field there and null
 * when the model has none, the contract's names for an enumeration's values.
 */
class ModelMapsTest {

    private val product = Product(
        id = "37",
        name = "Shoes",
        url = "https://shop/37",
        price = 1999.0,
        currency = "RUB",
        oldPrice = 2499.0,
        isNew = true,
        categories = listOf(ProductCategory(id = "10", name = "Footwear", level = 1)),
        params = listOf(ProductParam("color", listOf("red"))),
        resizedImages = mapOf("120" to "https://img/120"),
    )

    @Test
    fun `a product has every field of the contract, null for the ones it lacks`() {
        val map = ModelMaps.product(product)!!
        assertEquals(PRODUCT_FIELDS, map.keys.toList())
        assertEquals("37", map["id"])
        assertEquals(1999.0, map["price"])
        assertEquals(2499.0, map["oldPrice"])
        assertEquals(true, map["isNew"])
        assertNull(map["brand"])
        assertNull(map["discountPercent"])
        assertEquals(mapOf("120" to "https://img/120"), map["resizedImages"])
        @Suppress("UNCHECKED_CAST")
        val category = (map["categories"] as List<Map<String, Any?>>).single()
        assertEquals(listOf("id", "name", "url", "parentId", "level", "count", "alias"), category.keys.toList())
        assertEquals(1, category["level"])
        assertEquals(listOf(mapOf("key" to "color", "values" to listOf("red"))), map["params"])
        assertNull(ModelMaps.product(null))
    }

    @Test
    fun `a listing keeps its facets, prices and brands`() {
        val map = ModelMaps.productsList(
            ProductsListResponse(
                productsTotal = 1,
                products = listOf(product),
                brands = listOf(Brand(count = 3, name = "Acme")),
                filters = mapOf("color" to SearchFilter(count = 2, values = mapOf("red" to 2))),
                priceRange = PriceRange(max = 100.0, min = 10.0),
                priceRanges = listOf(PriceInterval(from = 0.0, to = 50.0, count = 1)),
            ),
        )
        assertEquals(
            listOf("productsTotal", "products", "categories", "brands", "locations", "filters", "industrialFilters", "priceRange", "priceRanges", "priceMedian"),
            map.keys.toList(),
        )
        assertEquals(listOf(mapOf("name" to "Acme", "count" to 3)), map["brands"])
        assertEquals(mapOf("color" to mapOf("count" to 2, "priority" to null, "values" to mapOf("red" to 2), "min" to null, "max" to null)), map["filters"])
        assertEquals(mapOf("min" to 10.0, "max" to 100.0), map["priceRange"])
        assertEquals(listOf(mapOf("from" to 0.0, "to" to 50.0, "count" to 1)), map["priceRanges"])
        assertNull(map["categories"])
    }

    @Test
    fun `counters, the cart and a recommendation block`() {
        val counters = ModelMaps.counters(ProductCountersResponse(daily = ProductCounter(view = 5, cart = 1, purchase = 0)))
        assertEquals(mapOf("view" to 5, "cart" to 1, "purchase" to 0), counters["daily"])
        assertNull(counters["now"])
        assertEquals(listOf(mapOf("id" to "37", "quantity" to 2)), ModelMaps.cartItems(listOf(CartItem("37", 2))))
        val block = ModelMaps.recommendation(RecommendationResponse(id = 5, title = "Similar", products = listOf(product), itemIds = listOf("37")))
        assertEquals(listOf("id", "title", "link", "products", "itemIds"), block.keys.toList())
        assertEquals(listOf("37"), block["itemIds"])
    }

    @Test
    fun `a profile's gender is the contract's name`() {
        val map = ModelMaps.profile(Profile(id = "1", gender = Gender.FEMALE, computedGender = Gender.MALE, customProperties = mapOf("tier" to "gold")))
        assertEquals(listOf("id", "hasEmail", "emailRegisteredAt", "gender", "computedGender", "boughtSomething", "customProperties"), map.keys.toList())
        assertEquals("female", map["gender"])
        assertEquals("male", map["computedGender"])
        assertEquals(mapOf("tier" to "gold"), map["customProperties"])
    }

    @Test
    fun `a profile without custom properties has an empty map, as the contract has it and iOS gives`() {
        assertEquals(emptyMap<String, Any?>(), ModelMaps.profile(Profile(id = "1"))["customProperties"])
    }

    @Test
    fun `an order an answer left half empty still converts`() {
        val order = Order(internalId = 7, id = "o-1", value = "100.0", items = listOf(OrderItem(amount = 1, price = "100.0")))
        val map = ModelMaps.order(order)!!
        assertEquals(7L, map["internalId"])
        @Suppress("UNCHECKED_CAST")
        val item = (map["items"] as List<Map<String, Any?>>).single()
        assertEquals(listOf("amount", "price", "status", "originalPrice", "barcode", "lineId", "cancelReason", "item"), item.keys.toList())
        assertNull(item["item"])
        // Gson leaves a field the answer lacks null whatever its Kotlin type: here the order's non-null list.
        val gsonOrder = Order(id = "o-2").also { Order::class.java.getDeclaredField("items").apply { isAccessible = true }.set(it, null) }
        assertNull(ModelMaps.order(gsonOrder)!!["items"])
    }

    @Test
    fun `stories carry their elements with their kind`() {
        val block = StoriesBlock(
            id = "block",
            stories = listOf(
                Story(
                    id = "1", name = "Sale", avatar = "a.png",
                    slides = listOf(
                        StorySlide(
                            id = "2", type = StorySlideType.VIDEO, background = "b.mp4", backgroundColor = "", preview = "", duration = 10,
                            elements = listOf(
                                StoryButtonElement("Go", "l", "la", "li", "#000", "#fff", true),
                                StoryProductElement("Item", null),
                                StoryTextBlockElement("Hi", 14.0, "serif", false, false, "left", "#000", "", 0.5, 0.0, 10.0, null),
                            ),
                        ),
                    ),
                ),
            ),
        )
        val map = ModelMaps.storiesBlock(block)
        @Suppress("UNCHECKED_CAST")
        val slide = ((map["stories"] as List<Map<String, Any?>>).single()["slides"] as List<Map<String, Any?>>).single()
        assertEquals("video", slide["type"])
        @Suppress("UNCHECKED_CAST")
        val elements = slide["elements"] as List<Map<String, Any?>>
        assertEquals(listOf("button", "product", "textBlock"), elements.map { it["type"] })
        assertEquals(true, elements[0]["textBold"])
        assertNull(elements[1]["item"])
        assertEquals(0.5, elements[2]["backgroundOpacity"])
        assertEquals("image", ModelMaps.slideType(StorySlideType.IMAGE))
        assertEquals("product", ModelMaps.slideType(StorySlideType.PRODUCT))
    }

    @Test
    fun `the agent's answer keeps the role as the server sent it`() {
        val message = AgentMessage(id = 3, role = AgentMessageRole.ASSISTANT, content = "Here")
        val map = ModelMaps.agent(AgentResponse(session = AgentSession(id = 9_000_000_000L), message = message))
        @Suppress("UNCHECKED_CAST")
        assertEquals("assistant", (map["message"] as Map<String, Any?>)["role"])
        @Suppress("UNCHECKED_CAST")
        assertEquals(9_000_000_000L, (map["session"] as Map<String, Any?>)["id"])
    }

    @Test
    fun `an agent message without its id is kept with a null id, a product without a reason has an empty one`() {
        val message = AgentMessage(id = null, role = AgentMessageRole.ASSISTANT, products = listOf(AgentProduct(id = "37")))
        val map = ModelMaps.agent(AgentResponse(session = AgentSession(id = 9), message = message))
        @Suppress("UNCHECKED_CAST")
        val sent = map["message"] as Map<String, Any?>
        assertNull(sent["id"])
        @Suppress("UNCHECKED_CAST")
        assertEquals("", (sent["products"] as List<Map<String, Any?>>).single()["reason"])
    }

    @Test
    fun `a segment without a type has an empty one`() {
        assertEquals(listOf(mapOf("id" to 3, "type" to ""), mapOf("id" to 4, "type" to "rfm")), ModelMaps.segments(listOf(Segment(3), Segment(4, "rfm"))))
    }

    @Test
    fun `loyalty, reviews, sliders, predict and subscriptions`() {
        assertEquals(mapOf("isMember" to true, "level" to mapOf("code" to "gold", "name" to null, "expirationDate" to null)), ModelMaps.loyaltyStatus(LoyaltyStatus(true, LoyaltyLevel("gold", null, null))))
        val promotion = ModelMaps.loyaltyPromotions(listOf(LoyaltyPromotion(1, "P", null, null, null, null, null, null, LoyaltyRewardType.BONUSES_EARN)))!!.single()!!
        assertEquals("bonusesEarn", promotion["rewardType"])
        val reviews = ModelMaps.productReviews(
            ProductReviewsResponse(ProductRatingSummary(count = 2, averageRating = 4.5, ratings = mapOf(5 to 1, 4 to 1)), listOf(ProductReview(1, 5, createdAt = "2026-11-18"))),
        )
        @Suppress("UNCHECKED_CAST")
        assertEquals(mapOf("5" to 1, "4" to 1), (reviews["summary"] as Map<String, Any?>)["ratings"])
        assertEquals("published", ModelMaps.clientReviews(listOf(ClientReview(1, "37", "o-1", 5, state = ReviewState.PUBLISHED, createdAt = "now")))!!.single()!!["state"])
        val slider = ModelMaps.slider(Slider("main", 320, 100, listOf(SliderBanner("7", "main", null, "https://u", null, null, null))))
        @Suppress("UNCHECKED_CAST")
        assertEquals(listOf("id", "code", "imageUrl", "url", "deeplinkIos", "deeplinkAndroid", "html"), (slider["banners"] as List<Map<String, Any?>>).single().keys.toList())
        assertEquals(mapOf("probability" to 0.4, "clientId" to null), ModelMaps.probability(PurchaseProbability(0.4, null)))
        val status = ModelMaps.subscriptionStatus(SubscriptionStatus(exists = true, emailBulk = true))
        assertEquals(32, status.size)
        assertEquals(true, status["emailBulk"])
        assertEquals(false, status["walletTransactional"])
    }

    private companion object {
        val PRODUCT_FIELDS = listOf(
            "id", "groupId", "name", "brand", "model", "description", "barcode", "url", "deeplinkAndroid", "deeplinkIos",
            "imageUrl", "picture", "resizedImages", "price", "priceFormatted", "priceFull", "priceFullFormatted", "oldPrice",
            "oldPriceFormatted", "oldPriceFull", "oldPriceFullFormatted", "currency", "discountPercent", "discountFormatted",
            "salesRate", "relativeSalesRate", "rating", "isNew", "stockQuantity", "categoryIds", "categories", "params", "locationIds",
        )
    }
}
