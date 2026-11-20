import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * The SDK's native module: the bridge to the native Android and iOS SDKs on their new core. Each
 * method calls the native method of the same meaning and hands back its result; the bridge keeps no
 * requests, storage, queue or registry of its own.
 *
 * A shop's snapshot is `{ shopId, state, deviceId, sessionId, segment, agentEnabled, pushToken,
 * pushTokens }`: `state` is one of `notInitialized`, `initializing`, `ready`, `retrying`, `refused`;
 * `deviceId` and `sessionId` are null while the shop has none; `segment` is the device's A/B group;
 * `agentEnabled` whether the last `/init` turned the search agent on; `pushToken` the token the native SDK
 * sent last for the shop, `{ token, provider }` or null, and `pushTokens` each provider's token it keeps
 * (`{ fcm: '…' }`). The module tells every change of the state or the session with the
 * `PersonaClickStateChanged` event, and every shop's snapshot to a listener as soon as it is added.
 *
 * While `setLogHandler(true)`, each message the native SDK logs comes with the `PersonaClickLog` event:
 * `{ level, code, message, shopId, context }`, `SdkLogMessage` of the contract.
 *
 * The native SDK shows no server popup: each one — of the `/init` answer and of the events' answers —
 * comes with the `PersonaClickPopup` event `{ shopId, popup }`, `popup` with the server's field names
 * (`id`, `position`, `delay`, `html`, `components`, `popup_actions`, …), for JavaScript to show. One that
 * comes while JavaScript has no listener is held for a minute and handed to the next one.
 *
 * A rejection carries the native error's type as its code — `notInitialized`, `shopBlocked`,
 * `invalidArgument`, `network`, `timeout`, `http`, `decoding`, `cancelled` — and, for `http`, the
 * HTTP code and the server's code in `userInfo` (`httpCode`, `serverCode`).
 *
 * The namespaces' methods are named `<namespace><Method>` and take the shop first. Their arguments:
 * - an optional value is `null` when not given;
 * - a request model (`ProductsListRequest`, `ProfileUpdateRequest`, …) is a map with the contract's
 *   field names; a value of an enumeration in it is its wire value (`m`, `sales_rate`, `asc`);
 * - a source is `{ type, code }` with the wire value of its type (`instant_search`);
 * - a value of the wrong type, or a required one missing, rejects with `invalidArgument`; the rest of
 *   the checks are the native SDK's.
 * A result is the native model as a map with the contract's field names: every field of the model is
 * there, `null` when the model has none; an enumeration's value is the contract's name (`male`,
 * `textBlock`); a free field (`customProperties`, `customFields`) is the JSON it holds.
 */
export interface Spec extends TurboModule {
  /**
   * Initializes the shop's native instance, or finds the one it has, and resolves with its snapshot.
   * `config`: `shopId` (required), `apiDomain`, `appDomain`, `stream` (`react-native` when absent),
   * `deviceId`, `segment`, `needReInitialization`, `sendAdvertisingId`, `storageKey`, `logLevel`.
   */
  initializeShop(config: Object): Promise<Object>;

  /**
   * `PersonaClick.setLogHandler`: on, every message the native SDK logs — of every shop, at or above its
   * `logLevel` — comes as the `PersonaClickLog` event; off, none comes.
   */
  setLogHandler(enabled: boolean): void;

  /** The shop's device id, or null before the server handed one out. */
  getDeviceId(shopId: string): Promise<string | null>;

  /**
   * An event of `path` (`push`, `push/custom`, `track/stories`, `track/slider`, `popup/showed`)
   * through the shop's native queue: resolves once the queue accepted it. `body` holds the event's own
   * fields; the queue adds the device id, the session, the segment, the stream and, on `push`, the
   * stored source. Only for the events the `tracking` methods below do not cover.
   */
  queueEvent(shopId: string, path: string, body: Object): Promise<void>;

  /** Stores the shop's tracking source for 48 hours: it goes with its `push` events. */
  setSource(shopId: string, type: string, code: string): Promise<void>;

  // The instance — `sdk/contract/root.md`.

  /**
   * Sends the shop's queued events now: resolves once each event queued at the call was tried — sent,
   * dropped, or kept for later (no network, the server asked to wait). Rejects only with
   * `notInitialized`: the shop has no instance, or it was released.
   */
  flush(shopId: string): Promise<void>;

  /**
   * Releases the shop's instance: it stops sending, its queue stays on the disk, it leaves the registry,
   * and the module stops telling its state. Every later call for the shop rejects with
   * `notInitialized` until `initializeShop` makes a fresh instance. Nothing for a shop without one.
   */
  releaseShop(shopId: string): void;

  /**
   * Forgets the shop's customer: the device id, the session, the queue, the saved `/init` answer and the
   * rest of the customer's data; the instance asks `/init` for a new device id at once. Resolves once
   * the data is wiped, not waiting for the new id. Rejects only with `notInitialized`.
   */
  deleteUserCredentials(shopId: string): Promise<void>;

  // tracking — `sdk/contract/tracking.md`. Each resolves once the native queue accepted the event, on both
  // platforms (Android's `tracking.queued`), and rejects only with what refused it at once:
  // `invalidArgument`, `shopBlocked`, `notInitialized`. The server's later answer does not reach it.

  trackingProductView(shopId: string, itemId: string, source: Object | null): Promise<void>;
  trackingCategoryView(shopId: string, categoryId: string): Promise<void>;
  trackingSearch(shopId: string, query: string, results: Array<string> | null): Promise<void>;
  /** `item`: `{ id, quantity?, price?, fashionSize? }`. */
  trackingAddToCart(shopId: string, item: Object, source: Object | null): Promise<void>;
  trackingSyncCart(shopId: string, items: Array<Object>): Promise<void>;
  trackingRemoveFromCart(shopId: string, itemId: string): Promise<void>;
  trackingAddToFavorites(shopId: string, itemId: string, source: Object | null): Promise<void>;
  trackingSyncFavorites(shopId: string, itemIds: Array<string>): Promise<void>;
  trackingRemoveFromFavorites(shopId: string, itemId: string): Promise<void>;
  /** `request`: `PurchaseTrackingRequest` of the contract. */
  trackingPurchase(shopId: string, request: Object, source: Object | null): Promise<void>;
  trackingStoryView(shopId: string, storyId: string, slideId: string, code: string | null): Promise<void>;
  trackingStoryClick(shopId: string, storyId: string, slideId: string, code: string | null): Promise<void>;
  trackingBannerView(shopId: string, bannerId: string, code: string): Promise<void>;
  trackingBannerClick(shopId: string, bannerId: string, code: string): Promise<void>;
  trackingPopupShown(shopId: string, popupId: number): Promise<void>;
  trackingCustom(
    shopId: string,
    event: string,
    time: number | null,
    category: string | null,
    label: string | null,
    value: number | null,
    customFields: Object | null,
  ): Promise<void>;

  // products — `sdk/contract/products.md`

  /** `Product`, or null for a product the catalog does not have. */
  productsGetInfo(shopId: string, itemId: string): Promise<Object | null>;
  /** `request`: `ProductsListRequest`. Resolves with `ProductsListResponse`. */
  productsGetList(shopId: string, request: Object | null): Promise<Object>;
  /** `ProductCountersResponse`. */
  productsGetCounters(shopId: string, itemId: string): Promise<Object>;
  /** `request`: `CategoryRequest`. Resolves with `CategoryResponse`. */
  productsGetCategory(shopId: string, categoryId: string, request: Object | null): Promise<Object>;

  // collections — `sdk/contract/collections.md`

  /** `CollectionResponse`. */
  collectionsGet(shopId: string, collectionId: string): Promise<Object>;

  // recommendations — `sdk/contract/recommendations.md`

  /** `request`: `RecommendationRequest`. Resolves with `RecommendationResponse`. */
  recommendationsGet(shopId: string, code: string, request: Object | null): Promise<Object>;

  // search — `sdk/contract/search.md`

  /** `SearchBlankResponse`. */
  searchBlank(shopId: string): Promise<Object>;
  /** `SearchInstantResponse`. */
  searchInstant(
    shopId: string,
    query: string,
    locations: Array<string> | null,
    excludedMerchants: Array<string> | null,
    excludedBrands: Array<string> | null,
  ): Promise<Object>;
  /** `request`: `SearchFullRequest`. Resolves with `SearchFullResponse`. */
  searchFull(shopId: string, query: string, request: Object | null): Promise<Object>;
  /** `AgentDialogResponse`. */
  searchAgentDialog(shopId: string, sessionId: number | null, locations: Array<string> | null): Promise<Object>;
  /** `AgentResponse`. */
  searchAgent(shopId: string, message: string, sessionId: number | null, locations: Array<string> | null): Promise<Object>;

  // cart — `sdk/contract/cart.md`

  /** A list of `CartItem`. */
  cartGet(shopId: string): Promise<Array<Object>>;
  /** A server method with the shop's secret (decision 0006). */
  cartClear(
    shopId: string,
    shopSecret: string,
    email: string | null,
    phone: string | null,
    loyaltyId: string | null,
    externalId: string | null,
    telegramId: string | null,
  ): Promise<void>;

  // profile — `sdk/contract/profile.md`

  /** `Profile`. */
  profileGet(shopId: string): Promise<Object>;
  /** `request`: `ProfileUpdateRequest`. */
  profileSet(shopId: string, request: Object): Promise<void>;
  /** A list of `Product`. */
  profileGetLastOrder(shopId: string): Promise<Array<Object>>;
  /** A server method with the shop's secret (decision 0006). A list of `Order`. */
  profileGetOrders(
    shopId: string,
    shopSecret: string,
    did: string | null,
    email: string | null,
    phone: string | null,
    loyaltyId: string | null,
    externalId: string | null,
    dateFrom: string | null,
  ): Promise<Array<Object>>;

  // subscriptions — `sdk/contract/subscriptions.md`

  /** `request`: `SubscriptionsUpdateRequest`. */
  subscriptionsManage(shopId: string, request: Object): Promise<void>;
  /** `SubscriptionStatus`. */
  subscriptionsCheck(shopId: string): Promise<Object>;
  subscriptionsSubscribeForPriceDrop(
    shopId: string,
    itemId: string,
    currentPrice: number,
    email: string | null,
    phone: string | null,
  ): Promise<void>;
  subscriptionsUnsubscribeFromPriceDrop(
    shopId: string,
    itemIds: Array<string>,
    email: string | null,
    phone: string | null,
  ): Promise<void>;
  /** `properties`: `BackInStockProperties`. */
  subscriptionsSubscribeForBackInStock(
    shopId: string,
    itemId: string,
    properties: Object | null,
    email: string | null,
    phone: string | null,
  ): Promise<void>;
  subscriptionsUnsubscribeFromBackInStock(
    shopId: string,
    itemIds: Array<string>,
    email: string | null,
    phone: string | null,
  ): Promise<void>;

  // segments — `sdk/contract/segments.md`. The A/B group is the snapshot's `segment`.

  segmentsAdd(shopId: string, segmentId: number, email: string | null, phone: string | null): Promise<void>;
  segmentsRemove(shopId: string, segmentId: number, email: string | null, phone: string | null): Promise<void>;
  /** A list of `Segment`. */
  segmentsGet(shopId: string): Promise<Array<Object>>;

  // notifications — `sdk/contract/notifications.md`. Receiving pushes stays in JavaScript (React Native
  // Firebase, Notifee); their events and the token go to the native SDK.

  /**
   * A push event of message `code` (the push's `id`) of mailing `type`: `event` is `delivered`, `opened`,
   * `clicked` or `closed`. Through the shop's queue; resolves once it was accepted, or accepted before (one
   * event of a message per process). A click also stores the tracking source.
   */
  notificationsTrack(shopId: string, event: string, code: string, type: string): Promise<void>;
  /**
   * A push token (`provider`: `apns`, `fcm`, `hms`) for the shop, by the contract's rules: a new token goes
   * at once, the same one at most once a week, with the platform's `platform`/`push_provider`. Resolves on
   * the server's answer, or at once when the week's rule sends nothing.
   */
  notificationsSetPushToken(shopId: string, token: string, provider: string): Promise<void>;
  /** `{ token, provider }` the native SDK keeps for the shop (of `provider`, or the last sent), or null. */
  notificationsGetPushToken(shopId: string, provider: string | null): Promise<Object | null>;
  /**
   * Registers shops on the native SDK without starting them, so that a push of a process their
   * JavaScript instance never started goes with the stored device id and no `/init` (`handlePush`). Each
   * config as `initializeShop`'s. Resolves whether the platform can: Android can, iOS cannot yet.
   */
  registerShops(configs: Array<Object>): Promise<boolean>;
  /**
   * A push (its data, values as strings) to the shop its `shop_id` names, its `event` (as
   * `notificationsTrack`) through that shop's queue: a registered shop not started is brought up for the
   * push only. Resolves with the shop's id, or null when the push is not the SDK's or no shop takes it.
   */
  handlePush(payload: Object, event: string): Promise<string | null>;

  /** A server method with the shop's secret (decision 0006). The native history answer. */
  notificationsGetHistory(
    shopId: string,
    shopSecret: string,
    type: string,
    phone: string | null,
    email: string | null,
    externalId: string | null,
    loyaltyId: string | null,
    channel: string | null,
    limit: number | null,
    page: number | null,
    dateFrom: string | null,
    did: string | null,
  ): Promise<Object>;

  // stories — `sdk/contract/stories.md`

  /** `StoriesBlock`. */
  storiesGet(shopId: string, code: string): Promise<Object>;

  // predict — `sdk/contract/predict.md`

  /** `PurchaseProbability`. */
  predictGetProbabilityToPurchase(shopId: string): Promise<Object>;

  // loyalty — `sdk/contract/loyalty.md`

  /** `gender`: `m` or `f`. Resolves with `LoyaltyMember`. */
  loyaltyJoin(
    shopId: string,
    phone: string,
    firstName: string | null,
    lastName: string | null,
    gender: string | null,
    birthday: string | null,
  ): Promise<Object>;
  /** `LoyaltyStatus`. */
  loyaltyGetStatus(shopId: string, phone: string): Promise<Object>;
  /** A list of `LoyaltyPromotion`. */
  loyaltyGetPromotions(
    shopId: string,
    locationId: string | null,
    promoCodes: Array<string> | null,
    chargeBonuses: boolean | null,
    currentTime: string | null,
  ): Promise<Array<Object>>;

  // sliders — `sdk/contract/sliders.md`

  /** `Slider`. */
  slidersGet(shopId: string, code: string, tags: Array<string> | null, locationId: string | null): Promise<Object>;

  // reviews — `sdk/contract/reviews.md`

  /** `PollReview`. */
  reviewsCreateNps(
    shopId: string,
    rate: number,
    channel: string,
    category: string,
    orderId: string | null,
    comment: string | null,
    label: string | null,
  ): Promise<Object>;
  /** `PollReview`. */
  reviewsCreateCsat(
    shopId: string,
    rate: number,
    channel: string,
    campaign: string,
    orderId: string | null,
    comment: string | null,
    label: string | null,
  ): Promise<Object>;
  /** `PollReview`. */
  reviewsCreateCes(
    shopId: string,
    rate: number,
    channel: string,
    campaign: string,
    orderId: string | null,
    comment: string | null,
    label: string | null,
  ): Promise<Object>;
  /** A list of `NpsCategory`. */
  reviewsGetNpsCategories(shopId: string): Promise<Array<Object>>;
  /** A list of `PollChannel`. */
  reviewsGetNpsChannels(shopId: string): Promise<Array<Object>>;
  /** A list of `CsatCampaign`. */
  reviewsGetCsatCampaigns(shopId: string): Promise<Array<Object>>;
  /** A list of `CesCampaign`. */
  reviewsGetCesCampaigns(shopId: string): Promise<Array<Object>>;
  /** `ProductReviewsResponse`. */
  reviewsGetProductReviews(shopId: string, itemId: string, limit: number | null, offset: number | null): Promise<Object>;
  /** A list of `ClientReview`. */
  reviewsGetClientReviews(shopId: string, orderId: string): Promise<Array<Object>>;

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.get<Spec>('PersonaClickNative');
