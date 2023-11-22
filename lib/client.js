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

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DeviceInfo  from 'react-native-device-info';
import { Platform } from 'react-native';
import { version } from "../package.json";
import {SESSION_CODE_EXPIRE, SDK_API_URL, SDK_STORAGE_NAME} from "../index";
import {DEBUG} from "../MainSDK";
import DataEncoder from "./utils";
import {Buffer} from 'buffer';

const encoder = new DataEncoder();

export const initLocker = async () => {
  try {
    return JSON.parse(await AsyncStorage.getItem(SDK_STORAGE_NAME + '_push_init')) ?? {}
  } catch (error) {
    return error;
  }
};
export async function setInitLocker (val) {

  try {
    const data = {
      'state': val,
      'expires': (new Date()).getTime() + 1000
    }
    return await AsyncStorage.setItem(SDK_STORAGE_NAME + '_push_init', JSON.stringify(data));
  } catch (error) {
    if (DEBUG) console.error(error);
    return error;
  }
}
export const getSavedPushToken = async () => {
  try {
    return await AsyncStorage.getItem(SDK_STORAGE_NAME + '_push_token');
  } catch (error) {
    return error;
  }
}
export async function savePushToken (token) {
  try {
    return await AsyncStorage.setItem(SDK_STORAGE_NAME + '_push_token', token);
  } catch (error) {
    return error;
  }
}
export const getData = async () => {
  try {
    return JSON.parse(await AsyncStorage.getItem(SDK_STORAGE_NAME)) ?? {};
  } catch (error) {
    return error;
  }
};

/*
  Обновляем время жизни seance;
 */
export async function updSeance (did = '', seance = '') {

  try {
    const data = await getData();
    if (did.length > 0) {
      data.did = did;
    }
    data.expires = (new Date()).getTime() + SESSION_CODE_EXPIRE * 60 * 1000;
    if (seance.length > 0) {
      data.seance = seance;
      data.sid = seance;
    }
    return await AsyncStorage.setItem(SDK_STORAGE_NAME, JSON.stringify(data));
  } catch (error) {
    if (DEBUG) console.error(`Update seance error `, error);
    return error;
  }
}
export function generateSid () {
  const Buffer = require("buffer").Buffer;
  return new Buffer(String(Math.random())).toString("base64").replaceAll('=').substring(0, 10);
}
export async function request(url, options = {}) {
  const config = {
    method: options?.method || "GET",
    ...options,
  };
  const URL = `${SDK_API_URL}${url}`;
  const storageData = await getData();
  const errors = [];

  if (storageData?.did) {
    config.params.did = storageData.did;
  }
  if (storageData?.seance && storageData?.expires && (new Date()).getTime() < storageData?.expires ) {
    config.params.seance = storageData?.seance;
    config.params.sid = storageData?.seance;
  } else if (url !== 'init') {
    response.sid = response.seance = generateSid();
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
    params: headers['Content-Type'] === 'application/x-www-form-urlencoded' ? options?.method === 'POST' ? config.params : encoder.convertToObject(encodeString) :  url === 'segments/get' ? config.params : '',
    data: headers['Content-Type'] === 'application/x-www-form-urlencoded' ? config.payload : config.params,
  };

  if (params.data === undefined) delete params.data;

  if (DEBUG) console.log(`Request: ${URL} `, params);
  return axios({
    url: URL,
    ...params,
  })
    .then(async (response) =>  {
      if (response?.data.status >= 400) {
        throw response.data;
      }
      await updSeance();
      return response.data;
    })
    .catch((error) => {
      if (DEBUG)  {
        if (error.response) {
          console.error(`Request error: `, error.response.data);
        } else {
          console.error(`Request error `, error);
        }
      }
      return error;
    });
}
export async function getPushData (messageId = null) {
  try {
    const pushData = JSON.parse(await AsyncStorage.getItem(SDK_STORAGE_NAME + '_push')) ?? [];
    return messageId ? pushData.filter(x => x.messageId === String(messageId)) : pushData
  } catch (error) {
    return error;
  }
};

export async function updPushData (data) {
  try {
    let pushData = await getPushData();
    pushData = pushData.length > 0 ? pushData.filter( x => x.sentTime > (new Date()).getTime() - 604800 * 1000 ) : []; //
    if ( pushData.length > 0 && pushData.findIndex( x => x.messageId === data.messageId) > -1 ) {
      let payloadId = pushData.findIndex( x => x.messageId === data.messageId) ;
      pushData[payloadId] = Object.assign( pushData.find( x => x.messageId === data.messageId), data );
    } else {
      pushData.push(data);
    }
    return await AsyncStorage.setItem(SDK_STORAGE_NAME + '_push', JSON.stringify(pushData));
  } catch (error) {
    if (DEBUG) console.error(`Error: `, error);
    return error;
  }
}

export async function removePushMessage (messageId) {
  try {
    let pushData = await getPushData();
    if ( pushData.length > 0 && pushData.findIndex( x => x.messageId === messageId) > -1 ) {
      let payloadId = pushData.findIndex( x => x.messageId === messageId) ;
      pushData.splice(payloadId, 1);
    }
    return await AsyncStorage.setItem(SDK_STORAGE_NAME + '_push', JSON.stringify(pushData));
  } catch (error) {
    if (DEBUG) console.error(`Error: `, error);
    return error;
  }
}
