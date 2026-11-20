package com.personaclick.reactnative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.personalization.Cancellable
import com.personalization.LogLevel
import com.personalization.PopupPresentationListener
import com.personalization.PersonaClick
import com.personalization.PersonaClickConfig
import com.personalization.PushProvider
import com.personalization.SdkLogHandler
import com.personalization.core.PushEvent
import com.personalization.SDK
import com.personalization.UnknownShopIdException
import com.personalization.core.CompletionListener
import com.personalization.core.SdkResult
import com.personalization.core.SdkState
import org.json.JSONArray
import org.json.JSONObject

/**
 * The SDK's native module. Each method calls the native SDK's method of the same meaning and hands its
 * result to JavaScript: the native registry holds the instances, and the module keeps no requests,
 * storage or queue of its own — only its subscriptions to the instances' state and session, to tell
 * JavaScript.
 */
class PersonaClickNativeModule(context: ReactApplicationContext) : NativePersonaClickSpec(context) {

    /** Per shop, the subscriptions that tell JavaScript the instance's state and session. */
    private val stateListeners = ShopSubscriptions()

    /** The native SDK's server popups, for JavaScript to show. */
    private val popups = PopupRelay(emit = ::emitPopup)

    override fun getName(): String = NAME

    override fun initializeShop(config: ReadableMap, promise: Promise) = settling(promise) {
        val sdk = try {
            // The bridges' entry: the new core, and the A/B group JavaScript kept, taken while the device
            // has none of its own. The application's context: the instance lives as long as the process,
            // beyond this React instance and its reloads.
            PersonaClick.initializeBridge(
                reactApplicationContext.applicationContext,
                nativeConfig(config),
                segment = config.optString("segment"),
            )
        } catch (e: IllegalArgumentException) {
            promise.reject(INVALID_ARGUMENT, e.message)
            return@settling
        }
        // Every server popup goes to JavaScript, which shows it — the overlay or the app's delegate — as 4.0
        // did: the native SDK shows none, and the popup is reported as shown once JavaScript shows it.
        sdk.popupPresentationListener = PopupPresentationListener { shown, popup ->
            popups.relay(shown.shopId, PopupMaps.popup(popup))
            null
        }
        // A JavaScript reload initializes the shop again: it gets the live instance and new
        // subscriptions, the state one telling the current state at once.
        val state = sdk.onStateChange { emit(snapshot(sdk, it)) }
        val session = sdk.onSessionChange { emit(snapshot(sdk)) }
        stateListeners.replace(sdk.shopId, Cancellable { state.cancel(); session.cancel() })
        promise.resolve(snapshot(sdk))
    }

    override fun getDeviceId(shopId: String, promise: Promise) = settling(promise) {
        val sdk = instance(shopId, promise) ?: return@settling
        promise.resolve(sdk.deviceId)
    }

    override fun queueEvent(shopId: String, path: String, body: ReadableMap, promise: Promise) = settling(promise) {
        val sdk = instance(shopId, promise) ?: return@settling
        sdk.queueEvent(path, body.toJson(), CompletionListener { result ->
            when (result) {
                is SdkResult.Success -> promise.resolve(null)
                is SdkResult.Failure -> promise.reject(result.error)
            }
        })
    }

    override fun setSource(shopId: String, type: String, code: String, promise: Promise) = settling(promise) {
        val sdk = instance(shopId, promise) ?: return@settling
        val source = try {
            NamespaceArgs.sourceOf(type, code)
        } catch (e: BridgeArgumentException) {
            promise.reject(INVALID_ARGUMENT, e.message)
            return@settling
        }
        if (code.isBlank()) {
            promise.reject(INVALID_ARGUMENT, "The source code must not be empty")
            return@settling
        }
        sdk.tracking.setSource(source)
        promise.resolve(null)
    }

    /**
     * `PersonaClick.setLogHandler` of the contract: while [enabled], every message the native SDK logs — of every
     * shop, at or above its `logLevel` — goes to JavaScript as the [LOG] event; off, none goes.
     */
    override fun setLogHandler(enabled: Boolean) {
        PersonaClick.setLogHandler(if (enabled) SdkLogHandler { emitLog(LogMessages.map(it)) } else null)
    }

    // the instance — `sdk/contract/root.md`

