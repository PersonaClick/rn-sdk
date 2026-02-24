'use strict';

/**
 * Cart item from products/cart API.
 * @typedef {Object} CartItem
 * @property {string} productId - Product unique id (from API uniqid).
 * @property {number} quantity - Item quantity.
 */

/**
 * Parses a single cart item from API response (uniqid, quantity).
 * @param {Record<string, any>} json - Raw item from data.items.
 * @returns {CartItem}
 */
export function parseCartItem(json) {
  if (!json || typeof json !== 'object') {
    return { productId: '', quantity: 1 };
  }
  return {
    productId: json.uniqid ?? json.id ?? '',
    quantity: typeof json.quantity === 'number' ? json.quantity : 1,
  };
}

/**
 * Category (used in ProductInfo).
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} name
 * @property {string} [url]
 * @property {string} [alias]
 * @property {string} [parentId]
 * @property {number} [count]
 */

function parseCategory(json) {
  if (!json || typeof json !== 'object') return { id: '', name: '' };
  return {
    id: json.id ?? '',
    name: json.name ?? '',
    url: json.url,
    alias: json.alias,
    parentId: json.parent ?? json.parentId,
    count: json.count,
  };
}

/**
 * Filter (used in ProductsListResponse).
 * @typedef {Object} Filter
 * @property {number} count
 * @property {Record<string, number>} values
 */
function parseFilter(json) {
  if (!json || typeof json !== 'object') return { count: 0, values: {} };
  return {
    count: json.count ?? 0,
    values: json.values && typeof json.values === 'object' ? json.values : {},
  };
}

/**
 * Price range (used in ProductsListResponse).
 * @typedef {Object} PriceRange
 * @property {number} min
 * @property {number} max
 */
function parsePriceRange(json) {
  if (!json || typeof json !== 'object') return { min: 0, max: 0 };
  return {
    min: typeof json.min === 'number' ? json.min : 0,
    max: typeof json.max === 'number' ? json.max : 0,
  };
}

/**
 * Product (short form in list responses).
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} [barcode]
 * @property {string} name
 * @property {string} brand
 * @property {string} [model]
 * @property {string} [description]
 * @property {string} imageUrl
 * @property {string} resizedImageUrl
 * @property {Record<string, string>} [resizedImages]
 * @property {string} url
 * @property {string} [deeplinkIos]
 * @property {number} price
 * @property {string} priceFormatted
 * @property {number} [priceFull]
 * @property {string} [priceFullFormatted]
 * @property {number} [oldPrice]
 * @property {string} [oldPriceFormatted]
 * @property {number} [oldPriceFull]
 * @property {string} [oldPriceFullFormatted]
 * @property {string} currency
 * @property {number} [salesRate]
 * @property {number} [discount]
 * @property {number} [relativeSalesRate]
 * @property {boolean} [isNew]
 * @property {Array<Record<string, any>>} [params]
 */
export function parseProduct(json) {
  if (!json || typeof json !== 'object') {
    return {
      id: '',
      name: '',
      brand: '',
      imageUrl: '',
      resizedImageUrl: '',
      resizedImages: {},
      url: '',
      deeplinkIos: '',
      price: 0,
      priceFormatted: '',
      currency: '',
    };
  }
  return {
    id: json.id ?? json.uniqid ?? '',
    barcode: json.barcode ?? '',
    name: json.name ?? '',
    brand: json.brand ?? '',
    model: json.model ?? '',
    description: json.description ?? '',
    imageUrl: json.image_url ?? '',
    resizedImageUrl: json.picture ?? json.resizedImageUrl ?? '',
    resizedImages: json.image_url_resized && typeof json.image_url_resized === 'object' ? json.image_url_resized : {},
    url: json.url ?? '',
    deeplinkIos: json.deeplink_ios ?? json.deeplinkIos ?? '',
    price: typeof json.price === 'number' ? json.price : 0,
    priceFormatted: json.price_formatted ?? '',
    priceFull: json.price_full,
    priceFullFormatted: json.price_full_formatted,
    oldPrice: json.oldprice,
    oldPriceFormatted: json.oldprice_formatted,
    oldPriceFull: json.oldprice_full,
    oldPriceFullFormatted: json.oldprice_full_formatted,
    currency: json.currency ?? '',
    salesRate: json.sales_rate ?? 0,
    discount: json.discount ?? 0,
    relativeSalesRate: json.relative_sales_rate ?? 0,
    isNew: json.is_new,
    params: json.params,
  };
}

