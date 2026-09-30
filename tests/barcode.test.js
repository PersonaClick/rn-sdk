import { code128Symbols, encodeCode128 } from '../components/design-system/code128'
import { barcodeModuleWidth, barcodeRuns } from '../components/design-system/Barcode'

// Code 128 encoder and the barcode's pixel snapping. The same cases run on every platform's kit.

const bits = (modules) => modules.map((bar) => (bar ? '1' : '0')).join('')

describe('Code 128 encoder', () => {
  test('mixed text goes to code set B', () => {
    expect(code128Symbols('PJJ123C')).toEqual({ values: [104, 48, 42, 42, 17, 18, 19, 35], checksum: 55 })

    const modules = encodeCode128('PJJ123C')
    expect(modules).toHaveLength(112)
    expect(bits(modules.slice(0, 11))).toBe('11010010000') // Start B
    expect(bits(modules.slice(-13))).toBe('1100011101011') // Stop
  })

  test('an even run of digits goes to code set C, two digits per symbol', () => {
    expect(code128Symbols('1234')).toEqual({ values: [105, 12, 34], checksum: 82 })

    const modules = encodeCode128('1234')
    expect(modules).toHaveLength(57)
    expect(bits(modules.slice(0, 11))).toBe('11010011100') // Start C
    expect(bits(modules.slice(-13))).toBe('1100011101011')
  })

  test('an odd run of digits ends with CODE B and the last digit in set B', () => {
    expect(code128Symbols('123')).toEqual({ values: [105, 12, 100, 19], checksum: 65 })
    expect(encodeCode128('123')).toHaveLength(68)
  })

  test('a single digit is set B: set C needs at least a pair', () => {
    expect(code128Symbols('5').values).toEqual([104, 21])
  })

  test('the demo card number', () => {
    expect(code128Symbols('2000012345678')).toEqual({
      values: [105, 20, 0, 1, 23, 45, 67, 100, 24],
      checksum: 91,
    })
    expect(encodeCode128('2000012345678')).toHaveLength(123)
  })

  test('every symbol starts with a bar and ends with a space, the stop ends with a bar', () => {
    const modules = encodeCode128('PJJ123C')
    for (let symbol = 0; symbol < (modules.length - 13) / 11; symbol += 1) {
      expect(modules[symbol * 11]).toBe(true)
      expect(modules[symbol * 11 + 10]).toBe(false)
    }
    expect(modules[modules.length - 1]).toBe(true)
  })

  test('empty and non-ASCII input is not encodable', () => {
    expect(encodeCode128('')).toBeNull()
    expect(encodeCode128('é')).toBeNull()
    expect(encodeCode128('abc\n')).toBeNull()
    expect(encodeCode128(undefined)).toBeNull()
    expect(code128Symbols('')).toBeNull()
  })

  test('the printable ASCII edges are encodable', () => {
    expect(code128Symbols(' ~').values).toEqual([104, 0, 94])
  })
})

describe('Barcode metrics', () => {
  test('module width is a whole number of device pixels, fitting 232', () => {
    // 123 modules: 696 px at 3x → 5 px per module.
    expect(barcodeModuleWidth(123, 3)).toBeCloseTo(5 / 3)
    expect(123 * barcodeModuleWidth(123, 3)).toBeCloseTo(205)
    // 2x → 3 px, 1x → 1 px.
    expect(barcodeModuleWidth(123, 2)).toBe(1.5)
    expect(barcodeModuleWidth(123, 1)).toBe(1)
    // Fractional density (Android 2.625x): 609 px / 123 → 4 px.
    expect(barcodeModuleWidth(123, 2.625) * 2.625).toBeCloseTo(4)
  })

  test('module width never drops below one device pixel', () => {
    expect(barcodeModuleWidth(500, 1)).toBe(1)
    expect(barcodeModuleWidth(1000, 2)).toBe(0.5)
  })

  test('bar runs cover every bar module once', () => {
    const modules = encodeCode128('1234')
    const runs = barcodeRuns(modules)
    expect(runs[0]).toEqual([0, 2]) // Start C opens with a double bar
    expect(runs[runs.length - 1]).toEqual([55, 2]) // the stop closes with one

    const painted = new Array(modules.length).fill(false)
    for (const [start, length] of runs) {
      for (let i = start; i < start + length; i += 1) painted[i] = true
    }
    expect(painted).toEqual(modules)
  })
})
