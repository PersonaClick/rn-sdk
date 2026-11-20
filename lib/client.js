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
import { SDK_STORAGE_NAME }    from "../index";
import { DEBUG }               from "../MainSDK";
import DataEncoder             from "./utils";
import { getStorageKey }       from '../utils';

const encoder = new DataEncoder();

// Marker (outside any shop partition) recording that the pre-partition (v1) global identity has been
// adopted by a shop, so a second shop can't clone one device's did. See migrateLegacyIdentity.
const LEGACY_CONSUMED_KEY = `${SDK_STORAGE_NAME}:legacy_migrated`;

// Shops whose /init the server refused (a 4xx or an error body — an unknown or disabled shop). For
// the rest of the session their other requests are not sent: request() hands the refusal back at once.
const refusedShops = new Map();

// Shops that run on the native SDK: their requests that still go through this JavaScript take the
// device id and the session from it, not from AsyncStorage.
const nativeIdentities = new Map();

// The hosts a shop was configured with (`apiDomain`, `appDomain`): its requests from this JavaScript go
// there, as the native SDK's do. A shop without them uses the default hosts.
const shopHosts = new Map();

/**
 * The API's hosts of `shop_id`: `apiDomain` for the API, `appDomain` for the account's API v3. A host is
 * taken without its scheme and trailing slashes; none — the default host.
 *
 * @param {string} shop_id - The shop identifier.
 * @param {{ apiDomain?: string|null, appDomain?: string|null }|null} hosts
 */
export function setShopHosts(shop_id, hosts) {
  const host = (value) =>
    typeof value === 'string' ? value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '') || null : null;
  const api = host(hosts?.apiDomain);
  const app = host(hosts?.appDomain);
  if (api || app) {
    shopHosts.set(shop_id, { api, app });
  } else {
    shopHosts.delete(shop_id);
  }
}

/**
 * The account's host (API v3) beside the API at `apiUrl`: its host with `app.` in place of `api.`, the two
 * hosts of one domain. Built from the address, not written as a literal: a build for another domain rewrites
 * the API's address whole, and the account's host follows it.
 *
 * @param {string} apiUrl - The API's address, `https://api.<domain>/`.
 * @returns {string}
 */
export function appHostOfApi(apiUrl) {
  return String(apiUrl).replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').replace(/^api\./i, 'app.');
}

/**
 * The account's host (API v3) of `shop_id`: its `appDomain`, or the default one, beside the default API.
 *
 * @param {string} shop_id - The shop identifier.
 * @returns {string}
 */
export function appHostOf(shop_id) {
  return shopHosts.get(shop_id)?.app || appHostOfApi(SDK_API_URL);
}

/**
 * The native SDK's device id and session of `shop_id`, for its requests that still go through this
 * JavaScript. Set by the shop on every change; its last session stays while the native one has none.
 *
 * @param {string} shop_id - The shop identifier.
 * @param {{ did?: string, sid?: string }} identity
 */
export function setNativeIdentity(shop_id, identity) {
  nativeIdentities.set(shop_id, identity);
}

/**
 * Marks `shop_id` as refused by the server for this session, or lifts the mark (`null`), as a new
 * init does.
 *
 * @param {string} shop_id - The shop identifier.
 * @param {Error|null} refusal - What every later request of the shop returns.
 */
export function setShopRefused(shop_id, refusal) {
  if (refusal) {
    refusedShops.set(shop_id, refusal);
  } else {
    refusedShops.delete(shop_id);
  }
}

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
 * Adopts a pre-partition (v1) global identity into a shop's partition, once.
 *
 * Before per-shop partitioning (v2.0.0), did/session lived in a single global AsyncStorage blob at
 * `SDK_STORAGE_NAME` (no shop_id). Partitioning moved them to `@PersonaClick_<shopId>_` but did not carry the
 * old value forward, so a single-shop install upgrading across that boundary would read an empty
 * partition and be silently re-registered by the server (a fresh did). This copies the legacy
 * did/session into the shop's partition the first time a shop initializes, then marks the legacy blob
 * consumed so a later shop can't clone one device's identity (consume-once — parity with the native
 * iOS/Android migration).
 *
 * Non-destructive to the legacy blob (only a consumed marker is written); a no-op once the partition
 * has a did, when there is no legacy blob (fresh install), or once the legacy identity was consumed.
 *
 * @param {string} shop_id - The shop adopting the legacy identity.
 * @returns {Promise<void>}
 */
