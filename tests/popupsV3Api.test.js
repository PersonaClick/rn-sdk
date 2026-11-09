import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import requests from './fixtures/popups-v3/requests.json'
import errors from './fixtures/popups-v3/error-responses.json'
import formFixture from './fixtures/popups-v3/element-form.json'
import surveyFixture from './fixtures/popups-v3/element-survey.json'
import { createPopupsV3Api, fetchPopupPromoCode } from '../lib/popupsV3/api'
import {
  createPopupActions,
  isPopupEmail,
  popupBirthday,
  popupBirthdayMask,
  popupEmailProblem,
  popupProfileParams,
  popupSubscribeParams,
  popupSurveyReview,
  popupValidateForm,
} from '../lib/popupsV3/actions'
import { normalizePopupDesign } from '../lib/popupsV3/design'
import { popupTexts } from '../lib/popupsV3/texts'
import { getStorageKey } from '../utils'

// Попапы v3: запросы (requests.json) и ответы ошибок (error-responses.json), действия форм и опроса.
// Сеть — подменный axios, личность — данные магазина в AsyncStorage, как у SDK.

jest.mock('axios', () => jest.fn())

const context = requests._fixture.context
const SHOP = context.shop_id

/** URL с параметрами запроса в одну строку, параметры по алфавиту. */
const fullUrl = (url, params) => {
  const query = Object.keys(params || {})
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')
  return query ? `${url}?${query}` : url
}
const sortedUrl = (url) => {
  const [path, query] = url.split('?')
  return fullUrl(
    path,
    Object.fromEntries((query || '').split('&').filter(Boolean).map((pair) => pair.split('=').map(decodeURIComponent))),
  )
}

function fakeApi({ test = false, debug = false, replies = [] } = {}) {
  const calls = []
  let time = 0
  const queue = replies.slice()
  const reply = () => (queue.length ? queue.shift() : { code: 200, data: { status: 'success', payload: { ttl: 300, popups: [], excluded: [] } } })
  const http = {
    get: jest.fn(async (url, params) => {
      calls.push({ method: 'GET', url: fullUrl(url, params) })
      const next = reply()
      if (next instanceof Error) throw next
      return next
    }),
    post: jest.fn(async (url, body) => {
      calls.push({ method: 'POST', url, json: body })
      const next = reply()
      if (next instanceof Error) throw next
      return next
    }),
  }
  const api = createPopupsV3Api({
    host: () => context.app_host,
    identity: async () => ({ shopId: SHOP, did: context.did, sid: context.sid }),
    testMode: () => test,
    debug: () => debug,
    log: () => {},
    http,
    now: () => time,
  })
  return { api, calls, http, advance: (ms) => (time += ms) }
}

beforeEach(async () => {
  axios.mockReset()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  await AsyncStorage.setItem(
    getStorageKey('', SHOP),
    JSON.stringify({ did: context.did, seance: context.sid, sid: context.sid, expires: Date.now() + 60 * 60 * 1000 }),
  )
})
afterEach(() => jest.restoreAllMocks())

