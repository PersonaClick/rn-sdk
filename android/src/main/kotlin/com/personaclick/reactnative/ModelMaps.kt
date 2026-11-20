package com.personaclick.reactnative

import com.personalization.api.models.collections.CollectionResponse
import com.personalization.api.models.loyalty.LoyaltyLevel
import com.personalization.api.models.loyalty.LoyaltyMember
import com.personalization.api.models.loyalty.LoyaltyPromotion
import com.personalization.api.models.loyalty.LoyaltyRewardType
import com.personalization.api.models.loyalty.LoyaltyStatus
import com.personalization.api.models.predict.PurchaseProbability
import com.personalization.api.models.products.CategoryResponse
import com.personalization.api.models.products.PriceInterval
import com.personalization.api.models.products.Product
import com.personalization.api.models.products.ProductCategory
import com.personalization.api.models.products.ProductsListResponse
import com.personalization.api.models.products.SearchFilter
import com.personalization.api.models.profile.Gender
import com.personalization.api.models.profile.Profile
import com.personalization.api.models.recommendations.RecommendationResponse
import com.personalization.api.models.search.AgentDialogResponse
import com.personalization.api.models.search.AgentMessage
import com.personalization.api.models.search.AgentProduct
import com.personalization.api.models.search.AgentResponse
import com.personalization.api.models.search.AgentSession
import com.personalization.api.models.search.Query
import com.personalization.api.models.search.SearchBlankResponse
import com.personalization.api.models.search.SearchFullResponse
import com.personalization.api.models.search.SearchInstantResponse
import com.personalization.api.models.search.SearchRedirect
import com.personalization.api.models.segments.Segment
import com.personalization.api.models.sliders.Slider
import com.personalization.api.models.sliders.SliderBanner
import com.personalization.api.models.stories.StoriesBlock
import com.personalization.api.models.stories.Story
import com.personalization.api.models.stories.StoryButtonElement
import com.personalization.api.models.stories.StoryElement
import com.personalization.api.models.stories.StoryProduct
import com.personalization.api.models.stories.StoryProductElement
import com.personalization.api.models.stories.StoryProductsElement
import com.personalization.api.models.stories.StorySlide
import com.personalization.api.models.stories.StorySlideType
import com.personalization.api.models.stories.StoryTextBlockElement
import com.personalization.api.models.subscriptions.SubscriptionStatus
import com.personalization.api.responses.cart.CartItem
import com.personalization.api.responses.notifications.GetAllNotificationsResponse
import com.personalization.api.responses.notifications.Message
import com.personalization.api.responses.notifications.Statistics
import com.personalization.api.responses.orders.Order
import com.personalization.api.responses.orders.OrderItem
import com.personalization.api.responses.product.Category
import com.personalization.api.responses.product.ImageUrlResized
import com.personalization.api.responses.products.counters.ProductCounter
import com.personalization.api.responses.products.counters.ProductCounterTriggers
import com.personalization.api.responses.products.counters.ProductCountersResponse
import com.personalization.api.responses.products.product.ProductParam
import com.personalization.api.responses.reviews.CesCampaign
import com.personalization.api.responses.reviews.ClientReview
import com.personalization.api.responses.reviews.CsatCampaign
import com.personalization.api.responses.reviews.NpsCategory
import com.personalization.api.responses.reviews.PollChannel
import com.personalization.api.responses.reviews.PollReview
import com.personalization.api.responses.reviews.ProductRatingSummary
import com.personalization.api.responses.reviews.ProductReview
import com.personalization.api.responses.reviews.ProductReviewsResponse
import com.personalization.api.responses.reviews.ReviewState
import com.personalization.api.responses.search.Brand
import com.personalization.api.responses.search.ColorFilter
import com.personalization.api.responses.search.IndustrialFilters
import com.personalization.api.responses.search.Location
import com.personalization.api.responses.search.PopularItem
import com.personalization.api.responses.search.PriceRange
import com.personalization.api.responses.search.SizeFilter
import com.personalization.api.responses.product.Product as OrderProduct

/** A model as JavaScript gets it: the contract's field names; every field there, null when absent. */
internal typealias JsMap = Map<String, Any?>

/**
 * The native SDK's models as maps for JavaScript, with the contract's field names: every field of the
 * model is there, null when the model has none; an enumeration's value is the contract's name. Several
 * models come from Gson, which leaves a non-null field null when the answer lacks it: every parameter
 * and list here takes null.
 */