    override fun flush(shopId: String, promise: Promise) = settling(promise) {
        val sdk = instance(shopId, promise) ?: return@settling
        sdk.flush(done<Unit>(promise) { null })
    }

    override fun releaseShop(shopId: String) {
        val id = shopId.trim()
        // Only a live instance: a lookup of another shop would make one. The released instance tells its
        // listeners it is not initialized and drops them; the module's go with them.
        if (PersonaClick.isInitialized(id)) runCatching { PersonaClick.instance(id) }.getOrNull()?.release()
        stateListeners.release(id)
        popups.drop(id)
    }

    override fun deleteUserCredentials(shopId: String, promise: Promise) = settling(promise) {
        val sdk = instance(shopId, promise) ?: return@settling
        sdk.deleteUserCredentials(done<Unit>(promise) { null })
    }

    // tracking — through the bridges' `tracking.queued`: each settles once the native queue accepted the
    // event (written to the disk), as on iOS, or with the error that refused it at once; the server's
    // answer comes later and is not the call's.

    override fun trackingProductView(shopId: String, itemId: String, source: ReadableMap?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.tracking.queued.productView(itemId, NamespaceArgs.source(source?.toHashMap()), accepted(promise))
        }

    override fun trackingCategoryView(shopId: String, categoryId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.tracking.queued.categoryView(categoryId, accepted(promise)) }

    override fun trackingSearch(shopId: String, query: String, results: ReadableArray?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.tracking.queued.search(query, NamespaceArgs.stringList(results?.toArrayList(), "results"), accepted(promise))
        }

    override fun trackingAddToCart(shopId: String, item: ReadableMap, source: ReadableMap?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.tracking.queued.addToCart(
                NamespaceArgs.trackingItem(item.toHashMap()),
                NamespaceArgs.source(source?.toHashMap()),
                accepted(promise),
            )
        }

    override fun trackingSyncCart(shopId: String, items: ReadableArray, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.tracking.queued.syncCart(NamespaceArgs.trackingItems(items.toArrayList()), accepted(promise))
        }

    override fun trackingRemoveFromCart(shopId: String, itemId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.tracking.queued.removeFromCart(itemId, accepted(promise)) }

    override fun trackingAddToFavorites(shopId: String, itemId: String, source: ReadableMap?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.tracking.queued.addToFavorites(itemId, NamespaceArgs.source(source?.toHashMap()), accepted(promise))
        }

    override fun trackingSyncFavorites(shopId: String, itemIds: ReadableArray, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.tracking.queued.syncFavorites(NamespaceArgs.stringList(itemIds.toArrayList(), "itemIds")!!, accepted(promise))
        }

    override fun trackingRemoveFromFavorites(shopId: String, itemId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.tracking.queued.removeFromFavorites(itemId, accepted(promise)) }

    /** The request's own `recommendedBy` wins over `source`, as on iOS. */
    override fun trackingPurchase(shopId: String, request: ReadableMap, source: ReadableMap?, promise: Promise) =
        call(shopId, promise) { sdk ->
            val purchase = NamespaceArgs.purchase(request.toHashMap(), NamespaceArgs.source(source?.toHashMap()))
            sdk.tracking.queued.purchase(purchase.request, purchase.source, accepted(promise))
        }

    override fun trackingStoryView(shopId: String, storyId: String, slideId: String, code: String?, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.tracking.queued.storyView(storyId, slideId, code, accepted(promise)) }

    override fun trackingStoryClick(shopId: String, storyId: String, slideId: String, code: String?, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.tracking.queued.storyClick(storyId, slideId, code, accepted(promise)) }

    override fun trackingBannerView(shopId: String, bannerId: String, code: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.tracking.queued.bannerView(bannerId, code, accepted(promise)) }

    override fun trackingBannerClick(shopId: String, bannerId: String, code: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.tracking.queued.bannerClick(bannerId, code, accepted(promise)) }

    override fun trackingPopupShown(shopId: String, popupId: Double, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.tracking.queued.popupShown(NamespaceArgs.wholeInt(popupId, "popupId")!!, accepted(promise))
        }

    override fun trackingCustom(
        shopId: String,
        event: String,
        time: Double?,
        category: String?,
        label: String?,
        value: Double?,
        customFields: ReadableMap?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.tracking.queued.custom(
            event = event,
            time = NamespaceArgs.wholeInt(time, "time"),
            category = category,
            label = label,
            value = NamespaceArgs.wholeInt(value, "value"),
            customFields = NamespaceArgs.free(customFields?.toHashMap()),
            listener = accepted(promise),
        )
    }

