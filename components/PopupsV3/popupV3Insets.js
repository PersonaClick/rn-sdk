import React, { useContext } from 'react'
import { Platform, StatusBar, View } from 'react-native'

/**
 * Безопасные зоны для попапов v3. Своей safe-area-зависимости у SDK нет: если у хоста стоит
 * react-native-safe-area-context (необязательная peer-зависимость), отступы берутся из его
 * провайдера (или начальных метрик окна); иначе на Android — высота статус-бара (окно на новых
 * Android рисуется под системными панелями), на iOS — core SafeAreaView.
 */

let safeAreaModule
const safeArea = () => {
  if (safeAreaModule === undefined) {
    try {
      safeAreaModule = require('react-native-safe-area-context') || null
    } catch (error) {
      safeAreaModule = null
    }
  }
  return safeAreaModule
}

const NO_CONTEXT = React.createContext(null)

/** Отступы системы `{ top, bottom, left, right }` или `null` (неизвестны — нужен SafeAreaView). */
export function usePopupInsets() {
  const module = safeArea()
  // Наличие модуля не меняется за жизнь приложения, так что порядок хуков стабилен.
  const fromProvider = useContext((module && module.SafeAreaInsetsContext) || NO_CONTEXT)
  if (fromProvider) return fromProvider
  const initial = module && module.initialWindowMetrics && module.initialWindowMetrics.insets
  if (initial) return initial
  if (Platform.OS === 'android') return { top: StatusBar.currentHeight || 0, bottom: 0, left: 0, right: 0 }
  return null
}

let coreSafeAreaView
/** Контейнер внутри безопасных зон: отступами, если они известны, иначе core SafeAreaView (iOS). */
export function PopupSafeArea({ insets, style, children, pointerEvents }) {
  if (insets) {
    return (
      <View
        pointerEvents={pointerEvents}
        style={[style, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}
      >
        {children}
      </View>
    )
  }
  if (coreSafeAreaView === undefined) {
    // По пути, а не из индекса `react-native` (там геттер с предупреждением); только когда нужен.
    coreSafeAreaView = require('react-native/Libraries/Components/SafeAreaView/SafeAreaView').default
  }
  const SafeAreaView = coreSafeAreaView
  return (
    <SafeAreaView pointerEvents={pointerEvents} style={style}>
      {children}
    </SafeAreaView>
  )
}
