import Foundation
@_spi(Bridge) import PersonaClick

/// The native SDK's models as the maps JavaScript gets: the contract's field names, every field of the
/// model there and `NSNull` when it has none, an enumeration's value by the contract's name, a free
/// field as the JSON it holds. The same maps as the Android module's.
enum ModelMaps {

    /// The fields in the contract's order; an absent one is `NSNull`.
    private static func map(_ fields: KeyValuePairs<String, Any?>) -> [String: Any] {
        var result: [String: Any] = [:]
        for (key, value) in fields {
            result[key] = value ?? NSNull()
        }
        return result
    }

    // MARK: products

    static func product(_ p: PersonaClick.Product) -> [String: Any] {
        map([
            "id": p.id,
            "groupId": p.groupId,
            "name": p.name,
            "brand": p.brand,
            "model": p.model,
            "description": p.description,
            "barcode": p.barcode,
            "url": p.url,
            "deeplinkAndroid": p.deeplinkAndroid,
            "deeplinkIos": p.deeplinkIos,
            "imageUrl": p.imageUrl,
            "picture": p.picture,
            "resizedImages": p.resizedImages,
            "price": p.price,
            "priceFormatted": p.priceFormatted,
            "priceFull": p.priceFull,
            "priceFullFormatted": p.priceFullFormatted,
            "oldPrice": p.oldPrice,
            "oldPriceFormatted": p.oldPriceFormatted,
            "oldPriceFull": p.oldPriceFull,
            "oldPriceFullFormatted": p.oldPriceFullFormatted,
            "currency": p.currency,
            "discountPercent": p.discountPercent,
            "discountFormatted": p.discountFormatted,
            "salesRate": p.salesRate,
            "relativeSalesRate": p.relativeSalesRate,
            "rating": p.rating,
            "isNew": p.isNew,
            "stockQuantity": p.stockQuantity,
            "categoryIds": p.categoryIds,
            "categories": p.categories?.map(productCategory),
            "params": p.params?.map(productParam),
            "locationIds": p.locationIds,
        ])
    }

    static func products(_ products: [PersonaClick.Product]) -> [[String: Any]] {
        products.map(product)
    }

    static func productCategory(_ c: PersonaClick.ProductCategory) -> [String: Any] {
        map([
            "id": c.id,
            "name": c.name,
            "url": c.url,
            "parentId": c.parentId,
            "level": c.level,
            "count": c.count,
            "alias": c.alias,
        ])
    }

    static func productParam(_ p: PersonaClick.ProductParam) -> [String: Any] {
        map([
            "key": p.key,
            "values": p.values,
        ])
    }

    static func location(_ l: PersonaClick.Location) -> [String: Any] {
        map([
            "id": l.id,
            "name": l.name,
            "type": l.type,
        ])
    }

    static func brand(_ b: PersonaClick.Brand) -> [String: Any] {
        map([
            "name": b.name,
            "count": b.count,
        ])
    }

    static func searchFilter(_ f: PersonaClick.SearchFilter) -> [String: Any] {
        map([
            "count": f.count,
            "priority": f.priority,
            "values": f.values,
            "min": f.min,
            "max": f.max,
        ])
    }

    private static func searchFilters(_ filters: [String: PersonaClick.SearchFilter]?) -> [String: Any]? {
        filters?.mapValues(searchFilter)
    }

    static func industrialFilters(_ f: PersonaClick.IndustrialFilters) -> [String: Any] {
        map([
            "colors": f.colors?.map(colorFilter),
            "fashionSizes": f.fashionSizes?.map(sizeFilter),
        ])
    }

    static func colorFilter(_ f: PersonaClick.ColorFilter) -> [String: Any] {
        map([
            "color": f.color,
            "count": f.count,
        ])
    }

    static func sizeFilter(_ f: PersonaClick.SizeFilter) -> [String: Any] {
        map([
            "size": f.size,
            "count": f.count,
        ])
    }

