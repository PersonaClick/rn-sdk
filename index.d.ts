import type { ComponentType } from 'react'
import type { CartApi, SearchApi, SegmentsApi, SubscriptionsApi } from './types/namespaces.js'

export type { CustomEventParams } from './types/customEventParams.js'
export type { PurchasePredictParams, PurchasePredictResponse } from './types/purchasePredict.js'
export type {
  LegacyPurchaseTrackingRequest,
  PurchaseItem,
  PurchaseItemRequest,
  PurchaseRecommendedBy,
  PurchaseTrackingRequest,
} from './types/purchaseTracking.js'
// The results of the deprecated catalog methods, as 4.x had them: `Product`, `ProductCategory` and
// `ProductsListResponse` are the contract's now (the namespaces'), and 4.x's take the `Legacy` names.
export type {
  LegacyProduct,
  LegacyProductCategory,
  ProductFilter,
  ProductInfo,
  ProductPriceRange,
  LegacyProductsListResponse,
} from './types/productModels.js'

export const SESSION_CODE_EXPIRE: number
export const SDK_API_URL: string
export const SDK_STORAGE_NAME: string
export const SDK_PUSH_CHANNEL: string

export function parseCartItem(json: Record<string, unknown>): unknown
export function parseProduct(json: Record<string, unknown>): import('./types/productModels.js').LegacyProduct
export function parseProductInfo(json: Record<string, unknown>): import('./types/productModels.js').ProductInfo
export function parseProductsListResponse(
  json: Record<string, unknown>,
): import('./types/productModels.js').LegacyProductsListResponse

/**
 * Optional params of `getCategory` (`GET /category/{category}`), sent as they are. Other keys
 * pass through too.
 */
export interface CategoryParams {
  limit?: number
  page?: number
  /** Comma-separated brands, or a list (joined with commas). */
  brands?: string | string[]
  /** Facets as a JSON string: `JSON.stringify({ [facet]: [value, ...] })`. */
  filters?: string
  price_min?: number | string
  price_max?: number | string
  /** `popular`, `price`, `discount`, `sales_rate`, `date`; none — the default order. */
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  /** Comma-separated location ids, or a list (joined with commas). */
  locations?: string | string[]
  [key: string]: unknown
}

/** What the SDK logs: `warning` by default (`warning` and `error`); `none` logs nothing. */
export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'none'

/** A message of the SDK's log; it never carries personal data, request data or bodies. */
export interface SdkLogMessage {
  level: Exclude<LogLevel, 'none'>
  /** A stable code of the event: `init_retry`, `request_failed`, `queue_dropped`, … */
  code: string
  /** English text. */
  message: string
  /** The shop the message is about; null for one about the SDK as a whole. */
  shopId: string | null
  /** Details: the request's path, the HTTP code, the number of attempts. */
  context: Record<string, unknown>
}

/** The init's state of an instance. */
export type SdkState = 'notInitialized' | 'initializing' | 'ready' | 'retrying' | 'refused'

/**
 * Configuration for `PersonaClick.initialize` / `PersonaClick.register`. The fields after `appDomain` are the native
 * SDK's: without the native module (Expo Go, an app not rebuilt) they are not applied.
 */
export interface PersonaClickConfig {
  /** Shop identifier — the partition key. Required. */
  shopId: string
  /** Analytics stream (e.g. `Platform.OS`); `react-native` when omitted and the native module is installed. */
  stream?: string
  /**
   * Enable debug logging. Process-global and sticky-on across instances.
   * @deprecated Use `logLevel: 'debug'`: the same.
   */
  debug?: boolean
  /** Register the push token automatically on init. Defaults to true. */
  autoSendPushToken?: boolean
  /** The API's host — that of `https://api.personaclick.com/` by default: every request of the shop goes there. */
  apiDomain?: string
  /**
   * The account's host — by default the default API's host with `app.` in place of `api.` — polls, the
   * search agent, the purchase prediction.
   */
  appDomain?: string
  /** What the native SDK logs (`warning` by default); `debug` also turns on the SDK's console log. */
  logLevel?: LogLevel
  /** A device id the app keeps from elsewhere: taken only while the shop has none of its own. */
  deviceId?: string
  /** Sends the advertising id with `/init`; off by default, and then it is not read. */
  sendAdvertisingId?: boolean
  /** Whether the SDK shows popups by itself (`true` by default): the instance's `enableAutoPopupPresentation`. */
  enableAutoPopupPresentation?: boolean
  /** Forgets the device id at start and asks `/init` for a new one. */
  needReInitialization?: boolean
  /** A prefix of the native SDK's storage, for an app that needs its own partition. */
  storageKey?: string
}

