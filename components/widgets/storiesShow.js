/**
 * Показ сторис без ленты — `PersonalizationStories.show(...)` (D, B8). Чистая очередь запросов
 * без React: хост показа (слой в `<SdkPopupOverlay>`) подписывается сюда и рисует текущий запрос
 * скрытым виджетом сторис, который открывает просмотр.
 *
 * Один показ за раз: новый `show` заменяет текущий (его промис завершается). Промис показа
 * завершается, когда просмотр закрыт, блок не загрузился или оказался пустым (тогда сперва
 * `onError`, F12). Хоста нет (`<SdkPopupOverlay>` не смонтирован) — `onError` запроса и сразу
 * завершение.
 */

let host = null
let active = null
let sequence = 0

/**
 * Подключает хост показа: `render(request | null)` получает текущий запрос или `null`.
 * @returns {() => void} отключение
 */
export function attachStoriesShowHost(render) {
  host = render
  if (active) render(active)
  return () => {
    if (host === render) host = null
  }
}

/**
 * Запрос показа. `options` — пропсы виджета (code, sdk/shopId, колбэки, тексты) и `startStoryId`.
 * @returns {Promise<void>} завершается, когда показ кончился
 */
export function requestStoriesShow(options = {}) {
  return new Promise((resolve) => {
    if (!host) {
      const error = new Error(
        'PersonalizationStories.show needs a mounted <SdkPopupOverlay /> (or use <PersonalizationStories bar={false} ref={...} /> and ref.open()).',
      )
      try {
        options.onError && options.onError(error)
      } finally {
        resolve()
      }
      return
    }
    if (active) active.finish()
    let finished = false
    const request = {
      id: ++sequence,
      options,
      finish: () => {
        if (finished) return
        finished = true
        if (active === request) {
          active = null
          host && host(null)
        }
        resolve()
      },
    }
    active = request
    host(request)
  })
}

/** Текущий запрос показа (для тестов и хоста). */
export function activeStoriesShow() {
  return active
}
