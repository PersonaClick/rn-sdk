import listResponse from './fixtures/popups-v3/list-response.json'
import scenarios from './fixtures/popups-v3/scenarios.json'
import popupResponse from './fixtures/popups-v3/popup-response.json'
import promoFixture from './fixtures/popups-v3/element-promo-code.json'
import { createPopupsV3Engine } from '../lib/popupsV3/engine'
import { createMemoryShowStore, createPopupFrequency } from '../lib/popupsV3/frequency'
import { parsePopupV3, popupSlot } from '../lib/popupsV3/design'
import { popupTexts } from '../lib/popupsV3/texts'

// Попапы v3: движок по сценариям общей фикстуры scenarios.json — триггеры, экраны, фон, частота,
// пауза, тестовый режим, слоты, промокод, смена контекста. Часы, хранилище, сеть и показ — подменные.

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const base = Object.fromEntries(listResponse.payload.popups.map((popup) => [popup.id, popup]))

/** Попап сценария: id из списка или `{ from, ...поля }`. */
const popupOf = (spec) => {
  if (typeof spec === 'number') return base[spec]
  const { from, ...rest } = spec
  const popup = { ...base[from], ...rest }
  if (typeof rest.design === 'string') popup.design = promoFixture.design
  return popup
}

const scenario = (name) => {
  const found = scenarios.scenarios.find((item) => item.name === name)
  if (!found) throw new Error(`no scenario ${name}`)
  return found
}

/** Движок с подменными сетью, хранилищем, показом и часами. */
function harness({ popups = [], flag = true, sid = 'SID1', store = createMemoryShowStore(), promo = null } = {}) {
  const state = { popups, flag, sid, promo, listReply: null, productHandler: null, linkHandler: null }
  const shown = []
  const events = []
  const links = []
  const open = new Map()
  const presenter = {
    canPresent(popup) {
      const slot = popupSlot(popup)
      if (open.has(`shop:${popup.key}`)) return { ok: false, reason: 'already open' }
      if (Array.from(open.values()).some((entry) => popupSlot(entry.popup) === slot)) return { ok: false, reason: `${slot} is taken` }
      return { ok: true }
    },
    present(entry) {
      open.set(entry.id, entry)
      shown.push(entry.popup.id)
      entry.onShown()
      return true
    },
    dismiss(id) {
      open.delete(id)
    },
  }
  const api = {
    list: jest.fn(async () => state.listReply || { ok: true, ttl: 300, popups: state.popups, excluded: [] }),
    one: jest.fn(async (id) => (String(id) === '516' ? popupResponse.payload.popup : null)),
    event: jest.fn(async (id, event, channel) => {
      events.push(channel ? [id, event, channel] : [id, event])
      return true
    }),
  }
  const fetchPromoCode = jest.fn(async () => state.promo)
  const engine = createPopupsV3Engine({
    owner: 'shop',
    sdk: {},
    api,
    store,
    presenter,
    identitySid: () => state.sid,
    flag: () => state.flag,
    initialized: () => true,
    fetchPromoCode,
    // Как контроллер: ссылка уходит хуку хоста; `true` — он обработал её сам.
    openLink: (url) => {
      links.push(url)
      return state.linkHandler ? state.linkHandler(url) : false
    },
    openProduct: (product) => (state.productHandler ? state.productHandler(product) : false),
    texts: popupTexts('ru'),
  })
  const closeAll = () => Array.from(open.values()).forEach((entry) => entry.close())
  const close = (id) => open.get(`shop:${id}`).close()
  return { engine, api, shown, events, links, open, state, store, closeAll, close, fetchPromoCode }
}

/** Включает движок и ждёт загрузки списка. */
async function start(h) {
  h.engine.enabled = true
  await jest.advanceTimersByTimeAsync(0)
}

const tick = (ms = 0) => jest.advanceTimersByTimeAsync(ms)

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-11-03T10:00:00Z'))
})
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('Popups v3 engine — gates', () => {
  test('without enabled not a single request, with it — the list', async () => {
    const h = harness({ popups: [base[512]] })
    h.engine.screenOpened('home')
    h.engine.onInit()
    await tick(1000)
    expect(h.api.list).not.toHaveBeenCalled()
    await start(h)
    expect(h.api.list).toHaveBeenCalledTimes(1)
    expect(h.shown).toEqual([512])
  })

  test('no popups_v3 flag in /init — silent until ignoreInitFlag', async () => {
    const h = harness({ popups: [base[512]], flag: false })
    await start(h)
    expect(h.api.list).not.toHaveBeenCalled()
    h.engine.ignoreInitFlag = true
    await tick()
    expect(h.api.list).toHaveBeenCalledTimes(1)
    expect(h.shown).toEqual([512])
  })

  test('a 4xx list is cached as empty for 300 s, a 5xx is not cached', async () => {
    const h = harness({ popups: [] })
    h.state.listReply = { ok: false, cacheable: true }
    await start(h)
    h.engine.onAppState('background')
    h.engine.onAppState('active')
    await tick()
    expect(h.api.list).toHaveBeenCalledTimes(1)
    await tick(301 * 1000)
    h.engine.onAppState('background')
    h.engine.onAppState('active')
    await tick()
    expect(h.api.list).toHaveBeenCalledTimes(2)

    const g = harness({ popups: [] })
    g.state.listReply = { ok: false, cacheable: false }
    await start(g)
    g.engine.onAppState('background')
    g.engine.onAppState('active')
    await tick()
    expect(g.api.list).toHaveBeenCalledTimes(2)
  })
})

