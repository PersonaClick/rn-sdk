import {
  playableStories,
  slidePromocode,
  splitCurrency,
  storyPromoLayout,
  storyPriceView,
  storyCardProduct,
  timerUnits,
  timerText,
  timerRemaining,
  parseOpacity,
  storyTextFrame,
  storyTextBlockProps,
  storyTextLineHeight,
  storyTextAlign,
  isVisibleColor,
  isMediaSlide,
  isVideoSlide,
  slideDuration,
  storyStartIndex,
  storyLink,
  withSlideSeen,
  toDecimal,
  formatPercent,
  storyPromoCaption,
  slideTextBlocks,
  storySlideScrim,
  storySlideLetterbox,
  slideNeedsMedia,
  storyIsViewed,
  storyStartSlide,
  storyCoverRing,
  storyIndexForId,
  storyButtonTarget,
  isTrackableId,
} from '../components/design-system/storySupport'
import { storyRingArcs, coverRingSegments } from '../components/design-system/StoryCover'

// Stories V2 — the pure part: what the kit components draw from the stories block, without rendering.

describe('Stories V2 — currency split', () => {
  test('trailing non-digit token is the currency', () => {
    expect(splitCurrency('1 190 900 ₽')).toEqual({ amount: '1 190 900', currency: '₽' })
    expect(splitCurrency('19 990 ₽')).toEqual({ amount: '19 990', currency: '₽' })
    expect(splitCurrency('12,50 €')).toEqual({ amount: '12,50', currency: '€' })
    expect(splitCurrency('140 USD')).toEqual({ amount: '140', currency: 'USD' })
    expect(splitCurrency('9 999 руб.')).toEqual({ amount: '9 999', currency: 'руб.' })
  })

  test('no space before the currency still splits', () => {
    expect(splitCurrency('9 999₽')).toEqual({ amount: '9 999', currency: '₽' })
  })

  test('a leading currency or no currency stays whole', () => {
    expect(splitCurrency('$140')).toEqual({ amount: '$140', currency: '' })
    expect(splitCurrency('1 000')).toEqual({ amount: '1 000', currency: '' })
    expect(splitCurrency('  245 000 ₽  ')).toEqual({ amount: '245 000', currency: '₽' })
  })

  test('empty input', () => {
    expect(splitCurrency(undefined)).toEqual({ amount: '', currency: '' })
    expect(splitCurrency(null)).toEqual({ amount: '', currency: '' })
    expect(splitCurrency('')).toEqual({ amount: '', currency: '' })
    expect(splitCurrency(1500)).toEqual({ amount: '1500', currency: '' })
  })
})

describe('Stories V2 — promo block width', () => {
  // A 380 pt row: half is 190, 65 % is 247.
  test('a short code keeps the even split and the full size', () => {
    expect(storyPromoLayout(380, 110)).toEqual({ width: 190, fontSize: 24 })
  })

  test('a longer code widens the block up to what it needs', () => {
    expect(storyPromoLayout(380, 190)).toEqual({ width: 222, fontSize: 24 })
  })

  test('a long code stops at 65 % of the row and shrinks to fit', () => {
    // Needs 262 with the paddings: the block stops at 247, the code gets 215 of room.
    expect(storyPromoLayout(380, 230)).toEqual({ width: 247, fontSize: 22 })
    const { width, fontSize } = storyPromoLayout(380, 300)
    expect(width).toBe(247)
    expect((300 * fontSize) / 24).toBeLessThanOrEqual(width - 32)
  })

  test('the code never shrinks below 14', () => {
    expect(storyPromoLayout(380, 2000)).toEqual({ width: 247, fontSize: 14 })
  })
})

