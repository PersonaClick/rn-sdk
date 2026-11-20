import MainSDK from "./MainSDK";
import * as facade from "./lib/facade/facade";
import { trackPush } from "./lib/push/trackPush";
import { getData, setShopHosts } from "./lib/client";
import SdkRegistry from "./lib/registry/SdkRegistry";
import { nativeBridge, DEFAULT_STREAM } from "./lib/native/bridge";
import PushRouter from "./lib/push/PushRouter";
import { getMessaging, setBackgroundMessageHandler } from "@react-native-firebase/messaging";
import notifee, { EventType } from "@notifee/react-native";
import { PushEvent } from "./lib/push/PushEvent";
import { setLogHandler } from "./lib/native/logs";
import { setSharedPushCallbacks } from "./lib/push/pushCallbacks";

export const SESSION_CODE_EXPIRE = 120;
export const SDK_API_URL = 'https://api.personaclick.com/';
// The host of API v3 (the account's), without the scheme: the purchase prediction lives there. The API's
// host with `app.` in place of `api.` — built, not written, so a build for another domain, which rewrites
// SDK_API_URL whole, gets its own.
export const SDK_APP_HOST = SDK_API_URL.replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').replace(/^api\./i, 'app.');
export const SDK_STORAGE_NAME = '@PersonaClick';
export const SDK_PUSH_CHANNEL = 'PersonaClick';

export {
  parseCartItem,
  parseProduct,
  parseProductInfo,
  parseProductsListResponse,
} from './types/productTypes';

export { PersonaClickError, UnknownShopIdError, AmbiguousShopError, SdkError } from './lib/facade/errors';
export { PushEvent } from './lib/push/PushEvent';

/**
 * The SDK — both the instance class and the multi-instance facade (Release 3).
 *
 * A host no longer needs to keep its own reference to the SDK: initialize (or register) shops
 * through the static methods and reach them by `shopId` via `PersonaClick.getInstance()`. One instance per
 * shop, each with isolated storage and state.
 *
 * ```js
 * // Single shop:
 * PersonaClick.initialize({ shopId: 'SHOP_ID', stream: Platform.OS });
 * PersonaClick.getInstance().track(...);
 *
 * // Several shops, initialized lazily on first use:
 * PersonaClick.registerShops([{ shopId: 'shop-a' }, { shopId: 'shop-b' }]);
 * PersonaClick.getInstance('shop-a').track(...);
 * ```
 */
class PersonaClick extends MainSDK{
  /**
   * @deprecated Use `PersonaClick.initialize(config)` (or `PersonaClick.registerShops(...)` +
   * `PersonaClick.getInstance(shopId)`). The constructor still works and registers the instance.
   */
  constructor(shop_id, stream, debug = false, autoSendPushToken = true, hosts = null) {
    super(shop_id, stream, debug, autoSendPushToken, null, hosts);
    this.init();
  }

  /**
   * Initializes an SDK for `config` immediately and returns it. Registered, so also reachable via
   * `getInstance`.
   * @param {{ shopId: string, stream?: string, debug?: boolean, autoSendPushToken?: boolean, apiDomain?: string, appDomain?: string, storageKey?: string }} config
   * @returns {PersonaClick}
   */
  static initialize(config) {
    return facade.initialize(config);
  }

  /**
   * Registers shops without initializing them (lazy on first `instance`). Pass
   * `{ eagerInit: true }` to initialize every shop up front.
   * @param {Array<object>} configs
   * @param {{ eagerInit?: boolean }} [options]
   * @returns {void}
   */
  static register(configs, options) {
    const result = facade.register(configs, options);
    if (!(options && options.eagerInit)) {
      registerShopHosts(configs);
      registerNativeShops(configs);
    }
    return result;
  }

  /**
   * @deprecated Use `PersonaClick.register(configs, options)`: the same.
   */
  static registerShops(configs, options) {
    return PersonaClick.register(configs, options);
  }

