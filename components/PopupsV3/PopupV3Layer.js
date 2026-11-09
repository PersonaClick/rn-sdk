import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  BackHandler,
  Dimensions,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { popupFrameLayout } from '../../lib/popupsV3/design'
import { popupsV3Entries, subscribePopupsV3 } from '../../lib/popupsV3/presenter'
import ToastPresenter from '../design-system/ToastPresenter'
import PopupV3Frame from './PopupV3Frame'
import { PopupSafeArea, usePopupInsets } from './popupV3Insets'

/**
 * Слой попапов v3 в `<SdkPopupOverlay>`: рисует то, что показал движок (presenter).
 *
 * - modal и fullscreen — нативная `Modal` поверх приложения: затемнение (тап по нему и «назад»
 *   закрывают), фон заблокирован; фуллскрин — рамка на весь экран внутри безопасных зон;
 * - banner — в корне приложения, сверху или снизу с отступами `offsetX/offsetY`; касания вне него
 *   уходят в приложение, если нет затемнения и блокировки фона; свайп к краю закрывает.
 *
 * Рамка не выше доступной области (экран минус безопасные зоны, клавиатура и поля макета), лишнее
 * содержимое прокручивается внутри. Клавиатура вычитается из области по её событиям (на новых
 * Android окно под клавиатуру не сжимается: edge-to-edge).
 */

const BANNER_SLIDE = 220
const SWIPE_DISTANCE = 40

/**
 * Сколько клавиатура перекрывает область попапа снизу: верх клавиатуры против низа области.
 * Где окно сжимается под клавиатуру само (adjustResize до edge-to-edge), перекрытия нет; на iOS и
 * на новых Android (edge-to-edge, окно не сжимается) — высота клавиатуры над низом области.
 */
function useKeyboardInset(areaRef) {
  const [overlap, setOverlap] = useState(0)
  useEffect(() => {
    let keyboardTop = null
    let timer = null
    const measure = () => {
      const area = areaRef.current
      if (keyboardTop === null || !area || typeof area.measure !== 'function') {
        setOverlap(0)
        return
      }
      // pageY — от верха корневого вида, как и screenY клавиатуры (measureInWindow на Android
      // считает от низа статус-бара).
      area.measure((x, y, width, height, pageX, pageY) => {
        if (keyboardTop !== null) setOverlap(Math.max(0, Math.round(pageY + height - keyboardTop)))
      })
    }
    const show = (event) => {
      keyboardTop = event && event.endCoordinates ? event.endCoordinates.screenY : Dimensions.get('window').height
      clearTimeout(timer)
      // После того как окно (если умеет) сжалось под клавиатуру.
      timer = setTimeout(measure, Platform.OS === 'android' ? 120 : 0)
    }
    const hide = () => {
      keyboardTop = null
      clearTimeout(timer)
      setOverlap(0)
    }
    const subscriptions =
      Platform.OS === 'ios'
        ? [Keyboard.addListener('keyboardWillChangeFrame', show), Keyboard.addListener('keyboardWillHide', hide)]
        : [Keyboard.addListener('keyboardDidShow', show), Keyboard.addListener('keyboardDidHide', hide)]
    return () => {
      clearTimeout(timer)
      subscriptions.forEach((subscription) => subscription.remove())
    }
  }, [areaRef])
  return overlap
}

/** Контекст элементов: запись движка, витринные переменные, тексты, высота экрана и тост. */
function useElementContext(entry, screenHeight) {
  const toast = useRef(null)
  const context = useMemo(
    () => ({
      entry,
      runtime: entry.runtime,
      texts: entry.texts,
      screenHeight,
      toast: (text) => toast.current && toast.current.show(text),
    }),
    [entry, screenHeight],
  )
  useEffect(() => {
    entry.onShown()
  }, [entry])
  return { context, toast }
}

/** Модалка и фуллскрин. */
function PopupV3Modal({ entry }) {
  const window = useWindowDimensions()
  const areaRef = useRef(null)
  const keyboard = useKeyboardInset(areaRef)
  const insets = usePopupInsets()
  const [area, setArea] = useState(null)
  const { context, toast } = useElementContext(entry, window.height)
  const fullscreen = entry.popup.layout === 'fullscreen'
  const frame = popupFrameLayout(entry.model.frame, {
    layout: entry.popup.layout,
    screenWidth: window.width,
    screenHeight: window.height,
    areaHeight: area ? area.height - keyboard : window.height,
  })
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={entry.close}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={[styles.fill, { backgroundColor: fullscreen ? frame.bgColor : frame.overlayColor || 'transparent' }]}>
        {fullscreen ? null : (
          <Pressable style={StyleSheet.absoluteFill} onPress={frame.overlayColor ? entry.close : undefined} accessible={false} />
        )}
        <PopupSafeArea insets={insets} style={styles.fill} pointerEvents="box-none">
          <View
            ref={areaRef}
            style={[styles.fill, fullscreen ? null : styles.center, { paddingBottom: keyboard }]}
            pointerEvents="box-none"
            onLayout={(event) => setArea(event.nativeEvent.layout)}
          >
            {area ? <PopupV3Frame frame={frame} model={entry.model} context={context} fill={fullscreen} /> : null}
          </View>
        </PopupSafeArea>
        <ToastPresenter ref={toast} insets={insets || undefined} />
      </View>
    </Modal>
  )
}

