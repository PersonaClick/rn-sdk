/** Stub for Jest — avoids loading Notifee native module. */
export const AndroidImportance = { HIGH: 4 }
export const AndroidVisibility = { PUBLIC: 1 }
export const AndroidStyle = { BIGPICTURE: 1 }
export const EventType = {}
export const AuthorizationStatus = {
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
}

const notifee = {
  displayNotification: async () => {},
  createChannel: async () => {},
  onForegroundEvent: () => () => {},
  requestPermission: async () => ({
    authorizationStatus: AuthorizationStatus.AUTHORIZED,
  }),
}

export default notifee
