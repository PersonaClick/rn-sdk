/**
 * Радиусы скругления дизайн-системы.
 *
 * Figma Mobile SDK UI Kit (SSwS49L1fG1psWA7xbakV6), коллекция переменных Radius.
 *
 * `rounded` — pill: значение заведомо больше любой стороны.
 */

export const PERSONALIZATION_RADIUS = {
  xs: 2, // XS
  sm: 4, // SM
  md: 6, // MD
  lg: 8, // LG
  xl: 10, // XL
  xl2: 12, // 2XL
  xl3: 14, // 3XL
  xl4: 16, // 4XL
  xl5: 20, // 5XL
  xl6: 24, // 6XL
  xl7: 32, // 7XL
  rounded: 999, // Rounded

  // Семантические радиусы из коллекции Radius. К Button LG/MD/SM привязаны Button,
  // Input, Badge, Tag, к Segmented Button — Button Group, к Modal — попап.
  // Дизайнер меняет их отдельно от шкалы, поэтому и здесь они отдельно.
  buttonLg: 12,
  buttonMd: 10,
  buttonSm: 8,
  segmentedLg: 10,
  segmentedMd: 8,
  segmentedSm: 6,
  card: 16,
  toast: 999,
  modal: 24,
}
