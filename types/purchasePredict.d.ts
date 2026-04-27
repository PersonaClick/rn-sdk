/**
 * Optional identifiers for `getProbabilityToPurchase`.
 * `shop_id`, `did`, session and `stream` are added by the SDK.
 */
export type PurchasePredictParams = {
  email?: string
  phone?: string
  telegram_id?: string
  loyalty_id?: string
}

/** Successful JSON body from GET predict/probability-to-purchase */
export type PurchasePredictResponse = {
  probability: number
  client_id: string
}
