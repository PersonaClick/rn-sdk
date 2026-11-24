/**
 * Необязательные нативные модули сторис V2. Каждый подтягивается в try/catch: у SDK это
 * опциональные peer-зависимости (Metro из @react-native/metro-config собирает такой require
 * и без установленного пакета), и без них сторис работают, просто беднее.
 *
 * - react-native-video — видео-слайды; без него вместо видео показывается превью слайда.
 * - @react-native-clipboard/clipboard — копирование промокода; без него — устаревший Clipboard
 *   ядра React Native, пока он ещё есть; нет ни того, ни другого — один раз пишется
 *   предупреждение, и промокод не копируется.
 * - react-native-volume-manager — кнопка громкости «вверх» включает звук сторис (C7); без него
 *   звук включается только кнопкой на слайде.
 * - react-native-safe-area-context — нижний отступ под навигационной панелью Android, когда
 *   модалка рисуется под ней (edge-to-edge); без него — оценка по размерам экрана и окна.
 *
 * «Поделиться» — `Share` ядра React Native, без зависимостей.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, Platform, Share } from 'react-native'
import { getStorageKey } from '../../utils'

// Модули берутся при первом обращении, а не при импорте: плашке цены нужен только буфер обмена,
// и импорт кита не должен поднимать видеоплеер.
let videoModule
let volumeModule
let safeAreaModule
let clipboardWarned = false

/** Компонент Video из react-native-video или `null`, если пакета нет. */
export function storyVideoComponent() {
  if (videoModule === undefined) {
    try {
      videoModule = require('react-native-video').default || null
    } catch (error) {
      videoModule = null
    }
  }
  return videoModule
}

/**
 * Кладёт строку в буфер обмена.
 * @returns {boolean} получилось ли
 */
export function copyToClipboard(text) {
  if (typeof text !== 'string' || text.length === 0) return false
  try {
    const community = require('@react-native-clipboard/clipboard')
    const clipboard = community?.default || community
    if (clipboard?.setString) {
      clipboard.setString(text)
      return true
    }
  } catch (error) {
    // Пакета нет — пробуем ядро.
  }
  try {
    // По пути, а не из индекса `react-native`: геттер в индексе пишет предупреждение об устаревании.
    const core = require('react-native/Libraries/Components/Clipboard/Clipboard').default
    if (core?.setString) {
      core.setString(text)
      return true
    }
  } catch (error) {
    // Ядро без Clipboard — ниже предупреждение.
  }
  if (!clipboardWarned) {
    clipboardWarned = true
    console.warn(
      '[PersonalizationStories] No clipboard module: install @react-native-clipboard/clipboard to copy promo codes.',
    )
  }
  return false
}

/**
 * Слушает кнопки громкости (react-native-volume-manager): `onVolumeUp` — громкость выросла.
 * Пакета нет — ничего не происходит.
 *
 * @param {() => void} onVolumeUp
 * @returns {() => void} отписка
 */
export function listenVolumeUp(onVolumeUp) {
  if (volumeModule === undefined) {
    try {
      const module = require('react-native-volume-manager')
      volumeModule = module?.VolumeManager || module?.default || null
    } catch (error) {
      volumeModule = null
    }
  }
  if (!volumeModule || typeof volumeModule.addVolumeListener !== 'function') return () => {}
  let last = null
  let alive = true
  try {
    Promise.resolve(volumeModule.getVolume?.())
      .then((result) => {
        if (alive && last === null) last = volumeOf(result)
      })
      .catch(() => {})
  } catch (error) {
    // Начальная громкость — удобство: без неё первый же отчёт станет точкой отсчёта.
  }
  let subscription = null
  try {
    subscription = volumeModule.addVolumeListener((result) => {
      const volume = volumeOf(result)
      if (volume === null) return
      if (last !== null && volume > last + 0.001) onVolumeUp()
      last = volume
    })
  } catch (error) {
    subscription = null
  }
  return () => {
    alive = false
    try {
      subscription?.remove?.()
    } catch (error) {
      // Отписка не должна ронять закрытие просмотра.
    }
  }
}

