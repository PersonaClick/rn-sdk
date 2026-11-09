import React, { useMemo } from 'react'
import { Text } from 'react-native'
import { popupRichSpans } from '../../lib/popupsV3/markup'
import { popupSpanStyle } from './popupV3Style'

let overlineLogged = false

/**
 * Текст попапа v3 с облегчённой разметкой и витринными переменными: вложенные `<Text>` по спанам.
 * Пустой текст — ничего.
 */
export default function PopupV3Text({ text, runtime, style, numberOfLines }) {
  const spans = useMemo(() => popupRichSpans(text, runtime), [text, runtime])
  if (!spans.length) return null
  if (!overlineLogged && spans.some((span) => span.overline)) {
    overlineLogged = true
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[Popups v3] ^^overline^^ is drawn as plain text: React Native has no overline')
  }
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {spans.map((span, index) => {
        const spanStyle = popupSpanStyle(span)
        return Object.keys(spanStyle).length ? (
          <Text key={index} style={spanStyle}>
            {span.text}
          </Text>
        ) : (
          span.text
        )
      })}
    </Text>
  )
}