    // products

    override fun productsGetInfo(shopId: String, itemId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.products.getInfo(itemId, done(promise, ModelMaps::product)) }

    override fun productsGetList(shopId: String, request: ReadableMap?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.products.getList(NamespaceArgs.productsList(request?.toHashMap()), done(promise, ModelMaps::productsList))
        }

    override fun productsGetCounters(shopId: String, itemId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.products.getCounters(itemId, done(promise, ModelMaps::counters)) }

    override fun productsGetCategory(shopId: String, categoryId: String, request: ReadableMap?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.products.getCategory(categoryId, NamespaceArgs.category(request?.toHashMap()), done(promise, ModelMaps::category))
        }

    // collections, recommendations

    override fun collectionsGet(shopId: String, collectionId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.collections.get(collectionId, done(promise, ModelMaps::collection)) }

    override fun recommendationsGet(shopId: String, code: String, request: ReadableMap?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.recommendations.get(code, NamespaceArgs.recommendation(request?.toHashMap()), done(promise, ModelMaps::recommendation))
        }

    // search

    override fun searchBlank(shopId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.search.blank(done(promise, ModelMaps::searchBlank)) }

    override fun searchInstant(
        shopId: String,
        query: String,
        locations: ReadableArray?,
        excludedMerchants: ReadableArray?,
        excludedBrands: ReadableArray?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.search.instant(
            query,
            NamespaceArgs.stringList(locations?.toArrayList(), "locations"),
            NamespaceArgs.stringList(excludedMerchants?.toArrayList(), "excludedMerchants"),
            NamespaceArgs.stringList(excludedBrands?.toArrayList(), "excludedBrands"),
            done(promise, ModelMaps::searchInstant),
        )
    }

    override fun searchFull(shopId: String, query: String, request: ReadableMap?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.search.full(query, NamespaceArgs.searchFull(request?.toHashMap()), done(promise, ModelMaps::searchFull))
        }

    override fun searchAgentDialog(shopId: String, sessionId: Double?, locations: ReadableArray?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.search.agentDialog(
                NamespaceArgs.wholeLong(sessionId, "sessionId"),
                NamespaceArgs.stringList(locations?.toArrayList(), "locations"),
                done(promise, ModelMaps::agentDialog),
            )
        }

    override fun searchAgent(shopId: String, message: String, sessionId: Double?, locations: ReadableArray?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.search.agent(
                message,
                NamespaceArgs.wholeLong(sessionId, "sessionId"),
                NamespaceArgs.stringList(locations?.toArrayList(), "locations"),
                done(promise, ModelMaps::agent),
            )
        }

    // cart

    override fun cartGet(shopId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.cart.get(done(promise, ModelMaps::cartItems)) }

    override fun cartClear(
        shopId: String,
        shopSecret: String,
        email: String?,
        phone: String?,
        loyaltyId: String?,
        externalId: String?,
        telegramId: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.cart.clear(shopSecret, email, phone, loyaltyId, externalId, telegramId, done<Unit>(promise) { null })
    }

    // profile

    override fun profileGet(shopId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.profile.get(done(promise, ModelMaps::profile)) }

    override fun profileSet(shopId: String, request: ReadableMap, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.profile.set(NamespaceArgs.profileUpdate(request.toHashMap()), done<Unit>(promise) { null })
        }

    override fun profileGetLastOrder(shopId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.profile.getLastOrder(done(promise, ModelMaps::products)) }

    override fun profileGetOrders(
        shopId: String,
        shopSecret: String,
        did: String?,
        email: String?,
        phone: String?,
        loyaltyId: String?,
        externalId: String?,
        dateFrom: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.profile.getOrders(shopSecret, did, email, phone, loyaltyId, externalId, dateFrom, done(promise, ModelMaps::orders))
    }

    // subscriptions

    override fun subscriptionsManage(shopId: String, request: ReadableMap, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.subscriptions.manage(NamespaceArgs.subscriptionsUpdate(request.toHashMap()), done<Unit>(promise) { null })
        }

    override fun subscriptionsCheck(shopId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.subscriptions.check(done(promise, ModelMaps::subscriptionStatus)) }