describe('Popups v3 engine — a product of the recommendations', () => {
  const product = { id: '42', name: 'Product', price: '10', url: 'https://shop.test/42', deeplink: 'shop://product/42' }

  test('the host opened it: click, the popup closes without close, no link', async () => {
    const h = harness({ popups: [base[512]] })
    const handled = []
    h.state.productHandler = (item) => {
      handled.push(item.id)
      return true
    }
    await start(h)
    h.open.get('shop:512').openProduct(product)
    await tick()
    expect(handled).toEqual(['42'])
    expect(h.events).toEqual([
      [512, 'show'],
      [512, 'click'],
    ])
    expect(h.open.size).toBe(0)
    expect(h.links).toEqual([])
  })

  test('no hook or false: click and the product link (deeplink, then url), the popup stays', async () => {
    const h = harness({ popups: [base[512]] })
    await start(h)
    const entry = h.open.get('shop:512')
    entry.openProduct(product)
    h.state.productHandler = () => false
    entry.openProduct({ ...product, deeplink: '  ' })
    entry.openProduct({ ...product, deeplink: null, url: 'javascript:alert(1)' })
    await tick()
    expect(h.links).toEqual(['shop://product/42', 'https://shop.test/42'])
    expect(h.events).toEqual([
      [512, 'show'],
      [512, 'click'],
      [512, 'click'],
      [512, 'click'],
    ])
    expect(h.open.has('shop:512')).toBe(true)
  })
})

describe('Popups v3 engine — a link of the popup', () => {
  test('the host handled it: the popup closes without close, after the click', async () => {
    const h = harness({ popups: [base[512]] })
    const seen = []
    h.state.linkHandler = (url) => {
      seen.push([url, h.open.has('shop:512')])
      return true
    }
    await start(h)
    const entry = h.open.get('shop:512')
    entry.event('click')
    entry.openLink('personaClick://game')
    await tick()
    // Хук зовётся, пока попап открыт; закрытие — сразу после его ответа.
    expect(seen).toEqual([['personaClick://game', true]])
    expect(h.open.size).toBe(0)
    expect(h.events).toEqual([
      [512, 'show'],
      [512, 'click'],
    ])
  })

  test('not handled (false, or anything but true): the system opened it, the popup stays', async () => {
    const h = harness({ popups: [base[512]] })
    await start(h)
    const entry = h.open.get('shop:512')
    entry.openLink('https://demo.personaClick.ru/')
    h.state.linkHandler = () => false
    entry.openLink('https://demo.personaClick.ru/')
    h.state.linkHandler = () => 'yes'
    entry.openLink('https://demo.personaClick.ru/')
    await tick()
    expect(h.links).toHaveLength(3)
    expect(h.open.has('shop:512')).toBe(true)
    expect(h.events).toEqual([[512, 'show']])
  })

  test("a product's link the link hook handled closes the popup too", async () => {
    const h = harness({ popups: [base[512]] })
    h.state.linkHandler = () => true
    await start(h)
    h.open.get('shop:512').openProduct({ id: '42', url: 'https://shop.test/42', deeplink: 'shop://product/42' })
    await tick()
    expect(h.links).toEqual(['shop://product/42'])
    expect(h.open.size).toBe(0)
    expect(h.events).toEqual([
      [512, 'show'],
      [512, 'click'],
    ])
  })
})

