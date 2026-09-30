import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'

/**
 * Button — кнопка дизайн-системы.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Button (90:862), фрейм 90:869.
 * Матрица: 3 размера x 3 вида x 3 состояния x 4 конфигурации контента.
 *
 * Состояние Focus из макета — это нажатие, оно приходит из pressed у Pressable.
 *
 * Иконки: React Native не рисует SVG сам, поэтому исходники передаются строками
 * (PERSONALIZATION_ICONS.*), а отрисовку задаёт потребитель пропом renderIcon
 * (например SvgXml из react-native-svg). Без него место под иконку сохраняется.
 *
 * Скругление `rounded` вместо радиуса размера: кнопка-иконка становится кругом. Так в
 * макете устроен крестик Close (секция Button) — кнопка MD Secondary, у которой радиус
 * переопределён на Rounded.
 *
 * @param {{ label?: string, size?: 'lg'|'md'|'sm', view?: 'primary'|'secondary'|'ghost',
 *           disabled?: boolean, onPress?: Function, iconStart?: string, iconEnd?: string,
 *           onDark?: boolean, rounded?: boolean,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function Button({
  label,
  size = 'lg',
  view = 'primary',
  disabled = false,
  onPress,
  iconStart,
  iconEnd,
  renderIcon,
  onDark = false,
  rounded = false,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const metrics = SIZES[size] || SIZES.lg
  const textStyle = metrics.lineHeight
    ? { ...theme.typography[metrics.typography], lineHeight: metrics.lineHeight }
    : theme.typography[metrics.typography]
  const hasText = typeof label === 'string' && label.length > 0

  // onDark — кнопка поверх тёмного (картинки-фона): в макете такие контролы берут
  // инвертированную палитру. На primary не влияет, она и так светлая по тексту.
  const light = view === 'primary' || onDark
  const foreground = disabled
    ? light
      ? colors.textLightHint
      : colors.textHint
    : light
      ? colors.textLightPrimary
      : colors.textPrimary

  const background = (pressed) => {
    if (disabled) {
      if (view === 'primary') return colors.buttonPrimaryDisabled
      if (view === 'secondary') return colors.buttonSecondaryDisabled
      return colors.backgroundTransparent
    }
    if (pressed) {
      // Ghost в нажатии красится тем же, что и Secondary.
      return view === 'primary' ? colors.buttonPrimaryFocus : colors.buttonSecondaryFocus
    }
    // Кнопка привязана к Brand/Primary, а не к Button/Primary — так в макете.
    if (view === 'primary') return colors.brandPrimary
    if (view === 'secondary') {
      return onDark ? colors.buttonSecondaryOnDark : colors.buttonSecondary
    }
    return colors.backgroundTransparent
  }

  // Кнопка-иконка: по вертикали как у текстовой, по горизонтали своё — 12/8/4.
  const padding = hasText
    ? {
        paddingVertical: metrics.paddingVertical,
        paddingLeft: iconStart ? metrics.paddingNarrow : metrics.paddingWide,
        paddingRight: iconEnd ? metrics.paddingNarrow : metrics.paddingWide,
      }
    : { paddingVertical: metrics.paddingVertical, paddingHorizontal: metrics.paddingIconOnly }

  // Место под иконку занимается всегда: без renderIcon она не рисуется,
  // но отступы и ширина кнопки остаются как в макете.
  const icon = (svg) =>
    svg ? (
      <View style={{ width: metrics.iconSize, height: metrics.iconSize }}>
        {renderIcon ? renderIcon(svg, foreground, metrics.iconSize) : null}
      </View>
    ) : null

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        padding,
        {
          borderRadius: theme.radius[rounded ? 'rounded' : metrics.radius],
          backgroundColor: background(pressed),
        },
        style,
      ]}
    >
      {icon(iconStart)}
      {hasText ? (
        <Text style={[textStyle, styles.label, { color: foreground }]}>{label}</Text>
      ) : null}
      {icon(iconEnd)}
    </Pressable>
  )
}

// Таблица статическая: из темы берутся только ключи, иначе она бы читала тему
// на уровне модуля, где её ещё нет.
const SIZES = {
  lg: {
    typography: 'xlEmphasized',
    radius: 'buttonLg',
    paddingVertical: 8,
    paddingIconOnly: 12,
    paddingWide: 24,
    paddingNarrow: 16,
    iconSize: 32,
  },
  md: {
    typography: 'baseEmphasized',
    radius: 'buttonMd',
    paddingVertical: 8,
    paddingIconOnly: 8,
    paddingWide: 16,
    paddingNarrow: 12,
    iconSize: 24,
  },
  sm: {
    // SM берёт кегль со ступени sm, а интерлиньяж со ступени base:
    // в макете 14/24, тогда как ступень sm — это 14/20.
    typography: 'smEmphasized',
    lineHeight: 24,
    radius: 'buttonSm',
    paddingVertical: 4,
    paddingIconOnly: 4,
    paddingWide: 12,
    paddingNarrow: 8,
    iconSize: 20,
  },
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { textAlign: 'center' },
})
