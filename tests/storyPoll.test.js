import {
  STORY_POLL_DEFAULT_TEXTS,
  STORY_POLL_RESULT_TEXTS,
  createStoryPollController,
  hasStoryPollAnswer,
  parseStoryPoll,
  resetStoryPollAnswers,
  saveStoryPollAnswer,
  slidePolls,
  storyPollAnswerBody,
  storyPollBandText,
  storyPollCutText,
  storyPollLanguage,
  storyPollOptionLetter,
  storyPollResultTexts,
  storyPollReviewBody,
  storyPollSavedAnswer,
  storyPollScaleColor,
  storyPollScaleFill,
  storyPollScaleRange,
  storyPollTextOn,
  storyPollTexts,
  storyPollTop,
  storyPollVotes,
} from '../components/design-system/storyPollSupport'
import { STORY_PAUSE, STORY_VIEWER_CLOSED, isStoryClockRunning, storyViewerReducer } from '../components/design-system/storyViewerState'

// Опросы на слайдах сторис V2 (API v3): кейсы `create-poll.test.ts` JS SDK на контроллере карточки,
// разбор общей фикстуры, шкала, тексты, ответы сессии и пауза POLL просмотра.

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
    shopId: 'shop',
    onHold: (on) => events.push(on ? 'pause' : 'resume'),
    ...extra,
  })
  return { c: controller, state: () => controller.state(), events, ...t }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  resetStoryPollAnswers()
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
    expect(answered.answer).toEqual({ id: 77, option_ids: [2], text: null, rate: null })
    expect(answered.results).toEqual({ total: 120, options: [{ id: 1, percent: 40 }, { id: 2, percent: 60 }] })
    expect(hasStoryPollAnswer(answered.answer)).toBe(true)
    expect(hasStoryPollAnswer(single.answer)).toBe(false)
  })

  test('answered: non-empty option_ids, non-empty text or a numeric rate', () => {
    const answered = (answer) => hasStoryPollAnswer(parseStoryPoll({ type: 'poll', poll_type: 'nps', poll: {}, answer }).answer)
    expect([{ option_ids: [1] }, { text: ' ' }, { rate: 0 }, { rate: '9' }, { rate: 7.5 }].map(answered)).toEqual([true, true, true, true, true])
    expect([null, {}, { option_ids: [] }, { option_ids: ['x'] }, { text: '' }, { rate: null }, { rate: 'abc' }].map(answered)).toEqual(
      Array(7).fill(false),
    )
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
      expect(mount(poll).state()).toMatchObject({ mode: 'form', counter: null, thanks: null, submitLabel: 'Send', texts: STORY_POLL_DEFAULT_TEXTS })
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
    expect(storyPollSavedAnswer('shop', poll)).toMatchObject({ answer: { option_ids: [1] } })
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
      { method: 'answerMiniPoll', args: ['gift_recipient', { option_ids: [2], story_id: 5, slide_id: '101' }] },
    ])
    expect(state()).toMatchObject({ sending: true, selected: [2] })

    pending[0].resolve({
      answer: { id: 77, option_ids: [2], text: null },
      results: { total: 121, options: [{ id: 1, percent: 40 }, { id: 2, percent: 60 }] },
    })
    await tick()
    expect(state()).toMatchObject({ mode: 'answered', sending: false, selected: [2], thanks: 'Спасибо!', canReanswer: false })
    expect(state().percents).toEqual({ 1: 40, 2: 60, 3: 0 })
    expect(state().total).toBe(121)
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

    // Другой магазин: ответ первого уже в ответах сессии.
    const nullAnswer = mount(miniPoll('single_choice'), { shopId: 'other' })
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
    expect(storyPollSavedAnswer('shop', miniPoll('single_choice')).answer).toMatchObject({ id: 77, option_ids: [2] })
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
    expect(calls[0].args).toEqual(['gift_recipient', { option_ids: [1, 3], story_id: 5, slide_id: '101' }])
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
    expect(mount(miniPoll('multiple_choice', {}, { submit_label: null })).state().submitLabel).toBe(STORY_POLL_DEFAULT_TEXTS.submit)
    expect(mount(miniPoll('text', {}, { submit_label: '' }), { texts: { submit: 'Готово' } }).state().submitLabel).toBe('Готово')
    const labelled = miniPoll('multiple_choice', { labels: { submit: 'Ответить' } }, { submit_label: null })
    expect(mount(labelled, { texts: { submit: 'Готово' } }).state().submitLabel).toBe('Ответить')
    expect(mount(miniPoll('multiple_choice', { labels: { submit: 'Ответить' } })).state().submitLabel).toBe('Отправить')
  })

  test('the default submit label and texts: defaults < host < labels', () => {
    expect(mount(miniPoll('multiple_choice', {}, { submit_label: null })).state().texts.submit).toBe(STORY_POLL_DEFAULT_TEXTS.submit)
    expect(storyPollTexts(null, null)).toEqual({ reanswer: 'Answer again', error: 'Failed to send the answer. Please try again', submit: 'Send' })
    expect(storyPollTexts({ reanswer: 'Ещё раз', error: '' }, { reanswer: 'Снова' })).toEqual({
      reanswer: 'Снова',
      error: STORY_POLL_DEFAULT_TEXTS.error,
      submit: 'Send',
    })
    expect(storyPollTexts({ submit: 'Отправить' }, { submit: '' }).submit).toBe('Отправить')
    expect(storyPollTexts({ submit: 'Отправить' }, 'labels').submit).toBe('Отправить')
    // Пустой текст хоста умолчание не перекрывает, строка из пробелов — перекрывает.
    expect(storyPollTexts({ reanswer: '', error: ' ', submit: null }, null)).toEqual({
      reanswer: STORY_POLL_DEFAULT_TEXTS.reanswer,
      error: ' ',
      submit: STORY_POLL_DEFAULT_TEXTS.submit,
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
    expect(calls[0].args).toEqual(['gift_recipient', { text: 'Мастер и', story_id: 5, slide_id: '101' }])
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
    expect(calls[0]).toEqual({ method: 'review', args: ['nps', { channel: 'stories', category: 'delivery', rate: 9 }] })
    expect(state()).toMatchObject({ rate: 9, sending: true })
    pending[0].resolve({ answer: null, results: null })
    await tick()
    expect(state()).toMatchObject({ mode: 'answered', rate: 9, thanks: 'Спасибо, рады стараться!' })
  })

  test('CSAT 1..5 and CES 1..7 go with campaign; no channel — "stories"', async () => {
    const csat = mount(scalePoll('csat', {}, { bands: [{ from: 1, to: 3, success: 'Жаль' }, { from: 4, to: 5, success: 'Ура' }] }))
    csat.c.rate(1)
    expect(csat.calls[0].args).toEqual(['csat', { channel: 'stories', campaign: 'delivery', rate: 1 }])
    csat.pending[0].resolve({})
    await tick()
    expect(csat.state().thanks).toBe('Жаль')

    const ces = mount(scalePoll('ces', {}, { channel: null }))
    ces.c.rate(7)
    expect(ces.calls[0].args).toEqual(['ces', { channel: 'stories', campaign: 'delivery', rate: 7 }])
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

  test('colors: NPS detractors, passives and promoters; other scales by thirds', () => {
    const nps = [0, 3, 6, 7, 8, 9, 10].map((value) => storyPollScaleColor('nps', value, 0, 10))
    expect(nps).toEqual(['#FCA5A5', '#FDBA74', '#FCD34D', '#FDE68A', '#FDE68A', '#86EFAC', '#86EFAC'])
    expect([1, 2, 3, 4, 5].map((value) => storyPollScaleColor('csat', value, 1, 5))).toEqual([
      '#FCA5A5',
      '#FCA5A5',
      '#FDE68A',
      '#86EFAC',
      '#86EFAC',
    ])
    expect(storyPollScaleColor('nps', 3, 1, 5)).toBe('#FDE68A')
    expect(storyPollScaleColor('ces', 4, 4, 4)).toBe('#86EFAC')
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
    expect(calls[0].args).toEqual(['gift_recipient', { option_ids: [3], story_id: 5, slide_id: '101' }])
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
    expect(mount(miniPoll('single_choice', answered)).state().texts.reanswer).toBe(STORY_POLL_DEFAULT_TEXTS.reanswer)
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

  test('an answer after the card is gone only goes to the session answers', async () => {
    const changes = []
    const first = mount(miniPoll('single_choice'), { onChange: (state) => changes.push(state.mode) })
    first.c.choose(2)
    first.c.detach()
    const count = changes.length
    first.pending[0].resolve({ answer: { option_ids: [2] }, results: { total: 1, options: [{ id: 2, percent: 100 }] } })
    await tick()
    expect(changes).toHaveLength(count)
    expect(first.events).toEqual(['pause'])
    expect(storyPollSavedAnswer('shop', miniPoll('single_choice'))).toEqual({
      answer: { option_ids: [2], text: null, rate: null },
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
    expect(storyPollSavedAnswer('shop', miniPoll('single_choice'))).toBeNull()
  })
})

describe('Stories polls — session answers', () => {
  test('the session answer wins over the feed; shops and kinds do not mix', async () => {
    const feedAnswer = { answer: { option_ids: [2] }, results: null }
    saveStoryPollAnswer('shop', miniPoll('single_choice'), { answer: { option_ids: [1] }, results: null })
    expect(mount(miniPoll('single_choice', feedAnswer)).state().selected).toEqual([1])
    expect(mount(miniPoll('single_choice', feedAnswer), { shopId: 'other' }).state().selected).toEqual([2])
    expect(storyPollSavedAnswer('shop', scalePoll('nps', {}, { code: 'gift_recipient' }))).toBeNull()

    const { c, pending } = mount(scalePoll('csat'))
    c.rate(4)
    pending[0].resolve({})
    await tick()
    expect(storyPollSavedAnswer('shop', scalePoll('csat'))).toEqual({ answer: { option_ids: null, text: null, rate: 4 }, results: null })
    resetStoryPollAnswers()
    expect(storyPollSavedAnswer('shop', scalePoll('csat'))).toBeNull()
  })

  test('a card from a session record is always answered, even if the answer selects nothing', () => {
    saveStoryPollAnswer('shop', miniPoll('single_choice'), { answer: { id: 77, option_ids: null, text: null, rate: null }, results: null })
    expect(mount(miniPoll('single_choice')).state()).toMatchObject({ mode: 'answered', selected: [], thanks: 'Спасибо!' })
    saveStoryPollAnswer('shop', miniPoll('text'), { answer: null, results: null })
    expect(mount(miniPoll('text')).state()).toMatchObject({ mode: 'answered', answerText: null })
    // Без записи — по ответу ленты.
    expect(mount(miniPoll('multiple_choice', { answer: { id: 1 } }, { code: 'other' })).state().mode).toBe('form')
  })

  test('a send answered with an empty answer stays answered when the card comes back', async () => {
    const first = mount(miniPoll('single_choice', { allow_reanswer: true }))
    first.c.choose(2)
    first.pending[0].resolve({ answer: { id: 77 }, results: null })
    await tick()
    expect(first.state()).toMatchObject({ mode: 'answered', selected: [], canReanswer: true })
    expect(mount(miniPoll('single_choice', { allow_reanswer: true })).state()).toMatchObject({ mode: 'answered', canReanswer: true })
  })

  test('request bodies: story id a number, slide id always a string', () => {
    expect(storyPollAnswerBody({ option_ids: [1] }, '39', '39_0')).toEqual({ option_ids: [1], story_id: 39, slide_id: '39_0' })
    expect(storyPollAnswerBody({ text: 'a' }, 40, 76)).toEqual({ text: 'a', story_id: 40, slide_id: '76' })
  })
})

describe('Stories polls — card view', () => {
  test('votes: Russian forms голос / голоса / голосов, English vote / votes, grouped digits', () => {
    const ru = (n) => storyPollVotes(n, 'ru')
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 112, 1001].map(ru)).toEqual([
      '1\u00a0голос',
      '2\u00a0голоса',
      '4\u00a0голоса',
      '5\u00a0голосов',
      '11\u00a0голосов',
      '12\u00a0голосов',
      '14\u00a0голосов',
      '21\u00a0голос',
      '22\u00a0голоса',
      '25\u00a0голосов',
      '101\u00a0голос',
      '111\u00a0голосов',
      '112\u00a0голосов',
      '1\u00a0001\u00a0голос',
    ])
    expect(ru(1248)).toBe('1\u00a0248\u00a0голосов')
    expect(ru(1234567)).toBe('1\u00a0234\u00a0567\u00a0голосов')
    expect(storyPollVotes(1, 'en')).toBe('1\u00a0vote')
    expect(storyPollVotes(2, 'en')).toBe('2\u00a0votes')
    expect(storyPollVotes(1248, 'en')).toBe('1,248\u00a0votes')
    expect(storyPollVotes(21, 'de')).toBe('21\u00a0votes')
    expect(storyPollVotes(121.4, 'ru')).toBe('121\u00a0голос')
  })

  test('no votes, zero or not a number — no vote count', () => {
    ;[0, -3, null, undefined, NaN, 'abc'].forEach((total) => {
      expect(storyPollVotes(total, 'ru')).toBeNull()
      expect(storyPollVotes(total, 'en')).toBeNull()
    })
  })

  test('result texts in Russian and English by the device language; another language — English', () => {
    expect(storyPollResultTexts('ru')).toMatchObject({ results: 'Результаты', thanks: 'Спасибо!', counted: 'Голос учтён' })
    expect(storyPollResultTexts('en')).toMatchObject({ results: 'Results', thanks: 'Thanks!', counted: 'Vote counted' })
    expect(storyPollResultTexts('de')).toBe(STORY_POLL_RESULT_TEXTS.en)
    const spy = (locale) => jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({ resolvedOptions: () => ({ locale }) }))
    spy('ru-RU')
    expect(storyPollLanguage()).toBe('ru')
    jest.restoreAllMocks()
    spy('en-US')
    expect(storyPollLanguage()).toBe('en')
  })

  test('the total of results comes with the answered choice only', async () => {
    expect(mount(miniPoll('single_choice')).state().total).toBeNull()
    const fed = mount(miniPoll('multiple_choice', { answer: { option_ids: [1] }, results: { total: '7', options: [{ id: 1, percent: 100 }] } }))
    expect(fed.state()).toMatchObject({ mode: 'answered', total: 7 })
    expect(mount(miniPoll('single_choice', { answer: { option_ids: [1] } })).state().total).toBeNull()
  })

  test('option letters A, B, C…; after Z — the number', () => {
    expect([0, 1, 2, 25, 26].map(storyPollOptionLetter)).toEqual(['A', 'B', 'C', 'Z', '27'])
  })

  test('the selected scale value: the color of its band; outside the bands or no bands — none (the accent)', () => {
    const poll = scalePoll('csat', {}, { rate_min: 1, rate_max: 5, bands: [{ from: 1, to: 2, success: 'a' }, { from: 4, to: 5, success: 'b' }] })
    expect(storyPollScaleFill(poll, 1, 1, 5)).toBe(storyPollScaleColor('csat', 1, 1, 5))
    expect(storyPollScaleFill(poll, 5, 1, 5)).toBe('#86EFAC')
    expect(storyPollScaleFill(poll, 3, 1, 5)).toBeNull()
    expect(storyPollScaleFill(scalePoll('nps', {}, { bands: null }), 9, 0, 10)).toBeNull()
  })

  test('text and icons on a fill — one rule for the button, the check and the scale value: white or dark, whichever contrasts more', () => {
    // Цвет выбора #22C55E: тёмный ≈ 9:1 против 2,3:1 у белого; пастель шкалы — тёмный; тёмные заливки — белый.
    expect(storyPollTextOn('#22C55E')).toBe('dark')
    expect(['#FCA5A5', '#FDBA74', '#FCD34D', '#FDE68A', '#86EFAC'].map(storyPollTextOn)).toEqual(['dark', 'dark', 'dark', 'dark', 'dark'])
    expect(['#000000', '#0F3D2A', '#DC2626'].map(storyPollTextOn)).toEqual(['light', 'light', 'light'])
    // Синий кита #007DF2 (≈ 0,21) — уже тёмный: 5,2:1 против 4,0:1.
    expect(storyPollTextOn('#007DF2')).toBe('dark')
    expect(storyPollTextOn('#FFFFFF')).toBe('dark')
    // Равный контраст — у яркости ≈ 0,179: #767676 (≈ 0,181) — тёмный, #757575 (≈ 0,178) — белый.
    expect(storyPollTextOn('#767676')).toBe('dark')
    expect(storyPollTextOn('#757575')).toBe('light')
    expect(storyPollTextOn('red')).toBe('dark')
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
