import { Platform } from 'react-native'
import { createRequestCache } from '../components/widgets/requestCache'
import { LOAD_STATUS } from '../components/widgets/loadState'
import {
  createRecommenderLoader,
  peekRecommenderState,
  recommenderCacheKey,
  recommenderProductTouched,
  recommenderSource,
  recommenderView,
} from '../components/widgets/recommenderSupport'
import { parseCollection } from '../types/catalogTypes'
import recommendExtended from './fixtures/recommend_extended.json'
import category from './fixtures/category.json'

// The data-bound recommender block without UI: source, request, cache, what is shown, tracking.

const CODE = 'e6249bb15043644bf25b135006149962'
const SHOP = 'c1140c8254976de297c3caf971701a'
const [discounted, regular] = recommendExtended.recommends

// Like MainSDK: recommend() resolves with whatever request() gave, an error included;
// getCollection() resolves with the parsed collection.
function fakeSdk({ recommend = () => recommendExtended, collection = () => ({ products: category.products }) } = {}) {
  return {
    shop_id: SHOP,
    recommend: jest.fn((code, options) => Promise.resolve(recommend(code, options))),
    getCollection: jest.fn((id) => Promise.resolve(parseCollection(collection(id)))),
    trackSource: jest.fn(),
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

function setup({ cache = createRequestCache(), view = {} } = {}) {
  const events = []
  const loader = createRecommenderLoader({
    cache,
    viewOptions: () => view,
    onChange: (state) => events.push(state.status),
    onLoaded: (count) => events.push(`loaded ${count}`),
    onError: (error) => events.push(`error ${error.message}`),
  })
  return { cache, loader, events }
}

describe('Recommender block — source and request', () => {
  test('a code asks recommend() extended, with item, category and locations only when given', async () => {
    const sdk = fakeSdk()
    const { loader } = setup()
    loader.start(sdk, recommenderSource({ code: CODE }))
    loader.start(sdk, recommenderSource({ code: CODE, itemId: 52173, categoryId: 'tv', locations: ' 1,2 ' }))
    await flush()
    expect(sdk.recommend.mock.calls).toEqual([
      [CODE, { extended: 1 }],
      [CODE, { extended: 1, item: '52173', category: 'tv', locations: '1,2' }],
    ])
    expect(sdk.getCollection).not.toHaveBeenCalled()
  })

  test('a collection id asks getCollection(), and recommend() is not called', async () => {
    const sdk = fakeSdk()
    const { loader, events } = setup()
    loader.start(sdk, recommenderSource({ collectionId: 7 }))
    await flush()
    expect(sdk.getCollection).toHaveBeenCalledWith('7')
    expect(sdk.recommend).not.toHaveBeenCalled()
    expect(events).toEqual(['loading', 'content', 'loaded 2'])
  })

  test('exactly one source: none or both is an error, and nothing is asked', () => {
    expect(recommenderSource({}).error.message).toMatch(/code or collectionId is required/)
    expect(recommenderSource({ code: ' ' }).error).toBeInstanceOf(Error)
    expect(recommenderSource({ code: CODE, collectionId: '7' }).error.message).toMatch(/not both/)
    const sdk = fakeSdk()
    const { loader, events } = setup()
    loader.start(sdk, recommenderSource({ code: CODE, collectionId: '7' }))
    expect(events).toEqual(['idle'])
    expect(sdk.recommend).not.toHaveBeenCalled()
  })

  test('the cache key follows shop, kind, code and request params', () => {
    const key = (shop, props) => recommenderCacheKey(shop, recommenderSource(props))
    expect(key(SHOP, { code: CODE, itemId: 1 })).toBe(key(SHOP, { code: CODE, itemId: '1' }))
    expect(key(SHOP, { code: CODE })).not.toBe(key(SHOP, { code: CODE, itemId: 1 }))
    expect(key(SHOP, { code: CODE, itemId: 1 })).not.toBe(key(SHOP, { code: CODE, categoryId: 1 }))
    expect(key(SHOP, { code: CODE })).not.toBe(key(SHOP, { code: CODE, locations: '1' }))
    expect(key(SHOP, { code: CODE })).not.toBe(key('other', { code: CODE }))
    expect(key(SHOP, { code: '7' })).not.toBe(key(SHOP, { collectionId: '7' }))
  })
})

describe('Recommender block — what is shown', () => {
  const answer = { title: recommendExtended.title, products: recommendExtended.recommends }

  test('the title: from the answer, the host one, or none for an empty string and a collection', () => {
    expect(recommenderView(answer).title).toBe('Популярные')
    expect(recommenderView(answer, { title: null }).title).toBe('Популярные')
    expect(recommenderView(answer, { title: 'For you' }).title).toBe('For you')
    expect(recommenderView(answer, { title: '' }).title).toBe('')
    expect(recommenderView({ title: null, products: answer.products }).title).toBe('')
    expect(recommenderView({ title: null, products: answer.products }, { title: 'Sale' }).title).toBe('Sale')
  })

  test('fewer products than minProducts, or none, hide the block', () => {
    expect(recommenderView(answer, { minProducts: 2 })).toMatchObject({ visible: true, count: 2 })
    expect(recommenderView(answer, { minProducts: 3 })).toMatchObject({ visible: false, count: 0, products: [] })
    expect(recommenderView({ title: 'x', products: [] })).toMatchObject({ visible: false, count: 0 })
    expect(recommenderView(null)).toMatchObject({ visible: false, count: 0 })
    // minProducts below one still hides an empty block.
    expect(recommenderView({ title: 'x', products: [] }, { minProducts: 0 }).visible).toBe(false)
  })

  test('limit trims on the client; minProducts counts what is shown', () => {
    expect(recommenderView(answer, { limit: 1 }).products.map((p) => p.id)).toEqual(['52173'])
    expect(recommenderView(answer, { limit: 1 }).count).toBe(1)
    expect(recommenderView(answer, { limit: 1, minProducts: 2 }).visible).toBe(false)
    expect(recommenderView(answer, { limit: 0 }).count).toBe(2)
    expect(recommenderView(answer, { limit: 10 }).count).toBe(2)
  })

  test('recommended products map to the kit product: discount, url and the platform deeplink', () => {
    const products = { title: null, products: [{ ...discounted, deeplink_ios: 'app://ios', deeplink_android: 'app://android' }, regular] }
    const [first, second] = recommenderView(products, { actionText: 'Buy', os: 'android' }).products
    expect(first).toMatchObject({
      id: '52173',
      price: '164 990 ₽',
      oldPrice: '174 990 ₽',
      discount: '-6%',
      actionText: 'Buy',
      url: discounted.url,
      deeplink: 'app://android',
    })
    expect(second).toMatchObject({ id: '300252', oldPrice: undefined, discount: undefined })
    expect(recommenderView(products, { os: 'ios' }).products[0]).toMatchObject({ deeplink: 'app://ios', actionText: undefined })
    expect(recommenderView(products).products[0].deeplink).toBe(`app://${Platform.OS}`)
  })
})

describe('Recommender block — loading', () => {
  test('loading hides the block; the answer shows it and reports the count', async () => {
    const { loader, events } = setup()
    loader.start(fakeSdk(), recommenderSource({ code: CODE }))
    expect(events).toEqual(['loading'])
    await flush()
    expect(events).toEqual(['loading', 'content', 'loaded 2'])
    expect(loader.state.data).toEqual({ title: 'Популярные', products: recommendExtended.recommends })
  })

  test('an empty answer or fewer than minProducts: hidden, onLoaded(0)', async () => {
    const empty = setup()
    empty.loader.start(fakeSdk({ recommend: () => ({ title: 'x', recommends: [] }) }), recommenderSource({ code: CODE }))
    await flush()
    expect(empty.events).toEqual(['loading', 'empty', 'loaded 0'])

    const few = setup({ view: { minProducts: 3 } })
    few.loader.start(fakeSdk(), recommenderSource({ code: CODE }))
    await flush()
    expect(few.events).toEqual(['loading', 'content', 'loaded 0'])
  })

  test.each([
    ['an Error the SDK resolved with', new Error('Network Error'), 'Network Error'],
    ['an error body', { status: 'error', message: 'Bad code' }, 'Bad code'],
    ['an HTTP error status', { status: 404 }, 'Request failed: 404'],
    ['an answer without products', { title: 'x' }, 'Unexpected response'],
  ])('%s: hidden, onError and no onLoaded', async (_, answer, message) => {
    const { loader, events } = setup()
    loader.start(fakeSdk({ recommend: () => answer }), recommenderSource({ code: CODE }))
    await flush()
    expect(events).toEqual(['loading', 'error', `error ${message}`])
    expect(loader.state.status).toBe(LOAD_STATUS.ERROR)
  })

  test('a collection error body (parsed as an empty collection) is an error too', async () => {
    const { loader, events } = setup()
    loader.start(fakeSdk({ collection: () => ({ status: 'error', message: 'No collection' }) }), recommenderSource({ collectionId: '7' }))
    await flush()
    expect(events).toEqual(['loading', 'error', 'error No collection'])
  })

  test('errors are not cached: the next block asks again', async () => {
    const cache = createRequestCache()
    let fail = true
    const sdk = fakeSdk({ recommend: () => (fail ? new Error('offline') : recommendExtended) })
    setup({ cache }).loader.start(sdk, recommenderSource({ code: CODE }))
    await flush()
    fail = false
    const second = setup({ cache })
    second.loader.start(sdk, recommenderSource({ code: CODE }))
    await flush()
    expect(sdk.recommend).toHaveBeenCalledTimes(2)
    expect(second.events).toEqual(['loading', 'content', 'loaded 2'])
  })

  test('a second block with the same params shows the cached answer at once, without a request', async () => {
    const cache = createRequestCache()
    const sdk = fakeSdk()
    const source = recommenderSource({ code: CODE, itemId: '52173' })
    setup({ cache }).loader.start(sdk, source)
    await flush()

    // What the widget draws on its first frame, before its loading effect runs.
    const key = recommenderCacheKey(SHOP, recommenderSource({ code: CODE, itemId: 52173 }))
    expect(peekRecommenderState(cache, key)).toMatchObject({ key, status: LOAD_STATUS.CONTENT })
    expect(peekRecommenderState(cache, recommenderCacheKey(SHOP, recommenderSource({ code: CODE })))).toMatchObject({
      status: LOAD_STATUS.LOADING,
    })
    expect(peekRecommenderState(cache, null).status).toBe(LOAD_STATUS.IDLE)

    const second = setup({ cache, view: { limit: 1 } })
    second.loader.start(sdk, recommenderSource({ code: CODE, itemId: 52173 }))
    // Synchronously: no Loading in between.
    expect(second.events).toEqual(['content', 'loaded 1'])
    await flush()
    expect(sdk.recommend).toHaveBeenCalledTimes(1)
  })

  test('blocks started together wait for one request', async () => {
    const cache = createRequestCache()
    const sdk = fakeSdk()
    const first = setup({ cache })
    const second = setup({ cache })
    first.loader.start(sdk, recommenderSource({ code: CODE }))
    second.loader.start(sdk, recommenderSource({ code: CODE }))
    await flush()
    expect(sdk.recommend).toHaveBeenCalledTimes(1)
    expect(second.events).toEqual(['loading', 'content', 'loaded 2'])
  })

  test('reload() goes with force past the fresh answer and keeps it on screen until the new one', async () => {
    const cache = createRequestCache()
    const subscribe = jest.spyOn(cache, 'subscribe')
    let title = 'First'
    const sdk = fakeSdk({ recommend: () => ({ ...recommendExtended, title }) })
    const { loader, events } = setup({ cache })
    loader.reload() // before any load — nothing
    expect(sdk.recommend).not.toHaveBeenCalled()
    loader.start(sdk, recommenderSource({ code: CODE }))
    await flush()
    title = 'Second'
    events.length = 0
    loader.reload()
    expect(subscribe.mock.calls.map((call) => call[2].force)).toEqual([false, true])
    expect(events).toEqual([]) // no Loading: the shown answer stays
    await flush()
    expect(sdk.recommend).toHaveBeenCalledTimes(2)
    expect(events).toEqual(['content', 'loaded 2'])
    expect(loader.state.data.title).toBe('Second')
    expect(cache.peek(recommenderCacheKey(SHOP, recommenderSource({ code: CODE }))).title).toBe('Second')
  })

  test('reload() after an error loads again', async () => {
    let answer = new Error('offline')
    const { loader, events } = setup()
    loader.start(fakeSdk({ recommend: () => answer }), recommenderSource({ code: CODE }))
    await flush()
    answer = recommendExtended
    loader.reload()
    await flush()
    expect(events).toEqual(['loading', 'error', 'error offline', 'loading', 'content', 'loaded 2'])
  })

  test('a new source loads anew; the answer of the old one and of a cancelled block are dropped', async () => {
    let release
    const slow = new Promise((resolve) => {
      release = resolve
    })
    const sdk = fakeSdk()
    sdk.recommend.mockImplementationOnce(() => slow)
    const { loader, events } = setup()
    loader.start(sdk, recommenderSource({ code: 'old' }))
    loader.start(sdk, recommenderSource({ code: CODE }))
    await flush()
    release({ title: 'Old', recommends: [regular] })
    await flush()
    expect(events).toEqual(['loading', 'loading', 'content', 'loaded 2'])
    expect(loader.state.data.title).toBe('Популярные')

    const cancelled = setup()
    cancelled.loader.start(fakeSdk(), recommenderSource({ code: CODE }))
    cancelled.loader.cancel()
    await flush()
    expect(cancelled.events).toEqual(['loading'])
  })
})

describe('Recommender block — product press and card button', () => {
  const product = { id: '52173', name: 'Fridge' }

  test('a block with a code sets the dynamic source with its code, then hands the product over', () => {
    const sdk = fakeSdk()
    const onPress = jest.fn()
    recommenderProductTouched(sdk, recommenderSource({ code: CODE }), product, onPress)
    expect(sdk.trackSource).toHaveBeenCalledWith('dynamic', CODE)
    expect(onPress).toHaveBeenCalledWith(product)
    expect(sdk.trackSource.mock.invocationCallOrder[0]).toBeLessThan(onPress.mock.invocationCallOrder[0])
  })

  test('the card button ("add to cart") sets the dynamic source too, before the host callback', () => {
    const sdk = fakeSdk()
    const onAction = jest.fn()
    recommenderProductTouched(sdk, recommenderSource({ code: CODE, itemId: '1' }), product, onAction)
    expect(sdk.trackSource).toHaveBeenCalledTimes(1)
    expect(sdk.trackSource).toHaveBeenCalledWith('dynamic', CODE)
    expect(onAction).toHaveBeenCalledWith(product)
    expect(sdk.trackSource.mock.invocationCallOrder[0]).toBeLessThan(onAction.mock.invocationCallOrder[0])
  })

  test('a collection sets no source, for a tap or the card button', () => {
    const sdk = fakeSdk()
    const onPress = jest.fn()
    const onAction = jest.fn()
    recommenderProductTouched(sdk, recommenderSource({ collectionId: '7' }), product, onPress)
    recommenderProductTouched(sdk, recommenderSource({ collectionId: '7' }), product, onAction)
    expect(sdk.trackSource).not.toHaveBeenCalled()
    expect(onPress).toHaveBeenCalledWith(product)
    expect(onAction).toHaveBeenCalledWith(product)
  })

  test('a failing trackSource does not stop the press', () => {
    const sdk = fakeSdk()
    sdk.trackSource.mockImplementation(() => {
      throw new Error('storage')
    })
    const onPress = jest.fn()
    recommenderProductTouched(sdk, recommenderSource({ code: CODE }), product, onPress)
    expect(onPress).toHaveBeenCalledWith(product)
  })
})
