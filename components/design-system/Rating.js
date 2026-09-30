import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'

/**
 * Rating — рейтинг товара, короткая форма.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Rating (88:209), фрейм Product Short (237:4711).
 * Вариант Reviews меняет только данные и цвет звезды: без отзывов она серая.
 *
 * Внимание: типографика 16/20 — кегль со ступени base, интерлиньяж со ступени sm.
 * Ступень base — это 16/24, поэтому размеры заданы явно.
 *
 * Цвет заполненной звезды в макете не привязан к переменной, взят ближайший
 * существующий токен semanticWarning — его стоит подтвердить у дизайнера.
 *
 * @param {{ value: string, reviews: number,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function Rating({ value, reviews = 0, renderIcon, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const starColor = reviews > 0 ? colors.semanticWarning : colors.lineGeneric

  return (
    <View style={[styles.row, style]}>
      <View style={styles.star}>
        {renderIcon ? renderIcon(PERSONALIZATION_ICONS.starFill, starColor, 20) : null}
      </View>
      <View style={styles.numbers}>
        <Text
          style={[styles.text, styles.value, { fontFamily: fontFor(theme, '600'), color: colors.textSecondary }]}
        >
          {value}
        </Text>
        <Text style={[styles.text, { fontFamily: fontFor(theme, '400'), color: colors.textHint }]}>
          {`(${reviews})`}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 4 },
  star: { width: 20, height: 20 },
  numbers: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  text: { fontSize: 16, lineHeight: 20, letterSpacing: 0, fontWeight: '400' },
  value: { fontWeight: '600' },
})
