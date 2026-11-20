// The released (deprecated) methods as an app calls them, for the parity test with 4.0.26
// (`legacyParity.test.js`): each scenario calls methods of an initialized instance; `answer` is what the
// mocked server sends for a request (with keys outside the SDK's models, on purpose). The fixture
// `fixtures/legacy-4.0.26.json` holds what 4.0.26 sent and returned for the same scenarios: it was recorded
// by running this file against `@personaClick/react-native-sdk@4.0.26` (commit e9dcf456) with the same axios mock.
// Only the API both versions have is used here.

/** What the server answers, by path. Every answer carries a key no model of the SDK knows (`x_extra`). */
function answer(config) {
  const path = config.url.replace(/^https:\/\/[^/]+\//, '').split('?')[0]
  const product = {
    id: '37', name: 'Shoes', price: 990, price_full: 1100, discount: 15, oldprice: 1100, url: 'https://shop/37',
    picture: 'https://shop/37.jpg', brand: 'Nike', categories: [{ id: '5', name: 'Shoes' }], x_extra: 'kept',
  }
  switch (path) {
    case 'init':
      return { did: 'server-did', seance: 'server-sid', x_extra: 'kept' }
    case 'products/get':
      return product
    case 'products':
      return { products: [product], products_total: 1, brands: [{ name: 'Nike' }], x_extra: 'kept' }
    case 'products/cart':
      return { status: 'success', data: { items: [{ uniqid: '37', quantity: 2, x_extra: 'kept' }] }, x_extra: 'kept' }
    case 'products/counters':
      return { views: 3, carts: 1, purchases: 0, x_extra: 'kept' }
    case 'category/5':
      return { products: [product], products_total: 1, categories: [{ id: '5', name: 'Shoes', parent: null }], x_extra: 'kept' }
    case 'collection/12':
      return { products: [product], x_extra: 'kept' }
    case 'recommend/block-1':
      return { recommends: ['37'], title: 'For you', products: [product], x_extra: 'kept' }
    case 'search':
      return { products: [product], products_total: 1, categories: [], filters: {}, x_extra: 'kept' }
    case 'search/blank':
      return { suggests: [{ name: 'boots' }], products: [product], last_queries: [{ name: 'hat' }], x_extra: 'kept' }
    case 'profile':
      return { email: 'jane@example.com', first_name: 'Jane', gender: 'f', birthday: '1990-05-31', x_extra: 'kept' }
    case 'orders/last_for_user':
      return { products: [product], x_extra: 'kept' }
    case 'orders/by_user':
      return { status: 'success', payload: { orders: [{ id: 'o1', value: { total: 10 }, items: [] }] }, x_extra: 'kept' }
    case 'loyalty/members/join':
      return { status: 'success', member: { phone: '+70000000000' }, x_extra: 'kept' }
    case 'loyalty/members/status':
      return { status: 'success', member: true, level: { name: 'Gold' }, x_extra: 'kept' }
    case 'nps/channels':
      return [{ id: 1, code: 'app', name: 'App', x_extra: 'kept' }]
    case 'nps/categories':
      return [{ id: 2, code: 'order', name: 'Order', x_extra: 'kept' }]
    case 'segments/add':
    case 'segments/remove':
      return { status: 'success', x_extra: 'kept' }
    case 'segments/get':
      return { segments: [{ id: 3, type: 'static' }], x_extra: 'kept' }
    case 'stories/block-s':
      return { id: 'block-s', stories: [{ id: 1, slides: [{ id: 10, background_color: '#fff', duration: '7', elements: [{ text_input: 'a', text_color: '#000' }] }] }], x_extra: 'kept' }
    default:
      return { status: 'success', x_extra: 'kept' }
  }
}

/** A failure of the server: `status` HTTP code with the server's body. */
function httpFailure(config, status) {
  const error = new Error(`Request failed with status code ${status}`)
  error.isAxiosError = true
  error.config = { url: config.url, method: config.method }
  error.response = { status, data: { status: 'error', message: 'boom' } }
  return error
}

function networkFailure(config) {
  const error = new Error('Network Error')
  error.isAxiosError = true
  error.code = 'ERR_NETWORK'
  error.config = { url: config.url, method: config.method }
  return error
}

/**
 * name → { call(sdk), fail?: (config) => Error | null }. `fail` answers some requests with an error instead.
 */
const scenarios = {
  getProductInfo: { call: (sdk) => sdk.getProductInfo('37') },
  getProductsList: {
    call: (sdk) => sdk.getProductsList({ brands: 'Nike', categories: '5', limit: 2, page: 1, filters: { Size: ['42'] }, custom_param: 'x' }),
  },
  getCategory: { call: (sdk) => sdk.getCategory('5', { limit: 2, page: 1, brands: ['Nike', 'Puma'], sort_by: 'price', extra_param: 'y' }) },
  getCollection: { call: (sdk) => sdk.getCollection('12', { location: 'msk', email: 'jane@example.com' }) },
  getProductCounters: { call: (sdk) => sdk.getProductCounters('37') },
  getLastOrderProducts: { call: (sdk) => sdk.getLastOrderProducts({ email: 'jane@example.com' }) },
  getUserOrders: { call: (sdk) => sdk.getUserOrders({ shop_secret: 'test-secret', email: 'jane@example.com' }) },
  cart: { call: (sdk) => sdk.cart() },
  getProductsFromCart: { call: (sdk) => sdk.getProductsFromCart() },
  recommend: { call: (sdk) => sdk.recommend('block-1', { item: '37', extended: 1, limit: 4, custom_param: 'z' }) },
  searchFull: { call: (sdk) => sdk.search({ type: 'full_search', search_query: 'boots', limit: 2, page: 1, unknown_param: 1 }) },
  searchInstant: { call: (sdk) => sdk.search({ type: 'instant_search', search_query: 'bo', locations: 'msk' }) },
  searchBlank: { call: (sdk) => sdk.searchBlank() },
  getProfile: { call: (sdk) => sdk.getProfile() },
  setProfile: {
    call: (sdk) => sdk.setProfile({ email: 'jane@example.com', first_name: 'Jane', birthday: '1990-05-31', custom_key: 'v' }),
  },
  segmentsAdd: { call: (sdk) => sdk.segments('add', { segment_id: 3, email: 'jane@example.com' }) },
  segmentsRemove: { call: (sdk) => sdk.segments('remove', { segment_id: 3, phone: '+70000000000' }) },
  segmentsGet: { call: (sdk) => sdk.segments('get', {}) },
  triggersPriceDrop: { call: (sdk) => sdk.triggers('subscribe_for_product_price', { item: '37', price: 100, email: 'jane@example.com' }) },
  subscriptionsManage: { call: (sdk) => sdk.subscriptions('manage', { email: 'jane@example.com', email_bulk: true }) },
  loyaltyJoin: { call: (sdk) => sdk.loyaltyJoin({ phone: '+70000000000', first_name: 'Jane' }) },
  getLoyaltyStatus: { call: (sdk) => sdk.getLoyaltyStatus('+70000000000') },
  review: { call: (sdk) => sdk.review(9, 'app', 'order', 'o1', 'Fast') },
  getNpsChannels: { call: (sdk) => sdk.getNpsChannels() },
  getNpsCategories: { call: (sdk) => sdk.getNpsCategories() },
  getStories: { call: (sdk) => sdk.getStories('block-s') },
  getProductInfoHttpError: {
    call: (sdk) => sdk.getProductInfo('37'),
    fail: (config) => (config.url.includes('products/get') ? httpFailure(config, 500) : null),
  },
  recommendNetworkError: {
    call: (sdk) => sdk.recommend('block-1', { item: '37' }),
    fail: (config) => (config.url.includes('recommend/') ? networkFailure(config) : null),
  },
  searchHttpError: {
    call: (sdk) => sdk.search({ type: 'full_search', search_query: 'boots' }),
    fail: (config) => (config.url.includes('/search') ? httpFailure(config, 400) : null),
  },
  segmentsAddHttpError: {
    call: (sdk) => sdk.segments('add', { segment_id: 3, email: 'jane@example.com' }),
    fail: (config) => (config.url.includes('segments/') ? httpFailure(config, 400) : null),
  },
}

/** A value as the fixture keeps it: an Error by its name, message and what the server answered. */
function serialize(value) {
  if (value instanceof Error) {
    return {
      error: true,
      name: value.name,
      message: value.message,
      status: value.response?.status ?? null,
      data: value.response?.data ?? null,
      code: value.code ?? null,
    }
  }
  return value === undefined ? '<undefined>' : JSON.parse(JSON.stringify(value))
}

/** A request as the fixture keeps it, the identity of the device (did, sid, seance) by placeholders. */
function requestOf(config) {
  const strip = (fields) => {
    if (fields == null || typeof fields !== 'object') return fields ?? null
    const copy = { ...fields }
    for (const key of ['did', 'sid', 'seance']) if (key in copy) copy[key] = `<${key}>`
    return copy
  }
  return {
    url: config.url.replace(/^https:\/\/[^/]+\//, '/'),
    method: (config.method || 'GET').toUpperCase(),
    params: strip(config.params),
    data: strip(config.data),
    contentType: config.headers?.['Content-Type'] ?? null,
  }
}

module.exports = { answer, scenarios, serialize, requestOf }
