import {request, updSeance} from './lib/client';
import { convertParams } from './lib/tracker';
import { Platform } from 'react-native';

//Время жизни сеанса в минутах
export const SESSION_CODE_EXPIRE = 30;

class PersonaClick {
  constructor(shop_id, stream) {
    this.shop_id = shop_id;
    this.stream = stream ?? null;
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      if (!this.shop_id || typeof this.shop_id !== 'string') {
        const initError = new Error('Parameter "shop_id" is required as a string.');

        initError.name = 'Init error';

        throw initError;
      }

      if (this.stream && typeof this.stream !== 'string') {
        const streamError = new Error('Parameter "stream" must be a string.');

        streamError.name = 'Init error';

        throw streamError;
      }

      const response = await request('init', {
        params: {
          shop_id: this.shop_id,
          stream: this.stream,
        },
      });

      this.initialized = true;

      await updSeance(response?.did, response?.seance);

    } catch (error) {
      this.initialized = false;
      return error;
    }
  }

  isInit = () => this.initialized;

  async track(event, options) {
    try {
      const queryParams = await convertParams(event, options);
      return await request('push', {
        method: 'POST',
        params: {
          shop_id: this.shop_id,
          stream: this.stream,
          ...queryParams,
        },
      });
    } catch (error) {
      return error;
    }
  }

  async notificationClicked(options) {
    try {
      return await request(`web_push_subscriptions/clicked`, {
        method: 'POST',
        params: {
          shop_id: this.shop_id,
          stream: this.stream,
          ...options,
        },
      });
    } catch (error) {
      return error;
    }
  }

  async recommend(recommender_code, options) {
    try {
      return await request(`recommend/${recommender_code}`, {
        params: {
          shop_id: this.shop_id,
          stream: this.stream,
          recommender_code,
          ...options,
        },
      });
    } catch (error) {
      return error;
    }
  }

  async search(options) {
    try {
      return await request('search', {
        params: {
          shop_id: this.shop_id,
          stream: this.stream,
          ...options,
        },
      });
    } catch (error) {
      return error;
    }
  }

  async setProfile(params) {
    if (params.hasOwnProperty("birthday") && !params.birthday.match(/^\d{4}-\d{2}-\d{2}$/)) {
      delete params.birthday;
    }
    for (let key in params) {
      if (typeof params[key] === 'object') {
        params[key] = JSON.stringify(params[key]);
      }
    }
    try {
      return await request('profile/set', {
        method: 'POST',
        params: {
          shop_id: this.shop_id,
          stream: this.stream,
          ...params
        },
      });
    } catch (error) {
      return error;
    }
  }
  async getProfile(options) {
    try {
      return await request('profile', {
        method: 'GET',
        params: {
          shop_id: this.shop_id,
          stream: this.stream,
          ...options
        },
      });
    } catch (error) {
      return error;
    }
  }

  async setPushTokenNotification(token) {
    try {
      const params = {
        token: token,
        platform: Platform.OS,
      }
      return await request('mobile_push_tokens', {
        method: 'POST',
        params: {
          shop_id: this.shop_id,
          stream: this.stream,
          ...params
        },
      });
    } catch (error) {
      return error;
    }
  }
}

export default PersonaClick;
