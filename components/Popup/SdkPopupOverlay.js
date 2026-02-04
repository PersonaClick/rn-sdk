import React, { useState, useCallback, useEffect } from 'react'
import Popup from './Popup'
import PopupLogic from '../../lib/popup'

const POPUP_CLOSE_ANIMATION_DELAY_MS = 300

/**
 * Global SdkPopupOverlay singleton.
 * Holds popup queue + visibility state for the overlay UI.
 */
class SdkPopupOverlaySingleton {
  constructor() {
    this.currentPopup = null
    this.isVisible = false
    this.popupQueue = []
    this.sdkInstance = null
    this.updateCallback = null
  }

  /**
   * Register SDK instance
   * @param {Object} sdk - MainSDK instance
   */
  registerSDK(sdk) {
    if (!sdk) {
      console.warn('[SdkPopupOverlay] SDK instance is required')
      return
    }

    this.sdkInstance = sdk

    // Trigger update to show overlay component (if mounted)
    if (this.updateCallback) {
      this.updateCallback()
    } else {
      console.warn('[SdkPopupOverlay] No update callback registered - overlay component may not be mounted')
    }
  }

  /**
   * Set update callback for React component
   * @param {Function | null} callback - Callback to trigger component update
   */
  setUpdateCallback(callback) {
    this.updateCallback = callback
  }

  /**
   * Show popup
   * @param {Object} popupData - Popup data from server
   */
  showPopup(popupData) {
    if (!popupData || !popupData.id) {
      console.warn('[SdkPopupOverlay] showPopup: invalid popup data')
      return
    }

    // Check if popup has data to display (html or components)
    const hasHtml = popupData.html && typeof popupData.html === 'string'
    const hasComponents =
      popupData.components &&
      (typeof popupData.components === 'string' || typeof popupData.components === 'object')

    if (!hasHtml && !hasComponents) {
      console.warn('[SdkPopupOverlay] showPopup: popup has no display data')
      return
    }

    // If there's already a popup showing, queue this one
    if (this.isVisible && this.currentPopup) {
      this.popupQueue.push(popupData)
      return
    }

    this.currentPopup = popupData
    this.isVisible = true

    // Trigger component update
    if (this.updateCallback) {
      this.updateCallback()
    } else {
      console.error('[SdkPopupOverlay] showPopup: no update callback - overlay component is not mounted!')
    }
  }

  /**
   * Close current popup
   */
  closePopup() {
    this.isVisible = false

    // Trigger component update
    if (this.updateCallback) {
      this.updateCallback()
    }

    // Show next popup from queue if any
    setTimeout(() => {
      if (this.popupQueue.length > 0) {
        const nextPopup = this.popupQueue.shift()
        this.currentPopup = nextPopup
        this.isVisible = true

        if (this.updateCallback) {
          this.updateCallback()
        }
      } else {
        this.currentPopup = null
        if (this.updateCallback) {
          this.updateCallback()
        }
      }
    }, POPUP_CLOSE_ANIMATION_DELAY_MS)
  }

  /**
   * Get current popup state
   */
  getState() {
    return {
      currentPopup: this.currentPopup,
      isVisible: this.isVisible,
      sdk: this.sdkInstance,
    }
  }
}

// Create global singleton instance
const sdkPopupOverlayInstance = new SdkPopupOverlaySingleton()

/**
 * Internal overlay component that renders popup UI
 */
function SdkPopupOverlayInternal() {
  const [state, setState] = useState(() => sdkPopupOverlayInstance.getState())

  useEffect(() => {
    sdkPopupOverlayInstance.setUpdateCallback(() => {
      setState(sdkPopupOverlayInstance.getState())
    })

    const currentState = sdkPopupOverlayInstance.getState()
    if (currentState.sdk && currentState.sdk !== state.sdk) {
      setState(currentState)
    }

    return () => {
      sdkPopupOverlayInstance.setUpdateCallback(null)
    }
  }, [])

  const handleClose = useCallback(() => {
    sdkPopupOverlayInstance.closePopup()
  }, [])

  // Don't render if no SDK is registered
  if (!state.sdk) return null

  return (
    <Popup
      visible={state.isVisible}
      popupData={state.currentPopup}
      onClose={handleClose}
      sdk={state.sdk}
    />
  )
}

/**
 * Get or create global overlay component reference (optional helper).
 */
let globalSdkPopupOverlayComponent = null

export function getGlobalSdkPopupOverlayComponent() {
  if (!globalSdkPopupOverlayComponent) {
    globalSdkPopupOverlayComponent = SdkPopupOverlayInternal
  }
  return globalSdkPopupOverlayComponent
}

/**
 * Public overlay component (render this in your app for auto popup presentation).
 *
 * @param {Object} props
 * @param {Object} props.sdk - MainSDK instance (optional, will use registered SDK if not provided)
 */
export default function SdkPopupOverlay({ sdk }) {
  useEffect(() => {
    if (sdk) {
      sdkPopupOverlayInstance.registerSDK(sdk)
    }
  }, [sdk])

  return <SdkPopupOverlayInternal />
}

/**
 * Show popup programmatically (used internally by SDK).
 * @param {Object} popupData
 */
export function showPopup(popupData) {
  sdkPopupOverlayInstance.showPopup(popupData)
}

/**
 * Register SDK instance (called automatically from MainSDK constructor).
 * @param {Object} sdkInstance
 */
export function registerSDK(sdkInstance) {
  sdkPopupOverlayInstance.registerSDK(sdkInstance)
}

/**
 * Prepare and show popup (main entry point called from MainSDK).
 * @param {Object} sdkInstance
 * @param {Object} popupData
 * @param {boolean} manual
 */
export async function prepareAndShow(sdkInstance, popupData, manual = false) {
  await PopupLogic.prepare(sdkInstance, popupData, manual, showPopup)
}

