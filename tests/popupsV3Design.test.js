import text from './fixtures/popups-v3/element-text.json'
import box from './fixtures/popups-v3/element-box.json'
import button from './fixtures/popups-v3/element-button.json'
import close from './fixtures/popups-v3/element-close.json'
import image from './fixtures/popups-v3/element-image.json'
import email from './fixtures/popups-v3/element-email-collector.json'
import form from './fixtures/popups-v3/element-form.json'
import promo from './fixtures/popups-v3/element-promo-code.json'
import survey from './fixtures/popups-v3/element-survey.json'
import recommendation from './fixtures/popups-v3/element-recommendation.json'
import grid from './fixtures/popups-v3/grid.json'
import layouts from './fixtures/popups-v3/layouts.json'
import breakpoints from './fixtures/popups-v3/breakpoints.json'
import unknown from './fixtures/popups-v3/unknown-element.json'
import legacy from './fixtures/popups-v3/legacy-free-elements.json'
import emptyDesign from './fixtures/popups-v3/empty-design.json'
import listResponse from './fixtures/popups-v3/list-response.json'
import popupResponse from './fixtures/popups-v3/popup-response.json'
import live from './fixtures/popups-v3/live-list-181-182.json'
import {
  normalizePopupDesign,
  parsePopupV3,
  popupFrameLayout,
  popupImageHeight,
  popupNeedsPromoCode,
  popupSafeLink,
} from '../lib/popupsV3/design'
import { popupMarkupSpans } from '../lib/popupsV3/markup'
import { popupTexts } from '../lib/popupsV3/texts'
import { popupBoxStyle, popupElementPlacement, popupFontWeight, popupSpanStyle } from '../components/PopupsV3/popupV3Style'
import { popupConsentColors } from '../components/PopupsV3/PopupV3Forms'

// Попапы v3: модель рендера из документа design — общие фикстуры element-*, grid, layouts,
// breakpoints, unknown/legacy/empty, list/popup-response (те же ожидания у Android, iOS и Flutter).

const RU = popupTexts('ru')

const model = (fixture, os = 'android') => normalizePopupDesign(fixture.design, { os, texts: RU })
const elementsOf = (result) => {
  const all = result.free ? result.free : result.rows.flatMap((row) => row.cells.flatMap((cell) => cell.elements))
  return Object.fromEntries(all.map((element) => [element.id, element]))
}
const elements = (fixture, os) => elementsOf(model(fixture, os))

describe('Popups v3 — text and box', () => {
  const byId = elements(text)
  const expected = text._fixture.expect

  test('el-text-full: markup, numbers as strings and null, the box, the shadow, the link', () => {
    const element = byId['el-text-full']
    const e = expected['el-text-full']
    expect(popupMarkupSpans(element.props.message)).toEqual(e.spans)
    expect(element.props).toMatchObject({ align: e.align, fontSize: e.fontSize, fontWeight: e.fontWeight })
    expect(element.box).toMatchObject({
      lineHeight: e.lineHeight,
      letterSpacing: e.letterSpacing,
      opacity: e.opacity,
      paddingX: e.paddingX,
      paddingY: e.paddingY,
      textColor: e.textColor,
      bgColor: e.bgColor,
      borderColor: e.borderColor,
      shadow: e.shadow,
    })
    expect(element.link).toBe(e.link)
    expect(element.selfAlign).toBe('center')
  })

  test('el-text-bare: DEFAULTS of text, then the compiler fallbacks', () => {
    const element = byId['el-text-bare']
    const e = expected['el-text-bare']
    expect(element.props).toMatchObject({ fontSize: e.fontSize, align: e.align, fontWeight: e.fontWeight })
    expect(element.box).toMatchObject({ bgColor: e.bgColor, textColor: e.textColor, lineHeight: e.lineHeight, paddingX: 0, borderWidth: 0 })
    expect(element.link).toBeNull()
  })

  test('el-text-css-position stays in the flow', () => {
    expect(byId['el-text-css-position']).toMatchObject({ visible: true, type: 'text' })
  })

  test('box: its DEFAULTS; an empty box is a plain plate', () => {
    const boxes = elements(box)
    const e = box._fixture.expect
    expect(boxes['el-box-defaults'].box).toMatchObject({ bgColor: e['el-box-defaults'].bgColor, borderRadius: 12, paddingX: 16, paddingY: 16 })
    expect(boxes['el-box-defaults'].props.fontSize).toBe(12)
    expect(boxes['el-box-empty'].box).toMatchObject({ bgColor: e['el-box-empty'].bgColor, borderRadius: 20, paddingX: 24, paddingY: 24 })
    expect(boxes['el-box-empty'].props.message).toBe('')
  })
})

