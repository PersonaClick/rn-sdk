import axios from 'axios'
import { Linking } from 'react-native'
import PersonaClick from '../index.js'
import live from './fixtures/popups-v3/live-list-181-182.json'
import { PersonalizationPopups } from '../internal/v3'
import { popupsV3Entries, resetPopupsV3Presenter } from '../lib/popupsV3/presenter'
import { isSdkPopupVisible, showPopup } from '../components/Popup/SdkPopupOverlay'

// Попапы v3 через настоящий инстанс SDK: шлюз включения, флаг /init, testmode в /init, хуки
// кастомных событий и смены контекста, показ слоем и общий со старыми попапами слот модалки.
// Подменены только axios и наличие смонтированного <SdkPopupOverlay>.

jest.mock('axios', () => jest.fn())
jest.mock('../components/Popup/overlayLayers', () => {
  const layers = new Map()
  return {
    registerOverlayLayer: (key, component) => layers.set(key, component),
    hasOverlayHost: () => true,
    OverlayLayers: () => null,
    __layers: layers,
  }
})

const APP = 'https://app.personaClick.ru/api/v3/storefront/popups'

function backend({ flag = true, popups = live.payload.popups } = {}) {
  axios.mockImplementation((config) => {
    const url = String(config.url)
    if (url.endsWith('/init')) return Promise.resolve({ status: 200, data: { did: 'did-1', seance: 'sid-1', ...(flag ? { popups_v3: true } : {}) } })
    if (url === APP) return Promise.resolve({ status: 200, data: { status: 'success', payload: { ttl: 300, popups, excluded: [] } } })
    if (url.startsWith(`${APP}/`)) return Promise.resolve({ status: 200, data: { status: 'success' } })
    return Promise.resolve({ status: 200, data: { status: 'success' } })
  })
}

const calls = (predicate) => axios.mock.calls.map((call) => call[0]).filter(predicate)
const flush = async () => {
  for (let i = 0; i < 30; i++) await jest.advanceTimersByTimeAsync(0)
}

let shopSeq = 0
const newSdk = () => new PersonaClick(`shop-popups-${++shopSeq}`, 'android', false, false)

