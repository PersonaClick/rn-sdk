import { shopId, typeAndCode } from '../lib/push/PushPayloadParser.js'

// Pure payload extraction behind PersonaClick.handlePush (Release 4). Mirror of iOS PushPayloadParserTests.

describe('PushPayloadParser.shopId', () => {
  test('reads shop_id from the data bag of an FCM message', () => {
    expect(shopId({ data: { shop_id: 'shop-a', id: '1', type: 'web' } })).toBe('shop-a')
  })

  test('reads shop_id from a flat data object', () => {
    expect(shopId({ shop_id: 'shop-b', id: '2' })).toBe('shop-b')
  })

  test('returns null when shop_id is absent', () => {
    expect(shopId({ data: { id: '1' } })).toBeNull()
    expect(shopId({})).toBeNull()
    expect(shopId(null)).toBeNull()
  })
})

describe('PushPayloadParser.typeAndCode', () => {
  test('maps data.id -> code and data.type -> type (FCM message)', () => {
    expect(typeAndCode({ data: { id: '42', type: 'product' } })).toEqual({ code: '42', type: 'product' })
  })

  test('works on a flat data object', () => {
    expect(typeAndCode({ id: '7', type: 'web' })).toEqual({ code: '7', type: 'web' })
  })

  test('yields undefined fields when absent', () => {
    expect(typeAndCode({ data: {} })).toEqual({ code: undefined, type: undefined })
  })
})
