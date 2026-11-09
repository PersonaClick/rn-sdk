import { Platform } from 'react-native'
import { toPersonalizationProduct } from '../components/widgets/productSupport'
import recommendExtended from './fixtures/recommend_extended.json'
import searchFull from './fixtures/search_full.json'
import category from './fixtures/category.json'
import productInfo from './fixtures/product_info.json'

// The one mapper from an API product to the kit's PersonalizationProduct, on live API samples.

const [discounted, regular] = recommendExtended.recommends

describe('toPersonalizationProduct', () => {
  test('a discounted product: formatted prices, discount badge, picture, url and android deeplink', () => {
    expect(toPersonalizationProduct(discounted, 'Buy', 'android')).toEqual({
      id: '52173',
      name: discounted.name,
      price: '164 990 ₽',
      source: { uri: discounted.picture },
      imageUrl: discounted.picture,
      brand: 'Beko',
      oldPrice: '174 990 ₽',
      discount: '-6%',
      actionText: 'Buy',
      url: discounted.url,
      deeplink: discounted.deeplink_android,
    })
  })

  test('the deeplink follows the platform; elsewhere there is none', () => {
    const withLinks = { ...discounted, deeplink_android: 'app://android', deeplink_ios: 'app://ios' }
    expect(toPersonalizationProduct(withLinks, null, 'android').deeplink).toBe('app://android')
    expect(toPersonalizationProduct(withLinks, null, 'ios').deeplink).toBe('app://ios')
    expect(toPersonalizationProduct(withLinks, null, 'web').deeplink).toBeNull()
    expect(toPersonalizationProduct({ id: 1, price: 1 }, null, 'ios')).toMatchObject({ url: null, deeplink: null })
    // Without an explicit platform — the running one.
    expect(toPersonalizationProduct(withLinks).deeplink).toBe(`app://${Platform.OS}`)
  })

  test('a product without a discount has no old price and no badge', () => {
    const card = toPersonalizationProduct(regular, null, 'ios')
    expect(card).toMatchObject({ price: '15 990 ₽', deeplink: regular.deeplink_ios, url: regular.url })
    expect(card.oldPrice).toBeUndefined()
    expect(card.discount).toBeUndefined()
    expect(card.actionText).toBeUndefined()
    expect(card.rating).toBeUndefined()
  })

  test('the old price shows only above the price', () => {
    const same = { ...discounted, oldprice: discounted.price }
    expect(toPersonalizationProduct(same, null, 'ios')).toMatchObject({ oldPrice: undefined, discount: undefined })
  })

  test('without discount_formatted the badge is the percent, a leading minus is kept', () => {
    const { discount_formatted: _omit, ...raw } = discounted
    expect(toPersonalizationProduct(raw, null, 'ios').discount).toBe('-6%')
    expect(toPersonalizationProduct({ ...discounted, discount_formatted: '-10%' }, null, 'ios').discount).toBe('-10%')
  })

  test('discount badge: a positive number only, one leading minus, never -0% or -true%', () => {
    const base = { id: 1, price: 90, oldprice: 100, oldprice_formatted: '100 ₽' }
    const badge = (extra) => toPersonalizationProduct({ ...base, ...extra }, null, 'ios').discount
    // Zero with a formatted "0%" — no badge, the old price stays.
    expect(badge({ discount: 0, discount_formatted: '0%' })).toBeUndefined()
    expect(toPersonalizationProduct({ ...base, discount: 0 }, null, 'ios').oldPrice).toBe('100 ₽')
    // Booleans and garbage are no discount.
    expect(badge({ discount: true })).toBeUndefined()
    expect(badge({ discount: false, discount_formatted: '10%' })).toBeUndefined()
    expect(badge({ discount: 'n/a' })).toBeUndefined()
    // Only discount_percent: the number with %.
    expect(badge({ discount_percent: 5 })).toBe('-5%')
    expect(badge({ discount_percent: '7' })).toBe('-7%')
    expect(badge({ discount: true, discount_percent: 5 })).toBe('-5%')
    // discount_formatted is the text of `discount`, not of the percent.
    expect(badge({ discount: 0, discount_formatted: '0%', discount_percent: 5 })).toBe('-5%')
    // A string number, a formatted text that already has a minus (one or more).
    expect(badge({ discount: '10' })).toBe('-10%')
    expect(badge({ discount: 10, discount_formatted: '-10%' })).toBe('-10%')
    expect(badge({ discount: 10, discount_formatted: '--10%' })).toBe('-10%')
    expect(badge({ discount: 10, discount_formatted: '  ' })).toBe('-10%')
    // No old price shown — no badge either.
    expect(toPersonalizationProduct({ ...base, oldprice: 80, discount: 10 }, null, 'ios').discount).toBeUndefined()
  })

  test('without price_formatted the price is the number with the currency', () => {
    expect(toPersonalizationProduct({ id: 7, name: 'x', price: 100, currency: '₽' }, null, 'ios').price).toBe('100 ₽')
    expect(toPersonalizationProduct({ id: 7, name: 'x', price: 100 }, null, 'ios').price).toBe('100')
  })

  test('the picture falls back to image_url, none gives no source', () => {
    const { picture: _omit, ...raw } = regular
    expect(toPersonalizationProduct(raw, null, 'ios').source).toEqual({ uri: regular.image_url })
    expect(toPersonalizationProduct({ id: 1, price: 1 }, null, 'ios').source).toBeUndefined()
  })

  test('search, category and products/get products map the same way', () => {
    const fromSearch = toPersonalizationProduct(searchFull.products[0], null, 'android')
    expect(fromSearch).toMatchObject({
      id: searchFull.products[0].id,
      price: searchFull.products[0].price_formatted,
      deeplink: searchFull.products[0].deeplink_android,
      url: searchFull.products[0].url,
    })
    const fromCategory = toPersonalizationProduct(category.products[0], null, 'ios')
    expect(fromCategory).toMatchObject({ deeplink: category.products[0].deeplink_ios, url: category.products[0].url })
    // products/get sends the price as a string and `discount: false`.
    const fromInfo = toPersonalizationProduct(productInfo, null, 'ios')
    expect(fromInfo).toMatchObject({ id: '868', price: '14 990 ₽', deeplink: productInfo.deeplink_ios })
    expect(fromInfo.discount).toBeUndefined()
  })
})
