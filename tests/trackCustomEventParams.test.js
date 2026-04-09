import {
  buildTrackCustomEventParams,
  effectiveCustomFields,
} from '../lib/buildTrackCustomEventParams.js'

beforeAll(() => {
  global.__DEV__ = false
})

describe('effectiveCustomFields', () => {
  it('drops blank keys and nullish values', () => {
    expect(
      effectiveCustomFields({
        '': 1,
        '  ': 2,
        ok: 'a',
        drop: null,
        missing: undefined,
      }),
    ).toEqual({ ok: 'a' })
  })

  it('returns {} for non-object', () => {
    expect(effectiveCustomFields(null)).toEqual({})
    expect(effectiveCustomFields(undefined)).toEqual({})
    expect(effectiveCustomFields([])).toEqual({})
  })
})

describe('buildTrackCustomEventParams', () => {
  it('returns only event when params omitted', () => {
    expect(buildTrackCustomEventParams('e', undefined)).toEqual({ event: 'e' })
  })

  it('maps standard fields and builds payload from customFields', () => {
    const out = buildTrackCustomEventParams('custom_event', {
      time: 123456,
      category: 'demo_category',
      label: 'demo_label',
      value: 100,
      customFields: { demo_custom_key: 'rn_demo_app' },
    })
    expect(out).toEqual({
      event: 'custom_event',
      time: 123456,
      category: 'demo_category',
      label: 'demo_label',
      value: 100,
      demo_custom_key: 'rn_demo_app',
      payload: { demo_custom_key: 'rn_demo_app' },
    })
    expect(out.value).toBe(100)
  })

  it('omits payload when customFields only contain nullish values', () => {
    const out = buildTrackCustomEventParams('e', {
      customFields: { a: null, b: undefined },
    })
    expect(out).toEqual({ event: 'e' })
    expect(Object.prototype.hasOwnProperty.call(out, 'payload')).toBe(false)
  })

  it('throws on reserved keys in customFields with sorted list', () => {
    expect(() =>
      buildTrackCustomEventParams('e', {
        customFields: { label: 'x', sid: 'y', event: 'z' },
      }),
    ).toThrow('trackEvent: customFields contains reserved keys: event, label, sid')
  })

  it('throws on unknown param keys', () => {
    expect(() =>
      buildTrackCustomEventParams('e', {
        category: 'c',
        foo: 'bar',
      }),
    ).toThrow('trackEvent: unknown param keys: foo')
  })

  it('throws when event is empty', () => {
    expect(() => buildTrackCustomEventParams('  ', undefined)).toThrow('trackEvent: event must not be empty')
  })

  it('throws when time is not a finite number', () => {
    expect(() => buildTrackCustomEventParams('e', { time: NaN })).toThrow('trackEvent: time must be a finite number')
  })

  it('throws when value is not a finite number', () => {
    expect(() => buildTrackCustomEventParams('e', { value: '100' })).toThrow('trackEvent: value must be a finite number')
  })
})
