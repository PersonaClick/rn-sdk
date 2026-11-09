import { popupApplyStaticVariables, popupHasVariable, popupMapStrings, popupStaticVariables } from './markup'
import { popupTexts } from './texts'
import {
  isBlank,
  popupBool,
  popupColor,
  popupColorOr,
  popupColorWithOpacity,
  popupEnum,
  popupNum,
  popupShadowColor,
  popupStr,
} from './values'

/**
 * Попап v3 и его документ design → нормализованная модель, которую рисует рендер. Чистые функции
 * без React — их гоняют тесты на общих фикстурах. Правила — по компилятору дизайна на бэке
 * (`design_compiler/**`): сетка, запасные значения коробки и каждого элемента, тексты по умолчанию.
 *
 * Правило умолчаний: значение из документа → `DEFAULTS` типа (стиль нового элемента в редакторе) →
 * запасное компилятора. `null` и пустая строка — отсутствие значения. Структурные ключи форм
 * (`emailLayout`, `emailConsentFields`, `formFields`, `formConsentFields`) берутся только из
 * документа, как у компилятора: умолчания редактора поменяли бы поведение формы.
 */

/** Макеты mobile и их расположение. */
export const POPUP_LAYOUTS = Object.freeze({ banner: ['top', 'bottom'], modal: ['center'], fullscreen: ['center'] })
/** Триггеры mobile. */
export const POPUP_TRIGGERS = Object.freeze(['app_start', 'screen_open', 'time_on_screen', 'track_event', 'manual'])
/** Частоты; неизвестная — `once_session`, как в JS SDK. */
export const POPUP_FREQUENCIES = Object.freeze([
  'once_session',
  'once_life',
  'once_day',
  'once_week',
  'once_month',
  'every_page',
])

/** Лимиты документа (`Constants::Storefront::Popups`). */
export const POPUP_LIMITS = Object.freeze({ rows: 50, columns: 6, elements: 200, formFields: 8 })

/** Флаги подписки, которые ставят формы при согласии. */
export const POPUP_CONSENT_FIELDS = Object.freeze(['email_bulk', 'email_chain', 'email_transactional'])

/** Промежуток между строками сетки. */
export const POPUP_ROWS_GAP = 8

const ALIGNS = ['left', 'center', 'right']
const VERTICAL_ALIGNS = ['top', 'center', 'bottom']

/** Попап из ответа API → `{ popup }` или `{ reason }`, почему он пропущен на mobile. */
export function parsePopupV3(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { reason: 'not an object' }
  const id = raw.id
  if (!(typeof id === 'number' && Number.isFinite(id)) && !(typeof id === 'string' && id.trim())) return { reason: 'no id' }
  const layout = raw.layout
  if (!Object.prototype.hasOwnProperty.call(POPUP_LAYOUTS, layout)) return { id, reason: `unknown layout ${layout}` }
  const trigger = raw.trigger_type
  if (POPUP_TRIGGERS.indexOf(trigger) === -1) return { id, reason: `unknown trigger_type ${trigger}` }
  const placements = POPUP_LAYOUTS[layout]
  const screens = Array.isArray(raw.target_screens)
    ? raw.target_screens.map((screen) => popupStr(screen).trim()).filter((screen) => screen.length > 0)
    : []
  const list = raw.promo_code_list_id
  return {
    popup: {
      id,
      key: String(id),
      layout,
      placement: popupEnum(raw.placement, placements, placements[0]),
      trigger,
      triggerValue: Math.max(0, popupNum(raw.trigger_value, 0)),
      triggerEvent: popupStr(raw.trigger_event).trim(),
      frequency: popupEnum(raw.frequency, POPUP_FREQUENCIES, 'once_session'),
      cooldownMinutes: Math.max(0, popupNum(raw.cooldown_minutes, 0)),
      promoCodeListId: isBlank(list) || list === false ? null : list,
      targetScreens: screens,
      design: raw.design && typeof raw.design === 'object' && !Array.isArray(raw.design) ? raw.design : {},
    },
  }
}

/** Слот показа: модалка одна на процесс, баннеры — по одному сверху и снизу. */
export const popupSlot = (popup) => (popup.layout === 'banner' ? `banner-${popup.placement}` : 'modal')

/**
 * Нужен ли персональный промокод до показа: у попапа есть `promo_code_list_id` и в дизайне есть
 * `{{promo_code}}` или элемент промокода не со статическим кодом.
 */
