import parsing from './fixtures/popups-v3/parsing.json'
import markup from './fixtures/popups-v3/markup.json'
import variablesFixture from './fixtures/popups-v3/variables.json'
import { PERSONALIZATION_COLORS } from '../constants/colors.constants'
import {
  popupBackdrop,
  popupBool,
  popupColor,
  popupColorWithOpacity,
  popupKitScheme,
  popupNum,
  popupShadowColor,
} from '../lib/popupsV3/values'
import {
  popupApplyRuntimeVariables,
  popupApplyStaticVariables,
  popupMarkupSpans,
  popupRichSpans,
  popupStaticVariables,
} from '../lib/popupsV3/markup'

// Попапы v3: разбор значений, разметка и переменные — общие фикстуры parsing.json, markup.json,
// variables.json (те же векторы у Android, iOS и Flutter).

describe('Popups v3 — values (parsing.json)', () => {
  test.each(parsing.colors.map((item) => [JSON.stringify(item.in), item.in, item.out]))('color %s', (label, input, output) => {
    expect(popupColor(input)).toBe(output)
  })

  test.each(parsing.numbers.map((item) => [JSON.stringify(item.in), item.in, item.fallback, item.out]))(
    'number %s',
    (label, input, fallback, output) => {
      expect(popupNum(input, fallback)).toBe(output)
    },
  )

  test.each(parsing.booleans.map((item) => [JSON.stringify(item.in), item.in, item.out]))('boolean %s', (label, input, output) => {
    expect(popupBool(input)).toBe(output)
  })

  test('shadow: a six-digit hex gets the 55 alpha, other formats stay, nothing — black with 55', () => {
    expect(popupShadowColor('#000000')).toBe('#00000055')
    expect(popupShadowColor(null)).toBe('#00000055')
    expect(popupShadowColor('rgba(0, 0, 0, 0.2)')).toBe('#00000033')
    expect(popupShadowColor('#abc')).toBe('#aabbccff')
  })

  test('overlay: the colour alpha times the opacity', () => {
    expect(popupColorWithOpacity('#000000', 0.5)).toBe('#00000080')
    expect(popupColorWithOpacity('#00000080', 0.5)).toBe('#00000040')
    expect(popupColorWithOpacity('nope', 0.5)).toBeNull()
  })
})

describe('Popups v3 — markup (markup.json)', () => {
  test.each(markup._fixture.expect.map((item) => [JSON.stringify(item.input), item.input, item.spans]))(
    'spans of %s',
    (label, input, spans) => {
      expect(popupMarkupSpans(input)).toEqual(spans)
    },
  )

  test('runtime values are put into the spans after the markup is parsed', () => {
    expect(popupRichSpans('Код **{{promo_code}}** действует 7 дней', { promo_code: 'ABC123' })).toEqual([
      { text: 'Код ' },
      { text: 'ABC123', bold: true },
      { text: ' действует 7 дней' },
    ])
    // Значение витринной переменной — без разметки.
    expect(popupRichSpans('{{promo_code}}', { promo_code: '**X**' })).toEqual([{ text: '**X**' }])
  })
})

describe('Popups v3 — variables (variables.json)', () => {
  const expect_ = variablesFixture._fixture.expect
  const statics = popupStaticVariables(variablesFixture.design.variables)
  const style = (id) => variablesFixture.design.elements.find((element) => element.id === id).style

  test('static variables: the old array form, entries without a key dropped', () => {
    expect(statics).toEqual(expect_.static_variables)
    expect(popupStaticVariables({ a: 1, b: null })).toEqual({ a: '1', b: '' })
    expect(popupStaticVariables('oops')).toEqual({})
  })

  test('static substitution keeps runtime and unknown tokens; runtime fills the code', () => {
    const text = popupApplyStaticVariables(style('t').message, statics, 'android')
    expect(text).toBe(expect_.t_after_static)
    expect(popupApplyRuntimeVariables(text, { promo_code: 'ABC123' })).toBe(expect_.t_at_show_with_code_ABC123)
  })

  test('variables in a link, an image and a placeholder', () => {
    expect(popupApplyStaticVariables(style('b').linkHref, statics, 'ios')).toBe(expect_.b_href)
    expect(popupApplyStaticVariables(style('i').imageUrl, statics, 'ios')).toBe(expect_.i_url)
    expect(popupApplyStaticVariables(style('e').emailPlaceholder, statics, 'ios')).toBe(expect_.e_placeholder)
  })

  test('platform links: key_android / key_ios first, then key', () => {
    const vars = { link: 'https://x', link_ios: 'app://ios', link_android: 'app://android' }
    expect(popupApplyStaticVariables('{{link}}', vars, 'android')).toBe('app://android')
    expect(popupApplyStaticVariables('{{ link }}', vars, 'ios')).toBe('app://ios')
    expect(popupApplyStaticVariables('{{link}}', { link: 'https://x' }, 'android')).toBe('https://x')
  })
})

describe('Popups v3 — the kit scheme by the popup background', () => {
  const KIT = { light: PERSONALIZATION_COLORS.light.textPrimary, dark: PERSONALIZATION_COLORS.dark.textPrimary }

  test("the background: the element's own unless transparent, then the frame's, then white", () => {
    expect(popupBackdrop('#0f172a', '#ffffff')).toBe('#0f172aff')
    expect(popupBackdrop('transparent', '#111827')).toBe('#111827ff')
    expect(popupBackdrop('#00000000', 'transparent')).toBe('#ffffffff')
    expect(popupBackdrop(null, undefined)).toBe('#ffffffff')
    expect(popupBackdrop('rgba(17, 24, 39, 1)', 'url(x)')).toBe('#111827ff')
    // Полупрозрачный ложится на то, что под ним.
    expect(popupBackdrop('#00000080', '#ffffff')).toBe('#7f7f7fff')
  })

  test('the scheme whose primary text contrasts more: white — light, dark — dark, whatever the system', () => {
    expect(popupKitScheme('#ffffffff', KIT)).toBe('light')
    expect(popupKitScheme('#f8fafcff', KIT)).toBe('light')
    expect(popupKitScheme('#7f7f7fff', KIT)).toBe('light')
    expect(popupKitScheme('#111827ff', KIT)).toBe('dark')
    expect(popupKitScheme('#2563ebff', KIT)).toBe('dark')
  })

  test("the host's theme tokens count; a token that is not a color — the kit's own", () => {
    expect(popupKitScheme('#7f7f7fff', { light: '#333333', dark: '#ffffff' })).toBe('dark')
    expect(popupKitScheme('#ffffffff', { light: 'oops', dark: null })).toBe('light')
    expect(popupKitScheme('#000000ff', { light: 'oops', dark: null })).toBe('dark')
  })
})
