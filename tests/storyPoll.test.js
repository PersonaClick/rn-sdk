import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  STORY_POLL_ANSWER_TTL_MS,
  STORY_POLL_COMMENT_LIMIT,
  STORY_POLL_DEFAULT_TEXTS,
  createStoryPollController,
  hasStoryPollAnswer,
  loadStoryPollAnswers,
  parseStoryPoll,
  parseStoryPollAnswer,
  resetStoryPollAnswers,
  slidePolls,
  storyPollAnswerBody,
  storyPollBandQuestion,
  storyPollBandText,
  storyPollCutText,
  storyPollFittedTop,
  storyPollLowerEdge,
  storyPollOptionLetter,
  storyPollReviewBody,
  storyPollSavedAnswer,
  storyPollScaleRange,
  storyPollScaleTone,
  storyPollSource,
  storyPollStorageKey,
  storyPollStorageKeys,
  storyPollTextOn,
  storyPollTexts,
  storyPollTop,
  writeStoryPollAnswer,
} from '../components/design-system/storyPollSupport'
import { STORY_PAUSE, STORY_VIEWER_CLOSED, isStoryClockRunning, storyViewerReducer } from '../components/design-system/storyViewerState'
import { STORY_POLL_STYLE } from '../components/design-system/StoryPoll'


// Опросы на слайдах сторис V2 (API v3): кейсы `create-poll.test.ts` JS SDK на контроллере карточки,
// разбор общей фикстуры, шкала и вопрос полосы, тексты, сохранённые ответы и пауза POLL просмотра.

/** Источник ответа слайда 101 сторис 5 (P3). */
const SOURCE = { source_type: 'stories', source_id: '5', source_item_id: '101' }
/** Английские тексты по умолчанию — язык карточек в тестах. */
const EN = STORY_POLL_DEFAULT_TEXTS
/** Магазин и устройство сохранённых ответов. */
const STORAGE = { shopId: 'shop', did: 'device-1' }
const KEY = '@PersonaClick_shop_stories_poll_device-1_mini_poll_gift_recipient_5_101'

const feed = require('./fixtures/stories-polls-feed.json')

const miniPoll = (kind, overrides = {}, poll = {}) =>
  parseStoryPoll({
    type: 'poll',
    poll_type: 'mini_poll',
    y_offset: 40,
    allow_reanswer: false,
    poll: {
      code: 'gift_recipient',
      kind,
      question: 'Кому выбираете подарок?',
      placeholder: kind === 'text' ? 'Название или автор' : null,
      max_length: kind === 'text' ? 10 : null,
      submit_label: 'Отправить',
      thanks_text: 'Спасибо!',
      show_results: true,
      options: [
        { id: 1, label: 'Себе' },
        { id: 2, label: 'Маме' },
        { id: 3, label: 'Папе' },
      ],
      ...poll,
    },
    answer: null,
    results: null,
    ...overrides,
  })

const scalePoll = (type, overrides = {}, poll = {}) =>
  parseStoryPoll({
    type: 'poll',
    poll_type: type,
    y_offset: 50,
    allow_reanswer: false,
    poll: {
      code: 'delivery',
      channel: 'stories',
      name: 'Доставка',
      rate_min: type === 'nps' ? 0 : 1,
      rate_max: type === 'nps' ? 10 : type === 'csat' ? 5 : 7,
      question: 'Как вам доставка?',
      bands: [
        { from: 0, to: 6, success: 'Спасибо, мы станем лучше' },
        { from: 7, to: 8, success: 'Спасибо!' },
        { from: 9, to: 10, success: 'Спасибо, рады стараться!' },
      ],
      ...poll,
    },
    answer: null,
    results: null,
    ...overrides,
  })

/** Элемент ленты мини-опроса как есть (карточка пишет в него ответ). */
const feedElement = (kind, overrides = {}) => ({ ...miniPoll(kind, overrides).element })

/** Транспорт, каждым запросом которого тест управляет сам. */
const transport = () => {
  const calls = []
  const pending = []
  const wait = () => new Promise((resolve, reject) => pending.push({ resolve, reject }))
  const api = {
    answerMiniPoll: (...args) => {
      calls.push({ method: 'answerMiniPoll', args })
      return wait()
    },
    review: (...args) => {
      calls.push({ method: 'review', args })
      return wait()
    },
  }
  return { api, calls, pending }
}

