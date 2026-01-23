/**
 * Axios data
 *
 * @param {string} url
 * @param {Object} options
 * @param {string} [options.method] - Request method ( GET, POST, PUT, ... ).
 * @param {string} [options.payload] - Request body.
 * @param {Object} [options.headers]
 * @param {Object} [options.params] - Request params.
 *
 * @returns {Promise}
 *
 */

import axios                   from "axios";
import AsyncStorage            from "@react-native-async-storage/async-storage";
import { Platform }            from 'react-native';
import { version }             from "../package.json";
import { SESSION_CODE_EXPIRE } from "../index";
import { SDK_API_URL }         from "../index";
import { DEBUG }               from "../MainSDK";
import DataEncoder             from "./utils";
import { getStorageKey }       from '../utils';

const encoder = new DataEncoder();

/**
 * Retrieves the locker state for push notifications initialization.
 *
 * @param {string} shop_id - The shop identifier.
 * @returns {Promise<Object|Error>} A promise that resolves to the locker state object or an error.
 */
export const initLocker = async (shop_id) => {
  try {
    return JSON.parse(await AsyncStorage.getItem(getStorageKey('push_init', shop_id))) ?? {}
  } catch (error) {
    return error;
  }
};

/**
 * Sets the locker state for push notifications initialization.
 *
 * @param {boolean} val - The state to set (true or false).
 * @param {string} shop_id - The shop identifier.
 * @returns {Promise<void|Error>} A promise that resolves to nothing or an error in case of failure.
 */
export async function setInitLocker(val, shop_id) {
  try {
    const data = {
      'state': val,
      'expires': (new Date()).getTime() + 1000
    }
    return await AsyncStorage.setItem(getStorageKey('push_init', shop_id), JSON.stringify(data));
  } catch (error) {
    if (DEBUG) console.error(error);
    return error;
  }
}

/**
 * Retrieves the date when the push token was last sent.
 * @returns {Promise<Date|null|Error>} A promise that resolves to the date when the push token was last sent, or null if not found. Returns an error in case of failure.
 */
export const getLastPushTokenSentDate = async (shop_id) => {
  try {
    const savedDate = await AsyncStorage.getItem(getStorageKey('push_token_last_sent_date', shop_id));
    return savedDate ? new Date(savedDate) : null;
  } catch (error) {
    return error;
  }
}

/**
 * Saves the date when the push token was last sent.
 * @param {Date} date - The date to be saved.
 * @param {string} shop_id - The ID of the shop.
 * @returns {Promise<void|Error>} A promise that resolves to nothing on success or an error in case of failure.
 */
export const saveLastPushTokenSentDate = async (date, shop_id) => {
  try {
    if (!(date instanceof Date) || isNaN(date)) {
      throw new TypeError('The provided argument is not a valid Date object.');
    }
    await AsyncStorage.setItem(getStorageKey('push_token_last_sent_date', shop_id), date.toISOString());
  } catch (error) {
    return error;
  }
}

/**
 * Retrieves the saved push token.
 *
 * @param {string} shop_id - The shop identifier.
 * @returns {Promise<string|null|Error>} A promise that resolves to the saved push token, or null if not found, or an error in case of failure.
 */
export const getSavedPushToken = async (shop_id) => {
  try {
    return await AsyncStorage.getItem(getStorageKey('push_token', shop_id));
  } catch (error) {
    return error;
  }
}

/**
 * Saves the push token.
 *
 * @param {string} token - The push token to save.
 * @param {string} shop_id - The shop identifier.
 * @returns {Promise<void|Error>} A promise that resolves to nothing on success or an error in case of failure.
 */
export async function savePushToken(token, shop_id) {
  try {
    return await AsyncStorage.setItem(getStorageKey('push_token', shop_id), token);
  } catch (error) {
    return error;
  }
}


/**
 * Retrieves the stored data for a given shop.
 *
 * @param {string} shop_id - The shop identifier.
 * @returns {Promise<Object|Error>} A promise that resolves to the stored data or an error.
 */
export const getData = async (shop_id) => {
  try {
    return JSON.parse(await AsyncStorage.getItem(getStorageKey('', shop_id))) ?? {};
  } catch (error) {
    return error;
  }
};


/**
 * Updates the session seance for a given shop.
 *
 * @param {string} shop_id - The shop identifier.
 * @param {string} [did] - The device identifier.
 * @param {string} [seance] - The session identifier.
 * @returns {Promise<void|Error>} A promise that resolves to nothing on success or an error in case of failure.
 */
export async function updSeance(shop_id, did = '', seance = '') {
  try {
    const data = await getData(shop_id);
    if (did.length > 0) {
      data.did = did;
    }
    data.expires = (new Date()).getTime() + SESSION_CODE_EXPIRE * 60 * 1000;
    if (seance.length > 0) {
      data.seance = seance;
      data.sid = seance;
    }
    return await AsyncStorage.setItem(getStorageKey('', shop_id), JSON.stringify(data));
  } catch (error) {
    if (DEBUG) console.error(`Update seance error `, error);
    return error;
  }
}

/**
 * Generates a session identifier (SID).
 * React Native compatible version (no Buffer dependency).
 *
 * @returns {string} The generated SID.
 */
