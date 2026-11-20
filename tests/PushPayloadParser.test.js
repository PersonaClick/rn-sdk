import { shopId, typeAndCode, eventOf } from '../lib/push/PushPayloadParser.js'

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

  test('a number is written as a string, as the iOS parser does: APNs keeps the JSON types the server sent', () => {
    expect(typeAndCode({ data: { id: 42, type: 'bulk' } })).toEqual({ code: '42', type: 'bulk' })
    expect(typeAndCode({ src: { id: 7, type: 'chain' } })).toEqual({ code: '7', type: 'chain' })
    expect(typeAndCode({ data: { src: JSON.stringify({ id: 8, type: 'transactional' }) } })).toEqual({ code: '8', type: 'transactional' })
  })

  test('an id sent as an object { id } is read, as on iOS; another value is not a code', () => {
    expect(typeAndCode({ id: { id: 'n-1' }, type: 'bulk' })).toEqual({ code: 'n-1', type: 'bulk' })
    expect(typeAndCode({ id: true, type: 'bulk' })).toEqual({ code: undefined, type: 'bulk' })
  })
})

describe('PushPayloadParser.eventOf', () => {
  test('reads the event of an APNs push, an object, and of an FCM one, its JSON string', () => {
    expect(eventOf({ data: { event: { type: 'web', uri: 'https://a' } } })).toEqual({ type: 'web', uri: 'https://a' })
    expect(eventOf({ data: { event: JSON.stringify({ type: 'product', uri: '37' }) } })).toEqual({ type: 'product', uri: '37' })
    expect(eventOf({ event: { type: 'category', uri: '5' } })).toEqual({ type: 'category', uri: '5' })
  })

  test('none, an empty or a broken event is null', () => {
    expect(eventOf({ data: {} })).toBeNull()
    expect(eventOf({ data: { event: '' } })).toBeNull()
    expect(eventOf({ data: { event: '{broken' } })).toBeNull()
    expect(eventOf(null)).toBeNull()
  })
})
