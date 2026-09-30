import React, { useMemo } from 'react'
import { View, PixelRatio, StyleSheet } from 'react-native'
import { encodeCode128 } from './code128'

/**
 * Barcode — штрихкод Code 128 по строке `code`.
 *
 * Источник: Figma Mobile SDK UI Kit, компонент Wallet/Code (520:8886) на странице Loyalty (1:34):
 * штрихкод 232 x 42 в белой подложке. Здесь только сами полосы — чёрные, без своего фона:
 * подложку с тихой зоной даёт тот, кто штрихкод ставит (карта лояльности, дальше промокоды).
 *
 * Ширина модуля — целое число физических пикселей: `floor(232 · dpr / модулей) / dpr`, не меньше
 * одного пикселя. Дробный модуль размывает края полос, и сканер читает хуже. Поэтому ширина
 * штрихкода — модули x модуль и обычно чуть меньше 232; высота 42.
 *
 * Полосы — по одному View на сплошной отрезок, абсолютно по левому краю: координаты кратны
 * пикселю, ошибка округления не накапливается. Непредставимая строка (пустая, не ASCII) —
 * компонент не рисует ничего и места не занимает.
 *
 * Для скринридера штрихкод — картинка с подписью, равной коду.
 *
 * @param {{ code: string, style?: object }} props
 */
export default function Barcode({ code, style }) {
  const modules = useMemo(() => encodeCode128(code), [code])
  if (!modules) return null

  const module = barcodeModuleWidth(modules.length, PixelRatio.get())
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={code}
      style={[{ width: modules.length * module, height: BARCODE_HEIGHT }, style]}
    >
      {barcodeRuns(modules).map(([start, length]) => (
        <View
          key={start}
          style={[styles.bar, { left: start * module, width: length * module }]}
        />
      ))}
    </View>
  )
}

/** Размер штрихкода из макета: под него подбирается модуль. */
export const BARCODE_WIDTH = 232
export const BARCODE_HEIGHT = 42

/**
 * Ширина модуля в логических единицах, кратная физическому пикселю.
 *
 * @param {number} count число модулей
 * @param {number} pixelRatio плотность экрана (PixelRatio.get())
 * @param {number} [width] ширина, в которую надо уложиться
 */
export function barcodeModuleWidth(count, pixelRatio, width = BARCODE_WIDTH) {
  const ratio = pixelRatio > 0 ? pixelRatio : 1
  if (!(count > 0)) return 1 / ratio
  return Math.max(1, Math.floor((width * ratio) / count)) / ratio
}

/**
 * Сплошные отрезки полос: пары [первый модуль, длина].
 *
 * @param {boolean[]} modules
 * @returns {Array<[number, number]>}
 */
export function barcodeRuns(modules) {
  const runs = []
  let start = -1
  for (let i = 0; i <= modules.length; i += 1) {
    const bar = i < modules.length && modules[i]
    if (bar && start < 0) start = i
    if (!bar && start >= 0) {
      runs.push([start, i - start])
      start = -1
    }
  }
  return runs
}

const styles = StyleSheet.create({
  // Полосы чёрные в любой теме: сканеру нужен контраст с белой подложкой, токен тут не подходит.
  bar: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#000000' },
})
