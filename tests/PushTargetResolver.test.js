import { resolve } from '../lib/registry/PushTargetResolver.js'

// Push routing rules behind PersonaClick.handlePush (Release 4). Pure logic, no dispatch — every "which
// shop does this push belong to" case is pinned here. Mirror of Android PushTargetResolverTest.

describe('PushTargetResolver.resolve', () => {
  test('a payload shop_id that names a live instance routes to it', () => {
    expect(resolve('shop-a', new Set(['shop-a', 'shop-b']))).toBe('shop-a')
  })

  test('a payload shop_id with no live instance drops the push', () => {
    expect(resolve('shop-x', new Set(['shop-a']))).toBeNull()
  })

  test('no shop_id with a single live instance routes to it', () => {
    expect(resolve(null, new Set(['shop-a']))).toBe('shop-a')
  })

  test('no shop_id with several live instances drops the push', () => {
    expect(resolve(null, new Set(['shop-a', 'shop-b']))).toBeNull()
  })

  test('no shop_id with nothing live drops the push', () => {
    expect(resolve(null, new Set())).toBeNull()
  })

  test('undefined shop_id behaves like absent', () => {
    expect(resolve(undefined, new Set(['shop-a']))).toBe('shop-a')
    expect(resolve(undefined, new Set(['shop-a', 'shop-b']))).toBeNull()
  })

  test('accepts a plain array of live shop ids', () => {
    expect(resolve('shop-a', ['shop-a'])).toBe('shop-a')
  })
})
