import { StyleSheet, Dimensions } from 'react-native'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

// Default configuration values
export const DEFAULT_CONFIG = {
  iconSize: 60,
  iconMargin: 8,
  labelWidth: 80,
  fontSize: 12,
  avatarSize: 20,
  storyHeight: 120,
  progressBarHeight: 3,
  progressBarMargin: 2,
  closeButtonSize: 30,
  elementMargin: 16,
}

// Default colors
export const DEFAULT_COLORS = {
  text: '#FFFFFF',
  background: '#000000',
  borderViewed: 'rgba(255, 107, 107, 0.3)', // Same color as borderNotViewed but with transparency
  borderNotViewed: '#FF6B6B',
  backgroundPin: '#FFD93D',
  backgroundProgress: 'rgba(255, 255, 255, 0.3)',
  closeButton: '#FFFFFF',
  placeholder: '#CCCCCC',
  bannerPriceSectionBackground: '#FC6B3F',
  bannerPriceSectionFont: '#FFFFFF',
  bannerOldPriceSectionFont: 'rgba(255, 255, 255, 0.7)',
  bannerPromocodeSectionBackground: '#17AADF',
  bannerPromocodeSectionFont: '#FFFFFF',
  bannerDiscountSectionBackground: '#FBB800',
}

/**
 * Convert hex color to RGB values
 * @param {string} hex - Hex color string (e.g., '#FF0000')
 * @returns {{red: number, green: number, blue: number}} RGB values (0-1)
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    red: parseInt(result[1], 16) / 255,
    green: parseInt(result[2], 16) / 255,
    blue: parseInt(result[3], 16) / 255,
  } : { red: 0, green: 0, blue: 0 }
}

/**
 * Format price with currency
 * @param {number} price - Price value
 * @param {string} currency - Currency code
 * @returns {string} Formatted price string
 */
export function formatPrice(price, currency = '') {
  if (typeof price !== 'number') return ''
  
  const formattedPrice = price.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  
  return currency ? `${formattedPrice} ${currency}` : formattedPrice
}

/**
 * Get slide display duration
 * Match iOS SDK: duration is parsed for all slide types (Int in seconds, default 10)
 * @param {Object} slide - Slide object
 * @returns {number} Duration in milliseconds
 */
export function getDuration(slide) {
  // Use duration for all slide types (not just video), match iOS SDK behavior
  if (slide.duration !== undefined && slide.duration !== null) {
    // Convert from seconds to milliseconds (iOS SDK stores duration in seconds)
    const durationSeconds = typeof slide.duration === 'number' ? slide.duration : parseInt(slide.duration, 10)
    if (!isNaN(durationSeconds) && durationSeconds > 0) {
      return durationSeconds * 1000
    }
  }
  // Default 10 seconds (like iOS SDK), not 8 seconds
  return 10000
}

/**
 * Preload media URL
 * @param {string} url - Media URL
 * @returns {Promise<void>}
 */
export function preloadMedia(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      resolve()
      return
    }
    
    // For images, we can use Image.prefetch
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const { Image } = require('react-native')
      Image.prefetch(url)
        .then(() => resolve())
        .catch(() => resolve()) // Don't fail on preload errors
    } else {
      // For videos, just resolve (preloading handled by video component)
      resolve()
    }
  })
}

/**
 * Get element positioning based on yOffset
 * @param {number} yOffset - Vertical offset percentage
 * @returns {Object} Position styles
 */
export function getElementPosition(yOffset) {
  if (typeof yOffset !== 'number') {
    return { top: '50%', transform: [{ translateY: -50 }] }
  }
  
  const percentage = Math.max(0, Math.min(100, yOffset))
  return {
    top: `${percentage}%`,
    transform: [{ translateY: -50 }],
  }
}

/**
 * Get text alignment style
 * @param {string} alignment - Text alignment ('left', 'center', 'right')
 * @returns {string} React Native text alignment
 */
export function getTextAlignment(alignment) {
  switch (alignment) {
    case 'left':
      return 'left'
    case 'right':
      return 'right'
    case 'center':
    default:
      return 'center'
  }
}

