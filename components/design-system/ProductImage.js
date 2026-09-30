import React from 'react'
import { View, Image, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * ProductImage — изображение товара с фиксированной пропорцией.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Image (88:93), фрейм Product (88:94):
 * три пропорции — 1:1, 4:3, 3:4. Ширину задаёт разметка, высота считается сама.
 *
 * Картинку грузит штатный Image по source. До загрузки виден плейсхолдер цвета
 * Background/Card — в макете заливка плейсхолдера к переменной не привязана,
 * взят ближайший токен.
 *
 * Картинке явно задано 100 % по обеим осям: у локального ресурса (`require`) Image
 * подставляет собственные размеры файла в начало стиля, и absoluteFill их не
 * перебивает — картинка вылезала бы за рамку в исходном размере.
 *
 * @param {{ source?: object, aspect?: 'square'|'landscape'|'portrait', style?: object }} props
 */
export default function ProductImage({ source, aspect = 'square', style }) {
  const { colors } = usePersonalizationTheme()
  // Заглушка до загрузки. В макете она нетокенный серый, здесь — Neutral 50:
  // полупрозрачная, поэтому видна и на карточке, и прямо на фоне экрана.
  return (
    <View style={[{ aspectRatio: ASPECT[aspect] || 1, backgroundColor: colors.neutral50 }, style]}>
      {source ? <Image source={source} style={styles.image} resizeMode="cover" /> : null}
    </View>
  )
}

const ASPECT = { square: 1, landscape: 4 / 3, portrait: 3 / 4 }

const styles = StyleSheet.create({
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
})
