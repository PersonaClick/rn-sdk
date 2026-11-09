import AsyncStorage from '@react-native-async-storage/async-storage'
import { getStorageKey } from '../../utils'

/**
 * Частота показа и пауза попапов v3 — порт `frequency.ts` JS SDK один в один. На устройстве по
 * магазину хранятся время и сеанс последнего показа каждого попапа; `every_page` — в памяти, на
 * текущее открытие экрана («страница» mobile).
 *
 * - пауза `cooldown_minutes` проверяется до частоты;
 * - `once_session` сравнивает сеанс (`sid`) последнего показа с текущим;
 * - `once_day` / `once_week` / `once_month` — 24 ч, 7 и 30 дней;
 * - попап, уже показанный на этой «странице», второй раз на ней не показывается;
 * - в тестовом режиме ничего не записывается.
 */

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

/** Минимальный промежуток между показами периодических частот. */
export const POPUP_PERIODS = Object.freeze({ once_day: DAY, once_week: 7 * DAY, once_month: 30 * DAY })

/**
 * Хранилище показов магазина: одна запись AsyncStorage `{ [id]: { last, sid } }`, читается один раз
 * (`load`), дальше чтение синхронное из памяти, запись — в память и на диск.
 */
export function createPopupShowStore(shopId) {
  const key = getStorageKey('popups_v3_shows', shopId)
  let data = {}
  let loaded = null
  return {
    load() {
      if (!loaded) {
        loaded = AsyncStorage.getItem(key)
          .then((raw) => {
            const parsed = raw ? JSON.parse(raw) : null
            if (parsed && typeof parsed === 'object') data = { ...parsed, ...data }
          })
          .catch(() => {})
      }
      return loaded
    },
    read: (id) => data[id] || null,
    write(id, record) {
      data = { ...data, [id]: record }
      AsyncStorage.setItem(key, JSON.stringify(data)).catch(() => {})
    },
  }
}

/** Хранилище в памяти — для тестов и показа без диска. */
export function createMemoryShowStore(initial = {}) {
  let data = { ...initial }
  return {
    load: () => Promise.resolve(),
    read: (id) => data[id] || null,
    write(id, record) {
      data = { ...data, [id]: record }
    },
    dump: () => data,
  }
}

/**
 * @param {{ store: object, testMode: () => boolean, sid: () => string, now?: () => number }} options
 */
export function createPopupFrequency({ store, testMode, sid, now = () => Date.now() }) {
  const shownOnPage = new Set()

  const lastShow = (id) => {
    const record = store.read(id)
    return record && typeof record.last === 'number' && Number.isFinite(record.last) ? record.last : null
  }

  return {
    /** Новая «страница» — открыт экран. */
    newPage() {
      shownOnPage.clear()
    },

    lastShow,

    /** @returns {{ ok: boolean, reason?: string }} */
    canShow(popup) {
      const id = popup.key
      const time = now()
      const last = lastShow(id)
      if (shownOnPage.has(id)) return { ok: false, reason: 'already shown on this screen' }
      const cooldown = Number(popup.cooldownMinutes) || 0
      if (cooldown > 0 && last !== null && time - last < cooldown * MINUTE) {
        return { ok: false, reason: `cooldown ${cooldown} min` }
      }
      switch (popup.frequency) {
        case 'every_page':
          return { ok: true }
        case 'once_life':
          return last === null ? { ok: true } : { ok: false, reason: 'once_life: already shown' }
        case 'once_day':
        case 'once_week':
        case 'once_month':
          return last === null || time - last >= POPUP_PERIODS[popup.frequency]
            ? { ok: true }
            : { ok: false, reason: `${popup.frequency}: shown recently` }
        case 'once_session':
        default: {
          const record = store.read(id)
          const shownSid = record && typeof record.sid === 'string' ? record.sid : null
          return shownSid !== null && shownSid === sid()
            ? { ok: false, reason: 'once_session: already shown in this session' }
            : { ok: true }
        }
      }
    },

    /** Показ состоялся: «страница» помнит его всегда, диск — кроме тестового режима. */
    record(popup) {
      const id = popup.key
      shownOnPage.add(id)
      if (testMode()) return
      const record = { last: now() }
      const session = sid()
      if (session) record.sid = session
      else {
        const previous = store.read(id)
        if (previous && previous.sid) record.sid = previous.sid
      }
      store.write(id, record)
    },
  }
}
