import React, { useCallback, useState } from 'react'
import { View, Text, Image, StyleSheet, Platform } from 'react-native'
import { fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_SPACING } from '../../constants/spacing.constants'
import { PERSONALIZATION_ELEVATION } from '../../constants/elevation.constants'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'
import Barcode from './Barcode'
import { encodeCode128 } from './code128'

/**
 * LoyaltyCard — карта лояльности в духе пропуска Apple Wallet.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Loyalty (1:34), фреймы Wallet/iOS/Light Theme
 * (570:9879) и Wallet/iOS/Dark Theme (570:10131); компонент Wallet (570:9111) в секции Card
 * страницы Components. Части: Header, Wallet/Logo (570:9034), поля Wallet (559:8973),
 * Wallet/Stripe (520:8923), Wallet/Stamps (570:10384), Wallet/Info (570:9081), Wallet/Code (520:8886).
 *
 * Компонент чисто визуальный: getLoyaltyStatus отдаёт только участие и уровень, баланса, штампов
 * и номера карты в нём нет, так что всё содержимое даёт хост. Форма вступления не рисуется.
 *
 * Карта во всю ширину родителя, высота не меньше ширина x 560 / 370 (пропорция пропуска
 * 370 x 560) и растёт, если содержимое выше. Скругление 2XL (12), содержимое обрезается по нему;
 * рамка 1 внутрь цвета Line/Generic Subtle — поверх содержимого, как внутренняя обводка в макете;
 * тень Elevation 3. Фон — Background/Card или `cardColor` (в тёмном примере макета это синий
 * #0087E8, Semantic/Info — такого токена у нас нет, цвет даёт хост). Цвет подписей и значений —
 * Text/Primary или `contentColor`; логотип — картинка хоста, кит его не красит (для
 * одноцветного логотипа хост может передать `logoTintColor`).
 *
 * Секции сверху вниз, без зазоров:
 * 1. Шапка: логотип высотой 33 (ширина по пропорции картинки) и баланс справа — подпись над
 *    значением. Нет ни логотипа, ни баланса — нет шапки.
 * 2. Лента: высота = ширина / 2.6 (полоса пропуска 375 x 144). Слои: чёрная подложка, картинка
 *    с обрезкой по центру, чёрная вуаль 30 %, эмблема, ряд штампов. Эмблема высотой 1.4545 высоты
 *    ленты, правым краем вылезает за ленту на 0.17 высоты, верх на −0.1166 высоты, лента её
 *    обрезает — так в макете (179.5 x 205.8 при x = 212.5, y = −16.5 в ленте 368 x 141.5).
 *    Ленты нет, если нет ни картинки, ни эмблемы, ни штампов.
 * 3. Штампы (внутри ленты): ряд от начала, поля 16, по центру по высоте, иконки 32 через 8.
 *    Первые `stamps` — check-rosette-fill цвета Text/Light Secondary, остальные до `stampsTotal` —
 *    rosette цвета Text/Light Hint. Лента в макете принудительно тёмная, поэтому цвета — светлый
 *    текст, от схемы не зависят. `stamps` зажимается в 0…stampsTotal.
 * 4. Инфо: поля в ряд поровну, поля 16, зазор 20 (Gap Modal). Поле — подпись и значение в одну
 *    строку с многоточием. Флаг Show Owner из макета — это просто есть поле владельца или нет.
 * 5. Код: забирает оставшуюся высоту, содержимое прижато вниз по центру; поля 24 сверху и снизу,
 *    16 по бокам. Белая подложка (скругление LG, поле 20, рамка Line/Generic Subtle) и Barcode
 *    232 x 42. Нет кода или его не закодировать — секции нет, минимальная высота остаётся.
 *
 * Картинки — `source` для Image, как у попапа: кит сам ничего не грузит. Ширину логотипа и
 * эмблемы компонент берёт из размеров картинки: у локального ресурса и у `{ uri, width, height }`
 * они известны сразу, у сетевой без размеров — после загрузки (до неё слот квадратный).
 *
 * Иконки штампов: React Native не рисует SVG сам, исходники отдаются через renderIcon.
 * Без него место под штампы сохраняется.
 *
 * @param {{ logoSource?: object, logoTintColor?: string,
 *           balanceLabel?: string, balanceValue?: string,
 *           stripeSource?: object, emblemSource?: object,
 *           stamps?: number, stampsTotal?: number,
 *           fields?: Array<{ label?: string, value?: string }>,
 *           code?: string, cardColor?: string, contentColor?: string,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           style?: object }} props
 */