describe('Popups v3 — button and close', () => {
  test('actions, platform links, the old buttonHref, an unknown action, defaults', () => {
    const android = elements(button, 'android')
    const ios = elements(button, 'ios')
    const e = button._fixture.expect
    const link = android['el-btn-link']
    expect(link.props).toMatchObject({ action: 'link', align: 'left', href: e['el-btn-link'].href.android })
    expect(popupMarkupSpans(link.props.text)).toEqual(e['el-btn-link'].spans)
    expect(link.props.button).toMatchObject({ bgColor: '#16a34aff', textColor: '#ffffffff', fontSize: 16, radius: 12, paddingX: 24, paddingY: 12 })
    expect(ios['el-btn-link'].props.href).toBe(e['el-btn-link'].href.ios)
    expect(android['el-btn-ios-var'].props.href).toBe(e['el-btn-ios-var'].href)
    expect(android['el-btn-close'].props.action).toBe('close')
    expect(android['el-btn-copy'].props).toMatchObject({ action: 'copy', copyText: 'SALE10' })
    expect(android['el-btn-copy-fallback'].props).toMatchObject({ action: 'copy', copyText: 'SALE20' })
    expect(android['el-btn-legacy-href'].props).toMatchObject({ action: 'link', href: 'https://demo.personaClick.ru' })
    expect(android['el-btn-unknown-action'].props).toMatchObject({ action: 'link', href: 'https://demo.personaClick.ru' })
    const defaults = android['el-btn-defaults']
    expect(defaults.props).toMatchObject({ action: 'link', text: RU.detail, align: 'center', href: null })
    expect(defaults.props.button).toMatchObject({ bgColor: '#2563ebff', textColor: '#ffffffff', fontSize: 14, paddingX: 20, paddingY: 10, radius: 10 })
    // Обёртка кнопки без фона и рамки; без cellAlign кнопку ставит buttonAlign.
    expect(defaults.box).toMatchObject({ bgColor: '#00000000', borderWidth: 0 })
    expect(defaults.selfAlign).toBe('center')
    expect(link.link).toBeNull()
  })

  test('close: × by default on the right, text, image 200 → 128, svg 4 → 8', () => {
    const byId = elements(close)
    const e = close._fixture.expect
    expect(byId['el-close-default'].props).toMatchObject({ mode: 'text', text: '×', align: 'right' })
    expect(byId['el-close-default'].props.button).toMatchObject({ bgColor: '#00000000', textColor: '#71717aff', fontSize: 22, paddingX: 8, paddingY: 2, radius: 999 })
    expect(byId['el-close-default'].selfAlign).toBe('right')
    expect(byId['el-close-text'].props).toMatchObject({ mode: 'text', text: e['el-close-text'].text, align: 'left' })
    expect(byId['el-close-text'].props.button.fontSize).toBe(16)
    expect(byId['el-close-image'].props).toMatchObject({ mode: 'image', imageUrl: e['el-close-image'].url, size: 128 })
    expect(byId['el-close-svg'].props).toMatchObject({ mode: 'svg', size: 8 })
  })
})

describe('Popups v3 — image', () => {
  const byId = elements(image)
  const e = image._fixture.expect

  test('a variable in the url, height modes, fit, aspect ratio, hidden, link', () => {
    expect(byId['el-img-auto']).toMatchObject({ stretch: true, link: e['el-img-auto'].link })
    expect(byId['el-img-auto'].props).toMatchObject({ url: e['el-img-auto'].url, height: 'auto', fit: 'cover', radius: 12, marginBottom: 8 })
    expect(byId['el-img-px'].props).toMatchObject({ height: { px: 180 }, fit: 'contain' })
    expect(byId['el-img-percent'].props.height).toEqual({ percent: 100 })
    expect(byId['el-img-vh'].props.height).toEqual({ vh: 40 })
    expect(byId['el-img-ratio'].props.aspectRatio).toBeCloseTo(e['el-img-ratio'].aspectRatio, 3)
    expect(byId['el-img-bad-ratio'].props).toMatchObject({ aspectRatio: null, fit: 'cover' })
    expect(byId['el-img-hidden'].visible).toBe(false)
  })

  test('heights on an 800-high screen', () => {
    expect(popupImageHeight('auto', 800)).toBeNull()
    expect(popupImageHeight({ px: 180 }, 800)).toBe(180)
    expect(popupImageHeight({ percent: 100 }, 800)).toBe(800)
    expect(popupImageHeight({ vh: 40 }, 800)).toBe(320)
  })
})

