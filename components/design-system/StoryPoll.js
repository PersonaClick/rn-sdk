import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { PERSONALIZATION_COLORS } from '../../constants/colors.constants'
import { PERSONALIZATION_RADIUS } from '../../constants/radius.constants'
import { PERSONALIZATION_SPACING } from '../../constants/spacing.constants'
import { PERSONALIZATION_TYPOGRAPHY } from '../../constants/typography.constants'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import { STORY_TAP_SLOP } from './storyViewerState'
import {
  createStoryPollController,
  storyPollLanguage,
  storyPollOptionLetter,
  storyPollResultTexts,
  storyPollScaleFill,
  storyPollScaleRange,
  storyPollTextOn,
  storyPollTop,
  storyPollVotes,
} from './storyPollSupport'

/**
 * StoryPoll — карточки опросов слайда сторис V2 (элемент `poll`, API v3). Внутренняя часть
 * StorySlide: логика — контроллер storyPollSupport (как `createPoll` JS SDK), здесь только вид, касания и
 * клавиатура. Без транспорта опросов (его даёт виджет) слайд их не рисует.
 *
 * Вид — по макету: матовая светлая карточка (и в тёмной теме) по 12 от краёв, не шире 420 по
 * центру, весь текст по левому краю. Размытия под карточкой нет — нативной зависимости для него в SDK
 * нет, вместо него белая подложка 88 %. Варианты — строки с буквой, итоги — шапка «Результаты», полосы
 * долей и подвал с благодарностью и числом голосов; шкала — дорожка-капсула. Положение — одно правило
 * с текст-блоками (storyPollTop): `y_offset` % всей высоты слайда, потом вся карточка между шапкой и
 * нижними кнопками / «товарами» (`region`); не влезает — прокрутка внутри.
 *
 * Касание, начатое на карточке, слайду не достаётся: ни тапы-листания, ни удержание, ни свайпы
 * (карточка забирает жест и не отдаёт его корню просмотра). Пока карточку держат, в поле фокус или
 * ответ уходит — `onHold(true)` (пауза `POLL` просмотра). Поле `text`: карточка поднимается над
 * клавиатурой (+16), слайд стоит; фон приложения и уход карточки клавиатуру убирают.
 */

const ON_LIGHT = PERSONALIZATION_COLORS.light

/** Значения карточки, которых нет в токенах кита, — одним местом. */
export const STORY_POLL_STYLE = Object.freeze({
  card: 'rgba(255, 255, 255, 0.88)',
  cardBorder: 'rgba(255, 255, 255, 0.5)',
  cardBorderWidth: 1,
  maxWidth: 420,
  /** Текст карточки: она светлая в обеих темах. */
  text: ON_LIGHT.textDarkPrimary,
  textSecondary: ON_LIGHT.textDarkSecondary,
  hint: ON_LIGHT.textDarkHint,
  /** Цвет выбора и успеха опроса: выбранный вариант, кнопка, шкала без полосы, точка «Результатов». */
  accent: '#22C55E',
  /** Выбранный вариант до отправки — заливка строки; мой ответ в итогах — полоса доли. */
  accentFill: 'rgba(34, 197, 94, 0.2)',
  accentBar: 'rgba(34, 197, 94, 0.25)',
  /** Белые текст и значки на тёмной заливке (на светлой — `text`). */
  light: '#FFFFFF',
  /** Подложка строк, дорожки шкалы и неактивной кнопки; полоса доли варианта. */
  surface: 'rgba(0, 0, 0, 0.06)',
  bar: 'rgba(0, 0, 0, 0.08)',
  /** Квадрат буквы и поле ввода. */
  well: 'rgba(255, 255, 255, 0.85)',
  questionLineHeight: 24,
  /** Разрядка шапки «Результаты» — доля кегля. */
  overlineTracking: 0.08,
  dotSize: 6,
  optionMinHeight: 56,
  selectedBorderWidth: 1.5,
  letterSize: 32,
  /** Галочка в квадрате выбранного варианта и в кружке отвеченного текста. */
  checkWidth: 7,
  checkHeight: 12,
  checkStroke: 2,
  trackHeight: 52,
  controlHeight: 52,
  inputMaxHeight: 120,
  answeredOpacity: 0.55,
  error: '#DC2626',
  sendingOpacity: 0.85,
  keyboardGap: 16,
})

