/**
 * @typedef {Object} StoryContent
 * @property {string} id - Story content identifier
 * @property {StoriesSettings} settings - Story display settings
 * @property {Story[]} stories - Array of stories
 */

/**
 * @typedef {Object} StoriesSettings
 * @property {string} color - Text color
 * @property {number} fontSize - Font size
 * @property {number} avatarSize - Avatar size
 * @property {string} closeColor - Close button color
 * @property {string} borderViewed - Viewed story border color
 * @property {string} backgroundPin - Pinned story background color
 * @property {string} borderNotViewed - Unviewed story border color
 * @property {string} backgroundProgress - Progress bar background color
 * @property {string} pinSymbol - Pin symbol
 */

/**
 * @typedef {Object} Story
 * @property {string} id - Story identifier
 * @property {number} ids - Story numeric identifier
 * @property {string} name - Story name/title
 * @property {string} avatar - Avatar image URL
 * @property {boolean} viewed - Whether story has been viewed
 * @property {boolean} pinned - Whether story is pinned
 * @property {number} startPosition - Starting slide position
 * @property {Slide[]} slides - Array of slides
 */

/**
 * @typedef {Object} Slide
 * @property {string} id - Slide identifier
 * @property {number} ids - Slide numeric identifier
 * @property {SlideType} type - Slide type (image/video)
 * @property {number} duration - Slide duration in seconds
 * @property {string} background - Background image/video URL
 * @property {string} backgroundColor - Background color fallback
 * @property {string} [preview] - Preview image URL for video slides
 * @property {StoriesElement[]} elements - Interactive elements
 */

/**
 * @typedef {Object} StoriesElement
 * @property {ElementType} type - Element type
 * @property {string} [link] - Web link URL
 * @property {string} [deeplinkIos] - iOS deeplink URL
 * @property {string} [deeplinkAndroid] - Android deeplink URL
 * @property {string} [linkIos] - iOS link URL
 * @property {string} [linkAndroid] - Android link URL
 * @property {string} [title] - Button title
 * @property {string} [textInput] - Text content
 * @property {string} [textColor] - Text color
 * @property {string} [textBackgroundColor] - Text background color
 * @property {string} [color] - Element color
 * @property {string} [background] - Element background
 * @property {number} [cornerRadius] - Corner radius
 * @property {boolean} [textBold] - Bold text flag
 * @property {boolean} [textItalic] - Italic text flag
 * @property {number} [fontSize] - Font size
 * @property {string} [fontType] - Font type
 * @property {string} [textAlignment] - Text alignment
 * @property {number} [textLineSpacing] - Line spacing
 * @property {number} [yOffset] - Vertical offset
 * @property {StoriesProduct[]} [products] - Product carousel items
 * @property {StoriesPromoCodeElement} [product] - Promocode product
 * @property {Object} [labels] - Labels for buttons
 * @property {string} [labels.showCarousel] - Label for show carousel button
 * @property {string} [labels.hideCarousel] - Label for hide carousel button
 */

/**
 * @typedef {Object} StoriesProduct
 * @property {string} name - Product name
 * @property {string} currency - Currency code
 * @property {number} price - Product price
 * @property {number} price_full - Full price
 * @property {string} price_formatted - Formatted price
 * @property {string} price_full_formatted - Formatted full price
 * @property {number} [oldprice] - Old price
 * @property {string} oldprice_formatted - Formatted old price
 * @property {string} picture - Product image URL
 * @property {string} [discount] - Discount percentage
 * @property {string} [discount_formatted] - Formatted discount
 * @property {StoriesCategory} category - Product category
 * @property {string} url - Product URL
 * @property {string} deeplinkIos - iOS deeplink
 * @property {string} [deeplinkAndroid] - Android deeplink
 */

/**
 * @typedef {Object} StoriesPromoCodeElement
 * @property {string} id - Product ID
 * @property {string} name - Product name
 * @property {string} brand - Brand name
 * @property {string} currency - Currency code
 * @property {number} price - Product price
 * @property {string} price_formatted - Formatted price
 * @property {string} price_full_formatted - Formatted full price
 * @property {number} oldprice - Old price
 * @property {string} oldprice_formatted - Formatted old price
 * @property {string} picture - Product image URL
 * @property {string} url - Product URL
 * @property {string} deeplinkIos - iOS deeplink
 * @property {number} discount_percent - Discount percentage
 * @property {string} price_with_promocode_formatted - Price with promocode
 * @property {string} promocode - Promocode string
 */

/**
 * @typedef {Object} StoriesCategory
 * @property {string} name - Category name
 * @property {string} url - Category URL
 */

/**
 * @typedef {'image'|'video'|'unknown'} SlideType
 */

/**
 * @typedef {'button'|'product'|'text_block'|'unknown'} ElementType
 */

/**
 * @typedef {'left'|'right'|'center'} TextAlignment
 */

/**
 * @typedef {'monospaced'|'serif'|'sans-serif'|'unknown'} FontType
 */

export {
  // Types are exported for JSDoc usage
}