    static func priceRange(_ r: PersonaClick.PriceRange) -> [String: Any] {
        map([
            "min": r.min,
            "max": r.max,
        ])
    }

    static func priceInterval(_ i: PersonaClick.PriceInterval) -> [String: Any] {
        map([
            "from": i.from,
            "to": i.to,
            "count": i.count,
        ])
    }

    static func productsListResponse(_ r: PersonaClick.ProductsListResponse) -> [String: Any] {
        map([
            "productsTotal": r.productsTotal,
            "products": products(r.products),
            "categories": r.categories?.map(productCategory),
            "brands": r.brands?.map(brand),
            "locations": r.locations?.map(location),
            "filters": searchFilters(r.filters),
            "industrialFilters": r.industrialFilters.map(industrialFilters),
            "priceRange": r.priceRange.map(priceRange),
            "priceRanges": r.priceRanges?.map(priceInterval),
            "priceMedian": r.priceMedian,
        ])
    }

    static func categoryResponse(_ r: PersonaClick.CategoryResponse) -> [String: Any] {
        map([
            "productsTotal": r.productsTotal,
            "products": products(r.products),
            "categories": r.categories?.map(productCategory),
            "brands": r.brands?.map(brand),
            "filters": searchFilters(r.filters),
            "priceRange": r.priceRange.map(priceRange),
            "priceRanges": r.priceRanges?.map(priceInterval),
            "priceMedian": r.priceMedian,
        ])
    }

    static func productCountersResponse(_ r: ProductCountersResponse) -> [String: Any] {
        map([
            "daily": r.daily.map(productCounter),
            "now": r.now.map(productCounter),
            "triggers": r.triggers.map(productCounterTriggers),
        ])
    }

    static func productCounter(_ c: ProductCounter) -> [String: Any] {
        map([
            "view": c.view,
            "cart": c.cart,
            "purchase": c.purchase,
        ])
    }

    static func productCounterTriggers(_ t: ProductCounterTriggers) -> [String: Any] {
        map([
            "backInStock": t.backInStock,
            "priceDrop": t.priceDrop,
        ])
    }

    // MARK: collections, recommendations

    static func collectionResponse(_ r: PersonaClick.CollectionResponse) -> [String: Any] {
        map([
            "products": products(r.products),
        ])
    }

    static func recommendationResponse(_ r: PersonaClick.RecommendationResponse) -> [String: Any] {
        map([
            "id": r.id,
            "title": r.title,
            "link": r.link,
            "products": products(r.products),
            "itemIds": r.itemIds,
        ])
    }

    // MARK: search

    static func searchBlankResponse(_ r: PersonaClick.SearchBlankResponse) -> [String: Any] {
        map([
            "products": products(r.products),
            "lastProducts": r.lastProducts,
            "lastQueries": r.lastQueries?.map(query),
            "suggests": r.suggests?.map(query),
            "popularCategories": r.popularCategories?.map(popularItem),
            "popularBrands": r.popularBrands?.map(popularItem),
            "popularLinks": r.popularLinks?.map(popularItem),
        ])
    }

    static func searchInstantResponse(_ r: PersonaClick.SearchInstantResponse) -> [String: Any] {
        map([
            "searchQuery": r.searchQuery,
            "searchQueryOriginal": r.searchQueryOriginal,
            "clarification": r.clarification,
            "productsTotal": r.productsTotal,
            "products": products(r.products),
            "categories": r.categories?.map(productCategory),
            "queries": r.queries?.map(query),
            "locations": r.locations?.map(location),
            "redirect": r.redirect.map(searchRedirect),
        ])
    }

