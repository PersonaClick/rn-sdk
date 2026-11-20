package com.personaclick.reactnative

import com.personalization.Params
import com.personalization.api.models.products.CategoryRequest
import com.personalization.api.models.products.ProductsListRequest
import com.personalization.api.models.products.SortBy
import com.personalization.api.models.products.SortDirection
import com.personalization.api.models.profile.Gender
import com.personalization.api.models.profile.ProfileCar
import com.personalization.api.models.profile.ProfileKid
import com.personalization.api.models.profile.ProfileUpdateRequest
import com.personalization.api.models.purchase.PurchaseItemRequest
import com.personalization.api.models.purchase.PurchaseTrackingRequest
import com.personalization.api.models.recommendations.RecommendationRequest
import com.personalization.api.models.search.SearchFullRequest
import com.personalization.api.models.subscriptions.BackInStockProperties
import com.personalization.api.models.subscriptions.SubscriptionsUpdateRequest
import com.personalization.api.models.tracking.TrackingItem
import com.personalization.api.models.tracking.TrackingSource
import com.personalization.api.models.tracking.TrackingSourceType
import com.personalization.core.SdkException
import org.json.JSONArray
import org.json.JSONObject

/** A value JavaScript handed the module has the wrong type, or a required one is missing: `invalidArgument`. */
internal class BridgeArgumentException(message: String) : IllegalArgumentException(message)

/**
 * The namespaces' arguments, from what JavaScript hands the module (a map as `ReadableMap.toHashMap()`
 * gives it: numbers as doubles, maps and arrays as `HashMap` and `ArrayList`) to the native SDK's models.
 * Request maps carry the contract's field names; an enumeration's value is its wire value. Only the type
 * of a value is checked here — the rest is the native SDK's. A key the model does not have is left out.
 */
internal object NamespaceArgs {

    // tracking

    /** `{ type, code }`, `type` the wire value (`instant_search`). */
    fun source(value: Map<String, Any?>?, name: String = "source"): TrackingSource? {
        value ?: return null
        val type = value.string("type", "$name.type", required = true)!!
        return sourceOf(type, value.string("code", "$name.code", required = true)!!)
    }

    /**
     * The source of the wire value [type] (`instant_search`), as the native SDK takes it — for the events'
     * `source`, a purchase's `recommendedBy` and `setSource`: [TrackingSource.fromWire]. `slider` and
     * `agent_search`, which [TrackingSourceType] gets only in the native SDK's major, are its bridge-only raw
     * sources and go as their wire values (its `wireType`). A type the contract does not have is
     * `invalidArgument`.
     */
    fun sourceOf(type: String, code: String): TrackingSource =
        try {
            TrackingSource.fromWire(type, code)
        } catch (e: SdkException) {
            throw BridgeArgumentException("Unknown source type: $type")
        }

    /** `{ id, quantity?, price?, fashionSize? }`. */
    fun trackingItem(value: Any?, name: String = "item"): TrackingItem {
        val map = value.asMap(name)
        return TrackingItem(
            id = map.string("id", "$name.id", required = true)!!,
            quantity = map.int("quantity", "$name.quantity") ?: 1,
            price = map.double("price", "$name.price"),
            fashionSize = map.string("fashionSize", "$name.fashionSize"),
        )
    }

    fun trackingItems(value: List<Any?>, name: String = "items"): List<TrackingItem> =
        value.mapIndexed { i, item -> trackingItem(item, "$name[$i]") }

    /** A purchase as the native SDK takes it: the request and the source it goes with. */
    class Purchase(val request: PurchaseTrackingRequest, val source: TrackingSource?)