describe('Popups v3 API — requests.json', () => {
  test('list, list with testmode and debug', async () => {
    const plain = fakeApi()
    await plain.api.list()
    expect(plain.calls[0]).toEqual({ method: 'GET', url: sortedUrl(requests.list.url) })
    const test = fakeApi({ test: true, debug: true })
    await test.api.list()
    expect(test.calls[0].url).toBe(sortedUrl(requests.list_testmode_debug.url))
  })

  test('one popup, with testmode', async () => {
    const plain = fakeApi({ replies: [{ code: 200, data: { status: 'success', payload: { popup: { id: 516 } } } }] })
    await expect(plain.api.one(516)).resolves.toEqual({ id: 516 })
    expect(plain.calls[0].url).toBe(sortedUrl(requests.one.url))
    const test = fakeApi({ test: true })
    await test.api.one(516)
    expect(test.calls[0].url).toBe(sortedUrl(requests.one_testmode.url))
  })

  test('events: show without channel, subscribe with email', async () => {
    const { api, calls } = fakeApi({ replies: [{ code: 200, data: errors.events_ok }, { code: 200, data: errors.events_ok }] })
    await api.event(512, 'show')
    await api.event(512, 'subscribe', 'email')
    expect(calls).toEqual([
      { method: 'POST', url: requests.event_show.url, json: requests.event_show.json },
      { method: 'POST', url: requests.event_subscribe.url, json: requests.event_subscribe.json },
    ])
  })

  test('promo code: GET promo_codes/fetch on the API host with did and sid', async () => {
    axios.mockResolvedValue({ status: 200, data: errors.promo_ok })
    await expect(fetchPopupPromoCode(SHOP, 7)).resolves.toBe('ABC123')
    const config = axios.mock.calls[0][0]
    expect(config.url).toBe('https://api.personaclick.com/promo_codes/fetch')
    expect(config.method).toBe('GET')
    expect(config.params).toMatchObject({ shop_id: SHOP, did: context.did, sid: context.sid, id: '7' })
  })

  test('promo code: 404 and no answer in 10 s — no code', async () => {
    axios.mockRejectedValue(Object.assign(new Error('Request failed with status code 404'), { response: { status: 404, data: errors.promo_404 } }))
    await expect(fetchPopupPromoCode(SHOP, 7)).resolves.toBeNull()
    jest.useFakeTimers()
    axios.mockImplementation(() => new Promise(() => {}))
    const pending = fetchPopupPromoCode(SHOP, 7)
    await jest.advanceTimersByTimeAsync(10000)
    await expect(pending).resolves.toBeNull()
    jest.useRealTimers()
  })

  test('reviews: NPS with category and comment, CSAT with campaign and no comment', async () => {
    axios.mockResolvedValue({ status: 200, data: errors.review_ok })
    const sdk = { shop_id: SHOP, stream: 'android', userSeance: context.sid, getDeviceId: async () => context.did }
    const actions = createPopupActions(sdk, () => context.app_host)
    const surveys = normalizePopupDesign(surveyFixture.design, { texts: popupTexts('ru') }).rows.map((row) => row.cells[0].elements[0].props)
    await actions.submitSurvey(surveys[0], 0, '  Долгая доставка ')
    await actions.submitSurvey(surveys[1], 5, '   ')
    expect(axios.mock.calls[0][0]).toMatchObject({ method: 'POST', url: requests.review_nps.url, data: requests.review_nps.json })
    expect(axios.mock.calls[1][0]).toMatchObject({ method: 'POST', url: requests.review_csat_no_comment.url, data: requests.review_csat_no_comment.json })
    expect(popupSurveyReview(surveys[2], 7, '')).toEqual({ kind: 'ces', body: { channel: 'popup', campaign: 'MN TEST', rate: 7 } })
  })

  test('a review the shop has no channel for fails with the server message', async () => {
    axios.mockResolvedValue({ status: 404, data: errors.review_404_channel })
    const sdk = { shop_id: SHOP, stream: 'android', userSeance: context.sid, getDeviceId: async () => context.did }
    const actions = createPopupActions(sdk, () => context.app_host)
    await expect(actions.submitSurvey({ type: 'nps', campaignCode: '' }, 9, '')).rejects.toMatchObject({ message: 'Channel not found', code: 404 })
    expect(axios.mock.calls[0][0].data).toEqual({ shop_id: SHOP, did: context.did, sid: context.sid, channel: 'popup', rate: 9 })
  })

  test('subscription: subscriptions/manage with the flags, then segments/add by did', async () => {
    axios.mockResolvedValue({ status: 200, data: { status: 'success' } })
    const actions = createPopupActions({ shop_id: SHOP, stream: 'android' }, () => context.app_host)
    await actions.subscribeEmail({ email: ' demo+rn@personaClick.test ', consentFields: ['email_bulk', 'email_chain'], segmentId: '123' })
    const [manage, segment] = axios.mock.calls.map((call) => call[0])
    expect(manage.url).toBe('https://api.personaclick.com/subscriptions/manage')
    expect(manage.data).toMatchObject({ shop_id: SHOP, did: context.did, email: 'demo+rn@personaClick.test', email_bulk: true, email_chain: true })
    expect(manage.data.email_transactional).toBeUndefined()
    expect(segment.url).toBe(requests.segment_add.url)
    expect(segment.data).toMatchObject(requests.segment_add.json_subset)
  })

  test('form: profile/set with standard and custom fields, consent flags, segment', async () => {
    axios.mockResolvedValue({ status: 200, data: { status: 'success' } })
    const form = normalizePopupDesign(formFixture.design, { texts: popupTexts('ru') }).rows[0].cells[0].elements[0].props
    const example = formFixture._fixture.expect['el-form'].submit.profile_set_example
    const values = {
      'f-email': example.email,
      'f-phone': example.phone,
      ffirst: example.first_name,
      'field-3': example.last_name,
      'f-bday': '12.04.1990',
      'f-gender': example.gender,
      'f-color': example.fav_color,
      'f-level': example.loyaltylevel,
    }
    const actions = createPopupActions({ shop_id: SHOP, stream: 'android' }, () => context.app_host)
    await actions.submitForm({ fields: form.fields, values, consent: true, consentFields: form.consentFields, segmentId: form.segmentId })
    const [profile, manage, segment] = axios.mock.calls.map((call) => call[0])
    expect(profile.url).toBe('https://api.personaclick.com/profile/set')
    expect(profile.data).toMatchObject({ shop_id: SHOP, did: context.did, ...example })
    expect(manage.data).toMatchObject({ email: example.email, phone: example.phone, email_bulk: true })
    expect(segment.data).toMatchObject({ segment_id: 456 })
  })

  test('a failed subscription is an error, the segment is not added', async () => {
    axios.mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))
    const actions = createPopupActions({ shop_id: SHOP, stream: 'android' }, () => context.app_host)
    await expect(actions.subscribeEmail({ email: 'a@b.cd', consentFields: ['email_bulk'], segmentId: '1' })).rejects.toThrow('subscription failed')
    expect(axios).toHaveBeenCalledTimes(1)
  })
})