describe('Popups v3 engine — scenarios.json', () => {
  test(scenario('app_start без экранов').name, async () => {
    const h = harness({ popups: [popupOf(scenario('app_start без экранов').popup)] })
    await start(h)
    expect(h.shown).toEqual([512])
    expect(h.events).toEqual([[512, 'show']])
  })

  test(scenario('app_start ждёт подходящий экран').name, async () => {
    const h = harness({ popups: [popupOf(scenario('app_start ждёт подходящий экран').popup)] })
    await start(h)
    expect(h.shown).toEqual([])
    h.engine.screenOpened('home')
    await tick()
    expect(h.shown).toEqual([])
    h.engine.screenOpened('product')
    await tick()
    expect(h.shown).toEqual([512])
  })

  test(scenario('screen_open по списку экранов').name, async () => {
    const h = harness({ popups: [popupOf(513)] })
    await start(h)
    h.engine.screenOpened('home')
    await tick()
    expect(h.shown).toEqual([])
    h.engine.screenOpened('product')
    await tick()
    expect(h.shown).toEqual([513])
  })

  test(scenario('screen_open с пустым списком').name, async () => {
    const h = harness({ popups: [popupOf(scenario('screen_open с пустым списком').popup)] })
    await start(h)
    h.engine.screenOpened('home')
    await tick()
    expect(h.shown).toEqual([513])
  })

  test('screen_open on a screen opened before the list arrived', async () => {
    const h = harness({ popups: [popupOf(513)] })
    h.engine.screenOpened('cart')
    await start(h)
    expect(h.shown).toEqual([513])
  })

  test(scenario('time_on_screen ушёл раньше').name, async () => {
    const h = harness({ popups: [popupOf(514)] })
    await start(h)
    h.engine.screenOpened('home')
    await tick(9000)
    h.engine.screenOpened('category')
    await tick(11000)
    expect(h.shown).toEqual([])
  })

  test(scenario('time_on_screen досидел').name, async () => {
    const h = harness({ popups: [popupOf(514)] })
    await start(h)
    h.engine.screenOpened('home')
    await tick(9999)
    expect(h.shown).toEqual([])
    await tick(1)
    expect(h.shown).toEqual([514])
  })

  test(scenario('time_on_screen и фон').name, async () => {
    const h = harness({ popups: [popupOf(514)] })
    await start(h)
    h.engine.screenOpened('home')
    await tick(5000)
    h.engine.onAppState('background')
    await tick(25000)
    h.engine.onAppState('active')
    await tick(9000)
    expect(h.shown).toEqual([])
    await tick(1000)
    expect(h.shown).toEqual([514])
  })

  test(scenario('track_event').name, async () => {
    const h = harness({ popups: [popupOf(515)] })
    await start(h)
    h.engine.onTrackEvent('other')
    await tick()
    expect(h.shown).toEqual([])
    h.engine.onTrackEvent('promo_view')
    await tick()
    expect(h.shown).toEqual([515])
  })

  test(scenario('track_event не на том экране').name, async () => {
    const h = harness({ popups: [popupOf(scenario('track_event не на том экране').popup)] })
    await start(h)
    h.engine.screenOpened('home')
    h.engine.onTrackEvent('promo_view')
    await tick()
    h.engine.screenOpened('cart')
    await tick()
    expect(h.shown).toEqual([])
  })

  test(scenario('manual').name, async () => {
    const h = harness({ popups: Object.values(base) })
    await start(h)
    h.closeAll()
    h.shown.length = 0
    h.engine.screenOpened('home')
    await tick()
    h.closeAll()
    h.shown.length = 0
    await expect(h.engine.show(516)).resolves.toBe(true)
    expect(h.api.one).toHaveBeenCalledWith(516)
    expect(h.shown).toEqual([516])
    expect(h.store.dump()['516']).toBeUndefined()
    expect(h.events).toContainEqual([516, 'show'])
  })

  test(scenario('once_session').name, async () => {
    const store = createMemoryShowStore()
    const first = harness({ popups: [popupOf(512)], store, sid: 'SID1' })
    await start(first)
    first.closeAll()
    expect(first.shown).toEqual([512])
    expect(first.events).toEqual([
      [512, 'show'],
      [512, 'close'],
    ])
    const sameSession = harness({ popups: [popupOf(512)], store, sid: 'SID1' })
    await start(sameSession)
    expect(sameSession.shown).toEqual([])
    const newSession = harness({ popups: [popupOf(512)], store, sid: 'SID2' })
    await start(newSession)
    expect(newSession.shown).toEqual([512])
  })

  test(scenario('once_day и пауза 60 минут').name, async () => {
    const h = harness({ popups: [popupOf(513)] })
    await start(h)
    h.engine.screenOpened('product')
    await tick()
    h.closeAll()
    await tick(30 * MINUTE)
    h.engine.screenOpened('product')
    await tick(23 * HOUR - 30 * MINUTE)
    h.engine.screenOpened('product')
    await tick(HOUR)
    h.engine.screenOpened('product')
    await tick()
    expect(h.shown).toEqual([513, 513])
  })

  test(scenario('every_page — раз на экран').name, async () => {
    const h = harness({ popups: [popupOf(scenario('every_page — раз на экран').popup)] })
    h.engine.screenOpened('home')
    await start(h)
    expect(h.shown).toEqual([512])
    h.closeAll()
    // «Ещё раз на home»: список перезапросили, но на этой «странице» попап уже был.
    h.engine.onContextChange('profile', 'set', { email: 'a@b.c' })
    await tick(2000)
    expect(h.api.list).toHaveBeenCalledTimes(2)
    expect(h.shown).toEqual([512])
    h.engine.screenOpened('product')
    await tick()
    expect(h.shown).toEqual([512, 512])
  })

  test(scenario('testmode не пишет частоту').name, async () => {
    const store = createMemoryShowStore()
    const first = harness({ popups: [popupOf(scenario('testmode не пишет частоту').popup)], store })
    first.engine.testMode = true
    await start(first)
    expect(first.shown).toEqual([512])
    expect(store.dump()).toEqual({})
    const again = harness({ popups: [popupOf(scenario('testmode не пишет частоту').popup)], store })
    again.engine.testMode = true
    await start(again)
    expect(again.shown).toEqual([512])
  })

  test(scenario('одна модалка').name, async () => {
    const h = harness({ popups: scenario('одна модалка').popups.map(popupOf) })
    await start(h)
    h.engine.screenOpened('product')
    await tick()
    expect(h.shown).toEqual([513])
    expect(h.engine.state().queue).toEqual(['613'])
    h.close(513)
    await tick()
    expect(h.shown).toEqual([513, 613])
  })

  test(scenario('баннер не ждёт модалку').name, async () => {
    const h = harness({ popups: scenario('баннер не ждёт модалку').popups.map(popupOf) })
    await start(h)
    expect(h.shown.sort()).toEqual([512, 514])
    expect(h.open.size).toBe(2)
  })

  test(scenario('нет промокода').name, async () => {
    const h = harness({ popups: [popupOf(scenario('нет промокода').popup)], promo: null })
    await start(h)
    expect(h.fetchPromoCode).toHaveBeenCalledWith(7)
    expect(h.shown).toEqual([])
    expect(h.events).toEqual([])
  })

  test('a promo code is fetched before the show and becomes promo_code', async () => {
    const h = harness({ popups: [popupOf({ from: 519, design: 'element-promo-code.json' })], promo: 'ABC123' })
    await start(h)
    expect(h.shown).toEqual([519])
    expect(Array.from(h.open.values())[0].runtime).toEqual({ promo_code: 'ABC123' })
  })

  test('519 without {{promo_code}} in the design does not ask for a code', async () => {
    const h = harness({ popups: [popupOf(519)] })
    await start(h)
    expect(h.fetchPromoCode).not.toHaveBeenCalled()
    expect(h.shown).toEqual([519])
  })

  test(scenario('смена контекста').name, async () => {
    const h = harness({ popups: [] })
    await start(h)
    expect(h.api.list).toHaveBeenCalledTimes(1)
    h.engine.onContextChange('profile', 'set', { email: 'a@b.c' })
    await tick(1999)
    expect(h.api.list).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(h.api.list).toHaveBeenCalledTimes(2)
    h.engine.onContextChange('profile', 'set', { email: 'a@b.c' })
    await tick(3000)
    expect(h.api.list).toHaveBeenCalledTimes(2)
    h.engine.onPurchase()
    await tick(2000)
    expect(h.api.list).toHaveBeenCalledTimes(3)
  })
})

