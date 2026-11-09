import React from 'react'
import ResultsScreen from './ResultsScreen'
import { createSearchPagesLoader } from './searchSupport'

/**
 * SearchResultsScreen — экран полной выдачи с данными SDK: заголовок с числом найденного,
 * плитка ⇄ список, теги применённых фильтров, счётчик, «загрузить ещё» или бесконечная
 * прокрутка, пустое состояние и экран фильтров. Виджет сам ходит в
 * `search({type: 'full_search'})` и держит состояние. Ядро общее с CategoryScreen — ResultsScreen.
 *
 * Ошибка загрузки: первая страница — вместо выдачи текст `errorText` и кнопка `retryText`
 * (EmptyState и Button кита), нажатие грузит её заново; следующая — кнопка «Load more»
 * становится `retryText` и повторяет ту же страницу. `onError` получает каждую ошибку.
 *
 * Паттерн SearchResultsScreen из Figma (страница 1:30), источник — `searchFull(query)`.
 * Визуальный слой — SearchResultsTitle в заголовке Catalog; фильтры — Filters поверх выдачи
 * внутри этого же виджета, так что экран занимает весь отведённый ему экран хоста.
 *
 * Инстанс SDK: `sdk` явно, иначе `shopId` (или единственный зарегистрированный) через
 * `awaitInstance` фасада.
 *
 * Фасеты строятся из ответа: диапазон цены (`price_range`), бренды, цвета и размеры
 * (`industrial_filters`) и произвольные фасеты магазина (`filters`): без явного `facets` — те,
 * где больше одного значения, по числу товаров, первые `maxFacets`. Применённые значения идут
 * тегами в заголовок и параметрами в следующий запрос. Заголовок произвольного фасета — его имя
 * через `facetTitle`. Подпись значения фасета — от хоста (`facetValueTitle`), иначе `title`
 * значения-объекта (JSON), иначе само значение; в запрос уходит исходное. Рядом с вариантом —
 * число товаров из ответа (`showValueCounts`), в тегах его нет.
 *
 * Сортировки: кнопка в заголовке отдаёт `onSortPress` хосту (пикер в макете не нарисован),
 * выбранное хост кладёт в `sortBy` / `sortDir`. Каждый новый запрос трекается событием
 * `search`; нажатие на карточку запоминает источник `full_search` и отдаёт товар через
 * `onProductPress`, кнопка карточки — через `onProductAction`.
 *
 * @param {{ sdk?: object, shopId?: string, query: string, titleText?: string, pageSize?: number,
 *           sortBy?: string|null, sortDir?: string|null, locations?: string,
 *           infiniteScroll?: boolean, showFilters?: boolean, showSort?: boolean,
 *           facets?: string[]|null, maxFacets?: number|null, productActionText?: string,
 *           showRating?: boolean, layout?: 'grid'|'list',
 *           imageAspect?: 'square'|'landscape'|'portrait',
 *           onBack?: Function, onSortPress?: Function,
 *           onProductPress?: (product: object) => void, onProductAction?: (product: object) => void,
 *           onError?: (error: unknown) => void,
 *           foundPrefix?: string, foundSuffix?: string, countPrefix?: string, countSeparator?: string,
 *           loadMoreText?: string, emptyText?: string, errorText?: string, retryText?: string,
 *           filtersTitle?: string, resetText?: string,
 *           applyText?: string, showMoreText?: string, showLessText?: string, priceTitle?: string,
 *           fromLabel?: string, toLabel?: string, brandsTitle?: string, colorsTitle?: string,
 *           sizesTitle?: string, facetTitle?: (name: string) => string|null,
 *           facetValueTitle?: (facet: string, value: string) => string|null,
 *           showValueCounts?: boolean,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function SearchResultsScreen({
  query,
  titleText,
  foundPrefix = 'Found',
  foundSuffix = 'products',
  emptyText = 'No results for your request.',
  ...rest
}) {
  const text = (query || '').trim()
  return (
    <ResultsScreen
      {...rest}
      source={text}
      requestBase={{ type: 'full_search', search_query: text }}
      createLoader={createSearchPagesLoader}
      onProductTap={(sdk) => text && sdk.trackSource('full_search', text)}
      title={titleText || query}
      foundPrefix={foundPrefix}
      foundSuffix={foundSuffix}
      emptyText={emptyText}
    />
  )
}
