const PURCHASE_PREDICT_QUERY_KEYS = ['email', 'phone', 'telegram_id', 'loyalty_id']

/**
 * Builds query fields allowed for predict/probability-to-purchase from strictly typed params.
 * @param {Record<string, unknown>} params
 * @returns {Record<string, string>}
 */
export function buildPurchasePredictQueryParams(params) {
  const result = {}
  if (params == null || typeof params !== 'object') {
    return result
  }
  for (const key of PURCHASE_PREDICT_QUERY_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      continue
    }
    const value = params[key]
    if (value != null && value !== '') {
      result[key] = String(value)
    }
  }
  return result
}
