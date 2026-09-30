import {
  loyaltyCardLayout,
  loyaltyCardMinHeight,
  loyaltyEmblemFrame,
  LOYALTY_STRIPE_ASPECT,
} from '../components/design-system/LoyaltyCard'

// The loyalty card's visible sections and geometry, without rendering.

const image = { uri: 'https://example.com/image.png' }

const full = {
  logoSource: image,
  balanceLabel: 'Бонусы',
  balanceValue: '50 550',
  stripeSource: image,
  emblemSource: image,
  stamps: 4,
  stampsTotal: 5,
  fields: [
    { label: 'Владелец', value: 'Олег' },
    { label: 'Уровень', value: 'Базовый' },
  ],
  code: '2000012345678',
}

describe('LoyaltyCard — sections', () => {
  test('everything given, everything shown', () => {
    const layout = loyaltyCardLayout(full)
    expect(layout).toMatchObject({
      header: true,
      logo: true,
      balance: true,
      stripe: true,
      stamps: { filled: 4, total: 5 },
      info: true,
      code: true,
    })
    expect(layout.fields).toHaveLength(2)
  })

  test('nothing given, nothing shown', () => {
    expect(loyaltyCardLayout({})).toEqual({
      header: false,
      logo: false,
      balance: false,
      stripe: false,
      stamps: { filled: 0, total: 0 },
      info: false,
      fields: [],
      code: false,
    })
  })

  test('header stays for a logo alone or a balance alone', () => {
    expect(loyaltyCardLayout({ logoSource: image })).toMatchObject({ header: true, logo: true, balance: false })
    expect(loyaltyCardLayout({ balanceValue: '100' })).toMatchObject({ header: true, logo: false, balance: true })
    expect(loyaltyCardLayout({ balanceLabel: 'Бонусы' })).toMatchObject({ header: true, balance: true })
    expect(loyaltyCardLayout({ balanceLabel: '', balanceValue: '' })).toMatchObject({ header: false, balance: false })
  })

  test('stripe shows for an image, an emblem or stamps', () => {
    expect(loyaltyCardLayout({ stripeSource: image }).stripe).toBe(true)
    expect(loyaltyCardLayout({ emblemSource: image }).stripe).toBe(true)
    expect(loyaltyCardLayout({ stampsTotal: 3 }).stripe).toBe(true)
    expect(loyaltyCardLayout({ stamps: 3 }).stripe).toBe(false) // stamps without a total draw nothing
  })

  test('stamps are clamped to 0…stampsTotal', () => {
    expect(loyaltyCardLayout({ stamps: 7, stampsTotal: 5 }).stamps).toEqual({ filled: 5, total: 5 })
    expect(loyaltyCardLayout({ stamps: -2, stampsTotal: 5 }).stamps).toEqual({ filled: 0, total: 5 })
    expect(loyaltyCardLayout({ stamps: 2.7, stampsTotal: 5.9 }).stamps).toEqual({ filled: 2, total: 5 })
    expect(loyaltyCardLayout({ stamps: 3, stampsTotal: -1 }).stamps).toEqual({ filled: 0, total: 0 })
    expect(loyaltyCardLayout({ stamps: NaN, stampsTotal: 5 }).stamps).toEqual({ filled: 0, total: 5 })
  })

  test('info hides when there are no fields; empty fields are dropped', () => {
    expect(loyaltyCardLayout({ fields: [] }).info).toBe(false)
    expect(loyaltyCardLayout({ fields: [{ label: '', value: '' }, null] }).info).toBe(false)

    const layout = loyaltyCardLayout({ fields: [{ label: 'Уровень', value: 'Базовый' }, { label: '' }, { value: 'Олег' }] })
    expect(layout.info).toBe(true)
    expect(layout.fields).toEqual([{ label: 'Уровень', value: 'Базовый' }, { value: 'Олег' }])
  })

  test('code hides when empty or not encodable', () => {
    expect(loyaltyCardLayout({ code: '' }).code).toBe(false)
    expect(loyaltyCardLayout({ code: 'Карта' }).code).toBe(false)
    expect(loyaltyCardLayout({ code: 'PJJ123C' }).code).toBe(true)
  })
})

describe('LoyaltyCard — geometry', () => {
  test('minimum height keeps the 370 x 560 pass proportions', () => {
    expect(loyaltyCardMinHeight(370)).toBeCloseTo(560)
    expect(loyaltyCardMinHeight(185)).toBeCloseTo(280)
  })

  test('the emblem reproduces the design frame in a 368-wide stripe', () => {
    const width = 368
    const stripeHeight = width / LOYALTY_STRIPE_ASPECT // 141.5
    const frame = loyaltyEmblemFrame(stripeHeight, 359 / 411)

    expect(stripeHeight).toBeCloseTo(141.5, 0)
    expect(frame.height).toBeCloseTo(205.8, 0)
    expect(frame.width).toBeCloseTo(179.5, 0)
    expect(frame.top).toBeCloseTo(-16.5, 0)
    // Left edge from the right offset: x = stripe width − (width + right).
    expect(width - (frame.width + frame.right)).toBeCloseTo(212.5, 0)
  })
})
