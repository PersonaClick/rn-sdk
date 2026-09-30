import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'
import Title from './Title'
import Button from './Button'
import InputField from './InputField'
import CheckboxWithLabel from './CheckboxWithLabel'
import Accordion from './Accordion'

/**
 * Filters — экран фильтров выдачи: заголовок с крестиком, секции и две кнопки внизу.
 *
 * Источник: Figma Mobile SDK UI Kit, страница SearchResultsScreen — Search Results/Filters
 * (203:8083) и /Filters Dark Theme (241:10831). Заголовок — Title c ghost-кнопкой
 * cross-large (Title/Filters, 204:8340). Секции двух видов: диапазон «From — to» из двух
 * InputField md и список CheckboxWithLabel с Accordion «показать ещё». Внизу Button md:
 * secondary «Reset» и primary «Apply» поровну. Шаг между секциями 16, внутри секции 12,
 * заголовок секции — lgEmphasized 18/28. Фон экрана — backgroundGeneric.
 *
 * Секция: { id, title, kind: 'range', fromLabel, toLabel, from?, to?, select?,
 *   fromPlaceholder?, toPlaceholder? } (плейсхолдеры — подсказки в пустых полях, например границы) или
 * { id, title, kind: 'options', options: [{ id, label, checked? }], collapsedCount?,
 *   showMoreText?, showLessText? }. Состояние чекбоксов, полей и раскрытия живёт здесь;
 * хост получает изменения колбэками и на «Apply» — итоговый список секций.
 *
 * @param {{ title: string, onClose?: Function, sections?: Array<object>,
 *           resetText?: string, applyText?: string, onReset?: Function,
 *           onApply?: (sections: Array<object>) => void,
 *           onOptionToggle?: (sectionId: string, optionId: string, checked: boolean) => void,
 *           onRangeChange?: (sectionId: string, from: string, to: string) => void,
 *           onRangeSelectPress?: (sectionId: string, isFrom: boolean) => void,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function Filters({
  title,
  onClose,
  sections = [],
  resetText,
  applyText,
  onReset,
  onApply,
  onOptionToggle,
  onRangeChange,
  onRangeSelectPress,
  renderIcon,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const [state, setState] = useState(sections)
  const [expanded, setExpanded] = useState({})
  useEffect(() => setState(sections), [sections])

  const update = (sectionId, change) =>
    setState((current) => current.map((section) => (section.id === sectionId ? change(section) : section)))

  const range = (section) => {
    const field = (isFrom) => (
      <InputField
        value={(isFrom ? section.from : section.to) || ''}
        placeholder={isFrom ? section.fromPlaceholder : section.toPlaceholder}
        size="md"
        type={section.select ? 'select' : 'input'}
        onChangeText={(text) => {
          const next = { ...section, [isFrom ? 'from' : 'to']: text }
          update(section.id, () => next)
          onRangeChange && onRangeChange(section.id, next.from || '', next.to || '')
        }}
        onSelectPress={onRangeSelectPress ? () => onRangeSelectPress(section.id, isFrom) : undefined}
        renderIcon={renderIcon}
        style={styles.field}
      />
    )
    const label = (text) => <Text style={[theme.typography.baseDefault, { color: colors.textPrimary }]}>{text}</Text>
    return (
      <View style={styles.range}>
        {label(section.fromLabel)}
        {field(true)}
        {label(section.toLabel)}
        {field(false)}
      </View>
    )
  }

  const options = (section) => {
    const collapsedCount = section.collapsedCount ?? DEFAULT_COLLAPSED
    const collapsible = section.options.length > collapsedCount && !!section.showMoreText
    const open = !!expanded[section.id]
    const visible = collapsible && !open ? section.options.slice(0, collapsedCount) : section.options
    return (
      <View style={styles.options}>
        {visible.map((option) => (
          <CheckboxWithLabel
            key={option.id}
            label={option.label}
            state={option.checked ? 'checked' : 'unchecked'}
            onChange={(next) => {
              const checked = next === 'checked'
              update(section.id, (current) => ({
                ...current,
                options: current.options.map((item) => (item.id === option.id ? { ...item, checked } : item)),
              }))
              onOptionToggle && onOptionToggle(section.id, option.id, checked)
            }}
          />
        ))}
        {collapsible ? (
          <Accordion
            label={open ? section.showLessText || section.showMoreText : section.showMoreText}
            count={open ? undefined : section.options.length - collapsedCount}
            expanded={open}
            onToggle={(next) => setExpanded((current) => ({ ...current, [section.id]: next }))}
            renderIcon={renderIcon}
          />
        ) : null}
      </View>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.backgroundGeneric }, style]}>
      <Title
        title={title}
        trailing={
          <Button size="md" view="ghost" iconStart={PERSONALIZATION_ICONS.crossLarge} renderIcon={renderIcon} onPress={onClose} />
        }
      />
      {state.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={[theme.typography.lgEmphasized, { color: colors.textPrimary }]}>{section.title}</Text>
          {section.kind === 'range' ? range(section) : options(section)}
        </View>
      ))}
      <View style={styles.buttons}>
        <Button label={resetText} size="md" view="secondary" onPress={onReset} style={styles.button} />
        <Button label={applyText} size="md" view="primary" onPress={onApply ? () => onApply(state) : undefined} style={styles.button} />
      </View>
    </View>
  )
}

const DEFAULT_COLLAPSED = 5

const styles = StyleSheet.create({
  screen: { gap: 16 },
  section: { gap: 12 },
  range: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: { flex: 1 },
  options: { gap: 12, alignItems: 'flex-start' },
  buttons: { flexDirection: 'row', gap: 16, paddingTop: 16 },
  button: { flex: 1 },
})
