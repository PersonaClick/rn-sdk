/**
 * The namespaces of the SDK contract (`sdk.<namespace>.<method>`), on the native Android and iOS SDKs.
 * Every model carries every field of the contract: a field the server may leave out is `null` when it
 * did; a field the contract gives a value always (a default, `""`, an empty list) is never `null`.
 * Every method rejects with an `SdkError`; without the SDK's native module (Expo Go, an app not rebuilt
 * after installing the SDK) with `notInitialized`, and so after the instance's `release()`.
 */

// products — sdk/contract/products.md

/** Open set: a key the server adds goes as it is. */
export type SortBy =
  | 'price'
  | 'discount'
  | 'salesRate'
  | 'date'
  | 'priceMargin'
  | 'rating'
  | 'relevance'
  | (string & {})

export type SortDirection = 'asc' | 'desc'

export interface ProductCategory {
  id: string
  name: string | null
  url: string | null
  parentId: string | null
  /** Only in a product's categories. */
  level: number | null
  /** Only in facets: how many products were found in the category. */
  count: number | null
  /** Only in facets. */
  alias: string | null
}

export interface ProductParam {
  key: string
  values: string[]
}

export interface Product {
  id: string
  groupId: string | null
  name: string
  brand: string | null
  model: string | null
  description: string | null
  barcode: string | null
  url: string
  deeplinkAndroid: string | null
  deeplinkIos: string | null
  imageUrl: string | null
  picture: string | null
  /** Size (`"120"` … `"520"`, `"original"`) → link. */
  resizedImages: Record<string, string> | null
  price: number
  priceFormatted: string | null
  priceFull: number | null
  priceFullFormatted: string | null
  oldPrice: number | null
  oldPriceFormatted: string | null
  oldPriceFull: number | null
  oldPriceFullFormatted: string | null
  currency: string
  discountPercent: number | null
  discountFormatted: string | null
  salesRate: number | null
  relativeSalesRate: number | null
  rating: number | null
  isNew: boolean
  stockQuantity: number | null
  categoryIds: string[] | null
  categories: ProductCategory[] | null
  params: ProductParam[] | null
  /** With `withLocations`: where the product is, or `["global"]`. */
  locationIds: string[] | null
}

export interface Brand {
  name: string | null
  count: number | null
}

export interface Location {
  id: string | null
  name: string | null
  type: string | null
}

/** A facet: values with their counts, or a numeric range. */
export interface SearchFilter {
  count: number | null
  priority: number | null
  values: Record<string, number> | null
  min: number | null
  max: number | null
}

export interface ColorFilter {
  color: string | null
  count: number | null
}

export interface SizeFilter {
  size: string | null
  count: number | null
}

export interface IndustrialFilters {
  colors: ColorFilter[] | null
  fashionSizes: SizeFilter[] | null
}

export interface PriceRange {
  min: number | null
  max: number | null
}

export interface PriceInterval {
  from: number
  to: number | null
  count: number | null
}

export interface ProductsListRequest {
  categoryIds?: string[]
  brands?: string[]
  merchants?: string[]
  locations?: string[]
  priceMin?: number
  priceMax?: number
  /** Product parameter → values. */
  filters?: Record<string, string[]>
  /** Not `relevance`: that is for `search.full`. */
  sortBy?: SortBy
  sortDir?: SortDirection
  limit?: number
  page?: number
}

export interface CategoryRequest {
  brands?: string[]
  locations?: string[]
  filters?: Record<string, string[]>
  priceMin?: number
  priceMax?: number
  sortBy?: SortBy
  sortDir?: SortDirection
  limit?: number
  page?: number
}

export interface ProductsListResponse {
  productsTotal: number | null
  products: Product[]
  categories: ProductCategory[] | null
  brands: Brand[] | null
  locations: Location[] | null
  filters: Record<string, SearchFilter> | null
  industrialFilters: IndustrialFilters | null
  priceRange: PriceRange | null
  priceRanges: PriceInterval[] | null
  priceMedian: number | null
}

export interface CategoryResponse {
  productsTotal: number | null
  products: Product[]
  categories: ProductCategory[] | null
  brands: Brand[] | null
  filters: Record<string, SearchFilter> | null
  priceRange: PriceRange | null
  priceRanges: PriceInterval[] | null
  priceMedian: number | null
}