/**
 * Слой опросов слайда: карточки по порядку. `onHold` / `onFocus` — «хоть одна карточка держит
 * слайд» / «фокус в поле какой-то карточки» (просмотр по нему тап мимо карточки только прячет
 * клавиатуру).
 */
export default function StoryPollLayer({
  polls,
  storyId,
  slideId,
  transport,
  shopId,
  texts,
  slideHeight,
  region,
  topLimit = 0,
  onHold,
  onFocus,
  pointerEvents = 'box-none',
}) {
  const holds = useRef(new Set())
  const focuses = useRef(new Set())
  const callbacks = useRef({ onHold, onFocus })
  callbacks.current = { onHold, onFocus }
  const report = useCallback((set, key, on, name) => {
    const before = set.size > 0
    if (on) set.add(key)
    else set.delete(key)
    const after = set.size > 0
    if (before !== after && callbacks.current[name]) callbacks.current[name](after)
  }, [])

  if (!transport || !polls || polls.length === 0 || !(slideHeight > 0) || !region) return null
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={pointerEvents}>
      {polls.map((poll, index) => {
        const key = `${index}:${poll.type}:${poll.code}`
        return (
          <StoryPollCard
            key={key}
            poll={poll}
            storyId={storyId}
            slideId={slideId}
            transport={transport}
            shopId={shopId}
            texts={texts}
            slideHeight={slideHeight}
            region={region}
            topLimit={topLimit}
            onHold={(on) => report(holds.current, key, on, 'onHold')}
            onFocus={(on) => report(focuses.current, key, on, 'onFocus')}
          />
        )
      })}
    </View>
  )
}

