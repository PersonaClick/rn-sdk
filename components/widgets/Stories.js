import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Linking, Platform } from 'react-native'
import { awaitInstance, isAmbiguousDefault } from '../../lib/facade/facade'
import { getViewedSlides, markSlideAsViewed } from '../../lib/stories/storage'
import { registerOverlayLayer } from '../Popup/overlayLayers'
import StoriesBar from '../design-system/StoriesBar'
import StoryViewer from '../design-system/StoryViewer'
import {
  isTrackableId,
  playableStories,
  slideProduct,
  storyButtonTarget,
  storyCoverRing,
  storyIndexForId,
  storyLink,
  withSlideSeen,
} from '../design-system/storySupport'
import { attachStoriesShowHost, requestStoriesShow } from './storiesShow'

/**
 * Stories — сторис V2 с данными SDK: лента обложек и полноэкранный просмотр. Виджет сам ходит
 * в `getStories(code)`, трекает показы и нажатия и помнит, что пользователь уже посмотрел.
 * Номера правил (A1…D) — общие правила сторис V2 для всех четырёх SDK.
 *
 * Паттерн Stories из Figma (страница 1:32): «блок сторис по коду». Визуальный слой — StoriesBar и
 * StoryViewer кита. Прежние сторис (`@personaClick/react-native-sdk/stories`) не затронуты.
 *
 * Инстанс SDK: `sdk` явно, иначе `shopId` выбирает магазин при нескольких зарегистрированных;
 * без него берётся единственный (резолв — `awaitInstance` фасада). Несколько магазинов без
 * `shopId`, нет `code`, ошибка загрузки или 15 с без ответа — `onError`, и блок прячется (D).
 * Пока блок грузится — четыре скелетона; пустой блок — ничего. `reload()` грузит заново.
 *
 * Просмотренность (A1–A3): слайд виден, когда стал текущим; список виденных слайдов хранится по
 * магазину (`lib/stories/storage`, тот же, что у прежних сторис) и переживает перезапуск.
 * Сторис просмотрена, если так сказал сервер или видны все её слайды. Кольцо обложки — по A5.
 *
 * Трекинг (A6): `view` — на каждый показанный слайд, `click` — на кнопку, товар (карточку,
 * кнопку товара, товар карусели) и копирование промокода (плашка цены и текст-блок); не на
 * открытие шторки. Id не целые (динамические товарные слайды `39_0`) не трекаются. Источник
 * `stories` с кодом блока (`trackSource`, 48 ч) ставится на каждый показ и клик.
 *
 * Нажатия (D): просмотр закрывается, потом `onElementPress(element)` (уведомление, как у прежних
 * сторис) и переход: кнопка → `onLinkClick(url)`, если задан, иначе системный обработчик; товар →
 * `onProductClick(product)`, если задан, иначе его ссылка. Кнопка товарного слайда без ссылки
 * ведёт на товар (C11).
 *
 * Управление (B8, F11): ref — `open(index)`, `openStory(id)`, `pause()`, `resume()`, `reload()`.
 * Открытие до загрузки ждёт её, при открытом просмотре — листает к сторис в нём; `pause()` и
 * `resume()` без открытого просмотра ничего не делают. `bar={false}` — без ленты, только просмотр
 * по ref. Статический `PersonalizationStories.show()` показывает блок без виджета через
 * `<SdkPopupOverlay>` (см. ui.d.ts).
 *
 * @param {object} props см. PersonalizationStoriesProps в ui.d.ts
 */