/** No data is 0. */
export interface ProductCounter {
  view: number
  cart: number
  purchase: number
}

/** How many customers wait for the product's price to drop or for it to be back in stock; no data is 0. */
export interface ProductCounterTriggers {
  backInStock: number
  priceDrop: number
}

export interface ProductCountersResponse {
  /** Today. */
  daily: ProductCounter | null
  /** The last 30 minutes. */
  now: ProductCounter | null
  triggers: ProductCounterTriggers | null
}

export interface ProductsApi {
  /** The product card; null for a product the catalog does not have. */
  getInfo(itemId: string): Promise<Product | null>
  getList(request?: ProductsListRequest): Promise<ProductsListResponse>
  getCounters(itemId: string): Promise<ProductCountersResponse>
  getCategory(categoryId: string, request?: CategoryRequest): Promise<CategoryResponse>
}

// collections — sdk/contract/collections.md

export interface CollectionResponse {
  products: Product[]
}

export interface CollectionsApi {
  get(collectionId: string): Promise<CollectionResponse>
}

// recommendations — sdk/contract/recommendations.md

export interface RecommendationRequest {
  /** The product of the screen. */
  itemId?: string
  categoryId?: string
  searchQuery?: string
  excludedItemIds?: string[]
  brands?: string[]
  locations?: string[]
  /** From 1. */
  limit?: number
  /** Products with their fields; `false` — ids only. `true` by default. */
  extended?: boolean
  /** Each product's `locationIds`; needs `extended`. */
  withLocations?: boolean
}

export interface RecommendationResponse {
  id: number | null
  title: string | null
  link: string | null
  products: Product[]
  itemIds: string[]
}

export interface RecommendationsApi {
  get(code: string, request?: RecommendationRequest): Promise<RecommendationResponse>
}

// search — sdk/contract/search.md

/** A suggestion or an earlier query. */
export interface Query {
  name: string | null
  url: string | null
  score: number | null
}

export interface PopularItem {
  name: string | null
  url: string | null
}

export interface SearchRedirect {
  query: string | null
  url: string | null
  deeplink: string | null
}

export interface SearchBlankResponse {
  products: Product[] | null
  /** `true` — `products` are the ones the customer viewed lately, `false` — popular ones. */
  lastProducts: boolean
  lastQueries: Query[] | null
  suggests: Query[] | null
  popularCategories: PopularItem[] | null
  popularBrands: PopularItem[] | null
  popularLinks: PopularItem[] | null
}

export interface SearchInstantParams {
  locations?: string[]
  /** Goes only with `locations`. */
  excludedMerchants?: string[]
  excludedBrands?: string[]
}

export interface SearchInstantResponse {
  searchQuery: string | null
  searchQueryOriginal: string | null
  clarification: boolean | null
  productsTotal: number | null
  products: Product[]
  categories: ProductCategory[] | null
  queries: Query[] | null
  locations: Location[] | null
  redirect: SearchRedirect | null
}

export interface SearchFullRequest {
  categoryIds?: string[]
  brands?: string[]
  excludedBrands?: string[]
  merchants?: string[]
  /** Goes only with `locations`. */
  excludedMerchants?: string[]
  locations?: string[]
  priceMin?: number
  priceMax?: number
  colors?: string[]
  fashionSizes?: string[]
  /** Products to leave out, the cart's, say. */
  excludedItemIds?: string[]
  filters?: Record<string, string[]>
  sortBy?: SortBy
  sortDir?: SortDirection
  disableClarification?: boolean
  categoryLimit?: number
  brandLimit?: number
  limit?: number
  page?: number
}

export interface SearchFullResponse {
  searchQuery: string | null
  searchQueryOriginal: string | null
  clarification: boolean | null
  productsTotal: number | null
  products: Product[]
  categories: ProductCategory[] | null
  brands: Brand[] | null
  locations: Location[] | null
  filters: Record<string, SearchFilter> | null
  industrialFilters: IndustrialFilters | null
  priceRange: PriceRange | null
  priceRanges: PriceInterval[] | null
  priceMedian: number | null
}

export interface SearchAgentParams {
  /** Without it: the customer's last session (`agentDialog`), a new one (`agent`). */
  sessionId?: number
  locations?: string[]
}

/** Open set: the server's value as it is. */
export type AgentMessageRole = 'user' | 'assistant' | (string & {})

