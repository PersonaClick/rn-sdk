import { sdkError } from './sdkResult'
import { createResultsPagesLoader } from './resultsSupport'

/**
 * Ответ `getCategory` → ответ API той же формы, что у полной выдачи поиска (`products`,
 * `products_total`, `brands`, `price_range`, `filters`). Метод SDK разбирает ответ и кладёт его
 * целиком в `raw`; тело-ошибку сервера он не отклоняет, а разбирает как пустую категорию —
 * поэтому ошибка ищется и в `raw`, иначе экран показал бы «пусто» вместо «Повторить».
 *
 * @param {unknown} answer
 * @returns {object}
 */
export function categoryResponse(answer) {
  const response = answer && typeof answer === 'object' && answer.raw && typeof answer.raw === 'object' ? answer.raw : answer
  const error = sdkError(answer) || sdkError(response)
  if (error) throw error
  return response
}

/**
 * Загрузка страниц категории без UI: запросы в `getCategory(categoryId, options)`. Просмотр
 * категории (`track('category', id)`) уходит один раз на категорию и инстанс — не на страницы,
 * фильтры, сортировку и повтор. Остальное — createResultsPagesLoader.
 *
 * @param {{ dispatch: (action: object) => void, onFirstPage?: (response: object) => void,
 *           onError?: (error: unknown) => void }} handlers
 */
export function createCategoryPagesLoader({ dispatch, onFirstPage, onError }) {
  let tracked = null
  return createResultsPagesLoader({
    dispatch,
    onFirstPage,
    onError,
    request: (sdk, categoryId, options) => Promise.resolve(sdk.getCategory(categoryId, options)).then(categoryResponse),
    onStart: (sdk, categoryId) => {
      if (tracked && tracked.sdk === sdk && tracked.categoryId === categoryId) return
      tracked = { sdk, categoryId }
      sdk.track('category', categoryId)
    },
  })
}