internal object ModelMaps {

    // products

    fun product(p: Product?): JsMap? = p?.let {
        linkedMapOf(
            "id" to it.id,
            "groupId" to it.groupId,
            "name" to it.name,
            "brand" to it.brand,
            "model" to it.model,
            "description" to it.description,
            "barcode" to it.barcode,
            "url" to it.url,
            "deeplinkAndroid" to it.deeplinkAndroid,
            "deeplinkIos" to it.deeplinkIos,
            "imageUrl" to it.imageUrl,
            "picture" to it.picture,
            "resizedImages" to it.resizedImages,
            "price" to it.price,
            "priceFormatted" to it.priceFormatted,
            "priceFull" to it.priceFull,
            "priceFullFormatted" to it.priceFullFormatted,
            "oldPrice" to it.oldPrice,
            "oldPriceFormatted" to it.oldPriceFormatted,
            "oldPriceFull" to it.oldPriceFull,
            "oldPriceFullFormatted" to it.oldPriceFullFormatted,
            "currency" to it.currency,
            "discountPercent" to it.discountPercent,
            "discountFormatted" to it.discountFormatted,
            "salesRate" to it.salesRate,
            "relativeSalesRate" to it.relativeSalesRate,
            "rating" to it.rating,
            "isNew" to it.isNew,
            "stockQuantity" to it.stockQuantity,
            "categoryIds" to it.categoryIds,
            "categories" to it.categories.each(::productCategory),
            "params" to it.params.each(::productParam),
            "locationIds" to it.locationIds,
        )
    }

    fun products(list: List<Product>?): List<JsMap?>? = list.each(::product)

    fun productCategory(c: ProductCategory?): JsMap? = c?.let {
        linkedMapOf(
            "id" to it.id,
            "name" to it.name,
            "url" to it.url,
            "parentId" to it.parentId,
            "level" to it.level,
            "count" to it.count,
            "alias" to it.alias,
        )
    }

    fun productParam(p: ProductParam?): JsMap? = p?.let { linkedMapOf("key" to it.key, "values" to it.values) }

    fun brand(b: Brand?): JsMap? = b?.let { linkedMapOf("name" to it.name, "count" to it.count) }

    fun location(l: Location?): JsMap? = l?.let { linkedMapOf("id" to it.id, "name" to it.name, "type" to it.type) }

    fun searchFilter(f: SearchFilter?): JsMap? = f?.let {
        linkedMapOf("count" to it.count, "priority" to it.priority, "values" to it.values, "min" to it.min, "max" to it.max)
    }

    fun industrialFilters(f: IndustrialFilters?): JsMap? = f?.let {
        linkedMapOf("colors" to it.colors.each(::colorFilter), "fashionSizes" to it.fashionSizes.each(::sizeFilter))
    }

    private fun colorFilter(c: ColorFilter?): JsMap? = c?.let { linkedMapOf("color" to it.color, "count" to it.count) }

    private fun sizeFilter(s: SizeFilter?): JsMap? = s?.let { linkedMapOf("size" to it.size, "count" to it.count) }

    fun priceRange(r: PriceRange?): JsMap? = r?.let { linkedMapOf("min" to it.min, "max" to it.max) }

    fun priceInterval(i: PriceInterval?): JsMap? = i?.let { linkedMapOf("from" to it.from, "to" to it.to, "count" to it.count) }

    private fun filters(filters: Map<String, SearchFilter>?): Map<String, JsMap?>? = filters?.mapValues { (_, f) -> searchFilter(f) }

    fun productsList(r: ProductsListResponse): JsMap = linkedMapOf(
        "productsTotal" to r.productsTotal,
        "products" to products(r.products),
        "categories" to r.categories.each(::productCategory),
        "brands" to r.brands.each(::brand),
        "locations" to r.locations.each(::location),
        "filters" to filters(r.filters),
        "industrialFilters" to industrialFilters(r.industrialFilters),
        "priceRange" to priceRange(r.priceRange),
        "priceRanges" to r.priceRanges.each(::priceInterval),
        "priceMedian" to r.priceMedian,
    )

    fun category(r: CategoryResponse): JsMap = linkedMapOf(
        "productsTotal" to r.productsTotal,
        "products" to products(r.products),
        "categories" to r.categories.each(::productCategory),
        "brands" to r.brands.each(::brand),
        "filters" to filters(r.filters),
        "priceRange" to priceRange(r.priceRange),
        "priceRanges" to r.priceRanges.each(::priceInterval),
        "priceMedian" to r.priceMedian,
    )

