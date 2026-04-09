/**
 * Optional second argument to MainSDK `trackEvent`.
 * Only these keys are allowed; extra keys are rejected at runtime.
 */
export type CustomEventParams = {
  time?: number
  category?: string
  label?: string
  value?: number
  customFields?: Record<string, unknown>
}
