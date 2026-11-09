import { Platform } from 'react-native'

/** Положительное число — или число строкой; `false`, `true`, ноль и мусор — «нет скидки». */
function positiveNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && !value.trim()) return undefined
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : undefined
}

/** Текст бейджа: `discount_formatted`, иначе «число%»; минус впереди ровно один. */
function discountBadge(formatted, value) {
  const text = typeof formatted === 'string' && formatted.trim() ? formatted.trim() : `${value}%`
  return `-${text.replace(/^-+\s*/, '')}`
}

/**
 * Товар API → `PersonalizationProduct`, данные карточки кита. Один маппер на все виджеты с
 * данными: поиск, рекомендации, категория и коллекция отдают товар одной формы (сырой JSON в
 * snake_case).
 *
 * Строки берутся уже отформатированными сервером. Цена — `price_formatted`, иначе
 * «цена валюта». Старая цена — `oldprice_formatted`, только если `oldprice` больше цены.
 * Бейдж скидки — только при показанной старой цене и положительном числе скидки (`discount`,
 * иначе `discount_percent`): текст `discount_formatted`, иначе «число%», ровно с одним «-»
 * впереди. Скидка из `discount_percent` всегда «число%». Картинка — `picture` (уменьшенная копия), иначе оригинал. Диплинк — своей платформы
 * (`deeplink_android` / `deeplink_ios`). Рейтинга в API нет.
 *
 * Числа API иногда приходят строками (`products/get`), поэтому сравниваются через Number.
 *
 * @param {object} product товар ответа API
 * @param {string|null} [actionText] текст кнопки карточки
 * @param {'android'|'ios'|string} [os] платформа запуска
 */
export function toPersonalizationProduct(product, actionText, os = Platform.OS) {
  const price = Number(product.price) || 0
  const oldPrice = Number(product.oldprice) || 0
  const hasOldPrice = oldPrice > price && !!product.oldprice_formatted
  // `discount_formatted` — текст поля `discount`; к числу из `discount_percent` он не относится
  // (иначе при `discount: 0` вышло бы «-0%»).
  const fromDiscount = positiveNumber(product.discount)
  const fromPercent = fromDiscount == null ? positiveNumber(product.discount_percent) : undefined
  const discount = !hasOldPrice
    ? undefined
    : fromDiscount != null
      ? discountBadge(product.discount_formatted, fromDiscount)
      : fromPercent != null
        ? discountBadge(null, fromPercent)
        : undefined
  const imageUrl = product.picture || product.image_url || null
  const deeplink = os === 'android' ? product.deeplink_android : os === 'ios' ? product.deeplink_ios : null
  return {
    id: String(product.id ?? product.uniqid),
    name: product.name || '',
    price: product.price_formatted || `${price} ${product.currency || ''}`.trim(),
    source: imageUrl ? { uri: imageUrl } : undefined,
    imageUrl,
    brand: product.brand || undefined,
    oldPrice: hasOldPrice ? product.oldprice_formatted : undefined,
    discount,
    actionText: actionText || undefined,
    url: product.url || null,
    deeplink: deeplink || null,
  }
}