    static func searchFullResponse(_ r: PersonaClick.SearchFullResponse) -> [String: Any] {
        map([
            "searchQuery": r.searchQuery,
            "searchQueryOriginal": r.searchQueryOriginal,
            "clarification": r.clarification,
            "productsTotal": r.productsTotal,
            "products": products(r.products),
            "categories": r.categories?.map(productCategory),
            "brands": r.brands?.map(brand),
            "locations": r.locations?.map(location),
            "filters": searchFilters(r.filters),
            "industrialFilters": r.industrialFilters.map(industrialFilters),
            "priceRange": r.priceRange.map(priceRange),
            "priceRanges": r.priceRanges?.map(priceInterval),
            "priceMedian": r.priceMedian,
        ])
    }

    static func query(_ q: PersonaClick.Query) -> [String: Any] {
        map([
            "name": q.name,
            "url": q.url,
            "score": q.score,
        ])
    }

    static func popularItem(_ i: PersonaClick.PopularItem) -> [String: Any] {
        map([
            "name": i.name,
            "url": i.url,
        ])
    }

    static func searchRedirect(_ r: PersonaClick.SearchRedirect) -> [String: Any] {
        map([
            "query": r.query,
            "url": r.url,
            "deeplink": r.deeplink,
        ])
    }

    static func agentDialogResponse(_ r: PersonaClick.AgentDialogResponse) -> [String: Any] {
        map([
            "sessions": r.sessions.map(agentSession),
            "session": r.session.map(agentSession),
        ])
    }

    static func agentResponse(_ r: PersonaClick.AgentResponse) -> [String: Any] {
        map([
            "session": agentSession(r.session),
            "message": agentMessage(r.message),
        ])
    }

    static func agentSession(_ s: PersonaClick.AgentSession) -> [String: Any] {
        map([
            "id": s.id,
            "title": s.title,
            "updatedAt": s.updatedAt,
            "messages": s.messages.map(agentMessage),
        ])
    }

    /// `role` is an open set: its value as it came (`user`, `assistant`).
    static func agentMessage(_ m: PersonaClick.AgentMessage) -> [String: Any] {
        map([
            // `NSNull` for a message the answer gave no id — never 0.
            "id": m.id,
            "role": m.role?.rawValue,
            "content": m.content,
            "createdAt": m.createdAt,
            "products": m.products.map(agentProduct),
        ])
    }

    static func agentProduct(_ p: PersonaClick.AgentProduct) -> [String: Any] {
        map([
            "id": p.id,
            "name": p.name,
            "price": p.price,
            "oldPrice": p.oldPrice,
            "priceFormatted": p.priceFormatted,
            "oldPriceFormatted": p.oldPriceFormatted,
            "picture": p.picture,
            "url": p.url,
            "reason": p.reason,
        ])
    }

    // MARK: cart, profile

    static func cartItem(_ i: CartItem) -> [String: Any] {
        map([
            "id": i.id,
            "quantity": i.quantity,
        ])
    }

    static func profile(_ p: PersonaClick.Profile) -> [String: Any] {
        map([
            "id": p.id,
            "hasEmail": p.hasEmail,
            "emailRegisteredAt": p.emailRegisteredAt,
            "gender": p.gender.map(gender),
            "computedGender": p.computedGender.map(gender),
            "boughtSomething": p.boughtSomething,
            // The contract's: no properties are an empty map, not null — the server's `[]` too (the SDK reads
            // only a map), as on Android.
            "customProperties": json(p.customProperties ?? [:]),
        ])
    }

    /// `male` or `female`, the contract's names.
    static func gender(_ g: Gender) -> String {
        switch g {
        case .male: return "male"
        case .female: return "female"
        }
    }

    /// The released model `Order` (decision 0006), by its own field names.
    static func order(_ o: Order) -> [String: Any] {
        map([
            "internalId": o.internalId,
            "id": o.id,
            "date": o.date,
            "value": o.value,
            "cashValue": o.cashValue,
            "bonusesValue": o.bonusesValue,
            "deliveryValue": o.deliveryValue,
            "promocode": o.promocode,
            "deliveryDate": o.deliveryDate,
            "internalStatus": o.internalStatus,
            "stream": o.stream,
            "channel": o.channel,
            "taxFree": o.taxFree,
            "deliveryType": o.deliveryType,
            "deliveryAddress": o.deliveryAddress,
            "orderStatus": o.orderStatus,
            "paymentType": o.paymentType,
            "items": o.items.map(orderItem),
        ])
    }