describe('Stories V2 — price type', () => {
  // The product element of story 39 in the sample block: 28 % off, old price above the price.
  const product = {
    price: 19990,
    price_formatted: '19 990 ₽',
    oldprice: 27990,
    oldprice_formatted: '27 990 ₽',
    discount_percent: 28,
    currency: '₽',
  }

  test('discount_percent > 0 gives the discount view with "N%"', () => {
    expect(storyPriceView(product)).toEqual({
      type: 'discount',
      price: '19 990 ₽',
      oldPrice: '27 990 ₽',
      discount: '28%',
    })
  })

  test('a promo code wins over the discount and takes the promo price', () => {
    const view = storyPriceView({ ...product, promocode: 'PROMO', price_with_promocode_formatted: '17 990 ₽' })
    expect(view).toMatchObject({ type: 'promoCode', promoCode: 'PROMO', price: '17 990 ₽', oldPrice: '27 990 ₽' })
    expect(view.discount).toBeUndefined()
  })

  test('H: a text block promo shows at the regular price when the product has no code', () => {
    const view = storyPriceView(product, 'SOUND10')
    expect(view).toEqual({ type: 'promoCode', price: '19 990 ₽', oldPrice: '27 990 ₽', promoCode: 'SOUND10' })
    const plain = storyPriceView({ price: 1000, price_formatted: '1 000 ₽', oldprice: 900, oldprice_formatted: '900 ₽' }, 'SOUND10')
    expect(plain).toEqual({ type: 'promoCode', price: '1 000 ₽', promoCode: 'SOUND10' })
  })

  test('H: the product promo wins over the text block promo', () => {
    const view = storyPriceView({ ...product, promocode: 'OWN', price_with_promocode_formatted: '17 990 ₽' }, 'SOUND10')
    expect(view).toMatchObject({ promoCode: 'OWN', price: '17 990 ₽' })
  })

  test('H: the slide promo is the first text block with a code', () => {
    const slide = {
      elements: [
        { type: 'text_block', text_input: 'Hello' },
        { type: 'text_block', text_input: 'x', promocode: 'null' },
        { type: 'text_block', text_input: 'y', promocode: ' ' },
        { type: 'product', item: { promocode: 'NOT_A_BLOCK' } },
        { type: 'text_block', text_input: 'Code A1', promocode: ' A1 ' },
        { type: 'text_block', text_input: 'Code B2', promocode: 'B2' },
      ],
    }
    expect(slidePromocode(slide)).toBe('A1')
    expect(slidePromocode({ elements: [] })).toBeUndefined()
    expect(storyPriceView(product, slidePromocode({ elements: [] }))).toMatchObject({ type: 'discount' })
  })

  test('a promo code without a promo price keeps the regular one', () => {
    expect(storyPriceView({ ...product, promocode: ' YAGODA-MALINA ' })).toMatchObject({
      type: 'promoCode',
      promoCode: 'YAGODA-MALINA',
      price: '19 990 ₽',
    })
  })

  test('F10: under a promo code oldprice counts only above the regular price', () => {
    const promo = { price: 100, price_formatted: '100 ₽', promocode: 'P', price_with_promocode: 80, price_with_promocode_formatted: '80 ₽' }
    // Above the promo price but not above the regular one — the regular price is crossed instead.
    expect(storyPriceView({ ...promo, oldprice: 90, oldprice_formatted: '90 ₽' }).oldPrice).toBe('100 ₽')
    expect(storyPriceView({ ...promo, oldprice: 100, oldprice_formatted: '100 ₽' }).oldPrice).toBe('100 ₽')
    expect(storyPriceView({ ...promo, oldprice: '120.50', oldprice_formatted: '120,50 ₽' }).oldPrice).toBe('120,50 ₽')
  })

  test('F10: the regular price is crossed only when it is above the promo price', () => {
    const promo = { price: 100, price_formatted: '100 ₽', promocode: 'P' }
    expect(storyPriceView({ ...promo, price_with_promocode: 100, price_with_promocode_formatted: '100 ₽' }).oldPrice).toBeUndefined()
    expect(storyPriceView({ ...promo, price_with_promocode: 120, price_with_promocode_formatted: '120 ₽' }).oldPrice).toBeUndefined()
    expect(storyPriceView({ ...promo, price_with_promocode_formatted: '90 ₽' }).oldPrice).toBe('100 ₽')
    // No numbers at all — the strings decide.
    expect(storyPriceView({ price_formatted: '100 ₽', promocode: 'P', price_with_promocode_formatted: 'n/a' }).oldPrice).toBe('100 ₽')
    expect(storyPriceView({ price_formatted: 'n/a', promocode: 'P', price_with_promocode_formatted: 'n/a' }).oldPrice).toBeUndefined()
  })

  test('no promo code, no discount — plain price; old price only when higher', () => {
    expect(storyPriceView({ price: 12990, price_formatted: '12 990 ₽', oldprice: 12990, oldprice_formatted: '12 990 ₽' })).toEqual({
      type: 'price',
      price: '12 990 ₽',
    })
    expect(storyPriceView({ price: 100, price_formatted: '100 ₽', oldprice: 150, oldprice_formatted: '150 ₽' })).toEqual({
      type: 'price',
      price: '100 ₽',
      oldPrice: '150 ₽',
    })
  })

  test('empty promo code and zero discount fall through to price', () => {
    expect(storyPriceView({ price_formatted: '5 ₽', promocode: '', discount_percent: 0 }).type).toBe('price')
    expect(storyPriceView({ price_formatted: '5 ₽', discount_percent: '0' }).type).toBe('price')
  })

  test('a price without a formatted string is built from the number and currency', () => {
    expect(storyPriceView({ price: 990, currency: '₽' }).price).toBe('990 ₽')
  })

  test('card product for the used-products carousel', () => {
    expect(storyCardProduct({ id: 300201, name: 'Mouse', price: 100, price_formatted: '100 ₽', oldprice: 150, oldprice_formatted: '150 ₽', discount_percent: 33, picture: 'https://x/p.jpg', brand: 'Bloody' })).toEqual({
      id: '300201',
      name: 'Mouse',
      price: '100 ₽',
      source: { uri: 'https://x/p.jpg' },
      brand: 'Bloody',
      oldPrice: '150 ₽',
      discount: '-33%',
    })
    // Old price equal to the price — no old price, no badge.
    const same = storyCardProduct({ name: 'M', price: 1, price_formatted: '1 ₽', oldprice: 1, oldprice_formatted: '1 ₽' }, 4)
    expect(same).toMatchObject({ id: '4', oldPrice: undefined, discount: undefined, source: undefined })
  })
})

