import React from 'react'
import { Pressable, View } from 'react-native'
import { popupBackdrop, popupKitScheme } from '../../lib/popupsV3/values'
import { PersonalizationColorSchemeProvider, usePersonalizationColorSets } from '../../theme/personalization-theme'
import {
  PopupV3ButtonElement,
  PopupV3CloseElement,
  PopupV3ImageElement,
  PopupV3TextElement,
  popupResolveLink,
} from './PopupV3Basic'
import { PopupV3EmailElement, PopupV3FormElement } from './PopupV3Forms'
import { PopupV3PromoElement, PopupV3RecommendationElement, PopupV3SurveyElement } from './PopupV3Widgets'
import { popupBoxStyle, popupElementPlacement } from './popupV3Style'

/**
 * Реестр рендереров элементов попапа v3 по `type` (модель — `POPUP_ELEMENT_TYPES`). Неизвестный тип
 * до рендера не доходит: его пропускает нормализация с записью в лог. Новый тип — одна строка здесь
 * и одна запись в реестре модели.
 */
export const POPUP_V3_RENDERERS = {
  text: PopupV3TextElement,
  box: PopupV3TextElement,
  button: PopupV3ButtonElement,
  close: PopupV3CloseElement,
  image: PopupV3ImageElement,
  emailCollector: PopupV3EmailElement,
  form: PopupV3FormElement,
  promoCode: PopupV3PromoElement,
  survey: PopupV3SurveyElement,
  recommendation: PopupV3RecommendationElement,
}

/**
 * Компоненты кита внутри элемента (лента рекомендаций, галочка согласия) — в схеме по фону попапа
 * под элементом (`backdrop`, см. `popupBackdrop`), а не по системе: попап рисуется по цветам
 * дизайна и от темы системы не зависит. Тост и прочие окна поверх приложения сюда не входят —
 * они по теме приложения.
 */
export function PopupV3KitScheme({ backdrop, children }) {
  const sets = usePersonalizationColorSets()
  const scheme = popupKitScheme(backdrop, { light: sets.light.textPrimary, dark: sets.dark.textPrimary })
  return <PersonalizationColorSchemeProvider scheme={scheme}>{children}</PersonalizationColorSchemeProvider>
}

/**
 * Элемент в ячейке: обёртка-коробка (фон, рамка, поля, тень), место в ячейке и ссылка на весь
 * элемент (у text, box, image) — нажатие открывает её, событие `click`. Кит внутри — по фону
 * элемента или рамки (`context.frameBg`).
 */
export default function PopupV3Element({ element, cellAlign, context }) {
  const Renderer = POPUP_V3_RENDERERS[element.type]
  if (!Renderer || !element.visible) return null
  const style = [popupBoxStyle(element.box), popupElementPlacement(element, cellAlign)]
  const content = (
    <PopupV3KitScheme backdrop={popupBackdrop(element.box.bgColor, context.frameBg)}>
      <Renderer element={element} context={context} />
    </PopupV3KitScheme>
  )
  const link = element.link ? popupResolveLink(element.link, context.runtime) : null
  if (link) {
    return (
      <Pressable
        style={({ pressed }) => [style, pressed ? { opacity: element.box.opacity * 0.8 } : null]}
        accessibilityRole="link"
        onPress={() => {
          context.entry.event('click')
          context.entry.openLink(link)
        }}
      >
        {content}
      </Pressable>
    )
  }
  return <View style={style}>{content}</View>
}
