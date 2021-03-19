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

export async function request(url, options = {}) {
  const config = {
    method: options?.method || "GET",
    ...options,
  };
  const URL = `${SERVER_URL}${url}`;
  const storageData = await getData();
  const errors = [];

  if (storageData?.did && storageData?.seance) {
    config.params.did = storageData.did;
    config.params.seance = storageData.seance;
  }

  if (!url) {
    errors.push("url");
  }

  if (errors.length) {
    throw new Error(`Error! You must pass \`${errors.join("`, `")}\``);
  }

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "Mobile",
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

      return response.data;
    })
    .catch((error) => {
      return error;
    });
}