describe('Stories V2 — timer formatting', () => {
  const at = (d, h, m, s) => ((d * 24 + h) * 60 + m) * 60 * 1000 + s * 1000

  test('splits into days, hours, minutes, seconds', () => {
    expect(timerUnits(at(2, 18, 33, 24))).toEqual({ days: 2, hours: 18, minutes: 33, seconds: 24 })
    expect(timerUnits(at(0, 0, 0, 59) + 999)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 59 })
  })

  test('hours, minutes and seconds are two digits, days as is', () => {
    expect(timerText(at(2, 18, 33, 24))).toEqual({ days: '2', hours: '18', minutes: '33', seconds: '24' })
    expect(timerText(at(12, 8, 5, 9))).toEqual({ days: '12', hours: '08', minutes: '05', seconds: '09' })
  })

  test('stops at zero', () => {
    expect(timerText(-5000)).toEqual({ days: '0', hours: '00', minutes: '00', seconds: '00' })
    expect(timerRemaining(1000, 5000)).toBe(0)
  })

  test('remaining time from a Date, a timestamp or an ISO string', () => {
    const now = Date.parse('2026-09-30T12:00:00Z')
    expect(timerRemaining(new Date(now + 90000), now)).toBe(90000)
    expect(timerRemaining(now + 1000, now)).toBe(1000)
    expect(timerRemaining('2026-09-30T12:01:00Z', now)).toBe(60000)
    expect(timerRemaining('not a date', now)).toBe(0)
  })
})

