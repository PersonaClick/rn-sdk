import Foundation
@_spi(Bridge) import PersonaClick

/// A value of the wrong type, or a required one missing, in the arguments JavaScript passed: the call
/// rejects with `invalidArgument` and this message, as on Android.
struct ArgumentError: Error {
    let message: String

    static func string(_ name: String) -> ArgumentError { ArgumentError(message: "\(name) must be a string") }
    static func boolean(_ name: String) -> ArgumentError { ArgumentError(message: "\(name) must be a boolean") }
    static func number(_ name: String) -> ArgumentError { ArgumentError(message: "\(name) must be a number") }
    static func wholeNumber(_ name: String) -> ArgumentError { ArgumentError(message: "\(name) must be a whole number") }
    static func strings(_ name: String) -> ArgumentError { ArgumentError(message: "\(name) must be a list of strings") }
    static func list(_ name: String) -> ArgumentError { ArgumentError(message: "\(name) must be a list") }
    static func map(_ name: String) -> ArgumentError { ArgumentError(message: "\(name) must be a map") }
}

/// The values of one map JavaScript passed — a request model, a source, an item — read by the
/// contract's field names. `NSNull` and a missing key are both "not given". `path` names the map in
/// the messages (`items[0].`).
struct Args {
    let values: NSDictionary
    let path: String

    init(_ values: NSDictionary, path: String = "") {
        self.values = values
        self.path = path
    }

    private func value(_ key: String) -> Any? {
        guard let value = values[key], !(value is NSNull) else { return nil }
        return value
    }

    private func name(_ key: String) -> String { path + key }

    func has(_ key: String) -> Bool { value(key) != nil }

    func string(_ key: String) throws -> String? {
        guard let value = value(key) else { return nil }
        guard let string = value as? String else { throw ArgumentError.string(name(key)) }
        return string
    }

    func requiredString(_ key: String) throws -> String {
        guard let string = try string(key) else { throw ArgumentError.string(name(key)) }
        return string
    }

    func bool(_ key: String) throws -> Bool? {
        guard let value = value(key) else { return nil }
        return try Args.bool(value, name(key))
    }

    func double(_ key: String) throws -> Double? {
        guard let value = value(key) else { return nil }
        return try Args.double(value, name(key))
    }

    func requiredDouble(_ key: String) throws -> Double {
        guard let number = try double(key) else { throw ArgumentError.number(name(key)) }
        return number
    }

    func int(_ key: String) throws -> Int? {
        guard let value = value(key) else { return nil }
        return try Args.int(value, name(key))
    }

    func requiredInt(_ key: String) throws -> Int {
        guard let number = try int(key) else { throw ArgumentError.wholeNumber(name(key)) }
        return number
    }

    func strings(_ key: String) throws -> [String]? {
        guard let value = value(key) else { return nil }
        return try Args.strings(value, name(key))
    }

    func map(_ key: String) throws -> Args? {
        guard let value = value(key) else { return nil }
        guard let map = value as? NSDictionary else { throw ArgumentError.map(name(key)) }
        return Args(map, path: name(key) + ".")
    }

    /// A free field (`customFields`, `customProperties`, `custom`): the JSON it holds, as it is.
    func json(_ key: String) throws -> [String: Any]? {
        guard let value = value(key) else { return nil }
        guard let map = value as? NSDictionary else { throw ArgumentError.map(name(key)) }
        return Args.json(map)
    }

    func maps(_ key: String) throws -> [Args]? {
        guard let value = value(key) else { return nil }
        return try Args.maps(value, name(key))
    }

    /// `filters`: a parameter of the product → its values.
    func filters(_ key: String) throws -> [String: [String]]? {
        guard let map = try self.map(key) else { return nil }
        var filters: [String: [String]] = [:]
        for case let (field as String, value) in map.values {
            filters[field] = try Args.strings(value, map.path + field)
        }
        return filters
    }

    // MARK: single values

    /// A JavaScript boolean: an `NSNumber` that is a `CFBoolean`, not a number.
    static func bool(_ value: Any, _ name: String) throws -> Bool {
        guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else {
            throw ArgumentError.boolean(name)
        }
        return number.boolValue
    }

    static func double(_ value: Any, _ name: String) throws -> Double {
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else {
            throw ArgumentError.number(name)
        }
        let result = number.doubleValue
        guard result.isFinite else { throw ArgumentError.number(name) }
        return result
    }