// Shared styles
export const styles = StyleSheet.create({
  // Stories List Styles
  storiesContainer: {
    height: DEFAULT_CONFIG.storyHeight,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storiesList: {
    flexGrow: 0,
    justifyContent: 'flex-start', // Выравнивание по верху для горизонтального списка
    alignItems: 'flex-start', // Выравнивание элементов по верху
    // Can be overridden via contentContainerStyle prop
  },
  storyItem: {
    flexDirection: 'column',
    alignItems: 'center', // Центрирует все элементы по горизонтали
    marginHorizontal: DEFAULT_CONFIG.iconMargin,
    width: Math.max(DEFAULT_CONFIG.iconSize, DEFAULT_CONFIG.labelWidth), // Фиксированная ширина элемента (не меньше iconSize)
    // Кружки будут выровнены по верху через фиксированную структуру
  },
  storyCircle: {
    width: DEFAULT_CONFIG.iconSize,
    height: DEFAULT_CONFIG.iconSize,
    borderRadius: DEFAULT_CONFIG.iconSize / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    // Кружок всегда в начале колонки, выравнивание по верху
  },
  storyCircleViewed: {
    borderColor: DEFAULT_COLORS.borderViewed,
  },
  storyCircleNotViewed: {
    borderColor: DEFAULT_COLORS.borderNotViewed,
  },
  storyAvatar: {
    width: DEFAULT_CONFIG.iconSize - 8,
    height: DEFAULT_CONFIG.iconSize - 8,
    borderRadius: (DEFAULT_CONFIG.iconSize - 8) / 2,
  },
  pinIndicator: {
    position: 'absolute',
    height: 32,
    minWidth: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pinSymbol: {
    fontSize: 16,
    textAlign: 'center',
  },
  storyName: {
    fontSize: DEFAULT_CONFIG.fontSize,
    color: DEFAULT_COLORS.text,
    textAlign: 'center',
    width: DEFAULT_CONFIG.labelWidth, // Фиксированная ширина для центрирования
  },
  storyPlaceholder: {
    backgroundColor: DEFAULT_COLORS.placeholder,
    opacity: 0.3,
  },

  // Product slide title (for slides with a single product)
  productSlideTitleContainer: {
    position: 'absolute',
    top: 106, // Below progress bar + close button
    left: 16,
    right: 52, // Avoid overlap with close button
    zIndex: 12, // Above card, below buttons/progress
  },
  productSlideTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'left',
    lineHeight: 24,
  },

  // Price banner (plain, no discount)
  priceBannerPlain: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 16,
    paddingRight: 16,
    flex: 1,
  },
  priceBannerPlainText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000000',
  },
  
  // Story Viewer Styles
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)', // Dark backdrop that fades to reveal host screen
  },
  storyViewer: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent to show host screen when swiping
  },
  storyViewerContainer: {
    flex: 1,
    position: 'relative',
  },
  progressContainer: {
    position: 'absolute',
    top: 65,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarsWrapper: {
    flex: 1,
    flexDirection: 'row',
    marginRight: 12,
  },
  progressBar: {
    flex: 1,
    height: DEFAULT_CONFIG.progressBarHeight,
    backgroundColor: DEFAULT_COLORS.backgroundProgress,
    marginHorizontal: DEFAULT_CONFIG.progressBarMargin,
    borderRadius: DEFAULT_CONFIG.progressBarHeight / 2,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: DEFAULT_COLORS.text,
    borderRadius: DEFAULT_CONFIG.progressBarHeight / 2,
    alignSelf: 'flex-start',
  },
  closeButton: {
    width: DEFAULT_CONFIG.closeButtonSize,
    height: DEFAULT_CONFIG.closeButtonSize,
    borderRadius: DEFAULT_CONFIG.closeButtonSize / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: DEFAULT_COLORS.closeButton,
    fontSize: 18,
    fontWeight: 'bold',
  },
  volumeButton: {
    position: 'absolute',
    top: 90, // Moved down to avoid overlapping with timeline (timeline is ~0-50px from top)
    left: 16,
    width: DEFAULT_CONFIG.closeButtonSize,
    height: DEFAULT_CONFIG.closeButtonSize,
    borderRadius: DEFAULT_CONFIG.closeButtonSize / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 11,
  },
  volumeButtonIcon: {
    fontSize: 18,
    color: DEFAULT_COLORS.closeButton,
    textAlign: 'center',
    lineHeight: 18,
  },
  
  // Story Slide Styles
  slideContainer: {
    flex: 1,
    position: 'relative',
  },
  slideImage: {
    width: '100%',
    height: '100%',
    // resizeMode will be set in component to 'contain'
  },
  slideVideoContainer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  slideVideo: {
    width: '100%',
    height: '100%',
    // Prevent video from stretching before it's ready
    backgroundColor: 'transparent',
  },
  hiddenMedia: {
    opacity: 0,
    // Keep dimensions for proper loading, just make invisible
    // Image/Video will still load but won't be visible
  },
  hiddenMediaContainer: {
    opacity: 0,
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  slideBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  
  // Story Elements Styles
  elementsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  elementButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16, // Add horizontal margin from screen edges
    minHeight: 44, // Minimum touch target size
  },
  // Fixed positioning styles for buttons (always at bottom)
  elementButtonFixed: {
    position: 'absolute',
    bottom: 18, // Default bottom position
    left: 16,
    right: 16,
    height: 56,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    // backgroundColor will come from element.background (fallback: white)
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20, // Above promocode banner and other elements
    elevation: 20, // For Android
  },
  elementProductsButtonFixed: {
    position: 'absolute',
    bottom: 89, // Above main button when both exist
    left: 66,
    right: 66,
    height: 36,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18, // Rounded button
    // backgroundColor will come from element.background (fallback: white)
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20, // Above promocode banner and other elements
    elevation: 20, // For Android
  },
  elementProductsButtonFixedSingle: {
    position: 'absolute',
    bottom: 28, // When no main button
    left: 66,
    right: 66,
    height: 36,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18, // Rounded button
    // backgroundColor will come from element.background (fallback: white)
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20, // Above promocode banner and other elements
    elevation: 20, // For Android
  },
  elementButtonText: {
    color: DEFAULT_COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  elementText: {
    color: DEFAULT_COLORS.text,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: DEFAULT_CONFIG.elementMargin,
  },
  elementProduct: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: DEFAULT_CONFIG.elementMargin,
    alignItems: 'center',
  },
  elementProductImage: {
    width: 80,
    height: 80,
    borderRadius: 4,
    marginBottom: 8,
  },
  elementProductName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    color: '#000000',
  },
  elementProductPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  
  // Product card on slide (for products element)
  elementProductCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  elementProductCardImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#F5F5F5',
  },
  elementProductCardContent: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  elementProductCardName: {
    fontSize: 16,
    fontWeight: 'normal',
    textAlign: 'left',
    marginBottom: 12,
    color: '#000000',
  },
  elementProductCardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  elementProductCardOldPrice: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#999999',
    textDecorationLine: 'line-through',
    marginRight: 10,
  },
  elementProductCardDiscountBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    height: 20,
    justifyContent: 'center',
  },
  elementProductCardDiscount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  elementProductCardPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  
  // Promocode banner (like iOS)
  promocodeBanner: {
    position: 'absolute',
    bottom: 90, // Above buttons
    left: 16,
    right: 16,
    height: 68,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    zIndex: 9, // Below buttons (buttons have zIndex: 20)
    elevation: 9, // For Android
  },
  promocodeBannerPriceSection: {
    backgroundColor: '#FC6B3F', // Orange like iOS
    flex: 0.8, // 80% width
    paddingLeft: 16,
    paddingRight: 8,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  promocodeBannerOldPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  promocodeBannerPrice: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  promocodeBannerPromoSection: {
    backgroundColor: '#17AADF', // Blue like iOS
    flex: 0.25, // 25% width
    paddingLeft: 0,
    paddingRight: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promocodeBannerDiscountSection: {
    backgroundColor: '#FBB800', // Yellow like iOS when no promocode
  },
  promocodeBannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  promocodeBannerCode: {
    fontSize: 25,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  promocodeBannerDiscount: {
    fontSize: 27,
    fontWeight: '800',
    color: '#000000',
    textAlign: 'center',
  },
  
  // Tap Zones
  tapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 5, // Higher than StorySlide elements but below close button and progress bars
    // Note: pointerEvents handled at component level to allow buttons to be clickable
  },
  tapZoneLeft: {
    left: 0,
    width: '33%',
  },
  tapZoneCenter: {
    left: '33%',
    width: '34%',
  },
  tapZoneRight: {
    right: 0,
    width: '33%',
  },
  
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DEFAULT_COLORS.background,
  },
  loadingText: {
    color: DEFAULT_COLORS.text,
    fontSize: 16,
    marginTop: 16,
  },
  mediaLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Higher z-index to ensure loader is on top
  },
  mediaLoadingBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)', // More opaque background to hide media behind
  },
  
  // Products Carousel Styles
  carouselBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  carouselContainer: {
    backgroundColor: '#F0F0F0', // Light gray background like iOS
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  carouselScrollView: {
    flex: 1,
  },
  carouselScrollContent: {
    paddingTop: 20,
    alignItems: 'flex-start',
  },
  carouselProductCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    alignItems: 'flex-start',
    height: 330, // Approximate height based on iOS (73% of carousel height ~450)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  carouselProductImage: {
    width: '100%',
    height: 165, // Half of card height (330 / 2)
    marginTop: 20,
    marginBottom: 0,
  },
  carouselProductName: {
    fontSize: 14,
    fontWeight: 'normal',
    textAlign: 'left',
    marginLeft: 20,
    marginRight: 8,
    marginTop: 12,
    marginBottom: 14,
    color: '#000000',
    minHeight: 36,
  },
  carouselPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 20,
    marginBottom: 8,
  },
  carouselProductPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 20,
    marginTop: 0,
  },
  carouselProductOldPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    color: '#999999',
    marginRight: 10,
  },
  carouselProductDiscountBadge: {
    backgroundColor: '#FF6B6B',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselProductDiscount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  carouselHideButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  carouselHideButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
})