describe('Stories V2 — text block frame', () => {
  test('opacity from the server: percent string, number, fraction; missing — opaque', () => {
    expect(parseOpacity('0%')).toBe(0)
    expect(parseOpacity('50%')).toBe(0.5)
    expect(parseOpacity('100%')).toBe(1)
    expect(parseOpacity(80)).toBe(0.8)
    expect(parseOpacity(0.3)).toBe(0.3)
    expect(parseOpacity(undefined)).toBe(1)
    expect(parseOpacity('')).toBe(1)
  })

  test('solid when the background is visible: radius 12, padding 12/16 above size 30, 8/16 otherwise', () => {
    expect(storyTextFrame({ backgroundColor: 'rgba(22, 174, 19, 1)', fontSize: 48 })).toEqual({
      solid: true,
      paddingVertical: 12,
      paddingHorizontal: 16,
      radius: 12,
    })
    // The shared rule across the SDKs: strictly greater than 30 is large.
    expect(storyTextFrame({ backgroundColor: '#F37A17', fontSize: 31 }).paddingVertical).toBe(12)
    expect(storyTextFrame({ backgroundColor: '#F37A17', fontSize: '36' }).paddingVertical).toBe(12)
    expect(storyTextFrame({ backgroundColor: '#F37A17', fontSize: 30 })).toEqual({
      solid: true,
      paddingVertical: 8,
      paddingHorizontal: 16,
      radius: 12,
    })
    expect(storyTextFrame({ backgroundColor: '#0087E8', fontSize: 20 }).paddingVertical).toBe(8)
    expect(storyTextFrame({ backgroundColor: '#0087E8' }).paddingVertical).toBe(8)
  })

  test('transparent without a colour or with zero opacity: no padding, no background', () => {
    const none = { solid: false, paddingVertical: 0, paddingHorizontal: 0, radius: 0 }
    expect(storyTextFrame({ fontSize: 48 })).toEqual(none)
    expect(storyTextFrame({ backgroundColor: 'rgba(0, 135, 232, 0)' })).toEqual(none)
    expect(storyTextFrame({ backgroundColor: 'transparent' })).toEqual(none)
    expect(storyTextFrame({ backgroundColor: '#0087E800' })).toEqual(none)
    expect(isVisibleColor('#0087E880')).toBe(true)
  })

  test('server element → props: background opacity 0% is transparent', () => {
    const element = {
      type: 'text_block',
      text_input: 'Open eat dear winding belonging.',
      font_size: '48',
      text_color: '#ffffff',
      text_background_color: '#16AE13',
      text_background_color_opacity: '100%',
      text_align: 'center',
      text_line_spacing: '1',
      bold: true,
      y_offset: '12',
    }
    expect(storyTextBlockProps(element)).toEqual({
      text: 'Open eat dear winding belonging.',
      fontSize: 48,
      lineHeight: 48,
      color: '#ffffff',
      backgroundColor: '#16AE13',
      backgroundOpacity: 1,
      align: 'center',
      bold: true,
      italic: false,
      fontType: undefined,
      yOffset: 12,
      promocode: undefined,
    })
    // Any colour RN understands keeps its opacity apart (defect: rgb()/named colours were dropped).
    expect(storyTextBlockProps({ ...element, text_background_color: 'red', text_background_color_opacity: '50%' })).toMatchObject({
      backgroundColor: 'red',
      backgroundOpacity: 0.5,
    })
    expect(storyTextBlockProps({ ...element, text_background_color: 'rgb(1, 2, 3)', text_background_color_opacity: '30%' }).backgroundOpacity).toBe(0.3)
    const clear = storyTextBlockProps({ ...element, text_background_color_opacity: '0%' })
    expect(clear.backgroundColor).toBeUndefined()
    expect(storyTextFrame(clear).solid).toBe(false)
  })

  test('camelCase copies from getStories are read too; empty text is skipped', () => {
    expect(storyTextBlockProps({ textInput: 'Hi', fontSize: 20, textAlignment: 'right', yOffset: 150 })).toMatchObject({
      text: 'Hi',
      fontSize: 20,
      align: 'right',
      yOffset: 100,
    })
    expect(storyTextBlockProps({ text_input: '   ' })).toBeNull()
  })
})

