import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Image, Pressable, Platform, StyleSheet } from 'react-native'
import { PersonalizationColorSchemeProvider, fontFor, usePersonalizationTheme } from '../../theme/personalization-theme'
import { PERSONALIZATION_ICONS } from '../../constants/icons.constants'
import Button from './Button'
import Loader from './Loader'
import StoryNavigation from './StoryNavigation'
import StoryPrice from './StoryPrice'
import StoryTextBlock from './StoryTextBlock'
import StoryUsedProducts from './StoryUsedProducts'
import { storyIconRenderer } from './storyIcons'
import { copyToClipboard, storyVideoComponent } from './storyNative'
import { fetchGifLoopMs } from './storyGif'
import {
  hasText,
  isMediaSlide,
  isVideoSlide,
  slideButtons,
  slideProduct,
  slideProductElement,
  slideProductsElement,
  slideTextBlocks,
  storyCardProduct,
  storyPriceView,
  slidePromocode,
  storyPromoCaption,
  storySlideLetterbox,
  storySlideScrim,
} from './storySupport'

/**
 * StorySlide — один слайд в просмотре сторис V2. Внутренняя часть StoryViewer, наружу не
 * экспортируется: просмотрщик ведёт время, жесты и переходы (storyViewerState), слайд — раскладку
 * и медиа, о готовности которого сообщает колбэками.
 *
 * Источник: Figma Mobile SDK UI Kit, страница Stories (1:32), фреймы Card/Story (402x874).
 * Поля 16, шаг 16. Номера правил (A1…C16) — общие правила сторис V2 для всех четырёх SDK.
 *
 * Фон (C1, C2): фото и видео вписываются целиком (contain), поля вокруг — `background_color`
 * слайда или чёрный; такие слайды рисуются тёмными токенами. Слайд без фото и видео — всегда
 * Background/Card темы приложения, `background_color` там не берётся. Скрим сверху и снизу — на
 * каждом слайде (C3): 50 % у медиа без товара и текстов, иначе 30 %; он сходит на нет к 21 % и от
 * 86 % высоты. Скрим — растр альфа-рампы, как блик скелетона: градиент RN сам не рисует.
 *
 * Раскладки:
 * - товарная (есть элемент `product`, Card/Story View=Product/Promo/Discount, C8): шапка, затем
 *   колонка «заголовок (бренд SemiBold 20, название SemiBold 16, межстрочный 140 %, шаг 8) /
 *   белая квадратная карточка картинки (скругление 12, поля 16, картинка целиком; не нажимается —
 *   тап по ней листает, I1) / низ с шагом 16: StoryPrice и все кнопки слайда стопкой (Button LG
 *   Primary)»; кнопок нет — одна с `productButtonText`, она открывает товар. Подпись над промокодом — `title` элемента `product`,
 *   иначе `promoCaption` (C9). Текст-блоки на товарном слайде не рисуются;
 * - медиа: непустые текст-блоки на `y_offset` % высоты слайда (не выше шапки); блок с промокодом
 *   копирует его по тапу (C12); кнопки `button` — Button LG Primary внизу стопкой.
 * Внизу — «Used products» (элемент `products`) и кнопка звука у видео (C7), на любом слайде.
 *
 * Медиа (C4, C5): картинка готова, когда декодирована; видео — когда пошли кадры. Видео идёт без
 * повтора, о позиции, подгрузке и конце сообщает просмотрщику. Пока медиа грузится — лоадер кита;
 * не загрузилось — по центру кнопка кита `retryText`. Видео кэшируется средствами
 * react-native-video: на Android — LRU-кэш 50 МБ (`bufferConfig.cacheSizeMB`), на iOS —
 * `shouldCache`, если хост собрал плеер с кэшем (`$RNVideoUseVideoCaching` в Podfile).
 */
export default function StorySlide(props) {
  const { slide } = props
  const media = isMediaSlide(slide)
  // Навязанная тёмная схема — только для фото и видео; `null` оставляет схему приложения.
  return (
    <PersonalizationColorSchemeProvider scheme={media ? 'dark' : null}>
      <SlideFrame {...props} media={media} />
    </PersonalizationColorSchemeProvider>
  )
}