    fun counters(r: ProductCountersResponse): JsMap = linkedMapOf(
        "daily" to counter(r.daily),
        "now" to counter(r.now),
        "triggers" to triggers(r.triggers),
    )

    private fun counter(c: ProductCounter?): JsMap? = c?.let { linkedMapOf("view" to it.view, "cart" to it.cart, "purchase" to it.purchase) }

    private fun triggers(t: ProductCounterTriggers?): JsMap? = t?.let { linkedMapOf("backInStock" to it.backInStock, "priceDrop" to it.priceDrop) }

    // collections, recommendations

    fun collection(r: CollectionResponse): JsMap = linkedMapOf("products" to products(r.products))

    fun recommendation(r: RecommendationResponse): JsMap = linkedMapOf(
        "id" to r.id,
        "title" to r.title,
        "link" to r.link,
        "products" to products(r.products),
        "itemIds" to r.itemIds,
    )

    // search

    fun searchBlank(r: SearchBlankResponse): JsMap = linkedMapOf(
        "products" to products(r.products),
        "lastProducts" to r.lastProducts,
        "lastQueries" to r.lastQueries.each(::query),
        "suggests" to r.suggests.each(::query),
        "popularCategories" to r.popularCategories.each(::popularItem),
        "popularBrands" to r.popularBrands.each(::popularItem),
        "popularLinks" to r.popularLinks.each(::popularItem),
    )

    fun searchInstant(r: SearchInstantResponse): JsMap = linkedMapOf(
        "searchQuery" to r.searchQuery,
        "searchQueryOriginal" to r.searchQueryOriginal,
        "clarification" to r.clarification,
        "productsTotal" to r.productsTotal,
        "products" to products(r.products),
        "categories" to r.categories.each(::productCategory),
        "queries" to r.queries.each(::query),
        "locations" to r.locations.each(::location),
        "redirect" to redirect(r.redirect),
    )

    fun searchFull(r: SearchFullResponse): JsMap = linkedMapOf(
        "searchQuery" to r.searchQuery,
        "searchQueryOriginal" to r.searchQueryOriginal,
        "clarification" to r.clarification,
        "productsTotal" to r.productsTotal,
        "products" to products(r.products),
        "categories" to r.categories.each(::productCategory),
        "brands" to r.brands.each(::brand),
        "locations" to r.locations.each(::location),
        "filters" to filters(r.filters),
        "industrialFilters" to industrialFilters(r.industrialFilters),
        "priceRange" to priceRange(r.priceRange),
        "priceRanges" to r.priceRanges.each(::priceInterval),
        "priceMedian" to r.priceMedian,
    )

    private fun query(q: Query?): JsMap? = q?.let { linkedMapOf("name" to it.name, "url" to it.url, "score" to it.score) }

    private fun popularItem(i: PopularItem?): JsMap? = i?.let { linkedMapOf("name" to it.name, "url" to it.url) }

    private fun redirect(r: SearchRedirect?): JsMap? = r?.let { linkedMapOf("query" to it.query, "url" to it.url, "deeplink" to it.deeplink) }

    fun agentDialog(r: AgentDialogResponse): JsMap = linkedMapOf(
        "sessions" to r.sessions.each(::agentSession),
        "session" to agentSession(r.session),
    )

    fun agent(r: AgentResponse): JsMap = linkedMapOf(
        "session" to agentSession(r.session),
        "message" to agentMessage(r.message),
    )

    private fun agentSession(s: AgentSession?): JsMap? = s?.let {
        linkedMapOf("id" to it.id, "title" to it.title, "updatedAt" to it.updatedAt, "messages" to it.messages.each(::agentMessage))
    }

    private fun agentMessage(m: AgentMessage?): JsMap? = m?.let {
        linkedMapOf(
            // As the SDK has it: null for a message the answer gave no id — kept, never 0.
            "id" to it.id,
            // An open set: the server's value as it is.
            "role" to it.role?.value,
            "content" to it.content,
            "createdAt" to it.createdAt,
            "products" to it.products.each(::agentProduct),
        )
    }