    override fun subscriptionsSubscribeForPriceDrop(
        shopId: String,
        itemId: String,
        currentPrice: Double,
        email: String?,
        phone: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.subscriptions.subscribeForPriceDrop(itemId, currentPrice, email, phone, done<Unit>(promise) { null })
    }

    override fun subscriptionsUnsubscribeFromPriceDrop(
        shopId: String,
        itemIds: ReadableArray,
        email: String?,
        phone: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.subscriptions.unsubscribeFromPriceDrop(
            NamespaceArgs.stringList(itemIds.toArrayList(), "itemIds")!!, email, phone, done<Unit>(promise) { null },
        )
    }

    override fun subscriptionsSubscribeForBackInStock(
        shopId: String,
        itemId: String,
        properties: ReadableMap?,
        email: String?,
        phone: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.subscriptions.subscribeForBackInStock(
            itemId, NamespaceArgs.backInStock(properties?.toHashMap()), email, phone, done<Unit>(promise) { null },
        )
    }

    override fun subscriptionsUnsubscribeFromBackInStock(
        shopId: String,
        itemIds: ReadableArray,
        email: String?,
        phone: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.subscriptions.unsubscribeFromBackInStock(
            NamespaceArgs.stringList(itemIds.toArrayList(), "itemIds")!!, email, phone, done<Unit>(promise) { null },
        )
    }

    // segments

    override fun segmentsAdd(shopId: String, segmentId: Double, email: String?, phone: String?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.segments.add(NamespaceArgs.wholeInt(segmentId, "segmentId")!!, email, phone, done<Unit>(promise) { null })
        }

    override fun segmentsRemove(shopId: String, segmentId: Double, email: String?, phone: String?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.segments.remove(NamespaceArgs.wholeInt(segmentId, "segmentId")!!, email, phone, done<Unit>(promise) { null })
        }

    override fun segmentsGet(shopId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.segments.get(done(promise, ModelMaps::segments)) }

    // notifications — receiving stays in JavaScript; the events and the token go here.

    override fun notificationsTrack(shopId: String, event: String, code: String, type: String, promise: Promise) =
        call(shopId, promise) { sdk ->
            val notifications = sdk.notifications
            when (PushEvents.of(event)) {
                PushEvent.DELIVERED -> notifications.trackDelivered(code, type, accepted(promise))
                PushEvent.OPENED -> notifications.trackOpened(code, type, accepted(promise))
                PushEvent.CLICKED -> notifications.trackClicked(code, type, accepted(promise))
                PushEvent.CLOSED -> notifications.trackClosed(code, type, accepted(promise))
            }
        }

    override fun notificationsSetPushToken(shopId: String, token: String, provider: String, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.notifications.setPushToken(token, PushEvents.provider(provider), done<Unit>(promise) { null })
        }

    override fun notificationsGetPushToken(shopId: String, provider: String?, promise: Promise) =
        call(shopId, promise) { sdk ->
            val token = sdk.notifications.getPushToken(provider?.let(PushEvents::provider))
            promise.resolve(token?.let { jsValue(mapOf("token" to it.token, "provider" to it.provider.id)) })
        }

    override fun registerShops(configs: ReadableArray, promise: Promise) = settling(promise) {
        val natives = try {
            (0 until configs.size()).map { i ->
                configs.getMap(i)?.let(::nativeConfig) ?: throw IllegalArgumentException("A config must be a map")
            }
        } catch (e: IllegalArgumentException) {
            promise.reject(INVALID_ARGUMENT, e.message)
            return@settling
        }
        // A shop started already keeps its instance; the others are brought up for a push only.
        PersonaClick.registerBridge(reactApplicationContext.applicationContext, natives)
        promise.resolve(true)
    }

    override fun handlePush(payload: ReadableMap, event: String, promise: Promise) = settling(promise) {
        val pushEvent = try {
            PushEvents.of(event)
        } catch (e: IllegalArgumentException) {
            promise.reject(INVALID_ARGUMENT, e.message)
            return@settling
        }
        val data = payload.toHashMap().mapNotNull { (key, value) -> (value as? String)?.let { key to it } }.toMap()
        promise.resolve(PersonaClick.handlePush(data, pushEvent))
    }