    static func int(_ value: Any, _ name: String) throws -> Int {
        try int(try double(value, name), name)
    }

    /// JavaScript hands every number as a double: a whole one in the range of `Int` is an `Int`.
    static func int(_ number: Double, _ name: String) throws -> Int {
        guard number.rounded() == number, abs(number) <= 9.0e15 else { throw ArgumentError.wholeNumber(name) }
        return Int(number)
    }

    static func optionalInt(_ number: NSNumber?, _ name: String) throws -> Int? {
        guard let number = number else { return nil }
        return try int(number, name)
    }

    /// A whole number of 32 bits, as Android's `Int` holds it: `time` and `value` of `tracking.custom` take
    /// the same range on both platforms.
    static func optionalInt32(_ number: NSNumber?, _ name: String) throws -> Int? {
        guard let value = try optionalInt(number, name) else { return nil }
        guard value >= Int(Int32.min), value <= Int(Int32.max) else { throw ArgumentError.wholeNumber(name) }
        return value
    }

    static func optionalBool(_ number: NSNumber?, _ name: String) throws -> Bool? {
        guard let number = number else { return nil }
        return try bool(number, name)
    }

    static func strings(_ value: Any, _ name: String) throws -> [String] {
        guard let list = value as? [Any] else { throw ArgumentError.strings(name) }
        return try list.map { element in
            guard let string = element as? String else { throw ArgumentError.strings(name) }
            return string
        }
    }

    static func optionalStrings(_ value: NSArray?, _ name: String) throws -> [String]? {
        guard let value = value else { return nil }
        return try strings(value, name)
    }

    static func maps(_ value: Any, _ name: String) throws -> [Args] {
        guard let list = value as? [Any] else { throw ArgumentError.list(name) }
        return try list.enumerated().map { index, element in
            guard let map = element as? NSDictionary else { throw ArgumentError.map("\(name)[\(index)]") }
            return Args(map, path: "\(name)[\(index)].")
        }
    }

    /// A free map as JSON: strings, numbers, booleans, `NSNull`, and lists and maps of them.
    static func json(_ map: NSDictionary) -> [String: Any] {
        var result: [String: Any] = [:]
        for case let (key as String, value) in map {
            result[key] = jsonValue(value)
        }
        return result
    }

    private static func jsonValue(_ value: Any) -> Any {
        switch value {
        case let map as NSDictionary: return json(map)
        case let list as [Any]: return list.map(jsonValue)
        default: return value
        }
    }
}

/// The contract's arguments of the namespaces: the maps and enumerations JavaScript passes, as the
/// native types.
enum NamespaceArgs {

    /// `{ type, code }` with the wire value of the type (`instant_search`).
    static func source(_ map: NSDictionary?) throws -> TrackingSource? {
        guard let map = map else { return nil }
        let args = Args(map, path: "source.")
        let type = try args.requiredString("type")
        return try sourceOf(type, code: try args.requiredString("code"))
    }

    /// The source of the wire value `type` (`instant_search`) as the SDK takes it — for the events'
    /// `source`, a purchase's `recommendedBy` and `setSource`: `TrackingSource(rawType:code:)`. `slider`
    /// and `agent_search`, which `TrackingSourceType` gets only in the SDK's major, are its bridge-only
    /// raw sources and go as their wire values (`rawType`). A type the contract does not have is
    /// `invalidArgument`, as on Android.
    static func sourceOf(_ type: String, code: String) throws -> TrackingSource {
        do {
            return try TrackingSource(rawType: type, code: code)
        } catch {
            throw ArgumentError(message: "Unknown source type: \(type)")
        }
    }

    /// `TrackingItem`: `{ id, quantity?, price?, fashionSize? }`.
    static func trackingItem(_ args: Args) throws -> TrackingItem {
        TrackingItem(
            id: try args.requiredString("id"),
            quantity: try args.int("quantity") ?? 1,
            price: try args.double("price"),
            fashionSize: try args.string("fashionSize")
        )
    }

    static func trackingItems(_ list: NSArray) throws -> [TrackingItem] {
        try Args.maps(list, "items").map(trackingItem)
    }

