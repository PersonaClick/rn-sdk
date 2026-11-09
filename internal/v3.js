// v3: попапы нового конструктора (документ design) и сторис V2 на API v3 — лента и события на хост
// панели, «Поделиться» по ссылке, опросы на слайдах. Не публичный API и не часть кита: у v3 свой
// шлюз (эта карта `exports`), снимается он, только когда v3 станет публичным. Корень пакета и кит
// (`ui`) v3 не экспортируют, их сторис пропсы v3 отбрасывают.
// Сабпас существует, чтобы демо-приложение могло до v3 дотянуться:
//
//   import { PersonalizationPopups, PersonalizationStories } from '@personaClick/react-native-sdk/internal/v3'
//
// PersonalizationStories и PersonalizationStoryViewer здесь — те же компоненты, что в ките, плюс
// пропсы v3; остальное (тексты, колбэки, типы данных) — из кита, `@personaClick/react-native-sdk/ui`.

// Попапы v3 — документ design нового конструктора попапов, движок и рендер на JS. Спят, пока хост
// не включил их у инстанса: PersonalizationPopups.of(sdk).enabled = true. Показ — слоем
// <SdkPopupOverlay> (тот же хост, что у in-app попапов).
export { PersonalizationPopups } from '../lib/popupsV3'

// Сторис на API v3: `apiV3Domain` (у виджета и глобальный), `handleLink()` (открытие по ссылке
// «Поделиться»), `shareUrlTransform`, опросы (`pollTransport` и тексты). Без `apiV3Domain` — старое
// API, как у сторис кита.
export { PersonalizationStoriesV3 as PersonalizationStories } from '../components/widgets/Stories'
export { default as PersonalizationStoryViewer } from '../components/design-system/StoryViewer'
