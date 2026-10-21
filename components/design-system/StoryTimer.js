import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import { timerRemaining, timerText } from './storySupport'

/**
 * StoryTimer — обратный отсчёт до `endTime` (дни, часы, минуты, секунды).
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories (1:32), компонент Timer в двух видах:
 * - `merged` — одна пилюля со скруглением 12, поля 8/12, шаг 12;
 * - `separate` — четыре коробки со скруглением 8, поля 8/12, шаг 8, каждая тянется поровну.
 * Заливка — Neutral 100 (чёрный или белый 10 % по схеме). Единица — число SemiBold 36
 * Text/Primary и подпись Regular 20 Text/Secondary, шаг 2, по базовой линии. Подписи по
 * умолчанию d / h / m / s, меняются через `labels`.
 *
 * Тикает раз в секунду и останавливается на нуле (`onEnd` — один раз). Часы, минуты и секунды —
 * двумя цифрами. В API сторис таймера нет — это компонент для хоста.
 *
 * @param {{ endTime: Date|number|string, view?: 'merged'|'separate',
 *           labels?: { days?: string, hours?: string, minutes?: string, seconds?: string },
 *           onEnd?: Function, style?: object }} props
 */
export default function StoryTimer({ endTime, view = 'merged', labels, onEnd, style }) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const [left, setLeft] = useState(() => timerRemaining(endTime))
  const onEndRef = useRef(onEnd)
  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    const tick = () => timerRemaining(endTime)
    setLeft(tick())
    if (tick() <= 0) return undefined
    const id = setInterval(() => {
      const next = tick()
      setLeft(next)
      if (next <= 0) {
        clearInterval(id)
        onEndRef.current && onEndRef.current()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [endTime])

  const text = timerText(left)
  const names = { ...DEFAULT_LABELS, ...(labels || {}) }
  const units = [
    [text.days, names.days],
    [text.hours, names.hours],
    [text.minutes, names.minutes],
    [text.seconds, names.seconds],
  ]
  const separate = view === 'separate'

  const unit = ([value, label], index) => (
    <View key={index} style={[styles.unit, separate && [styles.box, { backgroundColor: colors.neutral100 }]]}>
      <Text style={[styles.value, { fontFamily: fontFor(theme, '600'), color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.label, { fontFamily: fontFor(theme, '400'), color: colors.textSecondary }]}>{label}</Text>
    </View>
  )

  return (
    <View
      style={[
        separate ? styles.separate : [styles.merged, { backgroundColor: colors.neutral100 }],
        style,
      ]}
      accessibilityRole="timer"
      accessibilityLabel={units.map(([value, label]) => `${value}${label}`).join(' ')}
    >
      {units.map(unit)}
    </View>
  )
}

const DEFAULT_LABELS = { days: 'd', hours: 'h', minutes: 'm', seconds: 's' }

const styles = StyleSheet.create({
  merged: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  separate: { flexDirection: 'row', gap: 8 },
  box: { flexGrow: 1, flexBasis: 0, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  unit: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  value: { fontSize: 36, lineHeight: 44, fontWeight: '600' },
  label: { fontSize: 20, lineHeight: 24, fontWeight: '400' },
})
