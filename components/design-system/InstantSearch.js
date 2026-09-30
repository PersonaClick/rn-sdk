import React from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import InputField from './InputField'
import Link from './Link'
import ListLabel from './ListLabel'
import Tag from './Tag'
import SuggestionRow from './SuggestionRow'

/**
 * InstantSearch — экран мгновенного поиска: поле ввода с «Cancel», недавние запросы,
 * подсказки, категории и товары.
 *
 * Источник: Figma Mobile SDK UI Kit, страница InstantSearchField — Instant Search/Text
 * (151:3976), /Input (310:10207), /With Images (310:9829), /Clear Recent Searches
 * (310:10016). Поле — InputField типа search размера md, ссылки — Link, подписи блоков —
 * ListLabel, теги — Tag с переносом по строкам, строки — SuggestionRow.
 *
 * Недавние запросы — теги с крестиком, в конце синий тег «ещё»; подсказки при вводе —
 * такие же теги без крестика. Перед категориями и перед товарами разделитель 1px.
 * Совпадение с запросом в строках выделяется полужирным само.
 *
 * Внимание: шаг колонки в макете 13 — такого значения в шкале нет, взят LG (12).
 * Разделитель в макете чёрный 4%, ближайший токен lineGenericSubtle (5%).
 *
 * Подсказка: { id, title, subtitle?, source? } — subtitle у товара цена, у категории родитель.
 *
 * @param {{ query?: string, placeholder?: string, cancelText?: string,
 *           onCancel?: Function, onQueryChange?: (text: string) => void, onSubmit?: (text: string) => void,
 *           recentLabel?: string, clearText?: string, onClearRecent?: Function,
 *           recentSearches?: string[], moreText?: string, onMoreRecent?: Function,
 *           onRecentPress?: (item: string) => void, onRecentRemove?: (item: string) => void,
 *           suggestions?: string[], onSuggestionPress?: (item: string) => void,
 *           categoriesLabel?: string, categories?: Array<object>, onCategoryPress?: (item: object) => void,
 *           productsLabel?: string, products?: Array<object>, onProductPress?: (item: object) => void,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function InstantSearch({
  query = '',
  placeholder,
  cancelText,
  onCancel,
  onQueryChange,
  onSubmit,
  recentLabel,
  clearText,
  onClearRecent,
  recentSearches = [],
  moreText,
  onMoreRecent,
  onRecentPress,
  onRecentRemove,
  suggestions = [],
  onSuggestionPress,
  categoriesLabel,
  categories = [],
  onCategoryPress,
  productsLabel,
  products = [],
  onProductPress,
  renderIcon,
  style,
}) {
  const { colors } = usePersonalizationTheme()
  const separator = <View style={[styles.separator, { backgroundColor: colors.lineGenericSubtle }]} />
  const rows = (items, kind, onPress) => (
    <View style={styles.block}>
      {items.map((item, index) => (
        <SuggestionRow
          key={item.id || index}
          kind={kind}
          title={item.title}
          subtitle={item.subtitle}
          source={item.source}
          highlight={query}
          onPress={onPress ? () => onPress(item) : undefined}
          renderIcon={renderIcon}
        />
      ))}
    </View>
  )
  const removeIcon = renderIcon ? (svg, color) => renderIcon(svg, color, 16) : undefined

  return (
    <View style={[styles.screen, style]}>
      <View style={styles.header}>
        <InputField
          value={query}
          placeholder={placeholder}
          size="md"
          type="search"
          onChangeText={onQueryChange}
          // Крестик — тот же ввод пустой строки: хост сбрасывает запрос и выдачу одним путём.
          onClear={onQueryChange ? () => onQueryChange('') : undefined}
          onSubmitEditing={onSubmit ? () => onSubmit(query) : undefined}
          renderIcon={renderIcon}
          style={styles.field}
        />
        {cancelText ? <Link label={cancelText} onPress={onCancel} /> : null}
      </View>

      {recentSearches.length && recentLabel ? (
        <View style={styles.labelRow}>
          <ListLabel label={recentLabel} style={styles.field} />
          {clearText ? <Link label={clearText} onPress={onClearRecent} /> : null}
        </View>
      ) : null}
      {recentSearches.length ? (
        <View style={styles.tags}>
          {recentSearches.map((item, index) => (
            // Tag сам по себе не кликабелен — нажатие ловит обёртка, крестик — сам тег.
            <Pressable key={index} onPress={onRecentPress ? () => onRecentPress(item) : undefined}>
              <Tag
                label={item}
                view="secondary"
                onRemove={() => onRecentRemove && onRecentRemove(item)}
                renderRemoveIcon={removeIcon}
              />
            </Pressable>
          ))}
          {moreText ? (
            <Pressable onPress={onMoreRecent}>
              <Tag label={moreText} view="primary" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {suggestions.length ? (
        <View style={styles.tags}>
          {suggestions.map((item, index) => (
            <Pressable key={index} onPress={onSuggestionPress ? () => onSuggestionPress(item) : undefined}>
              <Tag label={item} view="secondary" />
            </Pressable>
          ))}
        </View>
      ) : null}

      {categories.length ? separator : null}
      {categories.length && categoriesLabel ? <ListLabel label={categoriesLabel} /> : null}
      {categories.length ? rows(categories, 'category', onCategoryPress) : null}

      {products.length ? separator : null}
      {products.length && productsLabel ? <ListLabel label={productsLabel} /> : null}
      {products.length ? rows(products, 'product', onProductPress) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  field: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  block: { gap: 12 },
  separator: { height: 1 },
})