function Stories(
  {
    code,
    sdk: sdkProp,
    shopId,
    bar = true,
    onLinkClick,
    onProductClick,
    onElementPress,
    onError,
    onViewerClose,
    promoCaption,
    promoCopiedText,
    productButtonText,
    showProductsText,
    hideProductsText,
    retryText,
    closeLabel,
    soundOnLabel,
    soundOffLabel,
    insets,
    renderIcon,
    contentContainerStyle,
    style,
  },
  ref,
) {
  const callbacks = useRef({})
  callbacks.current = { onLinkClick, onProductClick, onElementPress, onError, onViewerClose }
  const report = useCallback((error) => callbacks.current.onError && callbacks.current.onError(error), [])

  const [resolvedSdk, setResolvedSdk] = useState(sdkProp ?? null)
  const [ambiguous, setAmbiguous] = useState(false)
  useEffect(() => {
    setAmbiguous(false)
    if (sdkProp) {
      setResolvedSdk(sdkProp)
      return undefined
    }
    if (isAmbiguousDefault(shopId ?? null)) {
      setAmbiguous(true)
      report(new Error('PersonalizationStories: several shops are registered — pass shopId or sdk.'))
      return undefined
    }
    return awaitInstance(shopId ?? null, (instance) => setResolvedSdk(instance))
  }, [sdkProp, shopId, report])
  const sdk = sdkProp ?? resolvedSdk
  const shop = sdk?.shop_id

  const [stories, setStories] = useState(null)
  const [seen, setSeen] = useState({})
  const [hostPaused, setHostPaused] = useState(false)
  const [generation, setGeneration] = useState(0)
  const [failed, setFailed] = useState(false)

  // Открытый просмотр: `{ index, request }` или `null`. `request` растёт на каждое открытие — так
  // открытие при открытом просмотре листает к сторис, даже если индекс тот же (F11). Ref — чтобы
  // `pause()` сразу после `open()` видел просмотр, не дожидаясь рендера.
  const [opened, setOpened] = useState(null)
  const openedRef = useRef(null)
  const requests = useRef(0)
  const showViewer = useCallback((index) => {
    const next = index === null ? null : { index, request: ++requests.current }
    openedRef.current = next
    setOpened(next)
    // Пауза хоста — только у открытого просмотра: следующее открытие начинается без неё (F11).
    if (next === null) setHostPaused(false)
  }, [])

  // Новый код (или reload) — просмотр закрывается, блок грузится заново.
  useEffect(() => {
    showViewer(null)
    setStories(null)
    setSeen({})
    setFailed(false)
    if (!code) {
      setFailed(true)
      report(new Error('PersonalizationStories: code is required.'))
    }
  }, [code, generation, report, showViewer])

  // Инстанс и код есть — грузим блок, затем виденные слайды по магазину (A2). Ответ на прежний
  // код отбрасывается.
  useEffect(() => {
    if (!sdk || !code) return undefined
    let alive = true
    Promise.resolve()
      .then(() => sdk.getStories(code))
      .then(async (response) => {
        const list = playableStories(response?.stories)
        const entries = await Promise.all(
          list.map(async (story) => [String(story.id), await getViewedSlides(String(story.id), shop)]),
        )
        if (!alive) return
        setSeen(Object.fromEntries(entries.filter(([, ids]) => ids.length > 0)))
        setStories(list)
      })
      .catch((error) => {
        if (!alive) return
        setFailed(true)
        report(error)
      })
    return () => {
      alive = false
    }
  }, [sdk, shop, code, generation, report])

  // Загрузка не дольше 15 с — иначе ошибка, и блок прячется, а не висит скелетоном (D).
  const loading = stories === null && !failed && !ambiguous
  useEffect(() => {
    if (!loading) return undefined
    const timer = setTimeout(() => {
      setFailed(true)
      report(new Error('PersonalizationStories: the stories block did not load in 15 s.'))
    }, LOAD_TIMEOUT)
    return () => clearTimeout(timer)
  }, [loading, code, generation, report])

  // Трекинг не должен ронять интерфейс (A6): источник `stories` — на каждое событие, сам
  // `track/stories` — только для целых id.
  const track = useCallback(
    (kind, story, slide) => {
      if (!sdk) return
      try {
        if (typeof sdk.trackSource === 'function') sdk.trackSource('stories', code)
      } catch (error) {
        // Источник — атрибуция, не причина ронять сторис.
      }
      if (!isTrackableId(story.id) || !isTrackableId(slide.id)) return
      const call = kind === 'view' ? sdk.trackStoryView : sdk.trackStoryClick
      if (typeof call !== 'function') return
      Promise.resolve()
        .then(() => call.call(sdk, story.id, slide.id, code))
        .catch(() => {})
    },
    [sdk, code],
  )

  // Запись виденного по магазину (A2) — по очереди на сторис: storage читает и пишет весь список.
  const writes = useRef({})
  const markSeen = useCallback(
    (story, slide) => {
      setSeen((current) => withSlideSeen(current, story.id, slide.id))
      if (!shop) return
      const key = String(story.id)
      const previous = writes.current[key] || Promise.resolve()
      writes.current[key] = previous.then(() => markSlideAsViewed(key, String(slide.id), shop)).catch(() => {})
    },
    [shop],
  )

  // Переход после нажатия: сначала просмотр закрывается (D), потом уведомление и ссылка.
  const navigate = useCallback(
    (element, target) => {
      const { onLinkClick: link, onProductClick: product, onElementPress: press, onViewerClose } = callbacks.current
      showViewer(null)
      onViewerClose && onViewerClose()
      press && press(element)
      if (!target) return
      if (target.kind === 'product' && product) {
        product(target.product)
        return
      }
      const url = target.kind === 'link' ? target.url : storyLink(target.product, Platform.OS)
      if (!url) return
      if (link) link(url)
      else Linking.openURL(url).catch((error) => report(error))
    },
    [report, showViewer],
  )

  const visible = useMemo(() => (failed || ambiguous ? [] : stories || []), [failed, ambiguous, stories])

  // Открытие по ref до загрузки ждёт её (B8, F11); при открытом просмотре листает к сторис в нём
  // (F11). Открывать нечего — показ кончился (внутренний `onViewerClose` для show()); у show()
  // пустой блок ещё и ошибка (F12).
  const pendingOpen = useRef(null)
  const openAt = useCallback(
    (resolveIndex, { reportEmpty = false } = {}) => {
      if (failed || ambiguous) {
        callbacks.current.onViewerClose && callbacks.current.onViewerClose()
        return
      }
      if (stories === null) {
        pendingOpen.current = { resolveIndex, reportEmpty }
        return
      }
      const index = resolveIndex(visible)
      if (index >= 0 && index < visible.length) {
        showViewer(index)
        return
      }
      if (reportEmpty && visible.length === 0) report(new Error('PersonalizationStories: the stories block is empty.'))
      callbacks.current.onViewerClose && callbacks.current.onViewerClose()
    },
    [failed, ambiguous, stories, visible, showViewer, report],
  )
  useEffect(() => {
    if (stories === null || !pendingOpen.current) return
    const { resolveIndex, reportEmpty } = pendingOpen.current
    pendingOpen.current = null
    openAt(resolveIndex, { reportEmpty })
  }, [stories, openAt])
  // Блок не загрузился, пока ждали открытия, — показ кончился.
  useEffect(() => {
    if ((failed || ambiguous) && pendingOpen.current) {
      pendingOpen.current = null
      callbacks.current.onViewerClose && callbacks.current.onViewerClose()
    }
  }, [failed, ambiguous])

  useImperativeHandle(
    ref,
    () => ({
      open: (index = 0) => openAt(() => Math.floor(Number(index) || 0)),
      openStory: (id) => openAt((list) => storyIndexForId(list, id)),
      // Без открытого просмотра пауза и продолжение ничего не делают (F11).
      pause: () => {
        if (openedRef.current) setHostPaused(true)
      },
      resume: () => setHostPaused(false),
      reload: () => setGeneration((value) => value + 1),
      // Внутреннее, для show() (F12): неизвестная или не заданная сторис — первая, пустой блок — onError.
      showFrom: (id) => openAt((list) => storyIndexForId(list, id, true), { reportEmpty: true }),
    }),
    [openAt],
  )

  const items = useMemo(
    () =>
      visible.map((story) => ({
        id: story.id,
        title: story.name || '',
        source: story.avatar ? { uri: story.avatar } : undefined,
        ...storyCoverRing(story, seen[String(story.id)]),
      })),
    [visible, seen],
  )

  const closeViewer = useCallback(() => {
    showViewer(null)
    callbacks.current.onViewerClose && callbacks.current.onViewerClose()
  }, [showViewer])

  if (failed || ambiguous || (stories !== null && visible.length === 0)) return null

  return (
    <>
      {bar ? (
        <StoriesBar
          stories={items}
          loading={stories === null}
          onStoryPress={(_, index) => showViewer(index)}
          renderIcon={renderIcon}
          contentContainerStyle={contentContainerStyle}
          style={style}
        />
      ) : null}
      <StoryViewer
        visible={opened !== null}
        stories={visible}
        seen={seen}
        initialStoryIndex={opened ? opened.index : 0}
        openRequest={opened ? opened.request : 0}
        paused={hostPaused}
        onClose={closeViewer}
        onSlideView={(story, slide) => {
          markSeen(story, slide)
          track('view', story, slide)
        }}
        onButtonPress={(story, slide, button) => {
          track('click', story, slide)
          const target = storyButtonTarget(button, slideProduct(slide), Platform.OS)
          // Кнопке некуда вести — просмотр остаётся открытым, хосту только уведомление.
          if (!target) {
            callbacks.current.onElementPress && callbacks.current.onElementPress(button)
            return
          }
          navigate(button, target)
        }}
        onProductPress={(story, slide, product, element) => {
          track('click', story, slide)
          navigate(element || { type: 'product', item: product }, { kind: 'product', product })
        }}
        onPromoCopied={(story, slide, promo, element) => {
          track('click', story, slide)
          callbacks.current.onElementPress && callbacks.current.onElementPress(element)
        }}
        productButtonText={productButtonText}
        promoCaption={promoCaption}
        promoCopiedText={promoCopiedText}
        showProductsText={showProductsText}
        hideProductsText={hideProductsText}
        retryText={retryText}
        closeLabel={closeLabel}
        soundOnLabel={soundOnLabel}
        soundOffLabel={soundOffLabel}
        insets={insets}
        renderIcon={renderIcon}
      />
    </>
  )
}

