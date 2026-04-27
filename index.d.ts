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
}

export default PersonaClick

/** @see ./components/Popup/SdkPopupOverlay */
export const SdkPopupOverlay: ComponentType<Record<string, unknown>>
export function registerSdkPopupOverlaySDK(...args: unknown[]): void
