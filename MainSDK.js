import {request, updSeance} from './lib/client';
import { convertParams } from './lib/tracker';
import {AppState, Platform} from 'react-native';

import messaging from '@react-native-firebase/messaging';
import PushNotification from "react-native-push-notification";
import PushNotificationIOS from "@react-native-community/push-notification-ios";
import {SDK_PUSH_CHANNEL} from "./index";
export var DEBUG = false;

class MainSDK {
  constructor(shop_id, stream, debug = false) {
    this.channel_id = SDK_PUSH_CHANNEL;
    this.shop_id = shop_id;
    this.stream = stream ?? null;
    this.initialized = false;
    DEBUG = debug;
    this.push_type = null;
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
        headers: { "Content-Type": "application/json" },
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

  async trackEvent(event, options) {
    try {
      let queryParams = { event: event };
      if (options) {
        queryParams = Object.assign(queryParams, options);
      }

      return await request('push/custom', {
        headers: { "Content-Type": "application/json" },
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
    return await this.notificationTrack('clicked', options);
  }
  async notificationReceived(options) {
    return await this.notificationTrack('received', options);
  }

  async notificationTrack(event, options) {
    try {
      return await request(`track/${event}`, {
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
        platform: this.push_type !== null ? this.push_type : token.match(/[a-z]/) !== null  ? 'android' : 'ios',
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
  firebase_only(val) {
    this.push_type = val ? 'android' : null;
  }
  async initPush(notifyClick, notifyReceive, notifyBgReceive)
  {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      messaging()
        .getToken()
        .then(token => {
          if (DEBUG) console.log('New token: ', token);
          this.setPushTokenNotification(token);
        });

      // Register handler
      messaging().onMessage(async remoteMessage => {
        if (DEBUG) console.log('Message received: ', remoteMessage);
        if (!notifyReceive) {
          await this.showNotification(remoteMessage);
        } else{
          notifyReceive(remoteMessage);
        }
      });

      // Register background handler
      messaging().setBackgroundMessageHandler(async remoteMessage => {
        if (DEBUG) console.log('Background message received: ', remoteMessage);

        if (!notifyReceive && !notifyBgReceive) {
          await this.showNotification(remoteMessage);
        } else if (!notifyBgReceive) {
          notifyReceive(remoteMessage);
        } else {
          notifyBgReceive(remoteMessage);
        }
      });

      //Subscribe to click  notification
      PushNotification.configure({
        popInitialNotification: true,
        requestPermissions: true,
        onNotification: (notification) => {
          if (notification?.userInteraction === true) {
            if (!notifyClick) {
              this.notificationClicked({
                code: notification?.data?.id,
                type: notification?.data?.type
              });
            } else {
              let eventData = {
                data: {
                  body: notification.message,
                  icon: notification.data.icon,
                  id: notification.data.id,
                  image: notification.data.image,
                  title: notification.title,
                  type: notification.data.type,
                },
                from: notification.data.from,
                messageId: notification.data.message_id,
                sentTime: notification.data.sentTime,
                ttl: notification.data.ttl,
              };
              notifyClick(eventData);
            };
          };
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      });

      PushNotification.channelExists(this.channel_id, function (exists) {
        if (!exists) {
          PushNotification.createChannel(
            {
              channelId: 'personaclick-push',
              channelName: 'pcsdk channel',
            }
          );
        }
      });
    }
  }
  async showNotification (message){
    if (DEBUG) console.log('Show notification: ', message);

    await this.notificationReceived({
      code: message.data.id,
      type: message.data.type
    });

    let localData = {
      channelId: this.channel_id,
      largeIconUrl: message.data.icon,
      bigLargeIconUrl: message.data.icon,
      bigPictureUrl: message.data.image,
      picture: message.data.icon,
      title: message.data.title,
      message: message.data.body,
      userInfo: {
        message_id: message.messageId,
        id: message.data.id,
        type: message.data.type,
        icon: message.data.icon,
        image: message.data.image,
        from: message.from,
        sentTime: message.sentTime,
        ttl: message.ttl,
      }
    }

    if (AppState.currentState === 'background') {
      localData['date'] = new Date(Date.now() + (5 * 1000));
      return PushNotification.localNotificationSchedule(localData)
    } else {
      return PushNotification.localNotification(localData);
    }
  }

  async triggers(trigger_name, data) {
    try {
      return await request(`subscriptions/${trigger_name}`, {
        headers: { "Content-Type": "application/json" },
        method: 'POST',
        params: Object.assign({
          shop_id: this.shop_id,
          stream: this.stream,
        }, data),
      });
    } catch (error) {
      return error;
    }
  }
}

export default MainSDK;
