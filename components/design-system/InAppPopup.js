import React from 'react'
import { View, Text, Image, StyleSheet, Platform } from 'react-native'
import { usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_SPACING } from '../../constants/spacing.constants'
import { PERSONALIZATION_ELEVATION } from '../../constants/elevation.constants'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'
import Button from './Button'

/**
 * InAppPopup — карточка с картинкой, заголовком, текстом и кнопками.
 *
 * Источник: Figma Mobile SDK UI Kit, страница InAppPopup / Modal (1:33),
 * компонент-сеты In App Popup/Modal (469:2767) и In App Popup/Fullscreen (469:2835).
 * У обоих четыре вида: картинка сверху, картинка фоном, только текст, иконка.
 *
 * Позицию на экране (верх/центр/низ/во весь экран) компонент не выбирает — это дело
 * того, кто его показывает; здесь только `presentation`, от которой зависят метрики:
 * у модалки скругление 24 и отступы 20, у полноэкранной скруглений нет и отступы 24,
 * а кегли на ступень крупнее.
 *
 * Крестик стоит **всегда** и принадлежит самому попапу, а не контейнеру картинки:
 * в макете виды «только текст» и «иконка» картинки не имеют, но крестик у них нарисован.
 * Он круглый (компонент Close: кнопка MD с радиусом Rounded) и во всех видах лежит поверх
 * содержимого в правом верхнем углу, на отступе попапа; над фотографией — в тёмном варианте.
 * Текстовая кнопка закрытия (`closeText`) в макете не нарисована — её даёт админка
 * отдельным тумблером рядом с кнопкой действия, поэтому она здесь вторичной кнопкой
 * под основной. Пустой текст — кнопки нет, остаётся один крестик.
 *
 * Поля и зазор между блоками — семантические отступы Padding/Gap Modal (20) и
 * Padding/Gap Full Screen (24), скругление модалки — радиус Modal, фон — Background/Card,
 * тень модалки — Elevation 3. Кнопки друг под другом через 12 у модалки и 16 у полноэкранного.
 *
 * @param {{ view?: 'image'|'imageBackground'|'text'|'icon',
 *           presentation?: 'modal'|'fullscreen',
 *           title?: string, text?: string, actionText?: string, closeText?: string,
 *           source?: object, icon?: React.ReactNode,
 *           renderIcon?: (svg: string, color: string, size: number) => React.ReactNode,
 *           onAction?: Function, onClose?: Function, style?: object }} props
 */
