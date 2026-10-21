import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import { STORY_TEXT_PRESETS, storyTextFrame, storyTextLineHeight } from './storySupport'

/**
 * StoryTextBlock — текст на слайде сторис в рамке кита.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories (1:32), компонент Text Block
 * (Pattern/Task на странице: блок с фоном и без).
 *
 * Сплошной (фон виден) — скругление 12, поля 12/16 у крупного текста (кегль больше 30) и 8/16
 * у остального, фон — `backgroundColor` с прозрачностью `backgroundOpacity` (у сервера —
 * `text_background_color_opacity`). Прозрачность кладётся на подложку под текстом, а не в сам
 * цвет: так годится любой цвет, который понимает React Native (hex, rgb(), именованный), и текст
 * остаётся непрозрачным. Прозрачный — без полей и без фона.
 *
 * Кегль, интерлиньяж, цвет, выравнивание, жирность и курсив задаёт элемент; для хоста есть
 * пресеты `large` 48/48, `medium` 30/36, `small` 20/24, все Regular. Цвет текста по умолчанию —
 * Text/Light Primary на сплошном фоне и Text/Primary на прозрачном.
 *
 * `solid` без `backgroundColor` — сплошной блок в цвете пресетов кита, Semantic/Info. Данные
 * сервера приходят со своим цветом — тогда решает он.
 *
 * @param {{ text: string, preset?: 'large'|'medium'|'small', fontSize?: number,
 *           lineHeight?: number, color?: string, backgroundColor?: string,
 *           backgroundOpacity?: number, solid?: boolean,
 *           align?: 'left'|'center'|'right', bold?: boolean, italic?: boolean,
 *           fontFamily?: string, style?: object }} props
 */
export default function StoryTextBlock({
  text,
  preset = 'medium',
  fontSize,
  lineHeight,
  color,
  backgroundColor: backgroundProp,
  backgroundOpacity = 1,
  solid = false,
  align = 'left',
  bold = false,
  italic = false,
  fontFamily,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const backgroundColor = backgroundProp || (solid ? colors.semanticInfo : undefined)
  const base = STORY_TEXT_PRESETS[preset] || STORY_TEXT_PRESETS.medium
  const size = fontSize || base.fontSize
  // Свой кегль без интерлиньяжа — пропорция ближайшего пресета на этот кегль (C15), а не
  // интерлиньяж другого кегля.
  const leading = lineHeight || (fontSize ? storyTextLineHeight(fontSize) : base.lineHeight)
  const opacityValue = Number(backgroundOpacity ?? 1)
  const opacity = Number.isFinite(opacityValue) ? Math.max(0, Math.min(1, opacityValue)) : 1
  const frame = storyTextFrame({ backgroundColor, backgroundOpacity: opacity, fontSize: size })
  const weight = bold ? '600' : '400'

  return (
    <View
      style={[
        frame.solid && {
          borderRadius: frame.radius,
          paddingVertical: frame.paddingVertical,
          paddingHorizontal: frame.paddingHorizontal,
        },
        style,
      ]}
    >
      {frame.solid ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor, opacity, borderRadius: frame.radius }]}
        />
      ) : null}
      <Text
        style={[
          styles.text,
          {
            fontFamily: fontFamily || fontFor(theme, weight),
            fontSize: size,
            lineHeight: leading,
            fontWeight: weight,
            fontStyle: italic ? 'italic' : 'normal',
            textAlign: align,
            color: color || (frame.solid ? colors.textLightPrimary : colors.textPrimary),
          },
        ]}
      >
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  text: { includeFontPadding: false },
})
