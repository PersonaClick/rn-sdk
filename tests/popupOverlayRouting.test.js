import { SdkPopupOverlaySingleton } from '../components/Popup/SdkPopupOverlay.js'
import PopupLogic, { POPUP_POSITION_FULLSCREEN } from '../lib/popup.js'

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

// The popup UI lays out the positions it knows; anything else comes out fullscreen, as on Android
// (it used to fall back to fixed_bottom).
describe('Popup — position routing', () => {
  test.each(['centered', 'fixed_bottom', 'top', 'slide_right', 'slide_left'])(
    'known position %s keeps its layout',
    (position) => {
      expect(PopupLogic.resolvePosition(position)).toBe(position)
    },
  )

  test.each([
    ['a missing', undefined],
    ['a null', null],
    ['an empty', ''],
    ['an unknown', 'full_screen'],
    ['a differently cased', 'Centered'],
  ])('%s position comes out fullscreen', (_, position) => {
    expect(PopupLogic.resolvePosition(position)).toBe(POPUP_POSITION_FULLSCREEN)
  })

  test('the overlay hands a popup without a position to the UI as it came', () => {
    const overlay = new SdkPopupOverlaySingleton()
    const noPosition = popup(1)

    overlay.showPopup(noPosition, sdk('shop-a'))

    expect(overlay.getState().currentPopup).toBe(noPosition)
    expect(PopupLogic.resolvePosition(overlay.getState().currentPopup.position)).toBe(POPUP_POSITION_FULLSCREEN)
  })
})
