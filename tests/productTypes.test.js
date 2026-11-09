import { parseProduct, parseProductInfo, parseProductsListResponse } from '../types/productTypes'
import recommendExtended from './fixtures/recommend_extended.json'
import productInfo from './fixtures/product_info.json'
import productsList from './fixtures/products.json'

// Product parsing on live API samples: the same product shape in every response.

const [discounted, regular] = recommendExtended.recommends

describe('parseProduct', () => {
  test('a discounted product keeps the old price, the discount and both deeplinks', () => {
    const product = parseProduct(discounted)
    expect(product).toMatchObject({
      id: '52173',
      price: 164990,
      priceFormatted: '164 990 ₽',
      oldPrice: 174990,
      oldPriceFormatted: '174 990 ₽',
      discount: 6,
      discountFormatted: '6%',
      discountPercent: 5,
      url: discounted.url,
      deeplinkIos: 'https://www.technodom.kz/p/holodilnik-beko-rdsk-mw-52173',
      deeplinkAndroid: 'https://www.technodom.kz/p/holodilnik-beko-rdsk-mw-52173',
      picture: discounted.picture,
      resizedImageUrl: discounted.picture,
    })
  })

  test('a product without a discount has no old price or discount fields', () => {
    const product = parseProduct(regular)
    expect(product.priceFormatted).toBe('15 990 ₽')
    expect(product.oldPrice).toBeUndefined()
    expect(product.oldPriceFormatted).toBeUndefined()
    expect(product.discountFormatted).toBeUndefined()
    expect(product.discountPercent).toBeUndefined()
    expect(product.deeplinkAndroid).toBe(regular.deeplink_android)
  })

  test('new fields come after the existing ones', () => {
    const keys = Object.keys(parseProduct(discounted))
    expect(keys.slice(-4)).toEqual(['deeplinkAndroid', 'discountFormatted', 'discountPercent', 'picture'])
  })

  test('missing deeplinks are empty strings, a numeric string percent is a number', () => {
    const product = parseProduct({ id: '1', name: 'x', price: 1, discount_percent: '15' })
    expect(product.deeplinkAndroid).toBe('')
    expect(product.deeplinkIos).toBe('')
    expect(product.discountPercent).toBe(15)
    expect(parseProduct({ discount_percent: 'n/a' }).discountPercent).toBeUndefined()
  })

  test('not an object gives the empty product with an empty android deeplink', () => {
    expect(parseProduct(null)).toMatchObject({ id: '', deeplinkIos: '', deeplinkAndroid: '' })
  })
})

describe('parseProductInfo', () => {
  test('products/get product carries both deeplinks and the picture', () => {
    const product = parseProductInfo(productInfo)
    expect(product).toMatchObject({
      id: '868',
      deeplinkAndroid: productInfo.deeplink_android,
      deeplinkIos: productInfo.deeplink_ios,
      picture: productInfo.picture,
    })
    expect(product.categories.length).toBeGreaterThan(0)
    expect(product.discountPercent).toBeUndefined()
  })

  test('categories take the parent from parent_id as the API sends it', () => {
    const categories = parseProductInfo(productInfo).categories
    expect(categories[0].parentId).toBeUndefined()
    expect(categories[1]).toMatchObject({ id: 'naushniki', parentId: 'smartfony-i-gadzhety' })
    expect(categories[2]).toMatchObject({ id: 'vse-naushniki', parentId: 'naushniki' })
    // `parent` and `parentId` still work.
    const other = parseProductInfo({ categories: [{ id: 'a', parent: 'p' }, { id: 'b', parentId: 'q' }] }).categories
    expect(other.map((category) => category.parentId)).toEqual(['p', 'q'])
  })

  test('not an object gives the empty product with an empty android deeplink', () => {
    expect(parseProductInfo(undefined)).toMatchObject({ id: '', categories: [], deeplinkAndroid: '' })
  })
})

describe('parseProductsListResponse', () => {
  test('products of the list get the new fields too', () => {
    const response = parseProductsListResponse(productsList)
    expect(response.products).toHaveLength(productsList.products.length)
    expect(response.products[0]).toMatchObject({
      deeplinkAndroid: productsList.products[0].deeplink_android,
      deeplinkIos: productsList.products[0].deeplink_ios,
      picture: productsList.products[0].picture,
    })
    expect(response.productsTotal).toBe(productsList.products_total)
  })

  test('categories of the list are parsed; without a parent they are top-level', () => {
    const response = parseProductsListResponse(productsList)
    expect(response.categories).toHaveLength(productsList.categories.length)
    expect(response.categories[0]).toEqual({
      id: 'noutbuki-i-komp-jutery',
      name: 'Ноутбуки и компьютеры',
      url: productsList.categories[0].url,
      alias: undefined,
      parentId: undefined,
      count: 3240,
    })
    const withParent = parseProductsListResponse({
      ...productsList,
      categories: [{ id: 'naushniki', name: 'Наушники', parent_id: 'smartfony-i-gadzhety' }],
    })
    expect(withParent.categories[0].parentId).toBe('smartfony-i-gadzhety')
  })

  test('no categories in the answer — none in the list', () => {
    const { categories: _omitted, ...withoutCategories } = productsList
    expect(parseProductsListResponse(withoutCategories).categories).toBeUndefined()
  })
})

describe('numbers sent as strings', () => {
  test('products/get: the string price is a number, discount false is no discount', () => {
    expect(productInfo.price).toBe('14990.0')
    expect(productInfo.discount).toBe(false)
    const product = parseProductInfo(productInfo)
    expect(product.price).toBe(14990)
    expect(product.priceFull).toBe(14990)
    expect(product.discount).toBe(0)
    // null rates keep today's default.
    expect(product.salesRate).toBe(0)
    expect(product.relativeSalesRate).toBe(0)
  })

  test('every numeric field reads a numeric string, in both parsers', () => {
    const raw = {
      ...productInfo,
      price: '164990',
      price_full: '164990.00',
      oldprice: '174990',
      oldprice_full: '174990.0',
      sales_rate: '3969',
      relative_sales_rate: '58.76',
      discount: '6',
    }
    const expected = {
      price: 164990,
      priceFull: 164990,
      oldPrice: 174990,
      oldPriceFull: 174990,
      salesRate: 3969,
      relativeSalesRate: 58.76,
      discount: 6,
    }
    expect(parseProductInfo(raw)).toMatchObject(expected)
    expect(parseProduct(raw)).toMatchObject(expected)
  })

  test('a value that is not a number keeps today\'s default', () => {
    const raw = { id: '1', price: 'n/a', oldprice: null, sales_rate: '', discount: undefined }
    for (const parse of [parseProduct, parseProductInfo]) {
      const product = parse(raw)
      expect(product.price).toBe(0)
      expect(product.oldPrice).toBeNull()
      expect(product.priceFull).toBeUndefined()
      expect(product.salesRate).toBe('')
      expect(product.discount).toBe(0)
    }
  })

  test('numbers stay as they are', () => {
    expect(parseProduct(discounted)).toMatchObject({ price: 164990, oldPrice: 174990, salesRate: 3969, discount: 6 })
  })
})
