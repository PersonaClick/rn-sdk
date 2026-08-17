import { SdkPopupOverlaySingleton } from '../components/Popup/SdkPopupOverlay.js'

// Release 2 (RN-6): the popup overlay renders and tracks against the SDK that triggered the popup,
// not whichever instance registered last. Exercised on a fresh singleton so the module-global one
// is untouched.

const popup = (id) => ({ id, html: `<div>${id}</div>` })
const sdk = (shopId) => ({ shop_id: shopId })

describe('SdkPopupOverlay — per-shop routing', () => {
  test('a shown popup carries its triggering sdk, not the last registered one', () => {
    const overlay = new SdkPopupOverlaySingleton()
    const shopA = sdk('shop-a')
    const shopB = sdk('shop-b')

    // shop B registered its overlay last (would win under the old last-wins behaviour)...
    overlay.registerSDK(shopA)
    overlay.registerSDK(shopB)

    // ...but shop A triggers the popup.
    overlay.showPopup(popup(1), shopA)

    expect(overlay.getState().sdk).toBe(shopA)
    expect(overlay.getState().currentPopup).toEqual(popup(1))
    expect(overlay.getState().isVisible).toBe(true)
  })

  test('a queued popup restores its own sdk when it becomes current', () => {
    jest.useFakeTimers()
    const overlay = new SdkPopupOverlaySingleton()
    const shopA = sdk('shop-a')
    const shopB = sdk('shop-b')

    overlay.showPopup(popup(1), shopA) // shown immediately, owned by A
    overlay.showPopup(popup(2), shopB) // queued, owned by B

    expect(overlay.getState().sdk).toBe(shopA)

    overlay.closePopup()
    jest.runAllTimers() // flush the close-animation delay that promotes the queued popup

    expect(overlay.getState().currentPopup).toEqual(popup(2))
    expect(overlay.getState().sdk).toBe(shopB)
    jest.useRealTimers()
  })

  test('falls back to the registered sdk when a popup is shown without an owner', () => {
    const overlay = new SdkPopupOverlaySingleton()
    const registered = sdk('shop-registered')
    overlay.registerSDK(registered)

    overlay.showPopup(popup(1)) // no explicit owner (manual/legacy path)

    expect(overlay.getState().sdk).toBe(registered)
  })

  test('no owner and nothing registered yields a null sdk (overlay renders nothing)', () => {
    const overlay = new SdkPopupOverlaySingleton()
    expect(overlay.getState().sdk).toBeNull()
  })
})