    /// `PurchaseTrackingRequest`, and the source of its `recommendedBy`: the request's own attribution
    /// wins over the call's `source`, as on Android. The native request has no `recommendedBy`, so it
    /// goes as the event's source.
    static func purchase(_ map: NSDictionary) throws -> (request: PurchaseTrackingRequest, recommendedBy: TrackingSource?) {
        let args = Args(map)
        guard let itemArgs = try args.maps("items") else { throw ArgumentError.list("items") }
        let items = try itemArgs.map { item in
            PurchaseItemRequest(
                id: try item.requiredString("id"),
                amount: try item.requiredInt("amount"),
                price: try item.requiredDouble("price"),
                quantity: try item.int("quantity"),
                lineId: try item.string("lineId"),
                fashionSize: try item.string("fashionSize")
            )
        }
        var recommendedBy: TrackingSource?
        if let by = try args.map("recommendedBy") {
            recommendedBy = try sourceOf(try by.requiredString("type"), code: try by.string("code") ?? "")
        }
        let request = PurchaseTrackingRequest(
            orderId: try args.requiredString("orderId"),
            orderPrice: try args.requiredDouble("orderPrice"),
            items: items,
            deliveryType: try args.string("deliveryType"),
            deliveryAddress: try args.string("deliveryAddress"),
            paymentType: try args.string("paymentType"),
            isTaxFree: try args.bool("isTaxFree") ?? false,
            promocode: try args.string("promocode"),
            orderCash: try args.double("orderCash"),
            orderBonuses: try args.double("orderBonuses"),
            orderDelivery: try args.double("orderDelivery"),
            orderDiscount: try args.double("orderDiscount"),
            channel: try args.string("channel"),
            custom: try args.json("custom"),
            recommendedSource: try args.json("recommendedSource"),
            stream: try args.string("stream"),
            segment: try args.string("segment"),
            isGiftPackage: try args.bool("isGiftPackage") ?? false
        )
        return (request, recommendedBy)
    }

    /// `m` or `f`, the wire values.
    static func gender(_ value: String?, _ name: String = "gender") throws -> Gender? {
        guard let value = value else { return nil }
        switch value {
        case "m": return .male
        case "f": return .female
        default: throw ArgumentError(message: "Unknown \(name): \(value)")
        }
    }

    static func sortDirection(_ value: String?) throws -> PersonaClick.SortDirection? {
        guard let value = value else { return nil }
        guard let direction = PersonaClick.SortDirection(rawValue: value) else {
            throw ArgumentError(message: "Unknown sortDir: \(value)")
        }
        return direction
    }

    static func productsList(_ map: NSDictionary?) throws -> PersonaClick.ProductsListRequest {
        guard let map = map else { return PersonaClick.ProductsListRequest() }
        let args = Args(map)
        return PersonaClick.ProductsListRequest(
            categoryIds: try args.strings("categoryIds"),
            brands: try args.strings("brands"),
            merchants: try args.strings("merchants"),
            locations: try args.strings("locations"),
            priceMin: try args.double("priceMin"),
            priceMax: try args.double("priceMax"),
            filters: try args.filters("filters"),
            sortBy: try args.string("sortBy").map { PersonaClick.SortBy(rawValue: $0) },
            sortDir: try sortDirection(args.string("sortDir")),
            limit: try args.int("limit"),
            page: try args.int("page")
        )
    }

    static func category(_ map: NSDictionary?) throws -> PersonaClick.CategoryRequest {
        guard let map = map else { return PersonaClick.CategoryRequest() }
        let args = Args(map)
        return PersonaClick.CategoryRequest(
            brands: try args.strings("brands"),
            locations: try args.strings("locations"),
            filters: try args.filters("filters"),
            priceMin: try args.double("priceMin"),
            priceMax: try args.double("priceMax"),
            sortBy: try args.string("sortBy").map { PersonaClick.SortBy(rawValue: $0) },
            sortDir: try sortDirection(args.string("sortDir")),
            limit: try args.int("limit"),
            page: try args.int("page")
        )
    }

    static func recommendation(_ map: NSDictionary?) throws -> PersonaClick.RecommendationRequest {
        guard let map = map else { return PersonaClick.RecommendationRequest() }
        let args = Args(map)
        return PersonaClick.RecommendationRequest(
            itemId: try args.string("itemId"),
            categoryId: try args.string("categoryId"),
            searchQuery: try args.string("searchQuery"),
            excludedItemIds: try args.strings("excludedItemIds"),
            brands: try args.strings("brands"),
            locations: try args.strings("locations"),
            limit: try args.int("limit"),
            extended: try args.bool("extended") ?? true,
            withLocations: try args.bool("withLocations") ?? false
        )
    }

