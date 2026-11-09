import { sdkResult } from './sdkResult'

/**
 * Кэш запросов виджетов с данными — в памяти процесса, наружу не отдаётся.
 *
 * Блок в ленте хоста (FlatList) пересоздаётся, когда уходит за экран и возвращается; без кэша
 * каждый такой показ — новый запрос и мигание. Поэтому ответ живёт 10 минут под ключом
 * «магазин + вид запроса + параметры». Записей не больше 32: лишние вытесняются начиная с
 * самой старой. Ошибки не кэшируются: следующий вызов идёт в сеть заново. Ошибка — и
 * отклонённый промис загрузчика, и ответ-ошибка метода SDK (см. sdkResult).
 *
 * Одинаковые запросы, пока первый в полёте, ждут его ответа. Но повисший запрос не держит ключ:
 * старше 30 секунд он новых ожидающих не принимает — стартует новый (новое поколение); отписка
 * последнего ожидающего тоже снимает его. Ответ старого поколения получают только его ожидающие,
 * в кэш он не кладётся, если после него стартовал запрос новее или был clear(). «Повторить»
 * грузит с `force` — мимо готового ответа и мимо запроса в полёте.
 */

export const REQUEST_CACHE_TTL = 10 * 60 * 1000
export const REQUEST_CACHE_LIMIT = 32
export const REQUEST_CACHE_STALL = 30 * 1000

/**
 * Параметры в ключ: ключи объектов по алфавиту, `undefined` пропускается — порядок не важен.
 * Date, Map и Set раскрываются: иначе JSON превратит их в `{}` и разные параметры совпадут.
 */
function stable(value) {
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Map) return { $map: [...value.entries()].map(stable).sort(byJson) }
  if (value instanceof Set) return { $set: [...value].map(stable).sort(byJson) }
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .reduce((out, key) => ({ ...out, [key]: stable(value[key]) }), {})
  }
  return value
}

function byJson(a, b) {
  const left = JSON.stringify(a)
  const right = JSON.stringify(b)
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * Ключ записи: магазин, вид запроса (`recommend`, `collection`…) и параметры — массивом в JSON,
 * чтобы разделитель внутри значения не склеил разные ключи.
 *
 * @param {string} shopId
 * @param {string} kind
 * @param {object} [params]
 */
export function requestCacheKey(shopId, kind, params) {
  return JSON.stringify([shopId, kind, stable(params ?? {})])
}

/**
 * @param {{ ttl?: number, limit?: number, stall?: number, now?: () => number }} [options]
 *   `now` — часы, для тестов
 */
export function createRequestCache({
  ttl = REQUEST_CACHE_TTL,
  limit = REQUEST_CACHE_LIMIT,
  stall = REQUEST_CACHE_STALL,
  now = Date.now,
} = {}) {
  // Map хранит порядок вставки: первая запись — самая старая.
  const entries = new Map() // key → { value, at }
  const flights = new Map() // key → запрос в полёте, к которому присоединяются: { generation, at, waiters }
  // key → { latest: поколение последнего начатого запроса, count: сколько запросов ключа не ответили }
  const pending = new Map()
  let started = 0
  let clearedAt = 0 // поколения не новее этого начаты до clear()

  const fresh = (key) => {
    const entry = entries.get(key)
    if (!entry) return undefined
    if (now() - entry.at < ttl) return entry
    entries.delete(key)
    return undefined
  }

  // Каждому ожидающему — один вызов; исключение одного колбэка не мешает остальным.
  const notify = (waiter, method, payload) => {
    if (!waiter.active) return
    waiter.active = false
    try {
      if (waiter[method]) waiter[method](payload)
    } catch (e) {
      // Ошибка колбэка — забота ожидающего.
    }
  }

  const finish = (key, flight) => {
    if (flights.get(key) === flight) flights.delete(key)
    const record = pending.get(key)
    record.count -= 1
    if (record.count === 0) pending.delete(key)
  }

  // Ответ в кэш — только от последнего начатого запроса ключа и только если не было clear().
  const store = (key, flight, value) => {
    if (pending.get(key).latest !== flight.generation || flight.generation <= clearedAt) return
    entries.delete(key)
    entries.set(key, { value, at: now() })
    while (entries.size > limit) entries.delete(entries.keys().next().value)
  }

  const start = (key, loader) => {
    const flight = { generation: ++started, at: now(), waiters: new Set() }
    flights.set(key, flight)
    const record = pending.get(key) || { latest: 0, count: 0 }
    pending.set(key, { latest: flight.generation, count: record.count + 1 })
    let request
    try {
      request = sdkResult(loader())
    } catch (error) {
      request = Promise.reject(error)
    }
    request.then(
      (value) => {
        store(key, flight, value)
        finish(key, flight)
        flight.waiters.forEach((waiter) => notify(waiter, 'onValue', value))
      },
      (error) => {
        finish(key, flight)
        flight.waiters.forEach((waiter) => notify(waiter, 'onError', error))
      },
    )
    return flight
  }

  const subscribe = (key, loader, { onValue, onError, force = false } = {}) => {
    const waiter = { active: true, onValue, onError }
    const entry = force ? undefined : fresh(key)
    if (entry) {
      Promise.resolve().then(() => notify(waiter, 'onValue', entry.value))
      return () => {
        waiter.active = false
      }
    }
    let flight = flights.get(key)
    if (force || !flight || now() - flight.at >= stall) flight = start(key, loader)
    flight.waiters.add(waiter)
    return () => {
      if (!waiter.active) return
      waiter.active = false
      flight.waiters.delete(waiter)
      // Ждать больше некому — запрос в полёте больше не держит ключ.
      if (flight.waiters.size === 0 && flights.get(key) === flight) flights.delete(key)
    }
  }

  return {
    /**
     * Свежий ответ из кэша, иначе `loader()`; к запросу в полёте моложе 30 с присоединяется.
     * Возвращает отписку: отписанный ожидающий не вызывается.
     *
     * @param {string} key
     * @param {() => Promise<any>} loader
     * @param {{ onValue?: (value: any) => void, onError?: (error: unknown) => void, force?: boolean }} [handlers]
     * @returns {() => void}
     */
    subscribe,

    /** То же промисом. `force` — мимо готового ответа и мимо запроса в полёте («Повторить»). */
    load(key, loader, { force = false } = {}) {
      return new Promise((resolve, reject) => {
        subscribe(key, loader, { onValue: resolve, onError: reject, force })
      })
    },

    /** Свежий ответ без запроса — чтобы показать его сразу, без состояния загрузки. */
    peek(key) {
      const entry = fresh(key)
      return entry ? entry.value : undefined
    },

    /** Всё забыть: записи, запросы в полёте; ответы начатых до этого запросов не сохранятся. */
    clear() {
      clearedAt = started
      entries.clear()
      flights.clear()
    },

    get size() {
      return entries.size
    },
  }
}

/** Общий кэш процесса для виджетов с данными. */
export const requestCache = createRequestCache()
