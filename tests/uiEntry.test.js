import fs from 'fs'
import path from 'path'

// Кит — публичная точка входа '@personaClick/react-native-sdk/ui' (карта `exports`). Корень пакета UI не
// экспортирует, как и сторис ('./stories'): приложение без своего UI кит не собирает.

const root = require('../index.js')
const ui = require('../ui')
const pkg = require('../package.json')

const exists = (file) => fs.existsSync(path.join(__dirname, '..', file))

describe('UI kit entry', () => {
  test('package.json maps ./ui to the kit files, internal/ui is gone', () => {
    expect(pkg.exports['./ui']).toEqual({ types: './ui.d.ts', default: './ui.js' })
    expect(pkg.exports['./internal/ui']).toBeUndefined()
    expect(['ui.js', 'ui.d.ts'].filter(exists)).toEqual(['ui.js', 'ui.d.ts'])
    expect(['internal/ui.js', 'internal/ui.d.ts'].filter(exists)).toEqual([])
  })

  test('the kit exports tokens, theme, components and widgets; the root none of them', () => {
    ;[
      'PERSONALIZATION_COLORS',
      'PersonalizationThemeProvider',
      'PersonalizationButton',
      'PersonalizationStoryViewer',
      'PersonalizationSearchResultsScreen',
      'PersonalizationStories',
    ].forEach((name) => {
      expect({ name, kit: ui[name] !== undefined }).toEqual({ name, kit: true })
      expect({ name, root: root[name], personaClick: root.default[name] }).toEqual({ name, root: undefined, personaClick: undefined })
    })
  })
})
