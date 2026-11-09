import React, { useEffect, useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import { popupImageHeight, popupSafeLink } from '../../lib/popupsV3/design'
import { popupApplyRuntimeVariables } from '../../lib/popupsV3/markup'
import { copyToClipboard } from '../design-system/storyNative'
import PopupV3Text from './PopupV3Text'
import { popupFlexAlign, popupFontFamily, popupResizeMode, popupTextStyle } from './popupV3Style'

/**
 * Простые элементы попапа v3: text, box, button, close, image. Каждый получает модель элемента
 * (`normalizePopupElement`) и контекст показа: запись движка, витринные переменные, тексты, тост.
 */

/** Ссылка из шаблона с витринными переменными; запрещённая схема или пусто — `null`. */
export const popupResolveLink = (template, runtime) => popupSafeLink(popupApplyRuntimeVariables(template, runtime))

/** text и box: текст с разметкой в коробке; у box без текста — просто плашка. */
export function PopupV3TextElement({ element, context }) {
  const { props, box } = element
  if (!props.message) return null
  return (
    <PopupV3Text
      text={props.message}
      runtime={context.runtime}
      style={[popupTextStyle(box, { fontSize: props.fontSize, fontWeight: props.fontWeight }), { textAlign: props.align }]}
    />
  )
}

/** Кнопка в стиле `button*` дизайна: фон, цвет, кегль, поля, радиус. */
export function PopupV3ButtonFace({ button, text, runtime, onPress, disabled, accessibilityLabel, children, style }) {
  const family = popupFontFamily(button.fontFamily)
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          backgroundColor: button.bgColor,
          borderRadius: button.radius,
          paddingHorizontal: button.paddingX,
          paddingVertical: button.paddingY,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {children || (
        <PopupV3Text
          text={text}
          runtime={runtime}
          style={[{ color: button.textColor, fontSize: button.fontSize, fontWeight: '500', textAlign: 'center' }, family ? { fontFamily: family } : null]}
        />
      )}
    </Pressable>
  )
}

/** Кнопка действия: ссылка, закрытие или копирование. Клик (кроме закрытия) — событие `click`. */
export function PopupV3ButtonElement({ element, context }) {
  const { props } = element
  const { entry, runtime } = context
  const press = () => {
    if (props.action === 'close') {
      entry.close()
      return
    }
    entry.event('click')
    if (props.action === 'copy') {
      // Как web: текст копирования, а без него — текст кнопки как есть.
      if (copyToClipboard(popupApplyRuntimeVariables(props.copyText, runtime))) context.toast(context.texts.copied)
      return
    }
    const link = popupResolveLink(props.href, runtime)
    if (link) entry.openLink(link)
  }
  return (
    <View style={{ flexDirection: 'row', justifyContent: popupFlexAlign(props.align) }}>
      <PopupV3ButtonFace button={props.button} text={props.text} runtime={runtime} onPress={press} />
    </View>
  )
}

/** Крестик из двух повёрнутых полос — стандартная иконка вместо SVG дизайна. */
function CloseCross({ size, color }) {
  const length = size * 0.9
  const thickness = Math.max(1.5, size / 11)
  const bar = { position: 'absolute', width: length, height: thickness, borderRadius: thickness / 2, backgroundColor: color, left: (size - length) / 2, top: (size - thickness) / 2 }
  return (
    <View style={{ width: size, height: size }}>
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  )
}

/** Кнопка закрытия: текст (×), картинка или SVG (рисуется стандартным крестиком). Событие `close`. */
export function PopupV3CloseElement({ element, context }) {
  const { props } = element
  let face = null
  if (props.mode === 'image') {
    face = <Image source={{ uri: props.imageUrl }} style={{ width: props.size, height: props.size }} resizeMode="contain" accessibilityIgnoresInvertColors />
  } else if (props.mode === 'svg') {
    face = <CloseCross size={props.size} color={props.button.textColor} />
  }
  return (
    <View style={{ flexDirection: 'row', justifyContent: popupFlexAlign(props.align) }}>
      <PopupV3ButtonFace
        button={props.button}
        text={props.text}
        runtime={context.runtime}
        onPress={() => context.entry.close()}
        accessibilityLabel={context.texts.close}
      >
        {face}
      </PopupV3ButtonFace>
    </View>
  )
}

/**
 * Картинка на ширину ячейки: высота по режиму (px, % и vh — от высоты экрана), по соотношению
 * сторон из дизайна или по самой картинке.
 */
export function PopupV3ImageElement({ element, context }) {
  const { props } = element
  const url = popupApplyRuntimeVariables(props.url, context.runtime)
  const fixed = popupImageHeight(props.height, context.screenHeight)
  const [natural, setNatural] = useState(null)
  useEffect(() => {
    if (fixed !== null || props.aspectRatio || !url) return undefined
    let alive = true
    Image.getSize(
      url,
      (width, height) => {
        if (alive && width > 0 && height > 0) setNatural(width / height)
      },
      () => {},
    )
    return () => {
      alive = false
    }
  }, [url, fixed, props.aspectRatio])
  const size = fixed !== null ? { height: fixed } : { aspectRatio: props.aspectRatio || natural || 16 / 9 }
  return (
    <Image
      source={{ uri: url }}
      accessibilityLabel={props.alt}
      accessibilityIgnoresInvertColors
      resizeMode={popupResizeMode(props.fit)}
      style={[styles.image, size, { borderRadius: props.radius, marginBottom: props.marginBottom }]}
    />
  )
}

const styles = StyleSheet.create({
  image: { width: '100%' },
})
