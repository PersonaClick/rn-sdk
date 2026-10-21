// Типы для '@personaClick/react-native-sdk/internal/ui'. Почему кит живёт здесь — см. ./ui.js.
import type { ComponentType, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react'

/** One step of the type scale, ready to spread into a RN style. */
export interface PersonalizationTextStyle {
  fontSize: number
  lineHeight: number
  fontWeight: '400' | '600'
  letterSpacing?: number
}

export type PersonalizationTypographyKey =
  'xsDefault' | 'xsEmphasized' | 'smDefault' | 'smEmphasized' | 'baseDefault' | 'baseEmphasized' | 'lgDefault' | 'lgEmphasized' | 'xlDefault' | 'xlEmphasized' | 'xl2Default' | 'xl2Emphasized' | 'xl3Default' | 'xl3Emphasized' | 'xl4Default' | 'xl4Emphasized' | 'xl5Default' | 'xl5Emphasized' | 'xl6Default' | 'xl6Emphasized'

/** @see ./constants/typography.constants */
export const PERSONALIZATION_TYPOGRAPHY: Record<PersonalizationTypographyKey, PersonalizationTextStyle>
export const PERSONALIZATION_FONT_WEIGHT: { regular: '400'; semibold: '600' }

export type PersonalizationSpacingKey =
  | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xl2' | 'xl3' | 'xl4' | 'xl5' | 'xl6' | 'xl7'
  | 'paddingX' | 'paddingY' | 'gapX' | 'gapY'
  | 'paddingModal' | 'gapModal' | 'paddingFullScreen' | 'gapFullScreen'

/** @see ./constants/spacing.constants */
export const PERSONALIZATION_SPACING: Record<PersonalizationSpacingKey, number>

export type PersonalizationRadiusKey =
  | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xl2' | 'xl3' | 'xl4' | 'xl5' | 'xl6' | 'xl7' | 'rounded'
  | 'buttonLg' | 'buttonMd' | 'buttonSm' | 'segmentedLg' | 'segmentedMd' | 'segmentedSm'
  | 'card' | 'toast' | 'modal'

/** @see ./constants/radius.constants */
export const PERSONALIZATION_RADIUS: Record<PersonalizationRadiusKey, number>

export type PersonalizationElevationKey =
  'none' | 'e1' | 'e2' | 'e3'

/** One shadow layer as authored in the design file (CSS blur, not platform blur). */
export interface PersonalizationShadowLayer {
  offsetY: number
  blur: number
  opacity: number
}

export interface PersonalizationElevationStep {
  android: { elevation: number }
  ios: {
    shadowColor?: string
    shadowOffset?: { width: number; height: number }
    shadowRadius?: number
    shadowOpacity: number
  }
  layers: PersonalizationShadowLayer[]
}

/** @see ./constants/elevation.constants */
export const PERSONALIZATION_ELEVATION: Record<PersonalizationElevationKey, PersonalizationElevationStep>

/** Icon name from the design system set. */
export type PersonalizationIconName = string

/**
 * Raw SVG sources, 32x32. React Native cannot render SVG on its own — pass the
 * string to a renderer such as `SvgXml` from react-native-svg.
 * @see ./constants/icons.constants
 */
export const PERSONALIZATION_ICONS: Record<PersonalizationIconName, string>
export const PERSONALIZATION_ICON_NAMES: PersonalizationIconName[]

/** Colour set for one scheme; values are hex or rgba() strings. */
export type PersonalizationColorSet = Record<string, string>

/**
 * Design system colours, one set per scheme.
 * Pick with `useColorScheme()` from react-native.
 * @see ./constants/colors.constants
 */
export const PERSONALIZATION_COLORS: {
  light: PersonalizationColorSet
  dark: PersonalizationColorSet
}

/**
 * Design system components. Pure React Native primitives, no native deps.
 *
 * SVG is not drawn by React Native itself: components that show an icon take the
 * source as a string (from `PERSONALIZATION_ICONS`) plus a render prop, so the
 * consumer picks the renderer (e.g. `SvgXml` from react-native-svg).
 * @see ./components/design-system
 */
export interface PersonalizationBadgeProps {
  label: string
  size?: 'lg' | 'md' | 'sm'
  /** `danger` is the discount badge on a product card. */
  view?: 'warning' | 'danger'
  style?: object
}
export const PersonalizationBadge: ComponentType<PersonalizationBadgeProps>

export interface PersonalizationTagProps {
  label: string
  view?: 'primary' | 'secondary'
  onRemove?: () => void
  renderRemoveIcon?: (svg: string, color: string) => ReactNode
  style?: object
}
export const PersonalizationTag: ComponentType<PersonalizationTagProps>

export type PersonalizationCheckboxState = 'unchecked' | 'checked' | 'indeterminate'

export interface PersonalizationCheckboxProps {
  state?: PersonalizationCheckboxState
  disabled?: boolean
  onChange?: (state: PersonalizationCheckboxState) => void
  style?: object
}
export const PersonalizationCheckbox: ComponentType<PersonalizationCheckboxProps>

export interface PersonalizationCheckboxWithLabelProps extends PersonalizationCheckboxProps {
  label: string
}
export const PersonalizationCheckboxWithLabel: ComponentType<PersonalizationCheckboxWithLabelProps>

export interface PersonalizationLoaderProps {
  size?: number
  duration?: number
  style?: object
}
export const PersonalizationLoader: ComponentType<PersonalizationLoaderProps>

export interface PersonalizationEmptyStateProps {
  message: string
  style?: object
}
export const PersonalizationEmptyState: ComponentType<PersonalizationEmptyStateProps>

export interface PersonalizationButtonProps {
  label?: string
  size?: 'lg' | 'md' | 'sm'
  view?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  onPress?: () => void
  iconStart?: string
  iconEnd?: string
  /** Over a dark image: secondary and ghost take the inverted palette. */
  onDark?: boolean
  /** The `rounded` radius instead of the size's one: an icon-only button becomes a circle. */
  rounded?: boolean
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationButton: ComponentType<PersonalizationButtonProps>

export interface PersonalizationButtonGroupItem {
  icon: string
  /** Icon for the selected segment; falls back to `icon`. */
  activeIcon?: string
}

export interface PersonalizationButtonGroupProps {
  items: PersonalizationButtonGroupItem[]
  selectedIndex?: number
  size?: 'md' | 'sm'
  onSelect?: (index: number) => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationButtonGroup: ComponentType<PersonalizationButtonGroupProps>

export interface PersonalizationInputFieldProps {
  value?: string
  placeholder?: string
  size?: 'lg' | 'md' | 'sm'
  type?: 'search' | 'input' | 'select'
  disabled?: boolean
  onChangeText?: (text: string) => void
  onSubmitEditing?: () => void
  onClear?: () => void
  onSelectPress?: () => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationInputField: ComponentType<PersonalizationInputFieldProps>

export interface PersonalizationTitleProps {
  title: string
  leading?: ReactNode
  trailing?: ReactNode
  style?: object
}
export const PersonalizationTitle: ComponentType<PersonalizationTitleProps>

/** Text link: "Cancel" next to the search field, "Clear" next to a label. */
export interface PersonalizationLinkProps {
  label: string
  onPress?: () => void
  style?: object
}
export const PersonalizationLink: ComponentType<PersonalizationLinkProps>

export interface PersonalizationAccordionProps {
  label: string
  count?: number
  expanded?: boolean
  onToggle?: (expanded: boolean) => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationAccordion: ComponentType<PersonalizationAccordionProps>

export interface PersonalizationListLabelProps {
  label: string
  style?: object
}
export const PersonalizationListLabel: ComponentType<PersonalizationListLabelProps>

export interface PersonalizationDotsProps {
  count: number
  selectedIndex?: number
  style?: object
}
export const PersonalizationDots: ComponentType<PersonalizationDotsProps>

export interface PersonalizationCountProps {
  prefix: string
  shown: number
  separator: string
  total: number
  style?: object
}
export const PersonalizationCount: ComponentType<PersonalizationCountProps>

export interface PersonalizationRatingProps {
  value: string
  reviews: number
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationRating: ComponentType<PersonalizationRatingProps>

export interface PersonalizationSearchResultsTitleProps {
  title: string
  selectedViewIndex?: number
  onBack?: () => void
  onViewChange?: (index: number) => void
  onFilters?: () => void
  onSort?: () => void
  showFiltersButton?: boolean
  showSortButton?: boolean
  results?: { prefix: string; count: number; suffix: string }
  filters?: Array<{ label: string; onRemove: () => void }>
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationSearchResultsTitle: ComponentType<PersonalizationSearchResultsTitleProps>

/**
 * Design system theme. Overrides are partial — anything left out keeps the value
 * from the design file. Colours are per scheme: a light-only override changes
 * nothing in dark.
 * @see ./theme/personalization-theme
 */
export interface PersonalizationThemeOverride {
  colors?: {
    light?: PersonalizationColorSet
    dark?: PersonalizationColorSet
  }
  radius?: Partial<Record<PersonalizationRadiusKey, number>>
  fontFamily?: { regular?: string; emphasized?: string }
}

export interface PersonalizationResolvedTheme {
  /** Already resolved for the current scheme, not a light/dark pair. */
  colors: PersonalizationColorSet
  radius: Record<PersonalizationRadiusKey, number>
  typography: Record<PersonalizationTypographyKey, PersonalizationTextStyle>
  fontFamily: { regular?: string; emphasized?: string }
}

export const PersonalizationThemeProvider: ComponentType<{
  theme?: PersonalizationThemeOverride
  children?: ReactNode
}>

/**
 * Forces a colour scheme on a subtree: the kit inside takes the `scheme` set instead of the
 * system one. `null` (or no provider) follows the system, as before. Theme overrides still apply
 * for the forced scheme.
 */
export const PersonalizationColorSchemeProvider: ComponentType<{
  scheme?: 'light' | 'dark' | null
  children?: ReactNode
}>

export function usePersonalizationTheme(): PersonalizationResolvedTheme

export interface PersonalizationProductImageProps {
  source?: object
  aspect?: 'square' | 'landscape' | 'portrait'
  style?: object
}
export const PersonalizationProductImage: ComponentType<PersonalizationProductImageProps>

export interface PersonalizationFavoritesBadgeProps {
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationFavoritesBadge: ComponentType<PersonalizationFavoritesBadgeProps>

export interface PersonalizationProductCardProps {
  type?: 'carousel' | 'grid' | 'list'
  source?: object
  /** Aspect of the image; the card grows with it. */
  imageAspect?: 'square' | 'landscape' | 'portrait'
  brand?: string
  name: string
  rating?: { value: string; reviews: number }
  price: string
  oldPrice?: string
  /** e.g. "-15%" — rendered as a danger badge. */
  discount?: string
  actionText?: string
  onAction?: () => void
  /** Нажатие на карточку целиком (не на кнопку) — открыть товар. */
  onPress?: () => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationProductCard: ComponentType<PersonalizationProductCardProps>

/** Product data for the catalogue layouts. Strings come pre-formatted. */
export interface PersonalizationProduct {
  id: string
  name: string
  price: string
  source?: object
  brand?: string
  rating?: { value: string; reviews: number }
  oldPrice?: string
  discount?: string
  actionText?: string
}

export interface PersonalizationProductsListProps {
  layout?: 'carousel' | 'grid' | 'list'
  products: PersonalizationProduct[]
  imageAspect?: 'square' | 'landscape' | 'portrait'
  onProductAction?: (product: PersonalizationProduct) => void
  onProductPress?: (product: PersonalizationProduct) => void
  onFirstVisibleChanged?: (index: number) => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  /** Поля вокруг ленты; прокручиваются вместе с ней. */
  contentContainerStyle?: object
  style?: object
}
export const PersonalizationProductsList: ComponentType<PersonalizationProductsListProps>

export interface PersonalizationRecommenderBlockProps {
  layout?: 'carousel' | 'grid' | 'list'
  title: string
  showAllText?: string
  onShowAll?: () => void
  showDots?: boolean
  products: PersonalizationProduct[]
  imageAspect?: 'square' | 'landscape' | 'portrait'
  onProductAction?: (product: PersonalizationProduct) => void
  onProductPress?: (product: PersonalizationProduct) => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationRecommenderBlock: ComponentType<PersonalizationRecommenderBlockProps>

export interface PersonalizationSuggestion {
  id: string
  title: string
  /** Price for a product, parent category for a category. */
  subtitle?: string
  source?: object
}

export interface PersonalizationSuggestionRowProps {
  kind?: 'product' | 'category'
  title: string
  subtitle?: string
  source?: object
  highlight?: string
  onPress?: () => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationSuggestionRow: ComponentType<PersonalizationSuggestionRowProps>

/** Instant search screen: field with Cancel, recent searches, suggestions, categories, products. */
export interface PersonalizationInstantSearchProps {
  query?: string
  placeholder?: string
  cancelText?: string
  onCancel?: () => void
  onQueryChange?: (text: string) => void
  onSubmit?: (text: string) => void
  recentLabel?: string
  clearText?: string
  onClearRecent?: () => void
  recentSearches?: string[]
  /** The primary tag closing the recent searches row. */
  moreText?: string
  onMoreRecent?: () => void
  onRecentPress?: (item: string) => void
  onRecentRemove?: (item: string) => void
  suggestions?: string[]
  onSuggestionPress?: (item: string) => void
  categoriesLabel?: string
  categories?: PersonalizationSuggestion[]
  onCategoryPress?: (item: PersonalizationSuggestion) => void
  productsLabel?: string
  products?: PersonalizationSuggestion[]
  onProductPress?: (item: PersonalizationSuggestion) => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationInstantSearch: ComponentType<PersonalizationInstantSearchProps>

export interface PersonalizationFilterOption {
  id: string
  label: string
  checked?: boolean
}

export interface PersonalizationFilterRangeSection {
  kind: 'range'
  id: string
  title: string
  fromLabel: string
  toLabel: string
  from?: string
  to?: string
  /** Select fields instead of inputs; the host opens the list. */
  select?: boolean
  /** Hints for the empty fields, e.g. the bounds of the range. */
  fromPlaceholder?: string
  toPlaceholder?: string
}

export interface PersonalizationFilterOptionsSection {
  kind: 'options'
  id: string
  title: string
  options: PersonalizationFilterOption[]
  /** Options beyond this count hide behind the accordion (default 5). */
  collapsedCount?: number
  showMoreText?: string
  showLessText?: string
}

export type PersonalizationFilterSection = PersonalizationFilterRangeSection | PersonalizationFilterOptionsSection

/** Filters screen: title with close, range and checkbox sections, reset / apply. */
export interface PersonalizationFiltersProps {
  title: string
  onClose?: () => void
  sections?: PersonalizationFilterSection[]
  resetText?: string
  applyText?: string
  onReset?: () => void
  onApply?: (sections: PersonalizationFilterSection[]) => void
  onOptionToggle?: (sectionId: string, optionId: string, checked: boolean) => void
  onRangeChange?: (sectionId: string, from: string, to: string) => void
  onRangeSelectPress?: (sectionId: string, isFrom: boolean) => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationFilters: ComponentType<PersonalizationFiltersProps>

/**
 * In-app popup: image, title, text, action and close buttons. The round cross is always
 * there, over the content in the top-right corner. A modal casts the Elevation 3 shadow.
 */
export interface PersonalizationInAppPopupProps {
  view?: 'image' | 'imageBackground' | 'text' | 'icon'
  presentation?: 'modal' | 'fullscreen'
  title?: string
  text?: string
  /** Empty — no action button. */
  actionText?: string
  /** Empty — no text close button, the cross stays. */
  closeText?: string
  source?: object
  icon?: ReactNode
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  onAction?: () => void
  onClose?: () => void
  style?: object
}

export const PersonalizationInAppPopup: ComponentType<PersonalizationInAppPopupProps>

export interface PersonalizationCatalogProps {
  header?: ReactNode
  layout?: 'grid' | 'list'
  products: PersonalizationProduct[]
  imageAspect?: 'square' | 'landscape' | 'portrait'
  onProductAction?: (product: PersonalizationProduct) => void
  onProductPress?: (product: PersonalizationProduct) => void
  /** Текст пустой выдачи; показывается вместо плитки, когда товаров нет. */
  emptyText?: string
  loading?: boolean
  count?: { prefix: string; shown: number; separator: string; total: number }
  loadMoreText?: string
  onLoadMore?: () => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationCatalog: ComponentType<PersonalizationCatalogProps>

/** Плашка тоста: текст в пилюле, Background/Float, Elevation 2. На экран её выводит презентер. */
export interface PersonalizationToastProps {
  text: string
  style?: object
}
export const PersonalizationToast: ComponentType<PersonalizationToastProps>

export type PersonalizationToastPosition = 'top' | 'bottom'

/** Ручка презентера тоста (ref). */
export interface PersonalizationToastHandle {
  /**
   * Показать тост. Тост, который ещё на экране, заменяется, таймер перезапускается.
   * По умолчанию снизу, 2000 мс. Пустой текст — ничего не происходит.
   */
  show(text: string, position?: PersonalizationToastPosition, duration?: number): void
  /** Убрать тост сейчас (растворением). */
  hide(): void
}

/**
 * Показывает тост поверх экрана: кладётся последним ребёнком в корень экрана или модалки и
 * растягивается на него. Касаний не перехватывает.
 */
export interface PersonalizationToastPresenterProps {
  /**
   * Свои отступы безопасной зоны (например из react-native-safe-area-context). Без них —
   * core SafeAreaView: на iOS системные отступы, на Android нулевые.
   */
  insets?: { top?: number; bottom?: number; left?: number; right?: number }
  /** Тост ушёл: истёк duration или вызван hide(). При замене новым тостом не вызывается. */
  onHide?: () => void
  style?: object
}
export const PersonalizationToastPresenter: ForwardRefExoticComponent<
  PersonalizationToastPresenterProps & RefAttributes<PersonalizationToastHandle>
>

/**
 * Штрихкод Code 128: чёрные полосы без фона, 42 в высоту, ширина — число модулей x модуль,
 * кратный пикселю (до 232). Строку не закодировать (пустая, не ASCII 32…126) — не рисуется.
 */
export interface PersonalizationBarcodeProps {
  code: string
  style?: object
}
export const PersonalizationBarcode: ComponentType<PersonalizationBarcodeProps>

/** Поле секции Info карты лояльности: подпись и значение. */
export interface PersonalizationLoyaltyCardField {
  label?: string
  value?: string
}

/**
 * Карта лояльности в духе пропуска Apple Wallet: шапка с логотипом и балансом, лента с эмблемой
 * и штампами, поля, штрихкод. Всё содержимое даёт хост; пустые секции не рисуются.
 */
export interface PersonalizationLoyaltyCardProps {
  /** Логотип: высота 33, ширина по пропорции картинки. Кит его не красит. */
  logoSource?: object
  /** Тонировка логотипа, если он одноцветный. */
  logoTintColor?: string
  balanceLabel?: string
  balanceValue?: string
  /** Картинка ленты, обрезается по центру. */
  stripeSource?: object
  /** Эмблема уровня поверх ленты справа. */
  emblemSource?: object
  /** Сколько штампов закрыто; зажимается в 0…stampsTotal. */
  stamps?: number
  /** Сколько штампов всего; 0 — ряда нет. */
  stampsTotal?: number
  fields?: PersonalizationLoyaltyCardField[]
  /** Код для штрихкода Code 128; пусто или не закодировать — секции нет. */
  code?: string
  /** Фон карты вместо Background/Card. */
  cardColor?: string
  /** Цвет подписей и значений вместо Text/Primary. */
  contentColor?: string
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationLoyaltyCard: ComponentType<PersonalizationLoyaltyCardProps>

// --- Сторис V2: визуальные компоненты -------------------------------------------------------------

/** Состояние обложки сторис: кольцо Button/Primary, Semantic/Warning + звезда, Neutral Subtle, скелетон. */
export type PersonalizationStoryCoverState = 'default' | 'pinned' | 'viewed' | 'skeleton'

/**
 * Обложка сторис 88x88: кольцо состояния и картинка в круге 76. `segments` делит кольцо на дуги
 * по слайдам; показанные — цветом Brand/Primary 65 %.
 */
export interface PersonalizationStoryCoverProps {
  source?: object
  state?: PersonalizationStoryCoverState
  segments?: number
  /** Индексы показанных слайдов (сегмент i отмечен, если показан слайд i) или их число — первые столько. */
  seenSegments?: number | number[]
  /** Звезда бейджа закреплённой сторис; без него — встроенная иконка. */
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationStoryCover: ComponentType<PersonalizationStoryCoverProps>

/** Сторис в ленте: обложка и подпись до двух строк с многоточием, колонка шириной 88. */
export interface PersonalizationStoryPreviewProps extends PersonalizationStoryCoverProps {
  title?: string
  onPress?: () => void
}
export const PersonalizationStoryPreview: ComponentType<PersonalizationStoryPreviewProps>

/** Сторис для ленты: как у StoryPreview, плюс id. */
export interface PersonalizationStoriesBarItem {
  id: string | number
  title?: string
  source?: object
  state?: Exclude<PersonalizationStoryCoverState, 'skeleton'>
  segments?: number
  seenSegments?: number | number[]
}

/** Лента сторис: шаг 16, поля 16 (меняются через `contentContainerStyle`); `loading` — скелетоны. */
export interface PersonalizationStoriesBarProps {
  stories?: PersonalizationStoriesBarItem[]
  loading?: boolean
  /** Сколько скелетонов при загрузке, по умолчанию 4. */
  skeletonCount?: number
  onStoryPress?: (story: PersonalizationStoriesBarItem, index: number) => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  contentContainerStyle?: object
  style?: object
}
export const PersonalizationStoriesBar: ComponentType<PersonalizationStoriesBarProps>

/** Полоски слайдов: до `current` залиты, текущий — на `progress` (0…1 или Animated.Value). */
export interface PersonalizationStoryProgressProps {
  count: number
  current?: number
  progress?: number | object
  style?: object
}
export const PersonalizationStoryProgress: ComponentType<PersonalizationStoryProgressProps>

/** Шапка просмотра: полоски слайдов и крестик 32 (Text/Secondary, 65 %). */
export interface PersonalizationStoryNavigationProps extends PersonalizationStoryProgressProps {
  onClose?: () => void
  /** Подпись крестика для скринридера, по умолчанию «Close». */
  closeLabel?: string
  /** Крестик; без него — встроенная иконка. */
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
}
export const PersonalizationStoryNavigation: ComponentType<PersonalizationStoryNavigationProps>

export type PersonalizationStoryPriceType = 'price' | 'discount' | 'promoCode'

/**
 * Плашка цены товарного слайда (коробка #F2F2F2 95 %, текст всегда тёмный). Валюта отделяется
 * от суммы по хвосту строки. Нажатие на промокод копирует его в буфер, показывает тост через
 * `toastRef` и зовёт `onPromoCopied`.
 */
export interface PersonalizationStoryPriceProps {
  type?: PersonalizationStoryPriceType
  /** Отформатированная цена, например «1 190 900 ₽». */
  price: string
  oldPrice?: string
  /** Для `discount`, например «10%». */
  discount?: string
  /** Для `promoCode`. */
  promoCode?: string
  /** Подпись над промокодом, по умолчанию «Promo code». */
  promoCaption?: string
  /** Текст тоста после копирования, по умолчанию «Copied». Пусто — без тоста. */
  copiedText?: string
  toastRef?: { current: PersonalizationToastHandle | null }
  /** Где тост, по умолчанию сверху. */
  toastPosition?: PersonalizationToastPosition
  onPromoCopied?: (code: string) => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationStoryPrice: ComponentType<PersonalizationStoryPriceProps>

/** Обратный отсчёт: одна пилюля (`merged`) или четыре коробки (`separate`); тик раз в секунду. */
export interface PersonalizationStoryTimerProps {
  endTime: Date | number | string
  view?: 'merged' | 'separate'
  /** Подписи единиц, по умолчанию d / h / m / s. */
  labels?: { days?: string; hours?: string; minutes?: string; seconds?: string }
  /** Отсчёт дошёл до нуля (один раз). */
  onEnd?: () => void
  style?: object
}
export const PersonalizationStoryTimer: ComponentType<PersonalizationStoryTimerProps>

/**
 * Текст на слайде. Видимый `backgroundColor` — сплошной блок (скругление 12, поля 12/16 у кегля
 * больше 30, иначе 8/16, текст Text/Light Primary); иначе прозрачный, без полей (Text/Primary).
 * Пресеты: large 48/48, medium 30/36, small 20/24.
 */
export interface PersonalizationStoryTextBlockProps {
  text: string
  preset?: 'large' | 'medium' | 'small'
  fontSize?: number
  lineHeight?: number
  color?: string
  backgroundColor?: string
  /** Прозрачность фона 0…1 (подложка под текстом, текст остаётся непрозрачным), по умолчанию 1. */
  backgroundOpacity?: number
  /** Сплошной блок без своего цвета — фон Semantic/Info. */
  solid?: boolean
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  italic?: boolean
  fontFamily?: string
  style?: object
}
export const PersonalizationStoryTextBlock: ComponentType<PersonalizationStoryTextBlockProps>

/**
 * Низ слайда с товарами: пилюля «Used products» (строка 64) и лист Background/Card с каруселью.
 * `expanded` + `onToggle` — управляемый режим, без них компонент помнит сам.
 */
export interface PersonalizationStoryUsedProductsProps {
  products?: PersonalizationProduct[]
  expanded?: boolean
  onToggle?: (expanded: boolean) => void
  /** По умолчанию «Used products». */
  showText?: string
  /** По умолчанию «Hide products». */
  hideText?: string
  /** Слот в начале строки — кнопка звука видео-слайда. */
  leading?: ReactNode
  onProductPress?: (product: PersonalizationProduct) => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationStoryUsedProducts: ComponentType<PersonalizationStoryUsedProductsProps>

/** Элемент слайда как его отдаёт API (`button`, `product`, `products`, `text_block`, `header`). */
export type PersonalizationStoryElement = Record<string, unknown> & { type: string }

/** Слайд сторис как его отдаёт `getStories`: `type` — `image`, `video` или `""` (товарный). */
export type PersonalizationStorySlide = Record<string, unknown> & {
  id: string | number
  type?: string
  background?: string
  background_color?: string
  preview?: string
  /** Секунды. */
  duration?: number
  elements?: PersonalizationStoryElement[]
}

/** Сторис как её отдаёт `getStories(code)` (`stories` блока). */
export type PersonalizationStory = Record<string, unknown> & {
  id: string | number
  name?: string
  avatar?: string
  viewed?: boolean
  pinned?: boolean
  start_position?: number
  slides: PersonalizationStorySlide[]
}

/** Тексты сторис V2 — одни имена на всех платформах (D). По умолчанию английские. */
export interface PersonalizationStoriesTexts {
  /** Подпись над промокодом, если у элемента `product` нет своего `title`. По умолчанию «Promo code». */
  promoCaption?: string
  /** Тост после копирования промокода, по умолчанию «Copied». */
  promoCopiedText?: string
  /** Кнопка товарного слайда без элементов `button`, по умолчанию «More info». */
  productButtonText?: string
  /** Пилюля карусели, если у элемента `products` нет своих `labels`, по умолчанию «Used products». */
  showProductsText?: string
  /** По умолчанию «Hide products». */
  hideProductsText?: string
  /** Кнопка, когда медиа не загрузилось, по умолчанию «Retry». */
  retryText?: string
  /** Для скринридера: крестик («Close»), звук включён («Sound on») и выключен («Sound off»). */
  closeLabel?: string
  soundOnLabel?: string
  soundOffLabel?: string
}

/**
 * Полноэкранный просмотр сторис (нативная Modal). В сеть не ходит и ничего не трекает — о показе
 * слайда и нажатиях сообщает колбэками. Медиа вписывается целиком; касание по третям (центр —
 * ничего), удержание и перетаскивание — пауза, свайп вниз — закрыть, вбок — соседняя сторис;
 * сторис открывается с первого невиденного слайда (`seen`). Пауза в фоне, видео по своей длине,
 * «Повторить» при ошибке медиа, звук помнится до конца процесса.
 */
export interface PersonalizationStoryViewerProps extends PersonalizationStoriesTexts {
  visible: boolean
  stories: PersonalizationStory[]
  /** С какой сторис открыть. Смена при открытом просмотре листает к ней внутри него. */
  initialStoryIndex?: number
  /** Новое значение при открытом просмотре — снова листать к `initialStoryIndex`, даже если индекс тот же. */
  openRequest?: number
  /** Виденные слайды `{ [storyId]: slideId[] }` — с какого слайда открывать сторис. */
  seen?: Record<string, string[]>
  /** Пауза хоста. */
  paused?: boolean
  onClose?: () => void
  onSlideView?: (story: PersonalizationStory, slide: PersonalizationStorySlide) => void
  onButtonPress?: (story: PersonalizationStory, slide: PersonalizationStorySlide, button: PersonalizationStoryElement) => void
  /**
   * Товар: карточка с картинкой товара или кнопка товарного слайда без элементов `button`
   * (element — элемент `product`), или товар карусели (element — `{ type: 'product', item }`).
   */
  onProductPress?: (
    story: PersonalizationStory,
    slide: PersonalizationStorySlide,
    product: Record<string, unknown>,
    element: PersonalizationStoryElement,
  ) => void
  /** Промокод скопирован — из плашки цены (элемент `product`) или из текст-блока. */
  onPromoCopied?: (story: PersonalizationStory, slide: PersonalizationStorySlide, code: string, element: PersonalizationStoryElement) => void
  /** Свои отступы безопасной зоны; без них — core SafeAreaView на iOS, статус-бар и навигационная панель на Android. */
  insets?: { top?: number; bottom?: number; left?: number; right?: number }
  /** Иконки; без него — встроенные иконки сторис. */
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
}
export const PersonalizationStoryViewer: ComponentType<PersonalizationStoryViewerProps>

// --- Виджеты с данными SDK ------------------------------------------------------------------------

/** Категория из поиска: из подсказок (есть id) или из популярных категорий пустого запроса. */
export interface PersonalizationSearchCategory {
  id: string | null
  name: string
  url: string | null
}

/** Товар ответа поиска как его отдаёт API (`search`), без преобразований. */
export type PersonalizationSearchProduct = Record<string, unknown> & {
  id: string
  name: string
  price: number
  price_formatted?: string
  oldprice?: number
  oldprice_formatted?: string
  discount?: number
  picture?: string
  image_url?: string
  brand?: string
  url?: string
  currency?: string
}

export interface PersonalizationInstantSearchFieldProps {
  /** Явный инстанс; иначе резолв по shopId через фасад. */
  sdk?: unknown
  /** Магазин при нескольких зарегистрированных; без него — единственный. */
  shopId?: string
  debounce?: number
  minChars?: number
  productsLimit?: number
  categoriesLimit?: number
  suggestionsLimit?: number
  recentLimit?: number
  recentCollapsed?: number
  showRecent?: boolean
  showSuggestions?: boolean
  showCategories?: boolean
  showProducts?: boolean
  showImages?: boolean
  locations?: string
  placeholder?: string
  cancelText?: string
  recentLabel?: string
  clearText?: string
  moreText?: string
  categoriesLabel?: string
  productsLabel?: string
  onSubmit?: (query: string) => void
  onCancel?: () => void
  onProductPress?: (product: PersonalizationSearchProduct) => void
  onCategoryPress?: (category: PersonalizationSearchCategory) => void
  onError?: (error: unknown) => void
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationInstantSearchField: ComponentType<PersonalizationInstantSearchFieldProps>

export interface PersonalizationSearchResultsScreenProps {
  sdk?: unknown
  shopId?: string
  query: string
  titleText?: string
  pageSize?: number
  /** popular, price, discount, sales_rate, date; null — релевантность. */
  sortBy?: string | null
  sortDir?: 'asc' | 'desc' | null
  locations?: string
  infiniteScroll?: boolean
  showFilters?: boolean
  showSort?: boolean
  /** Какие фасеты из `filters` показывать; null — все с более чем одним значением. */
  facets?: string[] | null
  productActionText?: string
  layout?: 'grid' | 'list'
  imageAspect?: 'square' | 'landscape' | 'portrait'
  onBack?: () => void
  onSortPress?: () => void
  onProductPress?: (product: PersonalizationSearchProduct) => void
  onProductAction?: (product: PersonalizationSearchProduct) => void
  onError?: (error: unknown) => void
  foundPrefix?: string
  foundSuffix?: string
  countPrefix?: string
  countSeparator?: string
  loadMoreText?: string
  emptyText?: string
  filtersTitle?: string
  resetText?: string
  applyText?: string
  showMoreText?: string
  showLessText?: string
  priceTitle?: string
  fromLabel?: string
  toLabel?: string
  brandsTitle?: string
  colorsTitle?: string
  sizesTitle?: string
  facetTitle?: (name: string) => string
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
  style?: object
}
export const PersonalizationSearchResultsScreen: ComponentType<PersonalizationSearchResultsScreenProps>

/** Колбэки и тексты виджета сторис — и у компонента, и у `PersonalizationStories.show()`. */
export interface PersonalizationStoriesOptions extends PersonalizationStoriesTexts {
  /** Код блока сторис. */
  code: string
  /** Явный инстанс; иначе резолв по shopId через фасад. */
  sdk?: unknown
  /** Магазин при нескольких зарегистрированных; без него — единственный. */
  shopId?: string
  /**
   * Уведомление о нажатии, как у прежних сторис: кнопка, товар (элемент `product` или
   * `{ type: 'product', item }` из карусели), промокод (элемент `product` или `text_block`).
   */
  onElementPress?: (element: PersonalizationStoryElement) => void
  /** Ссылка кнопки; задан — переход за хостом, иначе системный обработчик. Просмотр уже закрыт. */
  onLinkClick?: (url: string) => void
  /** Товар; задан — переход за хостом, иначе его ссылка (`deeplink_*` / `url`). Просмотр уже закрыт. */
  onProductClick?: (product: Record<string, unknown>) => void
  /** Нет кода, несколько магазинов без shopId, ошибка загрузки или 15 с без ответа; блок прячется. */
  onError?: (error: unknown) => void
  insets?: { top?: number; bottom?: number; left?: number; right?: number }
  /** Иконки; без него — встроенные иконки сторис. */
  renderIcon?: (svg: string, color: string, size: number) => ReactNode
}

/**
 * Сторис V2 с данными SDK: лента обложек (скелетоны при загрузке) и просмотр. Сам грузит
 * `getStories(code)`, трекает `view` на каждый показанный слайд и `click` на кнопку, товар и
 * промокод (с источником `stories`), помнит виденные слайды по магазину. Пустой блок или ошибка —
 * ничего не рисуется. Нажатие закрывает просмотр перед переходом.
 */
export interface PersonalizationStoriesProps extends PersonalizationStoriesOptions {
  /** Лента обложек; `false` — только просмотр, открываемый через ref. По умолчанию `true`. */
  bar?: boolean
  contentContainerStyle?: object
  style?: object
}

/**
 * Управление виджетом через ref. Открытие до загрузки ждёт её; при открытом просмотре — листает к
 * сторис внутри него.
 */
export interface PersonalizationStoriesHandle {
  /** Открыть сторис по индексу в ленте. */
  open(index?: number): void
  /** Открыть сторис по id; такой нет — ничего. */
  openStory(id: string | number): void
  /** Пауза открытого просмотра; без него — ничего (следующее открытие начнётся без паузы). */
  pause(): void
  /** Продолжить после `pause()`; без открытого просмотра — ничего. */
  resume(): void
  /** Загрузить блок заново. */
  reload(): void
}

export interface PersonalizationStoriesShowOptions extends PersonalizationStoriesOptions {
  /** С какой сторис открыть; без него или с неизвестным id — с первой. */
  startStoryId?: string | number
}

export const PersonalizationStories: ForwardRefExoticComponent<
  PersonalizationStoriesProps & RefAttributes<PersonalizationStoriesHandle>
> & {
  /**
   * Показ сторис блока без ленты. Нужен смонтированный `<SdkPopupOverlay />` (тот же хост, что у
   * in-app попапов); без него — `onError` и сразу завершение (тогда —
   * `<PersonalizationStories bar={false} ref={...} />` и `ref.open()`). Промис завершается, когда
   * просмотр закрыт; пустой блок или ошибка загрузки — `onError` и завершение.
   */
  show(options: PersonalizationStoriesShowOptions): Promise<void>
}