/** Cancels an `awaitInstance` subscription. Safe to call more than once. */
export type Cancellable = () => void

/**
 * Push lifecycle events routed by `PersonaClick.handlePush`, one per `track/*` endpoint: `DELIVERED` (arrived),
 * `OPENED` (shown), `CLICKED` (tapped), `CLOSED` (dismissed without a tap).
 */
export const PushEvent: {
  readonly DELIVERED: 'delivered'
  readonly OPENED: 'opened'
  readonly CLICKED: 'clicked'
  readonly CLOSED: 'closed'
}
/** What happened to a push: `delivered`, `opened`, `clicked` or `closed` (`PushEvent` of the SDK contract). */
export type PushEvent = 'delivered' | 'opened' | 'clicked' | 'closed'
/** The same as the type `PushEvent`. */
export type PushEventValue = PushEvent

/**
 * The facade's error: a mistake of the app's code when it looks an instance up, thrown at once by
 * `PersonaClick.instance` — `unknownShop` (no such shop is registered) or `ambiguousShop` (no `shopId` while
 * several shops are).
 */
export class PersonaClickError extends Error {
  readonly type: 'unknownShop' | 'ambiguousShop'
}

/**
 * The `PersonaClickError` of type `unknownShop`.
 * @deprecated Catch `PersonaClickError` and read its `type`.
 */
export class UnknownShopIdError extends PersonaClickError {
  readonly type: 'unknownShop'
}

/**
 * The `PersonaClickError` of type `ambiguousShop`.
 * @deprecated Catch `PersonaClickError` and read its `type`.
 */
export class AmbiguousShopError extends PersonaClickError {
  readonly type: 'ambiguousShop'
}

export type SdkErrorType =
  | 'notInitialized'
  | 'shopBlocked'
  | 'invalidArgument'
  | 'network'
  | 'timeout'
  | 'http'
  | 'decoding'
  | 'cancelled'

/** The SDK's error: `type` says what went wrong; an `http` error carries the codes. */
export class SdkError extends Error {
  readonly type: SdkErrorType
  readonly httpCode?: number
  readonly serverCode?: string
}

export type {
  TrackingApi,
  TrackingItem,
  TrackingSource,
  TrackingSourceType,
} from './types/tracking.js'

/**
 * The models of the namespaces, also as `Models.*`. 4.x's `Product`, `ProductCategory` and
 * `ProductsListResponse` — the deprecated methods' results — are `LegacyProduct`,
 * `LegacyProductCategory` and `LegacyProductsListResponse`.
 */
export type * from './types/namespaces.js'
export type * as Models from './types/namespaces.js'

/** `sdk.search`: the namespace, and the earlier method of the same name. */
export interface SearchNamespace extends SearchApi {
  /** @deprecated Use `search.instant(query, params)` or `search.full(query, request)`. */
  (options?: Record<string, unknown>): Promise<any>
}

/** `sdk.cart`: the namespace, and the earlier method of the same name. */
export interface CartNamespace extends CartApi {
  /** @deprecated Use `cart.get()`. The API's answer `{ status, data: { items: [{ uniqid, quantity }] } }`. */
  (): Promise<any>
}

/** `sdk.segments`: the namespace, and the earlier method of the same name. */
export interface SegmentsNamespace extends SegmentsApi {
  /** @deprecated Use `segments.add`, `segments.remove` or `segments.get`. */
  (action: 'add' | 'remove' | 'get' | (string & {}), data?: Record<string, unknown>): Promise<any>
}