    /**
     * `PurchaseTrackingRequest` of the contract, and the source the purchase goes with: the request's own
     * `recommendedBy` wins over the call's [source], as on iOS. One of a type [Params.RecommendedBy.TYPE] has
     * stays the request's; `slider`, `agent_search` and `web_push_digest`, which it has not, go as the
     * purchase's source ([sourceOf]), which the native SDK puts in the request's place.
     */
    fun purchase(map: Map<String, Any?>, source: TrackingSource? = null): Purchase {
        val attribution = map.map("recommendedBy", "request.recommendedBy")?.let(::recommendedBy)
        return Purchase(purchaseRequest(map, attribution?.recommendedBy), attribution?.source ?: source)
    }

    private fun purchaseRequest(map: Map<String, Any?>, recommendedBy: Params.RecommendedBy?) = PurchaseTrackingRequest(
        orderId = map.string("orderId", "request.orderId", required = true)!!,
        orderPrice = map.double("orderPrice", "request.orderPrice", required = true)!!,
        items = map.list("items", "request.items", required = true)!!.mapIndexed { i, item -> purchaseItem(item, "request.items[$i]") },
        deliveryType = map.string("deliveryType", "request.deliveryType"),
        deliveryAddress = map.string("deliveryAddress", "request.deliveryAddress"),
        paymentType = map.string("paymentType", "request.paymentType"),
        isTaxFree = map.boolean("isTaxFree", "request.isTaxFree") ?: false,
        promocode = map.string("promocode", "request.promocode"),
        orderCash = map.double("orderCash", "request.orderCash"),
        orderBonuses = map.double("orderBonuses", "request.orderBonuses"),
        orderDelivery = map.double("orderDelivery", "request.orderDelivery"),
        orderDiscount = map.double("orderDiscount", "request.orderDiscount"),
        channel = map.string("channel", "request.channel"),
        custom = map.freeMap("custom", "request.custom"),
        recommendedBy = recommendedBy,
        recommendedSource = map.freeMap("recommendedSource", "request.recommendedSource")?.let(::jsonObject),
        stream = map.string("stream", "request.stream"),
        segment = map.string("segment", "request.segment"),
        isGiftPackage = map.boolean("isGiftPackage", "request.isGiftPackage") ?: false,
    )

    private fun purchaseItem(value: Any?, name: String): PurchaseItemRequest {
        val map = value.asMap(name)
        return PurchaseItemRequest(
            id = map.string("id", "$name.id", required = true)!!,
            amount = map.int("amount", "$name.amount", required = true)!!,
            price = map.double("price", "$name.price", required = true)!!,
            quantity = map.int("quantity", "$name.quantity"),
            lineId = map.string("lineId", "$name.lineId"),
            fashionSize = map.string("fashionSize", "$name.fashionSize"),
        )
    }

    /** A purchase's own attribution: the request's [recommendedBy], or else its [source]. */
    private class Attribution(val recommendedBy: Params.RecommendedBy?, val source: TrackingSource?)

    /**
     * `{ type, code? }` of a purchase; `type` the wire value. A type [Params.RecommendedBy.TYPE] has not is the
     * purchase's source, with the code `""` when there is none — as iOS sends it.
     */
    private fun recommendedBy(map: Map<String, Any?>): Attribution {
        val type = map.string("type", "request.recommendedBy.type", required = true)!!
        val code = map.string("code", "request.recommendedBy.code")
        Params.RecommendedBy.TYPE.entries.firstOrNull { it.value == type }?.let {
            return Attribution(Params.RecommendedBy(it, code), null)
        }
        val source = try {
            sourceOf(type, code.orEmpty())
        } catch (e: BridgeArgumentException) {
            throw BridgeArgumentException("Unknown recommendedBy type: $type")
        }
        return Attribution(null, source)
    }

    // products, search, recommendations

    fun productsList(map: Map<String, Any?>?): ProductsListRequest {
        map ?: return ProductsListRequest()
        return ProductsListRequest(
            categoryIds = map.strings("categoryIds", "request.categoryIds"),
            brands = map.strings("brands", "request.brands"),
            merchants = map.strings("merchants", "request.merchants"),
            locations = map.strings("locations", "request.locations"),
            priceMin = map.double("priceMin", "request.priceMin"),
            priceMax = map.double("priceMax", "request.priceMax"),
            filters = map.filters("filters", "request.filters"),
            sortBy = map.string("sortBy", "request.sortBy")?.let(::SortBy),
            sortDir = map.sortDirection("sortDir", "request.sortDir"),
            limit = map.int("limit", "request.limit"),
            page = map.int("page", "request.page"),
        )
    }

