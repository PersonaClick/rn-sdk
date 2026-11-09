import React from 'react'
import ResultsScreen from './ResultsScreen'
import { createCategoryPagesLoader } from './categorySupport'

const NO_BASE = Object.freeze({})

/**
 * CategoryScreen — экран выдачи категории с данными SDK, сестра SearchResultsScreen и с тем же
 * ядром (ResultsScreen): заголовок с названием категории, плитка ⇄ список, кнопки фильтров и
 * сортировки, число товаров, теги применённых фильтров, счётчик, «загрузить ещё» или бесконечная
 * прокрутка, пустое состояние, ошибка с «Повторить» и экран фильтров.
 *
 * Источник — `getCategory(categoryId, { limit, page, … })` с применёнными брендами, фасетами
 * (`filters` — JSON), ценой (`price_min` / `price_max`), сортировкой (`sort_by` / `sort_dir`) и
 * локациями. Ответ того же вида, что у поиска, но без `industrial_filters`: секций цвета и
 * размера у категории нет. Фасеты — как у поиска (`facets`, `maxFacets`).
 *
 * Название (`title`) задаёт хост, «назад» — `onBack`. Число товаров — «N products»: слова
 * `foundPrefix` (по умолчанию нет) и `foundSuffix`. Сортировка, колбэки и остальные тексты —
 * как у SearchResultsScreen.
 *
 * Трекинг: просмотр категории (`track('category', categoryId)`) — один раз на экран и
 * категорию, не на страницы, фильтры, сортировку и повтор. Источник трекинга по нажатию на
 * товар не ставится.
 *
 * Инстанс SDK: `sdk` явно, иначе `shopId` (или единственный зарегистрированный) через
 * `awaitInstance` фасада.
 *
 * @param {{ categoryId: string, title?: string, sdk?: object, shopId?: string,
 *           foundPrefix?: string, foundSuffix?: string, emptyText?: string }} props
 *        остальное — как у SearchResultsScreen
 */
export default function CategoryScreen({
  categoryId,
  title = '',
  foundPrefix = '',
  foundSuffix = 'products',
  emptyText = 'No products in this category.',
  ...rest
}) {
  const source = categoryId == null ? '' : String(categoryId).trim()
  return (
    <ResultsScreen
      {...rest}
      source={source}
      requestBase={NO_BASE}
      createLoader={createCategoryPagesLoader}
      title={title}
      foundPrefix={foundPrefix}
      foundSuffix={foundSuffix}
      emptyText={emptyText}
    />
  )
}
