import Foundation
@_spi(Bridge) import PersonaClick

/// What JavaScript's promise hears: its value, or the error's code, message and `userInfo`.
public typealias BridgeResolve = (Any?) -> Void
public typealias BridgeReject = (String, String, [String: Any]?) -> Void

/// The namespaces of the SDK contract (`sdk/contract/*.md`): each method calls the native method of the
/// same name on the shop's instance and hands JavaScript its model as a map (`ModelMaps`), or its
/// `PersonaClick.SdkError`. The arguments are read by `NamespaceArgs`; a value of the wrong type rejects with
/// `invalidArgument` before the native SDK is called.
extension PersonaClickNativeImpl {

    /// Runs `call` on the shop's instance; an argument of the wrong type rejects with `invalidArgument`.
    private func run(_ shopId: String, _ reject: @escaping BridgeReject, _ call: (PersonalizationSDK) throws -> Void) {
        guard let sdk = instance(shopId, reject) else { return }
        do {
            try call(sdk)
        } catch let error as ArgumentError {
            reject("invalidArgument", error.message, nil)
        } catch {
            reject("invalidArgument", String(describing: error), nil)
        }
    }

    /// A completion that resolves with `convert` of the value, or rejects with the native error.
    private static func answer<T>(
        _ resolve: @escaping BridgeResolve,
        _ reject: @escaping BridgeReject,
        _ convert: @escaping (T) -> Any?
    ) -> (Result<T, PersonaClick.SdkError>) -> Void {
        { result in
            switch result {
            case .success(let value): resolve(convert(value))
            case .failure(let error): Self.reject(reject, error)
            }
        }
    }

    /// A completion of a method without a result.
    private static func done(_ resolve: @escaping BridgeResolve, _ reject: @escaping BridgeReject) -> (Result<Void, PersonaClick.SdkError>) -> Void {
        answer(resolve, reject) { _ in nil }
    }

    /// An event of `tracking.async` on the shop's tracking line: it goes to the native SDK once the event
    /// JavaScript sent before it was accepted or refused, so the shop's queue gets them in JavaScript's
    /// order. Resolves once the queue took it; rejects with what refused it, which holds back no later event.
    private func accepted(
        _ sdk: PersonalizationSDK,
        _ resolve: @escaping BridgeResolve,
        _ reject: @escaping BridgeReject,
        _ event: @escaping () async throws -> Void
    ) {
        trackingLine(sdk.shopId).send {
            do {
                try await event()
                resolve(nil)
            } catch let error as PersonaClick.SdkError {
                Self.reject(reject, error)
            } catch is CancellationError {
                Self.reject(reject, .cancelled)
            } catch {
                reject("invalidArgument", String(describing: error), nil)
            }
        }
    }

    // MARK: tracking