    static func orderItem(_ i: OrderItem) -> [String: Any] {
        map([
            "amount": i.amount,
            "price": i.price,
            "status": i.status,
            "originalPrice": i.originalPrice,
            "barcode": i.barcode,
            "lineId": i.lineId,
            "cancelReason": i.cancelReason,
            "item": i.item.map(orderProduct),
        ])
    }

    /// The product of an order line: the released iOS `Product`, under the contract's `Product` names.
    /// It has no group, Android deep link, rating, stock, categories or locations — those are `NSNull`;
    /// its texts it has not are empty, as the released model keeps them.
    static func orderProduct(_ p: Product) -> [String: Any] {
        map([
            "id": p.id,
            "groupId": nil,
            "name": p.name,
            "brand": p.brand,
            "model": p.model,
            "description": p.description,
            "barcode": p.barcode,
            "url": p.url,
            "deeplinkAndroid": nil,
            "deeplinkIos": p.deeplinkIos,
            "imageUrl": p.imageUrl,
            "picture": p.resizedImageUrl,
            "resizedImages": p.resizedImages,
            "price": p.price,
            "priceFormatted": p.priceFormatted,
            "priceFull": p.priceFull,
            "priceFullFormatted": p.priceFullFormatted,
            "oldPrice": p.oldPrice,
            "oldPriceFormatted": p.oldPriceFormatted,
            "oldPriceFull": p.oldPriceFull,
            "oldPriceFullFormatted": p.oldPriceFullFormatted,
            "currency": p.currency,
            // The SDK's: `discount` when `discount_percent` is not there, as Android's.
            "discountPercent": p.discountPercent,
            "discountFormatted": p.discountFormatted,
            "salesRate": p.salesRate,
            // The model keeps a Float: its shortest form, so 0.35 stays 0.35 and not 0.3499999940395355 as on
            // Android, which reads a Double.
            "relativeSalesRate": Double(String(p.relativeSalesRate)) ?? Double(p.relativeSalesRate),
            "rating": nil,
            "isNew": p.isNew ?? false,
            "stockQuantity": nil,
            "categoryIds": nil,
            "categories": nil,
            "params": p.params.map { $0.map(json) },
            "locationIds": nil,
        ])
    }

    // MARK: subscriptions, segments

    static func subscriptionStatus(_ s: PersonaClick.SubscriptionStatus) -> [String: Any] {
        map([
            "exists": s.exists,
            "emailBulk": s.emailBulk,
            "emailChain": s.emailChain,
            "emailTransactional": s.emailTransactional,
            "smsBulk": s.smsBulk,
            "smsChain": s.smsChain,
            "smsTransactional": s.smsTransactional,
            "webPushBulk": s.webPushBulk,
            "webPushChain": s.webPushChain,
            "webPushTransactional": s.webPushTransactional,
            "mobilePushBulk": s.mobilePushBulk,
            "mobilePushChain": s.mobilePushChain,
            "mobilePushTransactional": s.mobilePushTransactional,
            "telegramBulk": s.telegramBulk,
            "telegramChain": s.telegramChain,
            "telegramTransactional": s.telegramTransactional,
            "whatsappBulk": s.whatsappBulk,
            "whatsappChain": s.whatsappChain,
            "whatsappTransactional": s.whatsappTransactional,
            "maxBulk": s.maxBulk,
            "maxChain": s.maxChain,
            "maxTransactional": s.maxTransactional,
            "walletBulk": s.walletBulk,
            "walletChain": s.walletChain,
            "walletTransactional": s.walletTransactional,
            "hasWebPush": s.hasWebPush,
            "hasMobilePush": s.hasMobilePush,
            "emailInvalid": s.emailInvalid,
            "emailBlacklisted": s.emailBlacklisted,
            "emailBounced": s.emailBounced,
            "emailSuppressed": s.emailSuppressed,
            "emailConfirmed": s.emailConfirmed,
        ])
    }

