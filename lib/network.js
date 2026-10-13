'use strict';

// Network state through @react-native-community/netinfo — an optional peer dependency. Without it
// the SDK cannot tell that the device is offline and simply sends its requests.
let NetInfo = null;
try {
  const module = require('@react-native-community/netinfo');
  NetInfo = module?.default ?? module;
} catch (error) {
  NetInfo = null;
}

const isOffline = (state) => state?.isConnected === false;

/**
 * Whether the device is known to be offline. `false` when it is online or when that is unknown
 * (no NetInfo, or NetInfo failed): only a certain "offline" holds a request back.
 * @returns {Promise<boolean>}
 */
export async function knownOffline() {
  if (!NetInfo) return false;
  try {
    return isOffline(await NetInfo.fetch());
  } catch (error) {
    return false;
  }
}

/**
 * Resolves when the device gets back online after being offline: at once if it is offline now,
 * otherwise after the next drop of the connection. Resolves `false` straight away without NetInfo,
 * where there is nothing to wait for.
 * @returns {Promise<boolean>} `true` once the network is back
 */
export function waitForReconnect() {
  if (!NetInfo) return Promise.resolve(false);
  return new Promise((resolve) => {
    let wasOffline = false;
    let unsubscribe = null;
    let done = false;
    const finish = () => {
      done = true;
      if (unsubscribe) unsubscribe();
    };
    unsubscribe = NetInfo.addEventListener((state) => {
      if (done) return;
      if (isOffline(state)) {
        wasOffline = true;
      } else if (wasOffline) {
        finish();
        resolve(true);
      }
    });
    if (done && unsubscribe) unsubscribe();
  });
}
