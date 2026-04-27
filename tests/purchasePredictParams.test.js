import { buildPurchasePredictQueryParams } from '../lib/buildPurchasePredictQueryParams.js'

describe('buildPurchasePredictQueryParams', () => {
  it('returns {} for empty object', () => {
    expect(buildPurchasePredictQueryParams({})).toEqual({})
  })

  it('maps only allowed keys with non-empty string values', () => {
    expect(
      buildPurchasePredictQueryParams({
        email: 'a@b.c',
        phone: '+100',
        telegram_id: 'tg1',
        loyalty_id: 'loy1',
      }),
    ).toEqual({
        email: 'a@b.c',
        phone: '+100',
        telegram_id: 'tg1',
        loyalty_id: 'loy1',
      })
  })

  it('ignores unknown keys and empty values', () => {
    expect(
      buildPurchasePredictQueryParams({
        email: 'x@y.z',
        extra: 'nope',
        phone: '',
        loyalty_id: null,
      }),
    ).toEqual({ email: 'x@y.z' })
  })

  it('returns {} for non-object', () => {
    expect(buildPurchasePredictQueryParams(null)).toEqual({})
    expect(buildPurchasePredictQueryParams(undefined)).toEqual({})
  })
})
