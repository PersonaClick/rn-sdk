import { sdkResult } from './sdkResult'

/**
 * Состояние загрузки виджета с данными — внутреннее, наружу не отдаётся:
 * `Idle | Loading | Content(data) | Empty | Error(error)` и повтор.
 *
 * Idle — грузить нечего (нет запроса, кода или инстанса). Empty — ответ пришёл, но показывать
 * нечего: блок прячется, экран выдачи рисует пустое состояние. Error — запрос упал; «Повторить»
 * запускает ту же загрузку заново.
 *
 * Состояние — простой объект с полем `status`; `data` есть только у Content, `error` — у Error.
 */

export const LOAD_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  CONTENT: 'content',
  EMPTY: 'empty',
  ERROR: 'error',
})

export const LoadState = Object.freeze({
  idle: Object.freeze({ status: LOAD_STATUS.IDLE }),
  loading: Object.freeze({ status: LOAD_STATUS.LOADING }),
  content: (data) => ({ status: LOAD_STATUS.CONTENT, data }),
  empty: Object.freeze({ status: LOAD_STATUS.EMPTY }),
  error: (error) => ({ status: LOAD_STATUS.ERROR, error }),
})

/** Пусто по умолчанию: ответа нет или это пустой массив. Для объектов виджет даёт свою проверку. */
export function isEmptyData(data) {
  return data == null || (Array.isArray(data) && data.length === 0)
}

/**
 * Контроллер загрузки: запускает загрузчик, раскладывает ответ по состояниям, отбрасывает
 * ответы устаревших запусков и повторяет последнюю загрузку.
 *
 * Промис `load()` / `retry()` не отклоняется: ошибка становится состоянием Error. Ошибка — и
 * отклонённый промис загрузчика, и ответ-ошибка метода SDK (см. sdkResult), и исключение в
 * `isEmpty` или `onChange`: иначе состояние застряло бы в Loading.
 *
 * Загрузчик получает `{ force }`: `false` при `load()`, `true` при `retry()` — чтобы «Повторить»
 * шло мимо кэша запросов (`requestCache.load(key, loader, { force })`).
 *
 * @param {{ isEmpty?: (data: any) => boolean, onChange?: (state: object) => void }} [options]
 */
export function createLoadController({ isEmpty = isEmptyData, onChange } = {}) {
  let state = LoadState.idle
  let run = 0
  let lastLoader = null

  const set = (next) => {
    state = next
    if (onChange) onChange(next)
  }

  // Ошибка запуска `current`. onChange, бросивший и на ней, уже ничего не меняет.
  const fail = (current, error) => {
    if (current !== run) return
    state = LoadState.error(error)
    try {
      if (onChange) onChange(state)
    } catch (e) {
      // Состояние уже Error; второй раз сообщать некому.
    }
  }

  const start = (loader, force) => {
    lastLoader = loader
    const current = ++run
    let request
    try {
      set(LoadState.loading)
      request = sdkResult(loader({ force }))
    } catch (error) {
      request = Promise.reject(error)
    }
    return request
      .then((data) => {
        if (current === run) set(isEmpty(data) ? LoadState.empty : LoadState.content(data))
      })
      .catch((error) => fail(current, error))
  }

  return {
    get state() {
      return state
    },
    /** @param {(options: { force: boolean }) => any} loader */
    load(loader) {
      return start(loader, false)
    },
    /** «Повторить»: та же загрузка заново, с `force`. Без прежней загрузки — ничего. */
    retry() {
      return lastLoader ? start(lastLoader, true) : Promise.resolve()
    },
    /** Назад в Idle; ответ текущей загрузки отбрасывается. */
    reset() {
      run += 1
      lastLoader = null
      set(LoadState.idle)
    },
  }
}
