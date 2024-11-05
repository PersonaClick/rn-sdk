import { SDK_STORAGE_NAME } from '../index';

/**
 * Generates a storage key based on the shop_id.
 *
 * @param {string} key - The key for the data to be stored.
 * @param {string} shop_id - The shop identifier.
 * @returns {string} Full key for storage.
 */
export const getStorageKey = (key, shop_id) => `${SDK_STORAGE_NAME}_${shop_id}_${key}`;