    @objc public func trackingProductView(_ shopId: String, itemId: String, source: NSDictionary?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let eventSource = try NamespaceArgs.source(source)
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.productView(itemId: itemId, source: eventSource) }
        }
    }

    @objc public func trackingCategoryView(_ shopId: String, categoryId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.categoryView(categoryId: categoryId) }
        }
    }

    @objc public func trackingSearch(_ shopId: String, query: String, results: NSArray?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let resultIds = try Args.optionalStrings(results, "results")
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.search(query: query, results: resultIds) }
        }
    }

    @objc public func trackingAddToCart(_ shopId: String, item: NSDictionary, source: NSDictionary?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let cartItem = try NamespaceArgs.trackingItem(Args(item, path: "item."))
            let eventSource = try NamespaceArgs.source(source)
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.addToCart(item: cartItem, source: eventSource) }
        }
    }

    @objc public func trackingSyncCart(_ shopId: String, items: NSArray, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let cartItems = try NamespaceArgs.trackingItems(items)
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.syncCart(items: cartItems) }
        }
    }

    @objc public func trackingRemoveFromCart(_ shopId: String, itemId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.removeFromCart(itemId: itemId) }
        }
    }

    @objc public func trackingAddToFavorites(_ shopId: String, itemId: String, source: NSDictionary?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let eventSource = try NamespaceArgs.source(source)
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.addToFavorites(itemId: itemId, source: eventSource) }
        }
    }

    @objc public func trackingSyncFavorites(_ shopId: String, itemIds: NSArray, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let favoriteIds = try Args.strings(itemIds, "itemIds")
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.syncFavorites(itemIds: favoriteIds) }
        }
    }

    @objc public func trackingRemoveFromFavorites(_ shopId: String, itemId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.removeFromFavorites(itemId: itemId) }
        }
    }

    /// The request's own `recommendedBy` wins over `source`, as on Android.
    @objc public func trackingPurchase(_ shopId: String, request: NSDictionary, source: NSDictionary?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let purchase = try NamespaceArgs.purchase(request)
            let eventSource = try purchase.recommendedBy ?? NamespaceArgs.source(source)
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.purchase(purchase.request, source: eventSource) }
        }
    }

    @objc public func trackingStoryView(_ shopId: String, storyId: String, slideId: String, code: String?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.storyView(storyId: storyId, slideId: slideId, code: code) }
        }
    }

    @objc public func trackingStoryClick(_ shopId: String, storyId: String, slideId: String, code: String?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.storyClick(storyId: storyId, slideId: slideId, code: code) }
        }
    }

    @objc public func trackingBannerView(_ shopId: String, bannerId: String, code: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.bannerView(bannerId: bannerId, code: code) }
        }
    }

    @objc public func trackingBannerClick(_ shopId: String, bannerId: String, code: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.bannerClick(bannerId: bannerId, code: code) }
        }
    }

    @objc public func trackingPopupShown(_ shopId: String, popupId: Double, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let popup = try Args.int(popupId, "popupId")
            self.accepted(sdk, resolve, reject) { try await sdk.tracking.async.popupShown(popupId: popup) }
        }
    }

    @objc public func trackingCustom(
        _ shopId: String,
        event: String,
        time: NSNumber?,
        category: String?,
        label: String?,
        value: NSNumber?,
        customFields: NSDictionary?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            // 32 bits, as Android's native `custom` takes them: the same calls pass on both platforms.
            let eventTime = try Args.optionalInt32(time, "time")
            let eventValue = try Args.optionalInt32(value, "value")
            let fields = customFields.map(Args.json)
            self.accepted(sdk, resolve, reject) {
                try await sdk.tracking.async.custom(
                    event: event, time: eventTime, category: category, label: label, value: eventValue, customFields: fields
                )
            }
        }
    }

    // MARK: products

    @objc public func productsGetInfo(_ shopId: String, itemId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.products.getInfo(itemId: itemId, completion: Self.answer(resolve, reject) { (product: PersonaClick.Product?) in
                product.map(ModelMaps.product) ?? NSNull()
            })
        }
    }

    @objc public func productsGetList(_ shopId: String, request: NSDictionary?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let listRequest = try NamespaceArgs.productsList(request)
            sdk.products.getList(listRequest, completion: Self.answer(resolve, reject, ModelMaps.productsListResponse))
        }
    }

    @objc public func productsGetCounters(_ shopId: String, itemId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.products.getCounters(itemId: itemId, completion: Self.answer(resolve, reject, ModelMaps.productCountersResponse))
        }
    }

    @objc public func productsGetCategory(_ shopId: String, categoryId: String, request: NSDictionary?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let categoryRequest = try NamespaceArgs.category(request)
            sdk.products.getCategory(categoryId: categoryId, request: categoryRequest, completion: Self.answer(resolve, reject, ModelMaps.categoryResponse))
        }
    }

    // MARK: collections, recommendations

    @objc public func collectionsGet(_ shopId: String, collectionId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.collections.get(collectionId: collectionId, completion: Self.answer(resolve, reject, ModelMaps.collectionResponse))
        }
    }

    @objc public func recommendationsGet(_ shopId: String, code: String, request: NSDictionary?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let blockRequest = try NamespaceArgs.recommendation(request)
            sdk.recommendations.get(code: code, request: blockRequest, completion: Self.answer(resolve, reject, ModelMaps.recommendationResponse))
        }
    }

    // MARK: search

    @objc public func searchBlank(_ shopId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.search.blank(completion: Self.answer(resolve, reject, ModelMaps.searchBlankResponse))
        }
    }

    @objc public func searchInstant(
        _ shopId: String,
        query: String,
        locations: NSArray?,
        excludedMerchants: NSArray?,
        excludedBrands: NSArray?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.search.instant(
                query: query,
                locations: try Args.optionalStrings(locations, "locations"),
                excludedMerchants: try Args.optionalStrings(excludedMerchants, "excludedMerchants"),
                excludedBrands: try Args.optionalStrings(excludedBrands, "excludedBrands"),
                completion: Self.answer(resolve, reject, ModelMaps.searchInstantResponse)
            )
        }
    }

    @objc public func searchFull(_ shopId: String, query: String, request: NSDictionary?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let searchRequest = try NamespaceArgs.searchFull(request)
            sdk.search.full(query: query, request: searchRequest, completion: Self.answer(resolve, reject, ModelMaps.searchFullResponse))
        }
    }

    @objc public func searchAgentDialog(_ shopId: String, sessionId: NSNumber?, locations: NSArray?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.search.agentDialog(
                sessionId: try Args.optionalInt(sessionId, "sessionId"),
                locations: try Args.optionalStrings(locations, "locations"),
                completion: Self.answer(resolve, reject, ModelMaps.agentDialogResponse)
            )
        }
    }

    @objc public func searchAgent(
        _ shopId: String,
        message: String,
        sessionId: NSNumber?,
        locations: NSArray?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.search.agent(
                message: message,
                sessionId: try Args.optionalInt(sessionId, "sessionId"),
                locations: try Args.optionalStrings(locations, "locations"),
                completion: Self.answer(resolve, reject, ModelMaps.agentResponse)
            )
        }
    }

    // MARK: cart

    @objc public func cartGet(_ shopId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.cart.get(completion: Self.answer(resolve, reject) { (items: [CartItem]) in items.map(ModelMaps.cartItem) })
        }
    }

    @objc public func cartClear(
        _ shopId: String,
        shopSecret: String,
        email: String?,
        phone: String?,
        loyaltyId: String?,
        externalId: String?,
        telegramId: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.cart.clear(
                shopSecret: shopSecret, email: email, phone: phone, loyaltyId: loyaltyId, externalId: externalId,
                telegramId: telegramId, completion: Self.done(resolve, reject)
            )
        }
    }

    // MARK: profile

    @objc public func profileGet(_ shopId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.profile.get(completion: Self.answer(resolve, reject, ModelMaps.profile))
        }
    }

    @objc public func profileSet(_ shopId: String, request: NSDictionary, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let update = try NamespaceArgs.profileUpdate(request)
            sdk.profile.set(update, completion: Self.done(resolve, reject))
        }
    }

    @objc public func profileGetLastOrder(_ shopId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.profile.getLastOrder(completion: Self.answer(resolve, reject, ModelMaps.products))
        }
    }

    @objc public func profileGetOrders(
        _ shopId: String,
        shopSecret: String,
        did: String?,
        email: String?,
        phone: String?,
        loyaltyId: String?,
        externalId: String?,
        dateFrom: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.profile.getOrders(
                shopSecret: shopSecret, did: did, email: email, phone: phone, loyaltyId: loyaltyId, externalId: externalId,
                dateFrom: dateFrom, completion: Self.answer(resolve, reject) { (orders: [Order]) in orders.map(ModelMaps.order) }
            )
        }
    }

    // MARK: subscriptions

    @objc public func subscriptionsManage(_ shopId: String, request: NSDictionary, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            let update = try NamespaceArgs.subscriptionsUpdate(request)
            sdk.subscriptions.manage(update, completion: Self.done(resolve, reject))
        }
    }

    @objc public func subscriptionsCheck(_ shopId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.subscriptions.check(completion: Self.answer(resolve, reject, ModelMaps.subscriptionStatus))
        }
    }

    @objc public func subscriptionsSubscribeForPriceDrop(
        _ shopId: String,
        itemId: String,
        currentPrice: Double,
        email: String?,
        phone: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.subscriptions.subscribeForPriceDrop(
                itemId: itemId, currentPrice: currentPrice, email: email, phone: phone, completion: Self.done(resolve, reject)
            )
        }
    }

    @objc public func subscriptionsUnsubscribeFromPriceDrop(
        _ shopId: String,
        itemIds: NSArray,
        email: String?,
        phone: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.subscriptions.unsubscribeFromPriceDrop(
                itemIds: try Args.strings(itemIds, "itemIds"), email: email, phone: phone, completion: Self.done(resolve, reject)
            )
        }
    }

    @objc public func subscriptionsSubscribeForBackInStock(
        _ shopId: String,
        itemId: String,
        properties: NSDictionary?,
        email: String?,
        phone: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.subscriptions.subscribeForBackInStock(
                itemId: itemId, properties: try NamespaceArgs.backInStock(properties), email: email, phone: phone,
                completion: Self.done(resolve, reject)
            )
        }
    }

    @objc public func subscriptionsUnsubscribeFromBackInStock(
        _ shopId: String,
        itemIds: NSArray,
        email: String?,
        phone: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.subscriptions.unsubscribeFromBackInStock(
                itemIds: try Args.strings(itemIds, "itemIds"), email: email, phone: phone, completion: Self.done(resolve, reject)
            )
        }
    }

    // MARK: segments

    @objc public func segmentsAdd(_ shopId: String, segmentId: Double, email: String?, phone: String?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.segments.add(segmentId: try Args.int(segmentId, "segmentId"), email: email, phone: phone, completion: Self.done(resolve, reject))
        }
    }

    @objc public func segmentsRemove(_ shopId: String, segmentId: Double, email: String?, phone: String?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.segments.remove(segmentId: try Args.int(segmentId, "segmentId"), email: email, phone: phone, completion: Self.done(resolve, reject))
        }
    }

    @objc public func segmentsGet(_ shopId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.segments.get(completion: Self.answer(resolve, reject) { (segments: [PersonaClick.Segment]) in segments.map(ModelMaps.segment) })
        }
    }

    // MARK: notifications — receiving stays in JavaScript; the events and the token go here.

    @objc public func notificationsTrack(
        _ shopId: String,
        event: String,
        code: String,
        type: String,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            guard let pushEvent = PersonaClick.PushEvent(rawValue: event) else {
                throw ArgumentError(message: "Unknown push event: \(event)")
            }
            // On the shop's line, as its tracking events: they share the queue.
            self.accepted(sdk, resolve, reject) {
                switch pushEvent {
                case .delivered: try await sdk.notifications.trackDelivered(code: code, type: type)
                case .opened: try await sdk.notifications.trackOpened(code: code, type: type)
                case .clicked: try await sdk.notifications.trackClicked(code: code, type: type)
                case .closed: try await sdk.notifications.trackClosed(code: code, type: type)
                }
            }
        }
    }

    @objc public func notificationsSetPushToken(
        _ shopId: String,
        token: String,
        provider: String,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            guard let pushProvider = PersonaClick.PushProvider(rawValue: provider) else {
                throw ArgumentError(message: "Unknown push provider: \(provider)")
            }
            sdk.notifications.setPushToken(token, provider: pushProvider, completion: Self.done(resolve, reject))
        }
    }

    @objc public func notificationsGetPushToken(
        _ shopId: String,
        provider: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            let wanted = try provider.map { name -> PersonaClick.PushProvider in
                guard let value = PersonaClick.PushProvider(rawValue: name) else { throw ArgumentError(message: "Unknown push provider: \(name)") }
                return value
            }
            let token = sdk.notifications.getPushToken(provider: wanted)
            resolve(token.map { ["token": $0.token, "provider": $0.provider.rawValue] } ?? NSNull())
        }
    }

    @objc public func notificationsGetHistory(
        _ shopId: String,
        shopSecret: String,
        type: String,
        phone: String?,
        email: String?,
        externalId: String?,
        loyaltyId: String?,
        channel: String?,
        limit: NSNumber?,
        page: NSNumber?,
        dateFrom: String?,
        did: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.notifications.getHistory(
                shopSecret: shopSecret, type: type, phone: phone, email: email, externalId: externalId, loyaltyId: loyaltyId,
                channel: channel, limit: try Args.optionalInt(limit, "limit"), page: try Args.optionalInt(page, "page"),
                dateFrom: dateFrom, did: did, completion: Self.answer(resolve, reject, ModelMaps.notificationsHistory)
            )
        }
    }

    // MARK: stories, predict

    @objc public func storiesGet(_ shopId: String, code: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.stories.get(code: code, completion: Self.answer(resolve, reject, ModelMaps.storiesBlock))
        }
    }

    @objc public func predictGetProbabilityToPurchase(_ shopId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.predict.getProbabilityToPurchase(completion: Self.answer(resolve, reject, ModelMaps.purchaseProbability))
        }
    }

    // MARK: loyalty

    @objc public func loyaltyJoin(
        _ shopId: String,
        phone: String,
        firstName: String?,
        lastName: String?,
        gender: String?,
        birthday: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.loyalty.join(
                phone: phone, firstName: firstName, lastName: lastName, gender: try NamespaceArgs.gender(gender),
                birthday: birthday, completion: Self.answer(resolve, reject, ModelMaps.loyaltyMember)
            )
        }
    }

    @objc public func loyaltyGetStatus(_ shopId: String, phone: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.loyalty.getStatus(phone: phone, completion: Self.answer(resolve, reject, ModelMaps.loyaltyStatus))
        }
    }

    @objc public func loyaltyGetPromotions(
        _ shopId: String,
        locationId: String?,
        promoCodes: NSArray?,
        chargeBonuses: NSNumber?,
        currentTime: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.loyalty.getPromotions(
                locationId: locationId,
                promoCodes: try Args.optionalStrings(promoCodes, "promoCodes"),
                chargeBonuses: try Args.optionalBool(chargeBonuses, "chargeBonuses"),
                currentTime: currentTime,
                completion: Self.answer(resolve, reject) { (promotions: [LoyaltyPromotion]) in promotions.map(ModelMaps.loyaltyPromotion) }
            )
        }
    }

    // MARK: sliders

    @objc public func slidersGet(_ shopId: String, code: String, tags: NSArray?, locationId: String?, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.sliders.get(
                code: code, tags: try Args.optionalStrings(tags, "tags"), locationId: locationId,
                completion: Self.answer(resolve, reject, ModelMaps.slider)
            )
        }
    }

    // MARK: reviews

    @objc public func reviewsCreateNps(
        _ shopId: String,
        rate: Double,
        channel: String,
        category: String,
        orderId: String?,
        comment: String?,
        label: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.reviews.createNps(
                rate: try Args.int(rate, "rate"), channel: channel, category: category, orderId: orderId, comment: comment,
                label: label, completion: Self.answer(resolve, reject, ModelMaps.pollReview)
            )
        }
    }

    @objc public func reviewsCreateCsat(
        _ shopId: String,
        rate: Double,
        channel: String,
        campaign: String,
        orderId: String?,
        comment: String?,
        label: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.reviews.createCsat(
                rate: try Args.int(rate, "rate"), channel: channel, campaign: campaign, orderId: orderId, comment: comment,
                label: label, completion: Self.answer(resolve, reject, ModelMaps.pollReview)
            )
        }
    }

    @objc public func reviewsCreateCes(
        _ shopId: String,
        rate: Double,
        channel: String,
        campaign: String,
        orderId: String?,
        comment: String?,
        label: String?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.reviews.createCes(
                rate: try Args.int(rate, "rate"), channel: channel, campaign: campaign, orderId: orderId, comment: comment,
                label: label, completion: Self.answer(resolve, reject, ModelMaps.pollReview)
            )
        }
    }

    @objc public func reviewsGetNpsCategories(_ shopId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.reviews.getNpsCategories(completion: Self.answer(resolve, reject) { (list: [NpsCategory]) in list.map(ModelMaps.npsCategory) })
        }
    }

    @objc public func reviewsGetNpsChannels(_ shopId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.reviews.getNpsChannels(completion: Self.answer(resolve, reject) { (list: [PollChannel]) in list.map(ModelMaps.pollChannel) })
        }
    }

    @objc public func reviewsGetCsatCampaigns(_ shopId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.reviews.getCsatCampaigns(completion: Self.answer(resolve, reject) { (list: [CsatCampaign]) in list.map(ModelMaps.csatCampaign) })
        }
    }

    @objc public func reviewsGetCesCampaigns(_ shopId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.reviews.getCesCampaigns(completion: Self.answer(resolve, reject) { (list: [CesCampaign]) in list.map(ModelMaps.cesCampaign) })
        }
    }

    @objc public func reviewsGetProductReviews(
        _ shopId: String,
        itemId: String,
        limit: NSNumber?,
        offset: NSNumber?,
        resolve: @escaping BridgeResolve,
        reject: @escaping BridgeReject
    ) {
        run(shopId, reject) { sdk in
            sdk.reviews.getProductReviews(
                itemId: itemId, limit: try Args.optionalInt(limit, "limit"), offset: try Args.optionalInt(offset, "offset"),
                completion: Self.answer(resolve, reject, ModelMaps.productReviewsResponse)
            )
        }
    }

    @objc public func reviewsGetClientReviews(_ shopId: String, orderId: String, resolve: @escaping BridgeResolve, reject: @escaping BridgeReject) {
        run(shopId, reject) { sdk in
            sdk.reviews.getClientReviews(orderId: orderId, completion: Self.answer(resolve, reject) { (list: [ClientReview]) in list.map(ModelMaps.clientReview) })
        }
    }
}
