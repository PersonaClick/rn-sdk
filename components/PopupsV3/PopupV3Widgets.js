import React, { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { popupApplyRuntimeVariables } from '../../lib/popupsV3/markup'
import { copyToClipboard } from '../design-system/storyNative'
import RecommenderBlock from '../widgets/RecommenderBlock'
import { PopupV3ButtonFace, popupResolveLink } from './PopupV3Basic'
import PopupV3Text from './PopupV3Text'
import { POPUP_MONOSPACE, popupFlexAlign, popupFontFamily, popupTextStyle } from './popupV3Style'

/**
 * Промокод, мини-опрос и рекомендации попапа v3.
 */

/**
 * Промокод: подпись, код (моноширинный, жирный) и «Скопировать» → «Скопировано», затем ссылка
 * применения, если задана. Копирование — событие `click`.
 */
export function PopupV3PromoElement({ element, context }) {
  const { props, box } = element
  const { entry, runtime } = context
  const [copied, setCopied] = useState(false)
  const code = popupApplyRuntimeVariables(props.code, runtime)
  const copy = () => {
    if (!copyToClipboard(code)) return
    setCopied(true)
    entry.event('click')
    const apply = popupResolveLink(props.applyHref, runtime)
    if (apply) entry.openLink(apply)
  }
  const align = popupFlexAlign(props.align)
  return (
    <View style={[styles.promo, { alignItems: align }]}>
      {props.label ? <PopupV3Text text={props.label} runtime={runtime} style={[popupTextStyle(box), { textAlign: props.align }]} /> : null}
      <View style={[styles.promoCode, { backgroundColor: props.codeBg, borderRadius: props.codeRadius }]}>
        <Text selectable style={[styles.promoValue, { color: props.codeColor, fontSize: props.codeFontSize }]}>
          {code}
        </Text>
        {props.showCopy ? (
          <Pressable onPress={copy} hitSlop={8} accessibilityRole="button">
            <PopupV3Text text={copied ? props.copiedText : props.copyText} runtime={runtime} style={[styles.promoCopy, { color: props.codeColor }]} />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

/**
 * Мини-опрос: вопрос, шкала (NPS 0–10, CSAT 1–5, CES 1–7), после оценки — комментарий и кнопка,
 * затем «спасибо». Отправка — отзыв в API v3 опросов, событие `submit`; ошибка — её текст под
 * формой, повтор той же кнопкой.
 */
export function PopupV3SurveyElement({ element, context }) {
  const { props, box } = element
  const { entry, runtime, texts } = context
  const [rate, setRate] = useState(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')
  const sending = useRef(false)
  const commentRef = useRef(null)
  const family = popupFontFamily(box.fontFamily)
  const textStyle = popupTextStyle(box)

  const submit = async () => {
    if (sending.current || rate === null) return
    sending.current = true
    setError('')
    setStatus('sending')
    try {
      await entry.actions.submitSurvey(props, rate, comment)
      entry.event('submit')
      setStatus('done')
    } catch (failure) {
      const reason = failure && failure.message ? failure.message : ''
      entry.log(`survey failed: ${failure && failure.code !== undefined ? failure.code : ''} ${reason}`)
      setError(reason ? `${texts.sendError} (${reason})` : texts.sendError)
      setStatus('idle')
    } finally {
      sending.current = false
    }
  }

  if (status === 'done') {
    return <PopupV3Text text={props.thanksText} runtime={runtime} style={[textStyle, styles.bold]} />
  }
  const scores = []
  for (let score = props.scale[0]; score <= props.scale[1]; score += 1) scores.push(score)
  return (
    <View style={styles.survey}>
      {props.question ? <PopupV3Text text={props.question} runtime={runtime} style={[textStyle, styles.bold]} /> : null}
      <View style={styles.scale}>
        {scores.map((score) => {
          const active = score === rate
          return (
            <Pressable
              key={score}
              onPress={() => setRate(score)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.score, { backgroundColor: active ? props.activeBg : props.scaleBg }]}
            >
              <Text style={[styles.scoreText, { color: active ? props.activeColor : props.scaleColor }, family ? { fontFamily: family } : null]}>{score}</Text>
            </Pressable>
          )
        })}
      </View>
      {props.minLabel || props.maxLabel ? (
        <View style={styles.labels}>
          <PopupV3Text text={props.minLabel} runtime={runtime} style={[styles.label, { color: box.textColor }]} />
          <PopupV3Text text={props.maxLabel} runtime={runtime} style={[styles.label, styles.labelEnd, { color: box.textColor }]} />
        </View>
      ) : null}
      {rate !== null ? (
        <View style={styles.survey}>
          <TextInput
            ref={commentRef}
            onFocus={() => context.reveal && context.reveal(commentRef)}
            value={comment}
            onChangeText={setComment}
            placeholder={popupApplyRuntimeVariables(props.commentPlaceholder, runtime)}
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[styles.comment, { color: box.textColor }, family ? { fontFamily: family } : null]}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PopupV3ButtonFace
            button={props.button}
            text={props.submitText}
            runtime={runtime}
            onPress={submit}
            disabled={status !== 'idle'}
            style={styles.submit}
          />
        </View>
      ) : null}
    </View>
  )
}

/**
 * Рекомендации по коду блока: лента товаров кита (запрос, кеш, источник `dynamic` при нажатии).
 * Нажатие на товар — событие `click`, затем хук хоста `onProductClick` (открыл сам — попап
 * закрывается) или ссылка товара. До загрузки — пустое место 40.
 */
export function PopupV3RecommendationElement({ element, context }) {
  const { props } = element
  const { entry } = context
  return (
    <View style={{ minHeight: props.minHeight }}>
      <RecommenderBlock
        sdk={entry.sdk}
        code={props.code}
        layout="carousel"
        onProductPress={(product) => entry.openProduct(product)}
        onError={(error) => entry.log(`recommendations ${props.code} failed: ${(error && error.message) || error}`)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  promo: { gap: 6 },
  promoCode: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 14, maxWidth: '100%' },
  promoValue: { fontFamily: POPUP_MONOSPACE, fontWeight: '700', letterSpacing: 1, flexShrink: 1 },
  promoCopy: { fontSize: 11, fontWeight: '500', opacity: 0.8 },
  survey: { gap: 10 },
  bold: { fontWeight: '600' },
  scale: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  score: { minWidth: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  scoreText: { fontSize: 13, fontWeight: '600' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, opacity: 0.7 },
  label: { fontSize: 11, flexShrink: 1 },
  labelEnd: { textAlign: 'right' },
  comment: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, minHeight: 64 },
  error: { color: '#b91c1c', fontSize: 12, lineHeight: 16 },
  submit: { alignSelf: 'flex-start' },
})