    override fun notificationsGetHistory(
        shopId: String,
        shopSecret: String,
        type: String,
        phone: String?,
        email: String?,
        externalId: String?,
        loyaltyId: String?,
        channel: String?,
        limit: Double?,
        page: Double?,
        dateFrom: String?,
        did: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.notifications.getHistory(
            shopSecret, type, phone, email, externalId, loyaltyId, channel,
            NamespaceArgs.wholeInt(limit, "limit"),
            NamespaceArgs.wholeInt(page, "page"),
            dateFrom, did,
            done(promise, ModelMaps::notificationsHistory),
        )
    }

    // stories, predict

    override fun storiesGet(shopId: String, code: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.stories.get(code, done(promise, ModelMaps::storiesBlock)) }

    override fun predictGetProbabilityToPurchase(shopId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.predict.getProbabilityToPurchase(done(promise, ModelMaps::probability)) }

    // loyalty

    override fun loyaltyJoin(
        shopId: String,
        phone: String,
        firstName: String?,
        lastName: String?,
        gender: String?,
        birthday: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.loyalty.join(phone, firstName, lastName, gender?.let(NamespaceArgs::gender), birthday, done(promise, ModelMaps::loyaltyMember))
    }

    override fun loyaltyGetStatus(shopId: String, phone: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.loyalty.getStatus(phone, done(promise, ModelMaps::loyaltyStatus)) }

    override fun loyaltyGetPromotions(
        shopId: String,
        locationId: String?,
        promoCodes: ReadableArray?,
        chargeBonuses: Boolean?,
        currentTime: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.loyalty.getPromotions(
            locationId,
            NamespaceArgs.stringList(promoCodes?.toArrayList(), "promoCodes"),
            chargeBonuses,
            currentTime,
            done(promise, ModelMaps::loyaltyPromotions),
        )
    }

    // sliders

    override fun slidersGet(shopId: String, code: String, tags: ReadableArray?, locationId: String?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.sliders.get(code, NamespaceArgs.stringList(tags?.toArrayList(), "tags"), locationId, done(promise, ModelMaps::slider))
        }

    // reviews

    override fun reviewsCreateNps(
        shopId: String,
        rate: Double,
        channel: String,
        category: String,
        orderId: String?,
        comment: String?,
        label: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.reviews.createNps(NamespaceArgs.wholeInt(rate, "rate")!!, channel, category, orderId, comment, label, done(promise, ModelMaps::pollReview))
    }

    override fun reviewsCreateCsat(
        shopId: String,
        rate: Double,
        channel: String,
        campaign: String,
        orderId: String?,
        comment: String?,
        label: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.reviews.createCsat(NamespaceArgs.wholeInt(rate, "rate")!!, channel, campaign, orderId, comment, label, done(promise, ModelMaps::pollReview))
    }

    override fun reviewsCreateCes(
        shopId: String,
        rate: Double,
        channel: String,
        campaign: String,
        orderId: String?,
        comment: String?,
        label: String?,
        promise: Promise,
    ) = call(shopId, promise) { sdk ->
        sdk.reviews.createCes(NamespaceArgs.wholeInt(rate, "rate")!!, channel, campaign, orderId, comment, label, done(promise, ModelMaps::pollReview))
    }

    override fun reviewsGetNpsCategories(shopId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.reviews.getNpsCategories(done(promise, ModelMaps::npsCategories)) }

    override fun reviewsGetNpsChannels(shopId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.reviews.getNpsChannels(done(promise, ModelMaps::pollChannels)) }

    override fun reviewsGetCsatCampaigns(shopId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.reviews.getCsatCampaigns(done(promise, ModelMaps::csatCampaigns)) }

    override fun reviewsGetCesCampaigns(shopId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.reviews.getCesCampaigns(done(promise, ModelMaps::cesCampaigns)) }

    override fun reviewsGetProductReviews(shopId: String, itemId: String, limit: Double?, offset: Double?, promise: Promise) =
        call(shopId, promise) { sdk ->
            sdk.reviews.getProductReviews(
                itemId,
                NamespaceArgs.wholeInt(limit, "limit"),
                NamespaceArgs.wholeInt(offset, "offset"),
                done(promise, ModelMaps::productReviews),
            )
        }

    override fun reviewsGetClientReviews(shopId: String, orderId: String, promise: Promise) =
        call(shopId, promise) { sdk -> sdk.reviews.getClientReviews(orderId, done(promise, ModelMaps::clientReviews)) }

