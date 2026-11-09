import fs from 'fs'
import path from 'path'
import { activeStoriesShow, attachStoriesShowHost } from '../components/widgets/storiesShow'

// Шлюз v3: попапы v3 и сторис на API v3 (лента v3, «Поделиться», опросы) — только из internal/v3.
// Корень пакета и кит (ui) их не экспортируют, сторис кита пропсы v3 отбрасывают, просмотр
// кита не рисует «Поделиться», в типах корня и кита v3 не упоминается. Слот «Поделиться» шапки
// (PersonalizationStoryNavigation) остаётся в ките: там всё решает хост.

const root = require('../index.js')
const ui = require('../ui')
const v3 = require('../internal/v3')
const pkg = require('../package.json')

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

/** Пропсы v3 со значениями: общие у сторис и просмотра, плюс свои у каждого. */
const COMMON_V3_PROPS = {
  shareLabel: 'Share it',
  shareUrlTransform: (url) => url,
  pollTransport: { answerMiniPoll: () => Promise.resolve({}), review: () => Promise.resolve({}) },
  pollReanswerText: 'Again',
  pollSubmitText: 'Send',
  pollErrorText: 'Failed',
}
const STORIES_V3_PROPS = { ...COMMON_V3_PROPS, apiV3Domain: 'app.personaClick.ru' }
const VIEWER_V3_PROPS = { ...COMMON_V3_PROPS, onShare: () => {}, pollShopId: 'shop' }

/** Имена v3, которых нет нигде в типах корня и кита (`onShare` / `shareLabel` есть у шапки кита). */
const TYPED_V3_NAMES = [
  'PersonalizationPopups',
  'handleLink',
  'PersonalizationStoryPollTransport',
  'apiV3Domain',
  'shareUrlTransform',
  'pollTransport',
  'pollShopId',
  'pollReanswerText',
  'pollSubmitText',
  'pollErrorText',
  'share_url',
  'shareable',
]

/** Тело `export interface <name> … { … }` из d.ts. */
const block = (text, name) => {
  const start = text.indexOf(`export interface ${name} `)
  return start < 0 ? '' : text.slice(start, text.indexOf('\n}', start) + 2)
}

describe('v3 gate — exports', () => {
  test('internal/v3 exports popups v3 and the stories with v3', () => {
    expect(typeof v3.PersonalizationPopups.of).toBe('function')
    expect(v3.PersonalizationStories.$$typeof).toBe(Symbol.for('react.forward_ref'))
    expect(typeof v3.PersonalizationStories.handleLink).toBe('function')
    expect(typeof v3.PersonalizationStories.show).toBe('function')
    expect(Object.keys(v3.PersonalizationStories)).toContain('apiV3Domain')
    expect(typeof v3.PersonalizationStoryViewer).toBe('function')
  })

  test('the package root exports nothing of v3', () => {
    ['PersonalizationPopups', 'PersonalizationStories', 'PersonalizationStoryViewer'].forEach((name) => {
      expect(root[name]).toBeUndefined()
      expect(root.default[name]).toBeUndefined()
    })
  })

  test('the kit exports no popups v3, its stories have no v3 statics', () => {
    expect(ui.PersonalizationPopups).toBeUndefined()
    expect(ui.PersonalizationStories).not.toBe(v3.PersonalizationStories)
    expect(typeof ui.PersonalizationStories.show).toBe('function')
    expect('apiV3Domain' in ui.PersonalizationStories).toBe(false)
    expect(ui.PersonalizationStories.handleLink).toBeUndefined()
    expect(ui.PersonalizationStoryViewer).not.toBe(v3.PersonalizationStoryViewer)
  })

  test('package.json maps the subpath to the gate files', () => {
    expect(pkg.exports['./internal/v3']).toEqual({ types: './internal/v3.d.ts', default: './internal/v3.js' })
    expect(fs.existsSync(path.join(__dirname, '..', 'internal/v3.d.ts'))).toBe(true)
  })

  test('typings: v3 only in v3.d.ts', () => {
    ;['index.d.ts', 'stories.d.ts', 'ui.d.ts'].forEach((file) => {
      const text = read(file)
      const names = TYPED_V3_NAMES.filter((name) => text.includes(name))
      expect({ file, v3: /v3/i.test(text), names }).toEqual({ file, v3: false, names: [] })
    })
    const typings = read('internal/v3.d.ts')
    ;[...TYPED_V3_NAMES, 'onShare', 'shareLabel'].forEach((name) => expect(typings).toContain(name))
  })

  test('typings: the kit viewer and texts have no share, the header keeps its share slot', () => {
    const kit = read('ui.d.ts')
    const texts = block(kit, 'PersonalizationStoriesTexts')
    const viewer = block(kit, 'PersonalizationStoryViewerProps')
    const header = block(kit, 'PersonalizationStoryNavigationProps')
    expect(texts).toContain('closeLabel')
    expect(texts).not.toContain('shareLabel')
    expect(viewer).toContain('onPromoCopied')
    expect(viewer).not.toContain('onShare')
    expect(header).toContain('onShare?: (anchor: number | null) => void')
    expect(header).toContain('shareLabel?: string')
  })
})

describe('v3 gate — the kit drops v3 props', () => {
  test('the kit stories widget renders the full one without v3 props', () => {
    const element = ui.PersonalizationStories.render({ code: 'c', shopId: 's', bar: false, ...STORIES_V3_PROPS, preloaded: {} }, null)
    expect(element.type).toBe(v3.PersonalizationStories)
    expect(element.props).toMatchObject({ code: 'c', shopId: 's', bar: false })
    ;[...Object.keys(STORIES_V3_PROPS), 'preloaded'].forEach((name) => expect(element.props).not.toHaveProperty(name))
  })

  test('show() of the kit drops v3 options, show() of v3 keeps them', () => {
    const detach = attachStoriesShowHost(() => {})
    try {
      ui.PersonalizationStories.show({ code: 'c', startStoryId: 1, ...STORIES_V3_PROPS, shared: 'link' })
      const kit = activeStoriesShow().options
      expect(kit).toMatchObject({ code: 'c', startStoryId: 1 })
      ;[...Object.keys(STORIES_V3_PROPS), 'shared'].forEach((name) => expect(kit).not.toHaveProperty(name))
      activeStoriesShow().finish()

      v3.PersonalizationStories.show({ code: 'c', ...STORIES_V3_PROPS })
      expect(activeStoriesShow().options).toMatchObject({ apiV3Domain: 'app.personaClick.ru', pollSubmitText: 'Send' })
      activeStoriesShow().finish()
    } finally {
      detach()
    }
  })

  test('the kit viewer renders the full one without share and polls, the share button off', () => {
    const element = ui.PersonalizationStoryViewer({ visible: false, stories: [], closeLabel: 'Close', withShare: true, ...VIEWER_V3_PROPS })
    expect(element.type).toBe(v3.PersonalizationStoryViewer)
    expect(element.props).toMatchObject({ visible: false, closeLabel: 'Close', withShare: false })
    Object.keys(VIEWER_V3_PROPS).forEach((name) => expect(element.props).not.toHaveProperty(name))
  })
})
