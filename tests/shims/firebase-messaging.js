/** Minimal Firebase Messaging surface used by MainSDK (Jest). */

export const getMessaging = () => ({})
export const getToken = () => Promise.resolve('jest-mock-fcm-token')
export const getAPNSToken = () => Promise.resolve(null)
export const onMessage = () => {}
export const setBackgroundMessageHandler = () => {}
export const deleteToken = () => Promise.resolve()
export const onNotificationOpenedApp = () => {}
export const getInitialNotification = () => Promise.resolve(null)
export const onTokenRefresh = () => () => {}
