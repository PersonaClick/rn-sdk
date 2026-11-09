import axios from 'axios'
import { Platform } from 'react-native'
import { version } from '../../package.json'

/**
 * Сторис V2 на API v3 (`/api/v3/storefront/stories`, хост панели, например `app.personaClick.ru`).
 * Включается `apiV3Domain` виджета (или show / handleLink), по умолчанию — глобальным
 * `PersonalizationStories.apiV3Domain`; `null` — лента `stories/{code}` и трекинг `track/stories`
 * старого API, как раньше. Только в v3 лента отдаёт ссылки «Поделиться»,
 * есть кампания по ссылке (`/story/{id}`) и события `share` / `shared_open`.
 *
 * Запросам нужны `shop_id` и `did` (без `sid`); без `did` сервер отвечает 400, поэтому запрос ждёт
 * init SDK — в той же очереди команд, что и остальные запросы SDK.
 */

let domain = null

/** Хост API v3 сторис V2 или `null` — старое API. */
export function storiesApiV3Domain() {
  return domain
}

/** Хост без схемы (`app.personaClick.ru`): схема и `/` в конце отбрасываются, пусто — `null`. */
export function normalizeStoriesApiV3Domain(value) {
  const host = typeof value === 'string' ? value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '') : ''
  return host.length > 0 ? host : null
}

/** Глобальный хост — значение по умолчанию для виджетов, show() и handleLink. */
export function setStoriesApiV3Domain(value) {
  domain = normalizeStoriesApiV3Domain(value)
}

/**
 * Хост v3 экземпляра: своё значение виджета / show / handleLink, а не задано (`undefined`) —
 * глобальное. `null` или пусто — старое API, даже если глобальное задано.
 */
export function resolveStoriesApiV3Domain(own) {
  return own === undefined ? domain : normalizeStoriesApiV3Domain(own)
}

/** Запрос v3 не дольше, мс. */
const REQUEST_TIMEOUT = 15000

const base = (host, code) => `https://${host}/api/v3/storefront/stories/${encodeURIComponent(code)}`

/** Лента блока: `GET /api/v3/storefront/stories/{code}`. */
export const storiesV3FeedUrl = (host, code) => base(host, code)

/** Одна кампания по ссылке: `GET …/{code}/story/{storyId}`. */
export const storiesV3StoryUrl = (host, code, storyId) => `${base(host, code)}/story/${encodeURIComponent(String(storyId))}`

/** События: `POST …/{code}/events`. */
export const storiesV3EventsUrl = (host, code) => `${base(host, code)}/events`

/**
 * Ответ GET v3 → `payload` в формате ленты, его разбирает тот же код, что и старую ленту.
 * `status` не `success` или нет `payload` — ошибка. У товарных слайдов v3 шлёт `background` и
 * `preview` как `null` (в старой ленте `""`) — здесь они пустые строки.
 *
 * @returns {{ id?: number, settings?: object, stories: object[] }}
 */
export function unwrapStoriesV3(response) {
  const payload = response && response.status === 'success' ? response.payload : null
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Stories v3: unexpected response ${preview(response)}`)
  }
  const stories = Array.isArray(payload.stories) ? payload.stories.map(normalizeStory) : []
  return { ...payload, stories }
}

function normalizeStory(story) {
  if (!story || !Array.isArray(story.slides)) return story
  return {
    ...story,
    slides: story.slides.map((slide) =>
      slide && typeof slide === 'object' ? { ...slide, background: slide.background ?? '', preview: slide.preview ?? '' } : slide,
    ),
  }
}

const preview = (value) => {
  try {
    return String(JSON.stringify(value)).slice(0, 200)
  } catch (error) {
    return String(value)
  }
}

/**
 * Тело события v3. `story_id` — как в ленте, числом; `slide_id` — всегда строкой (у товарных
 * кампаний слайды виртуальные, `39_0`).
 */
export function storiesV3EventBody(shopId, did, event, storyId, slideId) {
  const story = typeof storyId === 'string' && /^\d+$/.test(storyId) ? Number(storyId) : storyId
  return { shop_id: shopId, did, event, story_id: story, slide_id: String(slideId) }
}

/**
 * `did` после init SDK: команда встаёт в очередь SDK и выполняется, когда init прошёл (или не
 * удался — тогда сохранённый did или пусто, и сервер ответит ошибкой).
 */
export function storiesDeviceId(sdk) {
  return new Promise((resolve, reject) => {
    const read = () =>
      Promise.resolve()
        .then(() => (typeof sdk.getDeviceId === 'function' ? sdk.getDeviceId() : sdk.deviceId))
        .then((did) => resolve(did || ''), reject)
    if (typeof sdk.push === 'function') sdk.push(read)
    else read()
  })
}

const userAgent = () => `ReactNative ${Platform.OS === 'android' ? 'Android' : 'iOS'} SDK v${version}`

// Без cookie, как и остальные запросы SDK: личность — в параметрах `shop_id` / `did`.
const request = (config) =>
  axios({
    ...config,
    withCredentials: false,
    timeout: REQUEST_TIMEOUT,
    headers: { 'User-Agent': userAgent(), ...(config.headers || {}) },
  })
const send = (config) => request(config).then((response) => response.data)

/**
 * POST JSON на хост v3 (события сторис, ответы опросов): `{ code, data }` с любым HTTP-кодом —
 * разбирает вызывающий. Нет сети или таймаут — ошибка.
 */
export function postStoriesV3(url, body) {
  return request({
    method: 'POST',
    url,
    headers: { 'Content-Type': 'application/json' },
    data: body,
    validateStatus: () => true,
  }).then((response) => ({ code: Number(response && response.status) || 0, data: response ? response.data : undefined }))
}

/**
 * GET на хост v3 (попапы v3): `{ code, data }` с любым HTTP-кодом — разбирает вызывающий. Нет
 * сети или таймаут — ошибка.
 */
export function getApiV3(url, params) {
  return request({ method: 'GET', url, params, validateStatus: () => true }).then((response) => ({
    code: Number(response && response.status) || 0,
    data: response ? response.data : undefined,
  }))
}

/** Лента блока из v3. */
export async function fetchStoriesFeedV3(sdk, code, host = domain) {
  const did = await storiesDeviceId(sdk)
  const data = await send({ method: 'GET', url: storiesV3FeedUrl(host, code), params: { shop_id: sdk.shop_id, did } })
  return unwrapStoriesV3(data)
}

/**
 * Кампания по ссылке «Поделиться» (`link` из `parseStoriesShareLink`): `start_position` в ответе
 * указывает на слайд ссылки. Нет кампании, она выключена или ею нельзя делиться — 404, ошибка.
 */
export async function fetchSharedStoryV3(sdk, link, host = domain) {
  const did = await storiesDeviceId(sdk)
  const params = { shop_id: sdk.shop_id, did }
  if (link.slideId) params.slide_id = link.slideId
  const data = await send({ method: 'GET', url: storiesV3StoryUrl(host, link.code, link.storyId), params })
  return unwrapStoriesV3(data)
}

/** Событие сторис в v3: `view`, `click`, `share` или `shared_open`. */
export async function trackStoriesV3(sdk, code, event, storyId, slideId, host = domain) {
  const did = await storiesDeviceId(sdk)
  await postStoriesV3(storiesV3EventsUrl(host, code), storiesV3EventBody(sdk.shop_id, did, event, storyId, slideId))
}
