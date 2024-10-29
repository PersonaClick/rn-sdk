import { request } from '../lib/client';

/**
 * Sends a request for a blank search.
 *
 * @param {number} shop_id - The shop identifier.
 * @param {string} stream - The stream for the request.
 * @returns {Promise<Object>} - A promise with the request result.
 */
export const blankSearchRequest = (shop_id, stream) => {
  return new Promise((resolve, reject) => {
    try {
      request('search/blank', {
        params: {
          shop_id,
          stream,
        },
      }).then(res => {
        resolve(res);
      });
    } catch (error) {
      reject(error);
    }
  });
};
