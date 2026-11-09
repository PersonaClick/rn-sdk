/**
 * Parsed product models returned by `parseProduct`, `parseProductInfo` and
 * `parseProductsListResponse` (see `productTypes.js`). Field names are camelCase; the raw API
 * names are given where they differ.
 *
 * Numeric fields: a number, or a numeric string read as a number. Anything else the API sends
 * (`null`, an empty or non-numeric string) is passed through as is, so those types are wider.
 */

/** Category of a product (`products/get`). */
export interface ProductCategory {
  id: string
  name: string
  url?: string | null
  alias?: string | null
  /** API `parent` or `parent_id`. */
  parentId?: string | null
  count?: number | null
}

/** Facet of a products list: value → number of products. */
export interface ProductFilter {
  count: number
  values: Record<string, number>
}

export interface ProductPriceRange {
  min: number
  max: number
}

/** Product in list responses. */
export interface Product {
  id: string
  barcode?: string
  name: string
  brand: string
  model?: string
  description?: string
  /** API `image_url`. */
  imageUrl: string
  /** API `picture`. */
  resizedImageUrl: string
  /** API `image_url_resized`: size → URL. */
  resizedImages?: Record<string, string>
  url: string
  deeplinkIos?: string
  price: number
  priceFormatted: string
  priceFull?: number | string | null
  priceFullFormatted?: string | null
  /** API `oldprice`; present only when the product is discounted. */
  oldPrice?: number | string | null
  oldPriceFormatted?: string | null
  oldPriceFull?: number | string | null
  oldPriceFullFormatted?: string | null
  currency: string
  /** `0` when absent. */
  salesRate?: number | string
  /** `0` when absent; `products/get` sends `false` for a product without a discount, read as `0`. */
  discount?: number | string | boolean
  /** `0` when absent. */
  relativeSalesRate?: number | string
  isNew?: boolean | null
  params?: Array<Record<string, unknown>> | null
  /** API `deeplink_android`. */
  deeplinkAndroid?: string
  /** API `discount_formatted`, e.g. `"6%"`. */
  discountFormatted?: string | null
  /** API `discount_percent`; absent unless a number (or a numeric string). */
  discountPercent?: number
  /** API `picture` — the resized picture (same value as `resizedImageUrl`). */
  picture?: string | null
}

/** Full product details (`products/get`). `id` comes from the API `uniqid`. */
export interface ProductInfo extends Product {
  categories: ProductCategory[]
}

/** Products list (`products`). */
export interface ProductsListResponse {
  brands?: string[]
  filters?: Record<string, ProductFilter>
  priceRange?: ProductPriceRange
  products: Product[]
  productsTotal: number
  /** API `categories`: the categories of the listed products; top-level ones have no `parentId`. */
  categories?: ProductCategory[]
}
