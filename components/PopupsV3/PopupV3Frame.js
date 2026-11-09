import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, ScrollView, StyleSheet, View } from 'react-native'
import { POPUP_ROWS_GAP } from '../../lib/popupsV3/design'
import PopupV3Element from './PopupV3Elements'
import { popupFlexJustify } from './popupV3Style'

/**
 * Рамка попапа v3 и сетка внутри неё. Рамка (фон, граница, радиус) стоит на месте, содержимое выше
 * доступной высоты прокручивается внутри; пока помещается — прокрутки нет и касания не уходят в неё.
 */

const ROW_IMAGE_MODES = { cover: 'cover', contain: 'contain', auto: 'center' }
/** Зазор над клавиатурой у поля, прокрученного в видимую часть. */
const REVEAL_GAP = 12

/** Строка сетки: ячейки по долям колонок, промежуток, минимальная высота, фон цветом или картинкой. */
function PopupV3Row({ row, context }) {
  return (
    <View style={[styles.row, { gap: row.gap, minHeight: row.minHeight }, row.bgColor ? { backgroundColor: row.bgColor } : null]}>
      {row.bgImage ? (
        <Image
          source={{ uri: row.bgImage.url }}
          style={StyleSheet.absoluteFill}
          resizeMode={row.bgImage.repeat !== 'no-repeat' ? 'repeat' : ROW_IMAGE_MODES[row.bgImage.size] || 'cover'}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {row.cells.map((cell, index) => (
        <View
          key={index}
          style={[styles.cell, { flexGrow: cell.fraction, gap: row.gap, justifyContent: popupFlexJustify(cell.verticalAlign) }]}
        >
          {cell.elements.map((element, position) => (
            <PopupV3Element key={element.id || position} element={element} cellAlign={cell.align} context={context} />
          ))}
        </View>
      ))}
    </View>
  )
}

/** Сетка дизайна: строки столбиком; старый дизайн без строк — элементы столбиком по `y`. */
export const PopupV3Grid = React.forwardRef(function PopupV3Grid({ model, context }, ref) {
  if (model.free) {
    return (
      <View ref={ref} style={styles.rows}>
        {model.free.map((element, position) => (
          <PopupV3Element key={element.id || position} element={element} cellAlign="left" context={context} />
        ))}
      </View>
    )
  }
  return (
    <View ref={ref} style={styles.rows}>
      {model.rows.map((row, index) => (
        <PopupV3Row key={row.id || index} row={row} context={context} />
      ))}
    </View>
  )
})

/**
 * Рамка по геометрии `popupFrameLayout`. `fill` — фуллскрин: рамка на всю доступную область.
 * `onScrollableChange(scrollable)` — содержимое перестало или начало помещаться.
 */
export default function PopupV3Frame({ frame, model, context, fill = false, style, onScrollableChange }) {
  const [contentHeight, setContentHeight] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const scrollable = viewportHeight > 0 && contentHeight > viewportHeight + 0.5
  const fixed = fill || frame.height !== null
  useEffect(() => {
    if (onScrollableChange) onScrollableChange(scrollable)
  }, [scrollable, onScrollableChange])

  // Поле в фокусе прокручивается в видимую часть: клавиатура сжимает рамку, а ScrollView сам
  // к полю не едет. Повторяется, пока рамка меняет высоту после появления клавиатуры.
  const scrollRef = useRef(null)
  const gridRef = useRef(null)
  const scrollY = useRef(0)
  const viewport = useRef(0)
  const pending = useRef(null)
  const revealNow = useCallback(() => {
    const target = pending.current
    if (!target || target.until < Date.now() || !target.ref.current || !gridRef.current || !scrollRef.current) return
    target.ref.current.measureLayout(
      gridRef.current,
      (x, y, width, height) => {
        const top = y + frame.padding
        const bottom = top + height
        const visible = viewport.current
        if (bottom + REVEAL_GAP > scrollY.current + visible) scrollRef.current.scrollTo({ y: bottom + REVEAL_GAP - visible, animated: true })
        else if (top - REVEAL_GAP < scrollY.current) scrollRef.current.scrollTo({ y: Math.max(0, top - REVEAL_GAP), animated: true })
      },
      () => {},
    )
  }, [frame.padding])
  const reveal = useCallback(
    (ref) => {
      pending.current = { ref, until: Date.now() + 1500 }
      setTimeout(revealNow, 120)
      setTimeout(revealNow, 450)
    },
    [revealNow],
  )
  // Фон рамки — под элементами без своего фона: по нему кит внутри выбирает схему.
  const frameContext = useMemo(() => ({ ...context, reveal, frameBg: frame.bgColor }), [context, reveal, frame.bgColor])
  return (
    <View
      style={[
        styles.frame,
        fill
          ? styles.fill
          : {
              width: frame.width,
              maxHeight: frame.maxHeight,
              minHeight: frame.minHeight,
              height: frame.height === null ? undefined : frame.height,
            },
        {
          backgroundColor: frame.bgColor,
          borderRadius: frame.borderRadius,
          borderWidth: frame.borderWidth,
          borderColor: frame.borderColor,
        },
        style,
      ]}
    >
      <ScrollView
        ref={scrollRef}
        style={fixed ? styles.fill : styles.shrink}
        contentContainerStyle={{ padding: frame.padding }}
        scrollEnabled={scrollable}
        showsVerticalScrollIndicator={scrollable}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y
        }}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.height
          setViewportHeight(event.nativeEvent.layout.height)
          revealNow()
        }}
        onContentSizeChange={(width, height) => setContentHeight(height)}
      >
        <PopupV3Grid ref={gridRef} model={model} context={frameContext} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  fill: { flex: 1 },
  shrink: { flexGrow: 0, flexShrink: 1 },
  rows: { gap: POPUP_ROWS_GAP },
  row: { flexDirection: 'row', overflow: 'hidden' },
  cell: { flexShrink: 1, flexBasis: 0, minWidth: 0, flexDirection: 'column', alignItems: 'stretch' },
})