describe('Popups v3 — forms', () => {
  test('emailCollector: layouts, consent fields and their fallbacks, segment, success', () => {
    const byId = elements(email)
    const e = email._fixture.expect
    const inline = byId['el-email-inline'].props
    expect(inline).toMatchObject({
      layout: 'inline',
      consentFields: e['el-email-inline'].consentFields,
      segmentId: e['el-email-inline'].segmentId,
      successTitle: e['el-email-inline'].success.title,
      successMessage: e['el-email-inline'].success.message,
      placeholder: 'Ваш email',
      errorMessage: 'Проверьте email',
    })
    expect(popupMarkupSpans(inline.consentLabel)).toEqual(e['el-email-inline'].consentSpans)
    expect(inline.success).toMatchObject({ bgColor: e['el-email-inline'].success.bg, align: 'left', radius: 12, paddingX: 14, paddingY: 16 })
    expect(byId['el-email-stacked-legacy'].props).toMatchObject({
      layout: 'stacked',
      consentFields: e['el-email-stacked-legacy'].consentFields,
      consentLabel: e['el-email-stacked-legacy'].consentLabel,
    })
    expect(byId['el-email-bare'].props).toMatchObject({
      layout: 'stacked',
      consentFields: e['el-email-bare'].consentFields,
      placeholder: RU.email,
      submitText: RU.subscribe,
      consentLabel: RU.emailConsent,
      errorMessage: RU.emailError,
    })
    expect(byId['el-email-bare'].box).toMatchObject({ bgColor: '#ffffffff', textColor: '#0f172aff', borderRadius: 12, paddingX: 12, paddingY: 12 })
    expect(byId['el-email-bare'].props.input).toMatchObject({ bgColor: '#f8fafcff', borderColor: '#cbd5e1ff', radius: 10 })
  })

  test('form: 11 entries → 8 fields, clean ids and property keys, required only when true', () => {
    const byId = elements(form)
    const e = form._fixture.expect
    const fields = byId['el-form'].props.fields
    expect(fields.map(({ id, kind, required, propertyKey }) => ({ id, kind, required, propertyKey }))).toEqual(
      e['el-form'].fields.map(({ id, kind, required, propertyKey }) => ({ id, kind, required, propertyKey })),
    )
    expect(fields.map((field) => field.input)).toEqual(['email', 'phone', 'text', 'text', 'date', 'select', 'text', 'text'])
    expect(byId['el-form'].props).toMatchObject({ consentFields: ['email_bulk'], segmentId: '456', submitText: 'Сохранить' })
    expect(byId['el-form-bare'].props).toMatchObject({ fields: [], consentFields: [], submitText: RU.send, errorMessage: RU.formError })
  })

  test('consent checkbox in the form colors: button when checked, input when not (defaults and designed)', () => {
    const defaults = { checkedColor: '#2563ebff', checkColor: '#ffffffff', uncheckedColor: '#f8fafcff', borderColor: '#cbd5e1ff' }
    expect(popupConsentColors(elements(email)['el-email-bare'].props)).toEqual(defaults)
    expect(popupConsentColors(elements(form)['el-form-bare'].props)).toEqual(defaults)

    const designed = (fixture, id, prefix) => {
      const design = JSON.parse(JSON.stringify(fixture.design))
      const element = design.elements.find((candidate) => candidate.id === id)
      Object.assign(element.style, {
        buttonBgColor: '#e11d48',
        buttonTextColor: '#fef2f2',
        [`${prefix}InputBg`]: '#fff1f2',
        [`${prefix}InputBorderColor`]: '#fda4af',
      })
      return elements({ design })[id]
    }
    const painted = { checkedColor: '#e11d48ff', checkColor: '#fef2f2ff', uncheckedColor: '#fff1f2ff', borderColor: '#fda4afff' }
    const designedEmail = designed(email, 'el-email-bare', 'email')
    expect(popupConsentColors(designedEmail.props)).toEqual(painted)
    expect(popupConsentColors(designed(form, 'el-form', 'form').props)).toEqual(painted)
    // те же значения, которыми рисуются кнопка и поле формы
    expect(popupConsentColors(designedEmail.props)).toEqual({
      checkedColor: designedEmail.props.button.bgColor,
      checkColor: designedEmail.props.button.textColor,
      uncheckedColor: designedEmail.props.input.bgColor,
      borderColor: designedEmail.props.input.borderColor,
    })
  })
})