/** Одна карточка: контроллер, положение, касания и клавиатура. */
function StoryPollCard({ poll, storyId, slideId, transport, shopId, texts, slideHeight, region, topLimit, onHold, onFocus }) {
  const theme = usePersonalizationTheme()
  const fonts = { regular: fontFor(theme, '400'), bold: fontFor(theme, '600') }
  const callbacks = useRef({ onHold, onFocus })
  callbacks.current = { onHold, onFocus }
  const [controller] = useState(() =>
    createStoryPollController({
      poll,
      storyId,
      slideId,
      transport,
      shopId,
      texts: texts ? { reanswer: texts.pollReanswerText, error: texts.pollErrorText, submit: texts.pollSubmitText } : null,
      onChange: (next) => setView(next),
      onHold: (on) => callbacks.current.onHold && callbacks.current.onHold(on),
    }),
  )
  const [view, setView] = useState(() => controller.state())
  // Тексты итогов — по языку устройства (русские или английские).
  const [language] = useState(() => storyPollLanguage())
  const results = storyPollResultTexts(language)

  // Поле и клавиатура: фокус — в контроллер (пауза) и слою (тап мимо прячет клавиатуру).
  const input = useRef(null)
  const focused = useRef(false)
  const card = useRef(null)
  const lift = useKeyboardLift(card, focused, topLimit, poll.kind === 'text', input)
  const setFocused = useCallback(
    (on) => {
      if (focused.current === on) return
      focused.current = on
      controller.focus(on)
      callbacks.current.onFocus && callbacks.current.onFocus(on)
      // Клавиатура уже открыта (фокус из другого поля) — сразу на место; ушёл фокус — вниз.
      if (on) lift.place()
      else lift.reset()
    },
    [controller, lift],
  )
  useEffect(() => {
    controller.attach()
    return () => {
      controller.detach()
      if (focused.current) {
        focused.current = false
        callbacks.current.onFocus && callbacks.current.onFocus(false)
        Keyboard.dismiss()
      }
    }
  }, [controller])

  // Поле ушло (ответ принят) — клавиатура тоже.
  useEffect(() => {
    if (view.mode === 'answered' && focused.current) {
      setFocused(false)
      Keyboard.dismiss()
    }
  }, [view.mode, setFocused])

  // Ошибка — для скринридера.
  useEffect(() => {
    if (view.error) AccessibilityInfo.announceForAccessibility?.(view.texts.error)
  }, [view.error, view.texts.error])

  // Фон приложения — клавиатуру убрать.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && focused.current) input.current?.blur?.()
    })
    return () => subscription?.remove?.()
  }, [])

  // Положение: `y_offset` % всей высоты слайда, потом внутрь области между шапкой и кнопками; не
  // влезает целиком — прокрутка внутри.
  const [height, setHeight] = useState(0)
  const space = Math.max(0, region.bottom - region.top)
  const top = storyPollTop(poll.yOffset, slideHeight, region, height)
  const [contentHeight, setContentHeight] = useState(0)
  const scrolls = contentHeight > space + 0.5

  // Касание на карточке: она — ответчик жеста, корню просмотра его не отдаёт. Сдвиг пальца —
  // карточка забирает жест у своих кнопок раньше корня (нажатие отменяется, слайд не листается).
  const start = useRef(null)
  const moved = (event) => {
    const from = start.current
    const { pageX, pageY } = event.nativeEvent
    return !!from && (Math.abs(pageX - from.x) > STORY_TAP_SLOP || Math.abs(pageY - from.y) > STORY_TAP_SLOP)
  }
  const touches = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: moved,
    onResponderTerminationRequest: () => false,
    onTouchStart: (event) => {
      start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }
      controller.press(true)
    },
    onTouchEnd: () => controller.press(false),
    onTouchCancel: () => controller.press(false),
  }

  const body = renderPollBody(poll, view, controller, {
    fonts,
    results,
    language,
    input,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  })

  return (
    <Animated.View style={[styles.slot, { top, transform: [{ translateY: lift.value }] }]} pointerEvents="box-none">
      <View
        ref={card}
        style={[styles.card, { maxHeight: space, opacity: view.sending ? STORY_POLL_STYLE.sendingOpacity : 1 }]}
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        accessibilityState={{ busy: view.sending }}
        {...touches}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          scrollEnabled={scrolls}
          showsVerticalScrollIndicator={scrolls}
          bounces={false}
          keyboardShouldPersistTaps="always"
          onContentSizeChange={(_, h) => setContentHeight(h)}
        >
          {body}
          {view.canReanswer ? (
            <Pressable onPress={() => controller.reanswer()} hitSlop={8} style={styles.reanswer} accessibilityRole="button">
              <Text style={[styles.reanswerText, { fontFamily: fonts.bold }]}>{view.texts.reanswer}</Text>
            </Pressable>
          ) : null}
          {view.error ? (
            <Text style={[styles.error, { fontFamily: fonts.regular }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {view.texts.error}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Animated.View>
  )
}

/**
 * Подъём карточки над клавиатурой: только у карточки с полем в фокусе — так, чтобы её низ (поле и
 * кнопка) был выше клавиатуры на 16, но не выше `topLimit`. Слайд при этом не двигается. На
 * Android «назад» прячет клавиатуру, а фокус оставляет — тогда фокус снимается (иначе слайд стоит).
 */
function useKeyboardLift(card, focused, topLimit, enabled, input) {
  const value = useRef(new Animated.Value(0)).current
  const offset = useRef(0)
  const keyboard = useRef(null)
  const limit = useRef(topLimit)
  limit.current = topLimit
  const animate = useCallback(
    (to) => {
      if (offset.current === to) return
      offset.current = to
      Animated.timing(value, { toValue: to, duration: 200, useNativeDriver: true }).start()
    },
    [value],
  )
  const place = useCallback(() => {
    const frame = keyboard.current
    if (!frame || !focused.current || !card.current) return
    card.current.measureInWindow((x, y, width, height) => {
      if (!(height > 0)) return
      const top = y - offset.current
      const need = Math.max(0, top + height + STORY_POLL_STYLE.keyboardGap - frame.screenY)
      const room = Math.max(0, top - limit.current)
      animate(-Math.min(need, room))
    })
  }, [animate, card, focused])
  const reset = useCallback(() => animate(0), [animate])
  useEffect(() => {
    if (!enabled) return undefined
    const show = (event) => {
      keyboard.current = event && event.endCoordinates ? event.endCoordinates : null
      place()
    }
    const hide = () => {
      keyboard.current = null
      animate(0)
      if (Platform.OS === 'android' && focused.current) input.current?.blur?.()
    }
    const subscriptions =
      Platform.OS === 'ios'
        ? [Keyboard.addListener('keyboardWillChangeFrame', show), Keyboard.addListener('keyboardWillHide', hide)]
        : [Keyboard.addListener('keyboardDidShow', show), Keyboard.addListener('keyboardDidHide', hide)]
    return () => subscriptions.forEach((subscription) => subscription?.remove?.())
  }, [enabled, place, animate, focused, input])
  return React.useMemo(() => ({ value, place, reset }), [value, place, reset])
}

/**
 * Содержимое карточки по виду и состоянию: у отвеченного выбора шапка «Результаты», вопрос, форма или
 * ответ, у отвеченного выбора подвал с благодарностью и числом голосов.
 */
function renderPollBody(poll, view, controller, { fonts, results, language, input, onFocus, onBlur }) {
  const nodes = []
  const answered = view.mode === 'answered'
  const choice = poll.kind === 'single_choice' || poll.kind === 'multiple_choice'
  if (answered && choice) {
    nodes.push(
      <View key="overline" style={styles.overline}>
        <View style={styles.dot} />
        <Text style={[styles.overlineText, { fontFamily: fonts.bold }]}>{results.results}</Text>
      </View>,
    )
  }
  if (poll.question) {
    nodes.push(
      <Text key="question" style={[styles.question, { fontFamily: fonts.bold }]} accessibilityRole="header">
        {poll.question}
      </Text>,
    )
  }
  if (poll.kind === 'scale') {
    nodes.push(<ScaleTrack key="scale" poll={poll} view={view} controller={controller} fonts={fonts} />)
    if (answered && view.thanks) {
      nodes.push(
        <Text key="thanks" style={[styles.band, { fontFamily: fonts.regular }]}>
          {view.thanks}
        </Text>,
      )
    }
  } else if (poll.kind === 'text') {
    if (answered) nodes.push(<TextDone key="done" view={view} fonts={fonts} />)
    else nodes.push(...textForm(poll, view, controller, { fonts, input, onFocus, onBlur }))
  } else if (answered) {
    nodes.push(
      <View key="options" style={styles.options}>
        {poll.options.map((option, index) => (
          <AnsweredOption
            key={option.id}
            index={index}
            label={option.label}
            selected={view.selected.includes(option.id)}
            percent={view.percents ? view.percents[option.id] : null}
            fonts={fonts}
          />
        ))}
      </View>,
      <ResultsFooter key="footer" thanks={view.thanks} votes={storyPollVotes(view.total, language)} results={results} fonts={fonts} />,
    )
  } else {
    const single = poll.kind === 'single_choice'
    nodes.push(
      <View key="options" style={styles.options}>
        {poll.options.map((option, index) => {
          const on = view.selected.includes(option.id)
          return (
            <Pressable
              key={option.id}
              disabled={view.sending}
              onPress={() => (single ? controller.choose(option.id) : controller.toggle(option.id))}
              style={[styles.option, on && styles.optionSelected]}
              accessibilityRole={single ? 'button' : 'checkbox'}
              accessibilityLabel={option.label}
              accessibilityState={single ? { selected: on, disabled: view.sending } : { checked: on, selected: on, disabled: view.sending }}
            >
              <OptionLetter index={index} selected={on} fonts={fonts} />
              <Text style={[styles.optionLabel, { fontFamily: fonts.regular }]} numberOfLines={2}>
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>,
    )
    if (!single) {
      nodes.push(
        <SubmitButton
          key="submit"
          label={view.submitLabel}
          enabled={view.canSubmit}
          onPress={() => controller.submit()}
          fonts={fonts}
          style={styles.optionsSubmit}
        />,
      )
    }
  }
  return nodes
}

/** Квадрат буквы варианта: A, B, C…; у выбранного — заливка цветом выбора и белая галочка. */
function OptionLetter({ index, selected, fonts }) {
  return (
    <View style={[styles.letter, selected && styles.letterSelected]}>
      {selected ? <CheckMark color={ON_ACCENT} /> : <Text style={[styles.letterText, { fontFamily: fonts.bold }]}>{storyPollOptionLetter(index)}</Text>}
    </View>
  )
}

/** Галочка из двух сторон повёрнутого прямоугольника (SVG React Native сам не рисует). */
function CheckMark({ color }) {
  return <View style={[styles.check, { borderColor: color }]} />
}

/** Подвал итогов: «Спасибо! Голос учтён» (или `thanks_text` опроса) и справа число голосов `results.total`. */
function ResultsFooter({ thanks, votes, results, fonts }) {
  return (
    <View style={styles.footer}>
      {thanks ? (
        <Text style={[styles.footerThanks, styles.footerStrong, { fontFamily: fonts.bold }]}>{thanks}</Text>
      ) : (
        <Text style={styles.footerThanks}>
          <Text style={[styles.footerStrong, { fontFamily: fonts.bold }]}>{results.thanks}</Text>
          <Text style={[styles.footerMuted, { fontFamily: fonts.regular }]}>{` ${results.counted}`}</Text>
        </Text>
      )}
      {votes ? <Text style={[styles.footerMuted, styles.votes, { fontFamily: fonts.regular }]}>{votes}</Text> : null}
    </View>
  )
}

/** Форма текста: поле, счётчик `n/limit` (если есть лимит) и кнопка. */
function textForm(poll, view, controller, { fonts, input, onFocus, onBlur }) {
  const nodes = [
    <TextInput
      key="input"
      ref={input}
      style={[styles.input, { fontFamily: fonts.regular }]}
      multiline
      value={view.text}
      onChangeText={(value) => controller.setText(value)}
      placeholder={poll.placeholder || undefined}
      placeholderTextColor={STORY_POLL_STYLE.hint}
      maxLength={view.limit || undefined}
      editable={!view.sending}
      autoFocus={view.reanswered}
      onFocus={onFocus}
      onBlur={onBlur}
      textAlignVertical="top"
      accessibilityLabel={poll.question || poll.placeholder || undefined}
    />,
  ]
  if (view.counter) {
    nodes.push(
      <Text key="counter" style={[styles.counter, { fontFamily: fonts.regular }]}>
        {view.counter}
      </Text>,
    )
  }
  nodes.push(
    <SubmitButton
      key="submit"
      label={view.submitLabel}
      enabled={view.canSubmit}
      onPress={() => controller.submit()}
      fonts={fonts}
      style={styles.textSubmit}
    />,
  )
  return nodes
}

/** Отвеченный текст: кружок с галочкой, рядом `thanks_text` и сам ответ. */
function TextDone({ view, fonts }) {
  return (
    <View style={styles.done}>
      <View style={styles.doneIcon}>
        <CheckMark color={ON_ACCENT} />
      </View>
      {view.thanks || view.answerText ? (
        <View style={styles.doneTexts}>
          {view.thanks ? <Text style={[styles.doneThanks, { fontFamily: fonts.bold }]}>{view.thanks}</Text> : null}
          {view.answerText ? <Text style={[styles.doneText, { fontFamily: fonts.regular }]}>{view.answerText}</Text> : null}
        </View>
      ) : null}
    </View>
  )
}

let reduceMotion = false
AccessibilityInfo.isReduceMotionEnabled?.()
  ?.then?.((on) => {
    reduceMotion = !!on
  })
  ?.catch?.(() => {})

/**
 * Вариант с ответом: мой ответ — граница цвета выбора на обычной подложке и полоса доли цветом выбора,
 * полоса растёт от нуля, справа процент (если есть `results`).
 */
function AnsweredOption({ index, label, selected, percent, fonts }) {
  const shown = percent !== null && percent !== undefined
  const width = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!shown) return
    if (reduceMotion) width.setValue(percent)
    else Animated.timing(width, { toValue: percent, duration: 600, useNativeDriver: false }).start()
  }, [shown, percent, width])
  return (
    <View
      style={[styles.option, selected && styles.optionMine]}
      accessible
      accessibilityLabel={shown ? `${label}, ${percent}%` : label}
      accessibilityState={{ selected }}
    >
      {shown ? (
        <Animated.View
          style={[
            styles.fill,
            selected && styles.fillSelected,
            { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
          ]}
        />
      ) : null}
      <OptionLetter index={index} selected={selected} fonts={fonts} />
      <Text style={[styles.optionLabel, { fontFamily: fonts.regular }]} numberOfLines={2}>
        {label}
      </Text>
      {shown ? <Text style={[styles.percent, { fontFamily: fonts.bold }]}>{`${percent}%`}</Text> : null}
    </View>
  )
}

/**
 * Шкала: дорожка-капсула, значения поровну. Выбранное — капсула на всю высоту дорожки цветом своей
 * полосы (нет полосы — цвет выбора), цифра белая или тёмная по контрасту. Форма — нажатие отправляет;
 * ответ — без нажатий, прочие значения приглушены.
 */
function ScaleTrack({ poll, view, controller, fonts }) {
  const values = storyPollScaleRange(poll.type, poll)
  const min = values[0]
  const max = values[values.length - 1]
  const answered = view.mode === 'answered'
  return (
    <View style={styles.track}>
      {values.map((value) => {
        const on = view.rate === value
        const disabled = answered || view.sending
        const fill = on ? storyPollScaleFill(poll, value, min, max) || STORY_POLL_STYLE.accent : null
        return (
          <Pressable
            key={value}
            disabled={disabled}
            onPress={() => controller.rate(value)}
            style={[styles.step, fill && { backgroundColor: fill }, answered && !on && styles.stepMuted]}
            accessibilityRole="button"
            accessibilityLabel={String(value)}
            accessibilityState={{ selected: on, disabled }}
          >
            <Text
              style={[styles.stepLabel, fill && { color: textOn(fill) }, { fontFamily: fonts.bold }]}
              numberOfLines={1}
            >
              {String(value)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * Кнопка отправки во всю ширину; выключенная — серая.
 *
 * Клавиатура открыта, а виджет стоит в ScrollView хоста: касания модалки идут через ответчики
 * дерева React, и ScrollView хоста (`keyboardShouldPersistTaps` по умолчанию) забирает касание
 * себе, чтобы спрятать клавиатуру, — нажатие до кнопки не доходит. Сырые события касания до неё
 * доходят: тап без нажатия кнопки (без сдвига) — тоже отправка.
 */
function SubmitButton({ label, enabled, onPress, fonts, style }) {
  const pressed = useRef(false)
  const start = useRef(null)
  return (
    <Pressable
      disabled={!enabled}
      onPressIn={() => {
        pressed.current = true
      }}
      onPress={onPress}
      onTouchStart={(event) => {
        start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }
      }}
      onTouchEnd={(event) => {
        const from = start.current
        const stolen = !pressed.current
        pressed.current = false
        start.current = null
        if (!stolen || !enabled || !from) return
        const { pageX, pageY } = event.nativeEvent
        if (Math.abs(pageX - from.x) > STORY_TAP_SLOP || Math.abs(pageY - from.y) > STORY_TAP_SLOP) return
        onPress()
      }}
      onTouchCancel={() => {
        pressed.current = false
        start.current = null
      }}
      style={[styles.submit, !enabled && styles.submitDisabled, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
    >
      <Text style={[styles.submitLabel, !enabled && styles.submitLabelDisabled, { fontFamily: fonts.bold }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const S = STORY_POLL_STYLE

/** Текст и значки на заливке — одно правило для кнопки, галочки и значения шкалы: белые или тёмные по контрасту. */
const textOn = (fill) => (storyPollTextOn(fill) === 'light' ? S.light : S.text)
const ON_ACCENT = textOn(S.accent)
const T = PERSONALIZATION_TYPOGRAPHY
const SPACE = PERSONALIZATION_SPACING
const RADIUS = PERSONALIZATION_RADIUS

const styles = StyleSheet.create({
  slot: { position: 'absolute', left: SPACE.lg, right: SPACE.lg, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: S.maxWidth,
    overflow: 'hidden',
    backgroundColor: S.card,
    borderWidth: S.cardBorderWidth,
    borderColor: S.cardBorder,
    borderRadius: RADIUS.xl6,
  },
  scroll: { flexGrow: 0 },
  content: { padding: SPACE.xl2 },
  overline: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.lg },
  dot: { width: S.dotSize, height: S.dotSize, borderRadius: S.dotSize / 2, backgroundColor: S.accent },
  overlineText: {
    fontSize: T.xsEmphasized.fontSize,
    lineHeight: T.xsEmphasized.lineHeight,
    fontWeight: '600',
    letterSpacing: T.xsEmphasized.fontSize * S.overlineTracking,
    textTransform: 'uppercase',
    color: S.textSecondary,
  },
  question: {
    fontSize: T.lgEmphasized.fontSize,
    lineHeight: S.questionLineHeight,
    fontWeight: '600',
    textAlign: 'left',
    color: S.text,
    marginBottom: SPACE.xl,
  },
  options: { gap: SPACE.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    minHeight: S.optionMinHeight,
    overflow: 'hidden',
    borderRadius: RADIUS.xl5,
    borderWidth: S.selectedBorderWidth,
    borderColor: 'transparent',
    backgroundColor: S.surface,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  optionSelected: { borderColor: S.accent, backgroundColor: S.accentFill },
  optionMine: { borderColor: S.accent },
  // Конец полосы скруглён, как угол строки изнутри рамки.
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    borderRadius: RADIUS.xl5 - S.selectedBorderWidth,
    backgroundColor: S.bar,
  },
  fillSelected: { backgroundColor: S.accentBar },
  letter: {
    width: S.letterSize,
    height: S.letterSize,
    borderRadius: RADIUS.lg,
    backgroundColor: S.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterSelected: { backgroundColor: S.accent },
  letterText: { fontSize: T.smEmphasized.fontSize, lineHeight: T.smEmphasized.lineHeight, fontWeight: '600', color: S.textSecondary },
  check: {
    width: S.checkWidth,
    height: S.checkHeight,
    marginTop: -S.checkStroke,
    borderRightWidth: S.checkStroke,
    borderBottomWidth: S.checkStroke,
    transform: [{ rotate: '45deg' }],
  },
  optionLabel: { flex: 1, fontSize: T.baseDefault.fontSize, lineHeight: T.baseDefault.lineHeight, color: S.text, textAlign: 'left' },
  percent: {
    fontSize: T.baseEmphasized.fontSize,
    lineHeight: T.baseEmphasized.lineHeight,
    fontWeight: '600',
    color: S.text,
    fontVariant: ['tabular-nums'],
  },
  optionsSubmit: { marginTop: SPACE.xl },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.lg, marginTop: SPACE.xl },
  footerThanks: { flex: 1, fontSize: T.smDefault.fontSize, lineHeight: T.smDefault.lineHeight, textAlign: 'left' },
  footerStrong: { fontSize: T.smEmphasized.fontSize, lineHeight: T.smEmphasized.lineHeight, fontWeight: '600', color: S.text },
  footerMuted: { fontSize: T.smDefault.fontSize, lineHeight: T.smDefault.lineHeight, color: S.textSecondary },
  votes: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  submit: {
    alignSelf: 'stretch',
    height: S.controlHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.xl4,
    paddingHorizontal: SPACE.xl,
    backgroundColor: S.accent,
  },
  submitDisabled: { backgroundColor: S.surface },
  submitLabel: { fontSize: T.baseEmphasized.fontSize, lineHeight: T.baseEmphasized.lineHeight, fontWeight: '600', color: ON_ACCENT },
  submitLabelDisabled: { color: S.textSecondary },
  input: {
    minHeight: S.controlHeight,
    maxHeight: S.inputMaxHeight,
    borderRadius: RADIUS.xl4,
    backgroundColor: S.well,
    padding: SPACE.xl,
    fontSize: T.baseDefault.fontSize,
    color: S.text,
    textAlignVertical: 'top',
  },
  counter: {
    marginTop: SPACE.sm,
    fontSize: T.xsDefault.fontSize,
    lineHeight: T.xsDefault.lineHeight,
    color: S.textSecondary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  textSubmit: { marginTop: SPACE.lg },
  track: {
    flexDirection: 'row',
    height: S.trackHeight,
    borderRadius: RADIUS.rounded,
    backgroundColor: S.surface,
    paddingHorizontal: SPACE.sm,
  },
  step: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.rounded },
  stepMuted: { opacity: S.answeredOpacity },
  stepLabel: {
    fontSize: T.baseEmphasized.fontSize,
    lineHeight: T.baseEmphasized.lineHeight,
    fontWeight: '600',
    color: S.text,
    fontVariant: ['tabular-nums'],
  },
  band: { marginTop: SPACE.xl, fontSize: T.smDefault.fontSize, lineHeight: T.smDefault.lineHeight, color: S.text, textAlign: 'left' },
  done: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  doneIcon: {
    width: S.letterSize,
    height: S.letterSize,
    borderRadius: S.letterSize / 2,
    backgroundColor: S.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTexts: { flex: 1, gap: SPACE.xs },
  doneThanks: { fontSize: T.baseEmphasized.fontSize, lineHeight: T.baseEmphasized.lineHeight, fontWeight: '600', color: S.text, textAlign: 'left' },
  doneText: { fontSize: T.smDefault.fontSize, lineHeight: T.smDefault.lineHeight, color: S.textSecondary, textAlign: 'left' },
  reanswer: { alignSelf: 'flex-start', marginTop: SPACE.lg, paddingVertical: SPACE.xs },
  reanswerText: {
    fontSize: T.smEmphasized.fontSize,
    lineHeight: T.smEmphasized.lineHeight,
    fontWeight: '600',
    color: S.text,
    textDecorationLine: 'underline',
  },
  error: {
    marginTop: SPACE.lg,
    fontSize: T.xsDefault.fontSize,
    lineHeight: T.xsDefault.lineHeight,
    color: S.error,
    textAlign: 'left',
  },
})