export function generateSid() {
  // Generate random alphanumeric string (React Native compatible)
  // Using Math.random() and base36 encoding which is available in React Native
  const randomPart1 = Math.random().toString(36).substring(2, 7)
  const randomPart2 = Math.random().toString(36).substring(2, 7)
  const timestamp = Date.now().toString(36).substring(0, 3)
  
  // Combine and take first 10 characters
  const sid = (randomPart1 + randomPart2 + timestamp)
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 10)
    .padEnd(10, Math.random().toString(36).substring(2))

  return sid
}

/**
 * Sends a request to the API.
 *
 * @param {string} url - The API endpoint URL.
 * @param {string} shop_id - The shop identifier.
 * @param {Object} [options] - The request options.
 * @returns {Promise<Object|Error>} A promise that resolves to the API response or an error.
 */
export async function request(url, shop_id, options = {}) {
  const config = {
    method: options?.method || "GET",
    ...options,
    params: options?.params || {},
  };
  const URL = `${SDK_API_URL}${url}`;
  const storageData = await getData(shop_id);
  const errors = [];

  if (storageData?.did) {
    config.params.did = storageData.did;
  }
  if (storageData?.seance && storageData?.expires && (new Date()).getTime() < storageData?.expires) {
    config.params.seance = storageData?.seance;
    config.params.sid = storageData?.seance;
  } else if (url !== 'init') {
    const generatedSid = generateSid();

    config.params.sid = generatedSid;
    config.params.seance = generatedSid;
  }

  if (!url) {
    errors.push("url");
  }

  if (errors.length) {
    throw new Error(`Error! You must pass \`${errors.join("`, `")}\``);
  }

  let UserAgent = 'ReactNative ';
  UserAgent += Platform.OS === 'android' ? 'Android' : 'iOS';
  UserAgent += " SDK v" + version;

  const headers = {
    "Content-Type": config.headers && config.headers.hasOwnProperty('Content-Type') ? config.headers['Content-Type'] : "application/x-www-form-urlencoded",
    "User-Agent": UserAgent,
    ...config.headers,
  };

  const encodeString = encoder.encode(config.params);

  const params = {
    headers,
    method: config.method,
    params: headers['Content-Type'] === 'application/x-www-form-urlencoded' ? options?.method === 'POST' ? config.params : encoder.convertToObject(encodeString) : url === 'segments/get' ? config.params : '',
    data: headers['Content-Type'] === 'application/x-www-form-urlencoded' ? config.payload : config.params,
  };

  if (params.data === undefined) delete params.data;

  if (DEBUG) console.log(`Request: ${URL} `, params);
  return axios({
    url: URL,
    ...params,
  })
    .then(async (response) => {
      if (response?.data.status >= 400) {
        throw response.data;
      }
      await updSeance(shop_id);
      return response.data;
    })
    .catch((error) => {
      if (DEBUG) {
        if (error.response) {
          console.error(`Request error: `, error.response.data);
        } else {
          console.error(`Request error `, error);
        }
      }
      return error;
    });
}

/**
 * @param {string|null} messageId
 * @param {string} shop_id - The ID of the shop.
 * @returns {Promise<{ data: Data }[]>}
 */
export async function getPushData(messageId = null, shop_id) {
  try {
    const pushData = JSON.parse(await AsyncStorage.getItem(getStorageKey('push', shop_id))) ?? [];
    return messageId ? pushData.filter(x => x.messageId === String(messageId)) : pushData
  } catch (error) {
    return error;
  }
};

/**
 * Updates push data for a given shop.
 *
 * @param {Object} data - The push data to update.
 * @param {string} shop_id - The shop identifier.
 * @returns {Promise<void|Error>} A promise that resolves to nothing on success or an error in case of failure.
 */
export async function updPushData(data, shop_id) {
  try {
    let pushData = await getPushData(null, shop_id);
    pushData = pushData.length > 0 ? pushData.filter(x => x.sentTime > (new Date()).getTime() - 604800 * 1000) : []; //
    if (pushData.length > 0 && pushData.findIndex(x => x.messageId === data.messageId) > -1) {
      let payloadId = pushData.findIndex(x => x.messageId === data.messageId);
      pushData[payloadId] = Object.assign(pushData.find(x => x.messageId === data.messageId), data);
    } else {
      pushData.push(data);
    }
    return await AsyncStorage.setItem(getStorageKey('push', shop_id), JSON.stringify(pushData));
  } catch (error) {
    if (DEBUG) console.error(`Error: `, error);
    return error;
  }
}

/**
 * Removes a push message for a given shop by message ID.
 *
 * @param {string} messageId - The message ID.
 * @param {string} shop_id - The shop identifier.
 * @returns {Promise<void|Error>} A promise that resolves to nothing on success or an error in case of failure.
 */
export async function removePushMessage(messageId, shop_id) {
  try {
    let pushData = await getPushData(null, shop_id);
    if (pushData.length > 0 && pushData.findIndex(x => x.messageId === messageId) > -1) {
      let payloadId = pushData.findIndex(x => x.messageId === messageId);
      pushData.splice(payloadId, 1);
    }
    return await AsyncStorage.setItem(getStorageKey('push', shop_id), JSON.stringify(pushData));
  } catch (error) {
    if (DEBUG) console.error(`Error: `, error);
    return error;
  }
}
