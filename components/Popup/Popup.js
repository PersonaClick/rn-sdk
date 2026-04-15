import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  Text,
  Image,
  Platform,
  Linking,
  ScrollView,
} from 'react-native'
import PopupLogic from '../../lib/popup'
import { DEBUG } from '../../MainSDK'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

/**
 * Popup Component
 * Displays popup using native React Native components (like Android/iOS SDK)
 * Uses structured data from components and popupActions instead of HTML
 * 
 * @param {Object} props
 * @param {boolean} props.visible - Whether popup is visible
 * @param {Object} props.popupData - Popup data from server
 * @param {Function} props.onClose - Callback when popup is closed
 * @param {Object} props.sdk - SDK instance
 */
export default function Popup({ visible, popupData, onClose, sdk }) {
  const slideAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  const popupId = popupData?.id
  const position = popupData?.position || 'fixed_bottom'
  const components = PopupLogic.parseComponents(popupData?.components)
  const popupActions = PopupLogic.parsePopupActions(popupData?.popup_actions)

  // Extract data from components
  const title = components?.header || ''
  const message = components?.text || ''
  const imageUrl = components?.image || null
  const buttonTextFromComponents = components?.button || null

  // Extract button texts from popupActions (no default for close — match JS SDK: only show Close button when server sends button_text)
  const closeButtonText = popupActions?.close?.button_text ?? null
  const linkButtonText = popupActions?.link?.button_text || null
  const subscribeButtonText = popupActions?.pushSubscribe?.button_text ||
                             popupActions?.system_mobile_push_subscribe?.button_text ||
                             null

  // Main button text only from popup_actions (match iOS/JS: no fallback to components.button when actions are empty)
  const confirmButtonText = subscribeButtonText || linkButtonText || null
  const declineButtonText = confirmButtonText && closeButtonText ? closeButtonText : null

  // Animate popup based on position
  useEffect(() => {
    if (visible) {
      if (position === 'slide_right' || position === 'slide_left') {
        // Slide animation
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start()
      } else {
        // Fade animation for top and fixed_bottom
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start()
      }
    } else {
      // Reset animations
      slideAnim.setValue(0)
      fadeAnim.setValue(0)
    }
  }, [visible, position])

  /**
   * Handle confirm button click.
   * Action is chosen by which popup_action provided the confirm button text (subscribe > link).
   * Only run push when subscribeButtonText is set; do not use system_mobile_push_subscribe presence alone.
   */
  const handleConfirmClick = async () => {
    if (subscribeButtonText) {
      await handlePushSubscription()
    } else if (linkButtonText && popupActions?.link) {
      await handleLinkClick()
    } else if (buttonTextFromComponents) {
      handleClose()
    }
  }

  /**
   * Handle push subscription
   */
  const handlePushSubscription = async () => {
    if (!sdk) return

    try {
      // Request push permission and get token
      if (sdk.initPushToken) {
        const token = await sdk.initPushToken(false)
        if (token) {
          // Token will be sent automatically by SDK
          if (DEBUG) console.log('[Popup] Push subscription successful')
        }
      }

      // Check if we should show success message or close
      if (components?.products === '1' && components?.successfully_enabled === '1') {
        // Show success message (could be implemented as state change)
        if (DEBUG) console.log('[Popup] Subscription successful, showing success message')
      } else {
        // Close popup
        handleClose()
      }
    } catch (error) {
      if (DEBUG) console.error('[Popup] Error subscribing to push:', error)
      handleClose()
    }
  }

  /**
   * Handle link button click
   */
  const handleLinkClick = async () => {
    if (!popupActions?.link) return

    try {
      // Platform-specific link, fallback to link_web when empty (same as iOS)
      const platformLink = Platform.OS === 'ios'
        ? popupActions.link.link_ios
        : (Platform.OS === 'android' ? popupActions.link.link_android : null)
      const link = (platformLink && platformLink.trim() !== '')
        ? platformLink.trim()
        : (popupActions.link.link_web || '').trim()

      if (link && link.startsWith('http')) {
        await Linking.openURL(link)
      } else {
        console.warn('[Popup] Link button: no valid URL (empty or not http(s)):', link || '(empty)')
      }
    } catch (error) {
      console.warn('[Popup] Failed to open URL:', error?.message || error)
    } finally {
      handleClose()
    }
  }

  /**
   * Handle close
   */
  const handleClose = () => {
    // Animate out
    if (position === 'slide_right' || position === 'slide_left') {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onClose?.()
      })
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onClose?.()
      })
    }
  }

  // Calculate animation styles based on position
  const getAnimationStyle = () => {
    if (position === 'slide_right') {
      return {
        transform: [
          {
            translateX: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [screenWidth, 0],
            }),
          },
        ],
      }
    } else if (position === 'slide_left') {
      return {
        transform: [
          {
            translateX: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-screenWidth, 0],
            }),
          },
        ],
      }
    } else {
      return {
        opacity: fadeAnim,
      }
    }
  }

  // Get container style based on position
  const getContainerStyle = () => {
    const baseStyle = [styles.container, getAnimationStyle()]
    
    if (position === 'top') {
      return [...baseStyle, styles.containerTop]
    } else if (position === 'centered') {
      return [...baseStyle, styles.containerCentered]
    } else if (position === 'fixed_bottom' || position === 'slide_right' || position === 'slide_left') {
      return [...baseStyle, styles.containerBottom]
    }
    
    // Default to centered if position is not recognized
    return [...baseStyle, styles.containerCentered]
  }

  if (!visible || !popupData) {
    return null
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={[styles.backdrop, position === 'centered' && styles.backdropCentered]}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View style={getContainerStyle()}>
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            {/* Close button (X) */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              testID="sdk-popup-close"
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>

            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Image */}
              {imageUrl && (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.topImage}
                  resizeMode="cover"
                />
              )}

              <View style={styles.body}>
                {/* Title */}
                {title ? (
                  <Text style={styles.title}>{title}</Text>
                ) : null}

                {/* Message */}
                {message ? (
                  <Text style={styles.message}>{message}</Text>
                ) : null}

                {/* Buttons */}
                <View style={styles.buttonsContainer}>
                  {confirmButtonText && (
                    <TouchableOpacity
                      style={[styles.button, styles.confirmButton]}
                      onPress={handleConfirmClick}
                    >
                      <Text style={styles.confirmButtonText}>{confirmButtonText}</Text>
                    </TouchableOpacity>
                  )}
                  
                  {declineButtonText && (
                    <TouchableOpacity
                      style={[styles.button, styles.declineButton]}
                      onPress={handleClose}
                    >
                      <Text style={styles.declineButtonText}>{declineButtonText}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdropCentered: {
    justifyContent: 'center',
  },
  container: {
    width: screenWidth * 0.9,
    maxWidth: 400,
    maxHeight: screenHeight * 0.8,
    minHeight: 140,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 1,
  },
  containerTop: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
  },
  containerBottom: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  },
  containerCentered: {
    alignSelf: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    flexShrink: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
    lineHeight: 24,
  },
  scrollView: {},
  scrollViewContent: {
    padding: 0,
  },
  topImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  body: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: '#E5E5EA',
  },
  declineButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
})