    /// `type` is `""` when the server gives none, as on Android.
    static func segment(_ s: PersonaClick.Segment) -> [String: Any] {
        map([
            "id": s.id,
            "type": s.type,
        ])
    }

    // MARK: notifications

    /// The history as the Android module hands it over: `{ status, payload: { messages } }`, each message
    /// under the names of the server's fields and its statistics as one object (the server sends one; the
    /// SDK keeps it as the one element of a list). A text the SDK keeps as empty when the server sent none
    /// is `NSNull`, as on Android.
    static func notificationsHistory(_ r: UserPayloadResponse) -> [String: Any] {
        map([
            "status": r.status,
            "payload": map(["messages": r.notifications.map(notification)]),
        ])
    }

    static func notification(_ n: UserNotificationsResponse) -> [String: Any] {
        map([
            "body": text(n.bodyData),
            "campaignId": n.campaignId,
            "channel": text(n.channel),
            "code": text(n.codeId),
            "date": text(n.dateString),
            "icon": text(n.icon),
            "picture": text(n.picture),
            "sentAt": text(n.dateSentAt),
            "statistics": n.statistics.first.map(notificationStatistics),
            "subject": text(n.subject),
            "type": text(n.type),
            "url": text(n.url),
        ])
    }

    static func notificationStatistics(_ s: UserNotificationsStatistics) -> [String: Any] {
        map([
            "clicked": s.clicked,
            "complained": s.complained,
            "hardBounced": s.hardBounced,
            "opened": s.opened,
            "purchased": s.purchased,
            "softBounced": s.softBounced,
            "unsubscribed": s.unsubscribed,
        ])
    }

    /// A text of a model that keeps "" for none: nil then.
    private static func text(_ value: String?) -> String? {
        guard let value = value, !value.isEmpty else { return nil }
        return value
    }

    /// The value an `Optional` holds, or nil; any other value as it is.
    private static func unwrapped(_ value: Any) -> Any? {
        let mirror = Mirror(reflecting: value)
        guard mirror.displayStyle == .optional else { return value }
        return mirror.children.first.map { unwrapped($0.value) } ?? nil
    }

    // MARK: stories

    static func storiesBlock(_ b: StoriesBlock) -> [String: Any] {
        map([
            "id": b.id,
            "stories": b.stories.map(story),
        ])
    }

    static func story(_ s: Story) -> [String: Any] {
        map([
            "id": s.id,
            "name": s.name,
            "avatar": s.avatar,
            "viewed": s.viewed,
            "pinned": s.pinned,
            "startPosition": s.startPosition,
            "slides": s.slides.map(storySlide),
        ])
    }

    static func storySlide(_ s: StorySlide) -> [String: Any] {
        map([
            "id": s.id,
            "type": storySlideType(s.type),
            "background": s.background,
            "backgroundColor": s.backgroundColor,
            "preview": s.preview,
            "duration": s.duration,
            "elements": s.elements.map(storyElement),
        ])
    }

    static func storySlideType(_ t: StorySlideType) -> String {
        switch t {
        case .image: return "image"
        case .video: return "video"
        case .product: return "product"
        }
    }

    /// One of four kinds by `type`: `button`, `product`, `products`, `textBlock`, with the kind's fields.
    static func storyElement(_ e: StoryElement) -> [String: Any] {
        var element: [String: Any]
        switch e {
        case .button(let button):
            element = storyButton(button)
            element["type"] = "button"
        case .product(let product):
            element = storyProductElement(product)
            element["type"] = "product"
        case .products(let products):
            element = storyProductsElement(products)
            element["type"] = "products"
        case .textBlock(let text):
            element = storyTextBlock(text)
            element["type"] = "textBlock"
        }
        return element
    }

