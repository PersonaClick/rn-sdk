import { POPUPS_V3_DEFAULT_TTL, POPUPS_V3_PROMO_TTL } from './api'
import { normalizePopupDesign, parsePopupV3, popupNeedsPromoCode, popupSafeLink } from './design'
import { createPopupFrequency } from './frequency'
import { popupStr } from './values'

/**
 * Движок попапов v3 одного инстанса SDK: включение, список и его кеш, экраны и триггеры, частота,
 * очередь слотов, промокод до показа, события. Без React и без сети напрямую — всё через `deps`,
 * поэтому его гоняют тесты по сценариям общих фикстур (`scenarios.json`).
 *
 * Включается двойным шлюзом: хост включил (`enabled`) И (`/init` прислал `popups_v3: true` ИЛИ хост
 * велел не смотреть на флаг — `ignoreInitFlag`). Без `enabled` движок не шлёт ни одного запроса.
 *
 * Триггеры mobile:
 * - `app_start` — при загрузке списка и на каждом открытии экрана в сеансе (частота решает, будет
 *   ли показ; так `once_session` показывается на первом подходящем экране, `every_page` — на
 *   каждом);
 * - `screen_open` — на `screenOpened(name)` (и при загрузке списка на уже открытом экране);
 * - `time_on_screen` — через `trigger_value` с на том же экране; смена экрана отменяет, уход в фон
 *   сбрасывает, при возврате отсчёт заново;
 * - `track_event` — кастомное событие SDK с этим именем; экран должен подходить, событие не ждёт;
 * - `manual` — только `show(id)`.
 *
 * `target_screens` пуст — любой экран.
 */

/** Задержка перезапроса списка после смены контекста, мс. */
export const POPUPS_V3_INVALIDATE_DELAY = 2000

/**
 * @param {{
 *   owner: string,
 *   sdk: object,
 *   api: { list: Function, one: Function, event: Function },
 *   store: { load: Function, read: Function, write: Function },
 *   presenter: { canPresent: Function, present: Function, dismiss: Function },
 *   identitySid: () => string,
 *   flag: () => boolean,
 *   initialized: () => boolean,
 *   whenInitialized?: () => Promise<void>,
 *   fetchPromoCode: (listId: any) => Promise<string|null>,
 *   actions?: object,
 *   openLink?: (url: string) => boolean,
 *   openProduct?: (product: object) => boolean,
 *   autoPresentationDisabled?: () => boolean,
 *   os?: string,
 *   texts?: object,
 *   log?: (message: string) => void,
 *   now?: () => number,
 * }} deps
 */