const mount = (poll, extra = {}) => {
  expect(poll).not.toBeNull()
  const t = transport()
  const events = []
  const controller = createStoryPollController({
    poll,
    storyId: 5,
    slideId: 101,
    transport: t.api,
    storage: STORAGE,
    onHold: (on) => events.push(on ? 'pause' : 'resume'),
    ...extra,
  })
  return { c: controller, state: () => controller.state(), events, ...t }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(async () => {
  resetStoryPollAnswers()
  await AsyncStorage.clearAll()
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('Stories polls — parsing', () => {
  test('unknown poll types and kinds or a broken element are not drawn; unknown ones go to the debug log', () => {
    expect(miniPoll('quiz')).toBeNull()
    expect(console.log).toHaveBeenCalledWith('[Stories polls] skipped poll mini_poll/quiz')
    expect(parseStoryPoll({ type: 'poll', poll_type: 'emoji', poll: { code: 'x' } })).toBeNull()
    expect(console.log).toHaveBeenCalledWith('[Stories polls] skipped poll emoji/undefined')
    expect(parseStoryPoll({ type: 'poll', poll_type: 'mini_poll', poll: { code: 'x', kind: null } })).toBeNull()
    expect(parseStoryPoll({ type: 'poll', poll_type: 'nps', poll: 'x' })).toBeNull()
    expect(parseStoryPoll({ type: 'poll', poll_type: 'nps', poll: null })).toBeNull()
    expect(parseStoryPoll({ type: 'text_block' })).toBeNull()
    expect(parseStoryPoll(null)).toBeNull()
    const broken = { type: 'poll', poll_type: 'mini_poll', poll: { code: 'x', kind: 'text', options: 'oops', max_length: 'abc' } }
    expect(parseStoryPoll(broken)).toMatchObject({ kind: 'text', options: [], maxLength: null })
    const throwing = { type: 'poll', poll_type: 'mini_poll', get poll() { throw new Error('boom') } }
    expect(parseStoryPoll(throwing)).toBeNull()
  })

  test('the shared fixture: every kind on its slide, strings as numbers, the unknown kind skipped', () => {
    const slides = feed.payload.stories[0].slides
    const polls = slides.map((slide) => slidePolls(slide))
    expect(polls.map((list) => list.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 0])
    const [single, multi, text, nps, csat, ces, answered] = polls.map((list) => list[0])
    expect(single).toMatchObject({ type: 'mini_poll', kind: 'single_choice', code: 'demo_single', yOffset: 50, allowReanswer: true })
    expect(single.labels).toEqual({ reanswer: 'Ответить заново', error: 'Не удалось отправить ответ. Попробуйте еще раз' })
    expect(multi).toMatchObject({ kind: 'multiple_choice', yOffset: 40, submitLabel: 'Отправить ответ', labels: {} })
    expect(multi.options.map((option) => option.id)).toEqual([1, 2, 3, 4, 5])
    expect(text).toMatchObject({ kind: 'text', maxLength: 120, placeholder: 'Ваш ответ', yOffset: 30 })
    expect(nps).toMatchObject({ type: 'nps', kind: 'scale', channel: 'test', rateMin: 0, rateMax: 10, yOffset: 60 })
    expect(csat).toMatchObject({ type: 'csat', channel: null, rateMin: null, rateMax: null, yOffset: 90 })
    expect(ces).toMatchObject({ type: 'ces', rateMin: 1, rateMax: 7, bands: null, yOffset: 5 })
    expect(storyPollScaleRange('ces', ces)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(storyPollScaleRange('csat', csat)).toEqual([1, 2, 3, 4, 5])
    expect(answered.answer).toEqual({ id: 77, option_ids: [2], text: null, rate: null, comment: null })
    expect(answered.results).toEqual({ total: 120, options: [{ id: 1, percent: 40 }, { id: 2, percent: 60 }] })
    expect(hasStoryPollAnswer(answered.answer)).toBe(true)
    expect(hasStoryPollAnswer(single.answer)).toBe(false)
  })

  test('answered as hasAnswer of JS: non-empty option_ids, non-empty text or a rate that is a number', () => {
    const answered = (answer) => hasStoryPollAnswer(parseStoryPoll({ type: 'poll', poll_type: 'nps', poll: {}, answer }).answer)
    expect([{ option_ids: [1] }, { option_ids: ['x'] }, { text: ' ' }, { rate: 0 }, { rate: 7.5 }].map(answered)).toEqual(Array(5).fill(true))
    expect(
      [null, {}, { option_ids: [] }, { text: '' }, { text: 5 }, { rate: null }, { rate: '9' }, { rate: 'abc' }].map(answered),
    ).toEqual(Array(8).fill(false))
    // Целые строкой — числа: выделяется свой вариант.
    expect(parseStoryPollAnswer({ option_ids: ['2', 'x'] }).option_ids).toEqual([2, 'x'])
  })

  test('numbers as strings and nulls everywhere optional; product slides keep their poll', () => {
    const poll = parseStoryPoll({
      type: 'poll',
      poll_type: 'mini_poll',
      y_offset: '140',
      allow_reanswer: 'true',
      labels: { reanswer: '', submit: 'Ок' },
      poll: { code: 7, kind: 'single_choice', question: null, options: [{ id: '1', label: 'A' }, { id: 'x', label: 'B' }, null] },
      answer: { option_ids: ['1'], text: null },
      results: { total: '3', options: [{ id: '1', percent: '66.7' }] },
    })
    expect(poll).toMatchObject({ code: '7', yOffset: 100, allowReanswer: true, question: null, labels: { submit: 'Ок' } })
    expect(poll.options).toEqual([{ id: 1, label: 'A' }])
    expect(poll.answer.option_ids).toEqual([1])
    expect(poll.results).toEqual({ total: 3, options: [{ id: 1, percent: 66.7 }] })
    const product = { id: '39_0', type: '', elements: [{ type: 'product', item: {} }, { type: 'poll', poll_type: 'nps', poll: { code: 'q' } }] }
    expect(slidePolls(product)).toHaveLength(1)
    expect(slidePolls({ elements: null })).toEqual([])
  })

  test('every kind with null optional fields is drawn with defaults', () => {
    const nulls = { y_offset: null, allow_reanswer: null, labels: null, answer: null, results: null }
    const mini = {
      code: 'm',
      question: null,
      placeholder: null,
      max_length: null,
      submit_label: null,
      thanks_text: null,
      show_results: null,
      options: null,
    }
    const scale = { code: 's', channel: null, name: null, rate_min: null, rate_max: null, question: null, bands: null }
    ;['single_choice', 'multiple_choice', 'text'].forEach((kind) => {
      const poll = parseStoryPoll({ type: 'poll', poll_type: 'mini_poll', ...nulls, poll: { ...mini, kind } })
      expect(poll).toMatchObject({
        kind,
        code: 'm',
        yOffset: 0,
        allowReanswer: false,
        question: null,
        placeholder: null,
        maxLength: null,
        submitLabel: null,
        thanksText: null,
        showResults: false,
        options: [],
        answer: null,
        results: null,
        labels: {},
      })
      expect(mount(poll).state()).toMatchObject({ mode: 'form', counter: null, thanks: null, submitLabel: 'Send', texts: EN })
    })
    const ranges = { nps: [0, 10], csat: [1, 5], ces: [1, 7] }
    Object.keys(ranges).forEach((type) => {
      const poll = parseStoryPoll({ type: 'poll', poll_type: type, ...nulls, poll: scale })
      expect(poll).toMatchObject({ type, kind: 'scale', channel: null, rateMin: null, rateMax: null, bands: null, yOffset: 0 })
      const values = storyPollScaleRange(type, poll)
      expect([values[0], values[values.length - 1]]).toEqual(ranges[type])
      expect(storyPollReviewBody(poll, 3).channel).toBe('stories')
    })
  })

  test('no code or a null code: the card is drawn and the request goes with an empty code', async () => {
    const poll = parseStoryPoll({ type: 'poll', poll_type: 'mini_poll', poll: { kind: 'single_choice', options: [{ id: 1, label: 'A' }] } })
    expect(poll).toMatchObject({ code: '', kind: 'single_choice' })
    expect(parseStoryPoll({ type: 'poll', poll_type: 'nps', poll: { code: null } })).toMatchObject({ code: '', kind: 'scale' })
    expect(storyPollReviewBody(scalePoll('nps', {}, { code: null }), 5)).toEqual({ channel: 'stories', category: '', rate: 5 })

    const { c, state, calls, pending } = mount(poll)
    c.choose(1)
    expect(calls[0].args[0]).toBe('')
    pending[0].reject(new Error('Mini poll not found'))
    await tick()
    expect(state()).toMatchObject({ mode: 'form', error: true })
    c.choose(1)
    pending[1].resolve({})
    await tick()
    expect(storyPollSavedAnswer(c.storageKey)).toMatchObject({ answer: { option_ids: [1] } })
  })

  test('flags: only true, 1 or "true" are true', () => {
    const reanswer = (value) => miniPoll('single_choice', { allow_reanswer: value }).allowReanswer
    const results = (value) => miniPoll('single_choice', {}, { show_results: value }).showResults
    expect([true, 1, 1.0, 'true'].map(reanswer)).toEqual([true, true, true, true])
    expect([false, 0, '1', 'false', 'yes', 2, null, undefined, {}].map(reanswer)).toEqual(Array(9).fill(false))
    expect(['TRUE', ' true', 'true ', 'True', 1.5].map(reanswer)).toEqual(Array(5).fill(false))
    expect([true, 1, 'true', '1', null].map(results)).toEqual([true, true, true, false, false])
  })

  test('y_offset: percent of the slide height, clamped to 0..100; none — the top', () => {
    const offset = (value) => miniPoll('single_choice', { y_offset: value }).yOffset
    expect([35, '35', 0, -10, '-5', 140, 100, null, undefined, 'abc', '12.5'].map(offset)).toEqual([35, 35, 0, 0, 0, 100, 100, 0, 0, 0, 12.5])
  })

  test('the top of the card: percent of the whole slide, then moved into the area between the header and the buttons', () => {
    const region = { top: 100, bottom: 700 }
    // 50% от всей высоты 1000, а не от области 100..700.
    expect(storyPollTop(50, 1000, region, 0)).toBe(500)
    expect(storyPollTop(50, 1000, region, 150)).toBe(500)
    // Выше шапки — к верху области; низ ниже кнопок — выше.
    expect(storyPollTop(0, 1000, region, 150)).toBe(100)
    expect(storyPollTop(90, 1000, region, 150)).toBe(550)
    expect(storyPollTop(100, 1000, region, 0)).toBe(1000)
    // Не влезает целиком — к верху области (дальше прокрутка внутри).
    expect(storyPollTop(60, 1000, region, 800)).toBe(100)
    expect(storyPollTop(null, 1000, region, 150)).toBe(100)
  })

  test('poll_type and kind are compared as they are: no trim, case-sensitive', () => {
    const scale = (type) => parseStoryPoll({ type: 'poll', poll_type: type, poll: { code: 'x' } })
    expect(['nps', 'csat', 'ces'].map((type) => scale(type).kind)).toEqual(['scale', 'scale', 'scale'])
    expect(['NPS', ' nps', 'nps ', 'Csat'].map(scale)).toEqual([null, null, null, null])
    expect(parseStoryPoll({ type: 'poll', poll_type: 'Mini_poll', poll: { code: 'x', kind: 'text' } })).toBeNull()
    expect(parseStoryPoll({ type: 'poll', poll_type: ' mini_poll', poll: { code: 'x', kind: 'text' } })).toBeNull()
    expect(miniPoll('Single_choice')).toBeNull()
    expect(miniPoll('text ')).toBeNull()
    expect(miniPoll('MULTIPLE_CHOICE')).toBeNull()
  })

  test('options: an integer id (a number or an integer string) is required; no label — an empty label', () => {
    const poll = miniPoll('single_choice', {}, {
      options: [{ id: 1 }, { id: '2', label: null }, { id: 3, label: 'C' }, { id: 1.5, label: 'D' }, { id: 'x', label: 'E' }, { label: 'F' }, { id: null, label: 'G' }],
    })
    expect(poll.options).toEqual([
      { id: 1, label: '' },
      { id: 2, label: '' },
      { id: 3, label: 'C' },
    ])
  })
})

describe('Stories polls — single choice', () => {
  test('sends the answer on tap and shows thanks and results', async () => {
    const { c, state, calls, pending } = mount(miniPoll('single_choice'))
    expect(state()).toMatchObject({ mode: 'form', selected: [], sending: false })
    c.choose(2)
    expect(calls).toEqual([
      { method: 'answerMiniPoll', args: ['gift_recipient', { option_ids: [2], ...SOURCE }] },
    ])
    expect(state()).toMatchObject({ sending: true, selected: [2] })

    pending[0].resolve({
      answer: { id: 77, option_ids: [2], text: null },
      results: { total: 121, options: [{ id: 1, percent: 40 }, { id: 2, percent: 60 }] },
    })
    await tick()
    expect(state()).toMatchObject({ mode: 'answered', sending: false, selected: [2], thanks: 'Спасибо!', canReanswer: false })
    expect(state().percents).toEqual({ 1: 40, 2: 60, 3: 0 })
  })

  test('does not send twice while the request is pending', () => {
    const { c, calls } = mount(miniPoll('single_choice'))
    c.choose(1)
    c.choose(1)
    c.choose(3)
    expect(calls).toHaveLength(1)
    expect(c.state().selected).toEqual([1])
  })

  test('shows an error and allows retry; the choice goes back', async () => {
    const { c, state, calls, pending } = mount(miniPoll('single_choice'), { texts: { error: 'Ошибка' } })
    c.choose(1)
    pending[0].reject(new Error('Too many requests'))
    await tick()
    expect(state()).toMatchObject({ mode: 'form', error: true, sending: false, selected: [] })
    expect(state().texts.error).toBe('Ошибка')

    c.choose(1)
    expect(calls).toHaveLength(2)
    expect(state().error).toBe(false)
    pending[1].resolve({ answer: { option_ids: [1] }, results: null })
    await tick()
    expect(state()).toMatchObject({ mode: 'answered', percents: null })
  })

  test('uses the sent answer when the server returns no answer', async () => {
    const { c, state, pending } = mount(miniPoll('single_choice'))
    c.choose(3)
    pending[0].resolve({})
    await tick()
    expect(state()).toMatchObject({ mode: 'answered', selected: [3] })

    // Другой магазин: ответ первого уже сохранён.
    const nullAnswer = mount(miniPoll('single_choice'), { storage: { shopId: 'other', did: 'device-1' } })
    nullAnswer.c.choose(1)
    nullAnswer.pending[0].resolve({ answer: null, results: null })
    await tick()
    expect(nullAnswer.state()).toMatchObject({ mode: 'answered', selected: [1], percents: null })
  })

  test('the answer of the server wins over the sent one (no re-answer: the previous answer comes back)', async () => {
    const { c, state, pending } = mount(miniPoll('single_choice'))
    c.choose(1)
    pending[0].resolve({ answer: { id: 77, option_ids: [2], text: null }, results: null })
    await tick()
    expect(state()).toMatchObject({ mode: 'answered', selected: [2] })
    expect(storyPollSavedAnswer(KEY).answer).toEqual({ id: 77, option_ids: [2], text: null })
  })

  test('percents are rounded and clamped to 0..100; an option without a result has 0%', async () => {
    const results = {
      total: 10,
      options: [
        { id: 1, percent: 33.5 },
        { id: 2, percent: '150' },
        { id: 3, percent: -4 },
      ],
    }
    expect(mount(miniPoll('single_choice', { answer: { option_ids: [1] }, results })).state().percents).toEqual({ 1: 34, 2: 100, 3: 0 })
    const partial = { total: 1, options: [{ id: 2, percent: 66.4 }, { id: 9, percent: 30 }, { id: 1, percent: null }] }
    expect(mount(miniPoll('single_choice', { answer: { option_ids: [2] }, results: partial })).state().percents).toEqual({ 1: 0, 2: 66, 3: 0 })
    // Без массива `options` процентов нет вовсе.
    expect(mount(miniPoll('single_choice', { answer: { option_ids: [2] }, results: { total: 3 } })).state().percents).toBeNull()
  })
})

describe('Stories polls — multiple choice', () => {
  test('sends selected options by the submit button in the order of options', async () => {
    const { c, state, calls, pending } = mount(miniPoll('multiple_choice'))
    expect(state().canSubmit).toBe(false)
    c.toggle(3)
    c.toggle(1)
    expect(state()).toMatchObject({ selected: [3, 1], canSubmit: true })
    expect(calls).toHaveLength(0)
    c.toggle(3)
    c.toggle(3)
    c.submit()
    expect(calls[0].args).toEqual(['gift_recipient', { option_ids: [1, 3], ...SOURCE }])
    pending[0].resolve({ answer: { option_ids: [1, 3] }, results: { total: 2, options: [{ id: 1, percent: 50 }, { id: 3, percent: 50 }] } })
    await tick()
    expect(state()).toMatchObject({ mode: 'answered', selected: [1, 3] })
  })

  test('keeps submit disabled after all chips are unselected; chips stay after an error', async () => {
    const { c, state, pending } = mount(miniPoll('multiple_choice'))
    c.toggle(1)
    c.toggle(1)
    expect(state().canSubmit).toBe(false)
    expect(await c.submit()).toBe(false)
    c.toggle(2)
    c.submit()
    pending[0].reject(new Error('fail'))
    await tick()
    expect(state()).toMatchObject({ error: true, selected: [2], canSubmit: true })
  })

  test('the submit button: submit_label, else the submit text (defaults < host < labels)', () => {
    expect(mount(miniPoll('multiple_choice')).state().submitLabel).toBe('Отправить')
    expect(miniPoll('multiple_choice', {}, { submit_label: null }).submitLabel).toBeNull()
    expect(mount(miniPoll('multiple_choice', {}, { submit_label: null })).state().submitLabel).toBe(EN.submit)
    expect(mount(miniPoll('text', {}, { submit_label: '' }), { texts: { submit: 'Готово' } }).state().submitLabel).toBe('Готово')
    const labelled = miniPoll('multiple_choice', { labels: { submit: 'Ответить' } }, { submit_label: null })
    expect(mount(labelled, { texts: { submit: 'Готово' } }).state().submitLabel).toBe('Ответить')
    expect(mount(miniPoll('multiple_choice', { labels: { submit: 'Ответить' } })).state().submitLabel).toBe('Отправить')
  })

  test('the default submit label and texts: defaults < host < labels', () => {
    expect(mount(miniPoll('multiple_choice', {}, { submit_label: null })).state().texts.submit).toBe(EN.submit)
    expect(storyPollTexts(null, null)).toEqual({ reanswer: 'Answer again', error: 'Failed to send the answer. Please try again', submit: 'Send' })
    expect(storyPollTexts({ reanswer: 'Ещё раз', error: '' }, { reanswer: 'Снова' })).toEqual({
      reanswer: 'Снова',
      error: EN.error,
      submit: 'Send',
    })
    expect(storyPollTexts({ submit: 'Отправить' }, { submit: '' }).submit).toBe('Отправить')
    expect(storyPollTexts({ submit: 'Отправить' }, 'labels').submit).toBe('Отправить')
    // Пустой текст хоста умолчание не перекрывает, строка из пробелов — перекрывает.
    expect(storyPollTexts({ reanswer: '', error: ' ', submit: null }, null)).toEqual({
      reanswer: EN.reanswer,
      error: ' ',
      submit: EN.submit,
    })
    expect(mount(miniPoll('text', {}, { submit_label: null }), { texts: { submit: '' } }).state().submitLabel).toBe('Send')
    expect(miniPoll('single_choice', { labels: 'labels' }).labels).toEqual({})
  })
})

describe('Stories polls — text', () => {
  test('counts characters, cuts at max_length and sends the trimmed text', async () => {
    const { c, state, calls, pending } = mount(miniPoll('text'))
    expect(state()).toMatchObject({ counter: '0/10', canSubmit: false, limit: 10 })
    c.setText('   ')
    expect(state().canSubmit).toBe(false)
    c.setText(' Мастер и Маргарита ')
    expect(state()).toMatchObject({ text: ' Мастер и ', counter: '10/10', canSubmit: true })
    c.submit()
    expect(calls[0].args).toEqual(['gift_recipient', { text: 'Мастер и', ...SOURCE }])
    c.setText('другое')
    expect(state().text).toBe(' Мастер и ')
    pending[0].resolve({ answer: { id: 1, option_ids: null, text: 'Мастер и' }, results: null })
    await tick()
    expect(state()).toMatchObject({ mode: 'answered', thanks: 'Спасибо!', answerText: 'Мастер и' })
  })

  test('has no counter without max_length', () => {
    expect(mount(miniPoll('text', {}, { max_length: null })).state().counter).toBeNull()
    expect(mount(miniPoll('text', {}, { max_length: 0 })).state()).toMatchObject({ counter: null, limit: null })
    expect(mount(miniPoll('text', {}, { max_length: '5.9' })).state()).toMatchObject({ counter: '0/5', limit: 5 })
  })

  test('the limit counts UTF-16 units like the web and does not split a surrogate pair', () => {
    const { c, state } = mount(miniPoll('text', {}, { max_length: 3 }))
    c.setText('ab😀')
    expect(state()).toMatchObject({ text: 'ab', counter: '2/3' })
    c.setText('a😀b')
    expect(state()).toMatchObject({ text: 'a😀', counter: '3/3' })
    expect(storyPollCutText('😀😀', 3)).toBe('😀')
    expect(storyPollCutText('abcdef', null)).toBe('abcdef')
  })
})

describe('Stories polls — scales', () => {
  test('NPS 0..10 sends the rate on tap and thanks with the band', async () => {
    const poll = scalePoll('nps')
    expect(storyPollScaleRange('nps', poll)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const { c, state, calls, pending } = mount(poll)
    c.rate(9)
    expect(calls[0]).toEqual({ method: 'review', args: ['nps', { channel: 'stories', category: 'delivery', rate: 9, ...SOURCE }] })
    expect(state()).toMatchObject({ rate: 9, sending: true })
    pending[0].resolve({ answer: null, results: null })
    await tick()
    expect(state()).toMatchObject({ mode: 'answered', rate: 9, thanks: 'Спасибо, рады стараться!' })
  })

  test('CSAT 1..5 and CES 1..7 go with campaign; no channel — "stories"', async () => {
    const csat = mount(scalePoll('csat', {}, { bands: [{ from: 1, to: 3, success: 'Жаль' }, { from: 4, to: 5, success: 'Ура' }] }))
    csat.c.rate(1)
    expect(csat.calls[0].args).toEqual(['csat', { channel: 'stories', campaign: 'delivery', rate: 1, ...SOURCE }])
    csat.pending[0].resolve({})
    await tick()
    expect(csat.state().thanks).toBe('Жаль')

    const ces = mount(scalePoll('ces', {}, { channel: null }))
    ces.c.rate(7)
    expect(ces.calls[0].args).toEqual(['ces', { channel: 'stories', campaign: 'delivery', rate: 7, ...SOURCE }])
    expect(storyPollReviewBody({ type: 'nps', code: 'test', channel: 'test' }, 0)).toEqual({ channel: 'test', category: 'test', rate: 0 })
  })

  test('default ranges, at most 21 values, bands with edges', () => {
    expect(storyPollScaleRange('csat', {})).toEqual([1, 2, 3, 4, 5])
    expect(storyPollScaleRange('nps', {})).toHaveLength(11)
    expect(storyPollScaleRange('ces', { rateMin: 0, rateMax: 100 })).toHaveLength(21)
    expect(storyPollScaleRange('ces', { rateMin: 0, rateMax: 100 }).pop()).toBe(20)
    expect(storyPollScaleRange('nps', { rateMin: 5, rateMax: 3 })).toEqual([])
    // Не целые границы — умолчания вида, каждая сама по себе; целые строками — как числа.
    const range = (type, min, max) => storyPollScaleRange(type, scalePoll(type, {}, { rate_min: min, rate_max: max }))
    expect(range('csat', 1.5, '4.5')).toEqual([1, 2, 3, 4, 5])
    expect(range('nps', 'abc', 3)).toEqual([0, 1, 2, 3])
    expect(range('ces', '2', '4')).toEqual([2, 3, 4])
    expect(range('csat', 4, '2')).toEqual([])
    const bands = { bands: [{ from: 0, to: 6, success: 'A' }, { from: 7, to: 8, success: null }] }
    expect(storyPollBandText(bands, 0)).toBe('A')
    expect(storyPollBandText(bands, 6)).toBe('A')
    expect(storyPollBandText(bands, 7)).toBeNull()
    expect(storyPollBandText(bands, 9)).toBeNull()
    expect(storyPollBandText({ bands: null }, 3)).toBeNull()
    expect(storyPollBandText(bands, null)).toBeNull()
  })

  test('tones: NPS detractors, passives and promoters; other scales by thirds (the colours of the JS SDK as kit semantics)', () => {
    const nps = [0, 3, 6, 7, 8, 9, 10].map((value) => storyPollScaleTone('nps', value, 0, 10))
    expect(nps).toEqual(['danger', 'danger', 'danger', 'warning', 'warning', 'success', 'success'])
    expect([1, 2, 3, 4, 5].map((value) => storyPollScaleTone('csat', value, 1, 5))).toEqual(['danger', 'danger', 'warning', 'success', 'success'])
    expect([1, 2, 3, 4, 5, 6, 7].map((value) => storyPollScaleTone('ces', value, 1, 7))).toEqual([
      'danger',
      'danger',
      'danger',
      'warning',
      'warning',
      'success',
      'success',
    ])
    expect(storyPollScaleTone('nps', 3, 1, 5)).toBe('warning')
    expect(storyPollScaleTone('ces', 4, 4, 4)).toBe('success')
  })

  test('the answered state of a scale from the feed takes no taps', async () => {
    const { c, state, calls } = mount(scalePoll('nps', { answer: { rate: 3 } }))
    expect(state()).toMatchObject({ mode: 'answered', rate: 3, thanks: 'Спасибо, мы станем лучше', canReanswer: false })
    expect(await c.rate(5)).toBe(false)
    expect(calls).toHaveLength(0)
  })
})

describe('Stories polls — answer from the feed and re-answer', () => {
  const answered = {
    answer: { option_ids: [2], text: null },
    results: { total: 120, options: [{ id: 1, percent: 40 }, { id: 2, percent: 60 }] },
  }

  test('the answered state without reanswer takes no taps', async () => {
    const { c, state, calls } = mount(miniPoll('single_choice', answered))
    expect(state()).toMatchObject({ mode: 'answered', selected: [2], thanks: 'Спасибо!', canReanswer: false })
    expect(state().percents).toEqual({ 1: 40, 2: 60, 3: 0 })
    c.reanswer()
    expect(await c.choose(1)).toBe(false)
    expect(calls).toHaveLength(0)
  })

  test('"answer again" resets the form with the previous answer highlighted', async () => {
    const { c, state, calls, pending } = mount(miniPoll('single_choice', { ...answered, allow_reanswer: true }))
    expect(state().canReanswer).toBe(true)
    c.reanswer()
    expect(state()).toMatchObject({ mode: 'form', canReanswer: false, selected: [2], reanswered: true })
    c.choose(1)
    expect(state().selected).toEqual([1])
    expect(calls).toHaveLength(1)
    pending[0].resolve({ answer: { option_ids: [1] }, results: null })
    await tick()
    expect(state()).toMatchObject({ mode: 'answered', canReanswer: true, selected: [1] })
  })

  test('a failed re-answer restores the previous single choice', async () => {
    const { c, state, pending } = mount(miniPoll('single_choice', { ...answered, allow_reanswer: true }))
    c.reanswer()
    c.choose(3)
    pending[0].reject(new Error('fail'))
    await tick()
    expect(state()).toMatchObject({ mode: 'form', selected: [2], error: true })
  })

  test('multiple choice preselects the previous options on re-answer', () => {
    const { c, state, calls } = mount(miniPoll('multiple_choice', { answer: { option_ids: [1, 3] }, allow_reanswer: true }))
    c.reanswer()
    expect(state()).toMatchObject({ selected: [1, 3], canSubmit: true })
    c.toggle(1)
    c.submit()
    expect(calls[0].args).toEqual(['gift_recipient', { option_ids: [3], ...SOURCE }])
  })

  test('a scale highlights the previous rate on re-answer and restores it after an error', async () => {
    const { c, state, pending } = mount(scalePoll('nps', { answer: { rate: 3 }, allow_reanswer: true }))
    c.reanswer()
    expect(state()).toMatchObject({ mode: 'form', rate: 3 })
    c.rate(8)
    expect(state().rate).toBe(8)
    pending[0].reject(new Error('fail'))
    await tick()
    expect(state().rate).toBe(3)
  })

  test('the text form starts empty on re-answer', () => {
    const { c, state } = mount(miniPoll('text', { answer: { text: 'Букварь' }, allow_reanswer: true }))
    expect(state()).toMatchObject({ mode: 'answered', answerText: 'Букварь' })
    c.reanswer()
    expect(state()).toMatchObject({ mode: 'form', text: '', reanswered: true })
  })

  test('labels of the element win over the host texts', () => {
    const poll = miniPoll('single_choice', { ...answered, allow_reanswer: true, labels: { reanswer: 'Ещё раз' } })
    expect(mount(poll, { texts: { reanswer: 'Answer again!' } }).state().texts.reanswer).toBe('Ещё раз')
    expect(mount(miniPoll('single_choice', answered)).state().texts.reanswer).toBe(EN.reanswer)
  })
})

describe('Stories polls — slide timer', () => {
  test('pauses while the card is touched', () => {
    const { c, events } = mount(miniPoll('multiple_choice'))
    c.press(true)
    c.press(true)
    expect(events).toEqual(['pause'])
    c.press(false)
    expect(events).toEqual(['pause', 'resume'])
  })

  test('pauses while the input is focused (keyboard is open)', () => {
    const { c, events } = mount(miniPoll('text'))
    c.focus(true)
    c.setText('a')
    c.press(true)
    c.press(false)
    expect(events).toEqual(['pause'])
    c.focus(false)
    expect(events).toEqual(['pause', 'resume'])
  })

  test('keeps the timer paused while sending and resumes after; the field is gone with the answer', async () => {
    const nps = mount(scalePoll('nps'))
    nps.c.rate(10)
    expect(nps.events).toEqual(['pause'])
    nps.pending[0].resolve({})
    await tick()
    expect(nps.events).toEqual(['pause', 'resume'])

    const text = mount(miniPoll('text'))
    text.c.focus(true)
    text.c.setText('Книга')
    text.c.submit()
    text.pending[0].resolve({ answer: { text: 'Книга' } })
    await tick()
    expect(text.events).toEqual(['pause', 'resume'])
  })

  test('recomputes the focus after a failed send', async () => {
    const { c, events, pending } = mount(miniPoll('text'))
    c.focus(true)
    c.setText('Книга')
    c.submit()
    c.focus(false)
    expect(events).toEqual(['pause'])
    pending[0].reject(new Error('fail'))
    await tick()
    expect(events).toEqual(['pause', 'resume'])
  })

  test('an answer after the card is gone is still saved and written to the feed element', async () => {
    const changes = []
    const first = mount(miniPoll('single_choice'), { onChange: (state) => changes.push(state.mode) })
    first.c.choose(2)
    first.c.detach()
    const count = changes.length
    first.pending[0].resolve({ answer: { option_ids: [2] }, results: { total: 1, options: [{ id: 2, percent: 100 }] } })
    await tick()
    expect(changes).toHaveLength(count)
    expect(first.events).toEqual(['pause'])
    expect(storyPollSavedAnswer(KEY)).toEqual({
      answer: { option_ids: [2] },
      results: { total: 1, options: [{ id: 2, percent: 100 }] },
    })
    // Вернулись на слайд: карточка уже отвеченная.
    expect(mount(miniPoll('single_choice')).state()).toMatchObject({ mode: 'answered', selected: [2] })
  })

  test('does not resume a removed card', () => {
    const { c, events } = mount(miniPoll('text'))
    c.press(true)
    c.detach()
    c.press(false)
    expect(events).toEqual(['pause'])
  })

  test('a failed send is not logged by the card (the HTTP transport logs it)', async () => {
    const { c, state, pending } = mount(miniPoll('single_choice'))
    c.choose(1)
    pending[0].reject(Object.assign(new Error('Too many requests'), { code: 429 }))
    await tick()
    expect(state().error).toBe(true)
    expect(console.log).not.toHaveBeenCalled()
  })

  test('a failure after the card is gone changes nothing', async () => {
    const { c, events, pending } = mount(miniPoll('single_choice'))
    c.choose(1)
    c.detach()
    pending[0].reject(new Error('fail'))
    await tick()
    expect(events).toEqual(['pause'])
    expect(storyPollSavedAnswer(KEY)).toBeNull()
  })
})

describe('Stories polls — saved answers (P1)', () => {
  const answeredRecord = (extra = {}) =>
    JSON.stringify({ answer: { option_ids: [3] }, results: { total: 1, options: [{ id: 3, percent: 100 }] }, saved_at: Date.now(), ...extra })

  test('the key: the shop as the other stores of the SDK, the device, the poll type and code, the story and the slide', () => {
    const poll = miniPoll('single_choice')
    expect(storyPollStorageKey(STORAGE, poll, 5, 101)).toBe(KEY)
    expect(storyPollStorageKey(STORAGE, scalePoll('csat'), '39', '39_0')).toBe('@PersonaClick_shop_stories_poll_device-1_csat_delivery_39_39_0')
    // Без устройства или магазина — ничего не читается и не пишется.
    expect(storyPollStorageKey({ shopId: 'shop', did: '' }, poll, 5, 101)).toBeNull()
    expect(storyPollStorageKey({ shopId: '', did: 'device-1' }, poll, 5, 101)).toBeNull()
    expect(storyPollStorageKey(null, poll, 5, 101)).toBeNull()
  })

  test('writes the answer back to the feed element and to the device', async () => {
    const element = feedElement('single_choice')
    const first = mount(parseStoryPoll(element))
    first.c.choose(2)
    const results = { total: 3, options: [{ id: 2, percent: 100 }] }
    first.pending[0].resolve({ answer: { id: 7, option_ids: [2] }, results })
    await tick()
    expect(element.answer).toEqual({ id: 7, option_ids: [2] })
    expect(element.results).toEqual(results)
    const saved = JSON.parse(await AsyncStorage.getItem(KEY))
    expect({ answer: saved.answer, results: saved.results }).toEqual({ answer: { id: 7, option_ids: [2] }, results })
    expect(typeof saved.saved_at).toBe('number')
    // Слайд показан снова: тот же элемент ленты — карточка отвеченная, с процентами.
    resetStoryPollAnswers()
    const again = mount(parseStoryPoll(element))
    expect(again.state()).toMatchObject({ mode: 'answered', selected: [2], percents: { 1: 0, 2: 100, 3: 0 } })
  })

  test('the saved answer is read with the feed and wins over nothing; another slide, device or no did — not restored', async () => {
    await AsyncStorage.setItem(KEY, answeredRecord())
    await loadStoryPollAnswers([KEY])
    expect(mount(miniPoll('single_choice')).state()).toMatchObject({ mode: 'answered', selected: [3], percents: { 1: 0, 2: 0, 3: 100 } })
    expect(mount(miniPoll('single_choice'), { slideId: 102 }).state().mode).toBe('form')
    expect(mount(miniPoll('single_choice'), { storage: { shopId: 'shop', did: 'device-2' } }).state().mode).toBe('form')
    expect(mount(miniPoll('single_choice'), { storage: { shopId: 'shop', did: null } }).state().mode).toBe('form')
    expect(mount(miniPoll('single_choice'), { storage: null }).state().mode).toBe('form')
  })

  test('the answer of the feed wins over the saved one', async () => {
    await AsyncStorage.setItem(KEY, answeredRecord())
    await loadStoryPollAnswers([KEY])
    const fed = mount(miniPoll('single_choice', { answer: { option_ids: [1] }, results: null }))
    expect(fed.state()).toMatchObject({ mode: 'answered', selected: [1], percents: null })
  })

  test('precedence: a fresh feed answer > an answer sent earlier in this process > the saved record', async () => {
    await AsyncStorage.setItem(KEY, answeredRecord())
    await loadStoryPollAnswers([KEY])
    // Отправили ответ в этом процессе — он важнее записи, прочитанной с устройства.
    const sent = mount(miniPoll('single_choice', { allow_reanswer: true }))
    expect(sent.state()).toMatchObject({ mode: 'answered', selected: [3] })
    sent.c.reanswer()
    sent.c.choose(1)
    sent.pending[0].resolve({ answer: { option_ids: [1] }, results: null })
    await tick()
    // Лента загружена заново (новые элементы), ответа в ней нет — отправленный, а не запись.
    expect(mount(miniPoll('single_choice')).state()).toMatchObject({ mode: 'answered', selected: [1] })
    // Отправленный раньше уже на устройстве и в кэше: следующее чтение с диска его не перетирает.
    await loadStoryPollAnswers([KEY])
    expect(mount(miniPoll('single_choice')).state().selected).toEqual([1])
    // Свежая лента с ответом важнее отправленного.
    expect(mount(miniPoll('single_choice', { answer: { option_ids: [2] } })).state()).toMatchObject({ mode: 'answered', selected: [2] })
  })

  test('a card shown before the read shows the saved answer once it is read, unless it was touched', async () => {
    await AsyncStorage.setItem(KEY, answeredRecord())
    const late = mount(miniPoll('single_choice'))
    expect(late.state().mode).toBe('form')
    await tick()
    expect(late.state()).toMatchObject({ mode: 'answered', selected: [3] })

    resetStoryPollAnswers()
    const touched = mount(miniPoll('multiple_choice', {}, { code: 'gift_recipient' }))
    touched.c.toggle(1)
    await tick()
    expect(touched.state()).toMatchObject({ mode: 'form', selected: [1] })
  })

  test('broken, expired and undated records are not shown and are removed', async () => {
    await AsyncStorage.setItem(KEY, '{broken')
    await loadStoryPollAnswers([KEY])
    expect(mount(miniPoll('single_choice')).state().mode).toBe('form')
    await tick()
    expect(await AsyncStorage.getItem(KEY)).toBeNull()

    resetStoryPollAnswers()
    await AsyncStorage.setItem(KEY, JSON.stringify({ answer: null, saved_at: Date.now() }))
    await loadStoryPollAnswers([KEY])
    expect(mount(miniPoll('single_choice')).state().mode).toBe('form')
    await tick()
    expect(await AsyncStorage.getItem(KEY)).toBeNull()

    resetStoryPollAnswers()
    await AsyncStorage.setItem(KEY, answeredRecord({ saved_at: Date.now() - STORY_POLL_ANSWER_TTL_MS - 1000 }))
    await loadStoryPollAnswers([KEY])
    expect(mount(miniPoll('single_choice')).state().mode).toBe('form')
    await tick()
    expect(await AsyncStorage.getItem(KEY)).toBeNull()

    resetStoryPollAnswers()
    await AsyncStorage.setItem(KEY, JSON.stringify({ answer: { option_ids: [3] }, results: null }))
    await loadStoryPollAnswers([KEY])
    expect(storyPollSavedAnswer(KEY)).toBeNull()
    await tick()
    expect(await AsyncStorage.getItem(KEY)).toBeNull()
  })

  test('a record that expires while the app runs is dropped on the next read', () => {
    const now = jest.spyOn(Date, 'now')
    now.mockReturnValue(1000)
    writeStoryPollAnswer(KEY, { answer: { option_ids: [2] }, results: null })
    expect(storyPollSavedAnswer(KEY)).toEqual({ answer: { option_ids: [2] }, results: null })
    now.mockReturnValue(1000 + STORY_POLL_ANSWER_TTL_MS + 1)
    expect(storyPollSavedAnswer(KEY)).toBeNull()
  })

  test('scales are keyed by the poll type; the saved rate is { rate }', async () => {
    const { c, pending } = mount(scalePoll('csat'))
    c.rate(5)
    pending[0].resolve({})
    await tick()
    const saved = JSON.parse(await AsyncStorage.getItem('@PersonaClick_shop_stories_poll_device-1_csat_delivery_5_101'))
    expect(saved.answer).toEqual({ rate: 5 })
  })

  test('without a did nothing is written', async () => {
    const { c, pending } = mount(miniPoll('single_choice'), { storage: { shopId: 'shop', did: '' } })
    c.choose(1)
    pending[0].resolve({ answer: { option_ids: [1] } })
    await tick()
    expect(c.storageKey).toBeNull()
    expect(await AsyncStorage.getAllKeys()).toEqual([])
  })

  test('an empty answer of the server: answered now, the form when the slide comes back (as JS)', async () => {
    const element = feedElement('single_choice', { allow_reanswer: true })
    const first = mount(parseStoryPoll(element))
    first.c.choose(2)
    first.pending[0].resolve({ answer: { id: 77 }, results: null })
    await tick()
    expect(first.state()).toMatchObject({ mode: 'answered', selected: [], canReanswer: true })
    expect(element.answer).toEqual({ id: 77 })
    expect(mount(parseStoryPoll(element)).state().mode).toBe('form')
  })

  test('the keys a feed needs: polls without an answer of the feed', () => {
    const stories = [
      {
        id: 5,
        slides: [
          { id: 101, elements: [feedElement('single_choice'), feedElement('text', { answer: { text: 'a' } })] },
          { id: '5_1', elements: [{ type: 'poll', poll_type: 'nps', poll: { code: 'q' } }] },
        ],
      },
      { id: 6, slides: null },
    ]
    expect(storyPollStorageKeys(STORAGE, stories)).toEqual([KEY, '@PersonaClick_shop_stories_poll_device-1_nps_q_5_5_1'])
    expect(storyPollStorageKeys({ shopId: 'shop', did: '' }, stories)).toEqual([])
  })
})

describe('Stories polls — source of the answer (P3)', () => {
  test('the story and the slide as the stories source, ids as strings', () => {
    expect(storyPollSource(5, 101)).toEqual(SOURCE)
    expect(storyPollSource('39', '39_0')).toEqual({ source_type: 'stories', source_id: '39', source_item_id: '39_0' })
    expect(storyPollSource(5, null)).toEqual({ source_type: 'stories', source_id: '5' })
    expect(storyPollSource(5, '')).toEqual({ source_type: 'stories', source_id: '5' })
    expect(storyPollSource(null, 7)).toEqual({})
    expect(storyPollSource('', 7)).toEqual({})
  })

  test('mini polls and scales send the same source and no story_id / slide_id', () => {
    expect(storyPollAnswerBody({ option_ids: [1] }, 3, '3_0')).toEqual({ option_ids: [1], source_type: 'stories', source_id: '3', source_item_id: '3_0' })
    expect(storyPollAnswerBody({ text: 'a' }, undefined, 76)).toEqual({ text: 'a' })
    expect(storyPollReviewBody(scalePoll('nps'), 9, null, 3, '3_0')).toEqual({
      channel: 'stories',
      category: 'delivery',
      rate: 9,
      source_type: 'stories',
      source_id: '3',
      source_item_id: '3_0',
    })
    expect(storyPollReviewBody(scalePoll('ces'), 2, 'Долго', 3)).toEqual({
      channel: 'stories',
      campaign: 'delivery',
      rate: 2,
      comment: 'Долго',
      source_type: 'stories',
      source_id: '3',
    })
    const mini = mount(miniPoll('single_choice'), { storyId: 3, slideId: '3_0' })
    const scale = mount(scalePoll('nps'), { storyId: 3, slideId: '3_0' })
    mini.c.choose(1)
    scale.c.rate(9)
    const source = { source_type: 'stories', source_id: '3', source_item_id: '3_0' }
    expect(mini.calls[0].args).toEqual(['gift_recipient', { option_ids: [1], ...source }])
    expect(scale.calls[0].args).toEqual(['nps', { channel: 'stories', category: 'delivery', rate: 9, ...source }])
  })
})

describe('Stories polls — follow-up question of the band (P2)', () => {
  const bands = [
    { from: 0, to: 6, question: 'Что нам улучшить?', success: 'Спасибо, мы станем лучше' },
    { from: 7, to: 8, question: '  ', success: 'Спасибо!' },
    { from: 9, to: 10, question: null, success: 'Спасибо, рады стараться!' },
  ]
  const withQuestion = (overrides = {}) => scalePoll('nps', overrides, { bands })

  test('asks the question after the rate and sends the comment with the same rate', async () => {
    const element = { ...withQuestion().element }
    const { c, state, calls, pending, events } = mount(parseStoryPoll(element))
    c.rate(3)
    expect(calls[0].args).toEqual(['nps', { channel: 'stories', category: 'delivery', rate: 3, ...SOURCE }])
    pending[0].resolve({ answer: null, results: null })
    await tick()
    expect(state()).toMatchObject({
      mode: 'answered',
      rate: 3,
      followUp: 'Что нам улучшить?',
      thanks: null,
      field: 'comment',
      comment: '',
      commentCounter: `0/${STORY_POLL_COMMENT_LIMIT}`,
      canSubmitComment: false,
      commentSubmitLabel: 'Send',
    })
    expect(element.answer).toEqual({ rate: 3 })

    c.focus(true)
    c.setComment('  Курьер опоздал  ')
    expect(state()).toMatchObject({ commentCounter: '18/5000', canSubmitComment: true })
    c.submitComment()
    expect(calls[1]).toEqual({
      method: 'review',
      args: ['nps', { channel: 'stories', category: 'delivery', rate: 3, comment: 'Курьер опоздал', ...SOURCE }],
    })
    expect(state()).toMatchObject({ sending: true, canSubmitComment: false })
    pending[1].resolve({ answer: null, results: null })
    await tick()
    expect(state()).toMatchObject({ followUp: null, field: null, thanks: 'Спасибо, мы станем лучше' })
    expect(element.answer).toEqual({ rate: 3, comment: 'Курьер опоздал' })
    expect(JSON.parse(await AsyncStorage.getItem('@PersonaClick_shop_stories_poll_device-1_nps_delivery_5_101')).answer).toEqual({
      rate: 3,
      comment: 'Курьер опоздал',
    })
    expect(events[events.length - 1]).toBe('resume')
  })

  test('shows success right away without a question (blank or none)', async () => {
    const passive = mount(withQuestion())
    passive.c.rate(7)
    passive.pending[0].resolve({})
    await tick()
    expect(passive.state()).toMatchObject({ followUp: null, field: null, thanks: 'Спасибо!' })

    resetStoryPollAnswers()
    const promoter = mount(withQuestion())
    promoter.c.rate(10)
    promoter.pending[0].resolve({})
    await tick()
    expect(promoter.state()).toMatchObject({ followUp: null, thanks: 'Спасибо, рады стараться!' })
    expect(passive.calls.length + promoter.calls.length).toBe(2)
  })

  test('keeps the comment after a failed send; an empty comment is not sent', async () => {
    const { c, state, calls, pending } = mount(withQuestion({ answer: { rate: 2, comment: null } }))
    expect(await c.submitComment()).toBe(false)
    c.setComment('   ')
    expect(await c.submitComment()).toBe(false)
    expect(calls).toHaveLength(0)
    c.setComment('Долго')
    c.submitComment()
    pending[0].reject(new Error('fail'))
    await tick()
    expect(state()).toMatchObject({ error: true, comment: 'Долго', followUp: 'Что нам улучшить?', thanks: null, canSubmitComment: true })
  })

  test('a rate from the feed without a comment asks again (the scale takes no taps); with a comment — success', async () => {
    const asked = mount(withQuestion({ answer: { rate: 5, comment: null } }))
    expect(asked.state()).toMatchObject({ mode: 'answered', followUp: 'Что нам улучшить?', field: 'comment' })
    expect(await asked.c.rate(1)).toBe(false)
    expect(asked.calls).toHaveLength(0)
    expect(mount(withQuestion({ answer: { rate: 5, comment: 'Долго' } })).state()).toMatchObject({
      followUp: null,
      field: null,
      thanks: 'Спасибо, мы станем лучше',
    })
  })

  test('the comment is cut at 5000 UTF-16 units', () => {
    const { c, state } = mount(withQuestion({ answer: { rate: 1 } }))
    c.setComment('я'.repeat(STORY_POLL_COMMENT_LIMIT + 10))
    expect(state().comment).toHaveLength(STORY_POLL_COMMENT_LIMIT)
    expect(state().commentCounter).toBe('5000/5000')
  })

  test('re-answering sends the new rate without a comment, so the question comes back', async () => {
    const { c, state, calls, pending } = mount(withQuestion({ answer: { rate: 2, comment: 'Долго' }, allow_reanswer: true }))
    expect(state()).toMatchObject({ followUp: null, canReanswer: true })
    c.reanswer()
    c.rate(4)
    expect(calls[0].args[1]).not.toHaveProperty('comment')
    pending[0].resolve({})
    await tick()
    expect(state()).toMatchObject({ rate: 4, followUp: 'Что нам улучшить?', canReanswer: true })
  })

  test('the follow-up button: labels > host > the built-in English "Send" of JS', () => {
    expect(mount(withQuestion({ answer: { rate: 1 } })).state().commentSubmitLabel).toBe('Send')
    expect(mount(withQuestion({ answer: { rate: 1 } }), { texts: { submit: 'Готово' } }).state().commentSubmitLabel).toBe('Готово')
    const labelled = withQuestion({ answer: { rate: 1 }, labels: { submit: 'Ответить' } })
    expect(mount(labelled, { texts: { submit: 'Готово' } }).state().commentSubmitLabel).toBe('Ответить')
  })

  test('the question of the band: trimmed, blank or none — null', () => {
    expect(storyPollBandQuestion({ bands: [{ from: 0, to: 6, question: ' Что улучшить? ' }] }, 6)).toBe('Что улучшить?')
    expect(storyPollBandQuestion(withQuestion(), 8)).toBeNull()
    expect(storyPollBandQuestion(withQuestion(), 10)).toBeNull()
    expect(storyPollBandQuestion({ bands: null }, 1)).toBeNull()
    expect(storyPollBandQuestion(withQuestion(), null)).toBeNull()
  })

  test('the timer stays paused while the comment field is focused or the comment is sent', async () => {
    const { c, events, pending } = mount(withQuestion({ answer: { rate: 1 } }))
    c.focus(true)
    c.setComment('a')
    expect(events).toEqual(['pause'])
    c.submitComment()
    c.focus(false)
    expect(events).toEqual(['pause'])
    pending[0].resolve({})
    await tick()
    expect(events).toEqual(['pause', 'resume'])
  })
})

describe('Stories polls — texts (P6, as JS DEFAULT_POLL_TEXTS)', () => {
  test('the built-in texts are the three English constants of JS, whatever the device language', () => {
    expect(STORY_POLL_DEFAULT_TEXTS).toEqual({ reanswer: 'Answer again', error: 'Failed to send the answer. Please try again', submit: 'Send' })
    expect(storyPollTexts(null, null)).toEqual(STORY_POLL_DEFAULT_TEXTS)
    expect(storyPollTexts({ submit: 'Go' }, { reanswer: 'Снова' })).toEqual({ reanswer: 'Снова', error: STORY_POLL_DEFAULT_TEXTS.error, submit: 'Go' })
    // Язык устройства не читается: и в русской локали — английские.
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({ resolvedOptions: () => ({ locale: 'ru-RU' }) }))
    expect(storyPollTexts(null, null)).toEqual(STORY_POLL_DEFAULT_TEXTS)
  })

  test('the card without host texts or labels: English texts, submit_label first for the button', () => {
    const state = mount(miniPoll('multiple_choice', {}, { submit_label: null })).state()
    expect(state.texts).toEqual(STORY_POLL_DEFAULT_TEXTS)
    expect(state.submitLabel).toBe('Send')
    expect(mount(miniPoll('multiple_choice', {}, { submit_label: 'Выбрать' })).state().submitLabel).toBe('Выбрать')
  })
})

describe('Stories polls — card view', () => {
  test('option letters A, B, C…; after Z — the number', () => {
    expect([0, 1, 2, 25, 26].map(storyPollOptionLetter)).toEqual(['A', 'B', 'C', 'Z', '27'])
  })

  test('text and icons on a fill — one rule for the button, the check and the scale value: white or dark, whichever contrasts more', () => {
    // Цвет выбора #22C55E: тёмный ≈ 9:1 против 2,3:1 у белого; Danger кита — белый, Warning — тёмный.
    expect(storyPollTextOn('#22C55E')).toBe('dark')
    expect(storyPollTextOn('#E51919')).toBe('light')
    expect(storyPollTextOn('#F37A17')).toBe('dark')
    expect(['#000000', '#0F3D2A', '#DC2626'].map(storyPollTextOn)).toEqual(['light', 'light', 'light'])
    // Синий кита #007DF2 (≈ 0,21) — уже тёмный: 5,2:1 против 4,0:1.
    expect(storyPollTextOn('#007DF2')).toBe('dark')
    expect(storyPollTextOn('#FFFFFF')).toBe('dark')
    // Равный контраст — у яркости ≈ 0,179: #767676 (≈ 0,181) — тёмный, #757575 (≈ 0,178) — белый.
    expect(storyPollTextOn('#767676')).toBe('dark')
    expect(storyPollTextOn('#757575')).toBe('light')
    expect(storyPollTextOn('red')).toBe('dark')
  })

  test('the top of the card as JS #277: y_offset % of the slide, lifted 16 above its bottom, never above its top', () => {
    expect(storyPollFittedTop(50, 800, 300)).toBe(400)
    expect(storyPollFittedTop(50, 800, 0)).toBe(400)
    expect(storyPollFittedTop(80, 800, 400)).toBe(800 - 400 - 16)
    expect(storyPollFittedTop(60, 300, 400)).toBe(0)
    expect(storyPollFittedTop(140, 800, 0)).toBe(800)
    expect(storyPollFittedTop(-10, 800, 100)).toBe(0)
    // Безопасная зона: не под вырезом и не под полоской «домой».
    const insets = { top: 50, bottom: 34 }
    expect(storyPollFittedTop(0, 800, 100, insets)).toBe(50)
    expect(storyPollFittedTop(90, 800, 100, insets)).toBe(800 - 34 - 100 - 16)
    expect(storyPollFittedTop(50, 800, 900, insets)).toBe(50)
    // Нижний ряд (звук, «товары») виден — низ карточки на 16 над ним, а не над низом зоны.
    expect(storyPollFittedTop(90, 800, 100, insets, 16, 700)).toBe(700 - 100 - 16)
    expect(storyPollFittedTop(10, 800, 100, insets, 16, 700)).toBe(80)
    expect(storyPollFittedTop(50, 800, 900, insets, 16, 700)).toBe(50)
    expect(storyPollLowerEdge(800, insets, null)).toBe(800 - 34)
    expect(storyPollLowerEdge(800, insets, 700)).toBe(700)
    expect(storyPollLowerEdge(800, insets, 10)).toBe(50)
  })

  test('the card keeps 16 from the sides and is at most 420 wide', () => {
    expect(STORY_POLL_STYLE.sideMargin).toBe(16)
    expect(STORY_POLL_STYLE.maxWidth).toBe(420)
  })
})

describe('Stories polls — POLL pause of the viewer', () => {
  const stories = [{ id: 40, slides: [{ id: 1 }, { id: 2 }] }]
  const act = (state, action) => storyViewerReducer(state, { stories, seen: {}, canPlayVideo: true, ...action })
  const open = () => act(STORY_VIEWER_CLOSED, { type: 'open', index: 0 })

  test('stops the clock and is lifted on the next slide, on retry, on close', () => {
    const held = act(open(), { type: 'pause', reason: STORY_PAUSE.POLL })
    expect(isStoryClockRunning(held)).toBe(false)
    expect(held.pauses).toEqual(['poll'])
    expect(act(held, { type: 'resume', reason: STORY_PAUSE.POLL }).pauses).toEqual([])
    expect(act(held, { type: 'tap', zone: 'next' })).toMatchObject({ slide: 1, pauses: [] })
    expect(act(held, { type: 'ended' }).pauses).toEqual([])
    const failed = act(held, { type: 'mediaFailed' })
    expect(act(failed, { type: 'retry' }).pauses).not.toContain('poll')
    expect(act(held, { type: 'reset' }).pauses).toEqual([])
  })

  test('stays on a restart of the same slide (the card is still there)', () => {
    const held = act(open(), { type: 'pause', reason: STORY_PAUSE.POLL })
    const restarted = act(held, { type: 'tap', zone: 'previous' })
    expect(restarted.epoch).toBe(held.epoch + 1)
    expect(restarted.pauses).toEqual(['poll'])
  })
})
