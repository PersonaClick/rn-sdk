'use strict'

import notifee, { AndroidImportance, AndroidStyle } from '@notifee/react-native'
import { Platform } from 'react-native'
import { SDK_PUSH_CHANNEL } from '../../index'

/**
 * Builds and posts the notifee notification for a push. Pure display — no tracking, no persistence —
 * extracted from `MainSDK.showNotification` so the process-global `PushRouter` can show a push for a
 * registered-but-not-initialized (pending) shop WITHOUT constructing an SDK instance for it. The live
 * path (`showNotification`) and the pending path (router) therefore render notifications identically.
 *
 * @param {{ data: object, messageId?: string, from?: string, sentTime?: number, ttl?: number }} message
 * @returns {Promise<void>}
 */
export async function displayPush(message) {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: SDK_PUSH_CHANNEL,
      name: 'RNSDK channel',
      importance: AndroidImportance.HIGH,
      // A channel created without an explicit sound is silent (Notifee default) — the push then only
      // vibrates. Give it the default sound so a data-only push rings like a normal notification.
      // Channel settings are frozen after first creation, so an existing install needs a reinstall.
      sound: 'default',
      vibration: true,
    })
  }

  const data = {
    ...(message.messageId && { message_id: message.messageId }),
    ...(message.data.id && { id: message.data.id }),
    ...(message.data.type && { type: message.data.type }),
    ...(message.data.icon && { icon: message.data.icon }),
    ...(message.data.image_url && { image: message.data.image_url }),
    ...(message.data.image && { image: message.data.image }),
    ...(message.from && { from: message.from }),
    ...(message.sentTime && { sentTime: `${message.sentTime}` }),
    ...(message.ttl && { ttl: `${message.ttl}` }),
  }
  // Accept either `image` or `image_url` — the backend sends one or the other, and the `data` map above
  // already normalizes both to `image`, so the picture must too or an `image_url`-only push shows none.
  const picture = message.data.image || message.data.image_url
  const android = {
    channelId: SDK_PUSH_CHANNEL,
    // No smallIcon → Notifee uses the host app's own icon. A host that wants a dedicated monochrome
    // notification icon declares `default_notification_icon` in its manifest (mirrors the native SDK).
    pressAction: { id: 'default' },
    ...(message.data.icon && { largeIcon: message.data.icon }),
    // BIGPICTURE must go under `style` — Notifee ignores `type`/`picture` placed directly on `android`,
    // so the big image was silently dropped before. This is what renders the push image.
    ...(picture && {
      style: { type: AndroidStyle.BIGPICTURE, picture },
    }),
  }
  await notifee.displayNotification({
    title: message.data.title,
    body: message.data.body,
    data,
    android,
  })
}

export default displayPush