    fun category(map: Map<String, Any?>?): CategoryRequest {
        map ?: return CategoryRequest()
        return CategoryRequest(
            brands = map.strings("brands", "request.brands"),
            locations = map.strings("locations", "request.locations"),
            filters = map.filters("filters", "request.filters"),
            priceMin = map.double("priceMin", "request.priceMin"),
            priceMax = map.double("priceMax", "request.priceMax"),
            sortBy = map.string("sortBy", "request.sortBy")?.let(::SortBy),
            sortDir = map.sortDirection("sortDir", "request.sortDir"),
            limit = map.int("limit", "request.limit"),
            page = map.int("page", "request.page"),
        )
    }

    fun recommendation(map: Map<String, Any?>?): RecommendationRequest {
        map ?: return RecommendationRequest()
        return RecommendationRequest(
            itemId = map.string("itemId", "request.itemId"),
            categoryId = map.string("categoryId", "request.categoryId"),
            searchQuery = map.string("searchQuery", "request.searchQuery"),
            excludedItemIds = map.strings("excludedItemIds", "request.excludedItemIds"),
            brands = map.strings("brands", "request.brands"),
            locations = map.strings("locations", "request.locations"),
            limit = map.int("limit", "request.limit"),
            extended = map.boolean("extended", "request.extended") ?: true,
            withLocations = map.boolean("withLocations", "request.withLocations") ?: false,
        )
    }

    fun searchFull(map: Map<String, Any?>?): SearchFullRequest {
        map ?: return SearchFullRequest()
        return SearchFullRequest(
            categoryIds = map.strings("categoryIds", "request.categoryIds"),
            brands = map.strings("brands", "request.brands"),
            excludedBrands = map.strings("excludedBrands", "request.excludedBrands"),
            merchants = map.strings("merchants", "request.merchants"),
            excludedMerchants = map.strings("excludedMerchants", "request.excludedMerchants"),
            locations = map.strings("locations", "request.locations"),
            priceMin = map.double("priceMin", "request.priceMin"),
            priceMax = map.double("priceMax", "request.priceMax"),
            colors = map.strings("colors", "request.colors"),
            fashionSizes = map.strings("fashionSizes", "request.fashionSizes"),
            excludedItemIds = map.strings("excludedItemIds", "request.excludedItemIds"),
            filters = map.filters("filters", "request.filters"),
            sortBy = map.string("sortBy", "request.sortBy")?.let(::SortBy),
            sortDir = map.sortDirection("sortDir", "request.sortDir"),
            disableClarification = map.boolean("disableClarification", "request.disableClarification") ?: false,
            categoryLimit = map.int("categoryLimit", "request.categoryLimit"),
            brandLimit = map.int("brandLimit", "request.brandLimit"),
            limit = map.int("limit", "request.limit"),
            page = map.int("page", "request.page"),
        )
    }

    // profile, subscriptions