export interface AgentProduct {
  id: string
  name: string | null
  price: number | null
  oldPrice: number | null
  priceFormatted: string | null
  oldPriceFormatted: string | null
  picture: string | null
  url: string | null
  /** Why the product fits; `""` without an explanation. */
  reason: string
}

export interface AgentMessage {
  /** `null` for a message the server sent without its id: the message is kept. */
  id: number | null
  role: AgentMessageRole | null
  content: string | null
  createdAt: string | null
  /** `[]` for the customer's messages. */
  products: AgentProduct[] | null
}

export interface AgentSession {
  id: number
  title: string | null
  updatedAt: string | null
  /** `[]` in the list of sessions and in `AgentResponse`. */
  messages: AgentMessage[]
}

export interface AgentDialogResponse {
  /** The last 20 sessions, the freshest first, without their messages. */
  sessions: AgentSession[]
  /** The session asked for, with its messages; null when the customer has none yet. */
  session: AgentSession | null
}

export interface AgentResponse {
  /** The session the message went to, without its messages. */
  session: AgentSession
  message: AgentMessage
}

export interface SearchApi {
  /** Whether the last `/init` turned the search agent on; read at once. */
  readonly agentEnabled: boolean
  blank(): Promise<SearchBlankResponse>
  instant(query: string, params?: SearchInstantParams): Promise<SearchInstantResponse>
  full(query: string, request?: SearchFullRequest): Promise<SearchFullResponse>
  agentDialog(params?: SearchAgentParams): Promise<AgentDialogResponse>
  agent(message: string, params?: SearchAgentParams): Promise<AgentResponse>
}

// cart — sdk/contract/cart.md

export interface CartItem {
  id: string
  quantity: number
}

export interface CartClearParams {
  email?: string
  phone?: string
  loyaltyId?: string
  externalId?: string
  telegramId?: string
}

export interface CartApi {
  get(): Promise<CartItem[]>
  /**
   * Empties the cart of the customer one of `params` names. A server method: it takes the shop's secret
   * key, which an app's binary and traffic give away — whether it stays is decided in DEV-4723.
   */
  clear(shopSecret: string, params?: CartClearParams): Promise<void>
}

// profile — sdk/contract/profile.md

export type Gender = 'male' | 'female'

export interface Profile {
  id: string | null
  hasEmail: boolean | null
  emailRegisteredAt: string | null
  gender: Gender | null
  computedGender: Gender | null
  boughtSomething: boolean | null
  /** The shop's own properties; none is an empty map. */
  customProperties: Record<string, unknown>
}

export interface ProfileKid {
  gender?: Gender
  /** `YYYY-MM-DD`. */
  birthday?: string
}

export interface ProfileCar {
  brand?: string
  model?: string
  vds?: string
}

/** Only the fields given change; `""` erases a field the server lets erase. */
export interface ProfileUpdateRequest {
  email?: string
  phone?: string
  externalId?: string
  loyaltyId?: string
  telegramId?: string
  fbId?: string
  vkId?: string
  firstName?: string
  lastName?: string
  gender?: Gender
  /** `YYYY-MM-DD`; `""` erases it. */
  birthday?: string
  /** From 0; 0 erases it. */
  age?: number
  location?: string
  kids?: ProfileKid[]
  cars?: ProfileCar[]
  /** Properties set up in the shop's account. */
  customProperties?: Record<string, unknown>
}

/**
 * The product of an order's line: the native SDK's released model under the names of `Product`. Any
 * field may be `null`: a text or a value the answer does not have — the same on both platforms — and the
 * fields the platform's released model does not have (Android: `model`, `barcode`, `oldPriceFull`,
 * `oldPriceFullFormatted`, `params`; iOS: `deeplinkAndroid`, `categoryIds`, `categories`, `locationIds`).
 */
export type OrderProduct = { [K in keyof Product]: Product[K] | null }

/** A line of an `Order`, as the native SDKs' released model has it: sums are strings; none is `null`. */
export interface OrderItem {
  amount: number | null
  price: string | null
  status: string | null
  originalPrice: string | null
  barcode: string | null
  lineId: string | null
  cancelReason: string | null
  item: OrderProduct | null
}

/**
 * The native SDKs' released model of `orders/by_user`: sums are strings. What the answer does not have is
 * `null` — `taxFree` is `false` — on both platforms.
 */
