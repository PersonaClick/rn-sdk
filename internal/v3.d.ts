// Типы для '@personaClick/react-native-sdk/internal/v3'. Почему v3 живёт здесь, отдельно от кита, — см. ./v3.js.
import type { ComponentType, ForwardRefExoticComponent, RefAttributes } from 'react'
import type {
  PersonalizationProduct,
  PersonalizationStoriesHandle,
  PersonalizationStoriesOptions,
  PersonalizationStoriesProps,
  PersonalizationStoriesShowOptions,
  PersonalizationStory,
  PersonalizationStorySlide,
  PersonalizationStoryViewerProps,
} from '../ui'

// --- Попапы v3 ------------------------------------------------------------------------------------

/**
 * Попапы v3 инстанса SDK — документ design нового конструктора попапов, движок и рендер на JS.
 *
 * Работают, только если хост их включил (`enabled`) И `/init` прислал `popups_v3: true` (или хост
 * задал `ignoreInitFlag`); без `enabled` — ни одного запроса. Список — `GET
 * https://{appHost}/api/v3/storefront/popups` (кеш на `ttl`), события — `POST …/popups/{id}/events`.
 * Показ — слоем `<SdkPopupOverlay />`: без него попап не показывается.
 */
export interface PersonalizationPopupsController {
  /** Включение хостом. По умолчанию `false`. */
  enabled: boolean
  /** Не ждать флага `popups_v3` из `/init`. По умолчанию `false`. */
  ignoreInitFlag: boolean
  /** `testmode=true` в списке, ручном показе и `/init`; частота показов не записывается. */
  testMode: boolean
  /** `debug=1` в списке, исключённые попапы и решения движка — в лог. */
  debug: boolean
  /** Хост ЛК без схемы. По умолчанию `app.personaClick.ru`; `null` — попапы молчат. */
  appHost: string | null
  /**
   * Свой обработчик ссылок попапа — кнопки, ссылки элемента, применения промокода, ссылки товара
   * (после события `click`): вернул `true` — хост обработал ссылку сам, попап закрывается без
   * события `close`; иначе (или хука нет) — открывает система, попап остаётся. Исключение в хуке —
   * как `false`.
   */
  onLink: ((url: string) => boolean) | null
  /**
   * Нажатие на товар ленты рекомендаций (после события `click`): вернул `true` — хост открыл товар
   * сам, попап закрывается без события `close`; иначе (или хука нет) — ссылка товара: `deeplink`,
   * пустой — `url`, как любая ссылка попапа (`onLink`, затем система). Исключение в хуке — как
   * `false`.
   */
  onProductClick: ((product: PersonalizationProduct) => boolean) | null
  /**
   * Открыт экран с кодом `name` — тем, что маркетолог пишет в `target_screens`. Звать при каждом
   * показе экрана: на нём стреляют `app_start`, `screen_open` и отсчёт `time_on_screen`.
   */
  screenOpened(name: string): void
  /** Ручной показ по id (`GET …/popups/{id}`): без триггера, экранов и частоты. `true` — показан. */
  show(id: number | string): Promise<boolean>
}

export const PersonalizationPopups: {
  /** Попапы v3 инстанса (один контроллер на инстанс). */
  of(sdk: unknown): PersonalizationPopupsController
}

// --- Сторис на API v3: «Поделиться» ---------------------------------------------------------------

/** Слайд ленты API v3: слайд кита плюс ссылка «Поделиться». */
export type PersonalizationStorySlideV3 = PersonalizationStorySlide & {
  /** Ссылка «Поделиться» слайда (API v3); у слайдов товарных кампаний её нет. */
  share_url?: string | null
}

/** Сторис ленты API v3: сторис кита плюс «Поделиться» кампании. */
export type PersonalizationStoryV3 = PersonalizationStory & {
  /** `false` — кампанией нельзя делиться (API v3). */
  shareable?: boolean
  /** Ссылка «Поделиться» кампании (API v3) — для слайдов без своей, с id слайда в `r46_slide`. */
  share_url?: string | null
  slides: PersonalizationStorySlideV3[]
}

