/**
 * Кодировщик Code 128 для штрихкода кита (Barcode). Чистые функции, без React Native.
 *
 * Два набора: C — для строки из одних цифр длиной от двух (две цифры на символ, код вдвое
 * короче), B — для всего остального печатного ASCII 32…126. Нечётное число цифр: пары на
 * первые n−1, затем CODE B и последняя цифра набором B. Набор A (управляющие символы) не нужен:
 * номера карт и промокоды печатные.
 *
 * Раскладка модулей: старт, данные, контрольный символ, стоп. Символ — 11 модулей, стоп — 13.
 * Тихой зоны внутри нет: её даёт белая подложка вокруг штрихкода.
 */

// Ширины полос и пробелов по значению символа, начиная с полосы. 103–105 — старты A/B/C, 106 — стоп.
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]

const START_B = 104
const START_C = 105
const CODE_B = 100
const STOP = 106

/**
 * Значения символов для `text`: старт и данные (контрольный символ отдельно) — или null, если
 * строка пустая или в ней есть символ вне печатного ASCII 32…126.
 *
 * @param {string} text
 * @returns {{ values: number[], checksum: number } | null}
 */
export function code128Symbols(text) {
  if (typeof text !== 'string' || text.length === 0) return null
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code < 32 || code > 126) return null
  }

  const values = []
  if (text.length >= 2 && /^[0-9]+$/.test(text)) {
    values.push(START_C)
    const pairs = text.length - (text.length % 2)
    for (let i = 0; i < pairs; i += 2) values.push(Number(text.slice(i, i + 2)))
    if (pairs < text.length) {
      values.push(CODE_B, text.charCodeAt(pairs) - 32)
    }
  } else {
    values.push(START_B)
    for (let i = 0; i < text.length; i += 1) values.push(text.charCodeAt(i) - 32)
  }

  // Старт входит в сумму с весом 1, как и первый символ данных.
  let sum = values[0]
  for (let i = 1; i < values.length; i += 1) sum += i * values[i]
  return { values, checksum: sum % 103 }
}

/**
 * Модули штрихкода: true — полоса, false — пробел. null — строку не закодировать.
 *
 * @param {string} text
 * @returns {boolean[] | null}
 */
export function encodeCode128(text) {
  const symbols = code128Symbols(text)
  if (!symbols) return null
  const modules = []
  for (const value of [...symbols.values, symbols.checksum, STOP]) {
    const pattern = PATTERNS[value]
    for (let i = 0; i < pattern.length; i += 1) {
      const bar = i % 2 === 0
      for (let w = Number(pattern[i]); w > 0; w -= 1) modules.push(bar)
    }
  }
  return modules
}
