import notifee from '@notifee/react-native'
import { AndroidImportance } from '@notifee/react-native'
import { AndroidVisibility } from '@notifee/react-native'
import { SDK_PUSH_CHANNEL } from '../index.js'
import { Platform } from 'react-native'

export class NotificationManager {
  /**
   * @param {import('@notifee/react-native').Notification} notification
   * @returns {void}
   */
  static async showNotification(notification) {
    if (Platform.OS === 'android') {
      await this._initInAppChannel()

      if (!notification.android) {
        notification.android = {}
      }

      if (
        !notification.android.channelId ||
        notification.android.channelId === ''
      ) {
        notification.android.channelId = SDK_PUSH_CHANNEL
      }

      if (!notification.android.importance) {
        notification.android.importance = AndroidImportance.HIGH
      }
    }

    if (Platform.OS === 'ios') {
      if (!notification.ios) {
        notification.ios = {}
      }

      if (!notification.ios.criticalVolume) {
        notification.ios.criticalVolume = 0.0
      }

      if (!notification.ios.badgeCount) {
        notification.ios.badgeCount = null
      }
    }

    try {
      return notifee.displayNotification(notification)
    } catch (error) {
      console.error(error)
    }
  }

  static async _initInAppChannel() {
    return notifee.createChannel({
      id: `${SDK_PUSH_CHANNEL}_IN_APP`,
      name: 'In-app notifications',
      importance: AndroidImportance.HIGH,
      badge: false,
      sound: '',
      vibration: false,
      visibility: AndroidVisibility.PUBLIC,
    })
  }
}
