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

const encoder = new DataEncoder();

const getData = async () => {
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
    data.did = did;
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

export async function request(url, options = {}) {
  const config = {
    method: options?.method || "GET",
    ...options,
  };
  const URL = `${SDK_API_URL}${url}`;
  const storageData = await getData();
  const errors = [];

  config.params.did = storageData.did || ( Platform.OS === 'android' ? await DeviceInfo.getAndroidId() : await DeviceInfo.syncUniqueId() );
  if (config.params.did === undefined || config.params.did === 'undefined') delete config.params.did;

  if (storageData?.seance && (!storageData?.expires || (new Date()).getTime() < storageData?.expires) ) {
    config.params.seance = storageData?.seance;
    config.params.sid = storageData?.seance;
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
    params: headers['Content-Type'] === 'application/x-www-form-urlencoded' ? options?.method === 'POST' ? config.params : encoder.convertToObject(encodeString) : '',
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
