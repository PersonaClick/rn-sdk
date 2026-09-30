import React from 'react'
import { Text, Pressable } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * Link — текстовая ссылка: «Cancel» у поля поиска, «Clear» у недавних запросов.
 *
 * В секции Components такого символа нет — стиль снят с экранов Instant Search
 * (страница InstantSearchField, 151:3976 и 310:9829): кегль base 16/24,
 * начертание 600, цвет Text/Link, без подложки и отступов. Нажатого состояния
 * в макете нет, поэтому ссылка только слегка гаснет под пальцем.
 *
 * @param {{ label: string, onPress?: Function, style?: object }} props
 */
export default function Link({ label, onPress, style }) {
  const theme = usePersonalizationTheme()
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? PRESSED_OPACITY : 1 }, style]}>
      <Text style={[theme.typography.baseEmphasized, { color: theme.colors.textLink }]}>{label}</Text>
    </Pressable>
  )
}

const PRESSED_OPACITY = 0.6
