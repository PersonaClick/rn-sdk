/**
 * Цвета дизайн-системы.
 *
 * Figma Mobile SDK UI Kit (SSwS49L1fG1psWA7xbakV6), коллекция переменных Color,
 * режимы Light и Dark. Сверено 2026-09-23.
 *
 * Два набора под схемы. Выбирать по useColorScheme() из react-native:
 *   const colors = PERSONALIZATION_COLORS[useColorScheme() ?? 'light']
 */

const light = {
  // brand
  brandPrimary: '#007DF2',
  // neutral: полупрозрачная ступень, одинаково заметна на любом фоне — заглушки картинок
  neutral50: 'rgba(0, 0, 0, 0.05)',
  // semantic
  semanticWarning: '#F37A17',
  semanticDanger: '#E51919',
  // background
  backgroundGeneric: '#F2F2F2',
  backgroundCard: '#FFFFFF',
  // Поверхности поверх карточки. В светлой все три белые, различаются только
  // в тёмной: Card #1A1A1A, Float #262626, Modal #333333.
  backgroundFloat: '#FFFFFF',
  backgroundModal: '#FFFFFF',
  backgroundInput: '#F2F2F2',
  backgroundTransparent: 'rgba(255, 255, 255, 0)',
  backgroundInputDisabled: 'rgba(0, 0, 0, 0.05)',
  // button
  buttonPrimary: '#007DF2',
  buttonPrimaryFocus: '#004BC0',
  buttonSecondary: 'rgba(0, 0, 0, 0.05)',
  // Secondary поверх тёмного (картинки-фона): белая 5%, как в тёмном режиме файла.
  buttonSecondaryOnDark: 'rgba(255, 255, 255, 0.05)',
  buttonSecondaryFocus: 'rgba(0, 0, 0, 0.1)',
  // Brand/Primary с прозрачностью 65%.
  buttonPrimaryDisabled: 'rgba(0, 125, 242, 0.65)',
  buttonSecondaryDisabled: 'rgba(0, 0, 0, 0.05)',
  buttonGhost: 'rgba(255, 255, 255, 0)',
  // line
  lineBrand: '#007DF2',
  lineGeneric: 'rgba(0, 0, 0, 0.2)',
  lineGenericSubtle: 'rgba(0, 0, 0, 0.05)',
  lineInput: 'rgba(0, 0, 0, 0.2)',
  lineInputFocus: '#007DF2',
  // text
  textPrimary: '#000000',
  textSecondary: 'rgba(0, 0, 0, 0.7)',
  textHint: 'rgba(0, 0, 0, 0.4)',
  textDarkPrimary: '#000000',
  textDarkSecondary: 'rgba(0, 0, 0, 0.7)',
  textDarkHint: 'rgba(0, 0, 0, 0.4)',
  textLightPrimary: '#FFFFFF',
  textLightSecondary: 'rgba(255, 255, 255, 0.8)',
  textLightHint: 'rgba(255, 255, 255, 0.5)',
  textInvertedPrimary: '#FFFFFF',
  textInvertedSecondary: 'rgba(255, 255, 255, 0.8)',
  textInvertedHint: 'rgba(255, 255, 255, 0.5)',
  textBrand: '#007DF2',
  textLink: '#007DF2',
  textLinkVisited: '#4D00F2',
  // shadow: цвет тени вместе с прозрачностью
  shadowHeavy: 'rgba(0, 0, 0, 0.08)',
}

const dark = {
  // brand
  brandPrimary: '#007DF2',
  // neutral: полупрозрачная ступень, одинаково заметна на любом фоне — заглушки картинок
  neutral50: 'rgba(255, 255, 255, 0.05)',
  // semantic
  semanticWarning: '#F37A17',
  semanticDanger: '#E51919',
  // background
  backgroundGeneric: '#0D0D0D',
  backgroundCard: '#1A1A1A',
  backgroundFloat: '#262626',
  backgroundModal: '#333333',
  backgroundInput: '#0D0D0D',
  backgroundTransparent: 'rgba(255, 255, 255, 0)',
  backgroundInputDisabled: 'rgba(255, 255, 255, 0.05)',
  // button
  buttonPrimary: '#007DF2',
  buttonPrimaryFocus: '#32AFFF',
  buttonSecondary: 'rgba(255, 255, 255, 0.05)',
  buttonSecondaryOnDark: 'rgba(255, 255, 255, 0.05)',
  buttonSecondaryFocus: 'rgba(255, 255, 255, 0.1)',
  // Brand/Primary с прозрачностью 65%.
  buttonPrimaryDisabled: 'rgba(0, 125, 242, 0.65)',
  buttonSecondaryDisabled: 'rgba(255, 255, 255, 0.05)',
  buttonGhost: 'rgba(255, 255, 255, 0)',
  // line
  lineBrand: '#007DF2',
  lineGeneric: 'rgba(255, 255, 255, 0.2)',
  lineGenericSubtle: 'rgba(255, 255, 255, 0.05)',
  lineInput: 'rgba(255, 255, 255, 0.2)',
  lineInputFocus: '#007DF2',
  // text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.8)',
  textHint: 'rgba(255, 255, 255, 0.5)',
  textDarkPrimary: '#000000',
  textDarkSecondary: 'rgba(0, 0, 0, 0.7)',
  textDarkHint: 'rgba(0, 0, 0, 0.4)',
  textLightPrimary: '#FFFFFF',
  textLightSecondary: 'rgba(255, 255, 255, 0.8)',
  textLightHint: 'rgba(255, 255, 255, 0.5)',
  textInvertedPrimary: '#000000',
  textInvertedSecondary: 'rgba(0, 0, 0, 0.7)',
  textInvertedHint: 'rgba(0, 0, 0, 0.4)',
  textBrand: '#007DF2',
  textLink: '#007DF2',
  textLinkVisited: '#4D00F2',
  // shadow: цвет тени вместе с прозрачностью
  shadowHeavy: 'rgba(0, 0, 0, 0.5)',
}

export const PERSONALIZATION_COLORS = { light, dark }