    fun profileUpdate(map: Map<String, Any?>): ProfileUpdateRequest = ProfileUpdateRequest(
        email = map.string("email", "request.email"),
        phone = map.string("phone", "request.phone"),
        externalId = map.string("externalId", "request.externalId"),
        loyaltyId = map.string("loyaltyId", "request.loyaltyId"),
        telegramId = map.string("telegramId", "request.telegramId"),
        fbId = map.string("fbId", "request.fbId"),
        vkId = map.string("vkId", "request.vkId"),
        firstName = map.string("firstName", "request.firstName"),
        lastName = map.string("lastName", "request.lastName"),
        gender = map.string("gender", "request.gender")?.let { gender(it, "request.gender") },
        birthday = map.string("birthday", "request.birthday"),
        age = map.int("age", "request.age"),
        location = map.string("location", "request.location"),
        kids = map.list("kids", "request.kids")?.mapIndexed { i, kid ->
            val name = "request.kids[$i]"
            val kidMap = kid.asMap(name)
            ProfileKid(
                gender = kidMap.string("gender", "$name.gender")?.let { gender(it, "$name.gender") },
                birthday = kidMap.string("birthday", "$name.birthday"),
            )
        },
        cars = map.list("cars", "request.cars")?.mapIndexed { i, car ->
            val name = "request.cars[$i]"
            val carMap = car.asMap(name)
            ProfileCar(
                brand = carMap.string("brand", "$name.brand"),
                model = carMap.string("model", "$name.model"),
                vds = carMap.string("vds", "$name.vds"),
            )
        },
        customProperties = map.freeMap("customProperties", "request.customProperties"),
    )

    fun subscriptionsUpdate(map: Map<String, Any?>): SubscriptionsUpdateRequest {
        fun flag(key: String) = map.boolean(key, "request.$key")
        return SubscriptionsUpdateRequest(
            email = map.string("email", "request.email"),
            phone = map.string("phone", "request.phone"),
            externalId = map.string("externalId", "request.externalId"),
            loyaltyId = map.string("loyaltyId", "request.loyaltyId"),
            telegramId = map.string("telegramId", "request.telegramId"),
            emailBulk = flag("emailBulk"),
            emailChain = flag("emailChain"),
            emailTransactional = flag("emailTransactional"),
            smsBulk = flag("smsBulk"),
            smsChain = flag("smsChain"),
            smsTransactional = flag("smsTransactional"),
            webPushBulk = flag("webPushBulk"),
            webPushChain = flag("webPushChain"),
            webPushTransactional = flag("webPushTransactional"),
            mobilePushBulk = flag("mobilePushBulk"),
            mobilePushChain = flag("mobilePushChain"),
            mobilePushTransactional = flag("mobilePushTransactional"),
            telegramBulk = flag("telegramBulk"),
            telegramChain = flag("telegramChain"),
            telegramTransactional = flag("telegramTransactional"),
            whatsappBulk = flag("whatsappBulk"),
            whatsappChain = flag("whatsappChain"),
            whatsappTransactional = flag("whatsappTransactional"),
            maxBulk = flag("maxBulk"),
            maxChain = flag("maxChain"),
            maxTransactional = flag("maxTransactional"),
            walletBulk = flag("walletBulk"),
            walletChain = flag("walletChain"),
            walletTransactional = flag("walletTransactional"),
        )
    }

    fun backInStock(map: Map<String, Any?>?): BackInStockProperties? {
        map ?: return null
        return BackInStockProperties(
            fashionSize = map.string("fashionSize", "properties.fashionSize"),
            fashionColor = map.string("fashionColor", "properties.fashionColor"),
            barcode = map.string("barcode", "properties.barcode"),
        )
    }

    // single values

    /** `m` or `f`, the wire values of `Gender`. */
    fun gender(value: String, name: String = "gender"): Gender =
        Gender.entries.firstOrNull { it.value == value } ?: throw BridgeArgumentException("$name must be m or f")

    /** A list of strings, each a string. */
    fun stringList(value: List<Any?>?, name: String): List<String>? = value?.mapIndexed { i, item ->
        item as? String ?: throw BridgeArgumentException("$name[$i] must be a string")
    }

    /** A JavaScript number that must be a whole Int. */
    fun wholeInt(value: Double?, name: String): Int? = value?.let {
        if (it % 1.0 != 0.0 || it < Int.MIN_VALUE || it > Int.MAX_VALUE) throw BridgeArgumentException("$name must be a whole number")
        it.toInt()
    }

