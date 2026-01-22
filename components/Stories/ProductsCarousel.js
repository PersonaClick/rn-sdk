import React, { useEffect, useRef, memo } from 'react'
import {
  View,
  Modal,
  Text,
  Pressable,
  Image,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
  Linking,
} from 'react-native'
import { styles, formatPrice, getColorFromSettings, DEFAULT_COLORS } from './styles'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

/**
 * ProductsCarousel Component
 * Modal carousel for displaying products horizontally
 * 
 * @param {Object} props
 * @param {boolean} props.visible - Whether carousel is visible
 * @param {StoriesProduct[]} props.products - Array of products to display
 * @param {string} [props.hideLabel] - Label for hide button
 * @param {Function} props.onClose - Callback when carousel is closed
 * @param {Function} props.onProductPress - Callback when product is pressed
 * @param {Object} [props.settings] - Stories settings from API (colors, etc.)
 */
function ProductsCarousel({
  visible,
  products = [],
  hideLabel = 'Скрыть',
  onClose,
  onProductPress,
  settings,
}) {
  const slideAnim = useRef(new Animated.Value(screenHeight)).current

  useEffect(() => {
    if (visible) {
      // Animate carousel sliding up from bottom
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start()
    } else {
      // Reset animation when hidden
      slideAnim.setValue(screenHeight)
    }
  }, [visible])

  const handleProductPress = (product) => {
    // Determine which URL to use based on platform
    let urlToOpen = null
    
    if (Platform.OS === 'ios') {
      urlToOpen = product.deeplinkIos || product.url
    } else if (Platform.OS === 'android') {
      urlToOpen = product.deeplinkAndroid || product.url
    } else {
      // Fallback for other platforms
      urlToOpen = product.url
    }

    if (urlToOpen) {
      Linking.openURL(urlToOpen).catch((err) => {
        console.warn('Failed to open URL:', err)
      })
    }

    // Call callback
    onProductPress?.(product)
    
    // Close carousel
    onClose?.()
  }

  const handleBackdropPress = () => {
    onClose?.()
  }

  if (!visible || !products || products.length === 0) {
    return null
  }

  // Calculate carousel height based on device (like iOS)
  let carouselHeight = 450
  if (screenHeight < 700) {
    carouselHeight = 420
  } else if (screenHeight > 900) {
    carouselHeight = 450
  }

  // Calculate product card width (like iOS: (screenWidth - 40 - 40 - 5) / 1.4)
  const leftRightPadding = 40
  const spacing = 10
  const cardWidth = (screenWidth - leftRightPadding * 2 - spacing / 2) / 1.4

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        style={styles.carouselBackdrop}
        onPress={handleBackdropPress}
      >
        <Animated.View
          style={[
            styles.carouselContainer,
            {
              height: carouselHeight,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Carousel content with bottom padding for button */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.carouselScrollContent,
              {
                paddingLeft: leftRightPadding,
                paddingRight: leftRightPadding,
                paddingBottom: 60, // Space for hide button
              },
            ]}
            style={styles.carouselScrollView}
          >
            {products.map((product, index) => (
              <Pressable
                key={index}
                style={[
                  styles.carouselProductCard,
                  {
                    width: cardWidth,
                    marginRight: index < products.length - 1 ? spacing : 0,
                  },
                ]}
                onPress={() => handleProductPress(product)}
              >
                <Image
                  source={{ uri: product.picture }}
                  style={styles.carouselProductImage}
                  resizeMode="contain"
                />
                <Text style={styles.carouselProductName} numberOfLines={2}>
                  {product.name}
                </Text>
                
                {/* Price row */}
                <View style={styles.carouselPriceRow}>
                  {/* Old price */}
                  {product.oldprice && product.oldprice > 0 && product.oldprice > product.price && (
                    <>
                      <Text style={[
                        styles.carouselProductOldPrice,
                        {
                          color: getColorFromSettings(
                            settings,
                            'productOldPriceColor',
                            '#999999'
                          )
                        }
                      ]}>
                        {product.oldprice_formatted || formatPrice(product.oldprice, product.currency)}
                      </Text>
                      {/* Discount badge */}
                      {product.discount_formatted && 
                       product.discount_formatted !== '0%' && 
                       product.discount_formatted !== null && (
                        <View style={[
                          styles.carouselProductDiscountBadge,
                          {
                            backgroundColor: getColorFromSettings(
                              settings,
                              'productDiscountBackground',
                              '#FF6B6B'
                            )
                          }
                        ]}>
                          <Text style={styles.carouselProductDiscount}>
                            -{product.discount_formatted}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
                
                {/* Current price */}
                <Text style={[
                  styles.carouselProductPrice,
                  {
                    color: getColorFromSettings(
                      settings,
                      'productPriceColor',
                      '#000000'
                    )
                  }
                ]}>
                  {product.price_formatted || formatPrice(product.price, product.currency)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Hide button */}
          <Pressable
            style={styles.carouselHideButton}
            onPress={onClose}
          >
            <Text style={styles.carouselHideButtonText}>
              {hideLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

export default memo(ProductsCarousel)