export async function migrateLegacyIdentity(shop_id) {
  try {
    // Already partitioned for this shop — nothing to migrate.
    const current = JSON.parse(await AsyncStorage.getItem(getStorageKey('', shop_id))) ?? {};
    if (current?.did) return;

    // No pre-partition identity to adopt (fresh install, or already migrated and cleared).
    const legacyRaw = await AsyncStorage.getItem(SDK_STORAGE_NAME);
    if (!legacyRaw) return;

    // Another shop already inherited the legacy identity — this one starts fresh (consume-once).
    if (await AsyncStorage.getItem(LEGACY_CONSUMED_KEY)) return;

    const legacy = JSON.parse(legacyRaw) ?? {};
    if (!legacy?.did) return;

    // Carry the pre-partition did/session into this shop's partition so an existing single-shop
    // install keeps its device identity — the first /init then goes out with the old did and the
    // server does not re-register the device.
    await AsyncStorage.setItem(getStorageKey('', shop_id), JSON.stringify({
      did: legacy.did,
      seance: legacy.seance,
      sid: legacy.sid ?? legacy.seance,
      expires: legacy.expires,
    }));
    // The first shop to initialize inherits the pre-partition identity; later shops get their own.
    await AsyncStorage.setItem(LEGACY_CONSUMED_KEY, 'true');
  } catch (error) {
    if (DEBUG) console.error('Legacy identity migration error ', error);
  }
}


/**
 * Marks the identity of the store before partitions as taken, when there is one, so that no later
 * start adopts it through `migrateLegacyIdentity`: a customer forgotten with `deleteUserCredentials`
 * does not come back from there. The blob itself stays, as the migration leaves it.
 *
 * @returns {Promise<void>}
 */
export async function retireLegacyIdentity() {
  try {
    if (await AsyncStorage.getItem(SDK_STORAGE_NAME)) {
      await AsyncStorage.setItem(LEGACY_CONSUMED_KEY, 'true');
    }
  } catch (error) {
    if (DEBUG) console.error('Legacy identity retirement error ', error);
  }
}


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
  if (url !== 'init' && refusedShops.has(shop_id)) {
    return refusedShops.get(shop_id);
  }
  const config = {
    method: options?.method || "GET",
    ...options,
    params: options?.params || {},
  };
  // A full address (API v3 lives on another host) goes as it is; a path goes to the shop's API host.
  const apiHost = shopHosts.get(shop_id)?.api;
  const URL = /^https?:\/\//.test(url) ? url : `${apiHost ? `https://${apiHost}/` : SDK_API_URL}${url}`;
  const storageData = await getData(shop_id);
  const errors = [];

  // A push event carries no session (`options.withoutSession`): the server does not read it there.
  const withSession = !options?.withoutSession;
  const native = nativeIdentities.get(shop_id);
  if (native) {
    // The native SDK keeps the device id and the session.
    if (native.did) config.params.did = native.did;
    if (native.sid && withSession) {
      config.params.sid = native.sid;
      config.params.seance = native.sid;
    }
  } else {
    if (storageData?.did) {
      config.params.did = storageData.did;
    }
    if (!withSession) {
      // nothing: see above
    } else if (storageData?.seance && storageData?.expires && (new Date()).getTime() < storageData?.expires) {
      config.params.seance = storageData?.seance;
      config.params.sid = storageData?.seance;
    } else if (url !== 'init') {
      const generatedSid = generateSid();

      config.params.sid = generatedSid;
      config.params.seance = generatedSid;
    }
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
  if (config.timeout) params.timeout = config.timeout;

  // Only with debug, and only the method and the path: never the query, the body or the answer, which
  // carry the customer's data (`sdk/core/logging.md`).
  if (DEBUG) console.log('[SDK client]', params.method || 'GET', String(URL).split('?')[0]);
  return axios({
    url: URL,
    // Never carry cookies on SDK requests. React Native's XMLHttpRequest defaults
    // `withCredentials` to true and shares one native cookie store across every request, so the
    // server's device `did` cookie (set on /init, scoped to .personaClick.ru) would be replayed on a second
    // shop's /init — collapsing both shops onto one server-assigned did. Identity travels in the
    // per-shop `did`/`seance` params instead; sending no cookie makes each shop's first /init
    // anonymous, so the backend mints a distinct did per shop (parity with the cookie-less Android/iOS
    // native clients).
    withCredentials: false,
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
