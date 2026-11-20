import Foundation
import UIKit
@_spi(Bridge) import PersonaClick

/// The native side of the SDK's module: `PersonaClickNative.mm` hands it every call. Each call goes to the
/// PersonaClick SDK's method of the same meaning and its result goes back to JavaScript: the SDK's registry
/// holds the instances, and this keeps no requests, storage or queue of its own — only its
/// subscriptions to the instances' state and session, to tell JavaScript.
///
/// Calls come on the module's own serial queue, in the order JavaScript made them: an instance is made
/// there, off the main thread (the SDK reads its storage and keychain while it makes one), so a call
/// right after `initializeShop` finds it.
@objc(PersonaClickNativeImpl)
public final class PersonaClickNativeImpl: NSObject {

    /// Hears a shop's snapshot on every change of its state or session, and when a listener is added.
    @objc public var onStateChanged: (([String: Any]) -> Void)?

    /// Hands JavaScript a server popup of a shop, `{ shopId, popup }`; false while it has no listener.
    @objc public var onPopup: (([String: Any]) -> Bool)?

    /// Hands JavaScript a message of the SDK's log, `SdkLogMessage` of the contract.
    @objc public var onLog: (([String: Any]) -> Void)?

    private let lock = NSLock()
    /// Per shop, the subscriptions that tell JavaScript the instance's state and session.
    private var subscriptions: [String: [Cancellable]] = [:]
    /// Per shop, its tracking events in the order JavaScript sent them.
    private var trackingLines: [String: TrackingLine] = [:]
    /// Per shop, what keeps its server popups from the native presentation (the SDK holds it weakly).
    private var popupForwarders: [String: PopupForwarder] = [:]
    /// Popups that came while JavaScript had no listener, handed to the next one within a minute.
    private var heldPopups: [(at: Date, shopId: String, event: [String: Any])] = []

