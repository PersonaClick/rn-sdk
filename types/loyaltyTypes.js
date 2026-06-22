/**
 * @typedef {Object} LoyaltyJoinResponse
 * @property {string|null} status - `success` | `fail`
 * @property {Record<string, any>} payload - shape differs between success and failure
 */

/**
 * Parse the `loyalty/members/join` response envelope: `{ status, payload }`.
 * @param {Record<string, any>} json
 * @returns {LoyaltyJoinResponse}
 */
export function parseLoyaltyJoinResponse(json) {
  if (!json || typeof json !== 'object') {
    return { status: null, payload: {} }
  }
  return {
    status: json.status ?? null,
    payload: json.payload ?? {},
  }
}

/**
 * @typedef {Object} LoyaltyLevel
 * @property {string|null} name
 * @property {string|null} code
 * @property {string|null} expirationDate
 */

/**
 * @typedef {Object} LoyaltyStatus
 * @property {string|null} status - `success` | `fail`
 * @property {boolean|null} member
 * @property {LoyaltyLevel|null} level
 */

/**
 * Parse the `loyalty/members/status` response envelope:
 * `{ status, payload: { member, level: { name, code, expiration_date } } }`.
 * @param {Record<string, any>} json
 * @returns {LoyaltyStatus}
 */
export function parseLoyaltyStatus(json) {
  const payload = json?.payload ?? {}
  const level = payload.level
  return {
    status: json?.status ?? null,
    member: payload.member ?? null,
    level:
      level && typeof level === 'object'
        ? {
            name: level.name ?? null,
            code: level.code ?? null,
            expirationDate: level.expiration_date ?? null,
          }
        : null,
  }
}
