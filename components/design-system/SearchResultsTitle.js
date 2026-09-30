import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'
import Title from './Title'
import Button from './Button'
import ButtonGroup from './ButtonGroup'
import Tag from './Tag'

/**
 * SearchResultsTitle — заголовок выдачи поиска.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Title (167:3802), символ Search results (167:3807).
 * Три ряда: заголовок с кнопкой «назад» и переключателем вида, строка с фильтром,
 * сортировкой и числом найденного, ряд применённых фильтров-тегов.
 * Два нижних ряда в макете скрываемые (showResults, showFilters) — здесь они
 * прячутся сами, когда данных нет.
 *
 * Собран из готовых компонентов: Title, Button, ButtonGroup, Tag.
 * Слова строки «найдено N товаров» — параметры, локализация за интегратором.
 *
 * @param {{ title: string, selectedViewIndex?: number, onBack?: Function,
 *           onViewChange?: (index: number) => void, onFilters?: Function, onSort?: Function,
 *           showFiltersButton?: boolean, showSortButton?: boolean,
 *           results?: { prefix: string, count: number, suffix: string },
 *           filters?: Array<{ label: string, onRemove: Function }>,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function SearchResultsTitle({
  title,
  selectedViewIndex = 0,
  onBack,
  onViewChange,
  onFilters,
  onSort,
  showFiltersButton = true,
  showSortButton = true,
  results,
  filters = [],
  renderIcon,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const regular = [theme.typography.smDefault, { color: colors.textSecondary }]
  const strong = [theme.typography.smEmphasized, { color: colors.textSecondary }]

  return (
    <View style={[styles.column, style]}>
      <Title
        title={title}
        leading={
          <Button
            size="md"
            view="ghost"
            iconStart={PERSONALIZATION_ICONS.arrowLeft}
            renderIcon={renderIcon}
            onPress={onBack}
          />
        }
        trailing={
          <ButtonGroup
            items={[
              {
                icon: PERSONALIZATION_ICONS.grid2x2,
                activeIcon: PERSONALIZATION_ICONS.grid2x2Fill,
              },
              { icon: PERSONALIZATION_ICONS.list, activeIcon: PERSONALIZATION_ICONS.listFill },
            ]}
            selectedIndex={selectedViewIndex}
            onSelect={onViewChange}
            renderIcon={renderIcon}
          />
        }
      />

      {results ? (
        <View style={styles.resultsRow}>
          <View style={styles.controls}>
            {showFiltersButton ? (
              <Button
                size="md"
                view="ghost"
                iconStart={PERSONALIZATION_ICONS.equalizerHorizontal}
                renderIcon={renderIcon}
                onPress={onFilters}
              />
            ) : null}
            {showSortButton ? (
              <Button
                size="md"
                view="ghost"
                iconStart={PERSONALIZATION_ICONS.arrowsUpDown}
                renderIcon={renderIcon}
                onPress={onSort}
              />
            ) : null}
          </View>
          <View style={styles.found}>
            <Text style={regular}>{results.prefix}</Text>
            <Text style={strong}>{String(results.count)}</Text>
            <Text style={strong}>{results.suffix}</Text>
          </View>
        </View>
      ) : null}

      {filters.length > 0 ? (
        <View style={styles.filtersRow}>
          {filters.map((filter, index) => (
            <Tag
              key={index}
              label={filter.label}
              view="secondary"
              onRemove={filter.onRemove}
              renderRemoveIcon={
                renderIcon ? (svg, color) => renderIcon(svg, color, 16) : undefined
              }
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  column: { gap: 8 },
  resultsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  found: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
})