export interface Order {
  internalId: number | null
  id: string | null
  date: string | null
  value: string | null
  cashValue: string | null
  bonusesValue: string | null
  deliveryValue: string | null
  promocode: string | null
  deliveryDate: string | null
  internalStatus: string | null
  stream: string | null
  channel: string | null
  taxFree: boolean
  deliveryType: string | null
  deliveryAddress: string | null
  orderStatus: string | null
  paymentType: string | null
  items: OrderItem[]
}

export interface ProfileOrdersParams {
  did?: string
  email?: string
  phone?: string
  loyaltyId?: string
  externalId?: string
  /** `YYYY-MM-DD`. */
  dateFrom?: string
}

export interface ProfileApi {
  get(): Promise<Profile>
  set(request: ProfileUpdateRequest): Promise<void>
  /** The products of the customer's last order. */
  getLastOrder(): Promise<Product[]>
  /**
   * The orders of the customer one of `params` names; the SDK does not add its own `did`. A server
   * method with the shop's secret key — see `cart.clear`.
   */
  getOrders(shopSecret: string, params?: ProfileOrdersParams): Promise<Order[]>
}

// subscriptions — sdk/contract/subscriptions.md

export interface ContactParams {
  email?: string
  phone?: string
}

/** `true` subscribes, `false` unsubscribes, a field not given stays as it is. */
export interface SubscriptionsUpdateRequest {
  email?: string
  phone?: string
  externalId?: string
  loyaltyId?: string
  telegramId?: string
  emailBulk?: boolean
  emailChain?: boolean
  emailTransactional?: boolean
  smsBulk?: boolean
  smsChain?: boolean
  smsTransactional?: boolean
  webPushBulk?: boolean
  webPushChain?: boolean
  webPushTransactional?: boolean
  mobilePushBulk?: boolean
  mobilePushChain?: boolean
  mobilePushTransactional?: boolean
  telegramBulk?: boolean
  telegramChain?: boolean
  telegramTransactional?: boolean
  whatsappBulk?: boolean
  whatsappChain?: boolean
  whatsappTransactional?: boolean
  maxBulk?: boolean
  maxChain?: boolean
  maxTransactional?: boolean
  walletBulk?: boolean
  walletChain?: boolean
  walletTransactional?: boolean
}

export interface SubscriptionStatus {
  exists: boolean
  emailBulk: boolean
  emailChain: boolean
  emailTransactional: boolean
  smsBulk: boolean
  smsChain: boolean
  smsTransactional: boolean
  webPushBulk: boolean
  webPushChain: boolean
  webPushTransactional: boolean
  mobilePushBulk: boolean
  mobilePushChain: boolean
  mobilePushTransactional: boolean
  telegramBulk: boolean
  telegramChain: boolean
  telegramTransactional: boolean
  whatsappBulk: boolean
  whatsappChain: boolean
  whatsappTransactional: boolean
  maxBulk: boolean
  maxChain: boolean
  maxTransactional: boolean
  walletBulk: boolean
  walletChain: boolean
  walletTransactional: boolean
  hasWebPush: boolean
  hasMobilePush: boolean
  emailInvalid: boolean
  emailBlacklisted: boolean
  emailBounced: boolean
  emailSuppressed: boolean
  emailConfirmed: boolean
}

export interface BackInStockProperties {
  fashionSize?: string
  fashionColor?: string
  barcode?: string
}

export interface SubscriptionsApi {
  manage(request: SubscriptionsUpdateRequest): Promise<void>
  check(): Promise<SubscriptionStatus>
  subscribeForPriceDrop(itemId: string, currentPrice: number, contact?: ContactParams): Promise<void>
  /** An empty list unsubscribes from every product. */
  unsubscribeFromPriceDrop(itemIds: string[], contact?: ContactParams): Promise<void>
  subscribeForBackInStock(itemId: string, properties?: BackInStockProperties, contact?: ContactParams): Promise<void>
  /** An empty list unsubscribes from every product. */
  unsubscribeFromBackInStock(itemIds: string[], contact?: ContactParams): Promise<void>
}

// segments — sdk/contract/segments.md

export interface Segment {
  id: number
  /** `dynamic`, `static`, `less_often`, `rfm`, `rfm3`, `unknown`, … — an open set; `""` when the server gives none. */
  type: string
}

