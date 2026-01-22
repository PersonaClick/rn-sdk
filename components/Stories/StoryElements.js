import React from 'react'
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
} from 'react-native'
import { styles, formatPrice, getElementPosition, getTextAlignment, getColorFromElement, getColorFromSettings, DEFAULT_COLORS } from './styles'

/**
 * StoryElements Component
 * Renders interactive elements over a story slide
 * 
 * @param {Object} props
 * @param {StoriesElement[]} props.elements - Array of story elements
 * @param {Function} props.onElementPress - Callback when element is pressed
 * @param {Object} [props.style] - Additional styles
 * @param {Object} [props.settings] - Stories settings from API (colors, etc.)
 * @param {Object} [props.slide] - Slide object with settings (for button titles, etc.)
 */
export default function StoryElements({ elements = [], onElementPress, style, settings, slide }) {
  if (!elements || elements.length === 0) {
    return null
  }


  // Check if there's a main button (type === 'button')
  const hasMainButton = elements.some(el => el.type === 'button')
  
  // Separate buttons from other elements
  const buttons = []
  const otherElements = []
  const productsToShow = [] // Products to show on slide (for products type only)
  const promocodeBanners = [] // Separate promocode banners
  let productsElement = null

  elements.forEach((element, index) => {
    if (element.type === 'button') {
      buttons.push({ element, index })
    } else if (element.type === 'products') {
      // Store products element for debug
      if (!productsElement) {
        productsElement = element
      }
      
      // Products element: show product on slide only if slide type is 'products' AND exactly one product
      // For other slide types (image, video), products are shown only in carousel
      const productsArray = element.products || element.items || []
      const isProductsSlide = slide?.type === 'products'
      if (isProductsSlide && productsArray.length === 1) {
        // Add products to show on slide (only for products slide type)
        productsToShow.push({ element, index })
        // Always show bottom price banner for single-product slides
        promocodeBanners.push({ element, index, product: productsArray[0] })
      }
      // Always add button for opening carousel (if there are products)
      if (productsArray.length > 0) {
        buttons.push({ element, index })
      }
    } else if (element.type === 'product') {
      // Product element (promocode) - show product card on slide + button for carousel
      const productData = element.item || element.product
      if (productData) {
        const product = productData
        
        // Add product card to otherElements to show on slide
        otherElements.push({ element, index })
        
        // Always show bottom price banner for product slides (price should not be inside the card)
        promocodeBanners.push({ element, index, product })
        
        // Add button for opening carousel (if needed)
        // Note: For product type, button might not be needed if product is shown on slide
      } else {
        otherElements.push({ element, index })
      }
    } else {
      otherElements.push({ element, index })
    }
  })

  const renderButton = ({ element, index }) => {
    if (element.type === 'button') {
      // Main button - always at bottom
      // Match iOS SDK: element.background -> white fallback, element.color -> black fallback
      const buttonBackground = getColorFromElement(element, 'background', '#FFFFFF')
      const buttonTextColor = getColorFromElement(element, 'color', '#000000')
      
      return (
        <Pressable
          key={index}
          style={[
            styles.elementButtonFixed,
            { backgroundColor: buttonBackground }
          ]}
          onPress={() => onElementPress?.(element)}
        >
          <Text
            style={[
              styles.elementButtonText,
              {
                color: buttonTextColor,
                fontSize: element.fontSize || styles.elementButtonText.fontSize,
                fontWeight: element.textBold ? 'bold' : 'normal',
                fontStyle: element.textItalic ? 'italic' : 'normal',
              },
            ]}
          >
            {element.title || 'Button'}
          </Text>
        </Pressable>
      )
    } else if (element.type === 'products') {
      // Products button - above main button if exists, otherwise lower
      const buttonStyle = hasMainButton 
        ? styles.elementProductsButtonFixed 
        : styles.elementProductsButtonFixedSingle
      
      // Get button title from slide settings (priority) or element labels (fallback)
      // Support both snake_case (from server) and camelCase formats
      // Priority: slide.settings?.labels?.showCarousel/show_carousel -> slide.settings?.buttonTitle/button_title -> element.labels?.showCarousel/show_carousel -> 'Посмотреть'
      const buttonText = slide?.settings?.labels?.showCarousel 
        || slide?.settings?.labels?.show_carousel
        || slide?.settings?.buttonTitle
        || slide?.settings?.button_title
        || element.labels?.showCarousel
        || element.labels?.show_carousel
        || 'Посмотреть'
      
      // Match iOS SDK: element.background -> white fallback, element.color -> black fallback
      const buttonBackground = getColorFromElement(element, 'background', '#FFFFFF')
      const buttonTextColor = getColorFromElement(element, 'color', '#000000')
      
      // Use productsElement if available, otherwise try to find original element from elements array
      const elementWithProducts = productsElement || elements.find(el => el.type === 'products' && el.products) || element
      
      return (
        <Pressable
          key={index}
          style={[
            buttonStyle,
            { backgroundColor: buttonBackground }
          ]}
          onPress={() => {
            console.log('[StoryElements] Products button pressed:', {
              elementType: element.type,
              elementHasProducts: !!element.products,
              elementProductsLength: element.products?.length,
              productsElementHasProducts: !!productsElement?.products,
              productsElementProductsLength: productsElement?.products?.length,
              elementWithProductsHasProducts: !!elementWithProducts.products,
              elementWithProductsProductsLength: elementWithProducts.products?.length,
            })
            // Use elementWithProducts to ensure we have products
            console.log('[StoryElements] Passing element to onElementPress:', {
              type: elementWithProducts.type,
              hasProducts: !!elementWithProducts.products,
              productsLength: elementWithProducts.products?.length,
            })
            onElementPress?.(elementWithProducts)
          }}
        >
          <Text
            style={[
              styles.elementButtonText,
              {
                color: buttonTextColor,
                fontSize: element.fontSize || 14,
                fontWeight: element.textBold ? 'bold' : 'bold',
                fontStyle: element.textItalic ? 'italic' : 'normal',
              },
            ]}
          >
            {buttonText}
          </Text>
        </Pressable>
      )
    }
    return null
  }

  const renderElement = ({ element, index }) => {
    // Support both camelCase and snake_case for yOffset
    const yOffset = element.yOffset !== undefined ? element.yOffset : element.y_offset
    // Convert to number if it's a string
    const yOffsetNum = typeof yOffset === 'string' ? parseFloat(yOffset) : yOffset
    const elementStyle = {
      ...getElementPosition(yOffsetNum),
    }

    switch (element.type) {

      case 'text_block':
        // Support both camelCase and snake_case from API
        const textInput = element.textInput || element.text_input || ''
        
        
        // Skip rendering if no text content
        if (!textInput || textInput.trim() === '') {
          if (__DEV__) {
            console.warn('[StoryElements] text_block element has no textInput:', element)
          }
          return null
        }
        
        // Match iOS SDK: element.textColor -> black fallback
        const textColor = getColorFromElement(element, 'textColor', '#000000')
        // Background with opacity (iOS SDK uses textBackgroundColor with opacity -> clear fallback)
        const textBgColorRaw = element.textBackgroundColor || element.text_background_color
        const textBgOpacityRaw = element.textBackgroundColorOpacity || element.text_background_color_opacity || '80'
        
        // Check if background color exists and is not empty string
        const hasTextBackground = textBgColorRaw && typeof textBgColorRaw === 'string' && textBgColorRaw.trim() !== '' && textBgColorRaw !== 'transparent' && textBgColorRaw !== 'clear'
        
        let textBgColor = undefined
        if (hasTextBackground) {
          // Convert opacity to hex if needed
          let opacityHex = textBgOpacityRaw
          if (typeof textBgOpacityRaw === 'number') {
            // Convert 0-1 range to 0-255 hex
            opacityHex = Math.round(textBgOpacityRaw * 255).toString(16).padStart(2, '0')
          } else if (typeof textBgOpacityRaw === 'string') {
            // If it's a percentage like "80%", convert to hex
            if (textBgOpacityRaw.endsWith('%')) {
              const percent = parseFloat(textBgOpacityRaw)
              opacityHex = Math.round((percent / 100) * 255).toString(16).padStart(2, '0')
            }
            // If it's already hex (like "80"), use as is
          }
          
          // Combine hex color with opacity (React Native format: #RRGGBBAA)
          textBgColor = `${textBgColorRaw}${opacityHex}`
        }
        
        
        // Support both camelCase and snake_case for all fields
        // Convert fontSize to number (API may return string)
        const fontSizeRaw = element.fontSize !== undefined ? element.fontSize : element.font_size
        const fontSize = typeof fontSizeRaw === 'string' ? parseFloat(fontSizeRaw) || undefined : fontSizeRaw
        const fontSizeNum = (typeof fontSize === 'number' && fontSize > 0) ? fontSize : styles.elementText.fontSize
        
        const textBold = element.textBold !== undefined ? element.textBold : (element.text_bold !== undefined ? element.text_bold : element.bold)
        const textItalic = element.textItalic !== undefined ? element.textItalic : (element.text_italic !== undefined ? element.text_italic : element.italic)
        const textAlignment = element.textAlignment || element.text_align
        
        // Convert textLineSpacing to number (API may return string)
        const textLineSpacingRaw = element.textLineSpacing !== undefined ? element.textLineSpacing : element.text_line_spacing
        const textLineSpacing = typeof textLineSpacingRaw === 'string' ? parseFloat(textLineSpacingRaw) || undefined : textLineSpacingRaw
        
        // Add minimum top offset to avoid progress bar overlap
        // Status bar (~24-30px) + Progress bar area (top: 65, height ~3px) + Close button (~40px) + Safe margin
        // Match iOS SDK approach: add safe area offset for text blocks
        const MIN_TOP_OFFSET = 150 // Safe area to avoid status bar, progress bar and close button
        
        // Adjust top position: if yOffset is small (near top), add minimum offset
        // If yOffset is percentage and small, convert to pixels with minimum
        let adjustedTop = elementStyle.top
        if (typeof yOffsetNum === 'number' && yOffsetNum < 20) {
          // Small yOffset (near top) - use minimum offset in pixels
          adjustedTop = MIN_TOP_OFFSET
        } else if (typeof adjustedTop === 'string' && adjustedTop.endsWith('%')) {
          // Percentage-based: check if it's too close to top
          const percentage = parseFloat(adjustedTop)
          if (percentage < 20) {
            adjustedTop = MIN_TOP_OFFSET
          }
        } else if (typeof adjustedTop === 'number' && adjustedTop < MIN_TOP_OFFSET) {
          adjustedTop = MIN_TOP_OFFSET
        }
        
        // Match iOS SDK: wrap Text in View with background container
        // backgroundColor goes on View, not Text
        // Padding: 8px top/bottom, 16px left/right if background exists
        // Margin: 16px left/right from screen edges (like iOS SDK stackView)
        const hasBackground = !!textBgColor
        
        return (
          <View
            key={index}
            style={[
              {
                ...elementStyle,
                top: adjustedTop,
                // Add horizontal margins like iOS SDK stackView (16px from safeAreaLayoutGuide)
                marginLeft: 16,
                marginRight: 16,
              },
              hasBackground && {
                backgroundColor: textBgColor,
                borderRadius: 4,
                paddingTop: 8,
                paddingBottom: 8,
                paddingLeft: 16,
                paddingRight: 16,
              },
            ]}
          >
            <Text
              style={[
                styles.elementText,
                {
                  color: textColor,
                  fontSize: fontSizeNum,
                  fontWeight: textBold ? 'bold' : 'normal',
                  fontStyle: textItalic ? 'italic' : 'normal',
                  textAlign: getTextAlignment(textAlignment),
                  lineHeight: textLineSpacing ? 
                    fontSizeNum * textLineSpacing : 
                    undefined,
                  // Remove backgroundColor from Text - it's on View now
                  paddingHorizontal: hasBackground ? 0 : styles.elementText.paddingHorizontal,
                  paddingVertical: 0,
                },
              ]}
            >
              {textInput}
            </Text>
          </View>
        )

      case 'product':
        // In iOS SDK, product data comes from "item" field, not "product"
        const productData = element.item || element.product
        if (productData) {
          // Product slide: title above card; card contains only photo; price is rendered in bottom banner
          const product = productData
          
          // Use yOffset if provided, otherwise center the card (like iOS)
          const productCardStyle = element.yOffset !== undefined && element.yOffset !== null
            ? elementStyle
            : {
                position: 'absolute',
                top: 170, // Below title
                left: 16,
                right: 16,
                width: 'auto',
              }
          
          return (
            <View key={index} pointerEvents="box-none">
              {/* Product title above card (like screenshot) */}
              <Pressable
                style={styles.productSlideTitleContainer}
                onPress={() => onElementPress?.(element)}
              >
                <Text style={styles.productSlideTitle} numberOfLines={2}>
                  {product.name}
                </Text>
              </Pressable>

              {/* Product card (photo only) */}
              <Pressable
                style={[productCardStyle, styles.elementProductCard]}
                onPress={() => onElementPress?.(element)}
              >
                <Image
                  source={{ uri: product.picture || product.image_url }}
                  style={styles.elementProductCardImage}
                  resizeMode="contain"
                />
              </Pressable>
            </View>
          )
        }
        return null

      default:
        return null
    }
  }

  const renderProductsOnSlide = ({ element, index }) => {
    if (!element.products || element.products.length === 0) {
      return null
    }

    // Show product card on slide only if there's exactly one product (for products type)
    if (element.products.length !== 1) {
      return null
    }

    // Show first product as main card on slide
    const firstProduct = element.products[0]
    if (!firstProduct) {
      return null
    }

    // Use yOffset if provided, otherwise center the card
    const elementStyle = element.yOffset !== undefined && element.yOffset !== null
      ? getElementPosition(element.yOffset)
      : {
          position: 'absolute',
          top: 170, // Below title
          left: 16,
          right: 16,
          width: 'auto',
        }

    return (
      <View key={`products-wrapper-${index}`} pointerEvents="box-none">
        {/* Product title above card (like iOS) */}
        <Pressable
          style={styles.productSlideTitleContainer}
          onPress={() => onElementPress?.(element)}
        >
          <Text style={styles.productSlideTitle} numberOfLines={2}>
            {firstProduct.name}
          </Text>
        </Pressable>

        {/* Product card (photo only; price is in bottom banner) */}
        <Pressable
          key={`products-${index}`}
          style={[elementStyle, styles.elementProductCard]}
          onPress={() => onElementPress?.(element)}
        >
          <Image
            source={{ uri: firstProduct.picture }}
            style={styles.elementProductCardImage}
            resizeMode="contain"
          />
        </Pressable>
      </View>
    )
  }


  const renderPromocodeBanner = ({ element, index, product }) => {
    // Get colors from settings (using product_* keys from API)
    const priceSectionBackground = getColorFromSettings(
      settings,
      'productPriceBackground',
      DEFAULT_COLORS.bannerPriceSectionBackground
    )
    const priceSectionFontColor = getColorFromSettings(
      settings,
      'productPriceColor',
      DEFAULT_COLORS.bannerPriceSectionFont
    )
    const oldPriceSectionFontColor = getColorFromSettings(
      settings,
      'productOldPriceColor',
      DEFAULT_COLORS.bannerOldPriceSectionFont
    )
    const promocodeSectionBackground = getColorFromSettings(
      settings,
      'productPromocodeBackground',
      DEFAULT_COLORS.bannerPromocodeSectionBackground
    )
    const promocodeSectionFontColor = getColorFromSettings(
      settings,
      'bannerPromocodeSectionFontColor',
      DEFAULT_COLORS.bannerPromocodeSectionFont
    )
    const discountSectionBackground = getColorFromSettings(
      settings,
      'productDiscountBackground',
      DEFAULT_COLORS.bannerDiscountSectionBackground
    )
    // Colors for plain banner (when no discount/promocode)
    const plainBannerBackground = getColorFromSettings(
      settings,
      'productPriceBackground',
      '#FFFFFF'
    )
    const plainBannerTextColor = getColorFromSettings(
      settings,
      'productPriceColor',
      '#000000'
    )
    const hasPromocode = product.promocode && product.promocode !== ''
    // products items may provide discount as discount_percent (number) or discount_formatted (string like "10%")
    const discountPercentFromNumber =
      typeof product.discount_percent === 'number' ? product.discount_percent : Number(product.discount_percent)
    const discountPercentFromFormatted =
      typeof product.discount_formatted === 'string'
        ? Number(String(product.discount_formatted).replace('%', '').trim())
        : Number(product.discount_formatted)
    const normalizedDiscountPercent =
      Number.isFinite(discountPercentFromNumber) && discountPercentFromNumber > 0
        ? discountPercentFromNumber
        : Number.isFinite(discountPercentFromFormatted) && discountPercentFromFormatted > 0
          ? discountPercentFromFormatted
          : 0
    const hasDiscount = normalizedDiscountPercent > 0
    const hasOldPrice = product.oldprice && product.oldprice > 0 && product.oldprice > product.price

    // Requirement: price banner should be colored only when there is a discount.
    // If there is no discount and no promocode, show a plain white banner with black text.
    const useColoredBanner = hasDiscount || hasOldPrice
    const usePlainBanner = !useColoredBanner && !hasPromocode
    
    const priceText =
      product.price_with_promocode_formatted ||
      product.price_formatted ||
      formatPrice(product.price, product.currency)

    if (usePlainBanner) {
      return (
        <View key={`promocode-banner-${index}`} style={styles.promocodeBanner}>
          <View style={[
            styles.priceBannerPlain,
            { backgroundColor: plainBannerBackground }
          ]}>
            <Text style={[
              styles.priceBannerPlainText,
              { color: plainBannerTextColor }
            ]}>{priceText}</Text>
          </View>
        </View>
      )
    }

    return (
      <View key={`promocode-banner-${index}`} style={styles.promocodeBanner}>
        {/* Price section (left) - orange background */}
        <View
          style={[
            styles.promocodeBannerPriceSection,
            !useColoredBanner && { backgroundColor: plainBannerBackground },
            useColoredBanner && { backgroundColor: priceSectionBackground },
          ]}
        >
          {useColoredBanner && hasOldPrice && (
            <Text
              style={[
                styles.promocodeBannerOldPrice,
                { color: oldPriceSectionFontColor },
              ]}
            >
              {product.oldprice_formatted || formatPrice(product.oldprice, product.currency)}
            </Text>
          )}
          <Text
            style={[
              styles.promocodeBannerPrice,
              !useColoredBanner && { color: plainBannerTextColor },
              useColoredBanner && { color: priceSectionFontColor },
            ]}
          >
            {priceText}
          </Text>
        </View>
        
        {/* Promocode/Discount section (right) */}
        <Pressable
          style={[
            styles.promocodeBannerPromoSection,
            !hasPromocode && styles.promocodeBannerDiscountSection,
            hasPromocode && { backgroundColor: promocodeSectionBackground },
            !hasPromocode && { backgroundColor: discountSectionBackground },
          ]}
          onPress={() => {
            // Copy promocode to clipboard if available
            if (hasPromocode && product.promocode) {
              // Note: Clipboard API would need to be imported
              // Clipboard.setString(product.promocode)
            }
            onElementPress?.(element)
          }}
        >
          {hasPromocode ? (
            <>
              {element.title && (
                <Text
                  style={[
                    styles.promocodeBannerTitle,
                    { color: promocodeSectionFontColor },
                  ]}
                >
                  {element.title}
                </Text>
              )}
              <Text
                style={[
                  styles.promocodeBannerCode,
                  { color: promocodeSectionFontColor },
                ]}
              >
                {product.promocode}
              </Text>
            </>
          ) : hasDiscount ? (
            <Text style={styles.promocodeBannerDiscount}>
              -{normalizedDiscountPercent}%
            </Text>
          ) : null}
        </Pressable>
      </View>
    )
  }


  return (
    <View style={[styles.elementsContainer, style]} pointerEvents="box-none">
      {/* Render other elements (text_block) with yOffset positioning */}
      {otherElements.map(({ element, index }) => renderElement({ element, index })).filter(Boolean)}
      {/* Render products on slide (for products type only, if exactly one product) */}
      {productsToShow.map(({ element, index }) => renderProductsOnSlide({ element, index }))}
      {/* Render promocode banners at bottom (fixed positioning) */}
      {promocodeBanners.map(({ element, index, product }) => renderPromocodeBanner({ element, index, product }))}
      {/* Render buttons at bottom (fixed positioning) */}
      {buttons.map(({ element, index }) => renderButton({ element, index }))}
    </View>
  )
}