export function popupNeedsPromoCode(popup) {
  if (popup.promoCodeListId === null || popup.promoCodeListId === undefined) return false
  let json = ''
  try {
    json = JSON.stringify(popup.design) || ''
  } catch (error) {
    json = ''
  }
  if (popupHasVariable(json, 'promo_code')) return true
  const elements = Array.isArray(popup.design.elements) ? popup.design.elements : []
  return elements.some(
    (element) =>
      element && element.type === 'promoCode' && !(element.style && element.style.promoSource === 'static'),
  )
}

/** Ссылка из дизайна: пусто — `null`; `javascript:`, `data:`, `vbscript:` — `null`; остальное как есть. */
export function popupSafeLink(value) {
  const text = popupStr(value).trim()
  if (!text) return null
  // eslint-disable-next-line no-control-regex
  const scheme = text.replace(/[\u0000- ]/g, '').toLowerCase()
  if (/^(javascript|data|vbscript):/.test(scheme)) return null
  return text
}

/** Адрес картинки: только `http(s)`. */
export function popupSafeImageUrl(value) {
  const text = popupStr(value).trim()
  return /^https?:\/\//i.test(text) ? text : null
}

// ---------------------------------------------------------------- элементы

/** Стили новых элементов в редакторе (`DEFAULTS` классов элементов компилятора). */
export const POPUP_ELEMENT_DEFAULTS = Object.freeze({
  text: { fontSize: 16, bgColor: 'transparent', messageAlign: 'left' },
  box: { bgColor: '#f8fafc', borderRadius: 12, paddingX: 16, paddingY: 16 },
  button: {
    buttonAction: 'link',
    buttonAlign: 'center',
    buttonBgColor: '#2563eb',
    buttonTextColor: '#ffffff',
    buttonFontSize: 14,
    buttonPaddingX: 20,
    buttonPaddingY: 10,
    buttonRadius: 10,
  },
  close: {
    closeIconMode: 'text',
    buttonAlign: 'right',
    buttonBgColor: 'transparent',
    buttonTextColor: '#71717a',
    buttonFontSize: 22,
    buttonPaddingX: 8,
    buttonPaddingY: 2,
    buttonRadius: 999,
  },
  image: { bgColor: 'transparent', imageHeightMode: 'auto', imageObjectFit: 'cover', imageRadius: 8 },
  emailCollector: { borderRadius: 12, buttonBgColor: '#2563eb', buttonTextColor: '#ffffff' },
  form: { borderRadius: 12, buttonBgColor: '#2563eb', buttonTextColor: '#ffffff' },
  promoCode: {
    promoSource: 'personal',
    promoShowCopy: true,
    promoCodeBg: '#fef3c7',
    promoCodeColor: '#92400e',
    promoCodeRadius: 10,
    promoCodeFontSize: 20,
    messageAlign: 'center',
    bgColor: 'transparent',
  },
  survey: {
    surveyType: 'nps',
    surveyScaleBg: '#f3f4f6',
    surveyScaleColor: '#111827',
    surveyScaleActiveBg: '#2563eb',
    surveyScaleActiveColor: '#ffffff',
    buttonBgColor: '#2563eb',
    buttonTextColor: '#ffffff',
  },
  recommendation: { bgColor: 'transparent' },
})

const STRUCTURAL_KEYS = ['emailLayout', 'emailConsentFields', 'formFields', 'formConsentFields']

function withDefaults(type, style) {
  const merged = {}
  Object.keys(style).forEach((key) => {
    if (!isBlank(style[key])) merged[key] = style[key]
  })
  const defaults = POPUP_ELEMENT_DEFAULTS[type] || {}
  Object.keys(defaults).forEach((key) => {
    if (STRUCTURAL_KEYS.indexOf(key) === -1 && !Object.prototype.hasOwnProperty.call(merged, key)) merged[key] = defaults[key]
  })
  return merged
}

/** Коробка элемента — `Context#box_declarations` компилятора. */
function boxOf(style) {
  const shadowY = popupNum(style.shadowY, 0)
  const shadowBlur = popupNum(style.shadowBlur, 0)
  return {
    bgColor: popupColorOr(style.bgColor, '#ffffff'),
    textColor: popupColorOr(style.textColor, '#111827'),
    borderWidth: Math.max(0, popupNum(style.borderWidth, 0)),
    borderColor: popupColorOr(style.borderColor, '#d4d4d8'),
    borderRadius: Math.max(0, popupNum(style.borderRadius, 0)),
    paddingX: Math.max(0, popupNum(style.paddingX, 0)),
    paddingY: Math.max(0, popupNum(style.paddingY, 0)),
    fontFamily: popupStr(style.fontFamily).trim() || null,
    fontSize: popupNum(style.fontSize, 12),
    fontWeight: popupNum(style.fontWeight, 500),
    letterSpacing: popupNum(style.letterSpacing, 0),
    lineHeight: popupNum(style.lineHeight, 1.35),
    opacity: Math.max(0, Math.min(1, popupNum(style.opacity, 1))),
    shadow: shadowY === 0 && shadowBlur === 0 ? null : { y: shadowY, blur: shadowBlur, color: popupShadowColor(style.shadowColor) },
  }
}