    private fun agentProduct(p: AgentProduct?): JsMap? = p?.let {
        linkedMapOf(
            "id" to it.id,
            "name" to it.name,
            "price" to it.price,
            "oldPrice" to it.oldPrice,
            "priceFormatted" to it.priceFormatted,
            "oldPriceFormatted" to it.oldPriceFormatted,
            "picture" to it.picture,
            "url" to it.url,
            // "" when the agent gave none, as on iOS.
            "reason" to it.reason,
        )
    }

    // cart, profile

    fun cartItems(items: List<CartItem>?): List<JsMap?>? = items.each { item ->
        item?.let { linkedMapOf("id" to it.id, "quantity" to it.quantity) }
    }

    fun profile(p: Profile): JsMap = linkedMapOf(
        "id" to p.id,
        "hasEmail" to p.hasEmail,
        "emailRegisteredAt" to p.emailRegisteredAt,
        "gender" to gender(p.gender),
        "computedGender" to gender(p.computedGender),
        "boughtSomething" to p.boughtSomething,
        // The contract's: no properties are an empty map, not null — as on iOS.
        "customProperties" to (p.customProperties ?: emptyMap<String, Any?>()),
    )

    fun gender(g: Gender?): String? = when (g) {
        Gender.MALE -> "male"
        Gender.FEMALE -> "female"
        null -> null
    }

    fun orders(orders: List<Order>?): List<JsMap?>? = orders.each(::order)

    fun order(o: Order?): JsMap? = o?.let {
        linkedMapOf(
            "internalId" to it.internalId,
            "id" to it.id,
            "date" to it.date,
            "value" to it.value,
            "cashValue" to it.cashValue,
            "bonusesValue" to it.bonusesValue,
            "deliveryValue" to it.deliveryValue,
            "promocode" to it.promocode,
            "deliveryDate" to it.deliveryDate,
            "internalStatus" to it.internalStatus,
            "stream" to it.stream,
            "channel" to it.channel,
            "taxFree" to it.taxFree,
            "deliveryType" to it.deliveryType,
            "deliveryAddress" to it.deliveryAddress,
            "orderStatus" to it.orderStatus,
            "paymentType" to it.paymentType,
            "items" to it.items.each(::orderItem),
        )
    }

    private fun orderItem(i: OrderItem?): JsMap? = i?.let {
        linkedMapOf(
            "amount" to it.amount,
            "price" to it.price,
            "status" to it.status,
            "originalPrice" to it.originalPrice,
            "barcode" to it.barcode,
            "lineId" to it.lineId,
            "cancelReason" to it.cancelReason,
            "item" to orderProduct(it.item),
        )
    }

    /**
     * The product of an order line: the released model of `orders/by_user`, given the fields of `Product`
     * (as React Native's released `getUserOrders` reads it), null for the ones it does not have.
     */
    fun orderProduct(p: OrderProduct?): JsMap? = p?.let {
        linkedMapOf(
            "id" to it.id,
            "groupId" to null,
            "name" to it.name,
            "brand" to it.brand,
            "model" to null,
            "description" to it.description,
            "barcode" to null,
            "url" to it.url,
            "deeplinkAndroid" to it.deeplinkAndroid,
            "deeplinkIos" to it.deeplinkIos,
            "imageUrl" to it.imageUrl,
            "picture" to it.picture,
            "resizedImages" to resizedImages(it.imageUrlResized),
            "price" to it.price,
            "priceFormatted" to it.priceFormatted,
            "priceFull" to it.priceFull,
            "priceFullFormatted" to it.priceFullFormatted,
            "oldPrice" to it.oldPrice,
            "oldPriceFormatted" to it.oldPriceFormatted,
            "oldPriceFull" to null,
            "oldPriceFullFormatted" to null,
            "currency" to it.currency,
            // The SDK's: `discount` when `discount_percent` is not there, as iOS's.
            "discountPercent" to it.discountPercent,
            "discountFormatted" to it.discountFormatted,
            "salesRate" to it.salesRate,
            "relativeSalesRate" to it.relativeSalesRate,
            "rating" to null,
            "isNew" to (it.isNew ?: false),
            "stockQuantity" to null,
            "categoryIds" to it.categoryIds,
            "categories" to it.categories.each(::orderCategory),
            "params" to null,
            "locationIds" to it.locationIds,
        )
    }

