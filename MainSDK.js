import { AndroidNotificationSetting } from '@notifee/react-native';
import { Linking }                    from 'react-native';
import {
  initLocker,
  request,
  setInitLocker,
  updSeance,
  getPushData,
  updPushData,
  removePushMessage,
  getData,
  generateSid,
  getSavedPushToken,
  savePushToken,
  getLastPushTokenSentDate,
  saveLastPushTokenSentDate
} from './lib/client';
import { convertParams } from './lib/tracker';
import {AppState, PermissionsAndroid, Platform} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import PushNotification from "react-native-push-notification";
import PushNotificationIOS from "@react-native-community/push-notification-ios";
import {SDK_PUSH_CHANNEL} from "./index";
import Performer from './lib/performer';
import notifee from '@notifee/react-native'
import DeviceInfo from 'react-native-device-info';
import {isOverOneWeekAgo} from './utils';

/**
 * @typedef {Object} Event
 * @property {string} type
 * @property {string} uri
 */

/**
 * @typedef {Object} GoogleData
 * @property {string} message_id
 */

/**
 * @typedef {Object} Data
 * @property {string} message_id
 * @property {string} from
 * @property {number} ttl
 * @property {number} sentTime
 * @property {string} id
 * @property {string | undefined} event
 * @property {string} type
 * @property {GoogleData} google
 */

/**
 * @typedef {Object} Notification
 * @property {Data} [data]
 * @property {boolean} userInteraction
 * @property {boolean} foreground
 * @property {string} channelId
 * @property {string} id
 * @property {string} message
 * @property {string} title
 */

export var DEBUG = false;