/** `sdk.subscriptions`: the namespace, and the earlier method of the same name. */
export interface SubscriptionsNamespace extends SubscriptionsApi {
  /** @deprecated Use `subscriptions.manage(request)` and the other methods of `subscriptions`. */
  (action: string, data?: Record<string, unknown>): void
}

/**
 * The SDK — both the instance class and the multi-instance facade.
 *
 * Initialize (or register) shops through the static methods and reach them by `shopId` via
 * `PersonaClick.getInstance()`; a host no longer needs to keep its own reference.
 *
 * @see ./MainSDK.js — implementation in JS.
 */
declare class PersonaClick {
  /**
   * @deprecated Use `PersonaClick.initialize(config)` (or `PersonaClick.register(...)` + `PersonaClick.instance(shopId)`).
   * The constructor still works and registers the instance, in place of the shop's live one.
   */
  constructor(...args: unknown[])

  /**
   * Initializes an SDK for `config` immediately and returns it (also reachable via `instance`). A shop
   * initialized already keeps its live instance: it is returned, another configuration is not applied.
   */
  static initialize(config: PersonaClickConfig): PersonalizationSdk

  /**
   * Registers shops without initializing them (lazy on first `instance`). Pass
   * `{ eagerInit: true }` to initialize every shop up front.
   */
  static register(configs: PersonaClickConfig[], options?: { eagerInit?: boolean }): void

  /** @deprecated Use `PersonaClick.register(configs, options)`: the same. */
  static registerShops(configs: PersonaClickConfig[], options?: { eagerInit?: boolean }): void

  /**
   * Returns the SDK for `shopId` (materializing a pending registration on first use). With no
   * `shopId`, returns the single instance when exactly one shop is registered.
   *
   * @throws {PersonaClickError} `ambiguousShop`: no `shopId` and more than one shop registered;
   *   `unknownShop`: the shop is unknown.
   */
  static instance(shopId?: string): PersonalizationSdk

  /** @deprecated Use `PersonaClick.instance(shopId)`: the same. */
  static getInstance(shopId?: string): PersonaClick

  /**
   * True when an instance is available for `shopId` — or, with no `shopId`, when exactly one shop is
   * initialized so the default is unambiguous.
   */
  static isInitialized(shopId?: string): boolean

  /**
   * Delivers the instance for `shopId` to `onReady` as soon as it is available; returns a cancel
   * function. An ambiguous default (no `shopId`, several shops) warns and does not resolve.
   * @deprecated Not in the contract; keeps working. `PersonaClick.instance(shopId)` once the shop is registered.
   */
  static awaitInstance(shopId: string | null, onReady: (sdk: PersonaClick) => void): Cancellable

  /**
   * Routes a push to the instance it belongs to (by the payload's `shop_id`) and tracks `event`.
   * No `shop_id` with a single live shop still resolves; an unknown shop, or no `shop_id` while
   * several shops are live, drops the push, and so does a push without `id` and `type` — not the
   * SDK's. Tracking-only — navigation stays with the host. Resolves with the shop the push went to, or
   * null when it went nowhere; never rejects.
   */
  static handlePush(payload: Record<string, unknown>, event: PushEvent): Promise<string | null>

  /**
   * The app's push callbacks for every shop — also one registered but not created yet. A shop's own
   * callback of an event (`notifications.setCallbacks`) wins over the one here. A new call replaces
   * them; null removes them.
   */
  static setPushCallbacks(callbacks: import('./types/namespaces.js').PushCallbacks | null): void

  /**
   * The app gets each message the native SDKs log — of every shop, at or above its `logLevel` — to
   * forward to its crash reporter. A new handler replaces the one before; null removes it. An exception
   * of the handler is caught. Without the native module no message comes.
   */
  static setLogHandler(handler: ((message: SdkLogMessage) => void) | null): void