// --- Сторис на API v3: опросы ---------------------------------------------------------------------

/** Ответ опроса, как его отдаёт API v3 (`answer` элемента `poll` или `payload.answer`). */
export interface PersonalizationStoryPollAnswer {
  id?: number
  option_ids?: number[] | null
  text?: string | null
  rate?: number | null
}

/** Результаты мини-опроса с `show_results`. */
export interface PersonalizationStoryPollResults {
  total: number
  options: { id: number; percent: number }[]
}

/**
 * Транспорт опросов на слайдах (элемент `poll`, API v3). По умолчанию виджет берёт клиент опросов
 * на хост ленты v3 (`POST /api/v3/polls/…` с `shop_id`, `did`, `sid`); подменить можно для тестов
 * и офлайн-демо. Ошибка (reject) — карточка показывает текст ошибки и даёт повторить.
 */
export interface PersonalizationStoryPollTransport {
  /** Ответ на мини-опрос: `body` — `{ option_ids } | { text }`, `story_id` (число), `slide_id` (строка). */
  answerMiniPoll(
    code: string,
    body: { option_ids?: number[]; text?: string; story_id: number | string; slide_id: string },
  ): Promise<{ answer?: PersonalizationStoryPollAnswer | null; results?: PersonalizationStoryPollResults | null }>
  /** Оценка шкалы: `body` — `{ channel, category }` (NPS) или `{ channel, campaign }` (CSAT, CES) и `rate`. */
  review(
    kind: 'nps' | 'csat' | 'ces',
    body: { channel: string; category?: string; campaign?: string; rate: number },
  ): Promise<unknown>
}

/** Тексты сторис v3 — одни имена на всех платформах (D). У опросов `labels` элемента важнее. */
export interface PersonalizationStoriesV3Texts {
  /** «Поделиться» для скринридера, по умолчанию «Share». */
  shareLabel?: string
  /** Ссылка «ответить заново» опроса, по умолчанию «Answer again». */
  pollReanswerText?: string
  /** Кнопка отправки без `submit_label`, по умолчанию «Send». */
  pollSubmitText?: string
  /** Ошибка отправки, по умолчанию «Failed to send the answer. Please try again». */
  pollErrorText?: string
}

// --- Сторис на API v3: просмотр -------------------------------------------------------------------

/**
 * Пропсы просмотра кита плюс v3: «Поделиться» и опросы. У слайда со ссылкой (`share_url` слайда или
 * кампании, если `shareable` не `false`) — «Поделиться» в шапке: пауза, `onShare`, системное окно с
 * ссылкой, по закрытию слайд продолжается. Просмотр кита этой кнопки не рисует.
 */
export interface PersonalizationStoryViewerV3Props extends PersonalizationStoryViewerProps, PersonalizationStoriesV3Texts {
  /** Нажата «Поделиться» — сразу, до системного окна; `url` — ссылка слайда до `shareUrlTransform`. */
  onShare?: (story: PersonalizationStoryV3, slide: PersonalizationStorySlideV3, url: string) => void
  /**
   * Ссылка для окна «Поделиться» из ссылки слайда, например своя схема приложения вместо `https://`.
   * Без него — как есть; ошибка или пустой результат — тоже как есть. `onShare` получает исходную.
   */
  shareUrlTransform?: (url: string) => string
  /**
   * Опросы на слайдах (элемент `poll`, лента API v3): без транспорта не рисуются. Карточка держит
   * слайд, пока её трогают, в поле фокус или ответ уходит; поднимается над клавиатурой.
   */
  pollTransport?: PersonalizationStoryPollTransport | null
  /** Магазин — ключ ответов опросов этой сессии (в памяти процесса). */
  pollShopId?: string
}