/**
 * Converts a hex color string to an RGBA object.
 * @param {string} hex - The hex color string (e.g., "#RRGGBB" or "RRGGBB").
 * @param {number} [alpha=1] - The alpha value (0-1).
 * @returns {{r: number, g: number, b: number, a: number}}
 */
export function hexToRgba(hex, alpha = 1) {
  let c
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('')
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]]
    }
    c = '0x' + c.join('')
    return {
      r: (c >> 16) & 255,
      g: (c >> 8) & 255,
      b: c & 255,
      a: alpha,
    }
  }
  // Fallback for invalid hex or other color formats
  return { r: 0, g: 0, b: 0, a: alpha }
}

/**
 * Extracts numeric ID for API tracking from story/slide ID.
 * Handles both numeric IDs and string IDs with numeric suffixes.
 * @param {string|number} id - The ID to extract numeric value from
 * @param {string|number} [ids] - Optional numeric IDs field
 * @returns {number} - Numeric ID for API calls
 */
export function extractNumericId(id, ids) {
  // Use numeric ids field if available and it's a positive number
  if (ids !== undefined && ids !== null) {
    const numericIds = Number(ids)
    // Only use ids if it's a valid positive number
    if (!isNaN(numericIds) && numericIds > 0) {
      return numericIds
    }
  }
  
  // If id is already a number, return it (if positive)
  if (typeof id === 'number') {
    if (id > 0) {
      return id
    }
  }
  
  // If id is a string, try to extract numeric part
  if (typeof id === 'string') {
    // Handle formats like "66_3" -> extract "3"
    const parts = id.split('_')
    if (parts.length > 1) {
      const numericPart = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(numericPart) && numericPart > 0) {
        return numericPart
      }
    }
    
    // Try to parse the entire string as a number
    const numericId = parseInt(id, 10)
    if (!isNaN(numericId) && numericId > 0) {
      return numericId
    }
  }
  
  // Fallback: return 0 if we can't extract a valid positive number
  return 0
}

