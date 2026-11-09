import { createStoriesPollsApi } from '../../components/widgets/storiesPollsApi'
import { popupSdkPost } from './api'

/**
 * Действия форм попапа v3: проверка полей, тела запросов и отправка через SDK. Чистые функции
 * проверки и тел гоняют тесты; отправка — запросы API SDK от имени инстанса.
 *
 * - emailCollector: согласие и формат email → `subscriptions/manage` (email и флаги согласий,
 *   `profile/set` флагов не знает) → `segments/add` по did, если задан сегмент;
 * - form: обязательные поля, форматы email, телефона и даты → `profile/set` (стандартные поля и
 *   свойства клиента, пустые не шлются) → флаги согласий, если галочка отмечена → `segments/add`;
 * - survey: `POST /api/v3/polls/{nps|csat|ces}/reviews` на хост ЛК, канал `popup`.
 */

export const POPUP_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9\s()-]{6,20}$/

/** Email по формату. */
export const isPopupEmail = (value) => typeof value === 'string' && POPUP_EMAIL_RE.test(value.trim())

/** Телефон: цифры, пробелы, скобки, дефисы, `+` впереди, от 6 знаков. */
export const isPopupPhone = (value) => typeof value === 'string' && PHONE_RE.test(value.trim()) && /\d{5,}/.test(value.replace(/\D/g, ''))

/** Дата рождения из `ДД.ММ.ГГГГ` или `ГГГГ-ММ-ДД` → `ГГГГ-ММ-ДД`; не дата — `null`. */
export function popupBirthday(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  let match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text)
  let year
  let month
  let day
  if (match) {
    day = Number(match[1])
    month = Number(match[2])
    year = Number(match[3])
  } else {
    match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
    if (!match) return null
    year = Number(match[1])
    month = Number(match[2])
    day = Number(match[3])
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  if (year < 1900 || date.getTime() > Date.now()) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Маска ввода даты: цифры в `ДД.ММ.ГГГГ`. */
export function popupBirthdayMask(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

/** Сегмент: целое числом, иначе строкой как есть. */
export const popupSegmentId = (value) => {
  const text = String(value === null || value === undefined ? '' : value).trim()
  return /^\d+$/.test(text) ? Number(text) : text
}

const flagsOf = (fields) => {
  const flags = {}
  fields.forEach((field) => {
    flags[field] = true
  })
  return flags
}

/** Проверка emailCollector: `null` — можно отправлять, иначе причина. */
export function popupEmailProblem(email, consent) {
  if (!consent) return 'consent'
  if (!isPopupEmail(email)) return 'email'
  return null
}

/** Тело `subscriptions/manage` подписки по email (без `shop_id` / `did`, их добавляет SDK). */
export const popupSubscribeParams = (email, consentFields) => ({ email: email.trim(), ...flagsOf(consentFields) })

/**
 * Проверка формы: `{ ok, problems: { [fieldId]: 'required' | 'email' | 'phone' | 'date' } }`.
 */
export function popupValidateForm(fields, values) {
  const problems = {}
  fields.forEach((field) => {
    const value = typeof values[field.id] === 'string' ? values[field.id].trim() : ''
    if (!value) {
      if (field.required) problems[field.id] = 'required'
      return
    }
    if (field.kind === 'email' && !isPopupEmail(value)) problems[field.id] = 'email'
    else if (field.kind === 'phone' && !isPopupPhone(value)) problems[field.id] = 'phone'
    else if (field.kind === 'birthday' && !popupBirthday(value)) problems[field.id] = 'date'
    else if (field.kind === 'gender' && value !== 'm' && value !== 'f') problems[field.id] = 'required'
  })
  return { ok: Object.keys(problems).length === 0, problems }
}

/** Тело `profile/set` формы: стандартные поля по виду, свои — по `propertyKey`; пустые не шлются. */
export function popupProfileParams(fields, values) {
  const params = {}
  fields.forEach((field) => {
    const value = typeof values[field.id] === 'string' ? values[field.id].trim() : ''
    if (!value) return
    if (field.kind === 'custom') {
      if (field.propertyKey) params[field.propertyKey] = value
    } else if (field.kind === 'birthday') {
      const date = popupBirthday(value)
      if (date) params.birthday = date
    } else if (field.kind === 'phone') {
      params.phone = value.replace(/[\s()-]/g, '')
    } else {
      params[field.kind] = value
    }
  })
  return params
}

/**
 * Отзыв опроса: `{ kind, body }` для `POST /api/v3/polls/{kind}/reviews`. NPS шлёт код кампании в
 * `category`, CSAT и CES — в `campaign`; пустой код и пустой комментарий не шлются.
 */
export function popupSurveyReview(survey, rate, comment) {
  const body = { channel: 'popup' }
  const code = survey.campaignCode
  if (code) body[survey.type === 'nps' ? 'category' : 'campaign'] = code
  body.rate = rate
  const text = typeof comment === 'string' ? comment.trim() : ''
  if (text) body.comment = text
  return { kind: survey.type, body }
}

/**
 * Отправка действий от имени инстанса `sdk`; `appHost` — хост ЛК для опросов. Каждое действие —
 * промис: `true` / ответ — успех, ошибка — `Error` с `message` (текст ошибки показывает форма).
 */
export function createPopupActions(sdk, appHost) {
  const post = (path, params) => popupSdkPost(sdk.shop_id, sdk.stream, path, params)
  const fail = (message) => {
    throw new Error(message)
  }
  const addToSegment = async (segmentId) => {
    if (!segmentId) return
    // Сегмент — по did устройства: подписка и профиль уже привязали контакт к нему.
    await post('segments/add', { segment_id: popupSegmentId(segmentId) })
  }
  return {
    async subscribeEmail({ email, consentFields, segmentId }) {
      if (!(await post('subscriptions/manage', popupSubscribeParams(email, consentFields)))) fail('subscription failed')
      await addToSegment(segmentId)
      return true
    },
    async submitForm({ fields, values, consent, consentFields, segmentId }) {
      const profile = popupProfileParams(fields, values)
      if (Object.keys(profile).length && !(await post('profile/set', profile))) fail('profile failed')
      if (consent && consentFields.length && (profile.email || profile.phone)) {
        const contact = {}
        if (profile.email) contact.email = profile.email
        if (profile.phone) contact.phone = profile.phone
        if (!(await post('subscriptions/manage', { ...contact, ...flagsOf(consentFields) }))) fail('subscription failed')
      }
      await addToSegment(segmentId)
      return true
    },
    submitSurvey(survey, rate, comment) {
      const { kind, body } = popupSurveyReview(survey, rate, comment)
      return createStoriesPollsApi(sdk, appHost()).review(kind, body)
    },
  }
}
