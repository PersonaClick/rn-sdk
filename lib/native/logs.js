'use strict'

import { nativeBridge } from './bridge'

/**
 * `PersonaClick.setLogHandler` of the contract (`sdk/core/logging.md`): the app gets each message the native
 * SDKs log — of every shop, at or above that shop's `logLevel` — as `SdkLogMessage`
 * `{ level, code, message, shopId, context }`, to forward to its crash reporter. One handler for the
 * process; a new one replaces it, null removes it. Without the native module no message comes.
 */

let handler = null
let stopListening = null

const LEVELS = new Set(['debug', 'info', 'warning', 'error'])

/**
 * The message as the contract has it, from the native module's event.
 * @param {any} raw
 * @returns {{ level: string, code: string, message: string, shopId: string | null, context: Record<string, unknown> }}
 */
export function logMessage(raw) {
  const level = typeof raw?.level === 'string' ? raw.level.toLowerCase() : 'debug'
  return {
    level: LEVELS.has(level) ? level : 'debug',
    code: typeof raw?.code === 'string' ? raw.code : 'sdk_log',
    message: typeof raw?.message === 'string' ? raw.message : '',
    shopId: typeof raw?.shopId === 'string' && raw.shopId !== '' ? raw.shopId : null,
    context: raw?.context != null && typeof raw.context === 'object' && !Array.isArray(raw.context) ? raw.context : {},
  }
}

function deliver(raw) {
  const current = handler
  if (!current) return
  try {
    current(logMessage(raw))
  } catch (error) {
    // Only to the system log: the handler's own failure is not one more message for it.
    console.error('[SDK] The log handler threw (log_handler_failed):', error?.message ?? error)
  }
}

/**
 * @param {((message: object) => void) | null} next
 * @returns {void}
 */
export function setLogHandler(next) {
  if (next != null && typeof next !== 'function') {
    throw new TypeError('PersonaClick.setLogHandler: the handler must be a function or null')
  }
  handler = next ?? null
  if (!nativeBridge) return
  if (handler && !stopListening) stopListening = nativeBridge.onLog(deliver)
  if (!handler && stopListening) {
    stopListening()
    stopListening = null
  }
  nativeBridge.setLogHandler(handler != null)
}

export default { setLogHandler, logMessage }