describe('Stories V2 — slides and links', () => {
  const product = { type: 'product', title: ' ', item: { name: 'Pool', price_formatted: '19 990 ₽' } }
  const text = (input, extra = {}) => ({ type: 'text_block', text_input: input, ...extra })

  test('F9: a media slide is one with a non-empty background, whatever its type', () => {
    expect(isMediaSlide({ type: 'video', background: 'https://x/v.mp4' })).toBe(true)
    expect(isMediaSlide({ type: 'image', background: 'https://x/a.jpg' })).toBe(true)
    expect(isMediaSlide({ type: '', background: 'https://x/a.jpg', elements: [product] })).toBe(true)
    expect(isMediaSlide({ type: 'image' })).toBe(false)
    expect(isMediaSlide({ type: 'video', background: '  ', preview: 'https://x/p.jpg' })).toBe(false)
    expect(isMediaSlide({ type: '' })).toBe(false)
    expect(isVideoSlide({ type: 'video', background: 'https://x/v.mp4' })).toBe(true)
    expect(isVideoSlide({ type: 'video' })).toBe(false)
    expect(isVideoSlide({ type: 'image', background: 'https://x/a.jpg' })).toBe(false)
  })

  test('A7: duration from the admin, 10 s when missing or zero', () => {
    expect(slideDuration({ duration: 7 })).toBe(7)
    expect(slideDuration({ duration: '7' })).toBe(7)
    expect(slideDuration({ duration: 0 })).toBe(10)
    expect(slideDuration({})).toBe(10)
  })

  test('start position is clamped to the slides', () => {
    const slides = [{ id: 1 }, { id: 2 }, { id: 3 }]
    expect(storyStartIndex({ start_position: 1, slides })).toBe(1)
    expect(storyStartIndex({ start_position: 9, slides })).toBe(2)
    expect(storyStartIndex({ start_position: -1, slides })).toBe(0)
    expect(storyStartIndex({ slides: [] })).toBe(0)
  })

  test('platform link first, then the generic one', () => {
    const button = { link: 'https://web', link_android: 'https://android', link_ios: '' }
    expect(storyLink(button, 'android')).toBe('https://android')
    expect(storyLink(button, 'ios')).toBe('https://web')
    expect(storyLink({ url: 'https://p', deeplink_ios: 'app://p' }, 'ios')).toBe('app://p')
    expect(storyLink({}, 'ios')).toBeNull()
  })

  test('C11: a button opens its own link, without one the product', () => {
    const item = { url: 'https://p' }
    expect(storyButtonTarget({ link: 'https://b', link_ios: 'app://b' }, item, 'ios')).toEqual({ kind: 'link', url: 'app://b' })
    expect(storyButtonTarget({ link: 'https://b', link_ios: '' }, item, 'ios')).toEqual({ kind: 'link', url: 'https://b' })
    expect(storyButtonTarget({ title: 'Buy' }, item, 'android')).toEqual({ kind: 'product', product: item })
    expect(storyButtonTarget({ title: 'Go' }, null, 'android')).toBeNull()
  })

  test('C3: 50 % scrim only on bare media, 30 % otherwise', () => {
    const img = 'https://x/a.jpg'
    expect(storySlideScrim({ type: 'image', background: img })).toBe(0.5)
    expect(storySlideScrim({ type: 'video', background: img, elements: [text('   ')] })).toBe(0.5)
    expect(storySlideScrim({ type: 'image', background: img, elements: [text('Hi')] })).toBe(0.3)
    expect(storySlideScrim({ type: 'image', background: img, elements: [product] })).toBe(0.3)
    expect(storySlideScrim({ type: '', elements: [product] })).toBe(0.3)
    expect(storySlideScrim({ type: 'image' })).toBe(0.3)
  })

  test('C1/C2: letterbox is background_color or black; no media — app card', () => {
    expect(storySlideLetterbox({ type: 'image', background: 'https://x/a.jpg', background_color: '#112233' })).toBe('#112233')
    expect(storySlideLetterbox({ type: 'video', background: 'https://x/v.mp4' })).toBe('#000000')
    expect(storySlideLetterbox({ type: '', background_color: '#112233' })).toBeNull()
    expect(storySlideLetterbox({ type: 'image', background_color: '#112233' })).toBeNull()
  })

  test('C5: what a slide must load before its clock starts', () => {
    expect(slideNeedsMedia({ type: 'image', background: 'https://x/a.jpg' })).toBe(true)
    expect(slideNeedsMedia({ type: '', background: 'https://x/a.jpg', elements: [product] })).toBe(true)
    expect(slideNeedsMedia({ type: 'video', background: 'https://x/a.mp4', preview: '' })).toBe(true)
    expect(slideNeedsMedia({ type: 'video', background: 'https://x/a.mp4', preview: '' }, false)).toBe(false)
    expect(slideNeedsMedia({ type: 'video', background: 'https://x/a.mp4', preview: 'https://x/p.jpg' }, false)).toBe(true)
    expect(slideNeedsMedia({ type: 'image', background: '' })).toBe(false)
    expect(slideNeedsMedia({ type: '', elements: [product] })).toBe(false)
  })

  test('C8/C15: product slides draw no text blocks; blank blocks are skipped', () => {
    expect(slideTextBlocks({ type: 'image', elements: [text('Hi'), text('  ')] })).toHaveLength(1)
    expect(slideTextBlocks({ type: 'image', elements: [text('Hi'), product] })).toEqual([])
  })

  test('C9: promo caption from the admin title, the host text when blank', () => {
    expect(storyPromoCaption(product, 'Promo code')).toBe('Promo code')
    expect(storyPromoCaption({ title: ' Your code ' }, 'Promo code')).toBe('Your code')
  })
})

