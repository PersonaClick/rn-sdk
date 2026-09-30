import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'

/**
 * Tag — тег дизайн-системы.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Tag (243:10993).
 * В макете только размер MD, поэтому размера в API нет.
 *
 * Крестик: React Native не рисует SVG сам, поэтому исходник отдаётся через
 * Tag.removeIconSvg, а отрисовку задаёт потребитель пропом renderRemoveIcon
 * (например SvgXml из react-native-svg). Без него место 16x16 остаётся пустым,
 * но нажатие работает.
 *
 * @param {{ label: string, view?: 'primary'|'secondary', onRemove?: Function,
 *           renderRemoveIcon?: (svg: string, color: string) => React.ReactNode,
 *           style?: object }} props
 */
export default function Tag({ label, view = 'primary', onRemove, renderRemoveIcon, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const isPrimary = view === 'primary'
  const removable = typeof onRemove === 'function'
  const textColor = isPrimary ? colors.textLightPrimary : colors.textPrimary

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: theme.radius.buttonSm,
          paddingRight: removable ? 4 : 8,
          backgroundColor: isPrimary ? colors.buttonPrimary : colors.buttonSecondary,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { fontFamily: fontFor(theme, '400'), color: textColor }]}>{label}</Text>
      {removable && (
        <Pressable onPress={onRemove} style={styles.remove} hitSlop={8}>
          {renderRemoveIcon ? renderRemoveIcon(Tag.removeIconSvg, textColor) : null}
        </Pressable>
      )}
    </View>
  )
}

Tag.removeIconSvg = PERSONALIZATION_ICONS.cross

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
    paddingVertical: 4,
  },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.05, fontWeight: '400' },
  remove: { width: 16, height: 16 },
})