function SlideFrame({
  slide,
  epoch,
  count,
  current,
  progress,
  playing,
  muted,
  onToggleMute,
  media: mediaState,
  onMediaReady,
  onAnimationLoop,
  onMediaFailed,
  onBuffering,
  onVideoProgress,
  onVideoEnd,
  onRetry,
  sheetOpen,
  onSheetToggle,
  onClose,
  onButtonPress,
  onProductPress,
  onPromoCopied,
  toastRef,
  insets,
  texts,
  renderIcon,
  media,
}) {
  const theme = usePersonalizationTheme()
  const { colors } = theme
  const icon = storyIconRenderer(renderIcon)
  const [height, setHeight] = useState(0)
  const productElement = slideProductElement(slide)
  const product = slideProduct(slide)
  const buttons = slideButtons(slide)
  const productsElement = slideProductsElement(slide)
  const Video = storyVideoComponent()
  const video = isVideoSlide(slide) && !!Video

  const sound = video ? (
    <Pressable
      onPress={onToggleMute}
      hitSlop={8}
      style={styles.sound}
      accessibilityRole="button"
      accessibilityLabel={muted ? texts.soundOffLabel : texts.soundOnLabel}
      accessibilityState={{ checked: !muted }}
    >
      {icon(muted ? PERSONALIZATION_ICONS.speakerOff : PERSONALIZATION_ICONS.speaker, colors.textSecondary, 32)}
    </Pressable>
  ) : null

  let bottomRow = null
  if (productsElement) {
    const items = productsElement.products
    bottomRow = (
      <StoryUsedProducts
        products={items.map(storyCardProduct)}
        expanded={sheetOpen}
        onToggle={onSheetToggle}
        showText={productsElement.labels?.show_carousel || productsElement.labels?.showCarousel || texts.showProductsText}
        hideText={productsElement.labels?.hide_carousel || productsElement.labels?.hideCarousel || texts.hideProductsText}
        leading={sound}
        onProductPress={(card) => {
          const index = items.findIndex((item, i) => storyCardProduct(item, i).id === card.id)
          const item = items[index >= 0 ? index : 0]
          onProductPress(item, { type: 'product', item })
        }}
        renderIcon={renderIcon}
      />
    )
  } else if (sound) {
    bottomRow = <View style={styles.soundRow}>{sound}</View>
  }

  const copyPromo = (code, element) => {
    if (!copyToClipboard(code)) return
    if (texts.promoCopiedText && toastRef?.current) toastRef.current.show(texts.promoCopiedText, 'top')
    onPromoCopied(code, element)
  }

  // Текст-блоки не выше шапки: поле 16 + шапка 46 + шаг 16 от верха безопасной зоны.
  const minTop = (insets.top || 0) + 16 + NAVIGATION_HEIGHT + 16
  const textBlocks = height
    ? slideTextBlocks(slide).map((block, index) => (
        <TextBlockSlot
          key={index}
          block={block}
          top={Math.max(minTop, ((block.yOffset || 0) / 100) * height)}
          onCopy={copyPromo}
        />
      ))
    : null

  const buttonsColumn = (list) =>
    list.map((button, index) => (
      <Button key={index} label={button.title} size="lg" onPress={() => onButtonPress(button)} style={styles.wide} />
    ))

  let body
  if (product) {
    const view = storyPriceView(product, slidePromocode(slide))
    body = (
      <View style={styles.productColumn} pointerEvents="box-none">
        <ProductHeader product={product} theme={theme} />
        <ProductPicture
          product={product}
          label={hasText(product.name) ? product.name : texts.productButtonText}
        />
        <View style={styles.bottomGroup} pointerEvents="box-none">
          <StoryPrice
            type={view.type}
            price={view.price}
            oldPrice={view.oldPrice}
            discount={view.discount}
            promoCode={view.promoCode}
            promoCaption={storyPromoCaption(productElement, texts.promoCaption)}
            copiedText={texts.promoCopiedText}
            toastRef={toastRef}
            toastPosition="top"
            onPromoCopied={(code) => onPromoCopied(code, productElement)}
            renderIcon={renderIcon}
          />
          {buttons.length ? (
            buttonsColumn(buttons)
          ) : (
            <Button
              label={texts.productButtonText}
              size="lg"
              onPress={() => onProductPress(product, productElement)}
              style={styles.wide}
            />
          )}
        </View>
      </View>
    )
  } else {
    body = (
      <>
        <View style={styles.spacer} pointerEvents="none" />
        {buttonsColumn(buttons)}
      </>
    )
  }

  const letterbox = storySlideLetterbox(slide)
  // Открыта шторка (B5, F2): тап мимо неё только закрывает её — кнопки, карточка товара, промокоды
  // и «Повторить» касания не берут, их ловит просмотрщик. Крестик закрывает просмотр и со шторкой.
  const touches = sheetOpen ? 'none' : 'box-none'

  return (
    <View
      style={[styles.frame, { backgroundColor: letterbox || colors.backgroundCard }]}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      pointerEvents="box-none"
    >
      <Backdrop
        slide={slide}
        epoch={epoch}
        video={video ? Video : null}
        playing={playing}
        muted={muted}
        onReady={onMediaReady}
        onAnimationLoop={onAnimationLoop}
        onFailed={onMediaFailed}
        onBuffering={onBuffering}
        onProgress={onVideoProgress}
        onEnd={onVideoEnd}
      />
      <Scrim strength={storySlideScrim(slide)} />
      {textBlocks ? (
        <View style={StyleSheet.absoluteFill} pointerEvents={touches}>
          {textBlocks}
        </View>
      ) : null}
      <View
        style={[styles.safe, { paddingTop: insets.top || 0, paddingBottom: insets.bottom || 0 }]}
        pointerEvents="box-none"
      >
        <View style={styles.content} pointerEvents="box-none">
          <StoryNavigation
            count={count}
            current={current}
            progress={progress}
            onClose={onClose}
            closeLabel={texts.closeLabel}
            renderIcon={renderIcon}
          />
          <View style={styles.body} pointerEvents={touches}>
            {body}
          </View>
        </View>
        {bottomRow}
      </View>
      {mediaState === 'loading' ? (
        <View style={styles.center} pointerEvents="none">
          <Loader />
        </View>
      ) : null}
      {mediaState === 'error' ? (
        <View style={styles.center} pointerEvents={touches}>
          <Button label={texts.retryText} size="lg" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  )
}

/**
 * Текст-блок на своей высоте. С промокодом (C12) он нажимается: код уходит в буфер обмена,
 * сверху тост, просмотрщику — клик; без промокода касания проходят сквозь него к слайду.
 */
function TextBlockSlot({ block, top, onCopy }) {
  const content = (
    <StoryTextBlock
      text={block.text}
      fontSize={block.fontSize}
      lineHeight={block.lineHeight}
      color={block.color}
      backgroundColor={block.backgroundColor}
      backgroundOpacity={block.backgroundOpacity}
      align={block.align}
      bold={block.bold}
      italic={block.italic}
      fontFamily={fontForType(block.fontType)}
    />
  )
  if (!block.promocode) {
    return (
      <View pointerEvents="none" style={[styles.textBlock, { top }]}>
        {content}
      </View>
    )
  }
  return (
    <Pressable
      style={[styles.textBlock, { top }]}
      onPress={() => onCopy(block.promocode, block.element)}
      accessibilityRole="button"
      accessibilityLabel={block.text}
    >
      {content}
    </Pressable>
  )
}

/** Бренд и название товарного слайда. */
function ProductHeader({ product, theme }) {
  const { colors } = theme
  const font = fontFor(theme, '600')
  return (
    <View style={styles.header} pointerEvents="none">
      {hasText(product.brand) ? (
        <Text style={[styles.brand, { fontFamily: font, color: colors.textPrimary }]} numberOfLines={1}>
          {product.brand}
        </Text>
      ) : null}
      {hasText(product.name) ? (
        <Text style={[styles.name, { fontFamily: font, color: colors.textPrimary }]} numberOfLines={4}>
          {product.name}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * Фон слайда, вписанный целиком (C1): видео (react-native-video) поверх превью, иначе картинка —
 * фон или, у видео без плеера, его превью. Монтируется заново на каждый новый слайд и на
 * «Повторить» (ключ — загрузка медиа у просмотрщика, C5). Перезапуск слайда (B3, F3) медиа не
 * перемонтирует: меняется только `epoch`, и видео перематывается к нулю.
 *
 * Готовность (C5) сообщается один раз: картинка — когда декодирована, видео — когда пошли кадры
 * (`onReady(durationMs?)` с длиной ролика, если она известна — C4). Не загрузилось — `onFailed`.
 * Нечего грузить — просмотрщик уже считает слайд готовым.
 *
 * Звук (C7): без звука видео не берёт аудиофокус (Android) и смешивается с чужим звуком, не
 * включаясь в беззвучном режиме (iOS); со звуком — фокус и обычное воспроизведение. Сессию после
 * закрытия возвращает сам react-native-video.
 */
function Backdrop({ slide, epoch, video: Video, playing, muted, onReady, onAnimationLoop, onFailed, onBuffering, onProgress, onEnd }) {
  const [shown, setShown] = useState(false)
  const reported = useRef(false)
  const duration = useRef(null)
  const player = useRef(null)

  // Перезапуск (F3): та же загрузка, новая эпоха — видео к нулю. Эпоха монтирования — не перезапуск.
  const mountEpoch = useRef(epoch)
  useEffect(() => {
    if (epoch === mountEpoch.current) return
    try {
      player.current?.seek?.(0)
    } catch (error) {
      // Перемотка — удобство: не вышло — видео продолжит с места, часы всё равно с нуля.
    }
  }, [epoch])
  // Картинка: у видео — превью под роликом, у фото — сам `background`; без медиа (F9) — ничего.
  const imageUri = isVideoSlide(slide) ? slide.preview : isMediaSlide(slide) ? slide.background : null
  const hasImage = hasText(imageUri)

  // GIF фона: слайд идёт по большему из прохода и времени админки (G2). Байты качаются, только
  // если это GIF; ответ после ухода со слайда не нужен.
  const animatedUri = isVideoSlide(slide) ? null : imageUri
  const loopReport = useRef(onAnimationLoop)
  loopReport.current = onAnimationLoop
  useEffect(() => {
    if (!hasText(animatedUri)) return undefined
    let active = true
    fetchGifLoopMs(animatedUri).then((loopMs) => {
      if (active && loopMs) loopReport.current && loopReport.current(loopMs)
    })
    return () => {
      active = false
    }
  }, [animatedUri])

  const ready = () => {
    if (reported.current) {
      // Длина пришла после первых кадров — пусть часы перейдут на позицию видео.
      if (duration.current) onReady && onReady(duration.current)
      return
    }
    reported.current = true
    onReady && onReady(duration.current || undefined)
  }
  const failed = () => onFailed && onFailed()

  // Видео со своим источником: кэш react-native-video (C6) — LRU 50 МБ на Android, shouldCache на iOS.
  const source = useRef({
    uri: slide.background,
    shouldCache: true,
    bufferConfig: { cacheSizeMB: VIDEO_CACHE_MB },
  }).current

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {hasImage ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.fill}
          resizeMode="contain"
          onLoad={Video ? undefined : ready}
          onError={Video ? undefined : failed}
        />
      ) : null}
      {Video ? (
        <Video
          ref={player}
          source={source}
          style={[styles.fill, { opacity: shown ? 1 : 0 }]}
          resizeMode="contain"
          paused={!playing}
          muted={muted}
          repeat={false}
          playInBackground={false}
          playWhenInactive={false}
          disableFocus={muted}
          mixWithOthers={muted ? 'mix' : 'inherit'}
          ignoreSilentSwitch={muted ? 'obey' : 'ignore'}
          progressUpdateInterval={100}
          onLoad={(data) => {
            const seconds = Number(data?.duration)
            if (Number.isFinite(seconds) && seconds > 0) duration.current = Math.round(seconds * 1000)
            if (reported.current && duration.current) onReady && onReady(duration.current)
          }}
          onReadyForDisplay={() => {
            setShown(true)
            ready()
          }}
          onProgress={(data) => {
            const seconds = Number(data?.currentTime)
            if (!Number.isFinite(seconds)) return
            if (seconds > 0 && !reported.current) {
              setShown(true)
              ready()
            }
            onProgress && onProgress(Math.round(seconds * 1000))
          }}
          onBuffer={(data) => onBuffering && onBuffering(!!data?.isBuffering)}
          onEnd={() => onEnd && onEnd()}
          onError={() => onFailed && onFailed()}
        />
      ) : null}
    </View>
  )
}

/**
 * Белая квадратная карточка с картинкой товара: сторона — меньшее из ширины и высоты места.
 * Карточка не нажимается (I1): касания уходят под неё, в зоны листания слайдов, — иначе тап,
 * которым листают, открывал бы товар. Товар открывают только кнопки слайда (I2).
 */
function ProductPicture({ product, label }) {
  const [side, setSide] = useState(0)
  const uri = product.image_url_resized?.['520'] || product.image_url || product.picture
  return (
    <View
      style={styles.pictureSlot}
      pointerEvents="box-none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout
        setSide(Math.max(0, Math.floor(Math.min(width, height - 32))))
      }}
    >
      {side > 0 ? (
        <View
          style={[styles.pictureCard, { width: side, height: side }]}
          pointerEvents="none"
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
        >
          {hasText(uri) ? <Image source={{ uri }} style={styles.picture} resizeMode="contain" /> : null}
        </View>
      ) : null}
    </View>
  )
}

/** Скрим сверху и снизу: растянутая альфа-рампа, снизу — перевёрнутая. */
function Scrim({ strength }) {
  const source = require('../../assets/personalization-scrim.png')
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={source} resizeMode="stretch" style={[styles.scrimTop, { opacity: strength }]} />
      <Image source={source} resizeMode="stretch" style={[styles.scrimBottom, { opacity: strength }]} />
    </View>
  )
}