const buttonStyle = (style, fallbacks) => ({
  bgColor: popupColorOr(style.buttonBgColor, fallbacks.bg),
  textColor: popupColorOr(style.buttonTextColor, fallbacks.color),
  fontSize: popupNum(style.buttonFontSize, fallbacks.fontSize),
  paddingX: Math.max(0, popupNum(style.buttonPaddingX, fallbacks.paddingX)),
  paddingY: Math.max(0, popupNum(style.buttonPaddingY, fallbacks.paddingY)),
  radius: Math.max(0, popupNum(style.buttonRadius, fallbacks.radius)),
  fontFamily: popupStr(style.fontFamily).trim() || null,
})

/** Коробка форм (emailCollector, form) — своя, с другими запасными значениями. */
const formBox = (style) => ({
  ...boxOf(style),
  bgColor: popupColorOr(style.bgColor, '#ffffff'),
  textColor: popupColorOr(style.textColor, '#0f172a'),
  borderWidth: Math.max(0, popupNum(style.borderWidth, 0)),
  borderColor: popupColorOr(style.borderColor, '#e2e8f0'),
  borderRadius: Math.max(0, popupNum(style.borderRadius, 12)),
  paddingX: Math.max(0, popupNum(style.paddingX, 12)),
  paddingY: Math.max(0, popupNum(style.paddingY, 12)),
})

const inputStyle = (style, prefix) => ({
  bgColor: popupColorOr(style[`${prefix}InputBg`], '#f8fafc'),
  textColor: popupColorOr(style[`${prefix}InputColor`], '#0f172a'),
  borderColor: popupColorOr(style[`${prefix}InputBorderColor`], '#cbd5e1'),
  radius: Math.max(0, popupNum(style[`${prefix}InputRadius`], 10)),
  paddingY: Math.max(0, popupNum(style.buttonPaddingY, 10)),
  fontSize: Math.max(popupNum(style.fontSize, 13), 12),
})

const FORM_BUTTON = { bg: '#2563eb', color: '#ffffff', fontSize: 14, paddingX: 18, paddingY: 10, radius: 10 }

const textProps = (style, box) => ({
  message: popupStr(style.message),
  align: popupEnum(style.messageAlign, ALIGNS, 'left'),
  fontSize: popupNum(style.messageFontSize, box.fontSize),
  fontWeight: popupNum(style.messageFontWeight, box.fontWeight),
})

/** text и box: текст с разметкой; `messageFontSize` / `messageFontWeight` перекрывают общие. */
const textElement = (style) => {
  const box = boxOf(style)
  return { box, props: textProps(style, box) }
}

/** Флаги согласий emailCollector: `emailConsentFields` → `emailConsents[].field` → подписи → все три. */
function emailConsentFields(style) {
  const known = (list) => list.filter((field, index) => POPUP_CONSENT_FIELDS.indexOf(field) !== -1 && list.indexOf(field) === index)
  let fields = known((Array.isArray(style.emailConsentFields) ? style.emailConsentFields : []).map(popupStr))
  if (fields.length) return fields
  fields = known(
    (Array.isArray(style.emailConsents) ? style.emailConsents : [])
      .filter((item) => item && typeof item === 'object')
      .map((item) => popupStr(item.field)),
  )
  if (fields.length) return fields
  if (!isBlank(style.emailConsentBulkLabel)) fields.push('email_bulk')
  if (!isBlank(style.emailConsentChainLabel)) fields.push('email_chain')
  if (!isBlank(style.emailConsentTransactionalLabel)) fields.push('email_transactional')
  return fields.length ? fields : POPUP_CONSENT_FIELDS.slice()
}

function emailConsentLabel(style, texts) {
  const label = popupStr(style.emailConsentLabel).trim()
  if (label) return label
  const first = Array.isArray(style.emailConsents) ? style.emailConsents[0] : null
  if (first && typeof first === 'object' && !isBlank(first.label)) return popupStr(first.label)
  return isBlank(style.emailConsentBulkLabel) ? texts.emailConsent : popupStr(style.emailConsentBulkLabel)
}

const FORM_KINDS = ['email', 'phone', 'first_name', 'last_name', 'birthday', 'gender', 'custom']
const FORM_INPUTS = { email: 'email', phone: 'phone', birthday: 'date', gender: 'select' }

