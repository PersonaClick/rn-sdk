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