/**
 * Extracts slide ID for tracking based on slide ID type.
 * If slide ID is a string, returns slideIndex + 1.
 * If slide ID is a number, returns the ID as is.
 * @param {string|number} slideId - The slide ID
 * @param {number} slideIndex - The index of the slide in the slides array
 * @returns {number} - Slide ID for API tracking (slideIndex + 1 for string IDs)
 */
export function extractSlideIdForTracking(slideId, slideIndex) {
  // If slideId is a string, use slideIndex + 1
  if (typeof slideId === 'string') {
    return slideIndex + 1
  }
  
  // If slideId is a number, use it as is
  if (typeof slideId === 'number') {
    return slideId
  }
  
  // Fallback: use slideIndex + 1
  return slideIndex + 1
}

/**
 * Safely extracts a color from settings object with fallback.
 * @param {Object|null} settings - Settings object from API
 * @param {string} key - Color key to extract (e.g., 'borderViewed', 'closeColor')
 * @param {string} fallback - Fallback color to use if setting is missing
 * @returns {string} - Color value (hex or rgba string)
 */
function toSnakeCaseKey(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

export function getColorFromSettings(settings, key, fallback) {
  if (!settings || typeof settings !== 'object') {
    return fallback
  }
  
  const color = settings[key]
  const snakeColor = settings[toSnakeCaseKey(key)]
  
  // Check if color exists and is a non-empty string
  if (color && typeof color === 'string' && color.trim() !== '') {
    return color
  }

  if (snakeColor && typeof snakeColor === 'string' && snakeColor.trim() !== '') {
    return snakeColor
  }
  
  return fallback
}

/**
 * Safely extracts a color from element object with fallback.
 * Matches iOS SDK behavior for button and text colors.
 * @param {Object|null} element - Element object from API
 * @param {string} key - Color key to extract (e.g., 'color', 'background', 'textColor')
 * @param {string} fallback - Fallback color to use if element color is missing
 * @returns {string} - Color value (hex or rgba string)
 */
export function getColorFromElement(element, key, fallback) {
  if (!element || typeof element !== 'object') {
    return fallback
  }
  
  const color = element[key]
  
  // Check if color exists and is a non-empty string
  if (color && typeof color === 'string' && color.trim() !== '') {
    return color
  }
  
  return fallback
}
