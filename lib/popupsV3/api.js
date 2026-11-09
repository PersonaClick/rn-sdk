import { getApiV3, postStoriesV3 } from '../../components/widgets/storiesApiV3'
import { request } from '../client'
import { popupNum } from './values'

/**
 * Запросы попапов v3. Список, один попап и события — на хост ЛК (`https://{appHost}/api/v3/…`, JSON,
 * без cookie, общий транспорт API v3 сторис); промокод — на API-хост SDK (`promo_codes/fetch`, через
 * общий `request()`, он сам добавляет did и сеанс).
 *
 * - список: 4xx — пустой список на 300 с (как JS SDK), нет сети или 5xx — не кешируется;
 * - события «выстрелил и забыл»: один повтор при сети или 5xx, 4xx не повторяются, 429 — пауза
 *   отправки на 60 с; своего дедупа нет (5 секунд держит сервер).
 */

/** TTL списка по умолчанию и после ошибки клиента, с. */
export const POPUPS_V3_DEFAULT_TTL = 300
/** Пауза событий после 429, мс. */
export const POPUPS_V3_EVENTS_PAUSE = 60 * 1000
/** Промокод: таймаут запроса и срок кеша, мс. */
export const POPUPS_V3_PROMO_TIMEOUT = 10 * 1000
export const POPUPS_V3_PROMO_TTL = 2 * 60 * 60 * 1000

export const popupsV3ListUrl = (host) => `https://${host}/api/v3/storefront/popups`
export const popupsV3OneUrl = (host, id) => `https://${host}/api/v3/storefront/popups/${encodeURIComponent(String(id))}`
export const popupsV3EventsUrl = (host, id) => `${popupsV3OneUrl(host, id)}/events`

const defaultHttp = { get: getApiV3, post: postStoriesV3 }

const preview = (value) => {
  try {
    return String(JSON.stringify(value)).slice(0, 200)
  } catch (error) {
    return String(value)
  }
}

/**
 * @param {{ host: () => string|null, identity: () => Promise<{ shopId: string, did: string, sid: string }>,
 *           testMode: () => boolean, debug: () => boolean, log: (message: string) => void,
 *           http?: { get: Function, post: Function }, now?: () => number,
 *           wait?: (ms: number) => Promise<void> }} options
 */
export function createPopupsV3Api({ host, identity, testMode, debug, log, http = defaultHttp, now = () => Date.now() }) {
  let eventsPausedUntil = 0

  const base = async (extra) => {
    const { shopId, did, sid } = await identity()
    const params = { shop_id: shopId, did, sid, ...extra }
    if (testMode()) params.testmode = 'true'
    return params
  }

  return {
    /**
     * Список попапов магазина для устройства.
     * @returns {Promise<{ ok: true, ttl: number, popups: object[], excluded: object[] } |
     *                   { ok: false, cacheable: boolean }>}
     */
    async list() {
      const appHost = host()
      const params = await base({ channel: 'mobile' })
      if (debug()) params.debug = '1'
      let reply
      try {
        reply = await http.get(popupsV3ListUrl(appHost), params)
      } catch (error) {
        log(`list request failed: ${(error && error.message) || error}`)
        return { ok: false, cacheable: false }
      }
      const data = reply.data
      if (reply.code >= 200 && reply.code < 300 && data && data.status === 'success' && data.payload) {
        const payload = data.payload
        const ttl = popupNum(payload.ttl, 0)
        return {
          ok: true,
          ttl: ttl > 0 ? ttl : POPUPS_V3_DEFAULT_TTL,
          popups: Array.isArray(payload.popups) ? payload.popups : [],
          excluded: Array.isArray(payload.excluded) ? payload.excluded : [],
        }
      }
      log(`list request failed: HTTP ${reply.code} ${preview(data)}`)
      // Ответ клиента (и неожиданный 2xx) — пустой список на TTL по умолчанию; 5xx — повтор при следующем поводе.
      return { ok: false, cacheable: reply.code >= 200 && reply.code < 500 }
    },

    /** Один попап для ручного показа; нет — `null`. */
    async one(id) {
      const appHost = host()
      const params = await base({})
      try {
        const reply = await http.get(popupsV3OneUrl(appHost, id), params)
        const data = reply.data
        if (reply.code >= 200 && reply.code < 300 && data && data.status === 'success' && data.payload && data.payload.popup) {
          return data.payload.popup
        }
        log(`popup ${id} request failed: HTTP ${reply.code} ${preview(data)}`)
      } catch (error) {
        log(`popup ${id} request failed: ${(error && error.message) || error}`)
      }
      return null
    },

    /** Событие попапа: `show`, `close`, `click`, `submit`, `subscribe` (с `channel`). */
    async event(id, event, channel) {
      if (now() < eventsPausedUntil) {
        log(`event ${event} of popup ${id} dropped: paused after 429`)
        return false
      }
      const { shopId, did, sid } = await identity()
      const body = { shop_id: shopId, did, sid, event }
      if (channel) body.channel = channel
      const url = popupsV3EventsUrl(host(), id)
      for (let attempt = 0; attempt < 2; attempt += 1) {
        let reply
        try {
          reply = await http.post(url, body)
        } catch (error) {
          reply = { code: 0, data: (error && error.message) || String(error) }
        }
        if (reply.code >= 200 && reply.code < 300) {
          log(`event ${event}${channel ? ` (${channel})` : ''} of popup ${id} sent`)
          return true
        }
        if (reply.code === 429) {
          eventsPausedUntil = now() + POPUPS_V3_EVENTS_PAUSE
          log(`event ${event} of popup ${id}: 429, events paused for 60 s`)
          return false
        }
        if (reply.code >= 400 && reply.code < 500) {
          log(`event ${event} of popup ${id} failed: HTTP ${reply.code} ${preview(reply.data)}`)
          return false
        }
        log(`event ${event} of popup ${id} failed: ${reply.code ? `HTTP ${reply.code}` : 'network'}${attempt === 0 ? ', retry' : ''}`)
      }
      return false
    },
  }
}

const isFailure = (response) =>
  !response ||
  response instanceof Error ||
  response.status === 'error' ||
  response.status === 'fail' ||
  (typeof response.status === 'number' && response.status >= 400)

/**
 * Персональный промокод из списка `listId` (`GET promo_codes/fetch`): код или `null` (нет кода,
 * ошибка, 10 с без ответа).
 */
export function fetchPopupPromoCode(shopId, listId, timeout = POPUPS_V3_PROMO_TIMEOUT) {
  return new Promise((resolve) => {
    let done = false
    const finish = (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(code)
    }
    const timer = setTimeout(() => finish(null), timeout)
    request('promo_codes/fetch', shopId, {
      method: 'GET',
      timeout,
      params: { shop_id: shopId, id: listId },
    })
      .then((response) => {
        const code = !isFailure(response) && response && typeof response.code === 'string' ? response.code.trim() : ''
        finish(code || null)
      })
      .catch(() => finish(null))
  })
}

/**
 * Запрос API SDK от имени попапа (запись профиля, подписка, сегмент): `true` — успех. Ошибка сети,
 * HTTP-ошибка или `status` `error` / `fail` — `false`.
 */
export async function popupSdkPost(shopId, stream, path, params) {
  try {
    const response = await request(path, shopId, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      params: { shop_id: shopId, stream, ...params },
    })
    return !isFailure(response)
  } catch (error) {
    return false
  }
}