describe('Stories V2 — seen state, start slide, ring, tracking', () => {
  const story = { id: 39, viewed: false, start_position: 2, slides: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] }

  test('marking a slide seen returns a new map once, the same map after', () => {
    const empty = {}
    const one = withSlideSeen(empty, 39, '39_0')
    expect(one).toEqual({ 39: ['39_0'] })
    expect(one).not.toBe(empty)
    expect(withSlideSeen(one, '39', '39_0')).toBe(one)
  })

  test('A3: viewed when the server says so or every slide was seen', () => {
    expect(storyIsViewed(story, ['1', '2', '3'])).toBe(false)
    expect(storyIsViewed(story, ['1', '2', '3', '4'])).toBe(true)
    expect(storyIsViewed({ ...story, viewed: true }, [])).toBe(true)
    expect(storyIsViewed({ id: 1, slides: [] }, [])).toBe(false)
  })

  test('A4: first unseen slide, start_position when untouched, 0 when viewed', () => {
    expect(storyStartSlide(story, [])).toBe(2)
    expect(storyStartSlide(story, ['1', '3'])).toBe(1)
    expect(storyStartSlide(story, ['1', '2'])).toBe(2)
    expect(storyStartSlide(story, ['1', '2', '3', '4'])).toBe(0)
    expect(storyStartSlide({ ...story, viewed: true }, ['1'])).toBe(0)
    expect(storyStartSlide({ ...story, start_position: 40 }, [])).toBe(3)
  })

  test('A5: segments lit by index, viewed is one solid ring, pinned stays pinned', () => {
    expect(storyCoverRing(story, ['1', '3'])).toEqual({ state: 'default', segments: 4, seenSegments: [0, 2] })
    expect(storyCoverRing(story, ['1', '2', '3', '4'])).toEqual({ state: 'viewed', segments: 1, seenSegments: [] })
    expect(storyCoverRing({ ...story, pinned: true, viewed: true }, [])).toEqual({ state: 'pinned', segments: 1, seenSegments: [] })
    expect(storyCoverRing({ ...story, pinned: true }, ['2'])).toEqual({ state: 'pinned', segments: 4, seenSegments: [1] })
  })

  test('A5: the cover ring takes indexes or a count', () => {
    expect(coverRingSegments('default', 4, [0, 2])).toEqual({ count: 4, lit: [true, false, true, false] })
    expect(coverRingSegments('default', 3, 9)).toEqual({ count: 3, lit: [true, true, true] })
    expect(coverRingSegments('viewed', 8, 8)).toEqual({ count: 0, lit: [] })
    expect(coverRingSegments('pinned', 5, 2)).toEqual({ count: 5, lit: [true, true, false, false, false] })
  })

  test('segmented ring: one arc per slide with equal gaps, a single slide is a full ring', () => {
    expect(storyRingArcs(1)).toEqual([{ start: 0, sweep: 360 }])
    const arcs = storyRingArcs(4)
    expect(arcs).toHaveLength(4)
    arcs.forEach((arc, index) => {
      expect(arc.sweep).toBeGreaterThan(80)
      expect(arc.start + arc.sweep / 2).toBeCloseTo(index * 90 + 45)
    })
  })

  test('F12: a story by id; show() falls back to the first one, an empty block has none', () => {
    const list = [{ id: 40 }, { id: '41' }]
    expect(storyIndexForId(list, '41')).toBe(1)
    expect(storyIndexForId(list, 40)).toBe(0)
    expect(storyIndexForId(list, 99)).toBe(-1)
    expect(storyIndexForId(list, undefined)).toBe(-1)
    expect(storyIndexForId(list, 99, true)).toBe(0)
    expect(storyIndexForId(list, null, true)).toBe(0)
    expect(storyIndexForId(list, 41, true)).toBe(1)
    expect(storyIndexForId([], 99, true)).toBe(-1)
  })

  test('A6: only positive integer ids are tracked', () => {
    expect(isTrackableId(39)).toBe(true)
    expect(isTrackableId('36')).toBe(true)
    expect(isTrackableId('39_0')).toBe(false)
    expect(isTrackableId(0)).toBe(false)
    expect(isTrackableId('-3')).toBe(false)
    expect(isTrackableId(1.5)).toBe(false)
  })
})

