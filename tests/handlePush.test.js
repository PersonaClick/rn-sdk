import {
  initialize,
  registerShops,
  handlePush,
  reset,
  setSdkFactory,
  setPushTracker,
} from '../lib/facade/facade.js'
import { PushEvent } from '../lib/push/PushEvent.js'
import registry from '../lib/registry/SdkRegistry.js'

// Push routing behind PersonaClick.handlePush (Release 4). Fake SDKs (registered via the factory) capture
// which track method was called, so routing-to-the-right-shop and the drop rules are pinned without
// dispatching a real push. Mirror of Android/iOS handlePush routing tests.

function fakeFactory(config) {
  const sdk = {
    shop_id: config.shopId,
    notificationDelivered: jest.fn(),
    notificationOpened: jest.fn(),
    notificationClicked: jest.fn(),
  }
  registry.register(config.shopId, sdk)
  return sdk
}

beforeEach(() => {
  reset()
  registry.reset()
  setSdkFactory(fakeFactory)
  setPushTracker(null)
})

const push = (shop, id = '10', type = 'web') => ({ data: { shop_id: shop, id, type } })

describe('handlePush — routing by shop_id', () => {
  test('tracks the event on the shop named by the payload', () => {
    const a = initialize({ shopId: 'shop-a' })
    const b = initialize({ shopId: 'shop-b' })

    handlePush(push('shop-b'), PushEvent.CLICKED)

    expect(b.notificationClicked).toHaveBeenCalledWith({ code: '10', type: 'web' })
    expect(a.notificationClicked).not.toHaveBeenCalled()
  })

  test('each PushEvent maps to its track method', () => {
    const a = initialize({ shopId: 'shop-a' })

    handlePush(push('shop-a'), PushEvent.DELIVERED)
    handlePush(push('shop-a'), PushEvent.OPENED)
    handlePush(push('shop-a'), PushEvent.CLICKED)

    expect(a.notificationDelivered).toHaveBeenCalledTimes(1)
    expect(a.notificationOpened).toHaveBeenCalledTimes(1)
    expect(a.notificationClicked).toHaveBeenCalledTimes(1)
  })

  test('a shop_id naming no live instance drops the push', () => {
    const a = initialize({ shopId: 'shop-a' })

    handlePush(push('shop-x'), PushEvent.CLICKED)

    expect(a.notificationClicked).not.toHaveBeenCalled()
  })
})

describe('handlePush — single-instance fallback and ambiguity', () => {
  test('no shop_id with a single live instance still tracks (fallback)', () => {
    const a = initialize({ shopId: 'shop-a' })

    handlePush({ data: { id: '10', type: 'web' } }, PushEvent.DELIVERED)

    expect(a.notificationDelivered).toHaveBeenCalledWith({ code: '10', type: 'web' })
  })

  test('no shop_id while several shops are live drops the push (not to the wrong shop)', () => {
    const a = initialize({ shopId: 'shop-a' })
    const b = initialize({ shopId: 'shop-b' })

    handlePush({ data: { id: '10', type: 'web' } }, PushEvent.CLICKED)

    expect(a.notificationClicked).not.toHaveBeenCalled()
    expect(b.notificationClicked).not.toHaveBeenCalled()
  })
})

describe('handlePush — unknown event', () => {
  test('an unknown event warns and tracks nothing', () => {
    const a = initialize({ shopId: 'shop-a' })
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    handlePush(push('shop-a'), 'nonsense')

    expect(warn).toHaveBeenCalled()
    expect(a.notificationDelivered).not.toHaveBeenCalled()
    expect(a.notificationClicked).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('handlePush — a pending shop is tracked without init', () => {
  test('a registered-but-not-initialized shop is tracked via the standalone tracker, not constructed', () => {
    const tracker = jest.fn()
    setPushTracker(tracker)
    registerShops([{ shopId: 'shop-lazy', stream: 'android' }]) // pending — NOT built

    handlePush(push('shop-lazy'), PushEvent.DELIVERED)

    // Tracked on the persisted identity, no SDK instance built (the fake factory registers on build).
    expect(tracker).toHaveBeenCalledWith('shop-lazy', PushEvent.DELIVERED, {
      code: '10',
      type: 'web',
      stream: 'android',
    })
    expect(registry.byShopId('shop-lazy')).toBeFalsy()
  })

  test('a live shop is tracked on its instance, not through the standalone tracker', () => {
    const tracker = jest.fn()
    setPushTracker(tracker)
    const a = initialize({ shopId: 'shop-a' }) // live

    handlePush(push('shop-a'), PushEvent.DELIVERED)

    expect(a.notificationDelivered).toHaveBeenCalledWith({ code: '10', type: 'web' })
    expect(tracker).not.toHaveBeenCalled()
  })

  test('a push for an unknown (unregistered) shop is dropped — no standalone track', () => {
    const tracker = jest.fn()
    setPushTracker(tracker)
    registerShops([{ shopId: 'shop-lazy', stream: 'android' }])

    handlePush(push('shop-x'), PushEvent.DELIVERED)

    expect(tracker).not.toHaveBeenCalled()
  })
})