/**
 * Product info (full details from products/get).
 * @typedef {Object} ProductInfo
 * @property {string} id - From API uniqid.
 * @property {string} name
 * @property {string} brand
 * @property {string} [model]
 * @property {string} [description]
 * @property {string} imageUrl
 * @property {string} resizedImageUrl
 * @property {Record<string, string>} [resizedImages]
 * @property {string} url
 * @property {string} [deeplinkIos]
 * @property {Category[]} categories
 * @property {number} price
 * @property {string} priceFormatted
 * @property {number} [priceFull]
 * @property {string} [priceFullFormatted]
 * @property {number} [oldPrice]
 * @property {string} [oldPriceFormatted]
 * @property {number} [oldPriceFull]
 * @property {string} [oldPriceFullFormatted]
 * @property {string} currency
 * @property {number} [salesRate]
 * @property {number} [discount]
 * @property {number} [relativeSalesRate]
 * @property {string} [barcode]
 * @property {boolean} [isNew]
 * @property {Array<Record<string, any>>} [params]
 */
export function parseProductInfo(json) {
  if (!json || typeof json !== 'object') {
    return {
      id: '',
      name: '',
      brand: '',
      imageUrl: '',
      resizedImageUrl: '',
      resizedImages: {},
      url: '',
      deeplinkIos: '',
      categories: [],
      price: 0,
      priceFormatted: '',
      currency: '',
    };
  }
  const categoriesJson = Array.isArray(json.categories) ? json.categories : [];
  return {
    id: json.uniqid ?? json.id ?? '',
    name: json.name ?? '',
    brand: json.brand ?? '',
    model: json.model ?? '',
    description: json.description ?? '',
    imageUrl: json.image_url ?? '',
    resizedImageUrl: json.picture ?? json.resizedImageUrl ?? '',
    resizedImages: json.image_url_resized && typeof json.image_url_resized === 'object' ? json.image_url_resized : {},
    url: json.url ?? '',
    deeplinkIos: json.deeplink_ios ?? json.deeplinkIos ?? '',
    categories: categoriesJson.map(parseCategory),
    price: typeof json.price === 'number' ? json.price : 0,
    priceFormatted: json.price_formatted ?? '',
    priceFull: json.price_full,
    priceFullFormatted: json.price_full_formatted,
    oldPrice: json.oldprice,
    oldPriceFormatted: json.oldprice_formatted,
    oldPriceFull: json.oldprice_full,
    oldPriceFullFormatted: json.oldprice_full_formatted,
    currency: json.currency ?? '',
    salesRate: json.sales_rate ?? 0,
    discount: json.discount ?? 0,
    relativeSalesRate: json.relative_sales_rate ?? 0,
    barcode: json.barcode ?? '',
    isNew: json.is_new,
    params: json.params,
  };
}

/**
 * Products list response (from products API).
 * @typedef {Object} ProductsListResponse
 * @property {string[]} [brands]
 * @property {Record<string, Filter>} [filters]
 * @property {PriceRange} [priceRange]
 * @property {Product[]} products
 * @property {number} productsTotal
 */
export function parseProductsListResponse(json) {
  if (!json || typeof json !== 'object') {
    return { products: [], productsTotal: 0 };
  }
  const brandsRaw = json.brands;
  const brands = Array.isArray(brandsRaw)
    ? brandsRaw.map((b) => (b && typeof b === 'object' && 'name' in b ? b.name : String(b)))
    : [];

  const filtersRaw = json.filters;
  const filters = filtersRaw && typeof filtersRaw === 'object' && !Array.isArray(filtersRaw)
    ? Object.fromEntries(
        Object.entries(filtersRaw)
          .filter(([, v]) => v && typeof v === 'object')
          .map(([k, v]) => [k, parseFilter(v)])
      )
    : undefined;

  const productsJson = Array.isArray(json.products) ? json.products : [];
  return {
    brands: brands.length > 0 ? brands : undefined,
    filters: filters && Object.keys(filters).length > 0 ? filters : undefined,
    priceRange: json.price_range ? parsePriceRange(json.price_range) : undefined,
    products: productsJson.map(parseProduct),
    productsTotal: typeof json.products_total === 'number' ? json.products_total : 0,
  };
}