export interface SegmentsApi {
  add(segmentId: number, contact?: ContactParams): Promise<void>
  remove(segmentId: number, contact?: ContactParams): Promise<void>
  get(): Promise<Segment[]>
  /** The device's A/B group, `A` or `B`; read at once. */
  getAbGroup(): string
}

// notifications — sdk/contract/notifications.md

export type PushProvider = 'apns' | 'fcm' | 'hms'

export interface PushToken {
  token: string
  provider: PushProvider
}

/** What a tap opens. Open set: `web`, `product`, `category`, `carousel`, `custom`; another comes as it is. */
export type PushTargetType = 'web' | 'product' | 'category' | 'carousel' | 'custom' | (string & {})

/** The mailing's "additional data for the app" (`event`). */
export interface PushTarget {
  type: PushTargetType
  /** A link, a product's id, a category's id or the app's own link. */
  uri: string
  /** A free field of the mailing. */
  payload: Record<string, unknown>
}

/** A button of the notification. */
export interface PushAction {
  id: string
  title: string
  /** The link of the same index in `action_urls`; null when there is none. */
  url: string | null
}

/** A push of the SDK, parsed. */
export interface PushPayload {
  /** The shop the push went to. */
  shopId: string | null
  /** The message's code: the push's `id`. */
  code: string
  /** The mailing's type: `bulk`, `chain`, `transactional`, `digest`. */
  type: string
  title: string | null
  body: string | null
  /** A link to the icon. */
  icon: string | null
  /** A link to the image; several are separated with commas. */
  image: string | null
  /** The buttons; empty when there are none. */
  actions: PushAction[]
  /** What to open on a tap; null when the mailing has none. The SDK opens nothing itself. */
  target: PushTarget | null
  /** The mailing's `utm_source`. */
  source: string | null
  /** The sound file of the platform (`android_sound_file`, `ios_sound_file`). */
  sound: string | null
  /** The whole push as it came, every value as a string. */
  data: Record<string, string>
}

/**
 * The app's callbacks on pushes; all optional. A callback hears a push event the SDK saw itself — a push
 * its handlers received, drew, saw tapped or dismissed, or `PersonaClick.handlePush` — once the event was
 * accepted, once per event of a message in the process; never the app's own `track*` calls.
 */
export interface PushCallbacks {
  /** The push reached the app. */
  onDelivered?: (payload: PushPayload) => void
  /** The notification was shown. */
  onOpened?: (payload: PushPayload) => void
  /** The notification was tapped: what to open is `payload.target`. */
  onClicked?: (payload: PushPayload) => void
  /** The notification was dismissed without a tap. */
  onClosed?: (payload: PushPayload) => void
  /** The SDK's own push registration got a new token; not one the app hands over with `setPushToken`. */
  onToken?: (token: PushToken) => void
}

/** What the customer did with a message. */
/** What the customer did with a message; what the answer does not say is `false`, on both platforms. */
export interface NotificationStatistics {
  opened: boolean
  clicked: boolean
  hardBounced: boolean
  softBounced: boolean
  complained: boolean
  unsubscribed: boolean
  purchased: boolean
}

/** A message of the history, the same fields on Android and iOS; an empty text is `null`. */
export interface NotificationMessage {
  type: string | null
  code: string | null
  date: string | null
  sentAt: string | null
  subject: string | null
  body: string | null
  url: string | null
  icon: string | null
  picture: string | null
  /** `email`, `mobile_push`, `web_push`, `sms`, … */
  channel: string | null
  /** The mailing's id; `null` when the answer has none. */
  campaignId: number | null
  statistics: NotificationStatistics | null
}

/** The answer of `getHistory`: the server's `status` and the messages. */
export interface NotificationHistory {
  status: string | null
  messages: NotificationMessage[]
}

export interface NotificationHistoryParams {
  phone?: string
  email?: string
  externalId?: string
  loyaltyId?: string
  channel?: string
  limit?: number
  page?: number
  /** `YYYY-MM-DD`. */
  dateFrom?: string
  did?: string
}