const volumeOf = (result) => {
  const value = typeof result === 'number' ? result : result?.volume
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Нижний отступ системы из react-native-safe-area-context (`initialWindowMetrics`), если пакет
 * есть и знает его; иначе `null`.
 */
export function systemBottomInset() {
  if (safeAreaModule === undefined) {
    try {
      safeAreaModule = require('react-native-safe-area-context') || null
    } catch (error) {
      safeAreaModule = null
    }
  }
  const bottom = safeAreaModule?.initialWindowMetrics?.insets?.bottom
  return typeof bottom === 'number' && Number.isFinite(bottom) ? bottom : null
}

// Звук сторис старой ленты помнится в пределах процесса (C7): первое открытие — без звука, дальше —
// как оставил пользователь. У сторис v3 — своё состояние, отдельно от старых просмотров (R9), как в
// JS SDK: выбор кнопки звука магазина помнится на устройстве (`@PersonaClick_<shop>_stories_mute`), без
// выбора — без звука; у просмотра v3 без магазина — только в этом запуске.
let soundMuted = true
const soundByShop = new Map()

const soundKey = (shopId) => getStorageKey('stories_mute', shopId)

/** Область звука v3: строка магазина (`''` — без магазина); `undefined` / `null` — старая лента. */
const v3Scope = (shopId) => (shopId === undefined || shopId === null ? null : String(shopId))

/**
 * Звук сторис выключен — выбор пользователя (по умолчанию да): с `shopId` (сторис v3; `''` — без
 * магазина) — выбор v3 этого магазина, без него — выбор старой ленты в этом запуске приложения.
 */
export function storySoundMuted(shopId) {
  const shop = v3Scope(shopId)
  if (shop !== null) return soundByShop.has(shop) ? soundByShop.get(shop) : true
  return soundMuted
}

/**
 * Запоминает выбор кнопки звука: у сторис v3 (`shopId`) — выбор магазина, на устройстве (без магазина
 * — до конца процесса); у старой ленты — до конца процесса. Кнопки громкости сюда не ходят.
 */
export function rememberStorySoundMuted(muted, shopId) {
  const shop = v3Scope(shopId)
  if (shop === null) {
    soundMuted = !!muted
    return
  }
  soundByShop.set(shop, !!muted)
  if (!shop) return
  try {
    Promise.resolve(AsyncStorage.setItem(soundKey(shop), String(!!muted))).catch(() => {})
  } catch (error) {
    // Нет хранилища — выбор живёт до конца процесса.
  }
}

/** Читает сохранённый выбор звука магазина (один раз); выбор, сделанный за время чтения, важнее. */
export async function loadStorySoundMuted(shopId) {
  if (!shopId) return
  const shop = String(shopId)
  if (soundByShop.has(shop)) return
  try {
    const value = await AsyncStorage.getItem(soundKey(shop))
    if (!soundByShop.has(shop) && (value === 'true' || value === 'false')) soundByShop.set(shop, value === 'true')
  } catch (error) {
    // Не прочиталось — без звука, как по умолчанию.
  }
}

/** Для тестов: забыть выборы звука магазинов. */
export function resetStorySoundMuted() {
  soundByShop.clear()
  soundMuted = true
}

/** Сколько на Android ждать, что окно выбора заберёт фокус, мс; не забрало — окна не было. */
const ANDROID_SHARE_SHEET_WAIT = 1000

/**
 * Системное окно «Поделиться» с одной ссылкой. iOS — `{ url }`, поповер iPad привязан к `anchor`
 * (тег кнопки); Android — `{ message: url }`. Промис завершается, когда окно закрыто, и никогда
 * не отклоняется. На iOS это промис `Share.share` (его завершает completionWithItemsHandler); на
 * Android он завершается сразу после запуска окна выбора, поэтому ждём, пока окно приложения
 * вернёт фокус (`blur` → `focus` или фон → `active`).
 *
 * @param {string} url
 * @param {number|null} [anchor]
 * @returns {Promise<void>}
 */
export function shareStoryLink(url, anchor) {
  const open = () =>
    Platform.OS === 'android' ? Share.share({ message: url }) : Share.share({ url }, anchor ? { anchor } : undefined)
  if (Platform.OS !== 'android') {
    return Promise.resolve()
      .then(open)
      .then(
        () => undefined,
        () => undefined,
      )
  }
  return new Promise((resolve) => {
    let left = false
    let done = false
    let timer = null
    const subscriptions = []
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      subscriptions.forEach((subscription) => subscription?.remove?.())
      resolve()
    }
    const leave = () => {
      left = true
      clearTimeout(timer)
    }
    try {
      subscriptions.push(AppState.addEventListener('blur', leave))
      subscriptions.push(AppState.addEventListener('focus', () => left && finish()))
      subscriptions.push(AppState.addEventListener('change', (next) => (next === 'active' ? left && finish() : leave())))
    } catch (error) {
      // Без событий окна пауза снимется по таймеру.
    }
    Promise.resolve()
      .then(open)
      .then(() => {
        if (!left && !done) timer = setTimeout(finish, ANDROID_SHARE_SHEET_WAIT)
      }, finish)
  })
}