    @objc public func initializeShop(
        _ config: NSDictionary,
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String, String, [String: Any]?) -> Void
    ) {
        if let wrong = Self.wronglyTyped(config) {
            reject("invalidArgument", wrong, nil)
            return
        }
        guard let shopId = Self.string(config, "shopId") else {
            reject("invalidArgument", "shopId must not be empty", nil)
            return
        }
        // The bridges' entry: the new core, and the A/B group JavaScript kept, taken while the device has
        // none of its own.
        var sdk = PersonaClick.initializeBridge(Self.nativeConfig(shopId: shopId, config), segment: Self.string(config, "segment"))
        // Every server popup goes to JavaScript, which shows it — the overlay or the app's delegate — as 4.0
        // did: the native SDK shows none (nil), and the popup is reported as shown once JavaScript shows it.
        let forwarder = PopupForwarder { [weak self] popup in self?.relayPopup(shopId, popup) }
        lock.lock()
        popupForwarders[shopId] = forwarder
        lock.unlock()
        sdk.popupPresentationDelegate = forwarder
        // A JavaScript reload initializes the shop again: it gets the live instance and new
        // subscriptions, the state one telling the current state at once.
        let fresh = [
            sdk.onStateChange { [weak self] state in self?.onStateChanged?(Self.snapshot(sdk, state: state)) },
            sdk.onSessionChange { [weak self] _ in self?.onStateChanged?(Self.snapshot(sdk)) },
        ]
        lock.lock()
        let stale = subscriptions[shopId] ?? []
        subscriptions[shopId] = fresh
        lock.unlock()
        stale.forEach { $0.cancel() }
        resolve(Self.snapshot(sdk))
    }

    @objc public func deviceId(
        _ shopId: String,
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String, String, [String: Any]?) -> Void
    ) {
        guard let sdk = instance(shopId, reject) else { return }
        resolve(sdk.deviceId.isEmpty ? nil : sdk.deviceId)
    }

    @objc public func queueEvent(
        _ shopId: String,
        path: String,
        body: NSDictionary,
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String, String, [String: Any]?) -> Void
    ) {
        guard let sdk = instance(shopId, reject) else { return }
        var fields: [String: Any] = [:]
        body.forEach { key, value in
            if let key = key as? String { fields[key] = value }
        }
        // On the shop's tracking line: after the events JavaScript sent before it.
        trackingLine(sdk.shopId).send {
            await withCheckedContinuation { (taken: CheckedContinuation<Void, Never>) in
                sdk.queueEvent(path: path, body: fields) { result in
                    switch result {
                    case .success:
                        resolve(nil)
                    case .failure(let error):
                        Self.reject(reject, error)
                    }
                    taken.resume()
                }
            }
        }
    }

    @objc public func setSource(
        _ shopId: String,
        type: String,
        code: String,
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String, String, [String: Any]?) -> Void
    ) {
        guard let sdk = instance(shopId, reject) else { return }
        let source: TrackingSource
        do {
            source = try NamespaceArgs.sourceOf(type, code: code)
        } catch let error as ArgumentError {
            reject("invalidArgument", error.message, nil)
            return
        } catch {
            reject("invalidArgument", "\(error)", nil)
            return
        }
        guard !code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            reject("invalidArgument", "The source code must not be empty", nil)
            return
        }
        // On the shop's tracking line: the events JavaScript sent before it keep the source they had.
        trackingLine(sdk.shopId).send {
            sdk.tracking.setSource(source)
            resolve(nil)
        }
    }

    // MARK: pushes of shops not started — `sdk/contract/notifications.md`

    /// The iOS SDK registers no shop on the new core without starting it yet: false, and JavaScript sends
    /// the events of a push for a shop it has not started itself.
    @objc public func registerShops(
        _ configs: NSArray,
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String, String, [String: Any]?) -> Void
    ) {
        resolve(false)
    }

    /// A push to the shop it names, its event through that shop's queue; the shop's id, or null.
    @objc public func handlePush(
        _ payload: NSDictionary,
        event: String,
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String, String, [String: Any]?) -> Void
    ) {
        guard let pushEvent = PersonaClick.PushEvent(rawValue: event) else {
            reject("invalidArgument", "Unknown push event: \(event)", nil)
            return
        }
        var data: [AnyHashable: Any] = [:]
        payload.forEach { key, value in
            if let key = key as? String { data[key] = value }
        }
        resolve(PersonaClick.handlePush(data, event: pushEvent) ?? NSNull())
    }

    /// `PersonaClick.setLogHandler` of the contract: while `enabled`, every message the SDK logs — of every
    /// shop, at or above its `logLevel` — goes to JavaScript; off, none goes.
    @objc public func setLogHandler(_ enabled: Bool) {
        guard enabled else {
            PersonaClick.setLogHandler(nil)
            return
        }
        PersonaClick.setLogHandler { [weak self] message in
            self?.onLog?(Self.logMessage(message))
        }
    }

    /// `{ level, code, message, shopId, context }`, the level by the contract's name.
    static func logMessage(_ message: PersonaClick.SdkLogMessage) -> [String: Any] {
        [
            "level": "\(message.level)",
            "code": message.code,
            "message": message.message,
            "shopId": message.shopId ?? NSNull(),
            "context": message.context,
        ]
    }

    // MARK: the instance — `sdk/contract/root.md`

    @objc public func flush(
        _ shopId: String,
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String, String, [String: Any]?) -> Void
    ) {
        guard let sdk = instance(shopId, reject) else { return }
        // On the shop's tracking line, as on Android: the events JavaScript sent before it are in the queue
        // when it starts. The line goes on at once: an event sent after it waits for no network.
        trackingLine(sdk.shopId).send {
            sdk.flush { error in
                if let error = error {
                    Self.reject(reject, error)
                } else {
                    resolve(nil)
                }
            }
        }
    }

    /// The released instance tells its listeners it is not initialized; the module's go with it.
    @objc public func releaseShop(_ shopId: String) {
        let id = shopId.trimmingCharacters(in: .whitespacesAndNewlines)
        (try? PersonaClick.instance(for: id))?.release()
        lock.lock()
        let stale = subscriptions.removeValue(forKey: id) ?? []
        // Its events on their way end as the released instance answers them; a new instance gets a new line.
        trackingLines.removeValue(forKey: id)
        popupForwarders.removeValue(forKey: id)
        heldPopups.removeAll { $0.shopId == id }
        lock.unlock()
        stale.forEach { $0.cancel() }
    }

    @objc public func deleteUserCredentials(
        _ shopId: String,
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String, String, [String: Any]?) -> Void
    ) {
        guard let sdk = instance(shopId, reject) else { return }
        // On the shop's tracking line, as on Android: an event JavaScript sent before it is in the queue it
        // wipes, and one sent after it waits for the wipe — it is the next customer's. The wipe blocks until
        // the queue's files are gone: the bridges' `async` form runs it off this queue.
        trackingLine(sdk.shopId).send {
            await sdk.deleteUserCredentials()
            resolve(nil)
        }
    }

    /// Tells every initialized shop's snapshot at once, for a listener JavaScript just added: a change
    /// that came before it subscribed is not lost.
    @objc public func replay() {
        lock.lock()
        let shopIds = Array(subscriptions.keys)
        let held = heldPopups.filter { Date().timeIntervalSince($0.at) <= 60 }
        heldPopups.removeAll()
        lock.unlock()
        for shopId in shopIds {
            if let sdk = try? PersonaClick.instance(for: shopId) {
                onStateChanged?(Self.snapshot(sdk))
            }
        }
        held.forEach { deliverPopup($0.shopId, $0.event) }
    }

    /// A server popup of the shop, for JavaScript: with the server's field names, `components` and
    /// `popup_actions` as the JSON strings the server sends them as.
    private func relayPopup(_ shopId: String, _ popup: Popup) {
        guard let data = try? JSONEncoder().encode(popup),
              var fields = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
        if let components = fields["components"], !(components is String), !(components is NSNull),
           let json = try? JSONSerialization.data(withJSONObject: components) {
            fields["components"] = String(data: json, encoding: .utf8)
        }
        deliverPopup(shopId, ["shopId": shopId, "popup": fields])
    }

    private func deliverPopup(_ shopId: String, _ event: [String: Any]) {
        if onPopup?(event) == true { return }
        lock.lock()
        heldPopups.append((Date(), shopId, event))
        lock.unlock()
    }

    @objc public func invalidate() {
        lock.lock()
        let all = subscriptions.values.flatMap { $0 }
        subscriptions.removeAll()
        lock.unlock()
        all.forEach { $0.cancel() }
    }

    /// The line of the shop's tracking events, made on first use.
    func trackingLine(_ shopId: String) -> TrackingLine {
        lock.lock()
        defer { lock.unlock() }
        if let line = trackingLines[shopId] { return line }
        let line = TrackingLine()
        trackingLines[shopId] = line
        return line
    }

    /// The shop's instance, or nil once `reject` heard `notInitialized`.
    func instance(_ shopId: String, _ reject: (String, String, [String: Any]?) -> Void) -> PersonalizationSDK? {
        do {
            return try PersonaClick.instance(for: shopId.trimmingCharacters(in: .whitespacesAndNewlines))
        } catch {
            reject("notInitialized", error.localizedDescription, nil)
            return nil
        }
    }

    /// Rejects with the error's type as the code, as on Android; an HTTP error carries its codes.
    static func reject(_ reject: (String, String, [String: Any]?) -> Void, _ error: PersonaClick.SdkError) {
        switch error {
        case .notInitialized: reject("notInitialized", error.message, nil)
        case .shopBlocked: reject("shopBlocked", error.message, nil)
        case .invalidArgument: reject("invalidArgument", error.message, nil)
        case .network: reject("network", error.message, nil)
        case .timeout: reject("timeout", error.message, nil)
        case .http(let code, let serverCode):
            var info: [String: Any] = ["httpCode": code]
            if let serverCode = serverCode { info["serverCode"] = serverCode }
            reject("http", error.message, info)
        case .decoding: reject("decoding", error.message, nil)
        case .cancelled: reject("cancelled", error.message, nil)
        }
    }

    /// The stream of a shop whose app names none, as the contract has it for React Native.
    static let defaultStream = "react-native"

    private static func nativeConfig(shopId: String, _ config: NSDictionary) -> PersonaClickConfig {
        let defaults = PersonaClickConfig(shopId: shopId)
        return PersonaClickConfig(
            shopId: shopId,
            apiDomain: string(config, "apiDomain").flatMap(apiHost) ?? defaults.apiDomain,
            appDomain: string(config, "appDomain").flatMap(apiHost) ?? defaults.appDomain,
            // A React Native app's stream unless the app names its own (the contract).
            stream: string(config, "stream") ?? defaultStream,
            deviceId: string(config, "deviceId"),
            logLevel: string(config, "logLevel").flatMap(logLevel) ?? defaults.logLevel,
            // JavaScript takes the token from Firebase and hands it over (notificationsSetPushToken).
            autoSendPushToken: false,
            sendAdvertisingId: (config["sendAdvertisingId"] as? Bool) ?? false,
            // JavaScript shows the popups (PopupForwarder): the native SDK never does.
            enableAutoPopupPresentation: false,
            needReInitialization: (config["needReInitialization"] as? Bool) ?? false,
            storageKey: string(config, "storageKey")
        )
    }

    /// `debug`, `info`, `warning`, `error` or `none`, as on Android.
    private static func logLevel(_ name: String) -> PersonaClick.LogLevel? {
        PersonaClick.LogLevel.allCases.first { "\($0)".caseInsensitiveCompare(name) == .orderedSame }
    }

    /// A host of the API (`apiDomain`, `appDomain`): the SDK takes a host only, so a scheme and a trailing
    /// slash go, as on Android.
    private static func apiHost(_ domain: String) -> String? {
        var host = domain
        if let scheme = host.range(of: "^https?://", options: [.regularExpression, .caseInsensitive]) {
            host.removeSubrange(scheme)
        }
        while host.hasSuffix("/") { host.removeLast() }
        return host.isEmpty ? nil : host
    }

    /// The instance's snapshot for JavaScript, with `state` when a listener was handed it.
    private static func snapshot(_ sdk: PersonalizationSDK, state: PersonaClick.SdkState? = nil) -> [String: Any] {
        // The push tokens the SDK keeps for the shop, from an earlier start too: `notifications.getPushToken`.
        let last = sdk.notifications.getPushToken(provider: nil)
        var tokens: [String: Any] = [:]
        for provider in PersonaClick.PushProvider.allCases {
            if let token = sdk.notifications.getPushToken(provider: provider) {
                tokens[provider.rawValue] = token.token
            }
        }
        return [
            "shopId": sdk.shopId,
            "state": (state ?? sdk.state).rawValue,
            "deviceId": sdk.deviceId.isEmpty ? NSNull() : sdk.deviceId,
            "sessionId": sdk.sessionId ?? NSNull(),
            "segment": sdk.segment.isEmpty ? NSNull() : sdk.segment,
            "agentEnabled": sdk.search.agentEnabled,
            "pushToken": last.map { ["token": $0.token, "provider": $0.provider.rawValue] as [String: Any] } ?? NSNull(),
            "pushTokens": tokens,
        ]
    }

    /// What is wrong with a value of the wrong type, as Android says it; nil when every value is right.
    private static func wronglyTyped(_ config: NSDictionary) -> String? {
        for key in ["shopId", "apiDomain", "appDomain", "stream", "deviceId", "segment", "logLevel", "storageKey"] {
            if let value = config[key], !(value is NSNull), !(value is String) {
                return "\(key) must be a string"
            }
        }
        for key in ["needReInitialization", "enableAutoPopupPresentation", "sendAdvertisingId"] {
            if let value = config[key], !(value is NSNull), CFGetTypeID(value as CFTypeRef) != CFBooleanGetTypeID() {
                return "\(key) must be a boolean"
            }
        }
        return nil
    }

    private static func string(_ config: NSDictionary, _ key: String) -> String? {
        guard let value = (config[key] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }
}

/// A shop's tracking events, one after another: each starts once the one sent before it finished — accepted
/// or refused by the native SDK —, so they reach the shop's queue in the order they were sent. A new task per
/// event alone would not keep it: unstructured tasks start in no order. One that fails holds back nothing:
/// an event never throws here, it tells its own promise.
final class TrackingLine {
    private let lock = NSLock()
    private var last: Task<Void, Never>?

    func send(_ event: @escaping () async -> Void) {
        lock.lock()
        defer { lock.unlock() }
        let previous = last
        last = Task {
            await previous?.value
            await event()
        }
    }
}

/// Keeps a shop's server popups from the native presentation and hands each one over.
final class PopupForwarder: PopupPresentationDelegate {
    private let relay: (Popup) -> Void

    init(relay: @escaping (Popup) -> Void) {
        self.relay = relay
    }

    func sdk(_ sdk: PersonalizationSDK, shouldPresentPopup popup: Popup) -> UIViewController? {
        relay(popup)
        return nil
    }
}