    /**
     * Runs [block] with the shop's instance; an argument JavaScript handed with the wrong type rejects
     * [promise] with `invalidArgument` before anything goes to the native SDK, and so does anything else
     * [block] throws ([settling]): the promise always settles.
     */
    private inline fun call(shopId: String, promise: Promise, block: (SDK) -> Unit) = settling(promise) {
        val sdk = instance(shopId, promise) ?: return@settling
        block(sdk)
    }

    /** A namespace's listener: [promise] gets the result as [convert] gives it to JavaScript, or the error. */
    private fun <T> done(promise: Promise, convert: (T) -> Any?): CompletionListener<T> = completion(promise, convert)

    /**
     * A new listener in JavaScript hears every initialized shop's snapshot at once: a change that came
     * before it subscribed is not lost.
     */
    override fun addListener(eventName: String) {
        if (eventName == POPUP) {
            popups.replay()
            return
        }
        stateListeners.shopIds().forEach { shopId ->
            runCatching { PersonaClick.instance(shopId) }.getOrNull()?.let { emit(snapshot(it)) }
        }
    }

    // The event emitter of JavaScript counts its listeners itself.
    override fun removeListeners(count: Double) = Unit

    override fun invalidate() {
        stateListeners.cancelAll()
        super.invalidate()
    }

    /** The shop's instance, or null once [promise] was rejected with `notInitialized`. */
    private fun instance(shopId: String, promise: Promise): SDK? = try {
        PersonaClick.instance(shopId.trim())
    } catch (e: UnknownShopIdException) {
        promise.reject(NOT_INITIALIZED, e.message)
        null
    }

