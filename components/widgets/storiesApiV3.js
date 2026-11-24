import axios from 'axios'
import { Platform } from 'react-native'
import { version } from '../../package.json'
import { DEFAULT_STREAM } from '../../lib/native/bridge'

/**
 * Сторис V2 на API v3 (`/api/v3/storefront/stories`, хост панели, например `app.personaClick.ru`).
 * Включается `apiV3Domain` виджета (или show / handleLink), по умолчанию — глобальным
 * `PersonalizationStories.apiV3Domain`; `null` — лента `stories/{code}` и трекинг `track/stories`
 * старого API, как раньше. Только в v3 лента отдаёт ссылки «Поделиться»,
 * есть кампания по ссылке (`/story/{id}`) и события `share` / `shared_open`.
 *
 * Личность запросов — как у JS SDK (`storiesIdentity`): `shop_id`, `did`, `sid`, `segment`, `stream` и
 * `testmode`. Без `did` сервер отвечает 400, поэтому запрос ждёт init SDK — в той же очереди команд,
 * что и остальные запросы SDK.
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
 * Личность запроса v3, как у JS SDK: `shop_id`, `did`, `sid` — сеанс SDK (с нативным модулем — сеанс
 * нативного SDK; нет — `""`), `segment` — A/B-группа устройства (`A` / `B`, как у
 * `segments.getAbGroup()`; неизвестна — `""`), `stream` — поток магазина (не задан — `react-native`) и
 * `testmode: true` только в тестовом режиме — флаг попапов v3, тот же, что уходит с `/init`
 * (`PersonalizationPopups.of(sdk).testMode`). Ответы опросов идут без `segment` (как в JS SDK):
 * `{ segment: false }`.
 *
 * @param {object} sdk
 * @param {string} did
 * @param {{ segment?: boolean }} [options]
 * @returns {{ shop_id: string, did: string, sid: string, segment?: string, stream: string, testmode?: true }}
 */
export function storiesIdentity(sdk, did, { segment = true } = {}) {
  const text = (value) => (typeof value === 'string' ? value : '')
  const identity = { shop_id: sdk.shop_id, did: text(did), sid: text(sdk.userSeance) }
  if (segment) identity.segment = storiesAbGroup(sdk)
  identity.stream = text(sdk.stream) || DEFAULT_STREAM
  if (storiesTestMode(sdk)) identity.testmode = true
  return identity
}

/** A/B-группа устройства: `A` / `B` (с нативным модулем — группа нативного SDK), иначе `""`. */
export function storiesAbGroup(sdk) {
  let group = ''
  try {
    group = sdk.segments && typeof sdk.segments.getAbGroup === 'function' ? sdk.segments.getAbGroup() : sdk.segment
  } catch (error) {
    group = sdk.segment
  }
  return group === 'A' || group === 'B' ? group : ''
}

/** Тестовый режим попапов v3 (`testmode=true` с `/init`) — он же у сторис v3. */
export function storiesTestMode(sdk) {
  try {
    return !!(sdk._popupsV3 && sdk._popupsV3.testMode === true)
  } catch (error) {
    return false
  }
}

/**
 * Тело события v3: личность (`storiesIdentity`), `event`, `story_id` — числом, если он числовой (иначе
 * как есть), `slide_id` — всегда строкой (у товарных кампаний слайды виртуальные, `39_0`).
 */
export function storiesV3EventBody(identity, event, storyId, slideId) {
  const story = typeof storyId === 'string' && /^\d+$/.test(storyId) ? Number(storyId) : storyId
  return { ...identity, event, story_id: story, slide_id: String(slideId) }
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

/**
 * Ключ `did`, с которым ответ v3 загружен: ленте после загрузки он нужен ещё раз (сохранённые ответы
 * опросов), и второй раз в очередь SDK за ним не ходят. Символ — копируется вместе с ответом
 * (`{ ...response }`), но не мешает его полям.
 */
export const STORIES_V3_DEVICE_ID = Symbol('storiesV3DeviceId')

/** `did` ответа v3 (`STORIES_V3_DEVICE_ID`) или `null`, если ответ пришёл не из fetch-функций v3. */
export function storiesV3ResponseDeviceId(response) {
  const did = response ? response[STORIES_V3_DEVICE_ID] : undefined
  return typeof did === 'string' ? did : null
}

const withDeviceId = (response, did) => ({ ...response, [STORIES_V3_DEVICE_ID]: typeof did === 'string' ? did : '' })

/** Лента блока из v3; в ответе — `did`, с которым её загрузили (`storiesV3ResponseDeviceId`). */
export async function fetchStoriesFeedV3(sdk, code, host = domain) {
  const did = await storiesDeviceId(sdk)
  const data = await send({ method: 'GET', url: storiesV3FeedUrl(host, code), params: storiesIdentity(sdk, did) })
  return withDeviceId(unwrapStoriesV3(data), did)
}

/**
 * Кампания по ссылке «Поделиться» (`link` из `parseStoriesShareLink`): `start_position` в ответе
 * указывает на слайд ссылки. Нет кампании, она выключена или ею нельзя делиться — 404, ошибка.
 */
export async function fetchSharedStoryV3(sdk, link, host = domain) {
  const did = await storiesDeviceId(sdk)
  const params = storiesIdentity(sdk, did)
  if (link.slideId) params.slide_id = link.slideId
  const data = await send({ method: 'GET', url: storiesV3StoryUrl(host, link.code, link.storyId), params })
  return withDeviceId(unwrapStoriesV3(data), did)
}

/** Событие сторис в v3: `view`, `click`, `share` или `shared_open`. */
export async function trackStoriesV3(sdk, code, event, storyId, slideId, host = domain) {
  const did = await storiesDeviceId(sdk)
  await postStoriesV3(storiesV3EventsUrl(host, code), storiesV3EventBody(storiesIdentity(sdk, did), event, storyId, slideId))
}
