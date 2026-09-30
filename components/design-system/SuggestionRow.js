import React from 'react'
import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'

/**
 * SuggestionRow — строка подсказки поиска: товар или категория.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Card — Product (151:4003) и Category
 * (151:4011), у обоих варианты Image и Text. Строка с картинкой 40x40 и двумя
 * строками текста (у товара цена, у категории родительская категория), либо одна
 * строка текста. У категории справа шеврон. Шаг между картинкой и текстом 10 —
 * значения нет в шкале отступов, взято из макета как есть.
 *
 * highlight выделяет совпадение с запросом полужирным, как в макете подсказок.
 *
 * @param {{ kind?: 'product'|'category', title: string, subtitle?: string, source?: object,
 *           highlight?: string, onPress?: Function,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function SuggestionRow({
  kind = 'product',
  title,
  subtitle,
  source,
  highlight,
  onPress,
  renderIcon,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const category = kind === 'category'
  const showImage = source !== undefined
  const regular = [theme.typography.smDefault, { color: colors.textPrimary }]
  const bold = { fontFamily: fontFor(theme, '600'), fontWeight: '600' }

  const parts = splitHighlight(title, highlight)

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { alignItems: category ? 'center' : 'flex-start' }, style]}
    >
      {showImage ? (
        <View style={[styles.image, { backgroundColor: colors.neutral50 }]}>
          {source ? <Image source={source} style={styles.image} resizeMode="cover" /> : null}
        </View>
      ) : null}
      <View style={styles.column}>
        <Text style={regular} numberOfLines={1}>
          {parts.before}
          {parts.match ? <Text style={bold}>{parts.match}</Text> : null}
          {parts.after}
        </Text>
        {showImage && subtitle ? (
          // У товара это цена полужирным, у категории — родитель серым.
          <Text
            style={[
              category ? theme.typography.smDefault : theme.typography.smEmphasized,
              { color: category ? colors.textHint : colors.textPrimary },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {category ? (
        <View style={styles.chevron}>
          {renderIcon ? renderIcon(PERSONALIZATION_ICONS.angleLargeRight, colors.textHint, 24) : null}
        </View>
      ) : null}
    </Pressable>
  )
}

function splitHighlight(title, highlight) {
  if (!highlight) return { before: title, match: '', after: '' }
  const index = title.toLowerCase().indexOf(highlight.toLowerCase())
  if (index < 0) return { before: title, match: '', after: '' }
  return {
    before: title.slice(0, index),
    match: title.slice(index, index + highlight.length),
    after: title.slice(index + highlight.length),
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  image: { width: 40, height: 40 },
  column: { flex: 1 },
  chevron: { width: 24, height: 24 },
})