/** Шрифт по `font_type` сервера; неизвестный — шрифт темы. */
function fontForType(type) {
  const value = String(type || '').toLowerCase()
  if (value === 'serif') return Platform.select({ ios: 'Georgia', default: 'serif' })
  if (value === 'monospaced' || value === 'monospace') return Platform.select({ ios: 'Courier', default: 'monospace' })
  return undefined
}

/** Высота шапки: полоски 2 + шаг 12 + строка крестика 32. */
const NAVIGATION_HEIGHT = 46
/** Размер дискового кэша видео react-native-video на Android, МБ (C6). */
const VIDEO_CACHE_MB = 50

const styles = StyleSheet.create({
  frame: { flex: 1, overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  // Высоты явно: у локального ресурса Image подставляет свой размер в начало стиля.
  scrimTop: { position: 'absolute', top: 0, left: 0, width: '100%', height: '21%' },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: '14%', transform: [{ scaleY: -1 }] },
  textBlock: { position: 'absolute', left: 16, right: 16 },
  safe: { flex: 1 },
  content: { flex: 1, padding: 16, gap: 16 },
  body: { flex: 1, gap: 16 },
  spacer: { flex: 1 },
  productColumn: { flex: 1, justifyContent: 'space-between' },
  header: { gap: 8 },
  brand: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  pictureSlot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  // Карточка картинки в макете всегда белая (#FFFFFF), в обеих схемах: фото товаров — на белом.
  pictureCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16 },
  picture: { flex: 1, width: '100%' },
  bottomGroup: { gap: 16 },
  wide: { alignSelf: 'stretch' },
  sound: { width: 32, height: 32 },
  soundRow: { height: 64, paddingHorizontal: 16, justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
})