  /**
   * Returns the SDK for `shopId` (materializing a pending registration on first use). With no
   * `shopId`, returns the single instance when exactly one shop is registered.
   * @param {string} [shopId]
   * @returns {PersonaClick}
   * @throws {PersonaClickError} `ambiguousShop` (`AmbiguousShopError`): no `shopId` and more than one shop
   *   registered; `unknownShop` (`UnknownShopIdError`): the shop is unknown.
   */
  static instance(shopId) {
    return facade.instance(shopId ?? null);
  }

  /**
   * @deprecated Use `PersonaClick.instance(shopId)`: the same.
   */
  static getInstance(shopId) {
    return facade.instance(shopId ?? null);
  }

  /**
   * True when an instance is available for `shopId` — or, with no `shopId`, when exactly one shop is
   * initialized so the default is unambiguous.
   * @param {string} [shopId]
   * @returns {boolean}
   */
  static isInitialized(shopId) {
    return facade.isInitialized(shopId ?? null);
  }

  /**
   * Delivers the instance for `shopId` to `onReady` as soon as it is available. Returns a cancel
   * function. An ambiguous default (no `shopId`, several shops) warns and does not resolve.
   * @param {string | null} shopId
   * @param {(sdk: PersonaClick) => void} onReady
   * @returns {() => void} cancel
   */
  static awaitInstance(shopId, onReady) {
    return facade.awaitInstance(shopId ?? null, onReady);
  }

  /**
   * Routes a push to the instance it belongs to (by the payload's `shop_id`) and tracks `event` on
   * it. No `shop_id` with a single live shop still resolves; an unknown shop, or no `shop_id` while
   * several shops are live, drops the push, and so does a push without `id` and `type` (not the SDK's).
   * Tracking-only — navigation stays with the host.
   * @param {object} payload - FCM remote message or flat data object.
   * @param {string} event - a `PushEvent` value (`delivered` | `opened` | `clicked` | `closed`).
   * @returns {Promise<string | null>} the shop the push went to, or null; never rejects.
   */
  static handlePush(payload, event) {
    return facade.handlePush(payload, event);
  }

  /**
   * The app gets each message the native SDKs log — of every shop, at or above its `logLevel` — as
   * `{ level, code, message, shopId, context }`, to forward to its crash reporter. A new handler
   * replaces the one before; null removes it. An exception of the handler is caught. Without the native
   * module no message comes.
   * @param {((message: object) => void) | null} handler
   * @returns {void}
   */
  static setLogHandler(handler) {
    setLogHandler(handler);
  }

  /**
   * The app's push callbacks for every shop — also one registered but not created yet, whose push may
   * come before the app could set its instance's callbacks. A callback gets the push (`PushPayload`,
   * with the shop it went to) once its event was accepted; a shop's own callback of an event
   * (`notifications.setCallbacks`) wins over the one here. A new call replaces them; null removes them.
   * @param {object | null} callbacks `{ onDelivered, onOpened, onClicked, onClosed, onToken }`
   * @returns {void}
   */
  static setPushCallbacks(callbacks) {
    setSharedPushCallbacks(callbacks);
  }

  /** Test-only: drops pending registrations. Live instances live in the registry. */
  static reset() {
    return facade.reset();
  }
}

// Wire the factory the facade uses to build/materialize instances. Done here — after the class is
// defined — to break the index <-> facade import cycle (the facade never imports this module).
facade.setSdkFactory((config) =>
  new PersonaClick(
    config.shopId,
    config.stream,
    // `debug` is the released form of `logLevel: 'debug'`; either turns on the SDK's own console log too.
    !!config.debug || config.logLevel === 'debug',
    config.autoSendPushToken,
    {
      apiDomain: config.apiDomain,
      appDomain: config.appDomain,
      logLevel: config.logLevel ?? (config.debug ? 'debug' : undefined),
      sendAdvertisingId: config.sendAdvertisingId,
      needReInitialization: config.needReInitialization,
      deviceId: config.deviceId,
      storageKey: config.storageKey,
      enableAutoPopupPresentation: config.enableAutoPopupPresentation,
    }
  )
);

