'use strict'

/**
 * Push lifecycle events routed by `PersonaClick.handlePush` (Release 4).
 *
 * These are the React Native SDK's native three — one per `track/*` endpoint the SDK already has
 * (`track/delivered`, `track/opened`, `track/clicked`). Concept-mapping to the other platforms:
 * Android's `RECEIVED` ≈ `DELIVERED` (a push arrived); `OPENED` is the RN-specific "notification
 * shown" event; `CLICKED` matches everywhere.
 *
 * @readonly
 * @enum {string}
 */
export const PushEvent = Object.freeze({
  /** The push was delivered to the device (`track/delivered`). */
  DELIVERED: 'delivered',
  /** The notification was shown to the user (`track/opened`). */
  OPENED: 'opened',
  /** The user tapped the notification (`track/clicked`). */
  CLICKED: 'clicked',
})

export default PushEvent
