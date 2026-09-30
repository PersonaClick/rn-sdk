import React from 'react'
import { Text } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * ListLabel — подпись-разделитель списка.
 *
 * Источник: Figma Mobile SDK UI Kit, секция List (241:10565), символ Label (243:10967).
 * Единственное место в макете, где шрифт берётся из Font Family/Body, а не Heading.
 * Inter в SDK не поставляется, так что на отрисовку это пока не влияет.
 *
 * Текст переводится в верхний регистр самим компонентом — так задано в макете.
 *
 * @param {{ label: string, style?: object }} props
 */
export default function ListLabel({ label, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  return (
    <Text style={[theme.typography.smDefault, { color: colors.textHint }, style]}>
      {typeof label === 'string' ? label.toUpperCase() : label}
    </Text>
  )
}
