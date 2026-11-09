import { isSdkPopupVisible, resumeSdkPopups, setSdkPopupGate } from '../../components/Popup/SdkPopupOverlay'
import { hasOverlayHost } from '../../components/Popup/overlayLayers'
import { popupSlot } from './design'

/**
 * Что сейчас на экране из попапов v3 — общий на процесс (все магазины) список показанных попапов и
 * слотов. Без React: слой в `<SdkPopupOverlay>` подписывается сюда и рисует записи.
 *
 * Слоты: модалка (modal, fullscreen) — одна на процесс и общая со старыми in-app попапами (v3 не
 * открывается поверх старого, старый ждёт закрытия v3); баннер — по одному сверху и снизу, модалку
 * не ждёт.
 */

const entries = new Map()
const listeners = new Set()

const notify = () => listeners.forEach((listener) => listener())

const hasModal = () => Array.from(entries.values()).some((entry) => entry.slot === 'modal')

// Старые попапы ждут в своей очереди, пока открыта модалка v3.
setSdkPopupGate(hasModal)

/** Подписка слоя: `listener()` на каждое изменение. @returns отписка */
export function subscribePopupsV3(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Показанные попапы в порядке показа. */
export const popupsV3Entries = () => Array.from(entries.values())

/** Смонтирован ли хост показа (`<SdkPopupOverlay>`), без него попап не на чем рисовать. */
export const popupsV3HostMounted = () => hasOverlayHost()

/** Можно ли открыть попап сейчас. @returns {{ ok: boolean, reason?: string }} */
export function canPresentPopupV3(popup, owner) {
  const id = `${owner}:${popup.key}`
  if (entries.has(id)) return { ok: false, reason: 'already open' }
  const slot = popupSlot(popup)
  if (slot === 'modal') {
    if (hasModal()) return { ok: false, reason: 'another modal is open' }
    if (isSdkPopupVisible()) return { ok: false, reason: 'an in-app popup is open' }
  } else if (Array.from(entries.values()).some((entry) => entry.slot === slot)) {
    return { ok: false, reason: `${slot} is taken` }
  }
  return { ok: true }
}

/**
 * Показ: запись `{ owner, popup, model, ... }` попадает в слой. `false` — хоста нет или слот
 * занят.
 */
export function presentPopupV3(entry) {
  if (!hasOverlayHost()) return false
  if (!canPresentPopupV3(entry.popup, entry.owner).ok) return false
  const id = `${entry.owner}:${entry.popup.key}`
  entries.set(id, { ...entry, id, slot: popupSlot(entry.popup) })
  notify()
  return true
}

/** Убирает попап с экрана; освободилась модалка — старые попапы продолжают очередь. */
export function dismissPopupV3(id) {
  const entry = entries.get(id)
  if (!entry) return
  entries.delete(id)
  notify()
  if (entry.slot === 'modal') resumeSdkPopups()
}

/** Тесты: убрать всё без событий. */
export function resetPopupsV3Presenter() {
  entries.clear()
  notify()
}
