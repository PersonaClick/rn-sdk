import MainSDK from "./MainSDK";
import * as facade from "./lib/facade/facade";
import { trackPush } from "./lib/push/trackPush";
import { UnknownShopIdError, AmbiguousShopError } from "./lib/facade/errors";
import { PushEvent } from "./lib/push/PushEvent";

export const SESSION_CODE_EXPIRE = 120;
export const SDK_API_URL = 'https://api.personaclick.com/';
export const SDK_STORAGE_NAME = '@PersonaClick';
export const SDK_PUSH_CHANNEL = 'PersonaClick';

export {
  parseCartItem,
  parseProduct,
  parseProductInfo,
  parseProductsListResponse,
} from './types/productTypes';

export { UnknownShopIdError, AmbiguousShopError } from './lib/facade/errors';
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
  constructor(shop_id, stream, debug = false, autoSendPushToken = true) {
    super(shop_id, stream, debug, autoSendPushToken);
    this.init();
  }

  /**
   * Initializes an SDK for `config` immediately and returns it. Registered, so also reachable via
   * `getInstance`.
   * @param {{ shopId: string, stream?: string, debug?: boolean, autoSendPushToken?: boolean, apiDomain?: string, storageKey?: string }} config
   * @returns {PersonaClick}
   */
  static initialize(config) {
    return facade.initialize(config);
  }

  /**
   * Registers shops without initializing them (lazy on first `getInstance`). Pass
   * `{ eagerInit: true }` to initialize every shop up front.
   * @param {Array<object>} configs
   * @param {{ eagerInit?: boolean }} [options]
   * @returns {void}
   */
  static registerShops(configs, options) {
    return facade.registerShops(configs, options);
  }

  /**
   * Returns the SDK for `shopId` (materializing a pending registration on first use). With no
   * `shopId`, returns the single instance when exactly one shop is registered.
   * @param {string} [shopId]
   * @returns {PersonaClick}
   * @throws {AmbiguousShopError} no `shopId` and more than one shop registered.
   * @throws {UnknownShopIdError} the shop is unknown.
   */
  static getInstance(shopId) {
    return facade.getInstance(shopId ?? null);
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
   * several shops are live, drops the push. Tracking-only — navigation stays with the host.
   * @param {object} payload - FCM remote message or flat data object.
   * @param {string} event - a `PushEvent` value (`delivered` | `opened` | `clicked`).
   * @returns {void}
   */
  static handlePush(payload, event) {
    return facade.handlePush(payload, event);
  }

  /** Test-only: drops pending registrations. Live instances live in the registry. */
  static reset() {
    return facade.reset();
  }
}

// Wire the factory the facade uses to build/materialize instances. Done here — after the class is
// defined — to break the index <-> facade import cycle (the facade never imports this module).
facade.setSdkFactory((config) =>
  new PersonaClick(config.shopId, config.stream, config.debug, config.autoSendPushToken)
);

// Wire the standalone push tracker so handlePush can track a pending shop's push without building it
// (RN's request() tracks on the persisted did — no /init/token/profile). Same injection seam.
facade.setPushTracker(trackPush);

export default PersonaClick;

// Export popup overlay UI component for React Native apps.
// NOTE: this component must be rendered in your React tree if you want SDK to auto-present popups.
export { default as SdkPopupOverlay } from './components/Popup/SdkPopupOverlay'
export { registerSDK as registerSdkPopupOverlaySDK } from './components/Popup/SdkPopupOverlay'

// NOTE: Stories UI components are intentionally NOT exported from the package root.
// They pull heavy native deps (react-native-fs/video/vector-icons/volume-manager), so importing
// the SDK would force those on every consumer. Import them from the '@personaClick/react-native-sdk/stories'
// subpath instead (see ./stories.js).
