// UI-кит дизайн-системы: токены, тема, компоненты и виджеты с данными SDK. Отдельная точка входа,
// как у './stories': корень пакета UI не тянет, и приложение без своего UI кит не собирает.
//
//   import { PersonalizationButton } from '@personaClick/react-native-sdk/ui'
//
// v3 (попапы v3, сторис на API v3) в кит не входит: это не публичный API, у него свой шлюз
// (`internal/v3`), который снимается, только когда v3 станет публичным.

// Токены. Чистые данные, без нативных зависимостей.
export { PERSONALIZATION_TYPOGRAPHY, PERSONALIZATION_FONT_WEIGHT } from './constants/typography.constants';
export { PERSONALIZATION_SPACING } from './constants/spacing.constants';
export { PERSONALIZATION_RADIUS } from './constants/radius.constants';
export { PERSONALIZATION_ELEVATION } from './constants/elevation.constants';
export { PERSONALIZATION_ICONS, PERSONALIZATION_ICON_NAMES } from './constants/icons.constants';
export { PERSONALIZATION_COLORS } from './constants/colors.constants';

// Тема. Оборачивает дерево, чтобы перекрасить цвета, радиусы и шрифт;
// без неё компоненты берут значения из макета. Схему поддерева (светлая / тёмная вместо
// системной) навязывает PersonalizationColorSchemeProvider.
export {
  PersonalizationThemeProvider,
  PersonalizationColorSchemeProvider,
  usePersonalizationTheme,
} from './theme/personalization-theme'

// Компоненты. Чистые примитивы React Native, без нативных зависимостей. Исключение — сторис:
// просмотр берёт react-native-video, react-native-volume-manager (громкость включает звук) и
// react-native-safe-area-context (отступ навигационной панели Android), а плашка цены — буфер
// обмена (@react-native-clipboard/clipboard, без него — устаревший Clipboard ядра); всё это —
// необязательные peer-зависимости, только если они установлены. Иконки сторис встроены (PNG).
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
  ProductsBlock as PersonalizationProductsBlock,
  SuggestionRow as PersonalizationSuggestionRow,
  InstantSearch as PersonalizationInstantSearch,
  Filters as PersonalizationFilters,
  InAppPopup as PersonalizationInAppPopup,
  Catalog as PersonalizationCatalog,
  Toast as PersonalizationToast,
  ToastPresenter as PersonalizationToastPresenter,
  Barcode as PersonalizationBarcode,
  LoyaltyCard as PersonalizationLoyaltyCard,
  StoryCover as PersonalizationStoryCover,
  StoryPreview as PersonalizationStoryPreview,
  StoriesBar as PersonalizationStoriesBar,
  StoryProgress as PersonalizationStoryProgress,
  StoryNavigation as PersonalizationStoryNavigation,
  StoryPrice as PersonalizationStoryPrice,
  StoryTimer as PersonalizationStoryTimer,
  StoryTextBlock as PersonalizationStoryTextBlock,
  StoryUsedProducts as PersonalizationStoryUsedProducts,
  StoryViewer as PersonalizationStoryViewer,
} from './components/design-system'

// Виджеты с данными SDK. Резолвят инстанс через фасад (awaitInstance по shopId), ходят в
// поиск, категории, рекомендации и сторис и держат своё состояние; история запросов — в AsyncStorage
// (peer-зависимость SDK). Видео в сторис — react-native-video, если он стоит (опциональный peer, как у прежних сторис).
// PersonalizationStories.show() рисуется слоем <SdkPopupOverlay> — хоста in-app попапов.
// PersonalizationStories здесь и PersonalizationStoryViewer выше — без пропсов v3: их принимают только
// одноимённые экспорты internal/v3.
export {
  InstantSearchField as PersonalizationInstantSearchField,
  RecommenderBlock as PersonalizationRecommenderBlock,
  SearchResultsScreen as PersonalizationSearchResultsScreen,
  CategoryScreen as PersonalizationCategoryScreen,
  Stories as PersonalizationStories,
} from './components/widgets'