    private fun orderCategory(c: Category?): JsMap? = c?.let {
        linkedMapOf(
            "id" to it.id,
            "name" to it.name,
            "url" to it.url,
            "parentId" to it.parentId,
            "level" to (it.level as String?)?.toIntOrNull(),
            "count" to null,
            "alias" to null,
        )
    }

    private fun resizedImages(r: ImageUrlResized?): Map<String, String?>? = r?.let {
        linkedMapOf(
            "120" to it.x120,
            "140" to it.x140,
            "160" to it.x160,
            "180" to it.x180,
            "200" to it.x200,
            "220" to it.x220,
            "310" to it.x310,
            "520" to it.x520,
        ).filterValues { value -> value != null }
    }

    // subscriptions, segments

    fun subscriptionStatus(s: SubscriptionStatus): JsMap = linkedMapOf(
        "exists" to s.exists,
        "emailBulk" to s.emailBulk,
        "emailChain" to s.emailChain,
        "emailTransactional" to s.emailTransactional,
        "smsBulk" to s.smsBulk,
        "smsChain" to s.smsChain,
        "smsTransactional" to s.smsTransactional,
        "webPushBulk" to s.webPushBulk,
        "webPushChain" to s.webPushChain,
        "webPushTransactional" to s.webPushTransactional,
        "mobilePushBulk" to s.mobilePushBulk,
        "mobilePushChain" to s.mobilePushChain,
        "mobilePushTransactional" to s.mobilePushTransactional,
        "telegramBulk" to s.telegramBulk,
        "telegramChain" to s.telegramChain,
        "telegramTransactional" to s.telegramTransactional,
        "whatsappBulk" to s.whatsappBulk,
        "whatsappChain" to s.whatsappChain,
        "whatsappTransactional" to s.whatsappTransactional,
        "maxBulk" to s.maxBulk,
        "maxChain" to s.maxChain,
        "maxTransactional" to s.maxTransactional,
        "walletBulk" to s.walletBulk,
        "walletChain" to s.walletChain,
        "walletTransactional" to s.walletTransactional,
        "hasWebPush" to s.hasWebPush,
        "hasMobilePush" to s.hasMobilePush,
        "emailInvalid" to s.emailInvalid,
        "emailBlacklisted" to s.emailBlacklisted,
        "emailBounced" to s.emailBounced,
        "emailSuppressed" to s.emailSuppressed,
        "emailConfirmed" to s.emailConfirmed,
    )

    /** A segment's `type` is `""` when the server gives none, as on iOS. */
    fun segments(list: List<Segment>?): List<JsMap?>? = list.each { s -> s?.let { linkedMapOf("id" to it.id, "type" to it.type) } }

    // notifications

    /** The released answer of `notifications`, with its fields' names. */
    fun notificationsHistory(r: GetAllNotificationsResponse): JsMap = linkedMapOf(
        "status" to r.status,
        "payload" to r.payload?.let { payload -> linkedMapOf("messages" to payload.messages.each(::message)) },
    )

    private fun message(m: Message?): JsMap? = m?.let {
        linkedMapOf(
            "body" to it.body,
            "campaignId" to it.campaignId,
            "channel" to it.channel,
            "code" to it.code,
            "date" to it.date,
            "icon" to it.icon,
            "picture" to it.picture,
            "sentAt" to it.sentAt,
            "statistics" to statistics(it.statistics),
            "subject" to it.subject,
            "type" to it.type,
            "url" to it.url,
        )
    }

    private fun statistics(s: Statistics?): JsMap? = s?.let {
        linkedMapOf(
            "clicked" to it.clicked,
            "complained" to it.complained,
            "hardBounced" to it.hardBounced,
            "opened" to it.opened,
            "purchased" to it.purchased,
            "softBounced" to it.softBounced,
            "unsubscribed" to it.unsubscribed,
        )
    }

    // stories

    fun storiesBlock(b: StoriesBlock): JsMap = linkedMapOf("id" to b.id, "stories" to b.stories.each(::story))

    private fun story(s: Story?): JsMap? = s?.let {
        linkedMapOf(
            "id" to it.id,
            "name" to it.name,
            "avatar" to it.avatar,
            "viewed" to it.viewed,
            "pinned" to it.pinned,
            "startPosition" to it.startPosition,
            "slides" to it.slides.each(::storySlide),
        )
    }