/** Поля формы как `Form#normalized_fields`: известные виды, не больше 8, чистые id и ключи. */
export function popupFormFields(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((field) => field && typeof field === 'object' && !Array.isArray(field) && FORM_KINDS.indexOf(field.kind) !== -1)
    .slice(0, POPUP_LIMITS.formFields)
    .map((field, index) => ({
      id: popupStr(field.id).replace(/[^A-Za-z0-9_-]/g, '') || `field-${index}`,
      kind: field.kind,
      label: popupStr(field.label),
      placeholder: popupStr(field.placeholder),
      required: field.required === true,
      propertyKey: popupStr(field.propertyKey).toLowerCase().replace(/[^a-z0-9_]/g, ''),
      input: FORM_INPUTS[field.kind] || 'text',
    }))
}

/** Шкалы опроса (`Constants::Polls::*::RATE_MIN..RATE_MAX`). */
export const POPUP_SURVEY_SCALES = Object.freeze({ nps: [0, 10], csat: [1, 5], ces: [1, 7] })

const aspectRatioOf = (value) => {
  const match = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(popupStr(value).trim())
  if (!match) return null
  const ratio = parseFloat(match[1]) / parseFloat(match[2])
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null
}

function imageHeight(style) {
  const mode = popupStr(style.imageHeightMode) || 'auto'
  if (mode === 'auto') return 'auto'
  const clamp = (n) => Math.max(1, Math.min(100, n))
  if (mode === '%') return { percent: clamp(popupNum(style.imageHeight, 100)) }
  if (mode === 'vh') return { vh: clamp(popupNum(style.imageHeight, 40)) }
  return { px: Math.max(0, popupNum(style.imageHeight, 120)) }
}

/**
 * Реестр элементов mobile: `type → { stretch, linkable, normalize }`. Новый тип (countdown, wheel…)
 * добавляется одной записью здесь и одним рендерером в реестре компонентов.
 */
