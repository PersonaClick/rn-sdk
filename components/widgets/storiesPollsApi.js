import { isStoryPollScale, storyPollDebug } from '../design-system/storyPollSupport'
import { postStoriesV3, storiesDeviceId } from './storiesApiV3'

/**
 * Клиент опросов API v3 для сторис V2 — транспорт опросов по умолчанию: `answerMiniPoll(code,
 * body)` и `review(kind, body)`. Хост — `apiV3Domain`, с которого пришла лента; запрос — общий
 * POST storiesApiV3 (JSON, без cookie, таймаут 15 с).
 *
 * Личность: `shop_id`; `did` — после init SDK, как у ленты v3 (не дождались — ошибка, запрос не
 * уходит); `sid` — сеанс SDK, уходит всегда, как в JS SDK (нет сеанса — пустая строка).
 *
 * Успех — `{ answer, results }` из `payload` (у оценки шкалы оба `null`: карточка знает свою
 * оценку). Ошибка — `Error` с `code` (HTTP-код; `-1` — нет сети, таймаут, нет did) и `message`:
 * HTTP не 2xx (редиректы клиент проходит сам), невалидный JSON или `status` `fail` / `error`. Код и
 * текст — в debug-лог (свой транспорт хоста логирует сам, карточка не логирует).
 */

/** Ответ на мини-опрос: `POST /api/v3/polls/mini_polls/{code}/answers`. */
export const storiesPollMiniPollUrl = (host, code) => `https://${host}/api/v3/polls/mini_polls/${encodeURIComponent(code)}/answers`

/** Оценка шкалы: `POST /api/v3/polls/{nps|csat|ces}/reviews`. */
export const storiesPollReviewUrl = (host, kind) => `https://${host}/api/v3/polls/${kind}/reviews`

/** Сколько ждать did, мс (как загрузка блока). */
const DID_TIMEOUT = 15000

const pollError = (message, code) => Object.assign(new Error(message), { code })

/** Тело запроса: `shop_id`, `did`, `sid` (нет сеанса — `""`) и параметры без `null` / `undefined`. */
export function storiesPollBody({ shopId, did, sid }, params) {
  const body = { shop_id: shopId, did, sid: typeof sid === 'string' ? sid : '' }
  Object.keys(params || {}).forEach((key) => {
    const value = params[key]
    if (value !== undefined && value !== null) body[key] = value
  })
  return body
}

const parse = (data) => {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data)
  } catch (error) {
    return undefined
  }
}

/** Ответ POST (`{ code, data }`) → `payload` (без него — `{}`) или ошибка: успех — только HTTP 2xx. */
export function storiesPollPayload(reply) {
  const code = reply ? Number(reply.code) || 0 : 0
  const data = parse(reply ? reply.data : undefined)
  const json = data && typeof data === 'object' && !Array.isArray(data) ? data : null
  if (code < 200 || code >= 300) throw pollError((json && json.message) || `HTTP ${code}`, code)
  if (!json) throw pollError('invalid JSON', code)
  if (json.status === 'fail' || json.status === 'error') throw pollError(json.message || json.status, code)
  return json.payload && typeof json.payload === 'object' ? json.payload : {}
}

function deviceId(sdk) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(pollError('no did: SDK is not initialized', -1)), DID_TIMEOUT)
    storiesDeviceId(sdk).then(
      (did) => {
        clearTimeout(timer)
        if (did) resolve(did)
        else reject(pollError('no did', -1))
      },
      (error) => {
        clearTimeout(timer)
        reject(pollError((error && error.message) || 'no did', -1))
      },
    )
  })
}

/**
 * Транспорт опросов для просмотра: запросы на `https://{host}/api/v3/polls/…` от имени `sdk`.
 * @returns {{ answerMiniPoll(code: string, body: object): Promise<{answer, results}>,
 *             review(kind: string, body: object): Promise<{answer, results}> }}
 */
export function createStoriesPollsApi(sdk, host) {
  const post = async (url, params, what) => {
    try {
      const did = await deviceId(sdk)
      const sid = typeof sdk.userSeance === 'string' ? sdk.userSeance : ''
      const body = storiesPollBody({ shopId: sdk.shop_id, did, sid }, params)
      let reply
      try {
        reply = await postStoriesV3(url, body)
      } catch (error) {
        throw pollError((error && error.message) || 'network error', -1)
      }
      return storiesPollPayload(reply)
    } catch (error) {
      storyPollDebug(`${what} failed: ${error && error.code !== undefined ? error.code : -1} ${error && error.message}`)
      throw error
    }
  }
  return {
    answerMiniPoll: (code, body) =>
      post(storiesPollMiniPollUrl(host, code), body, `mini_poll ${code}`).then((payload) => ({
        answer: payload.answer ?? null,
        results: payload.results ?? null,
      })),
    review: (kind, body) => {
      if (!isStoryPollScale(kind)) return Promise.reject(pollError(`unknown scale ${kind}`, -1))
      return post(storiesPollReviewUrl(host, kind), body, `${kind} review`).then(() => ({ answer: null, results: null }))
    },
  }
}
