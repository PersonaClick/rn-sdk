import React, { createContext, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { PERSONALIZATION_COLORS } from '../constants/colors.constants'
import { PERSONALIZATION_RADIUS } from '../constants/radius.constants'
import { PERSONALIZATION_TYPOGRAPHY } from '../constants/typography.constants'

/**
 * Тема дизайн-системы: то, что хост может подменить под свой бренд.
 *
 * ```jsx
 * <PersonalizationThemeProvider
 *   theme={{
 *     colors: { light: { brandPrimary: '#7C3AED' }, dark: { brandPrimary: '#A78BFA' } },
 *     radius: { xl: 16 },
 *     fontFamily: { regular: 'Inter-Regular', emphasized: 'Inter-SemiBold' },
 *   }}
 * >
 *   <App />
 * </PersonalizationThemeProvider>
 * ```
 *
 * Переопределение частичное: незаданные токены остаются значениями из макета.
 * Цвета задаются по схемам отдельно — тёмная не выводится из светлой сама,
 * и набор, заданный только для light, в тёмной схеме ничего не поменяет.
 *
 * Темизуются цвета, радиусы и шрифт — поверхность брендирования. Отступы, тени
 * и кегли остаются константами: это шкала макета, менять её не предполагается.
 *
 * Провайдер можно вкладывать: разным магазинам в одном приложении можно дать
 * разный брендинг, обернув поддеревья по отдельности.
 */
const PersonalizationThemeContext = createContext(null)

const EMPTY = {}

/** @param {{ theme?: object, children?: React.ReactNode }} props */
export function PersonalizationThemeProvider({ theme, children }) {
  const parent = useContext(PersonalizationThemeContext)
  const value = useMemo(() => mergeTheme(parent, theme), [parent, theme])
  return (
    <PersonalizationThemeContext.Provider value={value}>
      {children}
    </PersonalizationThemeContext.Provider>
  )
}

/**
 * Тема, уже разрешённая под текущую схему: `colors` — плоский набор, не пара
 * light/dark. Без провайдера отдаёт значения из макета, поэтому компоненты
 * работают и у хоста, которому тема не нужна.
 */
export function usePersonalizationTheme() {
  const override = useContext(PersonalizationThemeContext)
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'

  return useMemo(() => {
    const source = override || EMPTY
    const colors = { ...PERSONALIZATION_COLORS[scheme], ...(source.colors?.[scheme] || EMPTY) }
    const radius = { ...PERSONALIZATION_RADIUS, ...(source.radius || EMPTY) }
    const fontFamily = { regular: undefined, emphasized: undefined, ...(source.fontFamily || EMPTY) }
    const typography = withFont(PERSONALIZATION_TYPOGRAPHY, fontFamily)
    return { colors, radius, typography, fontFamily }
  }, [override, scheme])
}

/** Шрифт по начертанию: для стилей, заданных в компоненте вручную. */
export function fontFor(theme, weight) {
  return theme.fontFamily[weight === '600' ? 'emphasized' : 'regular']
}

function mergeTheme(parent, child) {
  if (!child) return parent
  if (!parent) return child
  return {
    colors: {
      light: { ...parent.colors?.light, ...child.colors?.light },
      dark: { ...parent.colors?.dark, ...child.colors?.dark },
    },
    radius: { ...parent.radius, ...child.radius },
    fontFamily: { ...parent.fontFamily, ...child.fontFamily },
  }
}

function withFont(typography, fontFamily) {
  if (!fontFamily.regular && !fontFamily.emphasized) return typography
  const result = {}
  for (const key of Object.keys(typography)) {
    const style = typography[key]
    const family = style.fontWeight === '600' ? fontFamily.emphasized : fontFamily.regular
    result[key] = family ? { ...style, fontFamily: family } : style
  }
  return result
}
