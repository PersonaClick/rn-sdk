import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  View,
  Modal,
  Animated,
  AppState,
  Dimensions,
  I18nManager,
  Image,
  Keyboard,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'
// Core SafeAreaView по пути, как в ToastPresenter: геттер в индексе `react-native` пишет
// предупреждение об устаревании. На Android это обычный View.
import SafeAreaView from 'react-native/Libraries/Components/SafeAreaView/SafeAreaView'
import ToastPresenter from './ToastPresenter'
import StorySlide from './StorySlide'
import {
  isMediaSlide,
  isSkippedSlide,
  isVideoSlide,
  slideProduct,
  storyShareTarget,
  storyShareUrl,
  storySlideScheme,
  withoutProps,
} from './storySupport'
import {
  listenVolumeUp,
  rememberStorySoundMuted,
  shareStoryLink,
  storySoundMuted,
  storyVideoComponent,
  systemBottomInset,
} from './storyNative'
import {
  STORY_PAUSE,
  STORY_VIEWER_CLOSED,
  STORY_HOLD_DELAY,
  STORY_MEDIA_TIMEOUT,
  STORY_PLAYER_LEAD,
  STORY_VIDEO_RETRY_DELAY,
  isStoryClockRunning,
  storyCountdown,
  storyClockStep,
  storyDragKind,
  storyGestureOutcome,
  storyPlayerPosition,
  storyEntrySlide,
  storyPlayerShouldPlay,
  storyShownSlide,
  storyViewerReducer,
} from './storyViewerState'