export default function InAppPopup({
  view = 'image',
  presentation = 'modal',
  title,
  text,
  actionText,
  closeText,
  source,
  icon,
  renderIcon,
  onAction,
  onClose,
  style,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme

  const modal = presentation === 'modal'
  const overImage = view === 'imageBackground'
  const centred = view === 'text' || view === 'icon'
  const pad = modal ? PERSONALIZATION_SPACING.paddingModal : PERSONALIZATION_SPACING.paddingFullScreen
  const gapSection = modal ? PERSONALIZATION_SPACING.gapModal : PERSONALIZATION_SPACING.gapFullScreen
  const gapButtons = modal ? PERSONALIZATION_SPACING.lg : PERSONALIZATION_SPACING.xl

  const titleStyle = modal ? theme.typography.xl3Emphasized : theme.typography.xl4Emphasized
  const textStyle = modal ? theme.typography.lgDefault : theme.typography.xl2Default

  const hasAction = typeof actionText === 'string' && actionText.length > 0
  const hasClose = typeof closeText === 'string' && closeText.length > 0

  const textBlock = (
    <View style={styles.textBlock}>
      {title ? (
        <Text
          style={[
            titleStyle,
            { color: overImage ? colors.textLightPrimary : colors.textPrimary },
            centred && styles.centred,
          ]}
        >
          {title}
        </Text>
      ) : null}
      {text ? (
        <Text
          style={[
            textStyle,
            { color: overImage ? colors.textLightSecondary : colors.textSecondary },
            centred && styles.centred,
          ]}
        >
          {text}
        </Text>
      ) : null}
    </View>
  )

  const buttons =
    hasAction || hasClose ? (
      <View style={{ gap: gapButtons }}>
        {hasAction ? (
          <Button
            label={actionText}
            onPress={onAction}
            renderIcon={renderIcon}
            style={styles.wideButton}
          />
        ) : null}
        {hasClose ? (
          <Button
            label={closeText}
            view="secondary"
            onDark={overImage}
            onPress={onClose}
            renderIcon={renderIcon}
            style={styles.wideButton}
          />
        ) : null}
      </View>
    ) : null

  // Крестик над фотографией и у вида с картинкой сверху: в макете у него там тёмный режим.
  const closeIcon = (
    <Button
      size="md"
      view="secondary"
      rounded
      onDark={overImage || view === 'image'}
      iconStart={PERSONALIZATION_ICONS.crossLarge}
      renderIcon={renderIcon}
      onPress={onClose}
      style={styles.closeButton}
    />
  )

  const radius = modal ? theme.radius.modal : 0

  // Тень и обрезка по скруглению — на разных View: `overflow: 'hidden'` на iOS срезает
  // и тень. Внешняя несёт фон и тень, внутренняя обрезает картинку по углам. На iOS
  // цвет тени — Shadow/Heavy из темы (0.08 в светлой, 0.5 в тёмной), а не чёрный 0.08
  // из токена высоты; на Android тень рисует система по elevation.
  const shadow = modal
    ? Platform.OS === 'android'
      ? PERSONALIZATION_ELEVATION.e3.android
      : { ...PERSONALIZATION_ELEVATION.e3.ios, shadowColor: colors.shadowHeavy, shadowOpacity: 1 }
    : null

  let content
  if (view === 'image') {
    content = (
      <>
        {/* Картинка забирает всё, что остаётся над карточкой с текстом. */}
        <View style={styles.imageSlot}>
          {source ? <Image source={source} style={styles.image} resizeMode="cover" /> : null}
        </View>
        <View style={{ padding: pad, gap: modal ? PERSONALIZATION_SPACING.xl : PERSONALIZATION_SPACING.xl3 }}>
          {textBlock}
          {buttons}
        </View>
      </>
    )
  } else if (overImage) {
    content = (
      <>
        {source ? <Image source={source} style={styles.background} resizeMode="cover" /> : null}
        <View style={{ flex: 1, padding: pad, gap: gapSection }}>
          {/* Текст прижат к низу, над кнопками. */}
          <View style={styles.bottomSlot}>{textBlock}</View>
          {buttons}
        </View>
      </>
    )
  } else {
    content = (
      <View style={{ flex: 1, padding: pad, gap: gapSection }}>
        <View style={styles.centreSlot}>
          {view === 'icon' && icon ? (
            <View style={[styles.icon, { width: modal ? 100 : 120, height: modal ? 100 : 120 }]}>
              {icon}
            </View>
          ) : null}
          {textBlock}
        </View>
        {buttons}
      </View>
    )
  }

  return (
    <View style={[styles.shell, { backgroundColor: colors.backgroundCard, borderRadius: radius }, shadow, style]}>
      <View style={[styles.clip, { borderRadius: radius }]}>
        {content}
        {/* Крестик накладкой поверх содержимого — во всех видах одинаково. */}
        <View style={[styles.closeOverlay, { top: pad, right: pad }]}>{closeIcon}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  clip: { flex: 1, overflow: 'hidden' },
  imageSlot: { flex: 1 },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  background: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  textBlock: { gap: PERSONALIZATION_SPACING.md },
  centred: { textAlign: 'center' },
  closeOverlay: { position: 'absolute' },
  // Кнопка кита по умолчанию `alignSelf: 'flex-start'` — она рассчитана стоять в ряду.
  // В попапе кнопки во всю ширину, а крестик прижат к правому краю, поэтому выравнивание
  // переопределяется здесь, а не в самой кнопке.
  wideButton: { alignSelf: 'stretch' },
  closeButton: { alignSelf: 'flex-end' },
  bottomSlot: { flex: 1, justifyContent: 'flex-end' },
  centreSlot: { flex: 1, justifyContent: 'center', gap: PERSONALIZATION_SPACING.xl3 },
  icon: { alignSelf: 'center' },
})