export interface NotificationsApi {
  /**
   * A push arrived. Through the native SDK's queue, once per message; resolves once the queue took it.
   * The other push events go the same way.
   */
  trackDelivered(code: string, type: string): Promise<void>
  /** A notification was shown. */
  trackOpened(code: string, type: string): Promise<void>
  /** A notification was tapped; its mailing becomes the tracking source for 48 hours. */
  trackClicked(code: string, type: string): Promise<void>
  /** A notification was dismissed. */
  trackClosed(code: string, type: string): Promise<void>
  /**
   * The token the SDK knows for the shop — the one registered in this run, else the one the native SDK
   * keeps from an earlier start — of `provider`, or without it the one sent last; read at once.
   */
  getPushToken(provider?: PushProvider): PushToken | null
  /** The shop's push callbacks: they win over `PersonaClick.setPushCallbacks`, one by one. A new call replaces them; `{}` removes them. */
  setCallbacks(callbacks: PushCallbacks): void
  /** Registers a token the app got itself: `apns` or `fcm` on iOS, `fcm` or `hms` on Android; another is `invalidArgument`. */
  setPushToken(token: string, provider: PushProvider): Promise<void>
  /** The customer's notifications. A server method with the shop's secret key — see `cart.clear`. */
  getHistory(shopSecret: string, type: string, params?: NotificationHistoryParams): Promise<NotificationHistory>
}

// stories — sdk/contract/stories.md

export type StorySlideType = 'image' | 'video' | 'product'

/** A product of a stories block; a text it has none of is `""`. */
export interface StoryProduct {
  id: string
  name: string
  brand: string
  /** The resized image: the one to show. */
  picture: string
  imageUrl: string
  price: number
  priceFormatted: string
  /** Null when it is not above `price`. */
  oldPrice: number | null
  oldPriceFormatted: string
  /** 0 when the shop did not load it into its catalog. */
  discountPercent: number
  promocode: string
  /** 0 when the server sent none. */
  priceWithPromocode: number
  priceWithPromocodeFormatted: string
  currency: string
  url: string
  deeplinkAndroid: string
  deeplinkIos: string
}

export interface StoryButtonElement {
  type: 'button'
  title: string
  link: string
  linkAndroid: string
  linkIos: string
  background: string
  color: string
  textBold: boolean
}

export interface StoryProductElement {
  type: 'product'
  title: string
  item: StoryProduct | null
}

export interface StoryProductsElement {
  type: 'products'
  showLabel: string
  hideLabel: string
  products: StoryProduct[]
}

export interface StoryTextBlockElement {
  type: 'textBlock'
  text: string
  /** 14 when not set. */
  fontSize: number
  /** `serif`, `sans-serif`, `monospace`; `""` when not set. */
  fontType: string
  bold: boolean
  italic: boolean
  /** `left`, `center`, `right`; `""` when not set. */
  textAlign: string
  /** `#RRGGBB`; `""` when not set. */
  textColor: string
  /** `#RRGGBB`; `""` when not set. */
  backgroundColor: string
  /** 0 to 1. */
  backgroundOpacity: number
  /** A multiple of the font size; 0 — the font's own. */
  lineSpacing: number
  /** The top of the block, in percent of the slide's height. */
  yOffset: number
  /** A code the block copies on a tap. */
  promocode: string | null
}

export type StoryElement = StoryButtonElement | StoryProductElement | StoryProductsElement | StoryTextBlockElement

export interface StorySlide {
  /** A number for a slide with media, `{storyId}_{n}` for a product slide. */
  id: string
  type: StorySlideType
  background: string
  /** `#RRGGBB`; `""` when not set. */
  backgroundColor: string
  /** A video's poster; `""` when there is none. */
  preview: string
  /** Seconds; 10 when not set. */
  duration: number
  elements: StoryElement[]
}

export interface Story {
  id: string
  name: string
  avatar: string
  viewed: boolean
  pinned: boolean
  /** The first slide not viewed. */
  startPosition: number
  slides: StorySlide[]
}

export interface StoriesBlock {
  id: string
  stories: Story[]
}

export interface StoriesApi {
  get(code: string): Promise<StoriesBlock>
}

// predict — sdk/contract/predict.md

export interface PurchaseProbability {
  probability: number
  /** The customer the server found, a number as a string; null for a visitor the shop does not know. */
  clientId: string | null
}

export interface PredictApi {
  getProbabilityToPurchase(): Promise<PurchaseProbability>
}

// loyalty — sdk/contract/loyalty.md

export interface LoyaltyMember {
  /** The member's phone, digits only. */
  identifier: string
}

export interface LoyaltyLevel {
  code: string
  name: string | null
  expirationDate: string | null
}

