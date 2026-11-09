/**
 * Тексты попапов v3 по умолчанию — когда поле в дизайне пустое (у web их подставляет компилятор из
 * `popups.compiler.*`). Русские и английские, по языку устройства.
 */

export const POPUP_TEXTS = Object.freeze({
  ru: Object.freeze({
    close: 'Закрыть',
    detail: 'Подробнее',
    image: 'Изображение',
    email: 'Email',
    subscribe: 'Подписаться',
    emailConsent: 'Я согласен(на) получать рассылку',
    emailError: 'Введите корректный email и отметьте согласие',
    formError: 'Заполните обязательные поля',
    send: 'Отправить',
    copy: 'Скопировать',
    copied: 'Скопировано',
    thanks: 'Спасибо!',
    genderMale: 'Мужской',
    genderFemale: 'Женский',
    birthdayPlaceholder: 'ДД.ММ.ГГГГ',
    sendError: 'Не удалось отправить. Попробуйте ещё раз',
  }),
  en: Object.freeze({
    close: 'Close',
    detail: 'Learn more',
    image: 'Image',
    email: 'Email',
    subscribe: 'Subscribe',
    emailConsent: 'I agree to receive emails',
    emailError: 'Enter a valid email and accept the terms',
    formError: 'Fill in the required fields',
    send: 'Send',
    copy: 'Copy',
    copied: 'Copied',
    thanks: 'Thank you!',
    genderMale: 'Male',
    genderFemale: 'Female',
    birthdayPlaceholder: 'DD.MM.YYYY',
    sendError: 'Could not send. Please try again',
  }),
})

/** Язык устройства: `ru` для русской локали, иначе `en`. */
export function popupLanguage() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || ''
    return /^ru\b/i.test(locale) ? 'ru' : 'en'
  } catch (error) {
    return 'en'
  }
}

/** Тексты по языку (`ru` / `en`; другой — английские). */
export const popupTexts = (language = popupLanguage()) => POPUP_TEXTS[language] || POPUP_TEXTS.en
