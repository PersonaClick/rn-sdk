import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Недавние запросы пользователя — локальная история виджета поиска, по магазину.
 *
 * Сервер тоже помнит последние запросы (`last_queries` в `search/blank`), но не умеет
 * забывать по одному, а в макете у каждого тега крестик и есть «Clear». Поэтому история
 * живёт в AsyncStorage под ключом с id магазина.
 */
export class RecentSearches {
  constructor(shopKey, limit) {
    this.key = `personalization.ui.recentSearches.${shopKey}`
    this.limit = limit
  }

  async load() {
    try {
      const raw = await AsyncStorage.getItem(this.key)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
    } catch (e) {
      return []
    }
  }

  /** Кладёт запрос в начало, убирая дубль, и режет по лимиту. */
  async add(query) {
    const trimmed = String(query || '').trim()
    const items = await this.load()
    if (!trimmed) return items
    const next = [trimmed, ...items.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())]
    return this.save(next.slice(0, this.limit))
  }

  async remove(query) {
    return this.save((await this.load()).filter((item) => item !== query))
  }

  async clear() {
    return this.save([])
  }

  async save(items) {
    try {
      await AsyncStorage.setItem(this.key, JSON.stringify(items))
    } catch (e) {
      // История — удобство, не данные: без хранилища виджет просто её не помнит.
    }
    return items
  }
}

/**
 * Товар ответа поиска → данные карточки кита. Строки берутся уже отформатированными
 * сервером (`price_formatted`, `oldprice_formatted`, `discount_formatted`); картинка —
 * `picture` (уменьшенная копия), иначе оригинал.
 */
export function toCardProduct(product, actionText) {
  const price = Number(product.price) || 0
  const oldPrice = Number(product.oldprice) || 0
  const hasOldPrice = oldPrice > price && !!product.oldprice_formatted
  const discount = hasOldPrice
    ? product.discount_formatted || (product.discount > 0 ? `${product.discount}%` : null)
    : null
  const imageUrl = product.picture || product.image_url || null
  return {
    id: String(product.id),
    name: product.name || '',
    price: product.price_formatted || `${price} ${product.currency || ''}`.trim(),
    source: imageUrl ? { uri: imageUrl } : undefined,
    imageUrl,
    brand: product.brand || undefined,
    oldPrice: hasOldPrice ? product.oldprice_formatted : undefined,
    discount: discount ? (String(discount).startsWith('-') ? String(discount) : `-${discount}`) : undefined,
    actionText: actionText || undefined,
  }
}

/** Имя родительской категории: в ответе родитель — это id, имя ищем среди пришедших. */
export function parentName(category, all) {
  if (!category.parent) return undefined
  const parent = all.find((item) => item.id === category.parent)
  return parent ? parent.name : undefined
}