    static func storyButton(_ b: StoryButtonElement) -> [String: Any] {
        map([
            "title": b.title,
            "link": b.link,
            "linkAndroid": b.linkAndroid,
            "linkIos": b.linkIos,
            "background": b.background,
            "color": b.color,
            "textBold": b.textBold,
        ])
    }

    static func storyProductElement(_ p: StoryProductElement) -> [String: Any] {
        map([
            "title": p.title,
            "item": p.item.map(storyProduct),
        ])
    }

    static func storyProductsElement(_ p: StoryProductsElement) -> [String: Any] {
        map([
            "showLabel": p.showLabel,
            "hideLabel": p.hideLabel,
            "products": p.products.map(storyProduct),
        ])
    }

    static func storyTextBlock(_ t: StoryTextBlockElement) -> [String: Any] {
        map([
            "text": t.text,
            "fontSize": t.fontSize,
            "fontType": t.fontType,
            "bold": t.bold,
            "italic": t.italic,
            "textAlign": t.textAlign,
            "textColor": t.textColor,
            "backgroundColor": t.backgroundColor,
            "backgroundOpacity": t.backgroundOpacity,
            "lineSpacing": t.lineSpacing,
            "yOffset": t.yOffset,
            "promocode": t.promocode,
        ])
    }

    static func storyProduct(_ p: StoryProduct) -> [String: Any] {
        map([
            "id": p.id,
            "name": p.name,
            "brand": p.brand,
            "picture": p.picture,
            "imageUrl": p.imageUrl,
            "price": p.price,
            "priceFormatted": p.priceFormatted,
            "oldPrice": p.oldPrice,
            "oldPriceFormatted": p.oldPriceFormatted,
            "discountPercent": p.discountPercent,
            "promocode": p.promocode,
            "priceWithPromocode": p.priceWithPromocode,
            "priceWithPromocodeFormatted": p.priceWithPromocodeFormatted,
            "currency": p.currency,
            "url": p.url,
            "deeplinkAndroid": p.deeplinkAndroid,
            "deeplinkIos": p.deeplinkIos,
        ])
    }

    // MARK: predict, loyalty, sliders

    static func purchaseProbability(_ p: PurchaseProbability) -> [String: Any] {
        map([
            "probability": p.probability,
            "clientId": p.clientId,
        ])
    }

    static func loyaltyMember(_ m: LoyaltyMember) -> [String: Any] {
        map([
            "identifier": m.identifier,
        ])
    }

    static func loyaltyStatus(_ s: LoyaltyStatus) -> [String: Any] {
        map([
            "isMember": s.isMember,
            "level": s.level.map(loyaltyLevel),
        ])
    }

    static func loyaltyLevel(_ l: LoyaltyLevel) -> [String: Any] {
        map([
            "code": l.code,
            "name": l.name,
            "expirationDate": l.expirationDate,
        ])
    }

    static func loyaltyPromotion(_ p: LoyaltyPromotion) -> [String: Any] {
        map([
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "startDate": p.startDate,
            "finishDate": p.finishDate,
            "stream": p.stream,
            "badgeLabel": p.badgeLabel,
            "badgeColor": p.badgeColor,
            "rewardType": p.rewardType.map(loyaltyRewardType),
        ])
    }

    /// `discount`, `bonusesEarn`, `bonusesUsage`, the contract's names.
    static func loyaltyRewardType(_ t: LoyaltyRewardType) -> String {
        switch t {
        case .discount: return "discount"
        case .bonusesEarn: return "bonusesEarn"
        case .bonusesUsage: return "bonusesUsage"
        }
    }

    static func slider(_ s: Slider) -> [String: Any] {
        map([
            "code": s.code,
            "width": s.width,
            "height": s.height,
            "banners": s.banners.map(sliderBanner),
        ])
    }

    static func sliderBanner(_ b: SliderBanner) -> [String: Any] {
        map([
            "id": b.id,
            "code": b.code,
            "imageUrl": b.imageUrl,
            "url": b.url,
            "deeplinkIos": b.deeplinkIos,
            "deeplinkAndroid": b.deeplinkAndroid,
            "html": b.html,
        ])
    }