/** Просмотр сторис кита (`PersonalizationStoryViewer` из `ui`) с пропсами v3. */
export const PersonalizationStoryViewer: ComponentType<PersonalizationStoryViewerV3Props>

// --- Сторис на API v3: виджет ---------------------------------------------------------------------

/** Параметры v3 виджета сторис — и у компонента, и у `show()` / `handleLink()`. */
export interface PersonalizationStoriesV3Options extends PersonalizationStoriesV3Texts {
  /**
   * Хост API v3 без схемы (`app.personaClick.ru`) для этого виджета / показа: лента и события идут туда,
   * у слайдов со ссылкой есть «Поделиться». Не задан — глобальный `PersonalizationStories.apiV3Domain`;
   * `null` — старое API. Соседние виджеты независимы.
   */
  apiV3Domain?: string | null
  /**
   * Ссылка для окна «Поделиться» из ссылки слайда (например, своя схема приложения вместо
   * `https://`); доходит до просмотра, в том числе открытого через `show()` / `handleLink()`.
   * Без него — как есть. Событие `share` не меняется.
   */
  shareUrlTransform?: (url: string) => string
  /**
   * Транспорт опросов на слайдах (только с API v3); без него — клиент опросов SDK на хост ленты.
   * Для тестов и офлайн-демо.
   */
  pollTransport?: PersonalizationStoryPollTransport
}

export type PersonalizationStoriesV3Props = PersonalizationStoriesProps & PersonalizationStoriesV3Options

export type PersonalizationStoriesV3ShowOptions = PersonalizationStoriesShowOptions & PersonalizationStoriesV3Options

/** Параметры открытия по ссылке — как у `show()`, кроме `code` и `startStoryId` (они из ссылки). */
export type PersonalizationStoriesLinkOptions = Omit<PersonalizationStoriesOptions, 'code'> & PersonalizationStoriesV3Options

/**
 * Сторис V2 кита (`PersonalizationStories` из `ui`) с пропсами v3, глобальным `apiV3Domain` и
 * открытием по ссылке «Поделиться». Без `apiV3Domain` — старое API, как у сторис кита.
 */
export const PersonalizationStories: ForwardRefExoticComponent<
  PersonalizationStoriesV3Props & RefAttributes<PersonalizationStoriesHandle>
> & {
  /**
   * Глобальный хост API v3 без схемы, например `app.personaClick.ru`; `null` (по умолчанию) — старое API
   * (`stories/{code}`, `track/stories`). Значение по умолчанию для `apiV3Domain` виджета, `show()` и
   * `handleLink()` — и для сторис кита, у которых своего нет: с ним лента, кампания по ссылке и
   * события (`view`, `click`, `share`, `shared_open`) идут на
   * `https://{apiV3Domain}/api/v3/storefront/stories/…`, и у слайдов со ссылкой есть «Поделиться».
   * Читается при загрузке блока.
   */
  apiV3Domain: string | null
  /**
   * Открывает кампанию по ссылке «Поделиться» (`?r46_stories=<code>&r46_story=<id>[&r46_slide=<id>]`,
   * другие параметры не мешают). `true` — это ссылка сторис и есть хост v3 (`options.apiV3Domain`,
   * иначе глобальный): дальше асинхронно ждёт SDK, грузит кампанию, закрывает другие открытые
   * просмотры и показывает её со слайда ссылки через `<SdkPopupOverlay />` (как `show()`), затем
   * `shared_open`. Ошибка, 404, пусто или 15 с без ответа — `onError`, ничего не показывается. Та же
   * ссылка, пока грузится или открыта, — повтор не нужен, тоже `true`. Иначе `false`, и ничего не
   * происходит.
   */
  handleLink(url: string, options?: PersonalizationStoriesLinkOptions): boolean
  /** Показ сторис блока без ленты — как `show()` кита, плюс параметры v3. */
  show(options: PersonalizationStoriesV3ShowOptions): Promise<void>
}
