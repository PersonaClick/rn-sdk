import type { ComponentType } from 'react'

export type { CustomEventParams } from './types/customEventParams.js'
export type { PurchasePredictParams, PurchasePredictResponse } from './types/purchasePredict.js'
export type {
  PurchaseItemRequest,
  PurchaseRecommendedBy,
  PurchaseTrackingRequest,
} from './types/purchaseTracking.js'

export const SESSION_CODE_EXPIRE: number
export const SDK_API_URL: string
export const SDK_STORAGE_NAME: string
export const SDK_PUSH_CHANNEL: string

export function parseCartItem(json: Record<string, unknown>): unknown
export function parseProduct(json: Record<string, unknown>): unknown
export function parseProductInfo(json: Record<string, unknown>): unknown
export function parseProductsListResponse(json: Record<string, unknown>): unknown

/** Configuration for `PersonaClick.initialize` / `PersonaClick.registerShops`. */
export interface PersonaClickConfig {
  /** Shop identifier — the partition key. Required. */
  shopId: string
  /** Analytics stream (e.g. `Platform.OS`). */
  stream?: string
  /** Enable debug logging. Process-global and sticky-on across instances. */
  debug?: boolean
  /** Register the push token automatically on init. Defaults to true. */
  autoSendPushToken?: boolean
  /**
   * Reserved for cross-platform parity — NOT yet applied in the React Native SDK, which always uses
   * the default API host (`SDK_API_URL`).
   */
  apiDomain?: string
  /**
   * Reserved for cross-platform parity — NOT yet applied. Storage is always partitioned by `shopId`.
   */
  storageKey?: string
}

/** Cancels an `awaitInstance` subscription. Safe to call more than once. */
export type Cancellable = () => void

/**
 * Push lifecycle events routed by `PersonaClick.handlePush`. RN-native set (one per `track/*` endpoint):
 * `DELIVERED` (arrived) ≈ Android `RECEIVED`, `OPENED` (shown), `CLICKED` (tapped).
 */
export const PushEvent: {
  readonly DELIVERED: 'delivered'
  readonly OPENED: 'opened'
  readonly CLICKED: 'clicked'
}
export type PushEventValue = (typeof PushEvent)[keyof typeof PushEvent]

/** Raised when a requested shop is unknown — nothing registered, or no such shop. */
export class UnknownShopIdError extends Error {}

/** Raised by `getInstance()` with no shopId when more than one shop is registered. */
export class AmbiguousShopError extends Error {}

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
   * @deprecated Use `PersonaClick.initialize(config)` (or `PersonaClick.registerShops(...)` +
   * `PersonaClick.getInstance(shopId)`). The constructor still works and registers the instance.
   */
  constructor(...args: unknown[])

  /** Initializes an SDK for `config` immediately and returns it (also reachable via `getInstance`). */
  static initialize(config: PersonaClickConfig): PersonaClick

  /**
   * Registers shops without initializing them (lazy on first `getInstance`). Pass
   * `{ eagerInit: true }` to initialize every shop up front.
   */
  static registerShops(configs: PersonaClickConfig[], options?: { eagerInit?: boolean }): void

  /**
   * Returns the SDK for `shopId` (materializing a pending registration on first use). With no
   * `shopId`, returns the single instance when exactly one shop is registered.
   *
   * @throws {AmbiguousShopError} no `shopId` and more than one shop registered.
   * @throws {UnknownShopIdError} the shop is unknown.
   */
  static getInstance(shopId?: string): PersonaClick

  /**
   * True when an instance is available for `shopId` — or, with no `shopId`, when exactly one shop is
   * initialized so the default is unambiguous.
   */
  static isInitialized(shopId?: string): boolean

  /**
   * Delivers the instance for `shopId` to `onReady` as soon as it is available; returns a cancel
   * function. An ambiguous default (no `shopId`, several shops) warns and does not resolve.
   */
  static awaitInstance(shopId: string | null, onReady: (sdk: PersonaClick) => void): Cancellable

  /**
   * Routes a push to the instance it belongs to (by the payload's `shop_id`) and tracks `event`.
   * No `shop_id` with a single live shop still resolves; an unknown shop, or no `shop_id` while
   * several shops are live, drops the push. Tracking-only — navigation stays with the host.
   */
  static handlePush(payload: Record<string, unknown>, event: PushEventValue): void

  /**
   * Legacy event tracking API.
   *
   * Note: the SDK also supports other events via this method; only the `purchase`
   * variant is deprecated in favor of the strict `trackPurchase` contract.
   */
  track(event: string, data?: unknown): void

  /**
   * @deprecated Use `trackPurchase(request)` with `PurchaseTrackingRequest` instead.
   */
  track(event: 'purchase', data: unknown): void

  /**
   * Strict purchase tracking (`push`, `event` = `purchase`).
   */
  trackPurchase(request: import('./types/purchaseTracking.js').PurchaseTrackingRequest): void

  /**
   * Fetches the products of the user's last order (`orders/last_for_user`).
   */
  getLastOrderProducts(options?: Record<string, unknown>): Promise<unknown[]>

  /**
   * Fetches the list of the user's orders (`orders/by_user`). Requires `shop_secret` in options.
   */
  getUserOrders(options: Record<string, unknown>): Promise<unknown[]>

  /**
   * Joins the loyalty program (`loyalty/members/join`). Requires `phone` in params.
   */
  loyaltyJoin(params: Record<string, unknown>): Promise<unknown>

  /**
   * Fetches the loyalty membership status (`loyalty/members/status`) for the given identifier (phone).
   */
  getLoyaltyStatus(identifier: string): Promise<unknown>

  /**
   * Fetches the stored user profile (`GET /profile`). No parameters required.
   */
  getProfile(): Promise<unknown>

  /**
   * Fetches view/cart/purchase counters and trigger counts for a product (`GET /products/counters`).
   */
  getProductCounters(item: string): Promise<unknown>

  /**
   * Fetches a category listing (`GET /category/{category}`). `category` is the slug;
   * optional `params` may include `limit`, `page`, `brands`, `locations`, `filters`.
   */
  getCategory(category: string, params?: Record<string, unknown>): Promise<unknown>

  /**
   * Fetches a configured product collection (`GET /collection/{id}`). `collectionId`
   * is configured in the dashboard; optional `params` may include `location`,
   * `email`, `phone`, `external_id`, `loyalty_id`.
   */
  getCollection(collectionId: string | number, params?: Record<string, unknown>): Promise<unknown>
}

export default PersonaClick

/** @see ./components/Popup/SdkPopupOverlay */
export const SdkPopupOverlay: ComponentType<Record<string, unknown>>
export function registerSdkPopupOverlaySDK(...args: unknown[]): void
