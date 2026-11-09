import AsyncStorage from '@react-native-async-storage/async-storage'
import { sdkResult } from './sdkResult'
import { createResultsPagesLoader } from './resultsSupport'

/**
 * Недавние запросы пользователя — локальная история виджета поиска, по магазину.
 *
 * Сервер тоже помнит последние запросы (`last_queries` в `search/blank`), но не умеет
 * забывать по одному, а в макете у каждого тега крестик и есть «Clear». Поэтому история
 * живёт в AsyncStorage под ключом с id магазина.
 */
export class RecentSearches {
  constructor(shopKey, limit) {
    this.key = `personalization.ui.recentSearches.${shopKey}`
    this.limit = limit
  }

  async load() {
    try {
      const raw = await AsyncStorage.getItem(this.key)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
    } catch (e) {
      return []
    }
  }

  /** Кладёт запрос в начало, убирая дубль, и режет по лимиту. */
  async add(query) {
    const trimmed = String(query || '').trim()
    const items = await this.load()
    if (!trimmed) return items
    const next = [trimmed, ...items.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())]
    return this.save(next.slice(0, this.limit))
  }

  async remove(query) {
    return this.save((await this.load()).filter((item) => item !== query))
  }

  async clear() {
    return this.save([])
  }

  async save(items) {
    try {
      await AsyncStorage.setItem(this.key, JSON.stringify(items))
    } catch (e) {
      // История — удобство, не данные: без хранилища виджет просто её не помнит.
    }
    return items
  }
}

/** Имя родительской категории: в ответе родитель — это id, имя ищем среди пришедших. */
export function parentName(category, all) {
  if (!category.parent) return undefined
  const parent = all.find((item) => item.id === category.parent)
  return parent ? parent.name : undefined
}

/**
 * Страницы полной выдачи — общее ядро экранов выдачи (см. resultsSupport) под прежними именами.
 */
export {
  RESULTS_PAGES_INITIAL as SEARCH_PAGES_INITIAL,
  RESULTS_ERROR_TEXT as SEARCH_ERROR_TEXT,
  RESULTS_RETRY_TEXT as SEARCH_RETRY_TEXT,
  resultsPagesReducer as searchPagesReducer,
  resultsView as searchResultsView,
  isResultsResponse as isSearchResponse,
} from './resultsSupport'

/**
 * Загрузка страниц полной выдачи без UI: запросы в `search`, каждая новая первая страница
 * (запрос, сортировка, фильтры, инстанс) трекается событием `search`; «Load more» и повтор — нет.
 * Остальное — createResultsPagesLoader.
 *
 * @param {{ dispatch: (action: object) => void, onFirstPage?: (response: object) => void,
 *           onError?: (error: unknown) => void }} handlers
 */
export function createSearchPagesLoader({ dispatch, onFirstPage, onError }) {
  return createResultsPagesLoader({
    dispatch,
    onFirstPage,
    onError,
    request: (sdk, text, options) => sdk.search(options),
    onStart: (sdk, text) => sdk.track('search', text),
  })
}

/**
 * Запросы мгновенного поиска без UI: пустое состояние (`searchBlank`) и instant-поиск
 * (`search({type: 'instant_search'})`). Сбой — и отклонённый промис, и ответ-ошибка метода
 * SDK (см. sdkResult) — уходит в `onError`, как в экране выдачи, а ответом не становится.
 *
 * Ответ и ошибка устаревшего запроса отбрасываются: у пустого состояния — после нового
 * `blank()`, у instant — после нового `instant()` или `clearInstant()` (запрос стал короче
 * `minChars`); `cancel()` — размонтирование — отбрасывает всё в полёте.
 *
 * @param {{ onBlank: (response: object) => void, onInstant: (response: object) => void,
 *           onError?: (error: unknown) => void }} handlers
 */
export function createInstantSearchLoader({ onBlank, onInstant, onError }) {
  const seq = { blank: 0, instant: 0 }

  const run = (kind, call, deliver) => {
    const current = ++seq[kind]
    let request
    try {
      request = call()
    } catch (error) {
      request = Promise.reject(error)
    }
    return sdkResult(request).then(
      (response) => {
        if (current === seq[kind]) deliver(response || {})
      },
      (error) => {
        if (current === seq[kind] && onError) onError(error)
      },
    )
  }

  return {
    /** Пустое состояние: товары, популярные категории и фразы. */
    blank(sdk) {
      return run('blank', () => sdk.searchBlank(), onBlank)
    },

    /** Instant-поиск. Ключи только со значением: слой запросов SDK шлёт undefined строкой «undefined». */
    instant(sdk, text, locations) {
      const options = { type: 'instant_search', search_query: text }
      if (locations) options.locations = locations
      return run('instant', () => sdk.search(options), onInstant)
    },

    clearInstant() {
      seq.instant += 1
    },

    cancel() {
      seq.blank += 1
      seq.instant += 1
    },
  }
}