export const POPUP_ELEMENT_TYPES = {
  text: { stretch: false, linkable: true, normalize: (style) => textElement(style) },
  box: { stretch: false, linkable: true, normalize: (style) => textElement(style) },
  button: {
    stretch: false,
    linkable: false,
    normalize: (style, { texts }) => {
      const action = popupEnum(style.buttonAction, ['link', 'close', 'copy'], 'link')
      return {
        box: { ...boxOf(style), bgColor: '#00000000', borderWidth: 0 },
        props: {
          action,
          text: popupStr(style.buttonText) || texts.detail,
          href: action === 'link' ? popupSafeLink(isBlank(style.linkHref) ? style.buttonHref : style.linkHref) : null,
          copyText: action === 'copy' ? popupStr(style.copyText) || popupStr(style.buttonText) : null,
          align: popupEnum(style.buttonAlign, ALIGNS, 'left'),
          button: buttonStyle(style, { bg: '#2563eb', color: '#ffffff', fontSize: 12, paddingX: 0, paddingY: 0, radius: 0 }),
        },
      }
    },
  },
  close: {
    stretch: false,
    linkable: false,
    normalize: (style, { texts }) => {
      let mode = popupEnum(style.closeIconMode, ['text', 'image', 'svg'], 'text')
      const imageUrl = mode === 'image' ? popupSafeImageUrl(style.imageUrl) : null
      if (mode === 'image' && !imageUrl) mode = 'text'
      if (mode === 'svg' && !/^<svg[\s>]/i.test(popupStr(style.closeSvg).trim())) mode = 'text'
      return {
        box: { ...boxOf(style), bgColor: '#00000000', borderWidth: 0 },
        props: {
          mode,
          text: popupStr(style.buttonText) || '×',
          imageUrl,
          alt: popupStr(style.imageAlt) || texts.close,
          size: Math.max(8, Math.min(128, popupNum(style.closeIconSize, popupNum(style.buttonFontSize, 22)))),
          align: popupEnum(style.buttonAlign, ALIGNS, 'right'),
          button: buttonStyle(style, { bg: 'transparent', color: '#71717a', fontSize: 22, paddingX: 8, paddingY: 2, radius: 999 }),
        },
      }
    },
  },
  image: {
    stretch: true,
    linkable: true,
    normalize: (style, { texts }) => {
      const url = popupSafeImageUrl(style.imageUrl)
      return {
        visible: popupBool(style.showImage) !== false && !!url,
        box: boxOf(style),
        props: {
          url,
          alt: popupStr(style.imageAlt) || texts.image,
          height: imageHeight(style),
          fit: popupEnum(style.imageObjectFit, ['cover', 'contain', 'fill', 'none'], 'cover'),
          aspectRatio: aspectRatioOf(style.imageAspectRatio),
          radius: Math.max(0, popupNum(style.imageRadius, 0)),
          marginBottom: Math.max(0, popupNum(style.imageMarginBottom, 0)),
        },
      }
    },
  },
  emailCollector: {
    stretch: true,
    linkable: false,
    normalize: (style, { texts }) => ({
      box: formBox(style),
      props: {
        layout: style.emailLayout === 'inline' ? 'inline' : 'stacked',
        placeholder: popupStr(style.emailPlaceholder) || texts.email,
        submitText: popupStr(style.emailSubmitText) || texts.subscribe,
        consentLabel: emailConsentLabel(style, texts),
        consentFields: emailConsentFields(style),
        segmentId: popupStr(style.emailSegmentId).trim(),
        errorMessage: popupStr(style.emailErrorMessage) || texts.emailError,
        successTitle: popupStr(style.emailSuccessTitle),
        successMessage: popupStr(style.emailSuccessMessage),
        success: {
          bgColor: popupColorOr(style.emailSuccessBg, '#ecfdf5'),
          textColor: popupColorOr(style.emailSuccessColor, '#065f46'),
          align: popupEnum(style.emailSuccessAlign, ['left', 'right'], 'center'),
          radius: Math.max(0, popupNum(style.emailSuccessRadius, 12)),
          paddingX: Math.max(0, popupNum(style.emailSuccessPaddingX, 14)),
          paddingY: Math.max(0, popupNum(style.emailSuccessPaddingY, 16)),
          titleColor: popupColorOr(style.emailSuccessTitleColor, '#047857'),
          titleFontSize: popupNum(style.emailSuccessTitleFontSize, 16),
          fontSize: popupNum(style.emailSuccessFontSize, 13),
        },
        input: inputStyle(style, 'email'),
        button: buttonStyle(style, FORM_BUTTON),
      },
    }),
  },
  form: {
    stretch: true,
    linkable: false,
    normalize: (style, { texts }) => ({
      box: formBox(style),
      props: {
        fields: popupFormFields(style.formFields),
        consentLabel: popupStr(style.formConsentLabel),
        consentFields: (Array.isArray(style.formConsentFields) ? style.formConsentFields : [])
          .map(popupStr)
          .filter((field, index, list) => POPUP_CONSENT_FIELDS.indexOf(field) !== -1 && list.indexOf(field) === index),
        segmentId: popupStr(style.formSegmentId).trim(),
        submitText: popupStr(style.formSubmitText) || texts.send,
        errorMessage: popupStr(style.formErrorMessage) || texts.formError,
        successTitle: popupStr(style.formSuccessTitle),
        successMessage: popupStr(style.formSuccessMessage),
        input: inputStyle(style, 'form'),
        button: buttonStyle(style, FORM_BUTTON),
      },
    }),
  },
  promoCode: {
    stretch: true,
    linkable: false,
    normalize: (style, { texts }) => {
      const isStatic = style.promoSource === 'static'
      return {
        box: boxOf(style),
        props: {
          source: isStatic ? 'static' : 'personal',
          code: isStatic ? popupStr(style.promoStaticCode).trim() : '{{promo_code}}',
          label: popupStr(style.promoLabel),
          showCopy: popupBool(style.promoShowCopy) !== false,
          copyText: popupStr(style.promoCopyText) || texts.copy,
          copiedText: popupStr(style.promoCopiedText) || texts.copied,
          applyHref: popupSafeLink(style.promoApplyHref),
          align: popupEnum(style.messageAlign, ALIGNS, 'center'),
          codeBg: popupColorOr(style.promoCodeBg, '#fef3c7'),
          codeColor: popupColorOr(style.promoCodeColor, '#92400e'),
          codeRadius: Math.max(0, popupNum(style.promoCodeRadius, 10)),
          codeFontSize: popupNum(style.promoCodeFontSize, 20),
        },
      }
    },
  },
  survey: {
    stretch: true,
    linkable: false,
    normalize: (style, { texts }) => {
      const type = Object.prototype.hasOwnProperty.call(POPUP_SURVEY_SCALES, style.surveyType) ? style.surveyType : 'nps'
      return {
        box: boxOf(style),
        props: {
          type,
          scale: POPUP_SURVEY_SCALES[type].slice(),
          campaignId: popupStr(style.surveyCampaignId),
          campaignCode: popupStr(style.surveyCampaignCode),
          question: popupStr(style.surveyQuestion),
          minLabel: popupStr(style.surveyMinLabel),
          maxLabel: popupStr(style.surveyMaxLabel),
          commentPlaceholder: popupStr(style.surveyCommentPlaceholder),
          submitText: popupStr(style.surveySubmitText) || texts.send,
          thanksText: popupStr(style.surveyThanksText) || texts.thanks,
          scaleBg: popupColorOr(style.surveyScaleBg, '#f3f4f6'),
          scaleColor: popupColorOr(style.surveyScaleColor, '#111827'),
          activeBg: popupColorOr(style.surveyScaleActiveBg, '#2563eb'),
          activeColor: popupColorOr(style.surveyScaleActiveColor, '#ffffff'),
          button: buttonStyle(style, FORM_BUTTON),
        },
      }
    },
  },
  recommendation: {
    stretch: true,
    linkable: false,
    normalize: (style) => {
      const code = popupStr(style.recommenderCode).trim()
      return {
        visible: code.length > 0,
        box: { ...boxOf(style), bgColor: '#00000000', borderWidth: 0, paddingX: 0, paddingY: 0, shadow: null },
        props: { code, minHeight: 40 },
      }
    },
  },
}

