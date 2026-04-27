/**
 * One purchased line item (strict mobile contract).
 * Required: `id`, `amount`, `price`.
 */
export interface PurchaseItemRequest {
  id: string
  amount: number
  price: number
  quantity?: number
  lineId?: string
  fashionSize?: string
}

/**
 * Recommendation context for purchase (maps to `recommended_by` / `recommended_code`).
 */
export interface PurchaseRecommendedBy {
  type: string
  code?: string
}

/**
 * Strict purchase tracking request for `push` (`event` = `purchase`).
 * Optional fields use `?` — omit properties when not needed (do not pass `null`).
 */
export interface PurchaseTrackingRequest {
  orderId: string
  orderPrice: number
  items: PurchaseItemRequest[]
  deliveryType?: string
  deliveryAddress?: string
  paymentType?: string
  isTaxFree?: boolean
  promocode?: string
  orderCash?: number
  orderBonuses?: number
  orderDelivery?: number
  orderDiscount?: number
  channel?: string
  custom?: Record<string, unknown>
  recommendedBy?: PurchaseRecommendedBy
  recommendedSource?: Record<string, unknown>
  stream?: string
  segment?: string
}
