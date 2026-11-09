import axios from 'axios'
import {
  createStoriesPollsApi,
  storiesPollBody,
  storiesPollMiniPollUrl,
  storiesPollPayload,
  storiesPollReviewUrl,
} from '../components/widgets/storiesPollsApi'

// Клиент опросов API v3 (кейсы `polls.test.ts` JS SDK): тела запросов, ответы, ошибки и did.

jest.mock('axios', () => jest.fn())

const HOST = 'app.personaClick.ru'
const sdk = (extra = {}) => ({ shop_id: 'shop', userSeance: 'sid-1', getDeviceId: async () => 'did-1', ...extra })
const reply = (status, data) => ({ status, data })

beforeEach(() => {
  axios.mockReset()
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('Stories polls API — requests', () => {
  test('a mini-poll answer: JSON POST to the v3 host with the identity, cookie-less', async () => {
    axios.mockResolvedValue(reply(200, { status: 'success', payload: { answer: { id: 7, option_ids: [2], text: null }, results: null } }))
    const api = createStoriesPollsApi(sdk(), HOST)
    const result = await api.answerMiniPoll('gift recipient', { option_ids: [2], story_id: 5, slide_id: '101' })
    expect(result).toEqual({ answer: { id: 7, option_ids: [2], text: null }, results: null })
    const config = axios.mock.calls[0][0]
    expect(config).toMatchObject({
      method: 'POST',
      url: 'https://app.personaClick.ru/api/v3/polls/mini_polls/gift%20recipient/answers',
      headers: { 'Content-Type': 'application/json' },
      withCredentials: false,
      data: { shop_id: 'shop', did: 'did-1', sid: 'sid-1', option_ids: [2], story_id: 5, slide_id: '101' },
    })
    expect(config.validateStatus(500)).toBe(true)
  })

  test('scales: NPS with category, CSAT / CES with campaign; the payload is not the answer', async () => {
    axios.mockResolvedValue(reply(200, { status: 'success', payload: { review: { id: 1 } } }))
    const api = createStoriesPollsApi(sdk(), HOST)
    await expect(api.review('nps', { channel: 'stories', category: 'delivery', rate: 9 })).resolves.toEqual({ answer: null, results: null })
    await api.review('csat', { channel: 'stories', campaign: 'support', rate: 4 })
    await api.review('ces', { channel: 'test', campaign: 'checkout', rate: 7 })
    expect(axios.mock.calls.map((call) => call[0].url)).toEqual([
      'https://app.personaClick.ru/api/v3/polls/nps/reviews',
      'https://app.personaClick.ru/api/v3/polls/csat/reviews',
      'https://app.personaClick.ru/api/v3/polls/ces/reviews',
    ])
    expect(axios.mock.calls[0][0].data).toEqual({ shop_id: 'shop', did: 'did-1', sid: 'sid-1', channel: 'stories', category: 'delivery', rate: 9 })
    expect(axios.mock.calls[1][0].data).toMatchObject({ campaign: 'support', rate: 4 })
    await expect(api.review('smile', { rate: 1 })).rejects.toMatchObject({ code: -1 })
    expect(axios).toHaveBeenCalledTimes(3)
  })

  test('sid is always sent, empty without a seance; nulls are dropped; a 200 without answer is empty', async () => {
    axios.mockResolvedValue(reply(200, { status: 'success' }))
    const api = createStoriesPollsApi(sdk({ userSeance: '' }), HOST)
    await expect(api.answerMiniPoll('c', { text: 'Книга', story_id: 5, slide_id: '39_0' })).resolves.toEqual({ answer: null, results: null })
    expect(axios.mock.calls[0][0].data).toEqual({ shop_id: 'shop', did: 'did-1', sid: '', text: 'Книга', story_id: 5, slide_id: '39_0' })
    await createStoriesPollsApi(sdk({ userSeance: undefined }), HOST).review('ces', { channel: 'stories', campaign: 'c', rate: 2 })
    expect(axios.mock.calls[1][0].data).toEqual({ shop_id: 'shop', did: 'did-1', sid: '', channel: 'stories', campaign: 'c', rate: 2 })
    expect(storiesPollBody({ shopId: 's', did: 'd', sid: '' }, { a: null, b: undefined, c: 0 })).toEqual({ shop_id: 's', did: 'd', sid: '', c: 0 })
    expect(storiesPollBody({ shopId: 's', did: 'd' }, {})).toEqual({ shop_id: 's', did: 'd', sid: '' })
  })

  test('waits for init like the v3 feed; no did — an error and nothing is sent', async () => {
    const queue = []
    axios.mockResolvedValue(reply(200, { status: 'success', payload: {} }))
    const waiting = sdk({ push: (command) => queue.push(command) })
    const answer = createStoriesPollsApi(waiting, HOST).answerMiniPoll('c', { option_ids: [1], story_id: 1, slide_id: '1' })
    await Promise.resolve()
    expect(axios).not.toHaveBeenCalled()
    queue.forEach((command) => command())
    await expect(answer).resolves.toEqual({ answer: null, results: null })

    axios.mockReset()
    const noDid = createStoriesPollsApi(sdk({ getDeviceId: async () => '' }), HOST)
    await expect(noDid.review('nps', { channel: 'stories', category: 'x', rate: 1 })).rejects.toMatchObject({ code: -1 })
    expect(axios).not.toHaveBeenCalled()
  })

  test('urls', () => {
    expect(storiesPollMiniPollUrl('h', 'a/b')).toBe('https://h/api/v3/polls/mini_polls/a%2Fb/answers')
    // Опрос без `code` тоже отправляется — ответит сервер (как в JS SDK).
    expect(storiesPollMiniPollUrl('h', '')).toBe('https://h/api/v3/polls/mini_polls//answers')
    expect(storiesPollReviewUrl('h', 'ces')).toBe('https://h/api/v3/polls/ces/reviews')
  })
})

describe('Stories polls API — errors', () => {
  test.each([400, 402, 403, 404, 429, 500])('HTTP %i is an error with its code and message', async (code) => {
    axios.mockResolvedValue(reply(code, { status: 'fail', message: `message ${code}` }))
    const api = createStoriesPollsApi(sdk(), HOST)
    await expect(api.answerMiniPoll('mntest', { option_ids: [1], story_id: 37, slide_id: '76' })).rejects.toMatchObject({
      code,
      message: `message ${code}`,
    })
    expect(console.log).toHaveBeenCalledWith(`[Stories polls] mini_poll mntest failed: ${code} message ${code}`)
  })

  test('a 3xx reply is an error too', async () => {
    axios.mockResolvedValue(reply(304, ''))
    const api = createStoriesPollsApi(sdk(), HOST)
    await expect(api.review('csat', { channel: 'stories', campaign: 'x', rate: 5 })).rejects.toMatchObject({ code: 304, message: 'HTTP 304' })
    expect(console.log).toHaveBeenCalledWith('[Stories polls] csat review failed: 304 HTTP 304')
  })

  test('an HTML error page, no network, invalid JSON, fail or error with 200', async () => {
    const api = createStoriesPollsApi(sdk(), HOST)
    const send = () => api.review('nps', { channel: 'stories', category: 'x', rate: 1 })
    axios.mockResolvedValueOnce(reply(502, '<html>Bad gateway</html>'))
    await expect(send()).rejects.toMatchObject({ code: 502, message: 'HTTP 502' })
    axios.mockRejectedValueOnce(new Error('Network Error'))
    await expect(send()).rejects.toMatchObject({ code: -1, message: 'Network Error' })
    axios.mockResolvedValueOnce(reply(200, '{"status": "succ'))
    await expect(send()).rejects.toMatchObject({ code: 200, message: 'invalid JSON' })
    axios.mockResolvedValueOnce(reply(200, { status: 'fail', message: 'Campaign not found' }))
    await expect(send()).rejects.toMatchObject({ message: 'Campaign not found' })
    axios.mockResolvedValueOnce(reply(200, { status: 'error' }))
    await expect(send()).rejects.toMatchObject({ message: 'error' })
    axios.mockResolvedValueOnce(reply(200, '{"status":"success","payload":{"review":{"id":3}}}'))
    await expect(send()).resolves.toEqual({ answer: null, results: null })
  })

  test('payload of a reply', () => {
    expect(storiesPollPayload({ code: 200, data: { status: 'success', payload: { answer: { text: 'a' } } } })).toEqual({ answer: { text: 'a' } })
    expect(storiesPollPayload({ code: 200, data: { status: 'success', payload: null } })).toEqual({})
    expect(() => storiesPollPayload({ code: 200, data: [1] })).toThrow('invalid JSON')
    expect(() => storiesPollPayload(null)).toThrow('HTTP 0')
  })

  test('success is HTTP 2xx only', () => {
    const ok = { status: 'success', payload: { answer: { text: 'a' } } }
    expect(storiesPollPayload({ code: 201, data: ok })).toEqual({ answer: { text: 'a' } })
    expect(storiesPollPayload({ code: 299, data: ok })).toEqual({ answer: { text: 'a' } })
    ;[0, 101, 199, 301, 304, 399].forEach((code) => {
      expect(() => storiesPollPayload({ code, data: ok })).toThrow(`HTTP ${code}`)
    })
    expect(() => storiesPollPayload({ code: 302, data: { status: 'fail', message: 'Moved' } })).toThrow('Moved')
  })
})