    /** A JavaScript number that must be a whole Long. */
    fun wholeLong(value: Double?, name: String): Long? = value?.let {
        if (it % 1.0 != 0.0 || it < -9.0E15 || it > 9.0E15) throw BridgeArgumentException("$name must be a whole number")
        it.toLong()
    }

    /** A free map (`customFields`): JSON values, a whole number as a Long. */
    fun free(map: Map<String, Any?>?): Map<String, Any?>? = map?.mapValues { (_, value) -> freeValue(value) }

    private fun freeValue(value: Any?): Any? = when (value) {
        is Double -> if (value % 1.0 == 0.0 && value in -9.0E15..9.0E15) value.toLong() else value
        is Map<*, *> -> value.entries.associate { (key, item) -> key.toString() to freeValue(item) }
        is List<*> -> value.map(::freeValue)
        else -> value
    }

    private fun jsonObject(map: Map<String, Any?>): JSONObject {
        val json = JSONObject()
        map.forEach { (key, value) -> json.put(key, jsonValue(value)) }
        return json
    }

    private fun jsonValue(value: Any?): Any = when (value) {
        null -> JSONObject.NULL
        is Map<*, *> -> JSONObject().also { json -> value.forEach { (key, item) -> json.put(key.toString(), jsonValue(item)) } }
        is List<*> -> JSONArray().also { json -> value.forEach { json.put(jsonValue(it)) } }
        else -> value
    }

    // the map's values

    @Suppress("UNCHECKED_CAST")
    private fun Any?.asMap(name: String): Map<String, Any?> =
        this as? Map<String, Any?> ?: throw BridgeArgumentException("$name must be an object")

    private fun Map<String, Any?>.present(key: String, name: String, required: Boolean): Any? {
        val value = this[key]
        if (value == null && required) throw BridgeArgumentException("$name is required")
        return value
    }

    private fun Map<String, Any?>.string(key: String, name: String, required: Boolean = false): String? =
        present(key, name, required)?.let { it as? String ?: throw BridgeArgumentException("$name must be a string") }

    private fun Map<String, Any?>.boolean(key: String, name: String): Boolean? =
        present(key, name, false)?.let { it as? Boolean ?: throw BridgeArgumentException("$name must be a boolean") }

    private fun Map<String, Any?>.number(key: String, name: String, required: Boolean): Double? =
        present(key, name, required)?.let { (it as? Number)?.toDouble() ?: throw BridgeArgumentException("$name must be a number") }

    private fun Map<String, Any?>.double(key: String, name: String, required: Boolean = false): Double? = number(key, name, required)

    private fun Map<String, Any?>.int(key: String, name: String, required: Boolean = false): Int? = wholeInt(number(key, name, required), name)

    private fun Map<String, Any?>.list(key: String, name: String, required: Boolean = false): List<Any?>? =
        present(key, name, required)?.let { it as? List<Any?> ?: throw BridgeArgumentException("$name must be an array") }

    private fun Map<String, Any?>.strings(key: String, name: String): List<String>? = stringList(list(key, name), name)

    @Suppress("UNCHECKED_CAST")
    private fun Map<String, Any?>.map(key: String, name: String): Map<String, Any?>? =
        present(key, name, false)?.let { it as? Map<String, Any?> ?: throw BridgeArgumentException("$name must be an object") }

    private fun Map<String, Any?>.freeMap(key: String, name: String): Map<String, Any?>? = free(map(key, name))

    /** Parameter → its values, each a string. */
    private fun Map<String, Any?>.filters(key: String, name: String): Map<String, List<String>>? =
        map(key, name)?.mapValues { (filter, values) ->
            val list = values as? List<Any?> ?: throw BridgeArgumentException("$name.$filter must be an array")
            stringList(list, "$name.$filter")!!
        }

    private fun Map<String, Any?>.sortDirection(key: String, name: String): SortDirection? =
        string(key, name)?.let { value ->
            SortDirection.entries.firstOrNull { it.value == value } ?: throw BridgeArgumentException("$name must be asc or desc")
        }
}