export default function LoyaltyCard({
  logoSource,
  logoTintColor,
  balanceLabel,
  balanceValue,
  stripeSource,
  emblemSource,
  stamps = 0,
  stampsTotal = 0,
  fields,
  code,
  cardColor,
  contentColor,
  renderIcon,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const [width, setWidth] = useState(0)
  const [logoAspect, onLogoLoad] = useImageAspect(logoSource)
  const [emblemAspect, onEmblemLoad] = useImageAspect(emblemSource)

  const layout = loyaltyCardLayout({
    logoSource,
    balanceLabel,
    balanceValue,
    stripeSource,
    emblemSource,
    stamps,
    stampsTotal,
    fields,
    code,
  })

  const radius = theme.radius.xl2
  const content = contentColor || colors.textPrimary
  const label = [
    styles.label,
    { fontFamily: fontFor(theme, '600'), color: content },
  ]
  const regular = { fontFamily: fontFor(theme, '400'), color: content }

  // Тень и обрезка по скруглению — на разных View, как у попапа: `overflow: 'hidden'` на iOS
  // срезает и тень. На iOS цвет тени — Shadow/Heavy из темы, на Android тень рисует система.
  const shadow =
    Platform.OS === 'android'
      ? PERSONALIZATION_ELEVATION.e3.android
      : { ...PERSONALIZATION_ELEVATION.e3.ios, shadowColor: colors.shadowHeavy, shadowOpacity: 1 }

  const stripeHeight = width / LOYALTY_STRIPE_ASPECT

  const onLayout = useCallback((event) => setWidth(event.nativeEvent.layout.width), [])

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.shell,
        { backgroundColor: cardColor || colors.backgroundCard, borderRadius: radius },
        width > 0 ? { minHeight: loyaltyCardMinHeight(width) } : null,
        shadow,
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius: radius }]}>
        {layout.header ? (
          <View style={styles.header}>
            {layout.logo ? (
              <Image
                source={logoSource}
                onLoad={onLogoLoad}
                resizeMode="contain"
                style={[
                  styles.logo,
                  { width: LOGO_HEIGHT * (logoAspect || 1) },
                  logoTintColor ? { tintColor: logoTintColor } : null,
                ]}
              />
            ) : null}
            {layout.balance ? (
              <View style={styles.balance}>
                {hasText(balanceLabel) ? (
                  <Text style={[label, styles.end]}>{balanceLabel.toUpperCase()}</Text>
                ) : null}
                {hasText(balanceValue) ? (
                  <Text style={[styles.balanceValue, regular, styles.end]}>{balanceValue}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {layout.stripe ? (
          <View style={styles.stripe}>
            {stripeSource ? <Image source={stripeSource} style={styles.fill} resizeMode="cover" /> : null}
            <View style={[styles.fill, styles.scrim]} />
            {/* Эмблема ставится после первой разметки: её размеры считаются от высоты ленты. */}
            {emblemSource && stripeHeight > 0 ? (
              <Image
                source={emblemSource}
                onLoad={onEmblemLoad}
                resizeMode="contain"
                style={[styles.emblem, loyaltyEmblemFrame(stripeHeight, emblemAspect || 1)]}
              />
            ) : null}
            {layout.stamps.total > 0 ? (
              <View style={[styles.fill, styles.stamps]}>
                {Array.from({ length: layout.stamps.total }, (_, index) => {
                  const done = index < layout.stamps.filled
                  return (
                    <View key={index} style={styles.stamp}>
                      {renderIcon
                        ? renderIcon(
                            done ? PERSONALIZATION_ICONS.checkRosetteFill : PERSONALIZATION_ICONS.rosette,
                            done ? colors.textLightSecondary : colors.textLightHint,
                            STAMP_SIZE,
                          )
                        : null}
                    </View>
                  )
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {layout.info ? (
          <View style={styles.info}>
            {layout.fields.map((field, index) => (
              <View key={index} style={styles.field}>
                {hasText(field.label) ? <Text style={label}>{field.label.toUpperCase()}</Text> : null}
                {hasText(field.value) ? (
                  <Text style={[styles.fieldValue, regular]} numberOfLines={1} ellipsizeMode="tail">
                    {field.value}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {layout.code ? (
          <View style={styles.code}>
            <View style={[styles.codeBox, { borderRadius: theme.radius.lg, borderColor: colors.lineGenericSubtle }]}>
              <Barcode code={code} />
            </View>
          </View>
        ) : null}

        {/* Рамка поверх всего: у RN граница рисуется под детьми, и лента бы её закрыла. */}
        <View
          pointerEvents="none"
          style={[styles.fill, styles.border, { borderRadius: radius, borderColor: colors.lineGenericSubtle }]}
        />
      </View>
    </View>
  )
}

/** Пропорция пропуска из макета: 370 x 560. */
export const LOYALTY_CARD_ASPECT = 370 / 560
/** Лента: ширина / высота (полоса Apple Wallet 375 x 144). */
export const LOYALTY_STRIPE_ASPECT = 2.6

const LOGO_HEIGHT = 33
const STAMP_SIZE = 32

/** Минимальная высота карты по её ширине. */
export function loyaltyCardMinHeight(width) {
  return width / LOYALTY_CARD_ASPECT
}

/**
 * Рамка эмблемы внутри ленты — абсолютное позиционирование от правого верхнего угла.
 *
 * @param {number} stripeHeight высота ленты
 * @param {number} aspect ширина / высота картинки эмблемы
 */
export function loyaltyEmblemFrame(stripeHeight, aspect) {
  const height = stripeHeight * 1.4545
  return {
    width: height * aspect,
    height,
    top: -stripeHeight * 0.1166,
    right: -stripeHeight * 0.17,
  }
}

/**
 * Какие секции карты видны и сколько штампов рисовать. Без React — для тестов и для самой карты.
 */
export function loyaltyCardLayout({
  logoSource,
  balanceLabel,
  balanceValue,
  stripeSource,
  emblemSource,
  stamps,
  stampsTotal,
  fields,
  code,
}) {
  const total = toCount(stampsTotal)
  const filled = Math.min(toCount(stamps), total)
  const logo = Boolean(logoSource)
  const balance = hasText(balanceLabel) || hasText(balanceValue)
  const shownFields = Array.isArray(fields)
    ? fields.filter((field) => field && (hasText(field.label) || hasText(field.value)))
    : []
  return {
    header: logo || balance,
    logo,
    balance,
    stripe: Boolean(stripeSource) || Boolean(emblemSource) || total > 0,
    stamps: { filled, total },
    info: shownFields.length > 0,
    fields: shownFields,
    code: hasText(code) && encodeCode128(code) !== null,
  }
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0
}

function toCount(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

/**
 * Пропорция картинки: сразу, если размеры известны из source, иначе после onLoad.
 * Результат загрузки привязан к uri, чтобы хост мог пересоздавать `{ uri }` на каждом рендере.
 */
function useImageAspect(source) {
  const key = sourceKey(source)
  const known = intrinsicAspect(source)
  const [loaded, setLoaded] = useState(null)
  const onLoad = useCallback(
    (event) => {
      if (known) return
      const size = event?.nativeEvent?.source
      if (size && size.width > 0 && size.height > 0) setLoaded({ key, aspect: size.width / size.height })
    },
    [key, known],
  )
  return [known || (loaded && loaded.key === key ? loaded.aspect : null), onLoad]
}

function intrinsicAspect(source) {
  if (!source) return null
  const resolved = Image.resolveAssetSource ? Image.resolveAssetSource(source) : source
  return resolved && resolved.width > 0 && resolved.height > 0 ? resolved.width / resolved.height : null
}

function sourceKey(source) {
  if (!source) return null
  if (typeof source === 'number') return source
  if (Array.isArray(source)) return source[0]?.uri ?? null
  return source.uri ?? null
}

const styles = StyleSheet.create({
  shell: { alignSelf: 'stretch' },
  clip: { flexGrow: 1, overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject },
  border: { borderWidth: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: PERSONALIZATION_SPACING.xl,
  },
  logo: { height: LOGO_HEIGHT, flexShrink: 0 },
  balance: { flex: 1, alignItems: 'flex-end' },
  end: { textAlign: 'right' },
  // Подписи: 11/14, 600, разрядка +0.04 em, верхний регистр. Кегли вне шкалы, стиль задан здесь.
  label: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 11 * 0.04 },
  // Значения: 400 и разрядка −0.05 em; у RN разрядка в единицах кегля, не в em.
  balanceValue: { fontSize: 24, lineHeight: 24, fontWeight: '400', letterSpacing: -24 * 0.05 },
  fieldValue: { fontSize: 28, lineHeight: 32, fontWeight: '400', letterSpacing: -28 * 0.05 },
  stripe: {
    aspectRatio: LOYALTY_STRIPE_ASPECT,
    overflow: 'hidden',
    // Чёрная подложка ленты — не токен: лента в макете всегда тёмная, под картинкой и без неё.
    backgroundColor: '#000000',
  },
  // Вуаль — чёрный 30 % поверх картинки, чтобы светлые штампы читались; токена под неё нет.
  scrim: { backgroundColor: 'rgba(0, 0, 0, 0.3)' },
  emblem: { position: 'absolute' },
  stamps: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PERSONALIZATION_SPACING.xl,
    gap: PERSONALIZATION_SPACING.md,
  },
  stamp: { width: STAMP_SIZE, height: STAMP_SIZE },
  info: {
    flexDirection: 'row',
    padding: PERSONALIZATION_SPACING.xl,
    gap: PERSONALIZATION_SPACING.gapModal,
  },
  field: { flex: 1 },
  code: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: PERSONALIZATION_SPACING.xl3,
    paddingBottom: PERSONALIZATION_SPACING.xl3,
    paddingHorizontal: PERSONALIZATION_SPACING.xl,
  },
  codeBox: {
    // Белая всегда, не Background/Card: сканеру нужен белый фон и в тёмной схеме (Brand/White).
    backgroundColor: '#FFFFFF',
    // Поле 20 в макете считается от внешнего края, а рамка у RN занимает место внутри: 19 + 1.
    padding: 20 - 1,
    borderWidth: 1,
  },
})