    private fun storySlide(s: StorySlide?): JsMap? = s?.let {
        linkedMapOf(
            "id" to it.id,
            "type" to slideType(it.type),
            "background" to it.background,
            "backgroundColor" to it.backgroundColor,
            "preview" to it.preview,
            "duration" to it.duration,
            "elements" to it.elements.each(::storyElement),
        )
    }

    fun slideType(t: StorySlideType?): String? = when (t) {
        StorySlideType.IMAGE -> "image"
        StorySlideType.VIDEO -> "video"
        StorySlideType.PRODUCT -> "product"
        null -> null
    }

    /** An element with its kind in `type`: `button`, `product`, `products`, `textBlock`. */
    fun storyElement(e: StoryElement?): JsMap? = when (e) {
        is StoryButtonElement -> linkedMapOf(
            "type" to "button",
            "title" to e.title,
            "link" to e.link,
            "linkAndroid" to e.linkAndroid,
            "linkIos" to e.linkIos,
            "background" to e.background,
            "color" to e.color,
            "textBold" to e.textBold,
        )
        is StoryProductElement -> linkedMapOf(
            "type" to "product",
            "title" to e.title,
            "item" to storyProduct(e.item),
        )
        is StoryProductsElement -> linkedMapOf(
            "type" to "products",
            "showLabel" to e.showLabel,
            "hideLabel" to e.hideLabel,
            "products" to e.products.each(::storyProduct),
        )
        is StoryTextBlockElement -> linkedMapOf(
            "type" to "textBlock",
            "text" to e.text,
            "fontSize" to e.fontSize,
            "fontType" to e.fontType,
            "bold" to e.bold,
            "italic" to e.italic,
            "textAlign" to e.textAlign,
            "textColor" to e.textColor,
            "backgroundColor" to e.backgroundColor,
            "backgroundOpacity" to e.backgroundOpacity,
            "lineSpacing" to e.lineSpacing,
            "yOffset" to e.yOffset,
            "promocode" to e.promocode,
        )
        null -> null
    }

    private fun storyProduct(p: StoryProduct?): JsMap? = p?.let {
        linkedMapOf(
            "id" to it.id,
            "name" to it.name,
            "brand" to it.brand,
            "picture" to it.picture,
            "imageUrl" to it.imageUrl,
            "price" to it.price,
            "priceFormatted" to it.priceFormatted,
            "oldPrice" to it.oldPrice,
            "oldPriceFormatted" to it.oldPriceFormatted,
            "discountPercent" to it.discountPercent,
            "promocode" to it.promocode,
            "priceWithPromocode" to it.priceWithPromocode,
            "priceWithPromocodeFormatted" to it.priceWithPromocodeFormatted,
            "currency" to it.currency,
            "url" to it.url,
            "deeplinkAndroid" to it.deeplinkAndroid,
            "deeplinkIos" to it.deeplinkIos,
        )
    }

    // predict, loyalty, sliders

    fun probability(p: PurchaseProbability): JsMap = linkedMapOf("probability" to p.probability, "clientId" to p.clientId)

    fun loyaltyMember(m: LoyaltyMember): JsMap = linkedMapOf("identifier" to m.identifier)

    fun loyaltyStatus(s: LoyaltyStatus): JsMap = linkedMapOf("isMember" to s.isMember, "level" to loyaltyLevel(s.level))

    private fun loyaltyLevel(l: LoyaltyLevel?): JsMap? = l?.let {
        linkedMapOf("code" to it.code, "name" to it.name, "expirationDate" to it.expirationDate)
    }

    fun loyaltyPromotions(list: List<LoyaltyPromotion>?): List<JsMap?>? = list.each { promotion ->
        promotion?.let {
            linkedMapOf(
                "id" to it.id,
                "name" to it.name,
                "description" to it.description,
                "startDate" to it.startDate,
                "finishDate" to it.finishDate,
                "stream" to it.stream,
                "badgeLabel" to it.badgeLabel,
                "badgeColor" to it.badgeColor,
                "rewardType" to rewardType(it.rewardType),
            )
        }
    }

    fun rewardType(t: LoyaltyRewardType?): String? = when (t) {
        LoyaltyRewardType.DISCOUNT -> "discount"
        LoyaltyRewardType.BONUSES_EARN -> "bonusesEarn"
        LoyaltyRewardType.BONUSES_USAGE -> "bonusesUsage"
        null -> null
    }

    fun slider(s: Slider): JsMap = linkedMapOf(
        "code" to s.code,
        "width" to s.width,
        "height" to s.height,
        "banners" to s.banners.each(::sliderBanner),
    )