/** Баннер сверху или снизу. */
function PopupV3Banner({ entry }) {
  const window = useWindowDimensions()
  const areaRef = useRef(null)
  const keyboard = useKeyboardInset(areaRef)
  const insets = usePopupInsets()
  const [area, setArea] = useState(null)
  const { context, toast } = useElementContext(entry, window.height)
  const top = entry.popup.placement !== 'bottom'
  const frame = popupFrameLayout(entry.model.frame, {
    layout: 'banner',
    screenWidth: window.width,
    screenHeight: window.height,
    areaHeight: area ? area.height - keyboard : window.height,
  })

  const appear = useRef(new Animated.Value(0)).current
  const drag = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: BANNER_SLIDE, useNativeDriver: true }).start()
  }, [appear])

  const closeRef = useRef(entry.close)
  closeRef.current = entry.close
  // Пока содержимое прокручивается, вертикальный жест — прокрутка, а не закрытие.
  const scrollable = useRef(false)
  const onScrollableChange = useCallback((value) => {
    scrollable.current = value
  }, [])
  const pan = useMemo(() => {
    const towardEdge = (dy) => (top ? Math.min(0, dy) : Math.max(0, dy))
    return PanResponder.create({
      onMoveShouldSetPanResponder: (event, gesture) =>
        !scrollable.current &&
        Math.abs(gesture.dy) > 8 &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx) &&
        (top ? gesture.dy < 0 : gesture.dy > 0),
      onPanResponderMove: (event, gesture) => drag.setValue(towardEdge(gesture.dy)),
      onPanResponderRelease: (event, gesture) => {
        const distance = Math.abs(towardEdge(gesture.dy))
        const fast = top ? gesture.vy < -0.5 : gesture.vy > 0.5
        if (distance > SWIPE_DISTANCE || fast) {
          Animated.timing(drag, { toValue: top ? -400 : 400, duration: 160, useNativeDriver: true }).start(() => closeRef.current())
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start()
        }
      },
      onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    })
  }, [top, drag])

  // «Назад» закрывает только баннер, который держит экран (затемнение или блокировка фона).
  useEffect(() => {
    if (!frame.blocksBackground) return undefined
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRef.current()
      return true
    })
    return () => subscription.remove()
  }, [frame.blocksBackground])

  const translateY = Animated.add(
    appear.interpolate({ inputRange: [0, 1], outputRange: [top ? -40 : 40, 0] }),
    drag,
  )
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {frame.blocksBackground ? (
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: frame.overlayColor || 'transparent' }]}
          onPress={frame.overlayColor ? entry.close : undefined}
          accessible={false}
        />
      ) : null}
      <PopupSafeArea insets={insets} style={styles.fill} pointerEvents="box-none">
        <View ref={areaRef} style={styles.fill} pointerEvents="box-none" onLayout={(event) => setArea(event.nativeEvent.layout)}>
          {area ? (
            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.bannerSlot,
                top ? { top: frame.offsetY } : { bottom: frame.offsetY + keyboard },
                { opacity: appear, transform: [{ translateY }] },
              ]}
            >
              <View {...pan.panHandlers}>
                <PopupV3Frame frame={frame} model={entry.model} context={context} onScrollableChange={onScrollableChange} />
              </View>
            </Animated.View>
          ) : null}
        </View>
      </PopupSafeArea>
      <ToastPresenter ref={toast} insets={insets || undefined} />
    </View>
  )
}

/** Слой: каждый показанный попап — своей модалкой или баннером. */
export default function PopupV3Layer() {
  const [entries, setEntries] = useState(popupsV3Entries)
  useEffect(() => {
    setEntries(popupsV3Entries())
    return subscribePopupsV3(() => setEntries(popupsV3Entries()))
  }, [])
  return (
    <>
      {entries.map((entry) =>
        entry.slot === 'modal' ? <PopupV3Modal key={entry.id} entry={entry} /> : <PopupV3Banner key={entry.id} entry={entry} />,
      )}
    </>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  bannerSlot: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
})