export interface LoyaltyStatus {
  isMember: boolean
  level: LoyaltyLevel | null
}

export type LoyaltyRewardType = 'discount' | 'bonusesEarn' | 'bonusesUsage'

export interface LoyaltyPromotion {
  id: number
  name: string
  description: string | null
  startDate: string | null
  finishDate: string | null
  stream: string | null
  badgeLabel: string | null
  badgeColor: string | null
  rewardType: LoyaltyRewardType | null
}

export interface LoyaltyJoinParams {
  firstName?: string
  lastName?: string
  gender?: Gender
  /** `YYYY-MM-DD`. */
  birthday?: string
}

export interface LoyaltyPromotionsParams {
  locationId?: string
  promoCodes?: string[]
  chargeBonuses?: boolean
  /** The local time at the point of sale, `HH:MM`, for promotions by the hour. */
  currentTime?: string
}

export interface LoyaltyApi {
  join(phone: string, params?: LoyaltyJoinParams): Promise<LoyaltyMember>
  getStatus(phone: string): Promise<LoyaltyStatus>
  getPromotions(params?: LoyaltyPromotionsParams): Promise<LoyaltyPromotion[]>
}

// sliders — sdk/contract/sliders.md

export interface SliderBanner {
  /** For `tracking.bannerView` and `bannerClick`. */
  id: string
  /** The slider's code, the same for all its banners. */
  code: string
  imageUrl: string | null
  url: string | null
  deeplinkIos: string | null
  deeplinkAndroid: string | null
  html: string | null
}

export interface Slider {
  code: string
  width: number
  height: number
  banners: SliderBanner[]
}

export interface SlidersApi {
  get(code: string, tags?: string[], locationId?: string): Promise<Slider>
}

// reviews — sdk/contract/reviews.md

export interface PollReview {
  id: number
}

export interface PollReviewParams {
  orderId?: string
  comment?: string
  label?: string
}

export interface NpsCategory {
  code: string
  name: string
  detractorQuestion: string | null
  passiveQuestion: string | null
  promoterQuestion: string | null
  detractorSuccess: string | null
  passiveSuccess: string | null
  promoterSuccess: string | null
  buttonLabel: string | null
}

export interface CsatCampaign {
  code: string
  name: string
  dissatisfiedQuestion: string | null
  neutralQuestion: string | null
  satisfiedQuestion: string | null
  dissatisfiedSuccess: string | null
  neutralSuccess: string | null
  satisfiedSuccess: string | null
  buttonLabel: string | null
}

export interface CesCampaign {
  code: string
  name: string
  difficultQuestion: string | null
  neutralQuestion: string | null
  easyQuestion: string | null
  difficultSuccess: string | null
  neutralSuccess: string | null
  easySuccess: string | null
  buttonLabel: string | null
}

export interface PollChannel {
  code: string
  name: string
}

export interface ProductRatingSummary {
  count: number
  /** Null when there are no reviews. */
  averageRating: number | null
  /** Rating (`"1"` … `"5"`) → how many reviews gave it. */
  ratings: Record<string, number>
}

export interface ProductReview {
  id: number
  rating: number
  comment: string | null
  author: string | null
  createdAt: string
}

export interface ProductReviewsResponse {
  summary: ProductRatingSummary
  reviews: ProductReview[]
}

export type ReviewState = 'moderation' | 'published' | 'rejected'

export interface ClientReview {
  id: number
  itemId: string
  orderId: string
  rating: number
  comment: string | null
  state: ReviewState | null
  createdAt: string
}

export interface ReviewsApi {
  createNps(rate: number, channel: string, category: string, params?: PollReviewParams): Promise<PollReview>
  createCsat(rate: number, channel: string, campaign: string, params?: PollReviewParams): Promise<PollReview>
  createCes(rate: number, channel: string, campaign: string, params?: PollReviewParams): Promise<PollReview>
  getNpsCategories(): Promise<NpsCategory[]>
  getNpsChannels(): Promise<PollChannel[]>
  getCsatCampaigns(): Promise<CsatCampaign[]>
  getCesCampaigns(): Promise<CesCampaign[]>
  getProductReviews(itemId: string, limit?: number, offset?: number): Promise<ProductReviewsResponse>
  getClientReviews(orderId: string): Promise<ClientReview[]>
}
