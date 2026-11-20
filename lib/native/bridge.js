import { NativeEventEmitter } from 'react-native'
import { SdkError } from '../facade/errors'

/** The native module, or null where React Native has no TurboModules (some test set-ups). */
function nativeModule() {
  try {
    return require('../../specs/NativePersonaClick').default ?? null
  } catch (_) {
    return null
  }
}

const NativePersonaClick = nativeModule()

const STATE_CHANGED = 'PersonaClickStateChanged'
const POPUP = 'PersonaClickPopup'
const LOG = 'PersonaClickLog'

let emitter = null

/**
 * How long a server popup the native module handed over waits for a listener of its shop: as long as the
 * native module holds one while JavaScript cannot hear it.
 */
export const POPUP_HOLD_MS = 60000

/** The listeners of the popups: `{ listener, shopId }`, a null `shopId` hearing every shop. */
const popupListeners = new Set()
/** Popups of shops no listener heard yet, in the order they came: `{ shopId, event, at }`. */
let heldPopups = []
let popupSubscription = null

/**
 * A popup event of the native module goes to the listeners of its shop. One no listener hears — the native
 * module replays every shop's held popups to the first listener of any shop, and a shop may start later —
 * is held for its shop's listener, up to `POPUP_HOLD_MS`.
 * @param {{ shopId: string, popup: object }} event
 */
function dispatchPopup(event) {
  dropStalePopups()
  let heard = false
  for (const entry of [...popupListeners]) {
    if (entry.shopId == null || entry.shopId === event?.shopId) {
      heard = true
      tellPopup(entry, event)
    }
  }
  if (!heard) heldPopups.push({ shopId: event?.shopId ?? null, event, at: Date.now() })
}

function tellPopup(entry, event) {
  try {
    entry.listener(event)
  } catch (error) {
    console.error('[SDK] A popup listener threw:', error?.message ?? error)
  }
}

function dropStalePopups() {
  const now = Date.now()
  heldPopups = heldPopups.filter((held) => now - held.at <= POPUP_HOLD_MS)
}

/**
 * The native module's rejection as the SDK's one error type: its code is the native error's type,
 * and an HTTP error keeps its codes.
 * @param {any} error
 * @returns {SdkError}
 */
export function toSdkError(error) {
  if (error instanceof SdkError) return error
  const info = error?.userInfo ?? {}
  return new SdkError(error?.code ?? 'invalidArgument', error?.message ?? String(error), {
    httpCode: info.httpCode,
    serverCode: info.serverCode,
  })
}

const native = (call) => {
  try {
    return call().catch((error) => Promise.reject(toSdkError(error)))
  } catch (error) {
    // A call codegen refuses (an argument of the wrong type) throws before it reaches the module.
    return Promise.reject(toSdkError(error))
  }
}

/**
 * The namespaces' methods of the native module (`specs/NativePersonaClick.ts`): `<namespace><Method>(shopId,
 * …)`. Each resolves with what the native method returned, as a map with the contract's field names.
 */
export const NAMESPACE_METHODS = [
  'trackingProductView', 'trackingCategoryView', 'trackingSearch', 'trackingAddToCart', 'trackingSyncCart',
  'trackingRemoveFromCart', 'trackingAddToFavorites', 'trackingSyncFavorites', 'trackingRemoveFromFavorites',
  'trackingPurchase', 'trackingStoryView', 'trackingStoryClick', 'trackingBannerView', 'trackingBannerClick',
  'trackingPopupShown', 'trackingCustom',
  'productsGetInfo', 'productsGetList', 'productsGetCounters', 'productsGetCategory',
  'collectionsGet',
  'recommendationsGet',
  'searchBlank', 'searchInstant', 'searchFull', 'searchAgentDialog', 'searchAgent',
  'cartGet', 'cartClear',
  'profileGet', 'profileSet', 'profileGetLastOrder', 'profileGetOrders',
  'subscriptionsManage', 'subscriptionsCheck', 'subscriptionsSubscribeForPriceDrop',
  'subscriptionsUnsubscribeFromPriceDrop', 'subscriptionsSubscribeForBackInStock',
  'subscriptionsUnsubscribeFromBackInStock',
  'segmentsAdd', 'segmentsRemove', 'segmentsGet',
  'notificationsTrack', 'notificationsSetPushToken', 'notificationsGetPushToken', 'notificationsGetHistory',
  'storiesGet',
  'predictGetProbabilityToPurchase',
  'loyaltyJoin', 'loyaltyGetStatus', 'loyaltyGetPromotions',
  'slidersGet',
  'reviewsCreateNps', 'reviewsCreateCsat', 'reviewsCreateCes', 'reviewsGetNpsCategories', 'reviewsGetNpsChannels',
  'reviewsGetCsatCampaigns', 'reviewsGetCesCampaigns', 'reviewsGetProductReviews', 'reviewsGetClientReviews',
]

/**
 * The instance's methods of the native module (`sdk/contract/root.md`): each takes the shop.
 */
export const INSTANCE_METHODS = ['flush', 'deleteUserCredentials']

