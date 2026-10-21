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
 */

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

// Звук сторис помнится в пределах процесса (C7): первое открытие — без звука, дальше — как
// оставил пользователь.
let soundMuted = true

/** Звук сторис выключен — выбор пользователя в этом запуске приложения (по умолчанию да). */
export function storySoundMuted() {
  return soundMuted
}

/** Запоминает выбор звука до конца процесса. */
export function rememberStorySoundMuted(muted) {
  soundMuted = !!muted
}
