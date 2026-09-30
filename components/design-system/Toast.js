import React from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_SPACING } from '../../constants/spacing.constants'
import { PERSONALIZATION_ELEVATION } from '../../constants/elevation.constants'

/**
 * Toast — плашка-уведомление: одна строка текста в пилюле.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Components, секция Toast (367:16179),
 * компонент 367:16178. На странице Stories стоит снизу («Copied», фрейм 367:16063)
 * и сверху («Code copied to clipboard», 367:16106).
 *
 * Скругление — радиус Toast (999, то есть пилюля), фон — Background/Float, тень — Elevation 2.
 * Поля 16 по вертикали (XL) и 20 по горизонтали (2XL). Текст 18/18, начертание 500, по центру;
 * длинный переносится. В макете текст покрашен сырым #000 без переменной — здесь Text/Primary,
 * чтобы тёмная схема не теряла надпись. Высота в одну строку — 16 + 18 + 16 = 50.
 *
 * Сама плашка ничего не показывает и не прячет: на экран её выводит ToastPresenter.
 *
 * @param {{ text: string, style?: object }} props
 */
export default function Toast({ text, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme

  // Обрезать нечего — содержимое только текст, — поэтому тень и фон на одном View. На iOS
  // цвет тени — Shadow/Heavy из темы (0.08 в светлой, 0.5 в тёмной), как у попапа; на Android
  // тень рисует система по elevation.
  const shadow =
    Platform.OS === 'android'
      ? PERSONALIZATION_ELEVATION.e2.android
      : { ...PERSONALIZATION_ELEVATION.e2.ios, shadowColor: colors.shadowHeavy, shadowOpacity: 1 }

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: colors.backgroundFloat, borderRadius: theme.radius.toast },
        shadow,
        style,
      ]}
    >
      <Text style={[styles.text, { fontFamily: fontFor(theme, '500'), color: colors.textPrimary }]}>
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // По центру и по ширине текста: тост в макете всегда отцентрован.
  pill: {
    alignSelf: 'center',
    paddingVertical: PERSONALIZATION_SPACING.xl,
    paddingHorizontal: PERSONALIZATION_SPACING.xl2,
  },
  // Начертания 500 в шкале нет (там 400 и 600), кегль 18 с интерлиньяжем 18 — тоже, поэтому
  // стиль задан здесь, как у полей и рейтинга.
  text: { fontSize: 18, lineHeight: 18, fontWeight: '500', textAlign: 'center' },
})