describe('Popups v3 — promo code, survey, recommendation', () => {
  test('promo code: personal and static', () => {
    const byId = elements(promo)
    expect(byId['el-promo-personal'].props).toMatchObject({
      source: 'personal',
      code: '{{promo_code}}',
      align: 'left',
      codeFontSize: 22,
      showCopy: true,
      copiedText: 'Скопировано!',
      applyHref: 'personaClickdemo://cart?promo={{promo_code}}',
    })
    expect(byId['el-promo-static'].props).toMatchObject({ source: 'static', code: 'WELCOME5', showCopy: false })
  })

  test('survey: scales, codes, defaults, unknown type → nps', () => {
    const byId = elements(survey)
    expect(byId['el-survey-nps'].props).toMatchObject({ type: 'nps', scale: [0, 10], campaignCode: 'test' })
    expect(byId['el-survey-csat'].props).toMatchObject({
      type: 'csat',
      scale: [1, 5],
      campaignCode: 'MNTEST',
      submitText: 'Отправить',
      thanksText: 'Спасибо!',
      scaleBg: '#f3f4f6ff',
      activeBg: '#2563ebff',
    })
    expect(byId['el-survey-ces'].props).toMatchObject({ type: 'ces', scale: [1, 7], campaignCode: 'MN TEST' })
    expect(byId['el-survey-unknown'].props).toMatchObject({ type: 'nps', scale: [0, 10] })
  })

  test('recommendation: a transparent box without padding; an empty code is not drawn', () => {
    const byId = elements(recommendation)
    expect(byId['el-rec']).toMatchObject({ visible: true, stretch: true })
    expect(byId['el-rec'].props).toEqual({ code: recommendation._fixture.expect['el-rec'].code, minHeight: 40 })
    expect(byId['el-rec'].box).toMatchObject({ bgColor: '#00000000', borderWidth: 0, paddingX: 0, paddingY: 0, shadow: null })
    expect(byId['el-rec-empty'].visible).toBe(false)
  })
})

describe('Popups v3 — grid', () => {
  const result = model(grid)
  const e = grid._fixture.expect

  test('fractions, gaps, min heights, cell alignment, element order, row background', () => {
    const rows = Object.fromEntries(result.rows.map((row) => [row.id, row]))
    Object.keys(e.rows).forEach((id) => {
      const row = rows[id]
      const expectedRow = e.rows[id]
      row.cells.forEach((cell, index) => expect(cell.fraction).toBeCloseTo(expectedRow.fractions[index], 3))
      expect(row.gap).toBe(expectedRow.gap)
      expect(row.minHeight).toBe(expectedRow.minHeight)
      if (Array.isArray(expectedRow.cells)) {
        expect(row.cells.map((cell) => ({ align: cell.align, verticalAlign: cell.verticalAlign, elements: cell.elements.map((el) => el.id) }))).toEqual(
          expectedRow.cells.map((cell) => ({ align: cell.align, verticalAlign: cell.verticalAlign, elements: cell.elements })),
        )
      }
    })
    expect(rows['row-c'].bgColor).toBe(e.rows['row-c'].background.color)
    expect(rows['row-c'].bgImage).toEqual({
      url: e.rows['row-c'].background.image,
      size: e.rows['row-c'].background.size,
      position: e.rows['row-c'].background.position,
      repeat: e.rows['row-c'].background.repeat,
    })
    expect(rows['row-d'].cells[5].elements.map((el) => el.id)).toEqual(['d5'])
    expect(rows['row-c'].cells[1].elements[0].selfAlign).toBe('right')
    expect(rows['row-b'].cells[2].elements[0].verticalSelf).toBe('top')
  })

  test('elements without a row or outside the columns are dropped and logged', () => {
    expect(result.skipped.map((entry) => entry.id).sort()).toEqual(e.dropped.slice().sort())
  })

  test('unknown types are skipped with a log, a non-object style is empty', () => {
    const skipped = []
    const unknownModel = normalizePopupDesign(unknown.design, { texts: RU, onSkip: (entry) => skipped.push(entry.id) })
    expect(Object.keys(elementsOf(unknownModel))).toEqual(unknown._fixture.expect.rendered)
    expect(skipped).toEqual(unknown._fixture.expect.skipped_logged)
    expect(elementsOf(unknownModel)['bad-style'].props.message).toBe('')
  })

  test('the old design without rows: in the flow by y, then x; an empty design is empty', () => {
    const legacyModel = model(legacy)
    expect(legacyModel.free.map((element) => element.id)).toEqual(legacy._fixture.expect.order)
    expect(model(emptyDesign).empty).toBe(true)
  })
})

