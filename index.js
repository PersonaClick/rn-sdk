import AsyncStorage from '@react-native-async-storage/async-storage';

import {request} from './lib/сlient';


class PersonalClick {
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
      
      if (response?.did && response?.seance) {
        const data = {
          did: response?.did,
          seance: response?.seance,
        };

        this.initialized = true;

        try {
          await AsyncStorage.setItem('@personalClick', JSON.stringify(data));
        } catch (error) {
          return error;
        }
      } else {
        this.initialized = false;
      }
    } catch (error) {
      this.initialized = false;
      return error;
    }
  }

  isInit = () => this.initialized;

  async track(event, options) {
    try {
      return await request('push', {
        method: 'POST',
        params: {
          shop_id: this.shop_id,
          stream: this.stream,
          event,
          ...options,
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
}

export default PersonalClick;
