import { resolve, ResolutionType } from '../lib/registry/InstanceResolver.js'

// Pure resolution logic behind PersonaClick.getInstance (Release 3). No SDK constructed — every branch of
// "which instance / which error" is pinned here. Mirror of Android InstanceResolverTest.

describe('InstanceResolver.resolve — explicit shopId', () => {
  test('a live shopId resolves to Existing', () => {
    expect(resolve('shop-a', new Set(['shop-a', 'shop-b']), new Set())).toEqual({
      type: ResolutionType.EXISTING,
      shopId: 'shop-a',
    })
  })

  test('a pending (registered-not-live) shopId resolves to Pending', () => {
    expect(resolve('shop-b', new Set(['shop-a']), new Set(['shop-b']))).toEqual({
      type: ResolutionType.PENDING,
      shopId: 'shop-b',
    })
  })

  test('live takes precedence over pending for the same shopId', () => {
    expect(resolve('shop-a', new Set(['shop-a']), new Set(['shop-a']))).toEqual({
      type: ResolutionType.EXISTING,
      shopId: 'shop-a',
    })
  })

  test('an unknown shopId resolves to NotRegistered', () => {
    expect(resolve('nope', new Set(['shop-a']), new Set(['shop-b']))).toEqual({
      type: ResolutionType.NOT_REGISTERED,
    })
  })
})

describe('InstanceResolver.resolve — no shopId (default)', () => {
  test('nothing registered resolves to NotRegistered', () => {
    expect(resolve(null, new Set(), new Set())).toEqual({ type: ResolutionType.NOT_REGISTERED })
  })

  test('exactly one live shop resolves to Existing', () => {
    expect(resolve(null, new Set(['shop-a']), new Set())).toEqual({
      type: ResolutionType.EXISTING,
      shopId: 'shop-a',
    })
  })

  test('exactly one pending shop resolves to Pending', () => {
    expect(resolve(null, new Set(), new Set(['shop-a']))).toEqual({
      type: ResolutionType.PENDING,
      shopId: 'shop-a',
    })
  })

  test('one live + one pending (different shops) is Ambiguous', () => {
    expect(resolve(null, new Set(['shop-a']), new Set(['shop-b']))).toEqual({
      type: ResolutionType.AMBIGUOUS,
    })
  })

  test('one shop that is both live and pending is not ambiguous — resolves Existing', () => {
    expect(resolve(null, new Set(['shop-a']), new Set(['shop-a']))).toEqual({
      type: ResolutionType.EXISTING,
      shopId: 'shop-a',
    })
  })

  test('several live shops is Ambiguous', () => {
    expect(resolve(null, new Set(['shop-a', 'shop-b']), new Set())).toEqual({
      type: ResolutionType.AMBIGUOUS,
    })
  })

  test('undefined shopId behaves like null (default)', () => {
    expect(resolve(undefined, new Set(['shop-a']), new Set())).toEqual({
      type: ResolutionType.EXISTING,
      shopId: 'shop-a',
    })
  })
})

describe('InstanceResolver.resolve — accepts plain iterables', () => {
  test('arrays are accepted in place of Sets', () => {
    expect(resolve('shop-a', ['shop-a'], [])).toEqual({
      type: ResolutionType.EXISTING,
      shopId: 'shop-a',
    })
  })
})
