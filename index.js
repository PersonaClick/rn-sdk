import MainSDK from "./MainSDK";

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

class PersonaClick extends MainSDK{
  constructor(shop_id, stream, debug = false, autoSendPushToken = true) {
    super(shop_id, stream, debug, autoSendPushToken);
    this.init();
  }
}

export default PersonaClick;

// Export popup overlay UI component for React Native apps.
// NOTE: this component must be rendered in your React tree if you want SDK to auto-present popups.
export { default as SdkPopupOverlay } from './components/Popup/SdkPopupOverlay'
export { registerSDK as registerSdkPopupOverlaySDK } from './components/Popup/SdkPopupOverlay'
