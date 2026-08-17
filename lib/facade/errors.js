'use strict'

/**
 * Errors raised by the `PersonaClick` facade when an instance cannot be resolved. Concepts mirror the
 * native SDKs (Android `UnknownShopIdException` / `AmbiguousShopException`; iOS `PersonaClickError`); the
 * JS idiom is Error subclasses so hosts can `instanceof`-check.
 */

/** Raised when a requested shop is unknown — nothing registered, or no such shop. */
export class UnknownShopIdError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UnknownShopIdError'
  }
}

/** Raised by `getInstance()` with no shopId when more than one shop is registered. */
export class AmbiguousShopError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AmbiguousShopError'
  }
}

export default { UnknownShopIdError, AmbiguousShopError }