    private fun sliderBanner(b: SliderBanner?): JsMap? = b?.let {
        linkedMapOf(
            "id" to it.id,
            "code" to it.code,
            "imageUrl" to it.imageUrl,
            "url" to it.url,
            "deeplinkIos" to it.deeplinkIos,
            "deeplinkAndroid" to it.deeplinkAndroid,
            "html" to it.html,
        )
    }

    // reviews

    fun pollReview(r: PollReview): JsMap = linkedMapOf("id" to r.id)

    fun npsCategories(list: List<NpsCategory>?): List<JsMap?>? = list.each { category ->
        category?.let {
            linkedMapOf(
                "code" to it.code,
                "name" to it.name,
                "detractorQuestion" to it.detractorQuestion,
                "passiveQuestion" to it.passiveQuestion,
                "promoterQuestion" to it.promoterQuestion,
                "detractorSuccess" to it.detractorSuccess,
                "passiveSuccess" to it.passiveSuccess,
                "promoterSuccess" to it.promoterSuccess,
                "buttonLabel" to it.buttonLabel,
            )
        }
    }

    fun csatCampaigns(list: List<CsatCampaign>?): List<JsMap?>? = list.each { campaign ->
        campaign?.let {
            linkedMapOf(
                "code" to it.code,
                "name" to it.name,
                "dissatisfiedQuestion" to it.dissatisfiedQuestion,
                "neutralQuestion" to it.neutralQuestion,
                "satisfiedQuestion" to it.satisfiedQuestion,
                "dissatisfiedSuccess" to it.dissatisfiedSuccess,
                "neutralSuccess" to it.neutralSuccess,
                "satisfiedSuccess" to it.satisfiedSuccess,
                "buttonLabel" to it.buttonLabel,
            )
        }
    }

    fun cesCampaigns(list: List<CesCampaign>?): List<JsMap?>? = list.each { campaign ->
        campaign?.let {
            linkedMapOf(
                "code" to it.code,
                "name" to it.name,
                "difficultQuestion" to it.difficultQuestion,
                "neutralQuestion" to it.neutralQuestion,
                "easyQuestion" to it.easyQuestion,
                "difficultSuccess" to it.difficultSuccess,
                "neutralSuccess" to it.neutralSuccess,
                "easySuccess" to it.easySuccess,
                "buttonLabel" to it.buttonLabel,
            )
        }
    }

    fun pollChannels(list: List<PollChannel>?): List<JsMap?>? = list.each { channel ->
        channel?.let { linkedMapOf("code" to it.code, "name" to it.name) }
    }

    fun productReviews(r: ProductReviewsResponse): JsMap = linkedMapOf(
        "summary" to ratingSummary(r.summary),
        "reviews" to r.reviews.each(::productReview),
    )

    /** `ratings`: a rating (`"1"` … `"5"`, a map key in JavaScript) → how many gave it. */
    private fun ratingSummary(s: ProductRatingSummary?): JsMap? = s?.let {
        linkedMapOf(
            "count" to it.count,
            "averageRating" to it.averageRating,
            "ratings" to (it.ratings as Map<Int, Int>?)?.entries?.associate { (rating, count) -> rating.toString() to count },
        )
    }

    private fun productReview(r: ProductReview?): JsMap? = r?.let {
        linkedMapOf(
            "id" to it.id,
            "rating" to it.rating,
            "comment" to it.comment,
            "author" to it.author,
            "createdAt" to it.createdAt,
        )
    }

    fun clientReviews(list: List<ClientReview>?): List<JsMap?>? = list.each { review ->
        review?.let {
            linkedMapOf(
                "id" to it.id,
                "itemId" to it.itemId,
                "orderId" to it.orderId,
                "rating" to it.rating,
                "comment" to it.comment,
                "state" to reviewState(it.state),
                "createdAt" to it.createdAt,
            )
        }
    }

    fun reviewState(s: ReviewState?): String? = when (s) {
        ReviewState.MODERATION -> "moderation"
        ReviewState.PUBLISHED -> "published"
        ReviewState.REJECTED -> "rejected"
        null -> null
    }

    /** Each item of a list that may be null (Gson leaves one null), through [convert]. */
    private inline fun <T, R> List<T>?.each(convert: (T?) -> R): List<R>? = this?.map { convert(it) }
}
