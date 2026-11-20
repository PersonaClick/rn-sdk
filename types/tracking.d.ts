import type { PurchaseTrackingRequest } from './purchaseTracking.js'
import type { CustomEventParams } from './customEventParams.js'

/** A position of the cart. */
export interface TrackingItem {
  id: string
  /** 1 by default; the server takes 1 to 1000. */
  quantity?: number
  /** Not below 0. */
  price?: number
  fashionSize?: string
}

/**
 * What led to the event. `transactional` and `webPushDigest` are for `setSource` only. `slider` (a
 * slider's banner) and `agentSearch` (the search agent's answer) go as `slider` and `agent_search`.
 */
export type TrackingSourceType =
  | 'dynamic'
  | 'chain'
  | 'bulk'
  | 'transactional'
  | 'instantSearch'
  | 'fullSearch'
  | 'stories'
  | 'webPushDigest'
  | 'slider'
  | 'agentSearch'

export interface TrackingSource {
  type: TrackingSourceType
  code: string
}

/**
 * The shop's tracking events (`tracking` of the SDK contract). Every method but `setSource` resolves
 * once the event is accepted into the SDK's queue, on Android and iOS alike — the native SDK sends it,
 * repeats it after a failure and after a restart; what the server answers later does not reach the
 * call — and rejects with an `SdkError` (`notInitialized`, `shopBlocked`, `invalidArgument`), never
 * with a network error. Without the SDK's native module the event is sent from JavaScript and the
 * call settles on the server's answer.
 */
export interface TrackingApi {
  productView(itemId: string, source?: TrackingSource): Promise<void>
  categoryView(categoryId: string): Promise<void>
  /** @param results not read by the server; goes away in a major release. */
  search(query: string, results?: string[]): Promise<void>
  addToCart(item: TrackingItem, source?: TrackingSource): Promise<void>
  /** The whole cart; an empty list is an empty cart. */
  syncCart(items: TrackingItem[]): Promise<void>
  removeFromCart(itemId: string): Promise<void>
  addToFavorites(itemId: string, source?: TrackingSource): Promise<void>
  /** The whole list of favorites; an empty list is none. */
  syncFavorites(itemIds: string[]): Promise<void>
  removeFromFavorites(itemId: string): Promise<void>
  purchase(request: PurchaseTrackingRequest, source?: TrackingSource): Promise<void>
  /** A slide the server does not take (a product campaign's `{storyId}_{index}`) is not sent. */
  storyView(storyId: string, slideId: string, code?: string): Promise<void>
  storyClick(storyId: string, slideId: string, code?: string): Promise<void>
  /** `bannerId` and `code` of the slider's banner (`SliderBanner.id`, `SliderBanner.code`). */
  bannerView(bannerId: string, code: string): Promise<void>
  bannerClick(bannerId: string, code: string): Promise<void>
  popupShown(popupId: number): Promise<void>
  /**
   * `time` (unix seconds) and `value` are whole numbers of 32 bits, as both native SDKs take them; another
   * number rejects with `invalidArgument`.
   */
  custom(event: string, params?: CustomEventParams): Promise<void>
  /** Stores the source for 48 hours: it goes with the shop's `push` events. */
  setSource(source: TrackingSource): void
}