describe('Stories V2 — C10 decimals and C15 text', () => {
  test('numbers parse as decimals', () => {
    expect(toDecimal('19 990.50 ₽')).toBe(19990.5)
    expect(toDecimal('12,5')).toBe(12.5)
    expect(toDecimal(27990)).toBe(27990)
    expect(toDecimal('abc')).toBeNull()
    expect(formatPercent(12.5)).toBe('12.5')
    expect(formatPercent(28)).toBe('28')
  })

  test('line height: spacing × size, otherwise the nearest preset ratio for that size', () => {
    expect(storyTextLineHeight(48, 1)).toBe(48)
    expect(storyTextLineHeight(20, 1.5)).toBe(30)
    expect(storyTextLineHeight(48)).toBe(48)
    expect(storyTextLineHeight(30)).toBe(36)
    expect(storyTextLineHeight(16)).toBe(19)
    expect(storyTextLineHeight(44)).toBe(44)
  })

  test('F4: a tie between Large and Medium goes to Large; line height is round(size × ratio)', () => {
    expect(storyTextLineHeight(39)).toBe(39)
    expect(storyTextLineHeight(40)).toBe(40)
    expect(storyTextLineHeight(38)).toBe(46)
    expect(storyTextLineHeight(25)).toBe(30)
    expect(storyTextLineHeight(17)).toBe(20)
    expect(storyTextLineHeight(12, 0)).toBe(14)
  })

  test('alignment maps left/start, center, right/end', () => {
    expect(storyTextAlign('start')).toBe('left')
    expect(storyTextAlign('end')).toBe('right')
    expect(storyTextAlign('center')).toBe('center')
    expect(storyTextAlign(undefined)).toBe('left')
  })

  test('C12: a text block carries its promo code', () => {
    expect(storyTextBlockProps({ text_input: 'Code', promocode: ' SALE ' }).promocode).toBe('SALE')
  })
})

describe('Stories V2 — playable stories', () => {
  test('stories without slides and repeated ids are dropped, the first one stays', () => {
    const list = playableStories([
      { id: 7, name: 'first', slides: [{ id: 1 }] },
      { id: 8, name: 'empty', slides: [] },
      { id: '7', name: 'again', slides: [{ id: 2 }] },
      { id: 9, name: 'other', slides: [{ id: 3 }] },
    ])
    expect(list.map((story) => story.name)).toEqual(['first', 'other'])
    expect(playableStories(undefined)).toEqual([])
  })
})
