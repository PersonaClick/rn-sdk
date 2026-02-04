import AsyncStorage from '@react-native-async-storage/async-storage'
import { request } from './client'
import { getData } from './client'
import { getStorageKey } from '../utils'
import { DEBUG } from '../MainSDK'

const POPUP_SHOWN_TTL_SECONDS = 60
const POPUP_SHOWN_TTL_MS = POPUP_SHOWN_TTL_SECONDS * 1000

/**
 * @typedef {'web_push' | string} Channel
 */

/**
 * @typedef {'top' | 'slide_right' | 'slide_left' | 'fixed_bottom'} Position
 */

/**
 * @typedef {'0' | '1'} WebPushSystem
 */

/**
 * @typedef {Object} PopupActionButton
 * @property {string} button_text
 * @property {string} [link_ios]
 * @property {string} [link_web]
 * @property {string} [link_android]
 */

/**
 * @typedef {Object} PopupData
 * @property {Channel[]} channels
 * @property {string} html
 * @property {string | undefined} error
 * @property {number} id
 * @property {Position} position
 * @property {number} delay
 * @property {WebPushSystem} web_push_system
 * @property {string} [popup_actions]
 * @property {string} [components]
 */

/**
 * PopupLogic class for managing popup display logic
 * Similar to PopupNew in JS SDK but adapted for React Native
 */
class PopupLogic {
  /**
   * Get popup storage key
   * @param {number} popupId
   * @param {string} shopId
   * @returns {string}
   */
  static getPopupStorageKey(popupId, shopId) {
    return getStorageKey(`popup-${popupId}`, shopId)
  }

  /**
   * Get popup name
   * @param {number} id
   * @returns {string}
   */
  static popupName(id) {
    return `popup-${id}`
  }

  /**
   * Check if popup was already shown within last 60 seconds
   * @param {number} popupId
   * @param {string} shopId
   * @returns {Promise<boolean>}
   */
  static async wasPopupShown(popupId, shopId) {
    try {
      const key = this.getPopupStorageKey(popupId, shopId)
      const value = await AsyncStorage.getItem(key)
      
      // If no flag stored, popup was not shown
      if (value !== 'showed') {
        return false
      }
      
      // Check expiration time
      const expiresKey = getStorageKey(`popup-${popupId}-expires`, shopId)
      const expiresAt = await AsyncStorage.getItem(expiresKey)
      
      if (!expiresAt) {
        // No expiration stored, consider as expired (show popup)
        return false
      }
      
      const expiresTimestamp = parseInt(expiresAt, 10)
      const now = Date.now()
      
      // If expired, popup can be shown again
      if (now > expiresTimestamp) {
        // Clean up expired flags
        await AsyncStorage.removeItem(key)
        await AsyncStorage.removeItem(expiresKey)
        return false
      }
      
      // Popup was shown and not expired yet
      return true
    } catch (error) {
      console.error('[PopupLogic] Error checking popup shown:', error)
      return false
    }
  }

  /**
   * Mark popup as shown in storage
   * @param {number} popupId
   * @param {string} shopId
   * @returns {Promise<void>}
   */
  static async markPopupAsShown(popupId, shopId) {
    try {
      const key = this.getPopupStorageKey(popupId, shopId)
      // Store for TTL (same as JS SDK cookies)
      await AsyncStorage.setItem(key, 'showed')
      // Set expiration by storing timestamp
      const expiresKey = getStorageKey(`popup-${popupId}-expires`, shopId)
      const expiresAt = Date.now() + POPUP_SHOWN_TTL_MS
      await AsyncStorage.setItem(expiresKey, expiresAt.toString())
    } catch (error) {
      console.error('[PopupLogic] Error marking popup as shown:', error)
    }
  }

