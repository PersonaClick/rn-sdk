import {
  initLocker,
  request,
  setInitLocker,
  updSeance,
  getPushData,
  updPushData,
  removePushMessage,
  getData,
  generateSid
} from './lib/client';
import { convertParams } from './lib/tracker';
import {AppState, Platform} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import PushNotification from "react-native-push-notification";
import PushNotificationIOS from "@react-native-community/push-notification-ios";
import {SDK_PUSH_CHANNEL} from "./index";
import Performer from './lib/performer';
import DeviceInfo from 'react-native-device-info';

export var DEBUG = false;

class MainSDK  extends Performer {
  constructor(shop_id, stream, debug = false) {
    let queue = [];
    super(queue);
    this.shop_id = shop_id;
    this.stream = stream ?? null;
    this.initialized = false;
    DEBUG = debug;
    this._push_type = null;
    this._ask_push_permissions = true;
    this.push_payload = [];
    this.lastMessageIds = [];
  }

  perform(command) {
    command();
  }

  init() {
    (async () => {
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
        const storageData = await getData();
        let response = null;

        if ( storageData?.did ) {
          response = storageData;
          if ( !storageData?.seance || !storageData?.expires || (new Date()).getTime() > storageData?.expires ) {
            response.sid = response.seance = generateSid();
          }
        } else {
          response = await request('init', {
            params: {
              did: Platform.OS === 'android' ? await DeviceInfo.getAndroidId() : await DeviceInfo.syncUniqueId() || '',
              shop_id: this.shop_id,
              stream: this.stream,
            },
          });
        }

        updSeance(response?.did, response?.seance).then(()=>{
          this.initialized = true;
          this.performQueue();
        });
      } catch (error) {
        this.initialized = false;
        return error;
      }
    })();
  }

  isInit = () => this.initialized;

  track(event, options) {
    this.push((async () => {
      try {
        const queryParams = await convertParams(event, options);
        return await request('push', {
          headers: {"Content-Type": "application/json"},
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
    }));
  }

  trackEvent(event, options) {
    this.push((async () => {
      try {
        let queryParams = {event: event};
        if (options) {
          queryParams = Object.assign(queryParams, options);
        }

        return await request('push/custom', {
          headers: {"Content-Type": "application/json"},
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
    }));
  }

  notificationClicked(options) {
    return this.notificationTrack('clicked', options);
  }
  notificationReceived(options) {
    return this.notificationTrack('received', options);
  }

  notificationTrack(event, options) {
    this.push((async () => {
      try {
        return await request(`track/${event}`, {
          method: 'POST',
          headers: {"Content-Type": "application/json"},
          params: {
            shop_id: this.shop_id,
            stream: this.stream,
            ...options,
          },
        });
      } catch (error) {
        return error;
      }
    }));
  }

  recommend(recommender_code, options) {
    return new Promise((resolve, reject) => {
      this.push((() => {
        try {
          request(`recommend/${recommender_code}`, {
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
              recommender_code,
              ...options,
            },
          }).then( res => {
            resolve(res)
          });
        } catch (error) {
          reject(error)
        }
      }));
    })
  }

  search(options) {
    return new Promise((resolve, reject) => {
      this.push((() => {
        try {
          request('search', {
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
              ...options,
            },
          }).then( res => {
            resolve(res);
          });
        } catch (error) {
          reject(error)
        }
      }))
    })
  }

  setProfile(params) {
    this.push((async () => {
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
          headers: {"Content-Type": "application/json"},
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
    }));
  }
  getProfile() {
    return new Promise((resolve, reject) => {
      this.push((() => {
        try {
          request('profile', {
            method: 'GET',
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
            },
          }).then( res =>{
            resolve(res);
          });
        } catch (error) {
          reject(error);
        }
      }))
    });
  }

  setPushTokenNotification(token) {
    this.push((async () => {
      try {
        const params = {
          token: token,
          platform: this._push_type !== null ? this._push_type : token.match(/[a-z]/) !== null ? 'android' : 'ios',
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
    }));
  }
  firebase_only(val) {
    this._push_type = val ? 'android' : null;
  }

  askPushPermissions(val = true) {
    this._ask_push_permissions = val;
  }

  async getPushPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    return enabled;
  }

  initPushToken(removeOld = false) {
    if (removeOld) this.deleteToken();
    if (this._push_type === null && Platform.OS === 'ios') {
      messaging()
        .getAPNSToken()
        .then(token => {
          if (DEBUG) console.log('New APN token: ', token);
          this.setPushTokenNotification(token);
        });
    } else {
      messaging()
        .getToken()
        .then(token => {
          if (DEBUG) console.log('New FCM token: ', token);
          this.setPushTokenNotification(token);
        });
    }
  }

  initPushChannel () {
    PushNotification.channelExists(SDK_PUSH_CHANNEL, function (exists) {
      if (!exists) {
        PushNotification.createChannel(
          {
            channelId: SDK_PUSH_CHANNEL,
            channelName: 'RNSDK channel',
          }
        );
      }
    });
  }

  async initPush(notifyClick = false, notifyReceive = false, notifyBgReceive = false)
  {
    const lock = await initLocker();
    if ((lock && lock.hasOwnProperty('state') && lock.state === true && ((new Date()).getTime() < lock.expires ) )) return false;
    await setInitLocker(true);

    if (this._ask_push_permissions) {
      this.push((async () => {
        if ( await this.getPushPermission() ) {
          this.initPushChannel();
          this.initPushToken(true);
        }
      }));
    }

    // Register handler
    messaging().onMessage(async remoteMessage => {
      if (this.lastMessageIds.includes(remoteMessage.messageId)){
        return false
      } else {
        this.lastMessageIds.push(remoteMessage.messageId);
      }
      if (DEBUG) console.log('Message received: ', remoteMessage);
      await updPushData(remoteMessage);
      if (!notifyReceive) {
        await this.showNotification(remoteMessage);
      } else {
        notifyReceive(remoteMessage);
      }
    });

    // Register background handler
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      if (this.lastMessageIds.includes(remoteMessage.messageId)){
        return false
      } else {
        this.lastMessageIds.push(remoteMessage.messageId);
      }
      if (DEBUG) console.log('Background message received: ', remoteMessage);;
      await updPushData(remoteMessage);
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
      onNotification: async (notification) => {
        await updPushData(notification);
        if (notification?.userInteraction === true) {
          if (!notifyClick) {
            this.onClickPush(notification);
          } else {
            getPushData(notification.data.message_id).then(data => {
              notifyClick(data);
            })

          }
        }
        notification.finish(PushNotificationIOS.FetchResult.NoData);
      }
    });
    PushNotification.popInitialNotification((notification) => {
      if (notification) this.onClickPush(notification);
    });

  }
  async showNotification (message){
    if (DEBUG) console.log('Show notification: ', message);
    updPushData(message);
    await this.notificationReceived({
      code: message.data.id,
      type: message.data.type
    });

    let localData = {
      channelId: SDK_PUSH_CHANNEL,
      largeIconUrl: message.data.icon,
      bigLargeIconUrl: message.data.icon,
      bigPictureUrl: message.data.image,
      picture: message.data.image,
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

  triggers(trigger_name, data) {
    this.push((async () => {
      try {
        return await request(`subscriptions/${trigger_name}`, {
          headers: {"Content-Type": "application/json"},
          method: 'POST',
          params: Object.assign({
            shop_id: this.shop_id,
            stream: this.stream,
          }, data),
        });
      } catch (error) {
        return error;
      }
    }));
  }
  deleteToken(){
    messaging().deleteToken();
  }
  subscriptions(action, data) {
    this.triggers(action, data)
  }
  segments(action, data) {
    return new Promise((resolve, reject) => {
      this.push((() => {
        try {
          request(`segments/${action}`, {
            headers: {"Content-Type": "application/json"},
            method: action === 'get' ? 'GET' : 'POST',
            params: Object.assign({
              shop_id: this.shop_id,
              stream: this.stream,
            }, data),
          }).then(res => {
            resolve(res)
          });
        } catch (error) {
          reject(error)
        }
      }));
    })
  }
  async onClickPush (notification) {
    const messageId = notification.data.message_id || notification.data['google.message_id'];
    let pushData = await getPushData(messageId);
    if ( pushData.length === 0 || !pushData[0].data.event) {
      return false;
    }
    await removePushMessage(messageId);
    this.notificationClicked({
      code: notification?.data?.id,
      type: notification?.data?.type
    });
    let message_event = JSON.parse(pushData[0].data.event),
      message_url = '';
    switch (message_event.type) {
      case "web":
        message_url = message_event.uri;
        break;
      case "product":
        try {
          await request(`products/get?item_id=${message_event.uri}&shop_id=${this.shop_id}`, {
            method: 'GET',
            headers: {"Content-Type": "application/json"},
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
            },
          }).then(data => {
            message_url = data.url
          });

        } catch (error) {
          return error;
        }
        break;
      case "category":
        try {
          await request(`category/${message_event.uri}?shop_id=${this.shop_id}`, {
            method: 'GET',
            headers: {"Content-Type": "application/json"},
            params: {
              shop_id: this.shop_id,
              stream: this.stream,
            },
          }).then(data => {
            message_url = data.categories.find(x => x.id === message_event.uri).url;
          });
        } catch (error) {
          return error;
        }
        break;
    }

    const supported = await Linking.openURL(message_url);
    if (supported) {
      await Linking.openURL(message_url);
    } else {
      console.log(`error open URL: ${message_url}`);
    }
  }
}

export default MainSDK;
