// UI-кит дизайн-системы: токены, тема и компоненты. Пока не публичный API: кит ещё собирается
// и ничем в SDK не рендерится, поэтому с корня пакета он снят намеренно (шлюз — карта `exports`).
// Этот сабпас существует, чтобы демо-приложение могло до него дотянуться:
//
//   import { PersonalizationButton } from '@personaClick/react-native-sdk/internal/ui'
//
// Перед релизом кит получает нормальную публичную точку входа, а этот сабпас уходит.

// Токены. Чистые данные, без нативных зависимостей.
export { PERSONALIZATION_TYPOGRAPHY, PERSONALIZATION_FONT_WEIGHT } from '../constants/typography.constants';
export { PERSONALIZATION_SPACING } from '../constants/spacing.constants';
export { PERSONALIZATION_RADIUS } from '../constants/radius.constants';
export { PERSONALIZATION_ELEVATION } from '../constants/elevation.constants';
export { PERSONALIZATION_ICONS, PERSONALIZATION_ICON_NAMES } from '../constants/icons.constants';
export { PERSONALIZATION_COLORS } from '../constants/colors.constants';

// Тема. Оборачивает дерево, чтобы перекрасить цвета, радиусы и шрифт;
// без неё компоненты берут значения из макета.
export {
  PersonalizationThemeProvider,
  usePersonalizationTheme,
} from '../theme/personalization-theme'

// Компоненты. Чистые примитивы React Native, без нативных зависимостей.
export {
  Badge as PersonalizationBadge,
  Tag as PersonalizationTag,
  Checkbox as PersonalizationCheckbox,
  CheckboxWithLabel as PersonalizationCheckboxWithLabel,
  Loader as PersonalizationLoader,
  EmptyState as PersonalizationEmptyState,
  Button as PersonalizationButton,
  ButtonGroup as PersonalizationButtonGroup,
  InputField as PersonalizationInputField,
  Title as PersonalizationTitle,
  Link as PersonalizationLink,
  Accordion as PersonalizationAccordion,
  ListLabel as PersonalizationListLabel,
  Dots as PersonalizationDots,
  Count as PersonalizationCount,
  Rating as PersonalizationRating,
  SearchResultsTitle as PersonalizationSearchResultsTitle,
  ProductImage as PersonalizationProductImage,
  FavoritesBadge as PersonalizationFavoritesBadge,
  ProductCard as PersonalizationProductCard,
  ProductsList as PersonalizationProductsList,
  RecommenderBlock as PersonalizationRecommenderBlock,
  SuggestionRow as PersonalizationSuggestionRow,
  InstantSearch as PersonalizationInstantSearch,
  Filters as PersonalizationFilters,
  InAppPopup as PersonalizationInAppPopup,
  Catalog as PersonalizationCatalog,
  Toast as PersonalizationToast,
  ToastPresenter as PersonalizationToastPresenter,
  Barcode as PersonalizationBarcode,
  LoyaltyCard as PersonalizationLoyaltyCard,
} from '../components/design-system'

// Виджеты с данными SDK. Резолвят инстанс через фасад (awaitInstance по shopId), ходят в
// поиск и держат своё состояние; история запросов — в AsyncStorage (peer-зависимость SDK).
export {
  InstantSearchField as PersonalizationInstantSearchField,
  SearchResultsScreen as PersonalizationSearchResultsScreen,
} from '../components/widgets'
