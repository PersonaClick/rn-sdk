import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { View, Animated, AccessibilityInfo, Platform, StyleSheet } from 'react-native'
// Core SafeAreaView по пути, как в Popup.js: геттер в индексе `react-native` пишет предупреждение
// об устаревании, а своей safe-area-зависимости у SDK нет. На Android это обычный View.
import SafeAreaView from 'react-native/Libraries/Components/SafeAreaView/SafeAreaView'
import { PERSONALIZATION_SPACING } from '../../constants/spacing.constants'
import Toast from './Toast'

/**
 * ToastPresenter — показывает Toast поверх экрана на время.
 *
 * Источник: Figma Mobile SDK UI Kit, секция Toast (367:16179); размещение — фреймы страницы
 * Stories 367:16063 (снизу) и 367:16106 (сверху).
 *
 * Презентер кладётся последним ребёнком в корень экрана (или модалки — поверх нативной модалки
 * корень приложения не виден) и растягивается на него целиком. Показ — через ref:
 *
 * ```jsx
 * const toast = useRef(null)
 * <PersonalizationToastPresenter ref={toast} />
 * toast.current.show('Copied')                         // снизу, 2 секунды
 * toast.current.show('Code copied to clipboard', 'top', 3000)
 * ```
 *
 * По горизонтали по центру, в 16 от края безопасной зоны (сверху — от её верха, снизу — от низа);
 * шире контейнера минус 2 x 16 не становится, текст переносится. Появляется и уходит
 * растворением за 200 мс, прячется сам через `duration`. Новый `show` заменяет тост, который ещё
 * на экране, и перезапускает таймер — тосты не копятся. Касаний не перехватывает.
 *
 * Безопасная зона — core SafeAreaView: на iOS отступы системные, на Android он обычный View.
 * Если у хоста свои отступы (react-native-safe-area-context, edge-to-edge на Android), он
 * передаёт их в `insets` — тогда SafeAreaView не используется.
 *
 * Для скринридера: на iOS текст объявляется (announceForAccessibility), на Android контейнер —
 * live region, и TalkBack читает появившийся тост сам.
 *
 * `onHide` — тост ушёл: истёк `duration` или вызван `hide()`. При замене новым не вызывается.
 *
 * @param {{ insets?: { top?: number, bottom?: number, left?: number, right?: number },
 *           onHide?: Function, style?: object }} props
 */
function ToastPresenter({ insets, onHide, style }, ref) {
  const [toast, setToast] = useState(null)
  const opacity = useRef(new Animated.Value(0)).current

  // Колбэк держится в ref: контроллер создаётся один раз, а onHide у хоста может меняться.
  const onHideRef = useRef(onHide)
  useEffect(() => {
    onHideRef.current = onHide
  }, [onHide])

  const controllerRef = useRef(null)
  if (!controllerRef.current) {
    controllerRef.current = createToastController({
      onChange: setToast,
      onHide: () => onHideRef.current?.(),
    })
  }
  const controller = controllerRef.current
  useEffect(() => () => controller.dispose(), [controller])

  useImperativeHandle(ref, () => ({ show: controller.show, hide: controller.hide }), [controller])

  useEffect(() => {
    if (!toast) return undefined
    if (toast.visible && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(toast.text)
    // Растворение от текущего значения: замена посреди ухода возвращает тост без мигания.
    const animation = Animated.timing(opacity, {
      toValue: toast.visible ? 1 : 0,
      duration: TOAST_FADE,
      useNativeDriver: true,
    })
    animation.start(({ finished }) => {
      if (finished && !toast.visible) setToast((current) => (current === toast ? null : current))
    })
    return () => animation.stop()
  }, [toast, opacity])

  const frame = [styles.frame, toast?.position === 'top' ? styles.top : styles.bottom]
  // key по номеру показа: замена тем же текстом пересоздаёт плашку, и live region на Android
  // объявляет её снова.
  const content = toast ? (
    <Animated.View style={[styles.slot, { opacity }]}>
      <Toast key={toast.id} text={toast.text} />
    </Animated.View>
  ) : null
  const live = Platform.OS === 'android' ? 'polite' : undefined

  if (insets) {
    const padding = {
      paddingTop: insets.top || 0,
      paddingBottom: insets.bottom || 0,
      paddingLeft: insets.left || 0,
      paddingRight: insets.right || 0,
    }
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, padding, style]}>
        <View style={frame} accessibilityLiveRegion={live}>
          {content}
        </View>
      </View>
    )
  }

  // Отступ 16 — на внутреннем View: паддинг самого SafeAreaView на iOS заменяется системными
  // отступами.
  return (
    <SafeAreaView pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <View style={frame} accessibilityLiveRegion={live}>
        {content}
      </View>
    </SafeAreaView>
  )
}

export default forwardRef(ToastPresenter)

/** Сколько тост на экране по умолчанию, мс. */
export const TOAST_DURATION = 2000
/** Появление и уход, мс. */
export const TOAST_FADE = 200

/**
 * Состояние презентера без React: какой тост показан и когда его убрать.
 *
 * `onChange` получает `{ id, text, position, visible }`: `visible: false` — пора растворять,
 * текст остаётся до конца анимации. `onHide` — тост ушёл по таймеру или по `hide()`.
 *
 * @param {{ onChange: (toast: object) => void, onHide?: Function }} callbacks
 */
export function createToastController({ onChange, onHide }) {
  let timer = null
  let current = null
  let shows = 0

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const hide = () => {
    cancel()
    if (!current || !current.visible) return
    current = { ...current, visible: false }
    onChange(current)
    if (onHide) onHide()
  }

  /**
   * @param {string} text
   * @param {'top'|'bottom'} [position]
   * @param {number} [duration] мс
   */
  const show = (text, position = 'bottom', duration = TOAST_DURATION) => {
    if (typeof text !== 'string' || text.length === 0) return
    cancel()
    shows += 1
    current = { id: shows, text, position: position === 'top' ? 'top' : 'bottom', visible: true }
    onChange(current)
    timer = setTimeout(hide, Number.isFinite(duration) && duration > 0 ? duration : TOAST_DURATION)
  }

  return { show, hide, dispose: cancel }
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: 'center',
    padding: PERSONALIZATION_SPACING.xl,
  },
  top: { justifyContent: 'flex-start' },
  bottom: { justifyContent: 'flex-end' },
  // Не шире рамки: длинный текст переносится внутри плашки.
  slot: { maxWidth: '100%' },
})