export function createPopupsV3Engine(deps) {
  const now = deps.now || (() => Date.now())
  const settings = { enabled: false, ignoreInitFlag: false, testMode: false, debug: false }
  const log = (message) => deps.log && deps.log(message, settings.debug)

  const frequency = createPopupFrequency({
    store: deps.store,
    testMode: () => settings.testMode,
    sid: () => deps.identitySid(),
    now,
  })

  let started = false
  let cache = null
  let loadSeq = 0
  let loading = false
  let popups = new Map()
  let screen = null
  let screenSeq = 0
  let screenAt = now()
  let foreground = true
  const timers = new Map()
  let queue = []
  const showing = new Set()
  const open = new Map()
  const promoCodes = new Map()
  const signatures = new Map()
  let signaturesSid = null
  let invalidateTimer = null

  const ready = () =>
    settings.enabled && deps.initialized() && (settings.ignoreInitFlag || deps.flag() === true)

  // ------------------------------------------------------------ список

  function maybeStart() {
    if (started || !ready()) {
      if (!started && settings.enabled && deps.initialized() && !settings.ignoreInitFlag && deps.flag() !== true) {
        log('/init has no popups_v3 flag: popups are off')
      }
      return
    }
    started = true
    log('started')
    Promise.resolve(deps.store.load()).then(() => load(false))
  }

  function cacheValid() {
    return (
      cache !== null &&
      cache.sid === deps.identitySid() &&
      cache.test === settings.testMode &&
      cache.expires > now()
    )
  }

  async function load(force) {
    if (!started) return
    if (!force && cacheValid()) {
      setList(cache.popups)
      return
    }
    const seq = ++loadSeq
    const sid = deps.identitySid()
    const test = settings.testMode
    loading = true
    let result
    try {
      result = await deps.api.list()
    } finally {
      if (seq === loadSeq) loading = false
    }
    if (seq !== loadSeq || !started) return
    if (result.ok) {
      cache = { sid, test, expires: now() + result.ttl * 1000, popups: result.popups }
      if (settings.debug) {
        result.excluded.forEach((item) => log(`popup ${item && item.id} excluded: ${item && item.reason}`))
      }
      setList(result.popups)
    } else if (result.cacheable) {
      cache = { sid, test, expires: now() + POPUPS_V3_DEFAULT_TTL * 1000, popups: [] }
      setList([])
    }
  }

  function setList(rawList) {
    const next = new Map()
    rawList.forEach((raw) => {
      const parsed = parsePopupV3(raw)
      if (parsed.popup) next.set(parsed.popup.key, parsed.popup)
      else log(`popup ${parsed.id === undefined ? '?' : parsed.id} skipped: ${parsed.reason}`)
    })
    popups.forEach((popup, key) => {
      if (!next.has(key)) {
        cancelTimer(key)
        queue = queue.filter((item) => item !== key)
      }
    })
    const previous = popups
    popups = next
    log(`${next.size} popup(s) loaded`)
    next.forEach((popup, key) => {
      if (!previous.has(key)) arm(popup)
    })
  }

  function invalidate() {
    if (!started) return
    if (invalidateTimer !== null) clearTimeout(invalidateTimer)
    invalidateTimer = setTimeout(() => {
      invalidateTimer = null
      log('list invalidated')
      cache = null
      load(true)
    }, POPUPS_V3_INVALIDATE_DELAY)
  }

  // ------------------------------------------------------------ триггеры

  function arm(popup) {
    switch (popup.trigger) {
      case 'app_start':
        fire(popup, 'app_start')
        break
      case 'screen_open':
        if (screen !== null) fire(popup, `screen ${screen}`)
        break
      case 'time_on_screen':
        if (screen !== null && foreground) startTimer(popup, popup.triggerValue * 1000 - (now() - screenAt))
        break
      default:
        break
    }
  }

  function cancelTimer(key) {
    const timer = timers.get(key)
    if (timer) {
      clearTimeout(timer)
      timers.delete(key)
    }
  }

  function cancelTimers() {
    timers.forEach((timer) => clearTimeout(timer))
    timers.clear()
  }

  function startTimer(popup, delay) {
    if (!matchesScreen(popup)) return
    cancelTimer(popup.key)
    const seq = screenSeq
    timers.set(
      popup.key,
      setTimeout(() => {
        timers.delete(popup.key)
        const current = popups.get(popup.key)
        if (seq === screenSeq && foreground && current) fire(current, `${current.triggerValue} s on screen`)
      }, Math.max(0, delay)),
    )
  }

  const matchesScreen = (popup) => popup.targetScreens.length === 0 || (screen !== null && popup.targetScreens.indexOf(screen) !== -1)

  function fire(popup, cause) {
    if (!matchesScreen(popup)) {
      log(`popup ${popup.id} skipped (${cause}): screen ${screen === null ? 'unknown' : screen} is not a target`)
      return
    }
    const allowed = frequency.canShow(popup)
    if (!allowed.ok) {
      log(`popup ${popup.id} skipped (${cause}): ${allowed.reason}`)
      return
    }
    show(popup, false)
  }

  // ------------------------------------------------------------ показ

  function enqueue(key) {
    if (queue.indexOf(key) === -1) queue.push(key)
  }

  function processQueue() {
    const keys = queue
    queue = []
    keys.forEach((key) => {
      const popup = popups.get(key)
      if (popup) show(popup, false)
    })
  }

  async function promoCode(listId) {
    const key = String(listId)
    const cached = promoCodes.get(key)
    if (cached && cached.expires > now()) return cached.code
    const code = await deps.fetchPromoCode(listId)
    if (code) promoCodes.set(key, { code, expires: now() + POPUPS_V3_PROMO_TTL })
    return code || null
  }

  async function show(popup, manual) {
    const key = popup.key
    if (showing.has(key) || open.has(key)) return
    if (!manual && deps.autoPresentationDisabled && deps.autoPresentationDisabled()) {
      log(`popup ${popup.id} skipped: popupPresentationDelegate is set`)
      return
    }
    if (!manual) {
      const allowed = frequency.canShow(popup)
      if (!allowed.ok) {
        log(`popup ${popup.id} skipped: ${allowed.reason}`)
        return
      }
    }
    const slot = deps.presenter.canPresent(popup)
    if (!slot.ok) {
      log(`popup ${popup.id} postponed: ${slot.reason}`)
      if (!manual) enqueue(key)
      return
    }
    showing.add(key)
    try {
      const model = normalizePopupDesign(popup.design, {
        os: deps.os,
        texts: deps.texts,
        onSkip: (entry) => log(`popup ${popup.id}: element ${entry.id || '?'} skipped: ${entry.reason}`),
      })
      if (model.empty) {
        log(`popup ${popup.id} skipped: empty design`)
        return
      }
      const runtime = {}
      if (popupNeedsPromoCode(popup)) {
        const code = await promoCode(popup.promoCodeListId)
        if (!code) {
          log(`popup ${popup.id} skipped: no promo code`)
          return
        }
        runtime.promo_code = code
      }
      // Пока ждали промокод, могла открыться другая модалка.
      const again = deps.presenter.canPresent(popup)
      if (!again.ok) {
        log(`popup ${popup.id} postponed: ${again.reason}`)
        if (!manual) enqueue(key)
        return
      }
      const handle = createHandle(popup, model, runtime)
      const presented = deps.presenter.present(handle.entry)
      if (!presented) {
        log(`popup ${popup.id} not shown: no <SdkPopupOverlay> is mounted`)
        return
      }
      open.set(key, handle.entry.id)
      if (!manual) frequency.record(popup)
      log(`popup ${popup.id} shown${manual ? ' (manual)' : ''}`)
    } catch (error) {
      log(`popup ${popup.id} failed: ${(error && error.message) || error}`)
    } finally {
      showing.delete(key)
    }
  }

  function event(popup, name, channel) {
    return Promise.resolve(deps.api.event(popup.id, name, channel)).catch(() => false)
  }

  /** Связка показанного попапа с движком: события, закрытие, ссылки, товары и действия форм. */
  function createHandle(popup, model, runtime) {
    let shown = false
    let closed = false
    // Закрытие с событием `close` или без него — после перехода, который открыл хост.
    const finish = (closeEvent) => {
      if (closed) return
      closed = true
      deps.presenter.dismiss(entry.id)
      open.delete(popup.key)
      if (closeEvent) event(popup, 'close')
      log(`popup ${popup.id} closed${closeEvent ? '' : ' after navigation'}`)
      processQueue()
    }
    const entry = {
      owner: deps.owner,
      id: `${deps.owner}:${popup.key}`,
      popup,
      model,
      runtime,
      sdk: deps.sdk,
      texts: deps.texts,
      /** Слой нарисовал попап: событие `show`. */
      onShown() {
        if (shown) return
        shown = true
        event(popup, 'show')
      },
      /** Закрытие (крестик, кнопка, затемнение, «назад», свайп): событие `close`. */
      close() {
        finish(true)
      },
      event: (name, channel) => event(popup, name, channel),
      /**
       * Ссылка попапа (кнопка, ссылка элемента, применение промокода, ссылка товара); событие
       * `click` шлёт тот, кто зовёт. Хук хоста обработал её сам — попап закрывается без `close`,
       * как после перехода; иначе ссылка ушла системе, попап остаётся.
       */
      openLink(url) {
        if (deps.openLink && deps.openLink(url) === true) finish(false)
      },
      /**
       * Нажатие на товар ленты рекомендаций: событие `click`, затем хук хоста. Хост открыл товар
       * сам — попап закрывается без `close`, как после перехода. Иначе — ссылка товара
       * (`deeplink`, пустой — `url`) обычным путём ссылок (`openLink`).
       */
      openProduct(product) {
        event(popup, 'click')
        if (product && deps.openProduct && deps.openProduct(product) === true) {
          finish(false)
          return
        }
        const deeplink = product ? popupStr(product.deeplink).trim() : ''
        const link = popupSafeLink(deeplink || (product ? popupStr(product.url) : ''))
        if (link) entry.openLink(link)
      },
      actions: deps.actions,
      contextChanged: (type, action, data) => contextChanged(type, action, data),
      log: (message) => log(`popup ${popup.id}: ${message}`),
    }
    return { entry }
  }

  // ------------------------------------------------------------ контекст

  function contextChanged(type, action, data) {
    if (!started) return
    const sid = deps.identitySid()
    if (signaturesSid !== sid) {
      signatures.clear()
      signaturesSid = sid
    }
    let signature
    try {
      signature = JSON.stringify([action, data])
    } catch (error) {
      signature = String(Math.random())
    }
    if (signatures.get(type) === signature) return
    signatures.set(type, signature)
    invalidate()
  }

  // ------------------------------------------------------------ API

  return {
    get enabled() {
      return settings.enabled
    },
    set enabled(value) {
      settings.enabled = value === true
      if (settings.enabled) maybeStart()
      else stop()
    },
    get ignoreInitFlag() {
      return settings.ignoreInitFlag
    },
    set ignoreInitFlag(value) {
      settings.ignoreInitFlag = value === true
      maybeStart()
    },
    get testMode() {
      return settings.testMode
    },
    set testMode(value) {
      const next = value === true
      if (next === settings.testMode) return
      settings.testMode = next
      if (started) {
        cache = null
        load(true)
      }
    },
    get debug() {
      return settings.debug
    },
    set debug(value) {
      settings.debug = value === true
    },

    /** Хост открыл экран с кодом `name` (тот, что маркетолог пишет в `target_screens`). */
    screenOpened(name) {
      const code = typeof name === 'string' ? name.trim() : ''
      if (!code) return
      screen = code
      screenSeq += 1
      screenAt = now()
      frequency.newPage()
      cancelTimers()
      if (!started) return
      log(`screen ${code}`)
      popups.forEach((popup) => {
        if (popup.trigger === 'app_start' || popup.trigger === 'screen_open') fire(popup, `screen ${code}`)
        else if (popup.trigger === 'time_on_screen' && foreground) startTimer(popup, popup.triggerValue * 1000)
      })
    },

    /** Ручной показ по id: без триггера, экранов и частоты (частота не записывается). */
    async show(id) {
      if (!settings.enabled) {
        log(`show(${id}) ignored: popups are not enabled`)
        return false
      }
      if (deps.whenInitialized) await deps.whenInitialized()
      await deps.store.load()
      const raw = await deps.api.one(id)
      if (!raw) return false
      const parsed = parsePopupV3(raw)
      if (!parsed.popup) {
        log(`popup ${id} skipped: ${parsed.reason}`)
        return false
      }
      await show(parsed.popup, true)
      return open.has(parsed.popup.key)
    },

    // Хуки SDK.
    onInit() {
      if (started) load(false)
      else maybeStart()
    },
    onTrackEvent(name) {
      if (!started || typeof name !== 'string') return
      popups.forEach((popup) => {
        if (popup.trigger === 'track_event' && popup.triggerEvent === name) fire(popup, `event ${name}`)
      })
    },
    onContextChange: contextChanged,
    onPurchase() {
      invalidate()
    },
    onAppState(state) {
      if (state === 'active') {
        if (foreground) return
        foreground = true
        if (!started) return
        screenAt = now()
        popups.forEach((popup) => {
          if (popup.trigger === 'time_on_screen' && screen !== null) startTimer(popup, popup.triggerValue * 1000)
        })
        // Возврат из фона (и системный диалог) во время первой загрузки — не повод для второй.
        if (!cacheValid() && !loading) load(false)
      } else if (state === 'background') {
        foreground = false
        cancelTimers()
      }
    },

    /** Для тестов и отладки. */
    state: () => ({ started, screen, screenSeq, queue: queue.slice(), open: Array.from(open.keys()), popups: Array.from(popups.keys()) }),
  }

  function stop() {
    if (!started) return
    started = false
    loadSeq += 1
    loading = false
    cancelTimers()
    queue = []
    popups = new Map()
    if (invalidateTimer !== null) clearTimeout(invalidateTimer)
    invalidateTimer = null
    log('stopped')
  }
}