// Wire the standalone push tracker so handlePush can track a pending shop's push without building it
// (RN's request() tracks on the persisted did — no /init/token/profile). Same injection seam.
facade.setPushTracker(trackPendingPush);

// The hosts of the shops registered without an instance: the push events JavaScript sends for one of them
// (trackPush) go to its apiDomain, as its instance's requests will. A live instance keeps its own.
function registerShopHosts(configs) {
  (Array.isArray(configs) ? configs : []).forEach((config) => {
    if (!config || typeof config.shopId !== 'string' || !config.shopId) return;
    const live = SdkRegistry.byShopId(config.shopId);
    if (live && !live._released) return;
    setShopHosts(config.shopId, { apiDomain: config.apiDomain, appDomain: config.appDomain });
  });
}

// The shops registered without an instance, on the native SDK too, with the device id JavaScript kept:
// a push of a process their instance never started goes there with that did and no /init. Android can;
// on iOS the push goes from JavaScript (trackPush).
let nativeRegistration = Promise.resolve(false);

function registerNativeShops(configs) {
  if (!nativeBridge) return;
  const shops = (Array.isArray(configs) ? configs : []).filter((c) => c && typeof c.shopId === 'string' && c.shopId);
  if (shops.length === 0) return;
  const previous = nativeRegistration;
  nativeRegistration = (async () => {
    await previous;
    const natives = [];
    for (const config of shops) {
      const stored = await getData(config.shopId);
      natives.push({
        shopId: config.shopId,
        stream: config.stream || DEFAULT_STREAM,
        apiDomain: config.apiDomain ?? null,
        appDomain: config.appDomain ?? null,
        deviceId: (stored && stored.did) || config.deviceId || null,
        ...(typeof config.storageKey === 'string' && config.storageKey.trim() !== '' ? { storageKey: config.storageKey } : {}),
        ...(typeof config.logLevel === 'string' ? { logLevel: config.logLevel } : {}),
      });
    }
    return nativeBridge.registerShops(natives);
  })().catch(() => false);
}

/**
 * A push event of a shop with no instance in this process: the native SDK's own push handling where it
 * takes the shop (its queue, the stored did, no /init), else this JavaScript (trackPush).
 */
async function trackPendingPush(shopId, event, options = {}, payload) {
  if (nativeBridge) {
    await nativeRegistration;
    const source = (payload && payload.data && typeof payload.data === 'object') ? payload.data : (payload || {});
    const data = {};
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string') data[key] = value;
      else if (value != null && typeof value === 'object') data[key] = JSON.stringify(value);
    }
    if (data.id == null && options.code != null) data.id = String(options.code);
    if (data.type == null && options.type != null) data.type = String(options.type);
    data.shop_id = shopId;
    const shop = await nativeBridge.handlePush(data, event).catch(() => null);
    if (shop) return shop;
    // What the shop's instance would send: the default stream when its app names none.
    return trackPush(shopId, event, { ...options, stream: options.stream || DEFAULT_STREAM });
  }
  return trackPush(shopId, event, options);
}

// The SDK's background push handler, set as the app imports the SDK: a push that starts the process is
// drawn and tracked for a shop registered at the app's module scope, with no screen. An app's own handler
// set later replaces it.
// (Undefined only inside an import cycle a test starts from the router itself.)
PushRouter?.installBackgroundHandler?.({
  getMessaging,
  setBackgroundMessageHandler,
  notifee,
  EventType,
  isDebug: () => false,
});

export default PersonaClick;

// Export popup overlay UI component for React Native apps.
// NOTE: this component must be rendered in your React tree if you want SDK to auto-present popups.
export { default as SdkPopupOverlay } from './components/Popup/SdkPopupOverlay'
export { registerSDK as registerSdkPopupOverlaySDK } from './components/Popup/SdkPopupOverlay'

// NOTE: Stories UI components are intentionally NOT exported from the package root.
// They pull heavy native deps (react-native-fs/video/vector-icons/volume-manager), so importing
// the SDK would force those on every consumer. Import them from the '@personaClick/react-native-sdk/stories'
// subpath instead (see ./stories.js).