describe('Popups v3 frequency', () => {
  const popup = (frequency, cooldownMinutes = 0) => ({ key: '1', frequency, cooldownMinutes })

  test('a popup shown on this screen is not shown on it again, a new screen is a new page', () => {
    const frequency = createPopupFrequency({ store: createMemoryShowStore(), testMode: () => false, sid: () => 's' })
    frequency.record(popup('every_page'))
    expect(frequency.canShow(popup('every_page'))).toEqual({ ok: false, reason: 'already shown on this screen' })
    frequency.newPage()
    expect(frequency.canShow(popup('every_page')).ok).toBe(true)
  })

  test('once_life, once_week, once_month, cooldown before frequency', () => {
    let time = 0
    const store = createMemoryShowStore()
    const frequency = createPopupFrequency({ store, testMode: () => false, sid: () => 's', now: () => time })
    frequency.record(popup('once_life'))
    frequency.newPage()
    time = 400 * 24 * HOUR
    expect(frequency.canShow(popup('once_life')).ok).toBe(false)
    store.write('1', { last: 0 })
    time = 6 * 24 * HOUR
    expect(frequency.canShow(popup('once_week')).ok).toBe(false)
    time = 7 * 24 * HOUR
    expect(frequency.canShow(popup('once_week')).ok).toBe(true)
    expect(frequency.canShow(popup('once_month')).ok).toBe(false)
    time = 10 * MINUTE
    expect(frequency.canShow(popup('every_page', 15))).toEqual({ ok: false, reason: 'cooldown 15 min' })
  })

  test('the list of the fixture parses the same way the engine sees it', () => {
    const parsed = listResponse.payload.popups.map(parsePopupV3).filter((item) => item.popup)
    expect(parsed.length).toBe(6)
  })
})
