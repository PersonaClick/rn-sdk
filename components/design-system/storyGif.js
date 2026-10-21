/**
 * GIF на слайде сторис (G1, G2): подпись, задержки кадров, длина одного прохода. Задержка
 * короче 20 мс (и нулевая) считается за 100 мс — как в браузерах.
 *
 * RN сам GIF не рисует — это делает `<Image>` платформы (на Android нужен модуль Fresco
 * `animated-gif` в приложении). SDK только читает длину прохода, чтобы слайд шёл по большему
 * из неё и времени админки. Пауза GIF и первый кадр на обложках ядру RN недоступны (G9).
 */

const MIN_DELAY_MS = 20
const FALLBACK_DELAY_MS = 100

const SIGNATURES = ['GIF87a', 'GIF89a']

/** Байты (`Uint8Array`) начинаются с подписи GIF87a или GIF89a. */
export function isGif(bytes) {
  if (!bytes || bytes.length < 6) return false
  const head = String.fromCharCode(...bytes.slice(0, 6))
  return SIGNATURES.includes(head)
}

const delayMs = (centiseconds) => {
  const ms = centiseconds * 10
  return ms < MIN_DELAY_MS ? FALLBACK_DELAY_MS : ms
}

/** Задержки кадров, мс, уже с поправкой на короткие; `null` — не GIF или файл битый. */
export function gifFrameDelaysMs(bytes) {
  if (!isGif(bytes)) return null
  let at = 6
  const byte = () => {
    if (at >= bytes.length) throw new RangeError('gif ended early')
    return bytes[at++]
  }
  const skip = (count) => {
    at += count
    if (at > bytes.length) throw new RangeError('gif ended early')
  }
  const skipSubBlocks = () => {
    for (let size = byte(); size !== 0; size = byte()) skip(size)
  }
  const colorTable = (flags) => (flags & 0x80 ? 3 * (1 << ((flags & 0x07) + 1)) : 0)
  try {
    skip(4) // ширина и высота
    const packed = byte()
    skip(2) // фон и пропорции пикселя
    skip(colorTable(packed))
    const delays = []
    let pending = 0
    while (at < bytes.length) {
      const block = byte()
      if (block === 0x21) {
        const label = byte()
        if (label === 0xf9) {
          const size = byte()
          const start = at
          byte() // флаги
          pending = byte() | (byte() << 8)
          at = start + size
        }
        skipSubBlocks()
      } else if (block === 0x2c) {
        skip(8) // положение и размер кадра
        skip(colorTable(byte()))
        byte() // минимальный размер кода LZW
        skipSubBlocks()
        delays.push(delayMs(pending))
        pending = 0
      } else {
        break // 0x3B — конец файла; всё прочее — тоже конец
      }
    }
    return delays.length ? delays : null
  } catch (error) {
    return null
  }
}

/** Длина одного прохода, мс; `null` — не GIF или файл битый. */
export function gifLoopMs(bytes) {
  const delays = gifFrameDelaysMs(bytes)
  return delays ? delays.reduce((sum, value) => sum + value, 0) : null
}

/**
 * Длина слайда с GIF (G2): большее из времени админки и одного прохода. Проход неизвестен —
 * время админки.
 */
export function animatedSlideDurationMs(serverMs, loopMs) {
  const loop = Number(loopMs)
  return Number.isFinite(loop) && loop > 0 ? Math.max(serverMs, loop) : serverMs
}

/**
 * Длина прохода GIF по адресу: байты качаются, только если ответ — GIF (Content-Type), иначе
 * запрос обрывается и картинка дважды не качается (G9). Ошибка или не GIF — `null`.
 */
export async function fetchGifLoopMs(url, fetchImpl = globalThis.fetch) {
  if (typeof url !== 'string' || !url || typeof fetchImpl !== 'function') return null
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  try {
    const response = await fetchImpl(url, controller ? { signal: controller.signal } : undefined)
    const type = String(response?.headers?.get?.('content-type') || '')
    if (!response?.ok || !/image\/gif/i.test(type)) {
      controller?.abort()
      return null
    }
    return gifLoopMs(new Uint8Array(await response.arrayBuffer()))
  } catch (error) {
    return null
  }
}
