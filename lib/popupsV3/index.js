import { AppState, Linking, Platform } from 'react-native'
import { registerOverlayLayer } from '../../components/Popup/overlayLayers'
import PopupV3Layer from '../../components/PopupsV3/PopupV3Layer'
import { normalizeStoriesApiV3Domain } from '../../components/widgets/storiesApiV3'
import { DEBUG } from '../../MainSDK'
import { createPopupActions } from './actions'
import { createPopupsV3Api, fetchPopupPromoCode } from './api'
import { createPopupsV3Engine } from './engine'
import { createPopupShowStore } from './frequency'
import { canPresentPopupV3, dismissPopupV3, presentPopupV3 } from './presenter'
import { popupTexts } from './texts'

/**
 * Попапы v3 (документ design нового конструктора, рендер на JS) — не публичный API, за шлюзом v3:
 * `PersonalizationPopups.of(sdk)` из `@personaClick/react-native-sdk/internal/v3`. Публичный API SDK не
 * меняется: движок спит, пока хост его не включил.
 *
 * ```js
 * const popups = PersonalizationPopups.of(sdk)
 * popups.enabled = true          // без этого — ни одного запроса
 * popups.screenOpened('product') // коды экранов — те, что маркетолог пишет в target_screens
 * popups.show(512)               // ручной показ
 * ```
 *
 * Показ — слоем `<SdkPopupOverlay>` (тот же хост, что у in-app попапов): без него попап не
 * показывается.
 */

/** Хост ЛК по умолчанию (API v3). */
export const POPUPS_V3_APP_HOST = 'app.personaClick.ru'

const controllers = new WeakMap()

const log = (message, debug) => {
  if (debug || DEBUG) console.log(`[Popups v3] ${message}`)
}

/** Ждёт init SDK — в той же очереди команд, что и остальные запросы SDK. */
const whenInitialized = (sdk) =>
  new Promise((resolve) => {
    if (typeof sdk.push === 'function') sdk.push(resolve)
    else resolve()
  })

function createController(sdk) {
  let appHost = POPUPS_V3_APP_HOST
  let linkHandler = null
  let productHandler = null
  const owner = typeof sdk.shop_id === 'string' ? sdk.shop_id : String(sdk.shop_id)
  const sid = () => (typeof sdk.userSeance === 'string' ? sdk.userSeance : '')
  const identity = async () => {
    const did = sdk.deviceId || (typeof sdk.getDeviceId === 'function' ? await sdk.getDeviceId() : '') || ''
    return { shopId: sdk.shop_id, did, sid: sid() }
  }
  let engine = null
  const api = createPopupsV3Api({
    host: () => appHost,
    identity,
    testMode: () => engine.testMode,
    debug: () => engine.debug,
    log: (message) => log(message, engine.debug),
  })
  // `true` — ссылку обработал хук хоста (движок закроет попап), `false` — она ушла системе.
  const openLink = (url) => {
    try {
      if (linkHandler && linkHandler(url) === true) return true
    } catch (error) {
      log(`link handler failed: ${(error && error.message) || error}`, true)
    }
    Linking.openURL(url).catch((error) => log(`cannot open ${url}: ${(error && error.message) || error}`, engine.debug))
    return false
  }
  const openProduct = (product) => {
    if (!productHandler) return false
    try {
      return productHandler(product) === true
    } catch (error) {
      log(`product handler failed: ${(error && error.message) || error}`, true)
      return false
    }
  }
  engine = createPopupsV3Engine({
    owner,
    sdk,
    api,
    store: createPopupShowStore(owner),
    presenter: {
      canPresent: (popup) => canPresentPopupV3(popup, owner),
      present: presentPopupV3,
      dismiss: dismissPopupV3,
    },
    identitySid: sid,
    flag: () => sdk._popupsV3Flag === true,
    initialized: () => sdk.initialized === true && !!appHost,
    whenInitialized: () => whenInitialized(sdk),
    fetchPromoCode: (listId) => fetchPopupPromoCode(sdk.shop_id, listId),
    actions: createPopupActions(sdk, () => appHost),
    openLink,
    openProduct,
    autoPresentationDisabled: () =>
      typeof sdk.popupPresentationDelegate === 'function' || sdk.enableAutoPopupPresentation === false,
    os: Platform.OS,
    texts: popupTexts(),
    log,
  })
  // Хуки MainSDK (флаг /init, кастомные события, смена контекста) зовут движок по этой ссылке.
  sdk._popupsV3 = engine
  try {
    AppState.addEventListener('change', (state) => engine.onAppState(state))
  } catch (error) {
    // Без событий окна таймеры не сбрасываются в фоне.
  }

  return {
    /** Включение хостом; без него движок не шлёт ни одного запроса. */
    get enabled() {
      return engine.enabled
    },
    set enabled(value) {
      engine.enabled = value
    },
    /** Не ждать флага `popups_v3` из `/init` (демо, проверка до публикации). */
    get ignoreInitFlag() {
      return engine.ignoreInitFlag
    },
    set ignoreInitFlag(value) {
      engine.ignoreInitFlag = value
    },
    /** Тестовый режим: `testmode=true` в списке, ручном показе и `/init`; частота не пишется. */
    get testMode() {
      return engine.testMode
    },
    set testMode(value) {
      engine.testMode = value
    },
    /** `debug=1` в списке и решения движка в лог. */
    get debug() {
      return engine.debug
    },
    set debug(value) {
      engine.debug = value
    },
    /** Хост ЛК без схемы (`app.personaClick.ru`); `null` — попапы молчат. */
    get appHost() {
      return appHost
    },
    set appHost(value) {
      appHost = normalizeStoriesApiV3Domain(value)
      engine.onInit()
    },
    /**
     * Свой обработчик ссылок попапа (после события `click`): вернул `true` — хост обработал ссылку
     * сам, попап закрывается без `close`; иначе (или исключение) — открывает система, попап остаётся.
     */
    get onLink() {
      return linkHandler
    },
    set onLink(handler) {
      linkHandler = typeof handler === 'function' ? handler : null
    },
    /**
     * Нажатие на товар ленты рекомендаций: вернул `true` — хост открыл товар сам, попап
     * закрывается; иначе — ссылка товара (`deeplink`, затем `url`), как любая ссылка попапа.
     */
    get onProductClick() {
      return productHandler
    },
    set onProductClick(handler) {
      productHandler = typeof handler === 'function' ? handler : null
    },
    screenOpened: (name) => engine.screenOpened(name),
    show: (id) => engine.show(id),
  }
}

/** Попапы v3 инстанса SDK (один контроллер на инстанс); регистрирует слой показа. */
export function popupsV3Of(sdk) {
  if (!sdk || typeof sdk !== 'object') throw new Error('PersonalizationPopups.of: an SDK instance is required')
  let controller = controllers.get(sdk)
  if (!controller) {
    registerOverlayLayer('popupsV3', PopupV3Layer)
    controller = createController(sdk)
    controllers.set(sdk, controller)
  }
  return controller
}

export const PersonalizationPopups = Object.freeze({ of: popupsV3Of })
