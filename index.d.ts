import type { ComponentType } from 'react'

export type { CustomEventParams } from './types/customEventParams.js'
export type { PurchasePredictParams, PurchasePredictResponse } from './types/purchasePredict.js'

export const SESSION_CODE_EXPIRE: number
export const SDK_API_URL: string
export const SDK_STORAGE_NAME: string
export const SDK_PUSH_CHANNEL: string

export function parseCartItem(json: Record<string, unknown>): unknown
export function parseProduct(json: Record<string, unknown>): unknown
export function parseProductInfo(json: Record<string, unknown>): unknown
export function parseProductsListResponse(json: Record<string, unknown>): unknown

/** @see ./MainSDK.js — default export is the SDK class (implementation in JS). */
declare const Rees46: any
export default Rees46

/** @see ./components/Popup/SdkPopupOverlay */
export const SdkPopupOverlay: ComponentType<Record<string, unknown>>
export function registerSdkPopupOverlaySDK(...args: unknown[]): void