/**
 * Элемент дизайна → модель `{ id, type, visible, stretch, selfAlign, verticalSelf, link, box,
 * props }` или `null` (неизвестный тип: пропускается, `onSkip` с причиной).
 */
export function normalizePopupElement(raw, context) {
  const type = raw && typeof raw.type === 'string' ? raw.type : ''
  const spec = Object.prototype.hasOwnProperty.call(POPUP_ELEMENT_TYPES, type) ? POPUP_ELEMENT_TYPES[type] : null
  const id = raw && raw.id !== undefined && raw.id !== null ? String(raw.id) : ''
  if (!spec) {
    context.onSkip({ id, reason: type ? `unknown element type ${type}` : 'element without type' })
    return null
  }
  const own = raw.style && typeof raw.style === 'object' && !Array.isArray(raw.style) ? raw.style : {}
  const substituted = popupMapStrings(own, (text) => popupApplyStaticVariables(text, context.variables, context.os))
  const style = withDefaults(type, substituted)
  const normalized = spec.normalize(style, context)
  const cellAlign = popupEnum(style.cellAlign, ALIGNS, null)
  return {
    id,
    type,
    visible: normalized.visible !== false,
    stretch: spec.stretch,
    // Кнопки без cellAlign выравнивает buttonAlign (крестик по умолчанию — справа).
    selfAlign: cellAlign || (type === 'button' || type === 'close' ? normalized.props.align : null),
    verticalSelf: popupEnum(style.cellVerticalAlign, VERTICAL_ALIGNS, null),
    link: spec.linkable ? popupSafeLink(style.linkHref) : null,
    box: normalized.box,
    props: normalized.props,
  }
}

function rowFractions(row) {
  let columns = Array.isArray(row.columns) ? row.columns.map((value) => popupNum(value, 0)).filter((value) => value > 0) : []
  if (!columns.length) {
    const parts = Math.max(1, Math.floor(popupNum(row.parts, 1)))
    columns = new Array(parts).fill(1)
  }
  columns = columns.slice(0, POPUP_LIMITS.columns)
  const sum = columns.reduce((total, value) => total + value, 0) || 1
  return columns.map((value) => value / sum)
}

/**
 * Документ design → модель рендера:
 * `{ frame, rows, free, empty, variables, skipped }`. `rows` — строки с долями колонок, ячейками и
 * элементами; `free` — элементы старого дизайна без строк (по `y`, затем по `x`), иначе `null`.
 * Выпавшие элементы (нет строки, номер колонки вне строки, неизвестный тип) — в `skipped`.
 *
 * @param {object} design
 * @param {{ os?: string, texts?: object, onSkip?: (entry: { id: string, reason: string }) => void }} [options]
 */
