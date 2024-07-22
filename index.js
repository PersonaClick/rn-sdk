import MainSDK from "./MainSDK";

export const SESSION_CODE_EXPIRE = 120;
export const SDK_API_URL = 'https://api.personaclick.com/';
export const SDK_STORAGE_NAME = '@PersonaClick';
export const SDK_PUSH_CHANNEL = 'PersonaClick';

class PersonaClick extends MainSDK{
  constructor(shop_id, stream, debug = false, autoSendPushToken = true) {
    super(shop_id, stream, debug, autoSendPushToken);
    this.init();
  }
}

export default PersonaClick;
