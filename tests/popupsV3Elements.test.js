import { normalizePopupDesign } from '../lib/popupsV3/design'
import { popupTexts } from '../lib/popupsV3/texts'
import PopupV3Element, { PopupV3KitScheme } from '../components/PopupsV3/PopupV3Elements'
import { PopupV3ButtonElement } from '../components/PopupsV3/PopupV3Basic'

// Попапы v3: элементы без рендера — что делает нажатие (событие `click`, затем ссылка через запись
// движка) и по какому фону кит внутри элемента выбирает схему. Сам выбор схемы —
// `popupKitScheme` (popupsV3Values.test.js), закрытие после ссылки — движок (popupsV3Engine.test.js).

const RU = popupTexts('ru')

/** Один элемент `type` со стилем `style` в рамке `frameStyle`, как его видит рендер. */
const elementOf = (type, style) => {
  const design = {
    rows: [{ id: 'row', columns: [100], cells: [{}] }],
    elements: [{ id: 'el', type, rowId: 'row', partIndex: 0, style }],
  }
  return normalizePopupDesign(design, { os: 'android', texts: RU }).rows[0].cells[0].elements[0]
}

/** Запись движка, которая только записывает вызовы. */
const recordingEntry = () => {
  const calls = []
  return {
    calls,
    entry: {
      event: (name) => calls.push(['event', name]),
      openLink: (url) => calls.push(['openLink', url]),
      close: () => calls.push(['close']),
    },
  }
}

describe('Popups v3 elements — links', () => {
  test('a link button: click, then the link through the entry (the host hook decides there)', () => {
    const { calls, entry } = recordingEntry()
    const button = elementOf('button', { buttonText: 'Запустить игру', buttonAction: 'link', buttonHref: 'personaClick://game' })
    const tree = PopupV3ButtonElement({ element: button, context: { entry, runtime: {}, texts: RU } })
    tree.props.children.props.onPress()
    expect(calls).toEqual([
      ['event', 'click'],
      ['openLink', 'personaClick://game'],
    ])
  })

  test('a link on the whole element: click, then the link', () => {
    const { calls, entry } = recordingEntry()
    const text = elementOf('text', { message: 'Играть', linkHref: 'personaClick://game' })
    const tree = PopupV3Element({ element: text, cellAlign: 'left', context: { entry, runtime: {}, texts: RU, frameBg: '#ffffffff' } })
    tree.props.onPress()
    expect(calls).toEqual([
      ['event', 'click'],
      ['openLink', 'personaClick://game'],
    ])
  })
})

describe('Popups v3 elements — the kit inside follows the popup, not the system', () => {
  const backdropOf = (element, frameBg) => {
    const tree = PopupV3Element({ element, cellAlign: 'left', context: { entry: {}, runtime: {}, texts: RU, frameBg } })
    const scheme = tree.props.children
    expect(scheme.type).toBe(PopupV3KitScheme)
    return scheme.props.backdrop
  }

  test('recommendations (a transparent box) — on the frame: white, dark, none — white', () => {
    const recommendation = elementOf('recommendation', { recommenderCode: 'e4bceaa2a37cdc9f1d995b8862b4fe2a', bgColor: '#111827' })
    expect(backdropOf(recommendation, '#ffffffff')).toBe('#ffffffff')
    expect(backdropOf(recommendation, '#111827ff')).toBe('#111827ff')
    expect(backdropOf(recommendation, undefined)).toBe('#ffffffff')
  })

  test("an element's own background wins over the frame's", () => {
    expect(backdropOf(elementOf('box', { message: 'x', bgColor: '#0f172a' }), '#ffffffff')).toBe('#0f172aff')
    expect(backdropOf(elementOf('emailCollector', {}), '#111827ff')).toBe('#ffffffff')
    expect(backdropOf(elementOf('text', { message: 'x', bgColor: 'transparent' }), '#111827ff')).toBe('#111827ff')
  })
})