export function normalizePopupDesign(design, options = {}) {
  const doc = design && typeof design === 'object' && !Array.isArray(design) ? design : {}
  const skipped = []
  const context = {
    os: options.os,
    texts: options.texts || popupTexts(),
    variables: popupStaticVariables(doc.variables),
    onSkip: (entry) => {
      skipped.push(entry)
      if (options.onSkip) options.onSkip(entry)
    },
  }
  const rawRows = (Array.isArray(doc.rows) ? doc.rows : []).filter((row) => row && typeof row === 'object' && !Array.isArray(row))
  if (rawRows.length > POPUP_LIMITS.rows) context.onSkip({ id: '', reason: `${rawRows.length - POPUP_LIMITS.rows} row(s) over the limit` })
  const rawElements = (Array.isArray(doc.elements) ? doc.elements : []).filter(
    (element) => element && typeof element === 'object' && !Array.isArray(element),
  )
  if (rawElements.length > POPUP_LIMITS.elements) {
    context.onSkip({ id: '', reason: `${rawElements.length - POPUP_LIMITS.elements} element(s) over the limit` })
  }
  const elements = rawElements.slice(0, POPUP_LIMITS.elements)
  const frame = doc.frameStyle && typeof doc.frameStyle === 'object' && !Array.isArray(doc.frameStyle) ? doc.frameStyle : {}

  if (!rawRows.length) {
    const free = elements
      .map((element, index) => ({ element, index, x: popupNum(element.x, 0), y: popupNum(element.y, 0) }))
      .sort((a, b) => a.y - b.y || a.x - b.x || a.index - b.index)
      .map(({ element }) => normalizePopupElement(element, context))
      .filter(Boolean)
    return { frame, rows: [], free: free.length ? free : null, empty: free.length === 0, variables: context.variables, skipped }
  }

  const byCell = new Map()
  elements.forEach((element) => {
    const key = `${popupStr(element.rowId)}:${Math.trunc(popupNum(element.partIndex, 0))}`
    if (!byCell.has(key)) byCell.set(key, [])
    byCell.get(key).push(element)
  })
  const placed = new Set()
  const rows = rawRows.slice(0, POPUP_LIMITS.rows).map((row) => {
    const id = popupStr(row.id)
    const fractions = rowFractions(row)
    const cellsRaw = Array.isArray(row.cells) ? row.cells : []
    const rowAlign = popupEnum(row.align, ALIGNS, 'left')
    const rowVertical = popupEnum(row.verticalAlign, VERTICAL_ALIGNS, 'top')
    const cells = fractions.map((fraction, index) => {
      const cell = cellsRaw[index] && typeof cellsRaw[index] === 'object' ? cellsRaw[index] : {}
      const raw = byCell.get(`${id}:${index}`) || []
      raw.forEach((element) => placed.add(element))
      const overridden = raw.some((element) => element.style && VERTICAL_ALIGNS.indexOf(element.style.cellVerticalAlign) !== -1)
      return {
        fraction,
        align: popupEnum(cell.align, ALIGNS, rowAlign),
        verticalAlign: overridden ? 'top' : popupEnum(cell.verticalAlign, VERTICAL_ALIGNS, rowVertical),
        elements: raw.map((element) => normalizePopupElement(element, context)).filter(Boolean),
      }
    })
    const image = popupSafeImageUrl(row.bgImageUrl)
    return {
      id,
      gap: Math.max(0, popupNum(row.gap, 8)),
      minHeight: Math.max(0, popupNum(row.minHeight, 110)),
      bgColor: isBlank(row.bgColor) ? null : popupColor(row.bgColor),
      bgImage: image
        ? {
            url: image,
            size: popupEnum(row.bgSize, ['cover', 'contain', 'auto'], 'cover'),
            position: popupEnum(row.bgPosition, ['center', 'top', 'bottom', 'left', 'right'], 'center'),
            repeat: popupEnum(row.bgRepeat, ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'], 'no-repeat'),
          }
        : null,
      cells,
    }
  })
  elements.forEach((element) => {
    if (!placed.has(element)) {
      context.onSkip({ id: element.id === undefined ? '' : String(element.id), reason: `no cell ${popupStr(element.rowId)}:${popupStr(element.partIndex)}` })
    }
  })
  const empty = rows.every((row) => row.cells.every((cell) => cell.elements.length === 0))
  return { frame, rows, free: null, empty, variables: context.variables, skipped }
}

// ---------------------------------------------------------------- рамка

const FRAME_DEFAULTS = Object.freeze({
  width: 92,
  widthMode: '%',
  heightMode: 'auto',
  maxWidth: 480,
  maxWidthMode: 'px',
  minHeightMode: 'px',
  bgColor: '#ffffff',
  borderColor: '#e5e7eb',
  borderWidth: 1,
  borderRadius: 16,
  padding: 20,
})

const BREAKPOINT_KEYS = ['width', 'widthMode', 'height', 'heightMode', 'maxWidth', 'maxWidthMode', 'minHeight', 'minHeightMode', 'padding', 'borderRadius']

/**
 * Поля рамки после breakpoints: применяются все подходящие (`screenWidth ≤ mediaMaxWidth`) от
 * широкого к узкому, так что узкий побеждает.
 */
export function popupFrameStyle(frame, screenWidth) {
  const out = { ...frame }
  const breakpoints = (Array.isArray(frame.breakpoints) ? frame.breakpoints : [])
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({ item, max: popupNum(item.mediaMaxWidth, NaN) }))
    .filter(({ max }) => Number.isFinite(max) && screenWidth <= max)
    .sort((a, b) => b.max - a.max)
  breakpoints.forEach(({ item }) => {
    BREAKPOINT_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(item, key) && !(isBlank(item[key]) && key !== 'maxWidth')) out[key] = item[key]
    })
  })
  return out
}

