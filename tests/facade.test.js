import {
  initialize,
  registerShops,
  getInstance,
  isInitialized,
  awaitInstance,
  reset,
  pendingShopIds,
  setSdkFactory,
} from '../lib/facade/facade.js'
import { UnknownShopIdError, AmbiguousShopError } from '../lib/facade/errors.js'
import registry from '../lib/registry/SdkRegistry.js'

// Facade resolution behind the public PersonaClick.* API (Release 3). The fake factory mimics what the
// real MainSDK constructor does — it self-registers in the registry — so the facade can be tested
// without constructing a real SDK (no firebase/notifee). Mirror of Android PersonaClickTest.

const built = []
function fakeFactory(config) {
  const sdk = { shop_id: config.shopId, config }
  registry.register(config.shopId, sdk) // the real SDK registers itself in its constructor
  built.push(sdk)
  return sdk
}

beforeEach(() => {
  reset()
  registry.reset()
  built.length = 0
  setSdkFactory(fakeFactory)
})

describe('facade.initialize / getInstance', () => {
  test('initialize returns an instance reachable via getInstance', () => {
    const a = initialize({ shopId: 'shop-a' })

    expect(getInstance()).toBe(a)
    expect(getInstance('shop-a')).toBe(a)
    expect(isInitialized()).toBe(true)
    expect(isInitialized('shop-a')).toBe(true)
  })

  test('initialize requires a string shopId', () => {
    expect(() => initialize({})).toThrow(/shopId is required/)
    expect(() => initialize({ shopId: '' })).toThrow(/shopId is required/)
  })

  test('two shops make the default getInstance ambiguous', () => {
    const a = initialize({ shopId: 'shop-a' })
    initialize({ shopId: 'shop-b' })

    expect(() => getInstance()).toThrow(AmbiguousShopError)
    expect(getInstance('shop-a')).toBe(a)
  })

  test('getInstance for an unknown shop throws UnknownShopIdError', () => {
    initialize({ shopId: 'shop-a' })
    expect(() => getInstance('nope')).toThrow(UnknownShopIdError)
  })

  test('getInstance with nothing registered throws UnknownShopIdError', () => {
    expect(() => getInstance()).toThrow(UnknownShopIdError)
  })

  test('re-initialize builds a new instance (last-writer-wins)', () => {
    const first = initialize({ shopId: 'shop-a' })
    const second = initialize({ shopId: 'shop-a' })

    expect(second).not.toBe(first)
    expect(getInstance('shop-a')).toBe(second)
    expect(registry.count()).toBe(1)
  })
})

describe('facade.registerShops (lazy)', () => {
  test('registerShops does not initialize until first getInstance', () => {
    registerShops([{ shopId: 'shop-a' }, { shopId: 'shop-b' }])

    expect(pendingShopIds()).toEqual(new Set(['shop-a', 'shop-b']))
    expect(built).toHaveLength(0)
    expect(isInitialized('shop-a')).toBe(false)

    const a = getInstance('shop-a') // materializes on first use
    expect(a.shop_id).toBe('shop-a')
    expect(built).toHaveLength(1)
    expect(pendingShopIds()).toEqual(new Set(['shop-b'])) // a consumed, b still pending
    expect(isInitialized('shop-a')).toBe(true)
  })

  test('one live + one pending (different shops) is ambiguous by default', () => {
    initialize({ shopId: 'shop-a' })
    registerShops([{ shopId: 'shop-b' }])

    expect(() => getInstance()).toThrow(AmbiguousShopError)
  })

  test('eagerInit initializes every shop up front', () => {
    registerShops([{ shopId: 'shop-a' }, { shopId: 'shop-b' }], { eagerInit: true })

    expect(built).toHaveLength(2)
    expect(pendingShopIds()).toEqual(new Set())
    expect(registry.shopIds()).toEqual(new Set(['shop-a', 'shop-b']))
  })
})

describe('facade.awaitInstance', () => {
  test('fires immediately for a live shop', () => {
    const a = initialize({ shopId: 'shop-a' })
    const onReady = jest.fn()
    const cancel = awaitInstance('shop-a', onReady)

    expect(onReady).toHaveBeenCalledWith(a)
    expect(typeof cancel).toBe('function')
  })

  test('materializes a pending shop and fires', () => {
    registerShops([{ shopId: 'shop-a' }])
    const onReady = jest.fn()
    awaitInstance('shop-a', onReady)

    expect(built).toHaveLength(1)
    expect(onReady).toHaveBeenCalledWith(built[0])
    expect(pendingShopIds()).toEqual(new Set())
  })

  test('defers until the shop registers, and cancel unsubscribes', () => {
    const onReady = jest.fn()
    const cancel = awaitInstance('shop-a', onReady)
    expect(onReady).not.toHaveBeenCalled()

    const a = initialize({ shopId: 'shop-a' })
    expect(onReady).toHaveBeenCalledWith(a)

    // A second waiter that is cancelled must not fire on a later re-register.
    const onReady2 = jest.fn()
    const cancel2 = awaitInstance('shop-b', onReady2)
    cancel2()
    initialize({ shopId: 'shop-b' })
    expect(onReady2).not.toHaveBeenCalled()

    cancel() // idempotent no-op for an already-fired immediate waiter
  })

  test('an ambiguous default warns and does not resolve', () => {
    initialize({ shopId: 'shop-a' })
    initialize({ shopId: 'shop-b' })
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const onReady = jest.fn()

    awaitInstance(null, onReady)

    expect(onReady).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  test('requires an onReady callback', () => {
    expect(() => awaitInstance('shop-a')).toThrow(/onReady callback is required/)
  })
})

describe('facade — factory guard', () => {
  test('initialize without a factory throws a clear error', () => {
    setSdkFactory(null)
    expect(() => initialize({ shopId: 'shop-a' })).toThrow(/factory is not set/)
  })
})
