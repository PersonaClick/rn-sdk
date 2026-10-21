import React from 'react'
import { View, Image, StyleSheet } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import FavoritesBadge from './FavoritesBadge'
import Shimmer from './Shimmer'
import { storyIconRenderer } from './storyIcons'

/**
 * StoryCover — обложка сторис: картинка в круге и кольцо состояния, 88x88.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories (1:32), компонент Story/Cover и
 * Progress/Circular на странице Components.
 *
 * Кольцо — обводка 4 внутрь круга 88, картинка — круг 76 на отступе 6 (между ними зазор 2).
 * Состояния:
 * - `default` — кольцо Button/Primary;
 * - `pinned` — кольцо Semantic/Warning и бейдж Favorites (24, звезда 16) в правом нижнем углу,
 *   в точке 62,62;
 * - `viewed` — кольцо Semantic/Neutral Subtle;
 * - `skeleton` — кольцо и картинка — основа Neutral 50 с бликом (Shimmer).
 *
 * Сегменты (Progress/Circular, 1…n): `segments` делит кольцо на дуги с небольшими зазорами —
 * по дуге на слайд; показанные слайды красятся Button/Primary Disabled (Brand/Primary 65 %),
 * остальные — цветом состояния. `seenSegments` — индексы показанных слайдов (A5: сегмент i
 * отмечен, если показан слайд i) или число — тогда отмечены первые столько. Без `segments`
 * кольцо сплошное. Просмотренная сторис — всегда сплошное кольцо Neutral Subtle, без сегментов и
 * зазоров, что бы ни пришло в `segments` (состояние Viewed в макете, так же на Android).
 *
 * Дуги рисуются без SVG: половина кольца (две соседние стороны рамки круга) поворачивается
 * внутри полукруглой обрезки, как в чистых RN-индикаторах прогресса. Дуга до 180°, а больше
 * одна дуга и не бывает: один сегмент — это сплошное кольцо.
 *
 * Звезда бейджа — иконка кита: отрисовку задаёт `renderIcon`, как у остальных компонентов, а без
 * него рисуется встроенная (storyIcons).
 *
 * @param {{ source?: object, state?: 'default'|'pinned'|'viewed'|'skeleton',
 *           segments?: number, seenSegments?: number|number[],
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function StoryCover({ source, state = 'default', segments, seenSegments, renderIcon, style }) {
  const { colors } = usePersonalizationTheme()

  if (state === 'skeleton') {
    return (
      <Shimmer style={[styles.cover, styles.round, style]}>
        <View style={[styles.ring, { borderColor: colors.neutral50 }]} />
        <View style={[styles.image, { backgroundColor: colors.neutral50 }]} />
      </Shimmer>
    )
  }

  const ringColor = coverRingColor(state, colors)
  const { count, lit } = coverRingSegments(state, segments, seenSegments)

  let ring
  if (count > 1) {
    ring = storyRingArcs(count).map((arc, index) => (
      <Arc
        key={index}
        start={arc.start}
        sweep={arc.sweep}
        color={lit[index] ? colors.buttonPrimaryDisabled : ringColor}
      />
    ))
  } else {
    // Один сегмент — сплошное кольцо; показанный — цветом показанных.
    const color = count === 1 && lit[0] ? colors.buttonPrimaryDisabled : ringColor
    ring = <View style={[styles.ring, { borderColor: color }]} />
  }

  return (
    <View style={[styles.cover, style]}>
      {ring}
      {/* Заглушка до загрузки — Neutral 50, как у картинки товара. */}
      <View style={[styles.image, { backgroundColor: colors.neutral50 }]}>
        {source ? <Image source={source} style={styles.picture} resizeMode="cover" /> : null}
      </View>
      {state === 'pinned' ? <FavoritesBadge renderIcon={storyIconRenderer(renderIcon)} style={styles.badge} /> : null}
    </View>
  )
}

/**
 * Сколько дуг у кольца и какие из них отмечены показанными (`lit[i]`). `seenSegments` — индексы
 * показанных слайдов или число (отмечены первые столько). Просмотренная — одно сплошное кольцо
 * (`count` 0: без сегментов, цветом состояния).
 *
 * @returns {{ count: number, lit: boolean[] }}
 */
export function coverRingSegments(state, segments, seenSegments) {
  if (state === 'viewed' || state === 'skeleton') return { count: 0, lit: [] }
  const count = Math.max(0, Math.floor(Number(segments) || 0))
  let lit
  if (Array.isArray(seenSegments)) {
    const indexes = new Set(seenSegments.map((index) => Math.floor(Number(index))))
    lit = Array.from({ length: count }, (_, index) => indexes.has(index))
  } else {
    const first = Math.max(0, Math.min(count, Math.floor(Number(seenSegments) || 0)))
    lit = Array.from({ length: count }, (_, index) => index < first)
  }
  return { count, lit }
}

/** Цвет кольца по состоянию. */
export function coverRingColor(state, colors) {
  if (state === 'pinned') return colors.semanticWarning
  if (state === 'viewed') return colors.neutralSubtle
  return colors.buttonPrimary
}

const COVER = 88
const STROKE = 4
/** Зазор между сегментами по средней линии кольца, pt. */
const SEGMENT_GAP = 4

/**
 * Дуги сегментированного кольца, градусы по часовой от 12 часов: `start` — начало дуги,
 * `sweep` — её длина. Зазор `SEGMENT_GAP` по средней линии кольца, по половине с каждой
 * стороны сегмента.
 *
 * @param {number} count
 * @returns {Array<{ start: number, sweep: number }>}
 */
export function storyRingArcs(count) {
  const n = Math.max(1, Math.floor(count))
  if (n === 1) return [{ start: 0, sweep: 360 }]
  const step = 360 / n
  const gap = (SEGMENT_GAP / (Math.PI * (COVER - STROKE))) * 360
  const sweep = Math.max(1, step - gap)
  return Array.from({ length: n }, (_, index) => ({ start: index * step + (step - sweep) / 2, sweep }))
}

/**
 * Дуга кольца до 180°. Полукольцо — левая и нижняя стороны рамки круга, повёрнутые на 45°, —
 * лежит в левой половине; поворот на `sweep` выводит в правую ровно дугу 0…sweep, а обрезка по
 * правой половине прячет остальное. Внешний поворот на `start` ставит дугу на место.
 */
function Arc({ start, sweep, color }) {
  return (
    <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${start}deg` }] }]}>
      <View style={styles.arcClip}>
        <View
          style={[
            styles.arcHalf,
            { borderLeftColor: color, borderBottomColor: color, transform: [{ rotate: `${45 + sweep}deg` }] },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  cover: { width: COVER, height: COVER },
  round: { borderRadius: COVER / 2 },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: COVER / 2,
    borderWidth: STROKE,
  },
  image: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
  },
  // Размеры явно, а не absoluteFill: локальный ресурс подставляет свой размер в начало стиля.
  picture: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  badge: { position: 'absolute', left: 62, top: 62 },
  arcClip: {
    position: 'absolute',
    left: COVER / 2,
    top: 0,
    width: COVER / 2,
    height: COVER,
    overflow: 'hidden',
  },
  arcHalf: {
    position: 'absolute',
    left: -COVER / 2,
    top: 0,
    width: COVER,
    height: COVER,
    borderRadius: COVER / 2,
    borderWidth: STROKE,
    borderColor: 'transparent',
  },
})