const sizeOf = (value, mode, base, fallback) => {
  const n = popupNum(value, fallback)
  return mode === '%' || mode === 'vw' || mode === 'vh' ? (base * n) / 100 : n
}

/**
 * Геометрия рамки на экране `screenWidth × screenHeight` (логические px): ширина, высота (`null` —
 * по содержимому), минимальная и максимальная высота, оформление, затемнение и отступы баннера.
 * `areaHeight` — высота, доступная попапу (экран минус безопасные зоны и клавиатура); рамка не
 * выше неё минус поля макета (модалка — по 16 сверху и снизу, баннер — `offsetY` и 16 с другой
 * стороны, фуллскрин — вся).
 *
 * @param {object} frameStyle `design.frameStyle`
 * @param {{ layout: string, screenWidth: number, screenHeight: number, areaHeight?: number }} screen
 */
export function popupFrameLayout(frameStyle, { layout, screenWidth, screenHeight, areaHeight }) {
  const raw = popupFrameStyle(frameStyle && typeof frameStyle === 'object' ? frameStyle : {}, screenWidth)
  const value = (key) => (isBlank(raw[key]) ? FRAME_DEFAULTS[key] : raw[key])
  const banner = layout === 'banner'
  const fullscreen = layout === 'fullscreen'
  const offsetX = banner ? Math.max(0, popupNum(raw.offsetX, 0)) : 0
  const offsetY = banner ? Math.max(0, popupNum(raw.offsetY, 0)) : 0
  const area = Number.isFinite(areaHeight) ? areaHeight : screenHeight
  const maxHeight = Math.max(0, fullscreen ? area : banner ? area - offsetY - 16 : area - 32)

  const widthMode = popupEnum(value('widthMode'), ['px', '%', 'vw'], '%')
  let width = sizeOf(value('width'), widthMode, screenWidth, FRAME_DEFAULTS.width)
  const maxWidthMode = popupEnum(value('maxWidthMode'), ['none', 'px', '%', 'vw'], 'px')
  if (maxWidthMode !== 'none') width = Math.min(width, sizeOf(value('maxWidth'), maxWidthMode, screenWidth, FRAME_DEFAULTS.maxWidth))
  width = Math.max(0, Math.min(width, screenWidth - 2 * offsetX))

  const heightMode = popupEnum(value('heightMode'), ['auto', 'px', '%', 'vh'], 'auto')
  const height = heightMode === 'auto' ? null : Math.min(Math.max(0, sizeOf(raw.height, heightMode, screenHeight, 320)), maxHeight)
  const minHeightMode = popupEnum(value('minHeightMode'), ['px', '%', 'vh'], 'px')
  const minHeight = Math.min(Math.max(0, sizeOf(raw.minHeight, minHeightMode, screenHeight, 0)), maxHeight)

  const overlayEnabled = fullscreen ? false : popupBool(raw.overlayEnabled) ?? layout === 'modal'
  const overlayColor = overlayEnabled
    ? popupColorWithOpacity(popupColor(raw.overlayColor) || '#000000ff', Math.max(0, Math.min(1, popupNum(raw.overlayOpacity, 0.5))))
    : null

  return {
    layout,
    width: fullscreen ? screenWidth : width,
    height: fullscreen ? null : height,
    minHeight: fullscreen ? 0 : minHeight,
    maxHeight,
    padding: Math.max(0, popupNum(value('padding'), FRAME_DEFAULTS.padding)),
    borderRadius: fullscreen ? 0 : Math.max(0, popupNum(value('borderRadius'), FRAME_DEFAULTS.borderRadius)),
    borderWidth: fullscreen ? 0 : Math.max(0, popupNum(value('borderWidth'), FRAME_DEFAULTS.borderWidth)),
    borderColor: popupColorOr(value('borderColor'), FRAME_DEFAULTS.borderColor),
    bgColor: popupColorOr(value('bgColor'), FRAME_DEFAULTS.bgColor),
    overlayColor,
    // Модалка и фуллскрин закрывают приложение всегда; баннер — с затемнением или блокировкой фона.
    blocksBackground: !banner || overlayEnabled || popupBool(raw.lockBackgroundScroll) === true,
    offsetX,
    offsetY,
  }
}

/** Высота картинки на экране высотой `screenHeight`: число или `null` (по содержимому / соотношению). */
export function popupImageHeight(height, screenHeight) {
  if (!height || height === 'auto') return null
  if (height.px !== undefined) return height.px
  if (height.percent !== undefined) return (screenHeight * height.percent) / 100
  if (height.vh !== undefined) return (screenHeight * height.vh) / 100
  return null
}
