import registry from '../lib/registry/SdkRegistry.js'

// Process-wide registry (Release 1). Plain sentinel objects stand in for SDK instances — the
// registry only stores and routes by identity, it never calls SDK methods. Mirror of Android
// SdkRegistryTest. The registry is a singleton, so reset() before each test.

const sdk = (name) => ({ name })

beforeEach(() => registry.reset())

describe('SdkRegistry.register / resolution', () => {
  test('a registered instance is reachable by its shopId and becomes current', () => {
    const a = sdk('a')
    registry.register('shop-a', a)

    expect(registry.byShopId('shop-a')).toBe(a)
    expect(registry.current()).toBe(a)
    expect(registry.shopIds()).toEqual(new Set(['shop-a']))
    expect(registry.count()).toBe(1)
  })

  test('byShopId returns null for an unknown shop', () => {
    registry.register('shop-a', sdk('a'))
    expect(registry.byShopId('shop-b')).toBeNull()
  })

  test('the most recently registered shop becomes current; all() keeps every instance', () => {
    const a = sdk('a')
    const b = sdk('b')
    registry.register('shop-a', a)
    registry.register('shop-b', b)

    expect(registry.current()).toBe(b)
    expect(registry.all()).toEqual([a, b])
    expect(registry.count()).toBe(2)
    expect(registry.shopIds()).toEqual(new Set(['shop-a', 'shop-b']))
  })

  test('registering the same instance twice keeps a single entry', () => {
    const a = sdk('a')
    registry.register('shop-a', a)
    registry.register('shop-a', a)

    expect(registry.all()).toEqual([a])
    expect(registry.count()).toBe(1)
  })

  test('re-registering a shop with a new instance is last-writer-wins and evicts the old one', () => {
    const first = sdk('first')
    const second = sdk('second')
    registry.register('shop-a', first)
    registry.register('shop-a', second)

    expect(registry.byShopId('shop-a')).toBe(second)
    expect(registry.all()).toEqual([second]) // superseded instance dropped from fan-out
    expect(registry.count()).toBe(1)
  })

  test('ignores an empty/invalid shopId or null instance', () => {
    registry.register('', sdk('a'))
    registry.register(null, sdk('b'))
    registry.register('shop-a', null)

    expect(registry.count()).toBe(0)
    expect(registry.current()).toBeNull()
  })
})

describe('SdkRegistry.onNextRegister', () => {
  test('fires immediately when the shop is already live', () => {
    const a = sdk('a')
    registry.register('shop-a', a)

    const onReady = jest.fn()
    registry.onNextRegister('shop-a', onReady)

    expect(onReady).toHaveBeenCalledWith(a)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  test('fires on the next matching registration', () => {
    const onReady = jest.fn()
    registry.onNextRegister('shop-a', onReady)
    expect(onReady).not.toHaveBeenCalled()

    const other = sdk('other')
    registry.register('shop-b', other)
    expect(onReady).not.toHaveBeenCalled() // different shop

    const a = sdk('a')
    registry.register('shop-a', a)
    expect(onReady).toHaveBeenCalledWith(a)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  test('a null shopId awaiter fires on the first registration of any shop', () => {
    const onReady = jest.fn()
    registry.onNextRegister(null, onReady)

    const a = sdk('a')
    registry.register('shop-a', a)
    expect(onReady).toHaveBeenCalledWith(a)
  })

  test('a null shopId awaiter fires immediately when a current default already exists', () => {
    const a = sdk('a')
    registry.register('shop-a', a)

    const onReady = jest.fn()
    registry.onNextRegister(null, onReady)
    expect(onReady).toHaveBeenCalledWith(a)
  })

  test('the awaiter fires only once, not on every later registration', () => {
    const onReady = jest.fn()
    registry.onNextRegister('shop-a', onReady)
    registry.register('shop-a', sdk('a1'))
    registry.register('shop-a', sdk('a2'))

    expect(onReady).toHaveBeenCalledTimes(1)
  })

  test('the returned cancel removes a pending awaiter', () => {
    const onReady = jest.fn()
    const cancel = registry.onNextRegister('shop-a', onReady)
    cancel()

    registry.register('shop-a', sdk('a'))
    expect(onReady).not.toHaveBeenCalled()
  })
})

describe('SdkRegistry.unregister / reset', () => {
  test('unregister drops the instance from the fan-out set and the shop mapping', () => {
    const a = sdk('a')
    const b = sdk('b')
    registry.register('shop-a', a)
    registry.register('shop-b', b)

    registry.unregister(a)

    expect(registry.byShopId('shop-a')).toBeNull()
    expect(registry.all()).toEqual([b])
    expect(registry.shopIds()).toEqual(new Set(['shop-b']))
  })

  test('reset clears everything', () => {
    registry.register('shop-a', sdk('a'))
    registry.reset()

    expect(registry.count()).toBe(0)
    expect(registry.current()).toBeNull()
    expect(registry.shopIds()).toEqual(new Set())
  })
})
