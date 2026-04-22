import { buildPurchaseTrackingParams, PURCHASE_TRACKING_WIRE } from '../buildPurchaseTrackingParams.js'

describe('buildPurchaseTrackingParams', () => {
  const minimal = {
    orderId: 'ord-1',
    orderPrice: 100,
    items: [{ id: 'p1', amount: 2, price: 25.5 }],
  }

  test('minimal payload: required keys only, omits tax_free when false', () => {
    const q = buildPurchaseTrackingParams(minimal)
    expect(q[PURCHASE_TRACKING_WIRE.EVENT]).toBe('purchase')
    expect(q[PURCHASE_TRACKING_WIRE.ORDER_ID]).toBe('ord-1')
    expect(q[PURCHASE_TRACKING_WIRE.ORDER_PRICE]).toBe(100)
    expect(q).not.toHaveProperty(PURCHASE_TRACKING_WIRE.TAX_FREE)
    expect(q).not.toHaveProperty(PURCHASE_TRACKING_WIRE.CUSTOM)
    const items = q[PURCHASE_TRACKING_WIRE.ITEMS]
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({
      [PURCHASE_TRACKING_WIRE.ID]: 'p1',
      [PURCHASE_TRACKING_WIRE.AMOUNT]: 2,
      [PURCHASE_TRACKING_WIRE.PRICE]: 25.5,
    })
  })

  test('full payload: optional fields and tax_free only when true', () => {
    const q = buildPurchaseTrackingParams({
      orderId: 'ord-2',
      orderPrice: 200,
      items: [
        {
          id: 'sku-1',
          amount: 1,
          price: 200,
          quantity: 3,
          lineId: 'L1',
          fashionSize: 'M',
        },
      ],
      deliveryType: 'courier',
      deliveryAddress: '1 Main St',
      paymentType: 'card',
      isTaxFree: true,
      promocode: 'SAVE10',
      orderCash: 10,
      orderBonuses: 5,
      orderDelivery: 2,
      orderDiscount: 1,
      channel: 'app',
      custom: { tour_ref: 'T-9' },
      recommendedBy: { type: 'dynamic', code: 'block_a' },
      recommendedSource: { foo: 'bar' },
      stream: 'ios',
      segment: 'B',
    })
    expect(q[PURCHASE_TRACKING_WIRE.TAX_FREE]).toBe(true)
    expect(q[PURCHASE_TRACKING_WIRE.DELIVERY_TYPE]).toBe('courier')
    expect(q[PURCHASE_TRACKING_WIRE.PROMOCODE]).toBe('SAVE10')
    expect(q[PURCHASE_TRACKING_WIRE.ORDER_CASH]).toBe(10)
    expect(q[PURCHASE_TRACKING_WIRE.RECOMMENDED_BY]).toBe('dynamic')
    expect(q[PURCHASE_TRACKING_WIRE.RECOMMENDED_CODE]).toBe('block_a')
    expect(q[PURCHASE_TRACKING_WIRE.RECOMMENDED_SOURCE]).toEqual({ foo: 'bar' })
    expect(q[PURCHASE_TRACKING_WIRE.STREAM]).toBe('ios')
    expect(q[PURCHASE_TRACKING_WIRE.SEGMENT]).toBe('B')
    expect(q[PURCHASE_TRACKING_WIRE.CUSTOM]).toEqual({ tour_ref: 'T-9' })
    const row = q[PURCHASE_TRACKING_WIRE.ITEMS][0]
    expect(row[PURCHASE_TRACKING_WIRE.QUANTITY]).toBe(3)
    expect(row[PURCHASE_TRACKING_WIRE.LINE_ID]).toBe('L1')
    expect(row[PURCHASE_TRACKING_WIRE.FASHION_SIZE]).toBe('M')
  })

  test('rejects reserved custom keys', () => {
    expect(() =>
      buildPurchaseTrackingParams({
        ...minimal,
        custom: { order_id: 'x' },
      }),
    ).toThrow(/reserved keys/)
  })

  test('rejects empty items', () => {
    expect(() =>
      buildPurchaseTrackingParams({
        orderId: 'a',
        orderPrice: 1,
        items: [],
      }),
    ).toThrow(/non-empty array/)
  })
})