  /** The instance's shop. */
  readonly shopId: string
  /**
   * The shop's id under its released name.
   * @deprecated Use `shopId`.
   */
  readonly shop_id: string
  /** The device id (`did`); null while the shop has none (4.x read it as `''`). */
  readonly deviceId: string | null
  /** The session id (`sid`); null while there is none. */
  readonly sessionId: string | null
  /** The init's state: `initializing` until the device id is there, then `ready`; `notInitialized` after `release()`. */
  readonly state: SdkState
  /**
   * Calls `listener` with the current state at once and then with each change; the function it returns
   * unsubscribes. An exception of the listener is caught and logged.
   */
  onStateChange(listener: (state: SdkState) => void): () => void

  /**
   * Whether the SDK presents popups by itself. Off — the popups the SDK shows by itself stay hidden
   * (one shown by hand is shown all the same). Defaults to `true`; may be changed at any time — off,
   * say, while a screen of the app must not be covered.
   */
  enableAutoPopupPresentation: boolean

  /**
   * The app shows the popups itself: set, the SDK shows none and hands each one — with the server's
   * field names — to it, and the app reports it shown with `tracking.popupShown(popup.id)` once it is on
   * screen. Null (the default) lets the SDK show them in `<SdkPopupOverlay />`.
   */
  popupPresentationDelegate: ((popup: Record<string, unknown>, sdk: PersonaClick) => void) | null

  /**
   * Reports a popup shown by the app and marks it shown.
   * @deprecated Use `tracking.popupShown(popupId)`.
   */
  trackPopupShown(popupId: number): Promise<void>

  /**
   * Asks the permission, registers the push token and sets the SDK's own push listeners: a function
   * replaces the SDK's handling of a tap, of a push in the foreground, of one in the background.
   * @deprecated Use `notifications.setCallbacks` (or `PersonaClick.setPushCallbacks`) to hear the pushes, and
   * `autoSendPushToken` or `notifications.setPushToken` for the token. Works as in 4.x.
   */
  initPush(
    notifyClick?: boolean | ((message: Record<string, unknown>) => unknown),
    notifyReceive?: boolean | ((message: Record<string, unknown>) => unknown),
    notifyBgReceive?: boolean | ((message: Record<string, unknown>) => unknown),
  ): Promise<string | null | false>

  /** @deprecated Use `notifications.setCallbacks({ onClicked })`. Works as in 4.x. */
  pushClickListener: (message: Record<string, unknown>) => unknown
  /** @deprecated Use `notifications.setCallbacks({ onDelivered })`. Works as in 4.x. */
  pushReceivedListener: (message: Record<string, unknown>) => unknown
  /** @deprecated Use `notifications.setCallbacks({ onDelivered })`. Works as in 4.x. */
  pushBgReceivedListener: (message: Record<string, unknown>) => unknown

  /**
   * Sends the events waiting in the shop's queue now, without waiting for the queue's own triggers.
   * Resolves once each event queued at the call was tried: sent, dropped, or kept for later — no
   * network, the instance not ready yet, a server that asked to wait. It promises no delivery. Without
   * the SDK's native module (Expo Go, an app not rebuilt) each event is sent at once: it resolves at
   * once.
   *
   * Rejects only with `SdkError` `notInitialized`: after `release()`, or when the native instance did
   * not start.
   */
  flush(): Promise<void>

  /**
   * Stops the instance: nothing more is sent, the events not sent yet stay on the device for the next
   * start, and the instance leaves the registry — `PersonaClick.isInitialized(shopId)` is `false` and
   * `PersonaClick.getInstance(shopId)` throws. Every later call of the instance rejects with `SdkError`
   * `notInitialized` (an earlier method that resolves with its errors resolves with it), and the calls
   * waiting for the init settle so at once. A new `PersonaClick.initialize` of the shop makes a fresh
   * instance, with the same customer. A second call does nothing.
   */
  release(): void

  /**
   * Forgets the shop's customer on this device: the device id, the session, the events not sent yet,
   * the saved `/init` answer, the tracking source, the date the push token was last sent, the search
   * widget's recent searches and the widgets' answers kept in memory. The push token, the A/B group,
   * the stories' state and the popups shown stay: they belong to the device. The instance stays usable
   * and asks `/init` for a new device id at once; the calls that go through JavaScript wait for it, and
   * the push token the SDK registered goes to the next customer. Other shops keep their customers.
   *
   * Resolves once the data is wiped, not waiting for the new device id. Rejects only with `SdkError`
   * `notInitialized`: after `release()`, or when the native instance did not start.
   */
  deleteUserCredentials(): Promise<void>

