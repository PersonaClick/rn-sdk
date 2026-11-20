/** A line of the order (`PurchaseItem` of the SDK contract). */
export interface PurchaseItem {
  id: string
  /** From 1. */
  amount: number
  price: number
  lineId?: string
  fashionSize?: string
}

/**
 * The order of `tracking.purchase(request, source?)` (`PurchaseTrackingRequest` of the SDK contract):
 * what led to the purchase goes as the call's `source`. Optional fields use `?` — omit them when not
 * needed (do not pass `null`).
 */
export interface PurchaseTrackingRequest {
  /** Not empty. */
  orderId: string
  orderPrice: number
  /** Not empty. */
  items: PurchaseItem[]
  deliveryType?: string
  deliveryAddress?: string
  paymentType?: string
  /** `false` by default. */
  isTaxFree?: boolean
  promocode?: string
  orderCash?: number
  orderBonuses?: number
  orderDelivery?: number
  orderDiscount?: number
  channel?: string
  /** Free fields; `tax_free` and `gift_package` are reserved. */
  custom?: Record<string, unknown>
  /** `false` by default; sent only when `true`. */
  isGiftPackage?: boolean
}

/**
 * A line of the deprecated `trackPurchase`'s request, as 4.x had it.
 * @deprecated `tracking.purchase` takes `PurchaseItem`, without `quantity`.
 */
export interface PurchaseItemRequest extends PurchaseItem {
  quantity?: number
}

/**
 * The attribution of the deprecated `trackPurchase`'s request (`recommended_by` / `recommended_code`).
 * @deprecated `tracking.purchase` takes it as its `source`.
 */
export interface PurchaseRecommendedBy {
  type: string
  code?: string
}

/**
 * The request of the deprecated `trackPurchase`: 4.x's `PurchaseTrackingRequest`, sent as in 4.x.
 * @deprecated Use `tracking.purchase(request, source)` with `PurchaseTrackingRequest`.
 */
export interface LegacyPurchaseTrackingRequest extends Omit<PurchaseTrackingRequest, 'items'> {
  items: PurchaseItemRequest[]
  recommendedBy?: PurchaseRecommendedBy
  recommendedSource?: Record<string, unknown>
  stream?: string
  segment?: string
}