  /**
   * Track popup shown event to API
   * @param {number} popupId
   * @param {string} shopId
   * @param {string} deviceId
   * @param {string} seance
   * @returns {Promise<void>}
   */
  static async trackPopupShown(popupId, shopId, deviceId, seance) {
    try {
      const params = {
        shop_id: shopId,
        did: deviceId,
        sid: seance,
        seance: seance,
        popup: popupId,
      }

      await request('popup/showed', shopId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        params,
      })

      if (DEBUG) console.log(`[PopupLogic] Tracked popup ${popupId} shown`)
    } catch (error) {
      console.error('[PopupLogic] Error tracking popup shown:', error)
    }
  }

  /**
   * Get CSS URL for popup
   * @param {number} popupId
   * @param {string} shopToken
   * @returns {string}
   */
  static getPopupCssUrl(popupId, shopToken) {
    // Use HTTPS for CSS loading (JS SDK uses protocol-relative URL)
    return `https://api.personaclick.com/popup_css/${shopToken}_popup_${popupId}.css`
  }

  /**
   * Prepare and show popup
   * @param {Object} sdkInstance - MainSDK instance
   * @param {PopupData} popupData - Popup data from server
   * @param {boolean} manual - Whether popup is shown manually
   * @param {Function} showCallback - Callback to show popup UI component
   * @returns {Promise<void>}
   */
  static async prepare(sdkInstance, popupData, manual = false, showCallback = null) {
    if (!popupData || !popupData.id) {
      if (!popupData?.error) {
        console.error('[PopupLogic] Popup preparation failed: missing required data (id)')
      }
      return
    }

    // Check if popup has data to display (html or components)
    const hasHtml = popupData.html && typeof popupData.html === 'string'
    const hasComponents = popupData.components && (typeof popupData.components === 'string' || typeof popupData.components === 'object')
    
    if (!hasHtml && !hasComponents) {
      if (!popupData?.error) {
        console.error('[PopupLogic] Popup preparation failed: missing both html and components')
      }
      return
    }

    const popupId = popupData.id
    const shopId = sdkInstance.shop_id

    // Check if popup was already shown (unless manual)
    if (!manual) {
      const wasShown = await this.wasPopupShown(popupId, shopId)
      if (wasShown) {
        if (DEBUG) console.log(`[PopupLogic] Popup ${popupId} was already shown, skipping`)
        return
      }
    }

    // Get device ID and seance
    const storageData = await getData(shopId)
    const deviceId = storageData?.did || sdkInstance.deviceId || ''
    const seance = storageData?.seance || storageData?.sid || sdkInstance.userSeance || ''

    // Track popup shown
    await this.trackPopupShown(popupId, shopId, deviceId, seance)

    // Mark as shown in storage
    await this.markPopupAsShown(popupId, shopId)

    // Call show callback if provided
    if (showCallback && typeof showCallback === 'function') {
      // Apply delay before showing
      const delayMs = (popupData.delay || 0) * 1000
      setTimeout(() => {
        showCallback(popupData)
      }, delayMs)
    } else {
      console.error('[PopupLogic] No show callback provided for popup - popup will not be displayed!')
      if (DEBUG) console.warn('[PopupLogic] No show callback provided for popup')
    }
  }

  /**
   * Parse popup actions JSON
   * @param {string} popupActions
   * @returns {Object|null}
   */
  static parsePopupActions(popupActions) {
    if (!popupActions) return null

    try {
      const actions = JSON.parse(popupActions)
      if (!actions || typeof actions !== 'object' || Array.isArray(actions)) {
        return null
      }
      return actions
    } catch (error) {
      console.error('[PopupLogic] Error parsing popup actions:', error)
      return null
    }
  }

  /**
   * Parse popup components JSON
   * @param {string} components
   * @returns {Object|null}
   */
  static parseComponents(components) {
    if (!components) return null

    try {
      return JSON.parse(components)
    } catch (error) {
      console.error('[PopupLogic] Error parsing components:', error)
      return null
    }
  }
}

export default PopupLogic
