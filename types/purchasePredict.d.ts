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

/** The prediction (`payload` of GET api/v3/cdp/users/probability-to-purchase). `client_id` comes as a number (null for a visitor the shop does not know). */
export type PurchasePredictResponse = {
  probability: number
  client_id: number | string | null
}
