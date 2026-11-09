import axios from 'axios'
import PersonaClick from '../index.js'
import { prepareAndShow } from '../components/Popup/SdkPopupOverlay'

// enableAutoPopupPresentation и старые попапы из ответов API: выключен — SDK их сам не показывает,
// ручной показ идёт как шёл. Попапы v3 — в popupsV3Integration.test.js.

jest.mock('axios', () => jest.fn())
jest.mock('../components/Popup/SdkPopupOverlay', () => ({
  ...jest.requireActual('../components/Popup/SdkPopupOverlay'),
  prepareAndShow: jest.fn(() => Promise.resolve()),
}))

const response = { popup: { id: 7, html: '<p>popup</p>' } }

let shopSeq = 0
const newSdk = () => {
  const sdk = new PersonaClick(`shop-auto-popups-${++shopSeq}`, 'android', false, false)
  sdk.initialized = true
  return sdk
}

beforeEach(() => {
  axios.mockReset()
  axios.mockImplementation(() => Promise.resolve({ status: 200, data: {} }))
  prepareAndShow.mockClear()
  // No /init: it would outlive the test, and these tests need none.
  jest.spyOn(PersonaClick.prototype, 'init').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('enableAutoPopupPresentation', () => {
  test('on by default: a popup of a response is shown', async () => {
    const sdk = newSdk()
    expect(sdk.enableAutoPopupPresentation).toBe(true)
    await sdk.checkAndShowPopup(response)
    expect(prepareAndShow).toHaveBeenCalledWith(sdk, response.popup, false)
  })

  test('off: a popup of a response is not shown, one shown by hand is', async () => {
    const sdk = newSdk()
    sdk.enableAutoPopupPresentation = false
    await sdk.checkAndShowPopup(response)
    expect(prepareAndShow).not.toHaveBeenCalled()
    await sdk.checkAndShowPopup(response, true)
    expect(prepareAndShow).toHaveBeenCalledWith(sdk, response.popup, true)
  })
})