class MainSDK  extends Performer {
  constructor(shop_id, stream, debug = false, autoSendPushToken = true) {
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
    this.autoSendPushToken = autoSendPushToken;
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

        updSeance(response?.did, response?.seance).then(async ()=>{
          this.initialized = true;
          this.performQueue();
          this.push((async () => {
            await this.initPush();
          }))
          if (this.isInit() && this.autoSendPushToken) {
            await this.sendPushToken();
          }
        });
      } catch (error) {
        this.initialized = false;
        return error;
      }
    })();
  }

  isInit = () => this.initialized;

  /**
   * @param {import('@react-native-firebase/messaging').RemoteMessage} remoteMessage
   * @returns {Promise<void>}
   */
  pushReceivedListener = async function (remoteMessage) {
    await this.showNotification(remoteMessage);
  };

  /**
   * @param {import('@react-native-firebase/messaging').RemoteMessage} remoteMessage
   * @returns {Promise<void>}
   */
  pushBgReceivedListener = async function (remoteMessage) {
    await this.showNotification(remoteMessage);
  };

  /**
   *
   * @param {Omit<import('react-native-push-notification').ReceivedNotification, 'userInfo'>} remoteMessage
   * @returns {Promise<void>}
   */
  pushClickListener = async function (remoteMessage) {
    await this.onClickPush(remoteMessage);
  };

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

  /**
   * Track user clicked/tapped on notification
   * @param {NotificationEventOptions} options
   */
  notificationClicked(options) {
    return this.notificationTrack('clicked', options);
  }

  /**
   * Track notification shown to user
   * @param {NotificationEventOptions} options
   */
  notificationOpened(options) {
    return this.notificationTrack('opened', options);
  }

  /**
   * Track notification delivered to user device
   * @param {NotificationEventOptions} options
   */
  notificationDelivered(options) {
    return this.notificationTrack('delivered', options);
  }

  /**
   * Send notification track
   * @param {'opened' | 'clicked' | 'delivered'} event
   * @param {{ type: 'bulk' | 'chain' | 'transactional' | string, code: string }} options
   */
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

  cart() {
    return new Promise((resolve, reject) => {
      this.push((() => {
        try {
          request('products/cart', {
            params: {
              shop_id: this.shop_id,
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

  /**
   * Checks if the last sent date of the push token is over one week ago and if push permissions should be asked.
   * @returns {Promise<boolean>} A promise that resolves to true if a new token needs to be sent, false otherwise.
   */
  async checkPushToken() {
      const lastSentDate = await getLastPushTokenSentDate();
      return !lastSentDate || isOverOneWeekAgo(lastSentDate) && this._ask_push_permissions;
  }

  /**
   * Sends a new push token if permissions are granted.
   * @returns {Promise<void>} A promise that resolves when the token sending process is complete.
   */
  async sendPushToken() {
    try {
      if (await this.checkPushToken()) {
        this.push((async () => {
          if (await this.getPushPermission()) {
            this.initPushChannel();
            await this.initPushToken(false);
            await saveLastPushTokenSentDate(new Date());
          }
        }));
      }
    } catch (error) {
      console.error('Error sending token:', error);
    }
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
        }).then(async (data)=> {
          if (data.status === "success") {
            await savePushToken(token);
            await saveLastPushTokenSentDate(new Date());
          }
          return data;
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
    let result = false;
    if(Platform.OS ==="android" && Platform.Version >= 33){
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS ? PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS : PermissionsAndroid.PERMISSIONS.POST_NOTIFICATION
        );
        result = granted === PermissionsAndroid.RESULTS.GRANTED;
        const settings = await notifee.getNotificationSettings()
        if (settings.android.alarm === AndroidNotificationSetting.DISABLED) {
          await notifee.openAlarmPermissionSettings()
        }
      } catch (err){
        console.log(err);
      }
    } else {
      const authStatus = await messaging().requestPermission();
      result =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    }
    return result;
  }

  async initPushToken(removeOld = false) {
    let savedToken = await getSavedPushToken();
    if (removeOld) {
      await this.deleteToken();
      savedToken = false;
    }
    if (savedToken) return savedToken;
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

  /**
   * Init push
   * @param {boolean | Function} notifyClick
   * @param {boolean | Function} notifyReceive
   * @param {boolean | Function} notifyBgReceive
   * @returns {Promise<boolean>}
   */
  async initPush(notifyClick = false, notifyReceive = false, notifyBgReceive = false)
  {
    const lock = await initLocker();
    if ((lock && lock.hasOwnProperty('state') && lock.state === true && ((new Date()).getTime() < lock.expires ) )) return false;
    await setInitLocker(true);

    if (this._ask_push_permissions) {
      this.push((async () => {
        if ( await this.getPushPermission() ) {
          this.initPushChannel();
          await this.initPushToken(false);
        }
      }));
    }
    if (notifyClick) this.pushClickListener = notifyClick;
    if (notifyReceive) this.pushReceivedListener = notifyReceive;
    if (notifyBgReceive) this.pushBgReceivedListener = notifyBgReceive;

    // Register handler
    messaging().onMessage(async remoteMessage => {
      if (this.lastMessageIds.includes(remoteMessage.messageId)){
        return false
      } else {
        this.lastMessageIds.push(remoteMessage.messageId);
      }

      await this.notificationDelivered({
        code: remoteMessage.data.id,
        type: remoteMessage.data.type
      })
      if (DEBUG) console.log('Message delivered: ', remoteMessage);

      await updPushData(remoteMessage);
      await this.pushReceivedListener(remoteMessage);
    });

    // Register background handler
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      if (this.lastMessageIds.includes(remoteMessage.messageId)){
        return false
      } else {
        this.lastMessageIds.push(remoteMessage.messageId);
      }

      await this.notificationDelivered({
        code: remoteMessage.data.id,
        type: remoteMessage.data.type
      })
      if (DEBUG) console.log('Background message delivered: ', remoteMessage);

      await updPushData(remoteMessage);
      await this.pushBgReceivedListener(remoteMessage);
    });

    /** Subscribe to click notification */
    PushNotification.configure({
      popInitialNotification: true,
      requestPermissions: true,
      onNotification: async (notification) => {
        await updPushData(notification);
        if (notification?.userInteraction === true) {
          if (!notifyClick) {
            await this.pushClickListener(notification)
          } else {
            const data = await getPushData(notification.data.message_id)
            await this.pushClickListener(data && data.length > 0 ? data[0] : false)
          }
        }
        notification.finish(PushNotificationIOS.FetchResult.NoData);
      }
    });
    PushNotification.popInitialNotification(async (notification) => {
      if (!notification) return;

      await this.pushClickListener(notification);
    });

  }

  /**
   * Show push notification to user
   * @param {{ data: { id: string, type: string }}} message
   * @returns {Promise<void>}
   */
  async showNotification (message){
    if (DEBUG) console.log('Show notification: ', message);
    await updPushData(message);
    await this.notificationOpened({
      code: message.data.id,
      type: message.data.type
    });

    /** @type {import('react-native-push-notification').PushNotificationScheduleObject} */
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
      if (DEBUG) console.log('Background: ', message);
      localData['date'] = new Date(Date.now() + (5 * 1000));
      return PushNotification.localNotificationSchedule(localData)
    } else {
      if (DEBUG) console.log('Foreground: ', message);
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
  async deleteToken(){
    return savePushToken(false).then(async () => {
      await messaging().deleteToken();
    });
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

  /**
   * @param {import('react-native-push-notification').ReceivedNotification} [notification]
   * @returns {Promise<boolean | Error | void>}
   */
  async onClickPush (notification) {
    const messageId = notification.data.message_id || notification.data['google.message_id'];
    let pushData = await getPushData(messageId);
    if (pushData.length === 0) return false;

    await removePushMessage(messageId);
    this.notificationClicked({
      code: notification?.data?.id,
      type: notification?.data?.type
    });

    const event = pushData[0].data.event;
    if (!event) return false;

    /** @type {Event | null} */
    const message_event = JSON.parse(event);
    let message_url = '';
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
