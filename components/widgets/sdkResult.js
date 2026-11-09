/**
 * Ответ метода SDK → промис, который отклоняется при ошибке. Общий адаптер загрузчиков виджетов
 * с данными: экран поиска, кэш запросов, состояние загрузки.
 *
 * Методы SDK при сбое промис не отклоняют: `request()` в lib/client.js ловит ошибку и
 * возвращает её как ответ, а `search`, `recommend` и другие отдают его дальше результатом.
 * Публичные методы не меняются, поэтому ошибку распознаём здесь: Error (сеть, axios), тело
 * `{ status: 'error', … }` или тело с HTTP-статусом от 400.
 */

/**
 * Ошибка в ответе метода SDK, иначе `null`.
 *
 * @param {unknown} result
 * @returns {Error|null}
 */
export function sdkError(result) {
  if (result instanceof Error) return result
  if (!result || typeof result !== 'object') return null
  const failed = result.status === 'error' || (typeof result.status === 'number' && result.status >= 400)
  if (!failed) return null
  const message = typeof result.message === 'string' && result.message ? result.message : `Request failed: ${result.status}`
  const error = new Error(message)
  error.response = result
  return error
}

/**
 * Промис ответа, отклонённый, если метод SDK вернул ошибку или ответ не прошёл проверку.
 *
 * @param {Promise<unknown>|unknown} call результат вызова метода SDK
 * @param {(result: any) => boolean} [isValid] ответ ожидаемой формы
 * @returns {Promise<any>}
 */
export function sdkResult(call, isValid) {
  return Promise.resolve(call).then((result) => {
    const error = sdkError(result)
    if (error) throw error
    if (isValid && !isValid(result)) {
      const unexpected = new Error('Unexpected response')
      unexpected.response = result
      throw unexpected
    }
    return result
  })
}
