'use strict'

/**
 * Errors raised by the `PersonaClick` facade when an instance cannot be resolved. Concepts mirror the
 * native SDKs (Android `UnknownShopIdException` / `AmbiguousShopException`; iOS `PersonaClickError`); the
 * JS idiom is Error subclasses so hosts can `instanceof`-check.
 */

/**
 * The facade's error (`PersonaClickError` of the contract): a mistake in the app's code when it looks an
 * instance up, not a failure of the SDK. `type` is `unknownShop` (no such shop is registered) or
 * `ambiguousShop` (no `shopId` while several shops are). Thrown at once by `PersonaClick.instance`.
 */
export class PersonaClickError extends Error {
  /**
   * @param {'unknownShop' | 'ambiguousShop'} type
   * @param {string} message
   */
  constructor(type, message) {
    super(message)
    this.name = 'PersonaClickError'
    this.type = type
  }
}

/**
 * Raised when a requested shop is unknown — nothing registered, or no such shop: the `PersonaClickError` of
 * type `unknownShop`, under the name 4.x gave it.
 */
export class UnknownShopIdError extends PersonaClickError {
  constructor(message) {
    super('unknownShop', message)
    this.name = 'UnknownShopIdError'
  }
}

/**
 * Raised by `instance()` with no shopId when more than one shop is registered: the `PersonaClickError` of
 * type `ambiguousShop`, under the name 4.x gave it.
 */
export class AmbiguousShopError extends PersonaClickError {
  constructor(message) {
    super('ambiguousShop', message)
    this.name = 'AmbiguousShopError'
  }
}

/**
 * The SDK's error, as the native SDKs have it: `type` is one of `notInitialized`, `shopBlocked`,
 * `invalidArgument`, `network`, `timeout`, `http`, `decoding`, `cancelled`; an `http` error carries
 * the HTTP code and the server's code.
 */
export class SdkError extends Error {
  /**
   * @param {string} type
   * @param {string} message
   * @param {{ httpCode?: number, serverCode?: string }} [codes]
   */
  constructor(type, message, codes = {}) {
    super(message)
    this.name = 'SdkError'
    this.type = type
    if (codes.httpCode != null) this.httpCode = codes.httpCode
    if (codes.serverCode != null) this.serverCode = codes.serverCode
  }
}

export default { PersonaClickError, UnknownShopIdError, AmbiguousShopError, SdkError }