describe('Popups v3 — frame (layouts.json, breakpoints.json)', () => {
  const popups = Object.fromEntries(layouts.popups.map((popup) => [popup.id, popup]))
  const frame = (id, screenWidth = 390, screenHeight = 800, areaHeight) =>
    popupFrameLayout(popups[id].design.frameStyle, { layout: popups[id].layout, screenWidth, screenHeight, areaHeight })

  test('banner top: no overlay, touches pass, insets 12 / 16, width = screen − 2×12', () => {
    const f = frame(9201)
    expect(f).toMatchObject({ overlayColor: null, blocksBackground: false, offsetX: 12, offsetY: 16, width: 390 - 24 })
  })

  test('banner bottom: overlay #000 × 0.3, background locked, no insets', () => {
    const f = frame(9202)
    expect(f).toMatchObject({ overlayColor: '#0000004d', blocksBackground: true, offsetX: 0, offsetY: 0, width: 390 })
  })

  test('modal: overlay on by default (#000, 0.5), 92% not wider than 480, min height, radius, padding, border', () => {
    const f = frame(9203)
    expect(f).toMatchObject({ overlayColor: '#00000080', blocksBackground: true, minHeight: 200, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e5e7ebff', height: null })
    expect(f.width).toBeCloseTo(390 * 0.92, 5)
    expect(frame(9203, 800).width).toBe(480)
  })

  test('fullscreen: the whole area, width/height of the frame ignored, radius 0, no overlay', () => {
    const f = frame(9204, 390, 800, 760)
    expect(f).toMatchObject({ width: 390, height: null, borderRadius: 0, borderWidth: 0, overlayColor: null, maxHeight: 760, padding: 24 })
  })

  test('the frame is not taller than the area minus the margins of the layout', () => {
    expect(frame(9203, 390, 800, 700).maxHeight).toBe(700 - 32)
    expect(frame(9201, 390, 800, 700).maxHeight).toBe(700 - 16 - 16)
    const fixed = popupFrameLayout({ heightMode: 'px', height: 900 }, { layout: 'modal', screenWidth: 390, screenHeight: 800, areaHeight: 700 })
    expect(fixed.height).toBe(668)
    expect(popupFrameLayout({ heightMode: 'vh', height: 50 }, { layout: 'modal', screenWidth: 390, screenHeight: 800 }).height).toBe(400)
  })

  test.each([
    ['screen_390', 390],
    ['screen_414', 414],
    ['screen_800', 800],
  ])('breakpoints on %s', (name, width) => {
    const e = breakpoints._fixture.expect[name]
    const f = popupFrameLayout(breakpoints.design.frameStyle, { layout: 'modal', screenWidth: width, screenHeight: 900 })
    expect(f.width).toBeCloseTo(e.width, 5)
    expect(f.padding).toBe(e.padding)
    expect(f.borderRadius).toBe(e.borderRadius)
    if (e.minHeight !== undefined) expect(f.minHeight).toBe(e.minHeight)
  })
})

describe('Popups v3 — popups of the list', () => {
  const parsed = listResponse.payload.popups.map(parsePopupV3)
  const e = listResponse._fixture.expect

  test('mobile triggers and layouts are kept, web ones skipped with the reason', () => {
    const kept = parsed.filter((item) => item.popup).map((item) => item.popup)
    expect(kept.filter((popup) => popup.trigger !== 'manual').map((popup) => popup.id)).toEqual(e.armed)
    expect(kept.filter((popup) => popup.trigger === 'manual').map((popup) => popup.id)).toEqual(e.manual_only)
    const skipped = parsed.filter((item) => !item.popup)
    expect(skipped.map((item) => String(item.id))).toEqual(Object.keys(e.skipped_logged))
    expect(skipped[0].reason).toMatch(/trigger_type/)
    expect(skipped[1].reason).toMatch(/layout/)
  })

  test('defaults: frequency, target screens, cooldown; seconds as a string', () => {
    const byId = Object.fromEntries(parsed.filter((item) => item.popup).map((item) => [item.popup.id, item.popup]))
    expect(byId[516]).toMatchObject({ frequency: 'once_session', targetScreens: [] })
    expect(byId[515]).toMatchObject({ cooldownMinutes: 0, triggerEvent: 'promo_view' })
    expect(byId[514]).toMatchObject({ trigger: 'time_on_screen', triggerValue: 10, layout: 'banner', placement: 'bottom', targetScreens: ['home'] })
  })

  test('promo code only with a list id and a token or a personal promo element', () => {
    const byId = Object.fromEntries(parsed.filter((item) => item.popup).map((item) => [item.popup.id, item.popup]))
    expect(popupNeedsPromoCode(byId[519])).toBe(false)
    expect(popupNeedsPromoCode({ ...byId[519], design: promo.design })).toBe(true)
    expect(popupNeedsPromoCode({ ...byId[512], design: promo.design })).toBe(false)
  })

  test('the single popup of a manual show', () => {
    expect(parsePopupV3(popupResponse.payload.popup).popup).toMatchObject({ id: 516, layout: 'fullscreen', trigger: 'manual' })
  })

  test('live 181 / 182 of the demo shop parse and normalize', () => {
    const [banner, modal] = live.payload.popups.map((raw) => parsePopupV3(raw).popup)
    expect(banner).toMatchObject({ id: 181, layout: 'banner', placement: 'top', trigger: 'app_start', frequency: 'once_session' })
    expect(modal).toMatchObject({ id: 182, layout: 'modal', placement: 'center', trigger: 'app_start' })
    const bannerTypes = Object.values(elementsOf(normalizePopupDesign(banner.design, { texts: RU }))).map((el) => el.type)
    expect(bannerTypes).toEqual(['close', 'text', 'button', 'image', 'emailCollector', 'survey'])
    const modalElements = Object.values(elementsOf(normalizePopupDesign(modal.design, { texts: RU })))
    expect(modalElements.map((el) => el.type)).toEqual(['promoCode', 'survey', 'recommendation'])
    expect(popupNeedsPromoCode(modal)).toBe(false)
  })

  test('links: empty and dangerous schemes are dropped, deep links stay', () => {
    expect(popupSafeLink('')).toBeNull()
    expect(popupSafeLink(' javascript:alert(1)')).toBeNull()
    expect(popupSafeLink('DATA:text/html,x')).toBeNull()
    expect(popupSafeLink('personaClickdemo://sale')).toBe('personaClickdemo://sale')
  })
})

describe('Popups v3 — styles', () => {
  test('box style with the shadow and the border, placement in the cell', () => {
    const element = elements(text)['el-text-full']
    expect(popupBoxStyle(element.box)).toMatchObject({
      backgroundColor: '#00000000',
      borderWidth: 1,
      borderColor: '#1118271a',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 0,
      opacity: 0.9,
      boxShadow: '0px 2px 8px #00000055',
    })
    expect(popupElementPlacement(element, 'left')).toEqual({ alignSelf: 'center', maxWidth: '100%' })
    expect(popupElementPlacement({ stretch: true }, 'right')).toEqual({ alignSelf: 'stretch' })
    expect(popupElementPlacement({ stretch: false, selfAlign: null, verticalSelf: 'bottom' }, 'right')).toEqual({
      alignSelf: 'flex-end',
      maxWidth: '100%',
      marginTop: 'auto',
    })
  })

  test('font weight and markup spans', () => {
    expect(popupFontWeight(700)).toBe('700')
    expect(popupFontWeight(550)).toBe('600')
    expect(popupFontWeight(null)).toBe('400')
    expect(popupSpanStyle({ text: 'a', bold: true, italic: true })).toEqual({ fontWeight: 'bold', fontStyle: 'italic' })
    expect(popupSpanStyle({ text: 'a', strike: true })).toEqual({ textDecorationLine: 'line-through' })
    expect(popupSpanStyle({ text: 'a', overline: true })).toEqual({})
  })
})