/**
 * StoryViewer — полноэкранный просмотр сторис V2 (нативная Modal).
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories (1:32), фреймы Card/Story. Номера правил
 * (A1…C16) — общие правила сторис V2 для всех четырёх SDK.
 *
 * Данные — сторис как их отдаёт `sdk.getStories(code)`. Сам просмотрщик в сеть не ходит и ничего
 * не трекает: о показе слайда и нажатиях он сообщает колбэками, связку с SDK делает
 * PersonalizationStories. Логика (позиция, паузы, шторка, жесты) — чистый storyViewerState, здесь
 * только события и отрисовка.
 *
 * - Старт сторис (A4): первый невиденный слайд по `seen` (`{ [storyId]: slideId[] }`), нетронутая
 *   — `start_position`, просмотренная — с начала. `onSlideView` — каждый раз, когда слайд стал
 *   текущим (A1); на перезапуске того же слайда — нет.
 * - Касание (B1): левая треть — назад, правая — вперёд, середина — ничего; в RTL края
 *   зеркальны. Удержание от 200 мс (B2) и перетаскивание (B4) ставят паузу, отпускание её снимает
 *   и никогда не листает. Вниз дальше 120 или быстрее 800 в секунду — закрыть; вбок — соседняя
 *   сторис. Назад на первом слайде первой сторис — слайд с нуля (у сторис v3 — закрыть, как в JS SDK),
 *   вперёд на последнем — закрыть (B3).
 *   Перезапуск не трекает показ и не грузит медиа заново: прогресс с нуля, видео — к нулю (F3).
 * - Шторка товаров (B5): тап вне её (и по кнопкам слайда) только закрывает её, слайды при ней не
 *   листаются, «назад» Android сперва закрывает её; смена слайда её сбрасывает. Крестик закрывает
 *   просмотр и при открытой шторке (F2).
 * - Пауза (B6): фон, потеря фокуса, погасший экран (AppState), `paused` хоста; время идёт по
 *   кадрам с ограниченным шагом, поэтому после фона слайды не проскакивают и от масштаба анимаций
 *   Android ничего не зависит (B7).
 * - Медиа (C4, C5): часы стартуют, когда медиа готово; видео идёт по своей длине; не готово за
 *   10 с или ошибка — «Повторить», видео повторяет само через 15 с. В фоне оба срока стоят и потом
 *   идут с остатка (F5).
 * - Звук (C7): без звука при первом открытии в процессе, выбор помнится до конца процесса;
 *   громкость «вверх» включает звук (react-native-volume-manager, если есть). У сторис v3 — своё
 *   состояние (R9): выбор кнопки звука помнится на устройстве по магазину, громкость «вверх» включает
 *   звук только в этом просмотре.
 * - «Поделиться»: кнопка в шапке, если у слайда есть ссылка (`storyShareUrl`, API v3). Нажатие —
 *   своя причина паузы, `onShare` сразу (до результата), системное окно с одной ссылкой (через
 *   `shareUrlTransform` хоста, если он есть; `onShare` получает исходную); окно закрыто — пауза
 *   снимается, и слайд идёт, если шёл (остальные причины паузы остаются).
 * - `initialSlideIndex` — открыть первую сторис сразу с этого слайда, в обход A4 (по ссылке).
 * - Опросы (элемент `poll`, API v3): только с `pollTransport` — его даёт виджет, сам просмотр в
 *   сеть не ходит. Карточка держит слайд своей причиной паузы (палец, фокус в поле, отправка), её
 *   касания слайду не достаются; пока в её поле фокус, тап мимо карточки только прячет клавиатуру.
 * - `v3` — сторис из ленты API v3, поведение как у JS SDK: медиа по `type` (R6), `background_color`
 *   красит любой слайд (R2), текст-блоки по R4, шапка `header` (R1), старт сторис — `start_position`
 *   или слайд, где из неё ушли в этом сеансе (`positions`, R8), выбор кнопки звука помнится на
 *   устройстве по магазину (`pollShopId`), кнопки звука нет, только когда звука у видео точно нет (R9);
 *   слайд без медиа и без товара пропускается (`isSkippedSlide`): вперёд его проходят, назад через него
 *   переступают, сторис из одних таких проходится насквозь и считается досмотренной; пустой просмотр не
 *   показывается. Назад на первом слайде первой сторис — закрыть, как в JS SDK. Перезапуск слайда
 *   (только у старой ленты) — `onSlideRestart`, уход из сторис вперёд — `onStoryLeave(story, completed)`
 *   (R8).
 *
 * Пропсы v3 (`STORY_VIEWER_V3_PROPS`: «Поделиться» и опросы) принимает только этот компонент — его
 * экспортирует шлюз internal/v3. Кит экспортирует KitStoryViewer: он их отбрасывает и выключает
 * кнопку «Поделиться» (`withShare`), даже если в данных есть ссылка.
 *
 * Тост «Copied» показывает свой ToastPresenter — последним ребёнком модалки, сверху экрана.
 *
 * Безопасная зона: `insets`, если хост их знает; иначе на iOS — замер core SafeAreaView, на
 * Android — статус-бар сверху и навигационная панель снизу, когда модалка рисуется под ней
 * (edge-to-edge): из react-native-safe-area-context, если он есть, иначе оценка по экрану и окну.
 *
 * @param {object} props см. PersonalizationStoryViewerProps в ui.d.ts и PersonalizationStoryViewerV3Props в v3.d.ts
 */