beforeEach(() => {
  jest.useFakeTimers()
  axios.mockReset()
  resetPopupsV3Presenter()
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('Popups v3 — through the SDK', () => {
  test('asleep without enabled: /init only, no popups requests', async () => {
    backend()
    newSdk()
    await flush()
    expect(calls((config) => String(config.url).startsWith(APP))).toHaveLength(0)
  })

  test('enabled + popups_v3 flag: the list, live 181 (banner) and 182 (modal) shown together, show / close events', async () => {
    backend()
    const sdk = newSdk()
    const popups = PersonalizationPopups.of(sdk)
    expect(PersonalizationPopups.of(sdk)).toBe(popups)
    popups.enabled = true
    popups.screenOpened('home')
    await flush()
    const [list] = calls((config) => config.url === APP)
    expect(list.method).toBe('GET')
    expect(list.params).toEqual({ shop_id: sdk.shop_id, did: 'did-1', sid: 'sid-1', channel: 'mobile' })
    expect(list.withCredentials).toBe(false)
    expect(require('../components/Popup/overlayLayers').__layers.has('popupsV3')).toBe(true)

    const entries = popupsV3Entries()
    expect(entries.map((entry) => [entry.popup.id, entry.slot])).toEqual([
      [181, 'banner-top'],
      [182, 'modal'],
    ])
    entries.forEach((entry) => entry.onShown())
    await flush()
    const events = () => calls((config) => /\/events$/.test(String(config.url))).map((config) => [config.url, config.data.event])
    expect(events()).toEqual([
      [`${APP}/181/events`, 'show'],
      [`${APP}/182/events`, 'show'],
    ])
    expect(calls((config) => /\/events$/.test(String(config.url)))[0].data).toEqual({ shop_id: sdk.shop_id, did: 'did-1', sid: 'sid-1', event: 'show' })

    entries[1].close()
    await flush()
    expect(popupsV3Entries().map((entry) => entry.popup.id)).toEqual([181])
    expect(events()[2]).toEqual([`${APP}/182/events`, 'close'])

    // Та же сессия: на следующем экране once_session не показывает снова.
    popups.screenOpened('product')
    await flush()
    expect(popupsV3Entries().map((entry) => entry.popup.id)).toEqual([181])
  })

  test('without the flag — silent; ignoreInitFlag turns it on', async () => {
    backend({ flag: false })
    const sdk = newSdk()
    const popups = PersonalizationPopups.of(sdk)
    popups.enabled = true
    await flush()
    expect(calls((config) => config.url === APP)).toHaveLength(0)
    popups.ignoreInitFlag = true
    await flush()
    expect(calls((config) => config.url === APP)).toHaveLength(1)
  })

  test('test mode goes to /init and to the list', async () => {
    backend()
    const sdk = newSdk()
    const popups = PersonalizationPopups.of(sdk)
    popups.testMode = true
    popups.debug = true
    popups.enabled = true
    await flush()
    const [init] = calls((config) => String(config.url).endsWith('/init'))
    expect(init.params).toMatchObject({ testmode: 'true' })
    const [list] = calls((config) => config.url === APP)
    expect(list.params).toMatchObject({ testmode: 'true', debug: '1' })
  })

  test('hooks: a custom event fires track_event popups, profile set refetches the list in 2 s once', async () => {
    const trackEventPopup = { ...live.payload.popups[1], id: 777, trigger_type: 'track_event', trigger_event: 'promo_view' }
    backend({ popups: [trackEventPopup] })
    const sdk = newSdk()
    const popups = PersonalizationPopups.of(sdk)
    popups.enabled = true
    await flush()
    expect(popupsV3Entries()).toHaveLength(0)
    sdk.trackEvent('promo_view')
    await flush()
    expect(popupsV3Entries().map((entry) => entry.popup.id)).toEqual([777])

    sdk.setProfile({ email: 'demo+rn@personaClick.test' })
    sdk.setProfile({ email: 'demo+rn@personaClick.test' })
    await jest.advanceTimersByTimeAsync(2000)
    await flush()
    expect(calls((config) => config.url === APP)).toHaveLength(2)
  })

  test('manual show by id works without the flag', async () => {
    backend({ flag: false })
    axios.mockImplementation((config) => {
      const url = String(config.url)
      if (url.endsWith('/init')) return Promise.resolve({ status: 200, data: { did: 'did-1', seance: 'sid-1' } })
      if (url === `${APP}/182`) return Promise.resolve({ status: 200, data: { status: 'success', payload: { popup: live.payload.popups[1] } } })
      return Promise.resolve({ status: 200, data: { status: 'success' } })
    })
    const sdk = newSdk()
    const popups = PersonalizationPopups.of(sdk)
    popups.enabled = true
    const shown = popups.show(182)
    await flush()
    await expect(shown).resolves.toBe(true)
    expect(calls((config) => config.url === `${APP}/182`)[0].params).toEqual({ shop_id: sdk.shop_id, did: 'did-1', sid: 'sid-1' })
    expect(popupsV3Entries().map((entry) => entry.popup.id)).toEqual([182])
  })

  test('enableAutoPopupPresentation off: the popups of triggers are silent, no show events', async () => {
    backend()
    const sdk = newSdk()
    sdk.enableAutoPopupPresentation = false
    const popups = PersonalizationPopups.of(sdk)
    popups.enabled = true
    popups.screenOpened('home')
    await flush()
    expect(calls((config) => config.url === APP)).toHaveLength(1)
    expect(popupsV3Entries()).toEqual([])
    expect(calls((config) => String(config.url).endsWith('/events'))).toHaveLength(0)
  })

  test('onProductClick: true closes 182 without close; a throwing hook counts as false — the product link', async () => {
    backend({ popups: [live.payload.popups[1]] })
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const sdk = newSdk()
    const popups = PersonalizationPopups.of(sdk)
    popups.enabled = true
    await flush()
    const product = { id: '7', name: 'Product', price: '10', url: 'https://shop.test/7', deeplink: '' }
    const events = () => calls((config) => /\/events$/.test(String(config.url))).map((config) => config.data.event)

    expect(popups.onProductClick).toBeNull()
    popups.onProductClick = () => {
      throw new Error('boom')
    }
    popupsV3Entries()[0].openProduct(product)
    await flush()
    expect(openURL).toHaveBeenCalledWith('https://shop.test/7')
    expect(popupsV3Entries().map((entry) => entry.popup.id)).toEqual([182])
    expect(console.log).toHaveBeenCalledWith('[Popups v3] product handler failed: boom')

    const opened = []
    popups.onProductClick = (item) => {
      opened.push(item.id)
      return true
    }
    popupsV3Entries()[0].openProduct(product)
    await flush()
    expect(opened).toEqual(['7'])
    expect(openURL).toHaveBeenCalledTimes(1)
    expect(popupsV3Entries()).toHaveLength(0)
    expect(events()).toEqual(['click', 'click'])

    popups.onProductClick = 'not a function'
    expect(popups.onProductClick).toBeNull()
  })

  test('onLink: true closes 182 without close; false, a throwing hook or none — the system, the popup stays', async () => {
    backend({ popups: [live.payload.popups[1]] })
    // Linking.openURL в jest — общий мок: вызовы прошлых тестов не в счёт.
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    openURL.mockClear()
    const sdk = newSdk()
    const popups = PersonalizationPopups.of(sdk)
    popups.enabled = true
    await flush()
    const events = () => calls((config) => /\/events$/.test(String(config.url))).map((config) => config.data.event)
    // Как нажатие на кнопку-ссылку: click, затем ссылка.
    const press = (url) => {
      const [entry] = popupsV3Entries()
      entry.event('click')
      entry.openLink(url)
    }

    expect(popups.onLink).toBeNull()
    press('https://demo.personaClick.ru/')
    popups.onLink = () => false
    press('personaClick://game')
    popups.onLink = () => {
      throw new Error('boom')
    }
    press('personaClick://game')
    await flush()
    expect(openURL.mock.calls).toEqual([['https://demo.personaClick.ru/'], ['personaClick://game'], ['personaClick://game']])
    expect(console.log).toHaveBeenCalledWith('[Popups v3] link handler failed: boom')
    expect(popupsV3Entries().map((entry) => entry.popup.id)).toEqual([182])

    const handled = []
    popups.onLink = (url) => {
      handled.push([url, popupsV3Entries().length])
      return true
    }
    press('personaClick://game')
    // Попап закрыт сразу после ответа хука — раньше, чем хост успеет что-то показать поверх.
    expect(popupsV3Entries()).toHaveLength(0)
    await flush()
    expect(handled).toEqual([['personaClick://game', 1]])
    expect(openURL).toHaveBeenCalledTimes(3)
    expect(events()).toEqual(['click', 'click', 'click', 'click'])

    popups.onLink = 'not a function'
    expect(popups.onLink).toBeNull()
  })

  // Последним: старый попап остаётся на экране в синглтоне оверлея до конца файла.
  test('one modal slot with the old in-app popups: the old one waits for the v3 modal', async () => {
    backend({ popups: [live.payload.popups[1]] })
    const sdk = newSdk()
    const popups = PersonalizationPopups.of(sdk)
    popups.enabled = true
    await flush()
    expect(popupsV3Entries()).toHaveLength(1)
    showPopup({ id: 1, html: '<p>old</p>' }, sdk)
    expect(isSdkPopupVisible()).toBe(false)
    popupsV3Entries()[0].close()
    expect(isSdkPopupVisible()).toBe(true)
  })
})