    /** Hands JavaScript a server popup of [shopId]; false while it cannot hear it. */
    private fun emitPopup(shopId: String, popup: Map<String, Any?>): Boolean {
        if (!reactApplicationContext.hasActiveReactInstance()) return false
        val event = Arguments.createMap().apply {
            putString("shopId", shopId)
            putMap("popup", jsValue(popup) as WritableMap)
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(POPUP, event)
        return true
    }

    /** Hands JavaScript a log message; dropped while it cannot hear it. Called on the SDK's log thread. */
    private fun emitLog(message: Map<String, Any?>) {
        if (!reactApplicationContext.hasActiveReactInstance()) return
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(LOG, jsValue(message) as WritableMap)
    }

    private fun emit(snapshot: WritableMap) {
        if (!reactApplicationContext.hasActiveReactInstance()) return
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(STATE_CHANGED, snapshot)
    }

    companion object {
        const val NAME = "PersonaClickNative"
        const val STATE_CHANGED = "PersonaClickStateChanged"
        const val POPUP = "PersonaClickPopup"
        const val LOG = "PersonaClickLog"

        /** The stream of a shop whose app names none, as the contract has it for React Native. */
        const val DEFAULT_STREAM = "react-native"
        const val NOT_INITIALIZED = "notInitialized"

        /** @throws IllegalArgumentException for a missing shop id or a value of the wrong type. */
        internal fun nativeConfig(config: ReadableMap): PersonaClickConfig {
            val shopId = config.optString("shopId") ?: throw IllegalArgumentException("shopId must not be empty")
            val defaults = PersonaClickConfig(shopId = shopId)
            return PersonaClickConfig(
                shopId = shopId,
                apiDomain = config.optString("apiDomain")?.let(::apiHost) ?: defaults.apiDomain,
                appDomain = config.optString("appDomain")?.let(::apiHost) ?: defaults.appDomain,
                // A React Native app's stream unless the app names its own (the contract).
                stream = config.optString("stream") ?: DEFAULT_STREAM,
                // JavaScript takes the token from Firebase and hands it over (notificationsSetPushToken).
                autoSendPushToken = false,
                needReInitialization = config.optBoolean("needReInitialization") ?: false,
                sendAdvertisingId = config.optBoolean("sendAdvertisingId") ?: false,
                // JavaScript shows the popups (popupPresentationListener): the native SDK never does.
                enableAutoPopupPresentation = false,
                storageKey = config.optString("storageKey"),
                deviceId = config.optString("deviceId"),
                logLevel = config.optString("logLevel")?.let(::logLevel) ?: defaults.logLevel,
            )
        }

        /** `debug`, `info`, `warning`, `error` or `none`, as on iOS. */
        private fun logLevel(name: String): LogLevel =
            LogLevel.entries.firstOrNull { it.name.equals(name, ignoreCase = true) }
                ?: throw IllegalArgumentException("Unknown log level: $name")

        /** The API's host: iOS takes a host only, so a scheme and a trailing slash go on both platforms. */
        internal fun apiHost(domain: String): String? =
            domain.replace(Regex("^https?://", RegexOption.IGNORE_CASE), "").trimEnd('/').ifEmpty { null }
    }
}

/** The instance's snapshot for JavaScript, with [state] when a listener was handed it. */
private fun snapshot(sdk: SDK, state: SdkState = sdk.state): WritableMap = Arguments.createMap().apply {
    putString("shopId", sdk.shopId)
    putString("state", state.wireName)
    putString("deviceId", sdk.deviceId)
    putString("sessionId", sdk.sessionId)
    putString("segment", runCatching { sdk.getSegment() }.getOrNull()?.ifEmpty { null })
    putBoolean("agentEnabled", runCatching { sdk.search.agentEnabled }.getOrDefault(false))
    // The push tokens the native SDK keeps for the shop, from an earlier start too: `notifications.getPushToken`.
    val notifications = runCatching { sdk.notifications }.getOrNull()
    val last = notifications?.let { runCatching { it.getPushToken(null) }.getOrNull() }
    putMap("pushToken", last?.let { jsValue(mapOf("token" to it.token, "provider" to it.provider.id)) as WritableMap })
    val tokens = PushProvider.entries.mapNotNull { provider ->
        notifications?.let { runCatching { it.getPushToken(provider) }.getOrNull() }?.let { provider.id to it.token }
    }.toMap()
    putMap("pushTokens", jsValue(tokens) as WritableMap)
}

/** The state's name on iOS and in JavaScript. */
private val SdkState.wireName: String
    get() = when (this) {
        SdkState.NOT_INITIALIZED -> "notInitialized"
        SdkState.INITIALIZING -> "initializing"
        SdkState.READY -> "ready"
        SdkState.RETRYING -> "retrying"
        SdkState.REFUSED -> "refused"
    }

/** The event's fields as JSON; a whole number stays whole (JavaScript hands every number as a double). */
private fun ReadableMap.toJson(): JSONObject {
    val json = JSONObject()
    val keys = keySetIterator()
    while (keys.hasNextKey()) {
        val key = keys.nextKey()
        json.put(key, valueOf(getType(key), { getBoolean(key) }, { getDouble(key) }, { getString(key) }, { getMap(key) }, { getArray(key) }))
    }
    return json
}

private fun ReadableArray.toJson(): JSONArray {
    val json = JSONArray()
    for (i in 0 until size()) {
        json.put(valueOf(getType(i), { getBoolean(i) }, { getDouble(i) }, { getString(i) }, { getMap(i) }, { getArray(i) }))
    }
    return json
}

private inline fun valueOf(
    type: ReadableType,
    boolean: () -> Boolean,
    number: () -> Double,
    string: () -> String?,
    map: () -> ReadableMap?,
    array: () -> ReadableArray?,
): Any = when (type) {
    ReadableType.Null -> JSONObject.NULL
    ReadableType.Boolean -> boolean()
    ReadableType.Number -> number().let { if (it % 1.0 == 0.0 && it in -9.0E15..9.0E15) it.toLong() else it }
    ReadableType.String -> string() ?: JSONObject.NULL
    ReadableType.Map -> map()?.toJson() ?: JSONObject.NULL
    ReadableType.Array -> array()?.toJson() ?: JSONObject.NULL
}

/** A string value, trimmed; null when it is missing, null or blank. */
private fun ReadableMap.optString(key: String): String? = when {
    !hasKey(key) || isNull(key) -> null
    getType(key) != ReadableType.String -> throw IllegalArgumentException("$key must be a string")
    else -> getString(key)?.trim()?.ifEmpty { null }
}

/** A boolean value; null when it is missing or null. */
private fun ReadableMap.optBoolean(key: String): Boolean? = when {
    !hasKey(key) || isNull(key) -> null
    getType(key) != ReadableType.Boolean -> throw IllegalArgumentException("$key must be a boolean")
    else -> getBoolean(key)
}