  /**
   * The shop's tracking events, through the native SDK's queue. Replaces `track`, `trackEvent`,
   * `trackPurchase`, `trackSource`, `trackStoryView`, `trackStoryClick` and `trackPopupShown`.
   */
  readonly tracking: import('./types/tracking.js').TrackingApi

  /** The catalog: product cards, listings, counters, categories. */
  readonly products: import('./types/namespaces.js').ProductsApi
  /** Product collections set up in the shop's account. */
  readonly collections: import('./types/namespaces.js').CollectionsApi
  /** Recommendation blocks set up in the shop's account. */
  readonly recommendations: import('./types/namespaces.js').RecommendationsApi
  /** Blank, instant and full search, and the search agent. */
  readonly search: SearchNamespace
  /** The customer's cart on the server. */
  readonly cart: CartNamespace
  /** The customer's profile, last order and orders. */
  readonly profile: import('./types/namespaces.js').ProfileApi
  /** Subscriptions to channels, to a product's price and to its stock. */
  readonly subscriptions: SubscriptionsNamespace
  /** The customer's segments and the device's A/B group. */
  readonly segments: SegmentsNamespace
  /** Push events the app reports itself, the push token, the notification history. */
  readonly notifications: import('./types/namespaces.js').NotificationsApi
  /** Stories blocks. */
  readonly stories: import('./types/namespaces.js').StoriesApi
  /** The probability that the customer buys. */
  readonly predict: import('./types/namespaces.js').PredictApi
  /** The loyalty program on the customer's side. */
  readonly loyalty: import('./types/namespaces.js').LoyaltyApi
  /** Banner sliders; their banners' events are `tracking.bannerView` and `bannerClick`. */
  readonly sliders: import('./types/namespaces.js').SlidersApi
  /** NPS, CSAT and CES ratings, their dictionaries, and the reviews of products. */
  readonly reviews: import('./types/namespaces.js').ReviewsApi

  /** @deprecated Use `recommendations.get(code, request)`. The API's answer; an error comes as the result. */
  recommend(code: string, options?: Record<string, unknown>): Promise<any>

  /** @deprecated Use `search.blank()`. The API's answer; an error comes as the result. */
  searchBlank(): Promise<any>

  /** @deprecated Use `stories.get(code)`. The API's answer, as the UI kit's stories read it. */
  getStories(code: string): Promise<any>

  /** @deprecated Use `predict.getProbabilityToPurchase()`. */
  getProbabilityToPurchase(
    params?: import('./types/purchasePredict.js').PurchasePredictParams,
  ): Promise<import('./types/purchasePredict.js').PurchasePredictResponse>

  /** @deprecated Use `cart.get()`. */
  getProductsFromCart(): Promise<{ productId: string; quantity: number }[]>

  /** @deprecated Use `profile.set(request)`. */
  setProfile(params: Record<string, unknown>): void

  /** @deprecated Use `subscriptions`: `subscribeForPriceDrop`, `subscribeForBackInStock`, … */
  triggers(triggerName: string, data?: Record<string, unknown>): void

  /** @deprecated Use `segments.getAbGroup()`. */
  getCurrentSegment(): string

  /** @deprecated Use `reviews.createNps(rate, channel, category, params)`. */
  review(rate: number, channel: string | null | undefined, category: string, orderId?: string, comment?: string): Promise<void>

  /** @deprecated Use `reviews.getNpsChannels()`. The API's keys (`snake_case`). */
  getNpsChannels(): Promise<any>

  /** @deprecated Use `reviews.getNpsCategories()`. The API's keys (`snake_case`). */
  getNpsCategories(): Promise<any>

  /** @deprecated Use `notifications.trackClicked(code, type)`. */
  notificationClicked(options: { code: string; type: string }): void

