import React, { useEffect, useRef, useState } from 'react'
import { View, Animated, Easing, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * Shimmer — блик скелетона: полоса градиента 0 → 25 % → 0 проезжает по рамке слева направо.
 * Внутренний помощник кита (скелетоны сторис), наружу не экспортируется.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories — скелетон Story/Cover и Story/Preview:
 * градиент чёрного 5 % → 30 % → 5 %. Основу 5 % рисует тот, кто кладёт блик (Neutral 50 из темы),
 * блик добавляет недостающие 25 % в середине.
 *
 * Градиент средствами React Native не рисуется (без нативной зависимости), поэтому полоса — растр,
 * как у Loader: чёрная альфа-рампа 256x1, растянутая на ширину рамки и перекрашенная в Text/Primary
 * (tintColor сохраняет альфу): в тёмной схеме блик светлый. Основа Neutral 50 — тот же Text/Primary
 * 5 % в обеих схемах, так что скелетон — Text/Primary 5 → 30 → 5 % и на тёмном фоне виден.
 *
 * Рамка обрезает всё по своему скруглению (`overflow: 'hidden'`) — форму задаёт `style`.
 *
 * @param {{ style?: object, children?: React.ReactNode }} props
 */
export default function Shimmer({ style, children }) {
  const { colors } = usePersonalizationTheme()
  const [width, setWidth] = useState(0)
  const shift = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!width) return undefined
    const animation = Animated.loop(
      Animated.timing(shift, {
        toValue: 1,
        duration: SHIMMER_DURATION,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    )
    animation.start()
    return () => animation.stop()
  }, [shift, width])

  const translateX = shift.interpolate({ inputRange: [0, 1], outputRange: [-width, width] })

  return (
    <View style={[styles.frame, style]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {children}
      {width ? (
        <Animated.Image
          source={require('../../assets/personalization-shimmer.png')}
          resizeMode="stretch"
          style={[
            styles.band,
            { width, tintColor: colors.textPrimary, transform: [{ translateX }] },
          ]}
        />
      ) : null}
    </View>
  )
}

/** Один проход блика, мс. */
const SHIMMER_DURATION = 1400

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  // Высота явно: у локального ресурса Image подставляет размер файла (256x1) в начало стиля,
  // и top/bottom его не перебивают — полоса осталась бы в пиксель высотой.
  band: { position: 'absolute', top: 0, left: 0, height: '100%', opacity: 0.25 },
})
