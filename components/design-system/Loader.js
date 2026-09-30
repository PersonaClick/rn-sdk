import React, { useEffect, useRef } from 'react'
import { View, Image, Animated, Easing, StyleSheet } from 'react-native'

/**
 * Loader — индикатор загрузки дизайн-системы.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Loader (296:3717).
 * Кольцо со свип-градиентом от прозрачного к чёрному 47%, непрерывное вращение.
 *
 * Свип-градиент средствами React Native не рисуется, поэтому кольцо
 * поставляется растром из макета и вращается. Экспорт 52x52, то есть 2x
 * при штатном слоте 32 (кольцо 26) — на экранах 3x возможна лёгкая мягкость.
 *
 * @param {{ size?: number, duration?: number, style?: object }} props
 */
export default function Loader({ size = 32, duration = 900, style }) {
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    animation.start()
    return () => animation.stop()
  }, [spin, duration])

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <View style={[styles.container, style]}>
      {/* Слот из макета — квадрат 32, кольцо 26 внутри него по центру. */}
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.Image
          source={require('../../assets/personalization-loader.png')}
          style={{ width: (size * 26) / 32, height: (size * 26) / 32, transform: [{ rotate }] }}
          resizeMode="contain"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
})