    static func searchFull(_ map: NSDictionary?) throws -> PersonaClick.SearchFullRequest {
        guard let map = map else { return PersonaClick.SearchFullRequest() }
        let args = Args(map)
        return PersonaClick.SearchFullRequest(
            categoryIds: try args.strings("categoryIds"),
            brands: try args.strings("brands"),
            excludedBrands: try args.strings("excludedBrands"),
            merchants: try args.strings("merchants"),
            excludedMerchants: try args.strings("excludedMerchants"),
            locations: try args.strings("locations"),
            priceMin: try args.double("priceMin"),
            priceMax: try args.double("priceMax"),
            colors: try args.strings("colors"),
            fashionSizes: try args.strings("fashionSizes"),
            excludedItemIds: try args.strings("excludedItemIds"),
            filters: try args.filters("filters"),
            sortBy: try args.string("sortBy").map { PersonaClick.SortBy(rawValue: $0) },
            sortDir: try sortDirection(args.string("sortDir")),
            disableClarification: try args.bool("disableClarification") ?? false,
            categoryLimit: try args.int("categoryLimit"),
            brandLimit: try args.int("brandLimit"),
            limit: try args.int("limit"),
            page: try args.int("page")
        )
    }

    static func profileUpdate(_ map: NSDictionary) throws -> PersonaClick.ProfileUpdateRequest {
        let args = Args(map)
        return PersonaClick.ProfileUpdateRequest(
            email: try args.string("email"),
            phone: try args.string("phone"),
            externalId: try args.string("externalId"),
            loyaltyId: try args.string("loyaltyId"),
            telegramId: try args.string("telegramId"),
            fbId: try args.string("fbId"),
            vkId: try args.string("vkId"),
            firstName: try args.string("firstName"),
            lastName: try args.string("lastName"),
            gender: try gender(args.string("gender")),
            birthday: try args.string("birthday"),
            age: try args.int("age"),
            location: try args.string("location"),
            kids: try args.maps("kids")?.map { kid in
                PersonaClick.ProfileKid(gender: try gender(kid.string("gender"), kid.path + "gender"), birthday: try kid.string("birthday"))
            },
            cars: try args.maps("cars")?.map { car in
                PersonaClick.ProfileCar(brand: try car.string("brand"), model: try car.string("model"), vds: try car.string("vds"))
            },
            customProperties: try args.json("customProperties")
        )
    }

    static func subscriptionsUpdate(_ map: NSDictionary) throws -> PersonaClick.SubscriptionsUpdateRequest {
        let args = Args(map)
        return PersonaClick.SubscriptionsUpdateRequest(
            email: try args.string("email"),
            phone: try args.string("phone"),
            externalId: try args.string("externalId"),
            loyaltyId: try args.string("loyaltyId"),
            telegramId: try args.string("telegramId"),
            emailBulk: try args.bool("emailBulk"),
            emailChain: try args.bool("emailChain"),
            emailTransactional: try args.bool("emailTransactional"),
            smsBulk: try args.bool("smsBulk"),
            smsChain: try args.bool("smsChain"),
            smsTransactional: try args.bool("smsTransactional"),
            webPushBulk: try args.bool("webPushBulk"),
            webPushChain: try args.bool("webPushChain"),
            webPushTransactional: try args.bool("webPushTransactional"),
            mobilePushBulk: try args.bool("mobilePushBulk"),
            mobilePushChain: try args.bool("mobilePushChain"),
            mobilePushTransactional: try args.bool("mobilePushTransactional"),
            telegramBulk: try args.bool("telegramBulk"),
            telegramChain: try args.bool("telegramChain"),
            telegramTransactional: try args.bool("telegramTransactional"),
            whatsappBulk: try args.bool("whatsappBulk"),
            whatsappChain: try args.bool("whatsappChain"),
            whatsappTransactional: try args.bool("whatsappTransactional"),
            maxBulk: try args.bool("maxBulk"),
            maxChain: try args.bool("maxChain"),
            maxTransactional: try args.bool("maxTransactional"),
            walletBulk: try args.bool("walletBulk"),
            walletChain: try args.bool("walletChain"),
            walletTransactional: try args.bool("walletTransactional")
        )
    }

    static func backInStock(_ map: NSDictionary?) throws -> PersonaClick.BackInStockProperties? {
        guard let map = map else { return nil }
        let args = Args(map, path: "properties.")
        return PersonaClick.BackInStockProperties(
            fashionSize: try args.string("fashionSize"),
            fashionColor: try args.string("fashionColor"),
            barcode: try args.string("barcode")
        )
    }
}