    // MARK: reviews

    static func pollReview(_ r: PollReview) -> [String: Any] {
        map([
            "id": r.id,
        ])
    }

    static func npsCategory(_ c: NpsCategory) -> [String: Any] {
        map([
            "code": c.code,
            "name": c.name,
            "detractorQuestion": c.detractorQuestion,
            "passiveQuestion": c.passiveQuestion,
            "promoterQuestion": c.promoterQuestion,
            "detractorSuccess": c.detractorSuccess,
            "passiveSuccess": c.passiveSuccess,
            "promoterSuccess": c.promoterSuccess,
            "buttonLabel": c.buttonLabel,
        ])
    }

    static func csatCampaign(_ c: CsatCampaign) -> [String: Any] {
        map([
            "code": c.code,
            "name": c.name,
            "dissatisfiedQuestion": c.dissatisfiedQuestion,
            "neutralQuestion": c.neutralQuestion,
            "satisfiedQuestion": c.satisfiedQuestion,
            "dissatisfiedSuccess": c.dissatisfiedSuccess,
            "neutralSuccess": c.neutralSuccess,
            "satisfiedSuccess": c.satisfiedSuccess,
            "buttonLabel": c.buttonLabel,
        ])
    }

    static func cesCampaign(_ c: CesCampaign) -> [String: Any] {
        map([
            "code": c.code,
            "name": c.name,
            "difficultQuestion": c.difficultQuestion,
            "neutralQuestion": c.neutralQuestion,
            "easyQuestion": c.easyQuestion,
            "difficultSuccess": c.difficultSuccess,
            "neutralSuccess": c.neutralSuccess,
            "easySuccess": c.easySuccess,
            "buttonLabel": c.buttonLabel,
        ])
    }

    static func pollChannel(_ c: PollChannel) -> [String: Any] {
        map([
            "code": c.code,
            "name": c.name,
        ])
    }

    static func productReviewsResponse(_ r: ProductReviewsResponse) -> [String: Any] {
        map([
            "summary": productRatingSummary(r.summary),
            "reviews": r.reviews.map(productReview),
        ])
    }

    /// `ratings`: the rating `"1"`…`"5"` → how many reviews have it (a map of JavaScript has string keys).
    static func productRatingSummary(_ s: ProductRatingSummary) -> [String: Any] {
        map([
            "count": s.count,
            "averageRating": s.averageRating,
            "ratings": Dictionary(uniqueKeysWithValues: s.ratings.map { (String($0.key), $0.value) }),
        ])
    }

    static func productReview(_ r: ProductReview) -> [String: Any] {
        map([
            "id": r.id,
            "rating": r.rating,
            "comment": r.comment,
            "author": r.author,
            "createdAt": r.createdAt,
        ])
    }

    static func clientReview(_ r: ClientReview) -> [String: Any] {
        map([
            "id": r.id,
            "itemId": r.itemId,
            "orderId": r.orderId,
            "rating": r.rating,
            "comment": r.comment,
            "state": r.state?.rawValue,
            "createdAt": r.createdAt,
        ])
    }

    // MARK: free fields

    /// A free field as JSON: strings, numbers, booleans, `NSNull`, lists and maps of them; anything else
    /// as its description.
    static func json(_ map: [String: Any]) -> [String: Any] {
        map.mapValues(jsonValue)
    }

    private static func jsonValue(_ value: Any) -> Any {
        switch value {
        case is NSNull, is String, is NSNumber, is Bool, is Int, is Double:
            return value
        case let map as [String: Any]:
            return json(map)
        case let list as [Any]:
            return list.map(jsonValue)
        default:
            if Mirror(reflecting: value).displayStyle == .optional {
                return unwrapped(value).map(jsonValue) ?? NSNull()
            }
            return String(describing: value)
        }
    }
}
