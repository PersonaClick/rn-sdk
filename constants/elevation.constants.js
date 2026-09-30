/**
 * Высоты дизайн-системы.
 *
 * Figma Mobile SDK UI Kit (SSwS49L1fG1psWA7xbakV6), стили Elevation 1–3.
 *
 * У каждой ступени свой набор под платформу: `android` — системный elevation,
 * `ios` — верхний слой тени (RN отдаёт один shadow на View).
 * `layers` хранит обе тени из макета для случаев, когда нужна точность.
 *
 * Прозрачность 0.08 — светлое значение токена Shadow/Heavy. В тёмной схеме он
 * 0.5 (`shadowHeavy` в PERSONALIZATION_COLORS.dark): тень, которая должна
 * следовать схеме, берёт цвет оттуда вместо shadowColor/shadowOpacity отсюда.
 */

export const PERSONALIZATION_ELEVATION = {
  none: { // None
    android: { elevation: 0 },
    ios: { shadowOpacity: 0 },
    layers: [],
  },
  e1: { // Elevation 1
    android: { elevation: 2 },
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 2,
      shadowOpacity: 0.08,
    },
    layers: [{ offsetY: 2, blur: 4, opacity: 0.08 }, { offsetY: 1, blur: 2, opacity: 0.08 }],
  },
  e2: { // Elevation 2
    android: { elevation: 10 },
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 5,
      shadowOpacity: 0.08,
    },
    layers: [{ offsetY: 10, blur: 10, opacity: 0.08 }, { offsetY: 3, blur: 6, opacity: 0.08 }],
  },
  e3: { // Elevation 3
    android: { elevation: 23 },
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 23 },
      shadowRadius: 11.5,
      shadowOpacity: 0.08,
    },
    layers: [{ offsetY: 23, blur: 23, opacity: 0.08 }, { offsetY: 6, blur: 13, opacity: 0.08 }],
  },
}
