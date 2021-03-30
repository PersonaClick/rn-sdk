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
import { getUniqueId } from 'react-native-device-info';
import { Platform } from 'react-native';
import { version } from "../package.json";
import { SESSION_CODE_EXPIRE } from "../index";
import DataEncoder from "./utils";

const encoder = new DataEncoder();
const SERVER_URL = "https://api.personaclick.com/";

const getData = async () => {
  try {
    return JSON.parse(await AsyncStorage.getItem("@personaClick")) ?? {};
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
      data.seance = seance
    }
    await AsyncStorage.setItem('@personaClick', JSON.stringify(data));
  } catch (error) {
    return error;
  }
}

export async function request(url, options = {}) {
  const config = {
    method: options?.method || "GET",
    ...options,
  };
  const URL = `${SERVER_URL}${url}`;
  const storageData = await getData();
  const errors = [];

  config.params.did = storageData.did || getUniqueId();

  if (storageData?.seance && (!storageData?.expires || (new Date()).getTime() < storageData?.expires) ) {
    config.params.seance = storageData?.seance;
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
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": UserAgent,
    ...config.headers,
  };

  const encodeString = encoder.encode(config.params);

  const params = {
    headers,
    method: config.method,
    params: encoder.convertToObject(encodeString),
    data: config.payload,
  };

  return axios({
    url: URL,
    ...params,
  })
    .then((response) => {
      if (response?.data.status >= 400) {
        throw response.data;
      }
      updSeance();
      return response.data;
    })
    .catch((error) => {
      return error;
    });
}