  /** @deprecated Use `notifications.trackOpened(code, type)`. */
  notificationOpened(options: { code: string; type: string }): void

  /** @deprecated Use `notifications.trackDelivered(code, type)`. */
  notificationDelivered(options: { code: string; type: string }): void

  /**
   * Legacy event tracking API.
   *
   * Note: the SDK also supports other events via this method; only the `purchase`
   * variant is deprecated in favor of the strict `tracking.purchase` contract.
   */
  track(event: string, data?: unknown): void

  /**
   * @deprecated Use `tracking.purchase(request, source)` with `PurchaseTrackingRequest` instead.
   */
  track(event: 'purchase', data: unknown): void

  /**
   * Strict purchase tracking (`push`, `event` = `purchase`) with 4.x's request, sent as in 4.x.
   * @deprecated Use `tracking.purchase(request, source)` with `PurchaseTrackingRequest`.
   */
  trackPurchase(request: import('./types/purchaseTracking.js').LegacyPurchaseTrackingRequest): void

  /**
   * Fetches the products of the user's last order (`orders/last_for_user`).
   * @deprecated Use `profile.getLastOrder()`.
   */
  getLastOrderProducts(options?: Record<string, unknown>): Promise<unknown[]>

  /**
   * Fetches the list of the user's orders (`orders/by_user`). Requires `shop_secret` in options.
   * @deprecated Use `profile.getOrders(shopSecret, params)`.
   */
  getUserOrders(options: Record<string, unknown>): Promise<unknown[]>

  /**
   * Joins the loyalty program (`loyalty/members/join`). Requires `phone` in params.
   * @deprecated Use `loyalty.join(phone, params)`.
   */
  loyaltyJoin(params: Record<string, unknown>): Promise<unknown>

  /**
   * Fetches the loyalty membership status (`loyalty/members/status`) for the given identifier (phone).
   * @deprecated Use `loyalty.getStatus(phone)`.
   */
  getLoyaltyStatus(identifier: string): Promise<unknown>

  /**
   * Fetches the stored user profile (`GET /profile`). No parameters required.
   * @deprecated Use `profile.get()`.
   */
  getProfile(): Promise<unknown>

  /**
   * Fetches view/cart/purchase counters and trigger counts for a product (`GET /products/counters`).
   * @deprecated Use `products.getCounters(itemId)`.
   */
  getProductCounters(item: string): Promise<unknown>

  /**
   * Fetches full product info by id (`GET /products/get`, `item_id`).
   * @deprecated Use `products.getInfo(itemId)`.
   */
  getProductInfo(id: string): Promise<import('./types/productModels.js').ProductInfo>

  /**
   * Fetches a products list (`GET /products`) with optional filters; `filters` is sent as a JSON
   * string.
   * @deprecated Use `products.getList(request)`.
   */
  getProductsList(options?: {
    brands?: string
    merchants?: string
    categories?: string
    locations?: string
    limit?: number
    page?: number
    filters?: Record<string, unknown>
  }): Promise<import('./types/productModels.js').LegacyProductsListResponse>

  /**
   * Fetches a category listing (`GET /category/{category}`). `category` is the slug; `params`
   * are sent as they are — see `CategoryParams` (other keys pass through too).
   * @deprecated Use `products.getCategory(categoryId, request)`.
   */
  getCategory(category: string, params?: CategoryParams): Promise<unknown>

  /**
   * Fetches a configured product collection (`GET /collection/{id}`). `collectionId`
   * is configured in the dashboard; optional `params` may include `location`,
   * `email`, `phone`, `external_id`, `loyalty_id`.
   * @deprecated Use `collections.get(collectionId)`.
   */
  getCollection(collectionId: string | number, params?: Record<string, unknown>): Promise<unknown>
}

export default PersonaClick

/** The instance of a shop (`PersonalizationSdk` of the contract): the class `PersonaClick`. */
export type PersonalizationSdk = PersonaClick

/** @see ./components/Popup/SdkPopupOverlay */
export const SdkPopupOverlay: ComponentType<Record<string, unknown>>
export function registerSdkPopupOverlaySDK(...args: unknown[]): void
