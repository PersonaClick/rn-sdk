import { checkboxColors } from '../components/design-system/Checkbox'
import { PERSONALIZATION_COLORS } from '../constants/colors.constants'

// The kit checkbox's colors, without rendering: theme tokens unless the host passes its own.

describe('Checkbox — colors', () => {
  test.each(['light', 'dark'])('no colors given: the kit tokens of the %s scheme, as before', (scheme) => {
    const colors = PERSONALIZATION_COLORS[scheme]
    expect(checkboxColors(colors)).toEqual({
      checked: colors.buttonPrimary,
      check: colors.textLightPrimary,
      unchecked: colors.backgroundInput,
      border: colors.lineInput,
    })
    expect(checkboxColors(colors, { disabled: true })).toEqual({
      checked: colors.buttonPrimaryDisabled,
      check: colors.textLightPrimary,
      unchecked: colors.backgroundInputDisabled,
      border: colors.lineInput,
    })
  })

  test('given colors win in both schemes; disabled keeps the kit fills', () => {
    const given = { checkedColor: '#e11d48ff', checkColor: '#fef2f2ff', uncheckedColor: '#fff1f2ff', borderColor: '#fda4afff' }
    const expected = { checked: '#e11d48ff', check: '#fef2f2ff', unchecked: '#fff1f2ff', border: '#fda4afff' }
    expect(checkboxColors(PERSONALIZATION_COLORS.light, given)).toEqual(expected)
    expect(checkboxColors(PERSONALIZATION_COLORS.dark, given)).toEqual(expected)
    const dark = PERSONALIZATION_COLORS.dark
    expect(checkboxColors(dark, { ...given, disabled: true })).toEqual({
      ...expected,
      checked: dark.buttonPrimaryDisabled,
      unchecked: dark.backgroundInputDisabled,
    })
  })

  test('only some colors given: the rest stay tokens', () => {
    const colors = PERSONALIZATION_COLORS.dark
    expect(checkboxColors(colors, { checkedColor: '#16a34a' })).toEqual({
      checked: '#16a34a',
      check: colors.textLightPrimary,
      unchecked: colors.backgroundInput,
      border: colors.lineInput,
    })
  })
})