export default function StoryViewer({
  visible,
  stories = [],
  initialStoryIndex = 0,
  initialSlideIndex,
  openRequest,
  seen,
  paused = false,
  onClose,
  onSlideView,
  onButtonPress,
  onProductPress,
  onPromoCopied,
  onShare,
  shareUrlTransform,
  productButtonText = 'More info',
  promoCaption = 'Promo code',
  promoCopiedText = 'Copied',
  showProductsText = 'Used products',
  hideProductsText = 'Hide products',
  retryText = 'Retry',
  closeLabel = 'Close',
  shareLabel = 'Share',
  soundOnLabel = 'Sound on',
  soundOffLabel = 'Sound off',
  pollReanswerText,
  pollSubmitText,
  pollErrorText,
  pollTransport,
  pollShopId = '',
  pollDeviceId = '',
  v3 = false,
  positions,
  onSlideRestart,
  onStoryLeave,
  onHeaderPress,
  insets,
  renderIcon,
  // Внутреннее: `false` — без «Поделиться», даже у слайдов со ссылкой (просмотр кита).
  withShare = true,
}) {
  const { width, height } = useWindowDimensions()
  const toast = useRef(null)
  const [state, rawDispatch] = useReducer(storyViewerReducer, STORY_VIEWER_CLOSED)
  const stateRef = useRef(state)
  stateRef.current = state

  // Данные для действий берутся из ref: колбэки жестов и таймеров создаются один раз.
  const data = useRef({ stories, seen })
  data.current = { stories, seen: seen || EMPTY_SEEN, v3: !!v3, positions: positions || null }
  const dispatch = useCallback((action) => {
    const { stories: list, seen: viewed, v3: fromV3, positions: places } = data.current
    rawDispatch({ ...action, stories: list, seen: viewed, v3: fromV3, positions: places, canPlayVideo: !!storyVideoComponent() })
  }, [])

  // Открытие — по фронту `visible`; закрытие хостом — сброс. Новая сторис или новый запрос
  // открытия (`openRequest`) при открытом просмотре — листание к ней внутри него (F11).
  const shown = useRef(false)
  useEffect(() => {
    if (!visible) {
      shown.current = false
      dispatch({ type: 'reset' })
    } else if (!shown.current) {
      shown.current = true
      dispatch({ type: 'open', index: initialStoryIndex, slide: initialSlideIndex })
    } else {
      dispatch({ type: 'page', index: initialStoryIndex })
    }
    // Не по `stories`: они меняются (seen), пока просмотр открыт, — позиция остаётся.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialStoryIndex, openRequest])

  const story = state.open ? stories[state.story] : null
  const slide = story?.slides?.[state.slide] || null

  // Звук: у сторис v3 — своё состояние, выбор кнопки магазина на устройстве (R9); у старой ленты — в
  // этом запуске (C7).
  const soundShop = v3 ? String(pollShopId || '') : undefined
  const [muted, setMuted] = useState(() => storySoundMuted(soundShop))
  const setSound = useCallback(
    (value) => {
      rememberStorySoundMuted(value, soundShop)
      setMuted(value)
    },
    [soundShop],
  )

  // Каждое открытие — со звуком, который пользователь оставил (C7, R9).
  useEffect(() => {
    if (visible) setMuted(storySoundMuted(soundShop))
  }, [visible, soundShop])

  // Просмотр решил закрыться сам — хост убирает его.
  useEffect(() => {
    if (visible && state.closing) onClose && onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, state.closing])

  // Слайд сторис v3 без медиа и без товара пропускается, как в JS SDK, без `view`: просмотр на него не
  // встаёт (storyViewerState); оказался на нём (ленту подменили) — сразу дальше.
  const skipped = isSkippedSlide(slide, v3)
  useEffect(() => {
    if (visible && state.open && skipped) dispatch({ type: 'ended' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, state.open, state.entry, skipped])

  // Слайд стал текущим (A1): трекинг `view` и отметка «видел» у хоста.
  useEffect(() => {
    if (visible && state.open && story && slide && !skipped && onSlideView) onSlideView(story, slide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, state.open, state.entry])

  // Перезапуск слайда (B3): у сторис v3 — тоже показ, `view` уходит снова (F4).
  useEffect(() => {
    if (state.restart && visible && state.open && story && slide && onSlideRestart) onSlideRestart(story, slide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.restart])

  // Ушли из сторис вперёд (R8): хост отмечает её просмотренной в этом сеансе — каждую, и пройденные
  // насквозь (в них показать нечего), по порядку.
  const leftSeen = useRef(0)
  useEffect(() => {
    const entries = (state.left || []).filter((entry) => entry.seq > leftSeen.current)
    leftSeen.current = Math.max(leftSeen.current, state.leave)
    entries.forEach((entry) => {
      const left = stories[entry.story]
      if (left && onStoryLeave) onStoryLeave(left, entry.completed)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.leave])

  // Пауза хоста (`pause()` / `resume()` виджета, B8).
  useEffect(() => {
    if (state.open) dispatch({ type: paused ? 'pause' : 'resume', reason: STORY_PAUSE.HOST })
  }, [paused, state.open, dispatch])

  // Фон и погасший экран (B6).
  useEffect(() => {
    if (!visible) return undefined
    const apply = (active) => dispatch({ type: active ? 'resume' : 'pause', reason: STORY_PAUSE.BACKGROUND })
    // Android `blur` / `focus` — фокус окна активити, а не модалки: окно просмотра забирает его при
    // открытии и отдаёт при закрытии, так что `blur` ставил паузу, которую ничто не снимало.
    const subscriptions = [AppState.addEventListener('change', (next) => apply(next === 'active'))]
    return () => subscriptions.forEach((subscription) => subscription?.remove?.())
  }, [visible, dispatch])

  // «Поделиться»: своя пауза на время системного окна, `onShare` (трекинг) — сразу, до результата.
  // Повторное нажатие, пока окно открыто, ничего не делает.
  const sharing = useRef(false)
  const share = (url, anchor) => {
    if (sharing.current || !story || !slide) return
    sharing.current = true
    dispatch({ type: 'pause', reason: STORY_PAUSE.SHARE })
    try {
      onShare && onShare(story, slide, url)
    } catch (error) {
      // Уведомление хоста не должно мешать окну.
    }
    shareStoryLink(storyShareTarget(url, shareUrlTransform), anchor).then(() => {
      sharing.current = false
      dispatch({ type: 'resume', reason: STORY_PAUSE.SHARE })
    })
  }
  const shareUrl = withShare ? storyShareUrl(story, slide) : null

  // Сохранённые ответы опросов: по магазину и устройству; без `did` не читаются и не пишутся.
  const pollStorage = useMemo(
    () => (pollShopId && pollDeviceId ? { shopId: String(pollShopId), did: String(pollDeviceId) } : null),
    [pollShopId, pollDeviceId],
  )

  // Опросы: пауза `POLL` — пока карточку держат; фокус в её поле — тап мимо только прячет
  // клавиатуру. Новый слайд (или его новая загрузка) — карточки новые, фокуса нет.
  const pollFocus = useRef(false)
  const pollBlurAt = useRef(0)
  useEffect(() => {
    pollFocus.current = false
  }, [state.entry, state.load])
  const onPollHold = useCallback(
    (on) => dispatch({ type: on ? 'pause' : 'resume', reason: STORY_PAUSE.POLL }),
    [dispatch],
  )
  const onPollFocus = useCallback((on) => {
    pollFocus.current = on
    if (!on) pollBlurAt.current = Date.now()
  }, [])
  // Android «назад» при открытой клавиатуре: клавиатура прячется на нажатии, а модалка получает
  // «назад» на отпускании — оно только прячет клавиатуру, просмотр не закрывается.
  const onBack = () => {
    if (pollFocus.current || Date.now() - pollBlurAt.current < POLL_BACK_GRACE_MS) {
      Keyboard.dismiss()
      return
    }
    dispatch({ type: 'back' })
  }

  // Громкость «вверх» включает звук (C7). У сторис v3 — только в этом просмотре: сохраняется лишь
  // выбор кнопки звука (R9), следующее открытие — с ним.
  useEffect(() => {
    if (!visible) return undefined
    return listenVolumeUp(() => (v3 ? setMuted(false) : setSound(false)))
  }, [visible, setSound, v3])

  // Медиа не готово за 10 с — ошибка и «Повторить» (C5). Видео, которое не загрузилось, повторяет
  // само через 15 с; уход со слайда это отменяет. В фоне оба срока стоят и потом идут с остатка (F5).
  const background = state.pauses.includes(STORY_PAUSE.BACKGROUND)
  const videoSlide = isVideoSlide(slide, v3)
  useFreezableTimeout(
    visible && state.open && state.media === 'loading',
    state.load,
    background,
    STORY_MEDIA_TIMEOUT,
    () => dispatch({ type: 'mediaFailed' }),
  )
  useFreezableTimeout(
    visible && state.open && state.media === 'error' && videoSlide,
    state.load,
    background,
    STORY_VIDEO_RETRY_DELAY,
    () => dispatch({ type: 'retry' }),
  )

  // Следующий слайд — заранее в кэш картинок (C6): фон, превью видео или фото товара.
  useEffect(() => {
    if (!visible || !state.open) return
    const upcoming = upcomingSlide(stories, data.current, state.story, state.slide)
    prefetchUris(upcoming, data.current.v3).forEach((uri) => {
      try {
        Promise.resolve(Image.prefetch(uri)).catch(() => {})
      } catch (error) {
        // Кэш — удобство: не вышло — картинка загрузится при показе.
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, state.open, state.entry])

  // Часы слайда (B6, B7, C4). Время — сумма шагов между кадрами, каждый не длиннее 100 мс:
  // после фона или подвисания слайд не проскакивает, а масштаб анимаций Android ни при чём.
  // У видео известной длины прогресс — позиция плеера, конец — его `onEnd`.
  const progress = useRef(new Animated.Value(0)).current
  const clock = useRef({ epoch: -1, elapsed: 0, ended: false, report: null, since: null })
  const onVideoProgress = useCallback((positionMs) => {
    const c = clock.current
    // Отчёт, ушедший до перемотки перезапуска (F3), дальше прошедшего с начала времени — не берём.
    const at = now()
    if (c.since !== null && positionMs > at - c.since + STORY_PLAYER_LEAD) return
    c.report = { positionMs, at }
  }, [])
  useEffect(() => {
    if (!visible || !state.open) return undefined
    let frame = null
    let last = null
    const loop = () => {
      const time = now()
      const step = last === null ? 0 : storyClockStep(last, time)
      last = time
      const current = stateRef.current
      const c = clock.current
      if (c.epoch !== current.epoch) {
        c.epoch = current.epoch
        c.elapsed = 0
        c.ended = false
        c.report = null
        c.since = time
      }
      const running = isStoryClockRunning(current)
      if (current.clock === 'player') {
        c.elapsed = storyPlayerPosition(c.report, time, current.durationMs, running)
      } else if (running) {
        c.elapsed = Math.min(current.durationMs, c.elapsed + step)
      }
      progress.setValue(current.durationMs > 0 ? c.elapsed / current.durationMs : 0)
      if (running && !c.ended && current.clock === 'timer' && c.elapsed >= current.durationMs) {
        c.ended = true
        dispatch({ type: 'ended' })
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [visible, state.open, progress, dispatch])

  const onVideoEnd = useCallback(() => {
    const c = clock.current
    if (c.ended || c.epoch !== stateRef.current.epoch) return
    c.ended = true
    dispatch({ type: 'ended' })
  }, [dispatch])

  // Жесты на корне: кнопки, промокод, шторка и карусель внутри забирают касание себе первыми.
  // Отпускание всегда снимает паузы удержания и перетаскивания и возвращает слайд на место —
  // кроме закрытия свайпом, где слайд уезжает вниз (B2, B4).
  const translateY = useRef(new Animated.Value(0)).current
  const size = useRef({ width, height })
  size.current = { width, height }
  const gesture = useRef({ held: false, dragging: false, timer: null, keyboard: false })
  const finish = useCallback(
    (outcome) => {
      const g = gesture.current
      clearTimeout(g.timer)
      const { held, dragging } = g
      g.held = false
      g.dragging = false
      g.keyboard = false
      if (outcome && outcome.type === 'close') {
        // Закрытие свайпом: слайд уезжает в сторону свайпа (вверх — у сторис v3, как JS SDK).
        const toValue = outcome.up ? -size.current.height : size.current.height
        Animated.timing(translateY, { toValue, duration: 200, useNativeDriver: true }).start(() =>
          dispatch({ type: 'close' }),
        )
        return
      }
      if (held) dispatch({ type: 'resume', reason: STORY_PAUSE.HOLD })
      if (dragging) dispatch({ type: 'resume', reason: STORY_PAUSE.DRAG })
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start()
      if (outcome) dispatch(outcome)
    },
    [dispatch, translateY],
  )
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => storyDragKind(g, stateRef.current.sheetOpen) !== null,
        onPanResponderGrant: () => {
          const g = gesture.current
          clearTimeout(g.timer)
          g.held = false
          g.dragging = false
          // Фокус в поле опроса: касание только прячет клавиатуру — без листания и удержания.
          g.keyboard = pollFocus.current
          if (g.keyboard) return
          g.timer = setTimeout(() => {
            g.held = true
            dispatch({ type: 'pause', reason: STORY_PAUSE.HOLD })
          }, STORY_HOLD_DELAY)
        },
        onPanResponderMove: (_, g) => {
          const kind = storyDragKind(g, stateRef.current.sheetOpen)
          if (!kind || gesture.current.keyboard) return
          const own = gesture.current
          clearTimeout(own.timer)
          if (!own.dragging) {
            own.dragging = true
            dispatch({ type: 'pause', reason: STORY_PAUSE.DRAG })
          }
          // Слайд едет за пальцем только вниз и только без шторки.
          if (kind === 'vertical') translateY.setValue(Math.max(0, g.dy))
        },
        onPanResponderRelease: (event, g) => {
          if (gesture.current.keyboard) {
            Keyboard.dismiss()
            finish(null)
            return
          }
          finish(
            storyGestureOutcome({
              dx: g.dx,
              dy: g.dy,
              vx: g.vx,
              vy: g.vy,
              x: event.nativeEvent.pageX,
              width: size.current.width,
              held: gesture.current.held,
              rtl: I18nManager.isRTL,
              sheetOpen: stateRef.current.sheetOpen,
              v3: data.current.v3,
            }),
          )
        },
        onPanResponderTerminate: () => finish(null),
        onPanResponderTerminationRequest: () => false,
        // Жест держит другой ответчик и не отдаёт его: RN зовёт grant корня раньше отказа — таймер
        // удержания, который он завёл, иначе поставил бы паузу без отпускания.
        onPanResponderReject: () => {
          const g = gesture.current
          clearTimeout(g.timer)
          g.held = false
          g.dragging = false
          g.keyboard = false
        },
      }),
    [dispatch, finish, translateY],
  )
  useEffect(() => () => clearTimeout(gesture.current.timer), [])
  // Каждое открытие — без сдвига от прошлого свайпа вниз.
  useEffect(() => {
    if (visible) translateY.setValue(0)
  }, [visible, translateY])

  // Безопасная зона: у хоста — как дал; на iOS — замер core SafeAreaView (фон тянется под вырез и
  // полоску «домой», внутрь сдвигается только содержимое); на Android — статус-бар (модалка под
  // ним) и навигационная панель, если модалка рисуется и под ней (edge-to-edge).
  const [measured, setMeasured] = useState({ top: 0, bottom: 0 })
  const [rootHeight, setRootHeight] = useState(0)
  const top = insets ? insets.top || 0 : Platform.OS === 'android' ? StatusBar.currentHeight || 0 : measured.top
  const bottom = insets ? insets.bottom || 0 : Platform.OS === 'android' ? androidBottomInset(rootHeight) : measured.bottom
  const slideInsets = useMemo(() => ({ top, bottom }), [top, bottom])
  const scheme = useColorScheme()
  const slideScheme = storySlideScheme(slide, v3)
  const lightChrome = slideScheme ? slideScheme === 'dark' : scheme === 'dark'

  const texts = useMemo(
    () => ({
      productButtonText,
      promoCaption,
      promoCopiedText,
      showProductsText,
      hideProductsText,
      retryText,
      closeLabel,
      shareLabel,
      soundOnLabel,
      soundOffLabel,
      pollReanswerText,
      pollSubmitText,
      pollErrorText,
    }),
    [
      productButtonText,
      promoCaption,
      promoCopiedText,
      showProductsText,
      hideProductsText,
      retryText,
      closeLabel,
      shareLabel,
      soundOnLabel,
      soundOffLabel,
      pollReanswerText,
      pollSubmitText,
      pollErrorText,
    ],
  )

  const frame =
    story && slide && !skipped ? (
      <StorySlide
        key={`${story.id}:${slide.id}:${state.slide}:${state.load}`}
        slide={slide}
        epoch={state.epoch}
        count={story.slides.length}
        current={state.slide}
        progress={progress}
        playing={visible && storyPlayerShouldPlay(state)}
        muted={muted}
        onToggleMute={() => setSound(!muted)}
        media={state.media}
        onMediaReady={(durationMs) => dispatch({ type: 'mediaReady', durationMs })}
        onAnimationLoop={(loopMs) => dispatch({ type: 'animationLoop', loopMs })}
        onMediaFailed={() => dispatch({ type: 'mediaFailed' })}
        onBuffering={(active) => dispatch({ type: 'buffering', active })}
        onVideoProgress={onVideoProgress}
        onVideoEnd={onVideoEnd}
        onRetry={() => dispatch({ type: 'retry' })}
        sheetOpen={state.sheetOpen}
        onSheetToggle={(open) => dispatch({ type: 'sheet', open })}
        onClose={() => dispatch({ type: 'close' })}
        onShare={shareUrl ? (anchor) => share(shareUrl, anchor) : undefined}
        onButtonPress={(button) => onButtonPress && onButtonPress(story, slide, button)}
        onProductPress={(item, element) => onProductPress && onProductPress(story, slide, item, element)}
        onPromoCopied={(code, element) => onPromoCopied && onPromoCopied(story, slide, code, element)}
        toastRef={toast}
        insets={slideInsets}
        texts={texts}
        renderIcon={renderIcon}
        storyId={story.id}
        v3={!!v3}
        onHeaderPress={onHeaderPress ? (element) => onHeaderPress(story, slide, element) : undefined}
        pollTransport={pollTransport}
        pollStorage={pollStorage}
        onPollHold={onPollHold}
        onPollFocus={onPollFocus}
      />
    ) : null

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, Math.max(1, height)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const measure =
    !insets && Platform.OS === 'ios' ? (
      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="none">
        <View
          style={styles.fill}
          onLayout={(event) => {
            const layout = event.nativeEvent.layout
            const next = { top: layout.y, bottom: Math.max(0, height - layout.y - layout.height) }
            setMeasured((value) => (value.top === next.top && value.bottom === next.bottom ? value : next))
          }}
        />
      </SafeAreaView>
    ) : null

  return (
    // Модалка — только с открытым слайдом: просмотр, которому показать нечего (сторис из одних
    // пропущенных слайдов), закрывается, так и не показав пустой чёрный экран.
    <Modal
      visible={visible && state.open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onBack}
      supportedOrientations={['portrait']}
    >
      <View style={styles.fill} onLayout={(event) => setRootHeight(event.nativeEvent.layout.height)}>
        <StatusBar barStyle={lightChrome ? 'light-content' : 'dark-content'} />
        {measure}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]} />
        <Animated.View style={[styles.fill, { transform: [{ translateY }] }]} {...responder.panHandlers}>
          {frame}
        </Animated.View>
        {/* Последним ребёнком модалки: презентер в корне приложения остался бы под ней. */}
        <ToastPresenter ref={toast} insets={{ top, bottom }} />
      </View>
    </Modal>
  )
}

/**
 * Пропсы v3 просмотра: «Поделиться» (колбэк, подпись, ссылка для окна) и опросы (транспорт, магазин
 * ответов, тексты).
 */
export const STORY_VIEWER_V3_PROPS = [
  'onShare',
  'shareLabel',
  'shareUrlTransform',
  'pollTransport',
  'pollShopId',
  'pollDeviceId',
  'v3',
  'positions',
  'onSlideRestart',
  'onStoryLeave',
  'onHeaderPress',
  'pollReanswerText',
  'pollSubmitText',
  'pollErrorText',
]

/**
 * Просмотр кита (`PersonalizationStoryViewer` из `ui`): тот же StoryViewer без пропсов v3 и
 * без «Поделиться» — кнопки нет, даже если у слайда есть ссылка. Без транспорта опросы не рисуются.
 */
export function KitStoryViewer(props) {
  return <StoryViewer {...withoutProps(props, STORY_VIEWER_V3_PROPS)} withShare={false} />
}

const EMPTY_SEEN = Object.freeze({})

/** «Назад» сразу после того, как клавиатура поля опроса спряталась, ещё относится к ней, мс. */
const POLL_BACK_GRACE_MS = 500

/**
 * Срок `delayMs`, пока `armed`; на каждый новый `key` (загрузку медиа) — новый. Пока `frozen`
 * (просмотр в фоне), срок стоит и потом идёт с остатка, а не заново (F5).
 */
function useFreezableTimeout(armed, key, frozen, delayMs, onFire) {
  const fire = useRef(onFire)
  fire.current = onFire
  const countdown = useRef(null)
  useEffect(() => {
    if (!armed) return undefined
    const current = storyCountdown(delayMs, () => fire.current())
    countdown.current = current
    return () => {
      current.cancel()
      if (countdown.current === current) countdown.current = null
    }
  }, [armed, key, delayMs])
  useEffect(() => {
    const current = countdown.current
    if (!current) return
    if (frozen) current.pause()
    else current.resume()
  }, [armed, key, delayMs, frozen])
}

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())

/**
 * Нижний отступ на Android. Модалка рисуется под навигационной панелью только в edge-to-edge —
 * тогда её корень высотой с экран. Высота панели — из react-native-safe-area-context, если он
 * есть, иначе разница экрана и окна за вычетом статус-бара.
 */
function androidBottomInset(rootHeight) {
  const screen = Dimensions.get('screen')
  if (!(rootHeight > 0) || rootHeight < screen.height - 2) return 0
  const known = systemBottomInset()
  if (known !== null) return known
  const window = Dimensions.get('window')
  return Math.max(0, Math.round(screen.height - window.height - (StatusBar.currentHeight || 0)))
}

/**
 * Слайд, который покажется следующим: следующий показанный в сторис или стартовый (показанный) в
 * следующей (A4, R8); пропущенные слайды сторис v3 не в счёт.
 */
function upcomingSlide(stories, context, storyIndex, slideIndex) {
  const story = stories[storyIndex]
  const nextInStory = storyShownSlide(story, slideIndex + 1, 1, context.v3)
  if (nextInStory >= 0) return story.slides[nextInStory]
  for (const item of stories.slice(storyIndex + 1)) {
    if (!item?.slides?.length) continue
    const index = storyShownSlide(item, storyEntrySlide(item, context), 1, context.v3)
    if (index >= 0) return item.slides[index]
  }
  return null
}

/** Картинки слайда для кэша: фон (у видео — превью, F9) и фото товара. */
function prefetchUris(slide, v3) {
  if (!slide) return []
  const product = slideProduct(slide)
  const uris = [
    isVideoSlide(slide, v3) ? slide.preview : isMediaSlide(slide, v3) ? slide.background : null,
    product ? product.image_url_resized?.['520'] || product.image_url || product.picture : null,
  ]
  return uris.filter((uri) => typeof uri === 'string' && uri.trim().length > 0)
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: '#000000' },
})
