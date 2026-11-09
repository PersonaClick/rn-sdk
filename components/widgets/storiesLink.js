import { awaitInstance, isAmbiguousDefault } from '../../lib/facade/facade'
import { parseStoriesShareLink, playableStories, storiesShareLinkKey } from '../design-system/storySupport'
import { fetchSharedStoryV3, resolveStoriesApiV3Domain } from './storiesApiV3'
import { activeStoriesShow, closeOpenStoriesViewers, requestStoriesShow } from './storiesShow'

/**
 * Открытие кампании по ссылке «Поделиться» — `PersonalizationStories.handleLink(url, options)`.
 * Чистая логика без React: показ идёт через тот же хост, что и `show()` (`<SdkPopupOverlay>`).
 *
 * Ссылка сторис (`parseStoriesShareLink`) и есть хост v3 (`apiV3Domain` параметра, иначе глобальный
 * `PersonalizationStories.apiV3Domain`) — `true`, дальше асинхронно: ждём
 * SDK (как show), грузим `/story/{id}?slide_id=` из v3, закрываем другие открытые просмотры и
 * показываем ответ с первой сторис на слайде ссылки, если он в ней есть, иначе на `start_position`
 * (в обход «первого невиденного»); после показа — `shared_open` со слайдом, с которого начали. Ошибка, 404, пусто или 15 с без ответа — `onError`, ничего не
 * показываем, событий нет. Та же ссылка, пока грузится или её просмотр открыт, — повтор не нужен,
 * тоже `true`. Иначе `false`, и ничего не происходит.
 */

/** SDK и ответ — не дольше, мс (как у show, D). */
export const STORIES_LINK_TIMEOUT = 15000

/** Пауза между закрытием другого просмотра и показом: модалку во время закрытия iOS не покажет. */
export const STORIES_LINK_REOPEN_DELAY = 400

let loading = null
let sequence = 0

/**
 * @param {string} url
 * @param {object} [options] как у show(), кроме `code` и `startStoryId`
 * @returns {boolean}
 */
export function handleStoriesLink(url, options = {}) {
  const link = parseStoriesShareLink(url)
  const host = resolveStoriesApiV3Domain(options ? options.apiV3Domain : undefined)
  if (!link || !host) return false
  const key = storiesShareLinkKey(link)
  if ((loading && loading.key === key) || activeStoriesShow()?.options?.shared === key) return true

  const id = ++sequence
  loading = { key, id }
  const { sdk: explicit, shopId, onError, ...rest } = options || {}
  // Код и стартовая сторис — из ссылки.
  delete rest.code
  delete rest.startStoryId
  const report = (error) => {
    try {
      onError && onError(error)
    } catch (callbackError) {
      // Колбэк хоста не должен ронять SDK.
    }
  }
  let finished = false
  let cancel = null
  const stop = () => {
    finished = true
    clearTimeout(timer)
    if (cancel) cancel()
  }
  const release = () => {
    if (loading && loading.id === id) loading = null
  }
  const fail = (error) => {
    if (finished) return
    stop()
    release()
    report(error)
  }
  const timer = setTimeout(() => fail(new Error('PersonalizationStories: the shared story did not load in 15 s.')), STORIES_LINK_TIMEOUT)

  const load = (sdk) => {
    Promise.resolve()
      .then(() => fetchSharedStoryV3(sdk, link, host))
      .then((response) => {
        if (finished) return
        const stories = playableStories(response.stories)
        if (stories.length === 0) throw new Error('PersonalizationStories: the shared story is empty.')
        stop()
        // Пока грузили, пришла другая ссылка — показывать её, а не эту.
        if (id !== sequence) {
          release()
          return
        }
        const present = () => {
          release()
          requestStoriesShow({
            ...rest,
            onError,
            code: link.code,
            sdk,
            preloaded: { response: { ...response, stories }, host, slideId: link.slideId },
            shared: key,
          })
        }
        if (closeOpenStoriesViewers()) setTimeout(present, STORIES_LINK_REOPEN_DELAY)
        else present()
      })
      .catch(fail)
  }

  if (explicit) {
    load(explicit)
  } else if (isAmbiguousDefault(shopId ?? null)) {
    Promise.resolve().then(() => fail(new Error('PersonalizationStories: several shops are registered — pass shopId or sdk.')))
  } else {
    const off = awaitInstance(shopId ?? null, (sdk) => {
      if (!finished) load(sdk)
    })
    if (finished) off()
    else cancel = off
  }
  return true
}

/** Для тестов: забыть ссылку, которая грузится. */
export function resetStoriesLinkState() {
  loading = null
}