/** Блок грузится не дольше, мс (D). */
const LOAD_TIMEOUT = 15000

const PersonalizationStories = forwardRef(Stories)
PersonalizationStories.displayName = 'PersonalizationStories'

/**
 * Показ сторис блока без ленты (B8, D): `show({ code, sdk | shopId, startStoryId?, ...колбэки,
 * ...тексты })`. Рисуется слоем `<SdkPopupOverlay>` — тем же хостом, что показывает in-app
 * попапы; без него `onError` и сразу завершение. Промис завершается, когда просмотр закрыт;
 * пустой блок или ошибка загрузки — `onError` и завершение; неизвестный `startStoryId` — с первой
 * сторис (F12). Без `<SdkPopupOverlay>` — `<PersonalizationStories bar={false} ref={...} />` и
 * `ref.open()` / `ref.openStory(id)`.
 *
 * @param {object} options
 * @returns {Promise<void>}
 */
PersonalizationStories.show = (options) => requestStoriesShow(options || {})

/** Слой показа в `<SdkPopupOverlay>`: текущий запрос — скрытый виджет, открывающий просмотр. */
function StoriesShowLayer() {
  const [request, setRequest] = useState(null)
  useEffect(() => attachStoriesShowHost(setRequest), [])
  if (!request) return null
  return <StoriesShowRequest key={request.id} request={request} />
}

function StoriesShowRequest({ request }) {
  const widget = useRef(null)
  const { startStoryId, onError, ...props } = request.options
  useEffect(() => {
    if (widget.current) widget.current.showFrom(startStoryId)
    // Один раз на запрос: запрос монтируется заново по ключу.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <PersonalizationStories
      {...props}
      ref={widget}
      bar={false}
      onError={(error) => {
        onError && onError(error)
        request.finish()
      }}
      onViewerClose={request.finish}
    />
  )
}

registerOverlayLayer('personalization-stories', StoriesShowLayer)

export default PersonalizationStories