/**
 * The stream of a shop whose app names none (`sdk/contract`): the native SDK starts it with this one, and
 * the requests JavaScript still sends for it carry it too. An app's own `stream` is kept.
 */
export const DEFAULT_STREAM = 'react-native'

/** The pushes of shops this JavaScript has not started: `registerShops(configs)`, `handlePush(payload, event)`. */
export const PUSH_METHODS = ['registerShops', 'handlePush']

/**
 * The module's methods of `names` as functions that reject with an `SdkError`. A method the installed
 * native module lacks (its app was built with an earlier version of the SDK) rejects with
 * `notInitialized`.
 * @param {string[]} names
 */
function moduleMethods(names) {
  const methods = {}
  for (const name of names) {
    methods[name] = (...args) => typeof NativePersonaClick[name] === 'function'
      ? native(() => NativePersonaClick[name](...args))
      : Promise.reject(new SdkError('notInitialized', `The SDK's native module has no ${name}: rebuild the app`))
  }
  return methods
}

/**
 * The SDK's bridge to the native Android and iOS SDKs (`specs/NativePersonaClick.ts`). Null without the
 * native module: Expo Go, an app not rebuilt after installing the SDK, or an iOS app on React Native's
 * old architecture, where the module has no methods. Every rejection is an `SdkError`.
 */
export const nativeBridge = typeof NativePersonaClick?.initializeShop === 'function'
  ? {
      ...moduleMethods(NAMESPACE_METHODS),

      // flush(shopId): sends the shop's queue now; deleteUserCredentials(shopId): forgets its customer.
      ...moduleMethods(INSTANCE_METHODS),

      ...moduleMethods(PUSH_METHODS),

      /**
       * Releases the shop's native instance: it stops sending and leaves the native registry; the
       * module stops telling its state. Never throws. A module without the method (an app not rebuilt
       * after updating the SDK) keeps its native instance.
       */
      releaseShop: (shopId) => {
        // The popups held for it are not handed to the shop's next instance, as the native module drops its own.
        heldPopups = heldPopups.filter((held) => held.shopId !== shopId)
        try {
          if (typeof NativePersonaClick.releaseShop === 'function') NativePersonaClick.releaseShop(shopId)
        } catch (_) {
          // Nothing the caller could do: the JavaScript instance is released all the same.
        }
      },

      /** Initializes the shop's native instance and resolves with its snapshot. */
      initializeShop: (config) => native(() => NativePersonaClick.initializeShop(config)),

      /** The shop's device id, or null before the server handed one out. */
      getDeviceId: (shopId) => native(() => NativePersonaClick.getDeviceId(shopId)),

      /** An event through the shop's native queue; resolves once the queue accepted it. */
      queueEvent: (shopId, path, body) => native(() => NativePersonaClick.queueEvent(shopId, path, body)),

      /** Stores the shop's tracking source for 48 hours. */
      setSource: (shopId, type, code) => native(() => NativePersonaClick.setSource(shopId, type, code)),

      /**
       * `listener` hears the server popups of the native SDK of `shopId` — of every shop without one — as
       * `{ shopId, popup }`, `popup` with the server's field names; returns the function that stops it. The
       * native SDK shows none itself. The popups of the shop that came while no listener of it was there —
       * the native module's replay to the first listener of any shop among them — come to it at once.
       */
      onPopup: (listener, shopId = null) => {
        emitter = emitter ?? new NativeEventEmitter(NativePersonaClick)
        // One subscription for every shop: the native replay reaches it whichever shop started first.
        popupSubscription = popupSubscription ?? emitter.addListener(POPUP, dispatchPopup)
        const entry = { listener, shopId }
        popupListeners.add(entry)
        dropStalePopups()
        const waiting = heldPopups.filter((held) => shopId == null || held.shopId === shopId)
        if (waiting.length > 0) {
          heldPopups = heldPopups.filter((held) => !waiting.includes(held))
          // After the caller has its stop function.
          Promise.resolve().then(() => {
            waiting.forEach((held) => {
              if (popupListeners.has(entry)) tellPopup(entry, held.event)
              else heldPopups.push(held)
            })
          })
        }
        return () => {
          popupListeners.delete(entry)
        }
      },

      /**
       * `listener` hears every change of a shop's state or session as the shop's snapshot
       * `{ shopId, state, deviceId, sessionId, segment }`, and at once the snapshot of every shop
       * initialized so far; returns the function that stops it.
       */
      /** `PersonaClick.setLogHandler`: on, the native SDK's log messages come as `onLog`'s events. */
      setLogHandler: (enabled) => {
        try {
          if (typeof NativePersonaClick.setLogHandler === 'function') NativePersonaClick.setLogHandler(!!enabled)
        } catch (_) {
          // An app not rebuilt with this module's method: no messages come.
        }
      },

      onLog: (listener) => {
        emitter = emitter ?? new NativeEventEmitter(NativePersonaClick)
        const subscription = emitter.addListener(LOG, listener)
        return () => subscription.remove()
      },

      onStateChanged: (listener) => {
        emitter = emitter ?? new NativeEventEmitter(NativePersonaClick)
        const subscription = emitter.addListener(STATE_CHANGED, listener)
        return () => subscription.remove()
      },
    }
  : null