describe('Popups v3 API — error-responses.json', () => {
  test.each([
    ['list_400', 400],
    ['list_402', 402],
    ['list_403', 403],
    ['list_404', 404],
  ])('%s: an empty list to cache', async (key, code) => {
    const { api } = fakeApi({ replies: [{ code, data: errors[key] }] })
    await expect(api.list()).resolves.toEqual({ ok: false, cacheable: true })
  })

  test('5xx and no network are not cached; ttl as a string', async () => {
    const { api } = fakeApi({
      replies: [
        { code: 502, data: 'Bad gateway' },
        new Error('Network Error'),
        { code: 200, data: { status: 'success', payload: { ttl: '120', popups: null, excluded: [{ id: 1, reason: 'segments' }] } } },
      ],
    })
    await expect(api.list()).resolves.toEqual({ ok: false, cacheable: false })
    await expect(api.list()).resolves.toEqual({ ok: false, cacheable: false })
    await expect(api.list()).resolves.toEqual({ ok: true, ttl: 120, popups: [], excluded: [{ id: 1, reason: 'segments' }] })
  })

  test('one popup: 404 — null', async () => {
    const { api } = fakeApi({ replies: [{ code: 404, data: errors.one_404 }] })
    await expect(api.one(999)).resolves.toBeNull()
  })

  test('events: one retry after 5xx or no network, none after 4xx, 429 pauses events for 60 s', async () => {
    const retried = fakeApi({ replies: [{ code: 503, data: '' }, { code: 200, data: errors.events_ok }] })
    await expect(retried.api.event(1, 'click')).resolves.toBe(true)
    expect(retried.calls).toHaveLength(2)

    const network = fakeApi({ replies: [new Error('Network Error'), new Error('Network Error')] })
    await expect(network.api.event(1, 'click')).resolves.toBe(false)
    expect(network.calls).toHaveLength(2)

    const client = fakeApi({ replies: [{ code: 400, data: errors.events_400_channel }] })
    await expect(client.api.event(1, 'subscribe', 'mobile')).resolves.toBe(false)
    expect(client.calls).toHaveLength(1)

    const limited = fakeApi({ replies: [{ code: 429, data: errors.events_429 }] })
    await expect(limited.api.event(1, 'show')).resolves.toBe(false)
    await expect(limited.api.event(1, 'close')).resolves.toBe(false)
    expect(limited.calls).toHaveLength(1)
    limited.advance(60 * 1000)
    await expect(limited.api.event(1, 'close')).resolves.toBe(true)
    expect(limited.calls).toHaveLength(2)
  })
})

describe('Popups v3 — form checks', () => {
  const form = normalizePopupDesign(formFixture.design, { texts: popupTexts('ru') }).rows[0].cells[0].elements[0].props

  test('email collector: consent first, then the email format', () => {
    expect(popupEmailProblem('a@b.cd', false)).toBe('consent')
    expect(popupEmailProblem('not-an-email', true)).toBe('email')
    expect(popupEmailProblem(' demo+rn@personaClick.test ', true)).toBeNull()
    expect(popupSubscribeParams(' a@b.cd ', ['email_bulk'])).toEqual({ email: 'a@b.cd', email_bulk: true })
    expect(isPopupEmail('a@b')).toBe(false)
  })

  test('form: required fields, email, phone and date formats; empty optional fields are not sent', () => {
    expect(popupValidateForm(form.fields, {})).toEqual({ ok: false, problems: { 'f-email': 'required' } })
    expect(popupValidateForm(form.fields, { 'f-email': 'x', 'f-phone': '12', 'f-bday': '31.02.1990' }).problems).toEqual({
      'f-email': 'email',
      'f-phone': 'phone',
      'f-bday': 'date',
    })
    expect(popupValidateForm(form.fields, { 'f-email': 'a@b.cd' }).ok).toBe(true)
    expect(popupProfileParams(form.fields, { 'f-email': 'a@b.cd', ffirst: '  ', 'f-phone': '+7 (999) 000-00-00' })).toEqual({
      email: 'a@b.cd',
      phone: '+79990000000',
    })
  })

  test('birthday: DD.MM.YYYY or YYYY-MM-DD → YYYY-MM-DD; the input mask', () => {
    expect(popupBirthday('12.04.1990')).toBe('1990-04-12')
    expect(popupBirthday('1990-4-2')).toBe('1990-04-02')
    expect(popupBirthday('30.02.1990')).toBeNull()
    expect(popupBirthday('01.01.2999')).toBeNull()
    expect(popupBirthdayMask('12041990')).toBe('12.04.1990')
    expect(popupBirthdayMask('1204')).toBe('12.04')
  })
})
