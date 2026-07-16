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

/** @see ./MainSDK.js — default export is the SDK class (implementation in JS). */
declare class PersonaClick {
  constructor(...args: unknown[])

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
