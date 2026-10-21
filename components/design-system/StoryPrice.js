import React, { useRef, useState } from 'react'
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'
import { splitCurrency, storyPromoLayout, STORY_PROMO_CODE_SIZE } from './storySupport'
import { copyToClipboard } from './storyNative'
import { storyIconRenderer } from './storyIcons'

/**
 * StoryPrice — плашка цены на товарном слайде сторис.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories (1:32), компонент Card/Story/Price.
 *
 * Коробка со скруглением 12, заливка #F2F2F2 с прозрачностью 95 % — в макете это сырой цвет, не
 * переменная, одинаковый в обеих схемах, поэтому он константа компонента, а текст всегда тёмный
 * (Text/Dark *). Левая колонка с полями 12/16: старая цена (необязательная, группа с
 * прозрачностью 50 %: сумма SemiBold 14 зачёркнутая и валюта Regular 14/16, Text/Dark Secondary)
 * над ценой (сумма SemiBold 24 и валюта Regular 14/16 с шагом 4 по базовой линии,
 * Text/Dark Primary). Валюта отделяется от суммы по хвосту строки: `"1 190 900 ₽"` →
 * `1 190 900` + `₽`.
 *
 * Виды:
 * - `price` — только левая колонка;
 * - `discount` — справа блок Brand/Primary с полями 0/16 и скидкой SemiBold 36
 *   Text/Light Primary («10%»), левая колонка забирает остальное;
 * - `promoCode` — справа чёрный блок (Text/Dark Primary) с полями 12/16: подпись SemiBold 14
 *   Text/Light Secondary («Promo code») и код SemiBold 24 Text/Light Primary, иконка copy
 *   (24, Text/Light Hint) в правом верхнем углу на отступе 4. Колонки делят ширину поровну,
 *   длинный код забирает сколько ему нужно, но не больше 65 % ряда, дальше ужимается до кегля 14
 *   (`storyPromoLayout`).
 *
 * Нажатие на блок промокода: блок чуть увеличивается (1.03, как Tap Zoom Effect в макете), код
 * уходит в буфер обмена, показывается тост (`copiedText`, по умолчанию «Copied», сверху экрана —
 * `toastPosition`) через презентер из `toastRef` и вызывается `onPromoCopied(code)`. Буфер —
 * @react-native-clipboard/clipboard (необязательная peer-зависимость), без него — устаревший
 * Clipboard ядра React Native; не вышло — ни тоста, ни колбэка. Иконку copy без `renderIcon`
 * рисует встроенная (storyIcons).
 *
 * Высоты строк в макете смешивают ступени, поэтому кегли заданы здесь явно.
 *
 * @param {{ type?: 'price'|'discount'|'promoCode', price: string, oldPrice?: string,
 *           discount?: string, promoCode?: string, promoCaption?: string, copiedText?: string,
 *           toastRef?: { current: { show: Function } | null },
 *           toastPosition?: 'top'|'bottom', onPromoCopied?: (code: string) => void,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function StoryPrice({
  type = 'price',
  price,
  oldPrice,
  discount,
  promoCode,
  promoCaption = 'Promo code',
  copiedText = 'Copied',
  toastRef,
  toastPosition = 'top',
  onPromoCopied,
  renderIcon,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const semibold = fontFor(theme, '600')
  const regular = fontFor(theme, '400')
  const scale = useRef(new Animated.Value(1)).current
  const [rowWidth, setRowWidth] = useState(0)
  const [codeWidth, setCodeWidth] = useState(0)

  const current = splitCurrency(price)
  const old = oldPrice ? splitCurrency(oldPrice) : null

  const left = (
    <View style={[styles.left, type !== 'price' && styles.shared]}>
      {old ? (
        <View style={[styles.amountRow, styles.faded]}>
          <Text
            style={[
              styles.oldAmount,
              { fontFamily: semibold, color: colors.textDarkSecondary, textDecorationLine: 'line-through' },
            ]}
          >
            {old.amount}
          </Text>
          {old.currency ? (
            <Text style={[styles.currency, { fontFamily: regular, color: colors.textDarkSecondary }]}>{old.currency}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.amountRow}>
        <Text style={[styles.amount, { fontFamily: semibold, color: colors.textDarkPrimary }]} numberOfLines={1}>
          {current.amount}
        </Text>
        {current.currency ? (
          <Text style={[styles.currency, { fontFamily: regular, color: colors.textDarkPrimary }]}>{current.currency}</Text>
        ) : null}
      </View>
    </View>
  )

  let right = null
  if (type === 'discount' && discount) {
    right = (
      <View style={[styles.discount, { backgroundColor: colors.brandPrimary }]}>
        <Text style={[styles.discountText, { fontFamily: semibold, color: colors.textLightPrimary }]}>{discount}</Text>
      </View>
    )
  } else if (type === 'promoCode' && promoCode) {
    const press = () => {
      if (!copyToClipboard(promoCode)) return
      if (copiedText && toastRef?.current) toastRef.current.show(copiedText, toastPosition)
      onPromoCopied && onPromoCopied(promoCode)
    }
    const zoom = (to) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
    // До замеров колонки делят ряд поровну, после — блок ровно той ширины, что дал расчёт.
    const layout = rowWidth > 0 && codeWidth > 0 ? storyPromoLayout(rowWidth, codeWidth) : null
    const codeFont = { fontFamily: semibold, color: colors.textLightPrimary }
    right = (
      <Animated.View style={[layout ? { width: layout.width } : styles.shared, { transform: [{ scale }] }]}>
        <Pressable
          onPress={press}
          onPressIn={() => zoom(PRESS_SCALE)}
          onPressOut={() => zoom(1)}
          accessibilityRole="button"
          accessibilityLabel={`${promoCaption} ${promoCode}`}
          style={[styles.promo, { backgroundColor: colors.textDarkPrimary }]}
        >
          <Text style={[styles.caption, { fontFamily: semibold, color: colors.textLightSecondary }]} numberOfLines={1}>
            {promoCaption}
          </Text>
          <Text
            style={[styles.code, codeFont, { fontSize: layout ? layout.fontSize : STORY_PROMO_CODE_SIZE }]}
            numberOfLines={1}
          >
            {promoCode}
          </Text>
          <View style={styles.copy}>
            {storyIconRenderer(renderIcon)(PERSONALIZATION_ICONS.copy, colors.textLightHint, 24)}
          </View>
        </Pressable>
      </Animated.View>
    )
    // Невидимый замер кода на кегле 24 в заведомо широком ряду: ширина ряда коробки его не режет.
    right = (
      <>
        <View
          pointerEvents="none"
          style={styles.measure}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            style={[styles.code, codeFont]}
            onLayout={(event) => setCodeWidth(Math.ceil(event.nativeEvent.layout.width))}
          >
            {promoCode}
          </Text>
        </View>
        {right}
      </>
    )
  }

  return (
    <View
      style={[styles.box, style]}
      onLayout={type === 'promoCode' ? (event) => setRowWidth(event.nativeEvent.layout.width) : undefined}
    >
      {left}
      {right}
    </View>
  )
}

/** Заливка коробки: сырой #F2F2F2 с прозрачностью 95 % из макета, одна на обе схемы. */
const PRICE_BOX = 'rgba(242, 242, 242, 0.95)'
/** Увеличение блока промокода при нажатии. */
const PRESS_SCALE = 1.03

const styles = StyleSheet.create({
  // Правый блок скругляет свои углы сам: у коробки нет обрезки, иначе увеличение при нажатии
  // срезалось бы её краем.
  box: { flexDirection: 'row', borderRadius: 12, backgroundColor: PRICE_BOX },
  left: { flexGrow: 1, flexShrink: 1, paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'center' },
  // Колонки промокода делят ширину поровну: основа 0 и равный рост; минимум — замер кода.
  shared: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  faded: { opacity: 0.5 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  oldAmount: { fontSize: 14, lineHeight: 16, fontWeight: '600' },
  amount: { fontSize: 24, lineHeight: 30, fontWeight: '600', flexShrink: 1 },
  currency: { fontSize: 14, lineHeight: 16, fontWeight: '400' },
  discount: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  discountText: { fontSize: 36, lineHeight: 44, fontWeight: '600' },
  promo: {
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  measure: { position: 'absolute', left: 0, top: 0, width: 2000, flexDirection: 'row', opacity: 0 },
  caption: { fontSize: 14, lineHeight: 16, fontWeight: '600' },
  code: { fontSize: 24, lineHeight: 30, fontWeight: '600' },
  copy: { position: 'absolute', top: 4, right: 4, width: 24, height: 24 },
})
