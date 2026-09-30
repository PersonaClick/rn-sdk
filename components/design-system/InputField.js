import React, { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'

/**
 * InputField — поле ввода дизайн-системы.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Input (167:3746), фрейм Input Field (205:10194).
 * Матрица: 3 размера x 4 состояния x 3 типа.
 *
 * Состояния из макета не задаются снаружи, а выводятся из самого поля:
 * Default — пусто, Filled — есть текст, Focus — поле в фокусе, Disabled — disabled.
 *
 * Иконки: React Native не рисует SVG сам, исходники отдаются через renderIcon
 * (например SvgXml из react-native-svg). Без него место под иконку сохраняется.
 *
 * @param {{ value?: string, placeholder?: string, size?: 'lg'|'md'|'sm',
 *           type?: 'search'|'input'|'select', disabled?: boolean,
 *           onChangeText?: (text: string) => void, onSubmitEditing?: Function,
 *           onClear?: Function, onSelectPress?: Function,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function InputField({
  value = '',
  placeholder,
  size = 'lg',
  type = 'search',
  disabled = false,
  onChangeText,
  onSubmitEditing,
  onClear,
  onSelectPress,
  renderIcon,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const metrics = SIZES[size] || SIZES.lg
  const [focused, setFocused] = useState(false)

  const filled = typeof value === 'string' && value.length > 0
  const foreground = filled && !disabled ? colors.textPrimary : colors.textHint

  // Крестик — это очистка, поэтому он появляется только когда есть что чистить.
  const endIcon =
    type === 'select'
      ? PERSONALIZATION_ICONS.angleDown
      : type === 'search' && filled && !disabled
        ? PERSONALIZATION_ICONS.cross
        : null

  // Рамка добавляется к размеру сверх отступов, поэтому отступ уменьшен на её толщину:
  // иначе поле выходит на 2px выше макета.
  const pv = metrics.paddingVertical - BORDER
  const horizontal =
    type === 'search'
      ? { paddingLeft: pv, paddingRight: pv }
      : type === 'input'
        ? {
            paddingLeft: metrics.paddingInput - BORDER,
            paddingRight: metrics.paddingInput - BORDER,
          }
        : { paddingLeft: metrics.paddingSelectStart - BORDER, paddingRight: pv }

  // У select тело лежит в Pressable, и стиль хоста (например flex: 1 в ряду) должен
  // попасть на обёртку: иначе она не растянется, а текст внутри схлопнется в ноль.
  const select = type === 'select'
  const body = (
    <View
      style={[
        styles.container,
        horizontal,
        {
          paddingTop: pv,
          paddingBottom: pv,
          borderRadius: theme.radius[metrics.radius],
          backgroundColor: disabled ? colors.backgroundInputDisabled : colors.backgroundInput,
          borderColor: focused && !disabled ? colors.lineInputFocus : colors.lineInput,
        },
        select ? undefined : style,
      ]}
    >
      {type === 'search' ? (
        <View style={{ width: metrics.iconSize, height: metrics.iconSize }}>
          {/* В макете иконка идёт в цвет текста: серая в Default и Disabled, тёмная в Filled. */}
          {renderIcon
            ? renderIcon(PERSONALIZATION_ICONS.magnifier, foreground, metrics.iconSize)
            : null}
        </View>
      ) : null}

      {type === 'select' ? (
        <Text style={[metrics.text, styles.field, { fontFamily: fontFor(theme, '400'), color: foreground }]} numberOfLines={1}>
          {filled ? value : placeholder}
        </Text>
      ) : (
        <TextInput
          style={[metrics.text, styles.field, { fontFamily: fontFor(theme, '400'), color: foreground }]}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.textHint}
          editable={!disabled}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={type === 'search' ? 'search' : 'done'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      )}

      {endIcon ? (
        <Pressable
          onPress={type === 'search' ? onClear : onSelectPress}
          style={{ width: metrics.iconSize, height: metrics.iconSize }}
          hitSlop={8}
        >
          {renderIcon ? renderIcon(endIcon, foreground, metrics.iconSize) : null}
        </Pressable>
      ) : null}
    </View>
  )

  // Select — не поле ввода: список открывает потребитель по нажатию на всю строку.
  if (select) {
    return (
      <Pressable onPress={disabled ? undefined : onSelectPress} disabled={disabled} style={style}>
        {body}
      </Pressable>
    )
  }
  return body
}

const BORDER = 1

const SIZES = {
  // LG берёт кегль со ступени lg, а интерлиньяж со ступени xl: в макете 18/32,
  // тогда как ступень lg — это 18/28. SM так же смешан: 14/24 против 14/20.
  lg: {
    text: { fontSize: 18, lineHeight: 32, letterSpacing: 0, fontWeight: '400' },
    radius: 'buttonLg',
    paddingVertical: 12,
    paddingInput: 16,
    paddingSelectStart: 16,
    iconSize: 32,
  },
  md: {
    text: { fontSize: 16, lineHeight: 24, letterSpacing: 0, fontWeight: '400' },
    radius: 'buttonMd',
    paddingVertical: 8,
    paddingInput: 12,
    paddingSelectStart: 12,
    iconSize: 24,
  },
  sm: {
    text: { fontSize: 14, lineHeight: 24, letterSpacing: 0.05, fontWeight: '400' },
    radius: 'buttonSm',
    paddingVertical: 4,
    paddingInput: 12,
    paddingSelectStart: 8,
    iconSize: 24,
  },
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: BORDER,
  },
  field: { flex: 1, padding: 0 },
})
