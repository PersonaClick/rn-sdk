## 5.0.1 (2026-11-24)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* a failed init no longer leaves SDK calls hanging, init is retried (78e7816)
* a refused init stops the shop's requests for the session (c2515f3)
* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* axios 0.34.0 for GHSA-x97p-jq2g-jp4f (a267f81)
* **deps:** bump axios to 0.33.0 (de5d23b)
* **deps:** widen firebase peer range to support host v24 (7aababe)
* **gcm:** message variability (544eb08)
* init waits for the network, retries only transient failures, a refusal is final (40fb344)
* **request:** keep reserved characters in query values (85bdcbc)
* **sdk:** a back swipe on the first v3 story closes the viewer as the web SDK does, and so does one over stories with nothing to show, which are marked viewed; a valid background opacity of a v3 text block replaces the alpha of an #RRGGBBAA or rgba() colour, which keeps its own alpha without one; a link to a story with nothing to show passes it on (08ee2f1)
* **sdk:** a call made right after deleteUserCredentials waits until the wipe is over on both platforms — Android starts its wipe after the native call returns, so a tracking event accepted meanwhile was wiped with the forgotten customer, where iOS's tracking line keeps it for the next one; JavaScript now hands the calls made after the wipe to the native module once it settled, and a failed wipe holds back nothing (f32c632)
* **sdk:** a forward swipe on the last v3 story marks it viewed and closes the viewer, and a vertical swipe longer than 100 up or down closes a v3 viewer, as the web SDK does; the legacy feed keeps its edges and its swipe down (4159eeb)
* **sdk:** a horizontal swipe in a v3 stories viewer counts only by its length past 100, as the web SDK's swipeLength, so a short fast flick neither changes the story nor closes the viewer at the first or last one; the legacy feed keeps 60 and the fling (3d7cf6d)
* **sdk:** a native deleteUserCredentials that fails no longer leaves the shop's JavaScript calls waiting — the device id, the session and the queue's state taken before the wipe come back, unless the native SDK told another device id meanwhile, and the calls made while it ran go with the customer they had (90b82bc)
* **sdk:** a push's code and type are strings wherever the SDK reads them — PushPayloadParser.typeAndCode writes a number as one, as the iOS parser does, and reads an id sent as { id } — and the default tap handling reads the push's event as it came, an APNs object or an FCM JSON string, and takes a direct APNs push without a message id as its own push, by its src, instead of the first push kept (c7c4119)
* **sdk:** a registered shop's push is drawn at once — its delivered event goes as it comes and is not waited for before the notification, opened follows delivered, and the headless task waits for the two at most ten seconds, so a request that hangs neither delays the push nor holds the task (e6dc838)
* **sdk:** a server popup of the native SDK is shown as it comes, since Android 2.55.0 and iOS 3.41.0 hand it over once its delay passed, so it no longer waits its delay twice; a popup this JavaScript gets itself, without the native module, still waits it (3ce8f0f)
* **sdk:** a server popup the native module held reaches its own shop — JavaScript keeps one subscription for every shop's popups and hands each to the listeners of its shop, and a popup no listener of its shop hears yet, the native replay to the first shop's listener among them, waits up to a minute for that shop's instance instead of being dropped; a released shop's held popups go (ec7155d)
* **sdk:** a shop registered without an instance sends the push events JavaScript sends for it to its apiDomain — PersonaClick.register hands the shop's hosts to the requests at once, as its instance will, and leaves a live instance its own (c86f97d)
* **sdk:** a skipped v3 stories slide is passed forward with its segment filled and stepped over backward without a new view, a start on it moves to the next shown slide, a story with nothing to show is passed and marked viewed while it stays in the bar, the viewer that has nothing to show closes without an empty screen, and back on the first slide of the first v3 story closes the viewer as the web SDK does; the legacy feed keeps its restart (b0a990a)
* **sdk:** a stories poll counts as answered exactly as hasAnswer of the web SDK — any non-empty option_ids, a non-empty text string or a rate that is a number — a saved answer that cannot be read is removed as an expired one is, and tests pin the order: a fresh feed's answer, then one sent in this process, then the saved record (645047c)
* **sdk:** a v3 product slide shows only its own buttons, without the kit's product button, and a v3 slide whose type is neither image nor video and that has no product is skipped without a view, as the web SDK does; the legacy feed keeps both (ce42e78)
* **sdk:** a v3 stories text block whose background opacity is the number 0 or false paints its colour opaque, as calculateOpacity of the web SDK takes any falsy opacity for none; only the strings 0 and 0% make it transparent (d50dabc)
* **sdk:** a vertical swipe closes a v3 stories viewer only by its length, past 100 up or down, as the web SDK does; a short fast flick no longer closes it, and the legacy feed keeps its rule (cdd3ca7)
* **sdk:** every promise of the Android module settles whatever its native call throws — the body of each method with a promise rejects with invalidArgument on any exception, as iOS does for an unexpected error, and a result the maps cannot hand over rejects with decoding — so the shop's start and the calls that wait for it can no longer hang (2d094c3)
* **sdk:** flush and deleteUserCredentials keep the order of the tracking calls around them — on iOS both run on the shop's tracking line, as Android's queue orders them, so a flush sends the events sent before it and a wipe takes them while the events sent after it wait for the next customer, and JavaScript hands both to the native module one step after the start, as a namespace's call, so a call made after them no longer overtakes them (8351d64)
* **sdk:** flush resolves with nothing on both platforms: Android's module answered null (cf349fb)
* **sdk:** getProbabilityToPurchase asks API v3 on the account host and reads the prediction from payload: the old path answers 503 (c1350f4)
* **sdk:** on Android the popups held while JavaScript could not hear them go to it in the order they came (703c772)
* **sdk:** on iOS a shop's tracking events reach its queue in the order JavaScript sent them: each waits on the shop's line for the one before it to be accepted or refused instead of starting in a task of its own, the banners, popupShown, the raw queue event and setSource with them; a refused event holds back none, and releaseShop drops the shop's line (4173090)
* **sdk:** paging a v3 stories viewer keeps 60 or a fast flick, as the platforms' pagers do; only the closing swipes — back on the first story and forward on the last — need a length past 100, as the web SDK (8147c35)
* **sdk:** parsed products read numbers sent as strings (77d607b)
* **sdk:** product categories read the parent from parent_id (0044da9)
* **sdk:** product typings admit what the parser passes through (93aa732)
* **sdk:** recommend, search and tracking send the device's A/B segment, as Android, iOS and the JS SDK do; a recommender block under an A/B test no longer answers an error (f6c1954)
* **sdk:** review() without a channel sends the channel of the app's platform — android_app on Android, ios_app on iOS — where 4.x read the stream and sent ios_app for any stream but android, the default react-native too (ee8700f)
* **sdk:** Segment.type is a string on both platforms, empty when the server gives a segment none, as Android 2.55.0 and iOS 3.41.0 have it, and the module's maps take the native models whose agent message id may be null and whose agent product reason is never null (7cd7d3e)
* **sdk:** stories.get hands over a slide's and a text block's style the block does not set as "", as the contract and both native SDKs have it, in place of null (d659a31)
* **sdk:** text blocks of a stories slide start under the measured top of its body, so they no longer sit under the header row of a v3 slide (dc6e89a)
* **sdk:** the account's host by default is built from the API's address — the API's host with app. for api. — in place of the literal app.personaclick.ru, for the purchase prediction and for popups v3 alike, so the mirror's build, whose rules rewrite the API's address whole but would turn the literal into a host that does not exist, gets its own account host; the tests that pin the default host build it the same way (a51c7b6)
* **sdk:** the background opacity of a v3 stories text block is read as calculateOpacity of the web SDK — a number is a percent with or without %, so 0.5 is half a percent — and a colour with no opacity, or one out of 0–100, is painted opaque; the legacy feed keeps its fractions (a5f7b3a)
* **sdk:** the built-in texts of a stories poll are the web SDK's three English constants — Answer again, the send error and Send — replaced by the host's texts, the element's labels and, on a submit button, submit_label; the device and iOS preferred languages are no longer read for them (a8cac46)
* **sdk:** the built-in texts of a stories poll follow the language the user chose on an iOS device, not the app locale Intl reports, so an app without a Russian localization shows them in Russian on a Russian system; Android keeps the device locale (3eaf804)
* **sdk:** the colour of a v3 stories slide and the fills of a poll card are read by one parser — #RGB, #RRGGBB, #RRGGBBAA, rgb() and rgba() — and a slide painted by its background_color takes the kit scheme whose text contrasts more with it by WCAG, a translucent colour laid over the black of the viewer (d9c8740)
* **sdk:** the deprecated trackEvent sends what 4.0.26 sent — built as 4.x built it and handed to the native queue's raw push/custom entry, so a value or time with a fraction or past 32 bits is no longer refused — and tracking.custom takes time and value as whole 32-bit numbers on Android, iOS and without the native module alike, the range Android's native custom holds (3c663bb)
* **sdk:** the deprecated trackSource stores what 4.x stored — with the native module a source it takes goes there with the code as a string and replaces one kept 4.x's way, and a source the native SDKs do not take yet, slider, agent_search, an unknown type or an empty code, is stored in 4.x's keys instead of being dropped and moves to the native SDK at a later start once it takes it, within its 48 hours; what stays different is in Migrating to 5.0 (f876a21)
* **sdk:** the earlier data methods behave as in 4.0.26 with the native module too — they send their own requests from JavaScript with the parameters they are given and resolve with the server's answer and its errors as before, only the device id, the session and the A/B group are the native SDK's — pinned by a parity test against 4.0.26's requests and results; apiDomain and appDomain reach the JavaScript requests too (c670894)
* **sdk:** the header of a stories slide is drawn over the poll cards, its progress, close and share stay tappable when a card goes under them and its empty parts let taps through; a card keeps 16 from the sides and its bottom 16 above the sound button and products row when they show, else above the safe area (87767ca)
* **sdk:** the header row of a v3 stories slide takes the kit's SM Emphasized title and XS subtitle beside its 40 icon with a gap of 12, the same on all platforms (bcf32cc)
* **sdk:** the iOS module compiles on the old architecture without the codegen spec — PersonaClickNative.mm takes the spec, its conformance and getTurboModule only where the new architecture is on or the spec was generated, and is a plain event emitter otherwise, so the SDK runs in JavaScript there as the README says (cdce601)
* **sdk:** the popups of the native SDK's answers are shown by JavaScript as 4.0 showed its own — the native SDK draws none and hands each one over as the server sent it, so <SdkPopupOverlay> shows it, or the app's popupPresentationDelegate gets it, and it is reported shown through the native tracking; one that comes while JavaScript cannot hear it waits a minute for it (c8dd65a)
* **sdk:** the prediction's client_id is typed as the number API v3 sends (e7a6bfd)
* **sdk:** the push token 4.x kept in AsyncStorage goes to the native SDK on its start, unless the native SDK has it already — the app's push registration finds the kept token and sends nothing, so without this the native SDK never knew the shop's token, neither for getPushToken nor for its weekly resend (f122b69)
* **sdk:** the same answer gives the same models on Android and iOS — profile.get has an empty map for no custom properties, the server's [] too, profile.getOrders and its lines' products have null where a released model kept "" or 0 for none and taxFree false, a history message's campaignId is null for none and its statistics false, iOS reads an order product's discount as Android does and keeps its sales rate's shortest form — and the deprecated trackPurchase sends an attribution the two native purchases take differently, web_push_digest among them, as 4.0.26 sent it, through the native queue on both (e593b56)
* **sdk:** the SDK's Notifee background handler no longer replaces the app's — Notifee keeps one, so the SDK wraps notifee.onBackgroundEvent as it is imported and a handler the app sets afterwards runs beside the SDK's: both hear every event, the event's result is the app's, and the SDK's handling of its own notifications still runs when the app's fails (ddbbb91)
* **sdk:** the sound button of a v3 stories video shows once the video loads and has an audio track or the player cannot tell — an empty track list on iOS, built from the audio selection group, is not taken as silence — and is hidden only when Android confirms none; volume up unmutes only the open viewer, the button's choice alone is kept per shop, and v3 keeps its sound apart from the legacy viewers also without a shop (78e08f7)
* **sdk:** the typings of the v3 stories viewer carry its v3, positions, onSlideRestart, onStoryLeave and onHeaderPress props and the header element, and the gate test checks that each v3 prop of the viewer is typed and dropped by the kit (2f888d1)
* **sdk:** track() keeps its place among the tracking calls made around it — every call of the native module takes its turn when the app makes it and is handed over once the calls before it were, so a track whose fields are still being built holds the tracking.*, setSource and namespace calls made after it instead of being overtaken by them, and a call that fails holds back none (1ab9424)
* **sdk:** tracking in the story viewer no longer gets in the way of a tap: a product tap no longer throws a TypeError before its link opens, and a failed click or view no longer leaves an unhandled rejection (5ac1291)
* **ui:** a popup link the host opened itself closes the popup without close, as a product does (c9f904b)
* **ui:** a request in flight can no longer lock a cache key (b2e2223)
* **ui:** badge text stays on one line (c8d2be3)
* **ui:** cards in a row share a baseline, loader replaces count and load more (1769a51)
* **ui:** carousel dots are off by default (0128338)
* **ui:** data widgets treat an SDK answer that is an error as a failure (799a313)
* **ui:** discount badge only for a positive discount (7e0e783)
* **ui:** filters keep the title and buttons in place while sections scroll (b5cf762)
* **ui:** follow the design file — button radii, LG height, input fill, loader slot (286df2b), closes #F2F2F2
* **ui:** in-app popup cross, buttons and shadow as in the finished design (168b864)
* **ui:** instant search clear cross clears the query (431ce56)
* **ui:** instant search treats an SDK answer that is an error as one (1097fef)
* **ui:** load state turns a throwing isEmpty or onChange into Error (bb88386)
* **ui:** long card prices put the old price above the price (44e1c49)
* **ui:** narrow list card moves the button under the price (e93002b)
* **ui:** popup picture shown whole, cross on a card-coloured disc (d4d668f)
* **ui:** popups v3 keep to their design in a dark system theme — the consent checkbox takes the form's colors, kit blocks the theme of the popup's background (c953fbe)
* **ui:** request cache keys keep dates, maps, sets and separators apart (c2c6e46)
* **ui:** result count stays hidden until the first page answers (fc38a73)
* **ui:** search results fall back to default error and Retry texts (407e0dd)
* **ui:** search results show "no results" only when there are none (da034d0)
* **ui:** SearchResultsScreen drops answers that arrive after unmount (37e455b)
* **ui:** stories v2 crosses out the regular price only above the promo price (fdbaca1)
* **ui:** stories v2 drop repeated story ids (ffb7403)
* **ui:** stories v2 follow the shared rules (f039d41)
* **ui:** stories V2 global API v3 host applies, no stuck pauses in the viewer (f71481e)
* **ui:** stories v2 long promo code shrinks instead of squeezing the price (fabe665)
* **ui:** stories v2 media slides are the ones with a background (297e144)
* **ui:** stories v2 open pages inside the open viewer, pause without a viewer is a no-op (7f76074)
* **ui:** stories v2 product card shows the promo code of the slide's text block (e6307e4)
* **ui:** stories v2 product picture no longer opens the product (849c6bf)
* **ui:** stories v2 product picture tap opens the product (61a23a8)
* **ui:** stories v2 promo price crosses oldprice only above the regular price (53e9773)
* **ui:** stories v2 readiness and video retry timers freeze in background (c9f2d77)
* **ui:** stories v2 restart keeps the media and seeks the video to 0 (3757659)
* **ui:** stories v2 show() reports an empty block and starts an unknown story id at the first (05e9c17)
* **ui:** stories v2 taps outside the open sheet only close it (6aaf333)
* **ui:** stories v2 viewed ring and centred products toggle (79aac99)
* **ui:** text block of stories V2 stays between the header and the buttons, like a poll (6e9ad77)
* **ui:** tokens follow the design file's variables again (96a5879), closes #F2F2F2 #0D0D0 #1A1A1 #0D0D0


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* overlay layers in SdkPopupOverlay and an ambiguous-shop check for widgets (8100a75)
* **push:** single process-wide router that routes pushes by shop_id (5c0d88d)
* **rn:** multi-instance push routing, per-shop identity, demo + E2E (10e1641)
* **sdk:** a native module brings a shop up on the native Android and iOS SDKs' new core and tells JavaScript its state, device id and session; nothing in the SDK's JavaScript uses it yet (8c8c082)
* **sdk:** a popup with no known position comes out fullscreen (4099996)
* **sdk:** a shop whose app names no stream runs as react-native on both platforms, as the contract has it — the native SDK starts it so, and the requests JavaScript still sends for it carry it, a registered shop and its push sent from JavaScript too; an app's own stream is kept, and without the native module the SDK sends what 4.x sent (8b03e27)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** enableAutoPopupPresentation — off, the SDK shows no popups of its own (server ones and popups v3 of triggers); may be changed at any time (e3c93be)
* **sdk:** getCategory params typed, price and sorting included (feea30f)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** on Android a tracking call settles once the native queue took the event, as on iOS: the module tracks through the bridges' tracking.queued of the Android SDK, pinned to its commit until v2.54.0, so an event the server refuses later no longer rejects it, and a tracking promise resolves with nothing on both platforms (cfebe5e)
* **sdk:** on iOS the notification history carries what it carries on Android — the module hands the answer's status and each message's channel, campaignId and statistics as Android's does, on the iOS SDK pinned to its revision until 3.41.0 — and the types say a message's fields are on both platforms and its statistics are booleans (5ba04f4)
* **sdk:** parsed products carry deeplinkAndroid and discount fields (ae447ee)
* **sdk:** partition per-shop UI state — stories-viewed and popup overlay (4b73088)
* **sdk:** products list keeps the categories of the answer (106f9bc)
* **sdk:** public multi-instance facade and push handoff (0f0d3bb)
* **sdk:** registry and pure resolvers, register each instance by shop_id (0bd3c18)
* **sdk:** rm jest (d0cce5d)
* **sdk:** send gift_package on purchase (dfeaa23)
* **sdk:** sid token generation (4a34846)
* **sdk:** slider and agentSearch reach the native SDKs as their bridge-only raw sources — NamespaceArgs.sourceOf builds them with TrackingSource.fromWire on Android and TrackingSource(rawType:code:) on iOS, so an event's source, setSource and a purchase's recommendedBy go with slider and agent_search instead of being refused; the deprecated trackSource hands them to the native SDK and a start moves a stored one there, track sends them through the native tracking methods and trackPurchase through the native purchase (3679a3f)
* **sdk:** stories from the v3 feed behave as the web SDK's, drawn with the kit — media is decided by type, background_color paints a slide without media too with the kit scheme following it, text blocks default to the kit body size and read text_bold and text_italic, the header element shows its icon, title and subtitle and a tap sends click and opens its link, a button without a link only sends click, a story opens at the feed's start_position or where it was left in the session and its ring follows the feed's viewed and leaving it forward, view goes again on a restart of the first slide, the mute choice is kept on the device per shop and the button shows only for a video with sound, the share link is the slide's or the campaign's as is, and copying a promo code sends no click; the legacy feed keeps the kit's rules (c52edbe)
* **sdk:** stories v3 polls work as the web SDK's — an answer is kept on the device for 90 days under the shop, did, poll type, code, story and slide, read with the feed, written back to the feed element and to the device after a send, the feed's answer winning over it; a scale whose band asks a question asks it after the rate with a 5000-character comment sent as a second review of the same rate, then shows the band's success; answers and reviews carry source_type stories with the story and slide ids as strings instead of story_id and slide_id; the card shows what the web card shows in the kit's look, the scale coloured with the kit's Danger and Warning, placed at y_offset and lifted 16 above the slide's bottom; built-in texts follow the device language (f927be9)
* **sdk:** stories v3 requests carry the identity of the web SDK — the feed, the story by link and the events send shop_id, did, sid of the native session, segment as the device's A/B group (empty when unknown), stream (react-native when the shop names none) and testmode=true while the test mode of popups v3 is on; poll answers and reviews send the same without segment, and an event's story_id is a number when numeric and its slide_id a string (9fce785)
* **sdk:** the instance has flush, release and deleteUserCredentials of the contract: release stops it for good and every later call rejects with notInitialized, deleteUserCredentials forgets the customer in the native SDK and in what JavaScript still keeps — its device id and session, the stored identity, the source, the push token's date, the recent searches — and the push token goes to the next device id; without the native module JavaScript does the same itself (d530f2c)
* **sdk:** the namespaces are typed for apps — sdk.products, sdk.search and the rest with the contract's models, the earlier methods marked deprecated with their replacements — and notifications.setPushToken reports the provider the token was registered with (b0f1077)
* **sdk:** the namespaces' models are the contract's — a field the contract always fills is typed without null in stories, sliders, loyalty, reviews, the search agent and the product counters, clientId of the purchase prediction is a string, an order's sums are strings and its line's product an OrderProduct whose fields may be null, Query, ColorFilter, SizeFilter and ProductCounterTriggers are named, loyalty's currentTime is HH:MM, and on both platforms stories.get gives null for the style a block does not set and the search agent an empty reason for a product without one (bdf1ff4)
* **sdk:** the native module calls every namespace of the native SDKs (Android 2.53.0, iOS 3.40.0) through typed methods and hands their models to JavaScript as maps with the contract's field names; nothing in the SDK's JavaScript uses them yet (ef80133)
* **sdk:** the native module flushes, releases and forgets a shop's customer on the native SDKs — flush, releaseShop and deleteUserCredentials take the shop and settle as the native methods do, and a released shop is no longer told to JavaScript; nothing in the SDK's JavaScript uses them yet (8fa9e55)
* **sdk:** the native module starts a shop through the native SDKs' bridge entry (Android 2.52.0, iOS 3.39.0) and hands over the A/B group JavaScript kept; the stored group follows the native one (6353277)
* **sdk:** the package is 5.0.0-0, so the merge's patch bump publishes 5.0.0 (401f444)
* **sdk:** the pushes match the contract — PushEvent is also the type of an event, delivered, opened, clicked or closed, PersonaClick.handlePush resolves with the shop the push went to or null and tracks nothing for a push without id and type, notifications.setPushToken takes hms on Android and refuses apns there as hms on iOS, and notifications.getHistory resolves with NotificationHistory, the server's status and the messages, an empty text of a message null on both platforms (bb55427)
* **sdk:** the rest of the contract closes in the bridge — notifications.setCallbacks and PersonaClick.setPushCallbacks hear each push the SDK handles as PushPayload once its event was accepted, once per event of a message, and onToken the tokens its own registration gets; getPushToken also knows the token the native SDK kept from an earlier start, read with the shop's snapshot; PersonaClick.setLogHandler hands the app the native SDKs' log messages as SdkLogMessage through the module's PersonaClickLog event; sendAdvertisingId reaches the native config; slider and agentSearch go to the module, which refuses them in NamespaceArgs.sourceOf until the native SDKs have them; an agent message without an id keeps a null one and a loyalty level without a code is none; Product, ProductCategory and ProductsListResponse are the contract's and 4.x's take the Legacy names; popupPresentationDelegate and the deprecated initPush are declared; the console log of requests comes only with debug and never carries the request's data, the push token or the /init answer (b4fa4a3)
* **sdk:** the root is the contract's — PersonaClick.instance and PersonaClick.register beside the released getInstance and registerShops, a lookup the app gets wrong throws a PersonaClickError of type unknownShop or ambiguousShop that the released UnknownShopIdError and AmbiguousShopError extend, initialize of a live shop returns it and keeps its configuration, the instance has shopId, deviceId and sessionId null while there is none, state and onStateChange, and PersonaClickConfig takes logLevel with debug as its deprecated form, deviceId, sendAdvertisingId, enableAutoPopupPresentation, needReInitialization and storageKey for the native SDK (777c2ea)
* **sdk:** tracking.purchase takes the contract's PurchaseTrackingRequest — the order and its PurchaseItem lines without quantity, the attribution as the call's source — and hands the native SDK, or the request sent from JavaScript, only the contract's fields with a warning about the others, while the deprecated trackPurchase takes 4.x's request as LegacyPurchaseTrackingRequest and sends it whole as before (8e0903e)
* **sdk:** TrackingSourceType has slider and agentSearch, as the contract has them — without the native module they are sent, with it an event or setSource with one is refused with invalidArgument before the module, since the native SDKs' TrackingSourceType has neither yet, and the earlier track with such a recommended_by goes through the native queue as it is (cd7011e)
* **sdk:** typings for getProductInfo and getProductsList (160026c)
* **sdk:** with the native module a shop runs on the native SDK: its init, device id and session come from it, and tracking goes through its queue on disk — the contract's tracking namespace and the earlier track methods alike (bcb1e61)
* **sdk:** with the native module every namespace of the contract is sdk.<namespace>.<method> on the native SDK, tracking calls the native tracking methods instead of building its events, and the earlier methods delegate to the namespaces with the results they gave (a597a60)
* **sdk:** with the native module the push events and the token go to the native SDK — the events through the shop's queue once per message, with the A/B group and no session, the token by the week's rule with platform and push_provider as the platform has them — and a push of a shop not started in the process through its native push handling on Android; receiving stays in JavaScript and now installs its handlers before the permission and the token, tracks a dismissal as closed and a tap also when the app's callback takes it, keeps the push's own data in the notification it draws, reads src of a direct APNs push, and sets a background handler as the SDK is imported (08a1af6)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)
* **ui:** built-in stories icons when renderIcon is absent (787e423)
* **ui:** card press, product press passthrough, title button toggles (9a5154c)
* **ui:** category screen on the core shared with search results (8ac2488)
* **ui:** data-bound recommender block over the products block (033e802)
* **ui:** design system tokens and base components (525e59d)
* **ui:** empty state in the catalogue (e107a01)
* **ui:** filter values show their title and product count (d05c8da)
* **ui:** in-app popup component (3ceac52)
* **ui:** in-memory request cache for the data widgets (b6d7688)
* **ui:** instant search and filters screens, text link (1ccc794)
* **ui:** instant search field and search results screen bound to the SDK (a069588)
* **ui:** internal load state for the data widgets with retry (1b32d00)
* **ui:** move the design system off the package root to internal/ui (477cc3f)
* **ui:** one mapper from API product to the kit product (224a8b8)
* **ui:** polls on stories V2 slides over API v3 (d7c0d0c)
* **ui:** popups v3 — native rendering of the new popup builder's designs (a0402a0)
* **ui:** price bounds as placeholders in the search filters (93418e9)
* **ui:** product card follows the image aspect, carousel old price 16/24 (47c9140)
* **ui:** product card, product image and favorites badge (d62caf0), closes #E51919
* **ui:** product lists and recommender block (1b45599)
* **ui:** products block without a title row, showRating passed on (338cbc7)
* **ui:** recommender card button sets the dynamic source too (c8a19c6)
* **ui:** result screens show the ten most common facets first (fef630f)
* **ui:** search results show an error with Retry (279ed8f)
* **ui:** search suggestions and catalogue screen, plus the arrow-rotate-cw icon (673f568)
* **ui:** share link opens the shared slide, product campaigns too (5ded24f)
* **ui:** showRating flag, off by default on SearchResultsScreen (8363583)
* **ui:** stories polls restyled to the reference — frosted card, lettered options, results header and vote count (210123a)
* **ui:** stories tokens, speaker and large angle icons, colour scheme override (2853311)
* **ui:** stories v2 components (a886edc)
* **ui:** stories v2 gif slides last at least one loop (a763444)
* **ui:** stories v2 optional clipboard, volume and safe-area modules (3f0a973)
* **ui:** stories V2 share button and opening a campaign by link over API v3 (d2861c0)
* **ui:** stories v2 typings follow the shared API names (03bdbcc)
* **ui:** stories v2 viewer and widget (364807c)
* **ui:** stories v2 viewer on the state machine: fitted media, video timing, retry, sound, gestures (e69f9dd)
* **ui:** stories v2 viewer state machine and shared-rule mapping (5b891c2)
* **ui:** stories v2 widget keeps seen slides per shop, tracks the stories source and opens programmatically (449f9de)
* **ui:** the UI kit opens to apps at @personaclick/react-native-sdk/ui; popups v3 and stories over API v3 move behind their own internal/v3 entry (8a0f0fd)
* **ui:** theme provider so a host can rebrand the design system (6ee13d2)
* **ui:** toast and loyalty card (629900c)


### Performance Improvements

* **sdk:** a v3 stories feed reuses the did it was loaded with instead of queueing for it again, and reads the saved poll answers and the mute choice at once (625e88c)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



# 5.0.0 (2026-11-20)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* a failed init no longer leaves SDK calls hanging, init is retried (78e7816)
* a refused init stops the shop's requests for the session (c2515f3)
* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* axios 0.34.0 for GHSA-x97p-jq2g-jp4f (a267f81)
* **deps:** bump axios to 0.33.0 (de5d23b)
* **deps:** widen firebase peer range to support host v24 (7aababe)
* **gcm:** message variability (544eb08)
* init waits for the network, retries only transient failures, a refusal is final (40fb344)
* **request:** keep reserved characters in query values (85bdcbc)
* **sdk:** a call made right after deleteUserCredentials waits until the wipe is over on both platforms — Android starts its wipe after the native call returns, so a tracking event accepted meanwhile was wiped with the forgotten customer, where iOS's tracking line keeps it for the next one; JavaScript now hands the calls made after the wipe to the native module once it settled, and a failed wipe holds back nothing (f32c632)
* **sdk:** a native deleteUserCredentials that fails no longer leaves the shop's JavaScript calls waiting — the device id, the session and the queue's state taken before the wipe come back, unless the native SDK told another device id meanwhile, and the calls made while it ran go with the customer they had (90b82bc)
* **sdk:** a push's code and type are strings wherever the SDK reads them — PushPayloadParser.typeAndCode writes a number as one, as the iOS parser does, and reads an id sent as { id } — and the default tap handling reads the push's event as it came, an APNs object or an FCM JSON string, and takes a direct APNs push without a message id as its own push, by its src, instead of the first push kept (c7c4119)
* **sdk:** a registered shop's push is drawn at once — its delivered event goes as it comes and is not waited for before the notification, opened follows delivered, and the headless task waits for the two at most ten seconds, so a request that hangs neither delays the push nor holds the task (e6dc838)
* **sdk:** a server popup of the native SDK is shown as it comes, since Android 2.55.0 and iOS 3.41.0 hand it over once its delay passed, so it no longer waits its delay twice; a popup this JavaScript gets itself, without the native module, still waits it (3ce8f0f)
* **sdk:** a server popup the native module held reaches its own shop — JavaScript keeps one subscription for every shop's popups and hands each to the listeners of its shop, and a popup no listener of its shop hears yet, the native replay to the first shop's listener among them, waits up to a minute for that shop's instance instead of being dropped; a released shop's held popups go (ec7155d)
* **sdk:** a shop registered without an instance sends the push events JavaScript sends for it to its apiDomain — PersonaClick.register hands the shop's hosts to the requests at once, as its instance will, and leaves a live instance its own (c86f97d)
* **sdk:** every promise of the Android module settles whatever its native call throws — the body of each method with a promise rejects with invalidArgument on any exception, as iOS does for an unexpected error, and a result the maps cannot hand over rejects with decoding — so the shop's start and the calls that wait for it can no longer hang (2d094c3)
* **sdk:** flush and deleteUserCredentials keep the order of the tracking calls around them — on iOS both run on the shop's tracking line, as Android's queue orders them, so a flush sends the events sent before it and a wipe takes them while the events sent after it wait for the next customer, and JavaScript hands both to the native module one step after the start, as a namespace's call, so a call made after them no longer overtakes them (8351d64)
* **sdk:** flush resolves with nothing on both platforms: Android's module answered null (cf349fb)
* **sdk:** getProbabilityToPurchase asks API v3 on the account host and reads the prediction from payload: the old path answers 503 (c1350f4)
* **sdk:** on Android the popups held while JavaScript could not hear them go to it in the order they came (703c772)
* **sdk:** on iOS a shop's tracking events reach its queue in the order JavaScript sent them: each waits on the shop's line for the one before it to be accepted or refused instead of starting in a task of its own, the banners, popupShown, the raw queue event and setSource with them; a refused event holds back none, and releaseShop drops the shop's line (4173090)
* **sdk:** parsed products read numbers sent as strings (77d607b)
* **sdk:** product categories read the parent from parent_id (0044da9)
* **sdk:** product typings admit what the parser passes through (93aa732)
* **sdk:** recommend, search and tracking send the device's A/B segment, as Android, iOS and the JS SDK do; a recommender block under an A/B test no longer answers an error (f6c1954)
* **sdk:** review() without a channel sends the channel of the app's platform — android_app on Android, ios_app on iOS — where 4.x read the stream and sent ios_app for any stream but android, the default react-native too (ee8700f)
* **sdk:** Segment.type is a string on both platforms, empty when the server gives a segment none, as Android 2.55.0 and iOS 3.41.0 have it, and the module's maps take the native models whose agent message id may be null and whose agent product reason is never null (7cd7d3e)
* **sdk:** stories.get hands over a slide's and a text block's style the block does not set as "", as the contract and both native SDKs have it, in place of null (d659a31)
* **sdk:** the account's host by default is built from the API's address — the API's host with app. for api. — in place of the literal app.personaclick.ru, for the purchase prediction and for popups v3 alike, so the mirror's build, whose rules rewrite the API's address whole but would turn the literal into a host that does not exist, gets its own account host; the tests that pin the default host build it the same way (a51c7b6)
* **sdk:** the deprecated trackEvent sends what 4.0.26 sent — built as 4.x built it and handed to the native queue's raw push/custom entry, so a value or time with a fraction or past 32 bits is no longer refused — and tracking.custom takes time and value as whole 32-bit numbers on Android, iOS and without the native module alike, the range Android's native custom holds (3c663bb)
* **sdk:** the deprecated trackSource stores what 4.x stored — with the native module a source it takes goes there with the code as a string and replaces one kept 4.x's way, and a source the native SDKs do not take yet, slider, agent_search, an unknown type or an empty code, is stored in 4.x's keys instead of being dropped and moves to the native SDK at a later start once it takes it, within its 48 hours; what stays different is in Migrating to 5.0 (f876a21)
* **sdk:** the earlier data methods behave as in 4.0.26 with the native module too — they send their own requests from JavaScript with the parameters they are given and resolve with the server's answer and its errors as before, only the device id, the session and the A/B group are the native SDK's — pinned by a parity test against 4.0.26's requests and results; apiDomain and appDomain reach the JavaScript requests too (c670894)
* **sdk:** the iOS module compiles on the old architecture without the codegen spec — PersonaClickNative.mm takes the spec, its conformance and getTurboModule only where the new architecture is on or the spec was generated, and is a plain event emitter otherwise, so the SDK runs in JavaScript there as the README says (cdce601)
* **sdk:** the popups of the native SDK's answers are shown by JavaScript as 4.0 showed its own — the native SDK draws none and hands each one over as the server sent it, so <SdkPopupOverlay> shows it, or the app's popupPresentationDelegate gets it, and it is reported shown through the native tracking; one that comes while JavaScript cannot hear it waits a minute for it (c8dd65a)
* **sdk:** the prediction's client_id is typed as the number API v3 sends (e7a6bfd)
* **sdk:** the push token 4.x kept in AsyncStorage goes to the native SDK on its start, unless the native SDK has it already — the app's push registration finds the kept token and sends nothing, so without this the native SDK never knew the shop's token, neither for getPushToken nor for its weekly resend (f122b69)
* **sdk:** the same answer gives the same models on Android and iOS — profile.get has an empty map for no custom properties, the server's [] too, profile.getOrders and its lines' products have null where a released model kept "" or 0 for none and taxFree false, a history message's campaignId is null for none and its statistics false, iOS reads an order product's discount as Android does and keeps its sales rate's shortest form — and the deprecated trackPurchase sends an attribution the two native purchases take differently, web_push_digest among them, as 4.0.26 sent it, through the native queue on both (e593b56)
* **sdk:** the SDK's Notifee background handler no longer replaces the app's — Notifee keeps one, so the SDK wraps notifee.onBackgroundEvent as it is imported and a handler the app sets afterwards runs beside the SDK's: both hear every event, the event's result is the app's, and the SDK's handling of its own notifications still runs when the app's fails (ddbbb91)
* **sdk:** track() keeps its place among the tracking calls made around it — every call of the native module takes its turn when the app makes it and is handed over once the calls before it were, so a track whose fields are still being built holds the tracking.*, setSource and namespace calls made after it instead of being overtaken by them, and a call that fails holds back none (1ab9424)
* **sdk:** tracking in the story viewer no longer gets in the way of a tap: a product tap no longer throws a TypeError before its link opens, and a failed click or view no longer leaves an unhandled rejection (5ac1291)
* **ui:** a popup link the host opened itself closes the popup without close, as a product does (c9f904b)
* **ui:** a request in flight can no longer lock a cache key (b2e2223)
* **ui:** badge text stays on one line (c8d2be3)
* **ui:** cards in a row share a baseline, loader replaces count and load more (1769a51)
* **ui:** carousel dots are off by default (0128338)
* **ui:** data widgets treat an SDK answer that is an error as a failure (799a313)
* **ui:** discount badge only for a positive discount (7e0e783)
* **ui:** filters keep the title and buttons in place while sections scroll (b5cf762)
* **ui:** follow the design file — button radii, LG height, input fill, loader slot (286df2b), closes #F2F2F2
* **ui:** in-app popup cross, buttons and shadow as in the finished design (168b864)
* **ui:** instant search clear cross clears the query (431ce56)
* **ui:** instant search treats an SDK answer that is an error as one (1097fef)
* **ui:** load state turns a throwing isEmpty or onChange into Error (bb88386)
* **ui:** long card prices put the old price above the price (44e1c49)
* **ui:** narrow list card moves the button under the price (e93002b)
* **ui:** popup picture shown whole, cross on a card-coloured disc (d4d668f)
* **ui:** popups v3 keep to their design in a dark system theme — the consent checkbox takes the form's colors, kit blocks the theme of the popup's background (c953fbe)
* **ui:** request cache keys keep dates, maps, sets and separators apart (c2c6e46)
* **ui:** result count stays hidden until the first page answers (fc38a73)
* **ui:** search results fall back to default error and Retry texts (407e0dd)
* **ui:** search results show "no results" only when there are none (da034d0)
* **ui:** SearchResultsScreen drops answers that arrive after unmount (37e455b)
* **ui:** stories v2 crosses out the regular price only above the promo price (fdbaca1)
* **ui:** stories v2 drop repeated story ids (ffb7403)
* **ui:** stories v2 follow the shared rules (f039d41)
* **ui:** stories V2 global API v3 host applies, no stuck pauses in the viewer (f71481e)
* **ui:** stories v2 long promo code shrinks instead of squeezing the price (fabe665)
* **ui:** stories v2 media slides are the ones with a background (297e144)
* **ui:** stories v2 open pages inside the open viewer, pause without a viewer is a no-op (7f76074)
* **ui:** stories v2 product card shows the promo code of the slide's text block (e6307e4)
* **ui:** stories v2 product picture no longer opens the product (849c6bf)
* **ui:** stories v2 product picture tap opens the product (61a23a8)
* **ui:** stories v2 promo price crosses oldprice only above the regular price (53e9773)
* **ui:** stories v2 readiness and video retry timers freeze in background (c9f2d77)
* **ui:** stories v2 restart keeps the media and seeks the video to 0 (3757659)
* **ui:** stories v2 show() reports an empty block and starts an unknown story id at the first (05e9c17)
* **ui:** stories v2 taps outside the open sheet only close it (6aaf333)
* **ui:** stories v2 viewed ring and centred products toggle (79aac99)
* **ui:** text block of stories V2 stays between the header and the buttons, like a poll (6e9ad77)
* **ui:** tokens follow the design file's variables again (96a5879), closes #F2F2F2 #0D0D0 #1A1A1 #0D0D0


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* overlay layers in SdkPopupOverlay and an ambiguous-shop check for widgets (8100a75)
* **push:** single process-wide router that routes pushes by shop_id (5c0d88d)
* **rn:** multi-instance push routing, per-shop identity, demo + E2E (10e1641)
* **sdk:** a native module brings a shop up on the native Android and iOS SDKs' new core and tells JavaScript its state, device id and session; nothing in the SDK's JavaScript uses it yet (8c8c082)
* **sdk:** a popup with no known position comes out fullscreen (4099996)
* **sdk:** a shop whose app names no stream runs as react-native on both platforms, as the contract has it — the native SDK starts it so, and the requests JavaScript still sends for it carry it, a registered shop and its push sent from JavaScript too; an app's own stream is kept, and without the native module the SDK sends what 4.x sent (8b03e27)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** enableAutoPopupPresentation — off, the SDK shows no popups of its own (server ones and popups v3 of triggers); may be changed at any time (e3c93be)
* **sdk:** getCategory params typed, price and sorting included (feea30f)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** on Android a tracking call settles once the native queue took the event, as on iOS: the module tracks through the bridges' tracking.queued of the Android SDK, pinned to its commit until v2.54.0, so an event the server refuses later no longer rejects it, and a tracking promise resolves with nothing on both platforms (cfebe5e)
* **sdk:** on iOS the notification history carries what it carries on Android — the module hands the answer's status and each message's channel, campaignId and statistics as Android's does, on the iOS SDK pinned to its revision until 3.41.0 — and the types say a message's fields are on both platforms and its statistics are booleans (5ba04f4)
* **sdk:** parsed products carry deeplinkAndroid and discount fields (ae447ee)
* **sdk:** partition per-shop UI state — stories-viewed and popup overlay (4b73088)
* **sdk:** products list keeps the categories of the answer (106f9bc)
* **sdk:** public multi-instance facade and push handoff (0f0d3bb)
* **sdk:** registry and pure resolvers, register each instance by shop_id (0bd3c18)
* **sdk:** rm jest (d0cce5d)
* **sdk:** send gift_package on purchase (dfeaa23)
* **sdk:** sid token generation (4a34846)
* **sdk:** slider and agentSearch reach the native SDKs as their bridge-only raw sources — NamespaceArgs.sourceOf builds them with TrackingSource.fromWire on Android and TrackingSource(rawType:code:) on iOS, so an event's source, setSource and a purchase's recommendedBy go with slider and agent_search instead of being refused; the deprecated trackSource hands them to the native SDK and a start moves a stored one there, track sends them through the native tracking methods and trackPurchase through the native purchase (3679a3f)
* **sdk:** the instance has flush, release and deleteUserCredentials of the contract: release stops it for good and every later call rejects with notInitialized, deleteUserCredentials forgets the customer in the native SDK and in what JavaScript still keeps — its device id and session, the stored identity, the source, the push token's date, the recent searches — and the push token goes to the next device id; without the native module JavaScript does the same itself (d530f2c)
* **sdk:** the namespaces are typed for apps — sdk.products, sdk.search and the rest with the contract's models, the earlier methods marked deprecated with their replacements — and notifications.setPushToken reports the provider the token was registered with (b0f1077)
* **sdk:** the namespaces' models are the contract's — a field the contract always fills is typed without null in stories, sliders, loyalty, reviews, the search agent and the product counters, clientId of the purchase prediction is a string, an order's sums are strings and its line's product an OrderProduct whose fields may be null, Query, ColorFilter, SizeFilter and ProductCounterTriggers are named, loyalty's currentTime is HH:MM, and on both platforms stories.get gives null for the style a block does not set and the search agent an empty reason for a product without one (bdf1ff4)
* **sdk:** the native module calls every namespace of the native SDKs (Android 2.53.0, iOS 3.40.0) through typed methods and hands their models to JavaScript as maps with the contract's field names; nothing in the SDK's JavaScript uses them yet (ef80133)
* **sdk:** the native module flushes, releases and forgets a shop's customer on the native SDKs — flush, releaseShop and deleteUserCredentials take the shop and settle as the native methods do, and a released shop is no longer told to JavaScript; nothing in the SDK's JavaScript uses them yet (8fa9e55)
* **sdk:** the native module starts a shop through the native SDKs' bridge entry (Android 2.52.0, iOS 3.39.0) and hands over the A/B group JavaScript kept; the stored group follows the native one (6353277)
* **sdk:** the package is 5.0.0-0, so the merge's patch bump publishes 5.0.0 (401f444)
* **sdk:** the pushes match the contract — PushEvent is also the type of an event, delivered, opened, clicked or closed, PersonaClick.handlePush resolves with the shop the push went to or null and tracks nothing for a push without id and type, notifications.setPushToken takes hms on Android and refuses apns there as hms on iOS, and notifications.getHistory resolves with NotificationHistory, the server's status and the messages, an empty text of a message null on both platforms (bb55427)
* **sdk:** the rest of the contract closes in the bridge — notifications.setCallbacks and PersonaClick.setPushCallbacks hear each push the SDK handles as PushPayload once its event was accepted, once per event of a message, and onToken the tokens its own registration gets; getPushToken also knows the token the native SDK kept from an earlier start, read with the shop's snapshot; PersonaClick.setLogHandler hands the app the native SDKs' log messages as SdkLogMessage through the module's PersonaClickLog event; sendAdvertisingId reaches the native config; slider and agentSearch go to the module, which refuses them in NamespaceArgs.sourceOf until the native SDKs have them; an agent message without an id keeps a null one and a loyalty level without a code is none; Product, ProductCategory and ProductsListResponse are the contract's and 4.x's take the Legacy names; popupPresentationDelegate and the deprecated initPush are declared; the console log of requests comes only with debug and never carries the request's data, the push token or the /init answer (b4fa4a3)
* **sdk:** the root is the contract's — PersonaClick.instance and PersonaClick.register beside the released getInstance and registerShops, a lookup the app gets wrong throws a PersonaClickError of type unknownShop or ambiguousShop that the released UnknownShopIdError and AmbiguousShopError extend, initialize of a live shop returns it and keeps its configuration, the instance has shopId, deviceId and sessionId null while there is none, state and onStateChange, and PersonaClickConfig takes logLevel with debug as its deprecated form, deviceId, sendAdvertisingId, enableAutoPopupPresentation, needReInitialization and storageKey for the native SDK (777c2ea)
* **sdk:** tracking.purchase takes the contract's PurchaseTrackingRequest — the order and its PurchaseItem lines without quantity, the attribution as the call's source — and hands the native SDK, or the request sent from JavaScript, only the contract's fields with a warning about the others, while the deprecated trackPurchase takes 4.x's request as LegacyPurchaseTrackingRequest and sends it whole as before (8e0903e)
* **sdk:** TrackingSourceType has slider and agentSearch, as the contract has them — without the native module they are sent, with it an event or setSource with one is refused with invalidArgument before the module, since the native SDKs' TrackingSourceType has neither yet, and the earlier track with such a recommended_by goes through the native queue as it is (cd7011e)
* **sdk:** typings for getProductInfo and getProductsList (160026c)
* **sdk:** with the native module a shop runs on the native SDK: its init, device id and session come from it, and tracking goes through its queue on disk — the contract's tracking namespace and the earlier track methods alike (bcb1e61)
* **sdk:** with the native module every namespace of the contract is sdk.<namespace>.<method> on the native SDK, tracking calls the native tracking methods instead of building its events, and the earlier methods delegate to the namespaces with the results they gave (a597a60)
* **sdk:** with the native module the push events and the token go to the native SDK — the events through the shop's queue once per message, with the A/B group and no session, the token by the week's rule with platform and push_provider as the platform has them — and a push of a shop not started in the process through its native push handling on Android; receiving stays in JavaScript and now installs its handlers before the permission and the token, tracks a dismissal as closed and a tap also when the app's callback takes it, keeps the push's own data in the notification it draws, reads src of a direct APNs push, and sets a background handler as the SDK is imported (08a1af6)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)
* **ui:** built-in stories icons when renderIcon is absent (787e423)
* **ui:** card press, product press passthrough, title button toggles (9a5154c)
* **ui:** category screen on the core shared with search results (8ac2488)
* **ui:** data-bound recommender block over the products block (033e802)
* **ui:** design system tokens and base components (525e59d)
* **ui:** empty state in the catalogue (e107a01)
* **ui:** filter values show their title and product count (d05c8da)
* **ui:** in-app popup component (3ceac52)
* **ui:** in-memory request cache for the data widgets (b6d7688)
* **ui:** instant search and filters screens, text link (1ccc794)
* **ui:** instant search field and search results screen bound to the SDK (a069588)
* **ui:** internal load state for the data widgets with retry (1b32d00)
* **ui:** move the design system off the package root to internal/ui (477cc3f)
* **ui:** one mapper from API product to the kit product (224a8b8)
* **ui:** polls on stories V2 slides over API v3 (d7c0d0c)
* **ui:** popups v3 — native rendering of the new popup builder's designs (a0402a0)
* **ui:** price bounds as placeholders in the search filters (93418e9)
* **ui:** product card follows the image aspect, carousel old price 16/24 (47c9140)
* **ui:** product card, product image and favorites badge (d62caf0), closes #E51919
* **ui:** product lists and recommender block (1b45599)
* **ui:** products block without a title row, showRating passed on (338cbc7)
* **ui:** recommender card button sets the dynamic source too (c8a19c6)
* **ui:** result screens show the ten most common facets first (fef630f)
* **ui:** search results show an error with Retry (279ed8f)
* **ui:** search suggestions and catalogue screen, plus the arrow-rotate-cw icon (673f568)
* **ui:** share link opens the shared slide, product campaigns too (5ded24f)
* **ui:** showRating flag, off by default on SearchResultsScreen (8363583)
* **ui:** stories polls restyled to the reference — frosted card, lettered options, results header and vote count (210123a)
* **ui:** stories tokens, speaker and large angle icons, colour scheme override (2853311)
* **ui:** stories v2 components (a886edc)
* **ui:** stories v2 gif slides last at least one loop (a763444)
* **ui:** stories v2 optional clipboard, volume and safe-area modules (3f0a973)
* **ui:** stories V2 share button and opening a campaign by link over API v3 (d2861c0)
* **ui:** stories v2 typings follow the shared API names (03bdbcc)
* **ui:** stories v2 viewer and widget (364807c)
* **ui:** stories v2 viewer on the state machine: fitted media, video timing, retry, sound, gestures (e69f9dd)
* **ui:** stories v2 viewer state machine and shared-rule mapping (5b891c2)
* **ui:** stories v2 widget keeps seen slides per shop, tracks the stories source and opens programmatically (449f9de)
* **ui:** the UI kit opens to apps at @personaclick/react-native-sdk/ui; popups v3 and stories over API v3 move behind their own internal/v3 entry (8a0f0fd)
* **ui:** theme provider so a host can rebrand the design system (6ee13d2)
* **ui:** toast and loyalty card (629900c)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.26 (2026-11-12)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* a failed init no longer leaves SDK calls hanging, init is retried (78e7816)
* a refused init stops the shop's requests for the session (c2515f3)
* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* axios 0.34.0 for GHSA-x97p-jq2g-jp4f (a267f81)
* **deps:** bump axios to 0.33.0 (de5d23b)
* **deps:** widen firebase peer range to support host v24 (7aababe)
* **gcm:** message variability (544eb08)
* init waits for the network, retries only transient failures, a refusal is final (40fb344)
* **request:** keep reserved characters in query values (85bdcbc)
* **sdk:** parsed products read numbers sent as strings (77d607b)
* **sdk:** product categories read the parent from parent_id (0044da9)
* **sdk:** product typings admit what the parser passes through (93aa732)
* **sdk:** recommend, search and tracking send the device's A/B segment, as Android, iOS and the JS SDK do; a recommender block under an A/B test no longer answers an error (f6c1954)
* **sdk:** tracking in the story viewer no longer gets in the way of a tap: a product tap no longer throws a TypeError before its link opens, and a failed click or view no longer leaves an unhandled rejection (5ac1291)
* **ui:** a popup link the host opened itself closes the popup without close, as a product does (c9f904b)
* **ui:** a request in flight can no longer lock a cache key (b2e2223)
* **ui:** badge text stays on one line (c8d2be3)
* **ui:** cards in a row share a baseline, loader replaces count and load more (1769a51)
* **ui:** carousel dots are off by default (0128338)
* **ui:** data widgets treat an SDK answer that is an error as a failure (799a313)
* **ui:** discount badge only for a positive discount (7e0e783)
* **ui:** filters keep the title and buttons in place while sections scroll (b5cf762)
* **ui:** follow the design file — button radii, LG height, input fill, loader slot (286df2b), closes #F2F2F2
* **ui:** in-app popup cross, buttons and shadow as in the finished design (168b864)
* **ui:** instant search clear cross clears the query (431ce56)
* **ui:** instant search treats an SDK answer that is an error as one (1097fef)
* **ui:** load state turns a throwing isEmpty or onChange into Error (bb88386)
* **ui:** long card prices put the old price above the price (44e1c49)
* **ui:** narrow list card moves the button under the price (e93002b)
* **ui:** popup picture shown whole, cross on a card-coloured disc (d4d668f)
* **ui:** popups v3 keep to their design in a dark system theme — the consent checkbox takes the form's colors, kit blocks the theme of the popup's background (c953fbe)
* **ui:** request cache keys keep dates, maps, sets and separators apart (c2c6e46)
* **ui:** result count stays hidden until the first page answers (fc38a73)
* **ui:** search results fall back to default error and Retry texts (407e0dd)
* **ui:** search results show "no results" only when there are none (da034d0)
* **ui:** SearchResultsScreen drops answers that arrive after unmount (37e455b)
* **ui:** stories v2 crosses out the regular price only above the promo price (fdbaca1)
* **ui:** stories v2 drop repeated story ids (ffb7403)
* **ui:** stories v2 follow the shared rules (f039d41)
* **ui:** stories V2 global API v3 host applies, no stuck pauses in the viewer (f71481e)
* **ui:** stories v2 long promo code shrinks instead of squeezing the price (fabe665)
* **ui:** stories v2 media slides are the ones with a background (297e144)
* **ui:** stories v2 open pages inside the open viewer, pause without a viewer is a no-op (7f76074)
* **ui:** stories v2 product card shows the promo code of the slide's text block (e6307e4)
* **ui:** stories v2 product picture no longer opens the product (849c6bf)
* **ui:** stories v2 product picture tap opens the product (61a23a8)
* **ui:** stories v2 promo price crosses oldprice only above the regular price (53e9773)
* **ui:** stories v2 readiness and video retry timers freeze in background (c9f2d77)
* **ui:** stories v2 restart keeps the media and seeks the video to 0 (3757659)
* **ui:** stories v2 show() reports an empty block and starts an unknown story id at the first (05e9c17)
* **ui:** stories v2 taps outside the open sheet only close it (6aaf333)
* **ui:** stories v2 viewed ring and centred products toggle (79aac99)
* **ui:** text block of stories V2 stays between the header and the buttons, like a poll (6e9ad77)
* **ui:** tokens follow the design file's variables again (96a5879), closes #F2F2F2 #0D0D0 #1A1A1 #0D0D0


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* overlay layers in SdkPopupOverlay and an ambiguous-shop check for widgets (8100a75)
* **push:** single process-wide router that routes pushes by shop_id (5c0d88d)
* **rn:** multi-instance push routing, per-shop identity, demo + E2E (10e1641)
* **sdk:** a popup with no known position comes out fullscreen (4099996)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** enableAutoPopupPresentation — off, the SDK shows no popups of its own (server ones and popups v3 of triggers); may be changed at any time (e3c93be)
* **sdk:** getCategory params typed, price and sorting included (feea30f)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** parsed products carry deeplinkAndroid and discount fields (ae447ee)
* **sdk:** partition per-shop UI state — stories-viewed and popup overlay (4b73088)
* **sdk:** products list keeps the categories of the answer (106f9bc)
* **sdk:** public multi-instance facade and push handoff (0f0d3bb)
* **sdk:** registry and pure resolvers, register each instance by shop_id (0bd3c18)
* **sdk:** rm jest (d0cce5d)
* **sdk:** send gift_package on purchase (dfeaa23)
* **sdk:** sid token generation (4a34846)
* **sdk:** typings for getProductInfo and getProductsList (160026c)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)
* **ui:** built-in stories icons when renderIcon is absent (787e423)
* **ui:** card press, product press passthrough, title button toggles (9a5154c)
* **ui:** category screen on the core shared with search results (8ac2488)
* **ui:** data-bound recommender block over the products block (033e802)
* **ui:** design system tokens and base components (525e59d)
* **ui:** empty state in the catalogue (e107a01)
* **ui:** filter values show their title and product count (d05c8da)
* **ui:** in-app popup component (3ceac52)
* **ui:** in-memory request cache for the data widgets (b6d7688)
* **ui:** instant search and filters screens, text link (1ccc794)
* **ui:** instant search field and search results screen bound to the SDK (a069588)
* **ui:** internal load state for the data widgets with retry (1b32d00)
* **ui:** move the design system off the package root to internal/ui (477cc3f)
* **ui:** one mapper from API product to the kit product (224a8b8)
* **ui:** polls on stories V2 slides over API v3 (d7c0d0c)
* **ui:** popups v3 — native rendering of the new popup builder's designs (a0402a0)
* **ui:** price bounds as placeholders in the search filters (93418e9)
* **ui:** product card follows the image aspect, carousel old price 16/24 (47c9140)
* **ui:** product card, product image and favorites badge (d62caf0), closes #E51919
* **ui:** product lists and recommender block (1b45599)
* **ui:** products block without a title row, showRating passed on (338cbc7)
* **ui:** recommender card button sets the dynamic source too (c8a19c6)
* **ui:** result screens show the ten most common facets first (fef630f)
* **ui:** search results show an error with Retry (279ed8f)
* **ui:** search suggestions and catalogue screen, plus the arrow-rotate-cw icon (673f568)
* **ui:** share link opens the shared slide, product campaigns too (5ded24f)
* **ui:** showRating flag, off by default on SearchResultsScreen (8363583)
* **ui:** stories polls restyled to the reference — frosted card, lettered options, results header and vote count (210123a)
* **ui:** stories tokens, speaker and large angle icons, colour scheme override (2853311)
* **ui:** stories v2 components (a886edc)
* **ui:** stories v2 gif slides last at least one loop (a763444)
* **ui:** stories v2 optional clipboard, volume and safe-area modules (3f0a973)
* **ui:** stories V2 share button and opening a campaign by link over API v3 (d2861c0)
* **ui:** stories v2 typings follow the shared API names (03bdbcc)
* **ui:** stories v2 viewer and widget (364807c)
* **ui:** stories v2 viewer on the state machine: fitted media, video timing, retry, sound, gestures (e69f9dd)
* **ui:** stories v2 viewer state machine and shared-rule mapping (5b891c2)
* **ui:** stories v2 widget keeps seen slides per shop, tracks the stories source and opens programmatically (449f9de)
* **ui:** the UI kit opens to apps at @personaclick/react-native-sdk/ui; popups v3 and stories over API v3 move behind their own internal/v3 entry (8a0f0fd)
* **ui:** theme provider so a host can rebrand the design system (6ee13d2)
* **ui:** toast and loyalty card (629900c)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.25 (2026-11-10)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* a failed init no longer leaves SDK calls hanging, init is retried (78e7816)
* a refused init stops the shop's requests for the session (c2515f3)
* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* axios 0.34.0 for GHSA-x97p-jq2g-jp4f (a267f81)
* **deps:** bump axios to 0.33.0 (de5d23b)
* **deps:** widen firebase peer range to support host v24 (7aababe)
* **gcm:** message variability (544eb08)
* init waits for the network, retries only transient failures, a refusal is final (40fb344)
* **request:** keep reserved characters in query values (85bdcbc)
* **sdk:** parsed products read numbers sent as strings (77d607b)
* **sdk:** product categories read the parent from parent_id (0044da9)
* **sdk:** product typings admit what the parser passes through (93aa732)
* **sdk:** recommend, search and tracking send the device's A/B segment, as Android, iOS and the JS SDK do; a recommender block under an A/B test no longer answers an error (f6c1954)
* **ui:** a popup link the host opened itself closes the popup without close, as a product does (c9f904b)
* **ui:** a request in flight can no longer lock a cache key (b2e2223)
* **ui:** badge text stays on one line (c8d2be3)
* **ui:** cards in a row share a baseline, loader replaces count and load more (1769a51)
* **ui:** carousel dots are off by default (0128338)
* **ui:** data widgets treat an SDK answer that is an error as a failure (799a313)
* **ui:** discount badge only for a positive discount (7e0e783)
* **ui:** filters keep the title and buttons in place while sections scroll (b5cf762)
* **ui:** follow the design file — button radii, LG height, input fill, loader slot (286df2b), closes #F2F2F2
* **ui:** in-app popup cross, buttons and shadow as in the finished design (168b864)
* **ui:** instant search clear cross clears the query (431ce56)
* **ui:** instant search treats an SDK answer that is an error as one (1097fef)
* **ui:** load state turns a throwing isEmpty or onChange into Error (bb88386)
* **ui:** long card prices put the old price above the price (44e1c49)
* **ui:** narrow list card moves the button under the price (e93002b)
* **ui:** popup picture shown whole, cross on a card-coloured disc (d4d668f)
* **ui:** popups v3 keep to their design in a dark system theme — the consent checkbox takes the form's colors, kit blocks the theme of the popup's background (c953fbe)
* **ui:** request cache keys keep dates, maps, sets and separators apart (c2c6e46)
* **ui:** result count stays hidden until the first page answers (fc38a73)
* **ui:** search results fall back to default error and Retry texts (407e0dd)
* **ui:** search results show "no results" only when there are none (da034d0)
* **ui:** SearchResultsScreen drops answers that arrive after unmount (37e455b)
* **ui:** stories v2 crosses out the regular price only above the promo price (fdbaca1)
* **ui:** stories v2 drop repeated story ids (ffb7403)
* **ui:** stories v2 follow the shared rules (f039d41)
* **ui:** stories V2 global API v3 host applies, no stuck pauses in the viewer (f71481e)
* **ui:** stories v2 long promo code shrinks instead of squeezing the price (fabe665)
* **ui:** stories v2 media slides are the ones with a background (297e144)
* **ui:** stories v2 open pages inside the open viewer, pause without a viewer is a no-op (7f76074)
* **ui:** stories v2 product card shows the promo code of the slide's text block (e6307e4)
* **ui:** stories v2 product picture no longer opens the product (849c6bf)
* **ui:** stories v2 product picture tap opens the product (61a23a8)
* **ui:** stories v2 promo price crosses oldprice only above the regular price (53e9773)
* **ui:** stories v2 readiness and video retry timers freeze in background (c9f2d77)
* **ui:** stories v2 restart keeps the media and seeks the video to 0 (3757659)
* **ui:** stories v2 show() reports an empty block and starts an unknown story id at the first (05e9c17)
* **ui:** stories v2 taps outside the open sheet only close it (6aaf333)
* **ui:** stories v2 viewed ring and centred products toggle (79aac99)
* **ui:** text block of stories V2 stays between the header and the buttons, like a poll (6e9ad77)
* **ui:** tokens follow the design file's variables again (96a5879), closes #F2F2F2 #0D0D0 #1A1A1 #0D0D0


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* overlay layers in SdkPopupOverlay and an ambiguous-shop check for widgets (8100a75)
* **push:** single process-wide router that routes pushes by shop_id (5c0d88d)
* **rn:** multi-instance push routing, per-shop identity, demo + E2E (10e1641)
* **sdk:** a popup with no known position comes out fullscreen (4099996)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** enableAutoPopupPresentation — off, the SDK shows no popups of its own (server ones and popups v3 of triggers); may be changed at any time (e3c93be)
* **sdk:** getCategory params typed, price and sorting included (feea30f)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** parsed products carry deeplinkAndroid and discount fields (ae447ee)
* **sdk:** partition per-shop UI state — stories-viewed and popup overlay (4b73088)
* **sdk:** products list keeps the categories of the answer (106f9bc)
* **sdk:** public multi-instance facade and push handoff (0f0d3bb)
* **sdk:** registry and pure resolvers, register each instance by shop_id (0bd3c18)
* **sdk:** rm jest (d0cce5d)
* **sdk:** send gift_package on purchase (dfeaa23)
* **sdk:** sid token generation (4a34846)
* **sdk:** typings for getProductInfo and getProductsList (160026c)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)
* **ui:** built-in stories icons when renderIcon is absent (787e423)
* **ui:** card press, product press passthrough, title button toggles (9a5154c)
* **ui:** category screen on the core shared with search results (8ac2488)
* **ui:** data-bound recommender block over the products block (033e802)
* **ui:** design system tokens and base components (525e59d)
* **ui:** empty state in the catalogue (e107a01)
* **ui:** filter values show their title and product count (d05c8da)
* **ui:** in-app popup component (3ceac52)
* **ui:** in-memory request cache for the data widgets (b6d7688)
* **ui:** instant search and filters screens, text link (1ccc794)
* **ui:** instant search field and search results screen bound to the SDK (a069588)
* **ui:** internal load state for the data widgets with retry (1b32d00)
* **ui:** move the design system off the package root to internal/ui (477cc3f)
* **ui:** one mapper from API product to the kit product (224a8b8)
* **ui:** polls on stories V2 slides over API v3 (d7c0d0c)
* **ui:** popups v3 — native rendering of the new popup builder's designs (a0402a0)
* **ui:** price bounds as placeholders in the search filters (93418e9)
* **ui:** product card follows the image aspect, carousel old price 16/24 (47c9140)
* **ui:** product card, product image and favorites badge (d62caf0), closes #E51919
* **ui:** product lists and recommender block (1b45599)
* **ui:** products block without a title row, showRating passed on (338cbc7)
* **ui:** recommender card button sets the dynamic source too (c8a19c6)
* **ui:** result screens show the ten most common facets first (fef630f)
* **ui:** search results show an error with Retry (279ed8f)
* **ui:** search suggestions and catalogue screen, plus the arrow-rotate-cw icon (673f568)
* **ui:** share link opens the shared slide, product campaigns too (5ded24f)
* **ui:** showRating flag, off by default on SearchResultsScreen (8363583)
* **ui:** stories polls restyled to the reference — frosted card, lettered options, results header and vote count (210123a)
* **ui:** stories tokens, speaker and large angle icons, colour scheme override (2853311)
* **ui:** stories v2 components (a886edc)
* **ui:** stories v2 gif slides last at least one loop (a763444)
* **ui:** stories v2 optional clipboard, volume and safe-area modules (3f0a973)
* **ui:** stories V2 share button and opening a campaign by link over API v3 (d2861c0)
* **ui:** stories v2 typings follow the shared API names (03bdbcc)
* **ui:** stories v2 viewer and widget (364807c)
* **ui:** stories v2 viewer on the state machine: fitted media, video timing, retry, sound, gestures (e69f9dd)
* **ui:** stories v2 viewer state machine and shared-rule mapping (5b891c2)
* **ui:** stories v2 widget keeps seen slides per shop, tracks the stories source and opens programmatically (449f9de)
* **ui:** the UI kit opens to apps at @personaclick/react-native-sdk/ui; popups v3 and stories over API v3 move behind their own internal/v3 entry (8a0f0fd)
* **ui:** theme provider so a host can rebrand the design system (6ee13d2)
* **ui:** toast and loyalty card (629900c)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.24 (2026-11-09)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* a failed init no longer leaves SDK calls hanging, init is retried (78e7816)
* a refused init stops the shop's requests for the session (c2515f3)
* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* axios 0.34.0 for GHSA-x97p-jq2g-jp4f (a267f81)
* **deps:** bump axios to 0.33.0 (de5d23b)
* **deps:** widen firebase peer range to support host v24 (7aababe)
* **gcm:** message variability (544eb08)
* init waits for the network, retries only transient failures, a refusal is final (40fb344)
* **request:** keep reserved characters in query values (85bdcbc)
* **sdk:** parsed products read numbers sent as strings (77d607b)
* **sdk:** product categories read the parent from parent_id (0044da9)
* **sdk:** product typings admit what the parser passes through (93aa732)
* **ui:** a popup link the host opened itself closes the popup without close, as a product does (c9f904b)
* **ui:** a request in flight can no longer lock a cache key (b2e2223)
* **ui:** badge text stays on one line (c8d2be3)
* **ui:** cards in a row share a baseline, loader replaces count and load more (1769a51)
* **ui:** carousel dots are off by default (0128338)
* **ui:** data widgets treat an SDK answer that is an error as a failure (799a313)
* **ui:** discount badge only for a positive discount (7e0e783)
* **ui:** filters keep the title and buttons in place while sections scroll (b5cf762)
* **ui:** follow the design file — button radii, LG height, input fill, loader slot (286df2b), closes #F2F2F2
* **ui:** in-app popup cross, buttons and shadow as in the finished design (168b864)
* **ui:** instant search clear cross clears the query (431ce56)
* **ui:** instant search treats an SDK answer that is an error as one (1097fef)
* **ui:** load state turns a throwing isEmpty or onChange into Error (bb88386)
* **ui:** long card prices put the old price above the price (44e1c49)
* **ui:** narrow list card moves the button under the price (e93002b)
* **ui:** popup picture shown whole, cross on a card-coloured disc (d4d668f)
* **ui:** popups v3 keep to their design in a dark system theme — the consent checkbox takes the form's colors, kit blocks the theme of the popup's background (c953fbe)
* **ui:** request cache keys keep dates, maps, sets and separators apart (c2c6e46)
* **ui:** result count stays hidden until the first page answers (fc38a73)
* **ui:** search results fall back to default error and Retry texts (407e0dd)
* **ui:** search results show "no results" only when there are none (da034d0)
* **ui:** SearchResultsScreen drops answers that arrive after unmount (37e455b)
* **ui:** stories v2 crosses out the regular price only above the promo price (fdbaca1)
* **ui:** stories v2 drop repeated story ids (ffb7403)
* **ui:** stories v2 follow the shared rules (f039d41)
* **ui:** stories V2 global API v3 host applies, no stuck pauses in the viewer (f71481e)
* **ui:** stories v2 long promo code shrinks instead of squeezing the price (fabe665)
* **ui:** stories v2 media slides are the ones with a background (297e144)
* **ui:** stories v2 open pages inside the open viewer, pause without a viewer is a no-op (7f76074)
* **ui:** stories v2 product card shows the promo code of the slide's text block (e6307e4)
* **ui:** stories v2 product picture no longer opens the product (849c6bf)
* **ui:** stories v2 product picture tap opens the product (61a23a8)
* **ui:** stories v2 promo price crosses oldprice only above the regular price (53e9773)
* **ui:** stories v2 readiness and video retry timers freeze in background (c9f2d77)
* **ui:** stories v2 restart keeps the media and seeks the video to 0 (3757659)
* **ui:** stories v2 show() reports an empty block and starts an unknown story id at the first (05e9c17)
* **ui:** stories v2 taps outside the open sheet only close it (6aaf333)
* **ui:** stories v2 viewed ring and centred products toggle (79aac99)
* **ui:** text block of stories V2 stays between the header and the buttons, like a poll (6e9ad77)
* **ui:** tokens follow the design file's variables again (96a5879), closes #F2F2F2 #0D0D0 #1A1A1 #0D0D0


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* overlay layers in SdkPopupOverlay and an ambiguous-shop check for widgets (8100a75)
* **push:** single process-wide router that routes pushes by shop_id (5c0d88d)
* **rn:** multi-instance push routing, per-shop identity, demo + E2E (10e1641)
* **sdk:** a popup with no known position comes out fullscreen (4099996)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** enableAutoPopupPresentation — off, the SDK shows no popups of its own (server ones and popups v3 of triggers); may be changed at any time (e3c93be)
* **sdk:** getCategory params typed, price and sorting included (feea30f)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** parsed products carry deeplinkAndroid and discount fields (ae447ee)
* **sdk:** partition per-shop UI state — stories-viewed and popup overlay (4b73088)
* **sdk:** products list keeps the categories of the answer (106f9bc)
* **sdk:** public multi-instance facade and push handoff (0f0d3bb)
* **sdk:** registry and pure resolvers, register each instance by shop_id (0bd3c18)
* **sdk:** rm jest (d0cce5d)
* **sdk:** send gift_package on purchase (dfeaa23)
* **sdk:** sid token generation (4a34846)
* **sdk:** typings for getProductInfo and getProductsList (160026c)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)
* **ui:** built-in stories icons when renderIcon is absent (787e423)
* **ui:** card press, product press passthrough, title button toggles (9a5154c)
* **ui:** category screen on the core shared with search results (8ac2488)
* **ui:** data-bound recommender block over the products block (033e802)
* **ui:** design system tokens and base components (525e59d)
* **ui:** empty state in the catalogue (e107a01)
* **ui:** filter values show their title and product count (d05c8da)
* **ui:** in-app popup component (3ceac52)
* **ui:** in-memory request cache for the data widgets (b6d7688)
* **ui:** instant search and filters screens, text link (1ccc794)
* **ui:** instant search field and search results screen bound to the SDK (a069588)
* **ui:** internal load state for the data widgets with retry (1b32d00)
* **ui:** move the design system off the package root to internal/ui (477cc3f)
* **ui:** one mapper from API product to the kit product (224a8b8)
* **ui:** polls on stories V2 slides over API v3 (d7c0d0c)
* **ui:** popups v3 — native rendering of the new popup builder's designs (a0402a0)
* **ui:** price bounds as placeholders in the search filters (93418e9)
* **ui:** product card follows the image aspect, carousel old price 16/24 (47c9140)
* **ui:** product card, product image and favorites badge (d62caf0), closes #E51919
* **ui:** product lists and recommender block (1b45599)
* **ui:** products block without a title row, showRating passed on (338cbc7)
* **ui:** recommender card button sets the dynamic source too (c8a19c6)
* **ui:** result screens show the ten most common facets first (fef630f)
* **ui:** search results show an error with Retry (279ed8f)
* **ui:** search suggestions and catalogue screen, plus the arrow-rotate-cw icon (673f568)
* **ui:** share link opens the shared slide, product campaigns too (5ded24f)
* **ui:** showRating flag, off by default on SearchResultsScreen (8363583)
* **ui:** stories polls restyled to the reference — frosted card, lettered options, results header and vote count (210123a)
* **ui:** stories tokens, speaker and large angle icons, colour scheme override (2853311)
* **ui:** stories v2 components (a886edc)
* **ui:** stories v2 gif slides last at least one loop (a763444)
* **ui:** stories v2 optional clipboard, volume and safe-area modules (3f0a973)
* **ui:** stories V2 share button and opening a campaign by link over API v3 (d2861c0)
* **ui:** stories v2 typings follow the shared API names (03bdbcc)
* **ui:** stories v2 viewer and widget (364807c)
* **ui:** stories v2 viewer on the state machine: fitted media, video timing, retry, sound, gestures (e69f9dd)
* **ui:** stories v2 viewer state machine and shared-rule mapping (5b891c2)
* **ui:** stories v2 widget keeps seen slides per shop, tracks the stories source and opens programmatically (449f9de)
* **ui:** the UI kit opens to apps at @personaclick/react-native-sdk/ui; popups v3 and stories over API v3 move behind their own internal/v3 entry (8a0f0fd)
* **ui:** theme provider so a host can rebrand the design system (6ee13d2)
* **ui:** toast and loyalty card (629900c)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.23 (2026-10-21)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* a failed init no longer leaves SDK calls hanging, init is retried (78e7816)
* a refused init stops the shop's requests for the session (c2515f3)
* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* axios 0.34.0 for GHSA-x97p-jq2g-jp4f (a267f81)
* **deps:** bump axios to 0.33.0 (de5d23b)
* **deps:** widen firebase peer range to support host v24 (7aababe)
* **gcm:** message variability (544eb08)
* init waits for the network, retries only transient failures, a refusal is final (40fb344)
* **request:** keep reserved characters in query values (85bdcbc)
* **ui:** cards in a row share a baseline, loader replaces count and load more (1769a51)
* **ui:** follow the design file — button radii, LG height, input fill, loader slot (286df2b), closes #F2F2F2
* **ui:** in-app popup cross, buttons and shadow as in the finished design (168b864)
* **ui:** instant search clear cross clears the query (431ce56)
* **ui:** popup picture shown whole, cross on a card-coloured disc (d4d668f)
* **ui:** search results show "no results" only when there are none (da034d0)
* **ui:** stories v2 crosses out the regular price only above the promo price (fdbaca1)
* **ui:** stories v2 drop repeated story ids (ffb7403)
* **ui:** stories v2 follow the shared rules (f039d41)
* **ui:** stories v2 long promo code shrinks instead of squeezing the price (fabe665)
* **ui:** stories v2 media slides are the ones with a background (297e144)
* **ui:** stories v2 open pages inside the open viewer, pause without a viewer is a no-op (7f76074)
* **ui:** stories v2 product card shows the promo code of the slide's text block (e6307e4)
* **ui:** stories v2 product picture no longer opens the product (849c6bf)
* **ui:** stories v2 product picture tap opens the product (61a23a8)
* **ui:** stories v2 promo price crosses oldprice only above the regular price (53e9773)
* **ui:** stories v2 readiness and video retry timers freeze in background (c9f2d77)
* **ui:** stories v2 restart keeps the media and seeks the video to 0 (3757659)
* **ui:** stories v2 show() reports an empty block and starts an unknown story id at the first (05e9c17)
* **ui:** stories v2 taps outside the open sheet only close it (6aaf333)
* **ui:** stories v2 viewed ring and centred products toggle (79aac99)
* **ui:** tokens follow the design file's variables again (96a5879), closes #F2F2F2 #0D0D0 #1A1A1 #0D0D0


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* overlay layers in SdkPopupOverlay and an ambiguous-shop check for widgets (8100a75)
* **push:** single process-wide router that routes pushes by shop_id (5c0d88d)
* **rn:** multi-instance push routing, per-shop identity, demo + E2E (10e1641)
* **sdk:** a popup with no known position comes out fullscreen (4099996)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** partition per-shop UI state — stories-viewed and popup overlay (4b73088)
* **sdk:** public multi-instance facade and push handoff (0f0d3bb)
* **sdk:** registry and pure resolvers, register each instance by shop_id (0bd3c18)
* **sdk:** rm jest (d0cce5d)
* **sdk:** send gift_package on purchase (dfeaa23)
* **sdk:** sid token generation (4a34846)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)
* **ui:** built-in stories icons when renderIcon is absent (787e423)
* **ui:** card press, product press passthrough, title button toggles (9a5154c)
* **ui:** design system tokens and base components (525e59d)
* **ui:** empty state in the catalogue (e107a01)
* **ui:** in-app popup component (3ceac52)
* **ui:** instant search and filters screens, text link (1ccc794)
* **ui:** instant search field and search results screen bound to the SDK (a069588)
* **ui:** move the design system off the package root to internal/ui (477cc3f)
* **ui:** price bounds as placeholders in the search filters (93418e9)
* **ui:** product card follows the image aspect, carousel old price 16/24 (47c9140)
* **ui:** product card, product image and favorites badge (d62caf0), closes #E51919
* **ui:** product lists and recommender block (1b45599)
* **ui:** search suggestions and catalogue screen, plus the arrow-rotate-cw icon (673f568)
* **ui:** stories tokens, speaker and large angle icons, colour scheme override (2853311)
* **ui:** stories v2 components (a886edc)
* **ui:** stories v2 gif slides last at least one loop (a763444)
* **ui:** stories v2 optional clipboard, volume and safe-area modules (3f0a973)
* **ui:** stories v2 typings follow the shared API names (03bdbcc)
* **ui:** stories v2 viewer and widget (364807c)
* **ui:** stories v2 viewer on the state machine: fitted media, video timing, retry, sound, gestures (e69f9dd)
* **ui:** stories v2 viewer state machine and shared-rule mapping (5b891c2)
* **ui:** stories v2 widget keeps seen slides per shop, tracks the stories source and opens programmatically (449f9de)
* **ui:** theme provider so a host can rebrand the design system (6ee13d2)
* **ui:** toast and loyalty card (629900c)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.22 (2026-10-20)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* a failed init no longer leaves SDK calls hanging, init is retried (78e7816)
* a refused init stops the shop's requests for the session (c2515f3)
* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* axios 0.34.0 for GHSA-x97p-jq2g-jp4f (a267f81)
* **deps:** bump axios to 0.33.0 (de5d23b)
* **deps:** widen firebase peer range to support host v24 (7aababe)
* **gcm:** message variability (544eb08)
* init waits for the network, retries only transient failures, a refusal is final (40fb344)
* **request:** keep reserved characters in query values (85bdcbc)
* **ui:** cards in a row share a baseline, loader replaces count and load more (1769a51)
* **ui:** follow the design file — button radii, LG height, input fill, loader slot (286df2b), closes #F2F2F2
* **ui:** in-app popup cross, buttons and shadow as in the finished design (168b864)
* **ui:** instant search clear cross clears the query (431ce56)
* **ui:** popup picture shown whole, cross on a card-coloured disc (d4d668f)
* **ui:** search results show "no results" only when there are none (da034d0)
* **ui:** tokens follow the design file's variables again (96a5879), closes #F2F2F2 #0D0D0 #1A1A1 #0D0D0


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* **push:** single process-wide router that routes pushes by shop_id (5c0d88d)
* **rn:** multi-instance push routing, per-shop identity, demo + E2E (10e1641)
* **sdk:** a popup with no known position comes out fullscreen (4099996)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** partition per-shop UI state — stories-viewed and popup overlay (4b73088)
* **sdk:** public multi-instance facade and push handoff (0f0d3bb)
* **sdk:** registry and pure resolvers, register each instance by shop_id (0bd3c18)
* **sdk:** rm jest (d0cce5d)
* **sdk:** send gift_package on purchase (dfeaa23)
* **sdk:** sid token generation (4a34846)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)
* **ui:** card press, product press passthrough, title button toggles (9a5154c)
* **ui:** design system tokens and base components (525e59d)
* **ui:** empty state in the catalogue (e107a01)
* **ui:** in-app popup component (3ceac52)
* **ui:** instant search and filters screens, text link (1ccc794)
* **ui:** instant search field and search results screen bound to the SDK (a069588)
* **ui:** move the design system off the package root to internal/ui (477cc3f)
* **ui:** price bounds as placeholders in the search filters (93418e9)
* **ui:** product card follows the image aspect, carousel old price 16/24 (47c9140)
* **ui:** product card, product image and favorites badge (d62caf0), closes #E51919
* **ui:** product lists and recommender block (1b45599)
* **ui:** search suggestions and catalogue screen, plus the arrow-rotate-cw icon (673f568)
* **ui:** theme provider so a host can rebrand the design system (6ee13d2)
* **ui:** toast and loyalty card (629900c)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.21 (2026-10-13)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* a failed init no longer leaves SDK calls hanging, init is retried (78e7816)
* a refused init stops the shop's requests for the session (c2515f3)
* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* axios 0.34.0 for GHSA-x97p-jq2g-jp4f (a267f81)
* **deps:** bump axios to 0.33.0 (de5d23b)
* **deps:** widen firebase peer range to support host v24 (7aababe)
* **gcm:** message variability (544eb08)
* init waits for the network, retries only transient failures, a refusal is final (40fb344)
* **request:** keep reserved characters in query values (85bdcbc)
* **ui:** cards in a row share a baseline, loader replaces count and load more (1769a51)
* **ui:** follow the design file — button radii, LG height, input fill, loader slot (286df2b), closes #F2F2F2
* **ui:** in-app popup cross, buttons and shadow as in the finished design (168b864)
* **ui:** instant search clear cross clears the query (431ce56)
* **ui:** search results show "no results" only when there are none (da034d0)
* **ui:** tokens follow the design file's variables again (96a5879), closes #F2F2F2 #0D0D0 #1A1A1 #0D0D0


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* **push:** single process-wide router that routes pushes by shop_id (5c0d88d)
* **rn:** multi-instance push routing, per-shop identity, demo + E2E (10e1641)
* **sdk:** a popup with no known position comes out fullscreen (4099996)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** partition per-shop UI state — stories-viewed and popup overlay (4b73088)
* **sdk:** public multi-instance facade and push handoff (0f0d3bb)
* **sdk:** registry and pure resolvers, register each instance by shop_id (0bd3c18)
* **sdk:** rm jest (d0cce5d)
* **sdk:** send gift_package on purchase (dfeaa23)
* **sdk:** sid token generation (4a34846)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)
* **ui:** card press, product press passthrough, title button toggles (9a5154c)
* **ui:** design system tokens and base components (525e59d)
* **ui:** empty state in the catalogue (e107a01)
* **ui:** in-app popup component (3ceac52)
* **ui:** instant search and filters screens, text link (1ccc794)
* **ui:** instant search field and search results screen bound to the SDK (a069588)
* **ui:** move the design system off the package root to internal/ui (477cc3f)
* **ui:** price bounds as placeholders in the search filters (93418e9)
* **ui:** product card follows the image aspect, carousel old price 16/24 (47c9140)
* **ui:** product card, product image and favorites badge (d62caf0), closes #E51919
* **ui:** product lists and recommender block (1b45599)
* **ui:** search suggestions and catalogue screen, plus the arrow-rotate-cw icon (673f568)
* **ui:** theme provider so a host can rebrand the design system (6ee13d2)
* **ui:** toast and loyalty card (629900c)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.20 (2026-09-30)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **deps:** bump axios to 0.33.0 (de5d23b)
* **deps:** widen firebase peer range to support host v24 (7aababe)
* **gcm:** message variability (544eb08)
* **request:** keep reserved characters in query values (85bdcbc)
* **ui:** cards in a row share a baseline, loader replaces count and load more (1769a51)
* **ui:** follow the design file — button radii, LG height, input fill, loader slot (286df2b), closes #F2F2F2
* **ui:** in-app popup cross, buttons and shadow as in the finished design (168b864)
* **ui:** instant search clear cross clears the query (431ce56)
* **ui:** search results show "no results" only when there are none (da034d0)
* **ui:** tokens follow the design file's variables again (96a5879), closes #F2F2F2 #0D0D0 #1A1A1 #0D0D0


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* **push:** single process-wide router that routes pushes by shop_id (5c0d88d)
* **rn:** multi-instance push routing, per-shop identity, demo + E2E (10e1641)
* **sdk:** a popup with no known position comes out fullscreen (4099996)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** partition per-shop UI state — stories-viewed and popup overlay (4b73088)
* **sdk:** public multi-instance facade and push handoff (0f0d3bb)
* **sdk:** registry and pure resolvers, register each instance by shop_id (0bd3c18)
* **sdk:** rm jest (d0cce5d)
* **sdk:** send gift_package on purchase (dfeaa23)
* **sdk:** sid token generation (4a34846)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)
* **ui:** card press, product press passthrough, title button toggles (9a5154c)
* **ui:** design system tokens and base components (525e59d)
* **ui:** empty state in the catalogue (e107a01)
* **ui:** in-app popup component (3ceac52)
* **ui:** instant search and filters screens, text link (1ccc794)
* **ui:** instant search field and search results screen bound to the SDK (a069588)
* **ui:** move the design system off the package root to internal/ui (477cc3f)
* **ui:** price bounds as placeholders in the search filters (93418e9)
* **ui:** product card follows the image aspect, carousel old price 16/24 (47c9140)
* **ui:** product card, product image and favorites badge (d62caf0), closes #E51919
* **ui:** product lists and recommender block (1b45599)
* **ui:** search suggestions and catalogue screen, plus the arrow-rotate-cw icon (673f568)
* **ui:** theme provider so a host can rebrand the design system (6ee13d2)
* **ui:** toast and loyalty card (629900c)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.19 (2026-09-03)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **deps:** bump axios to 0.33.0 (de5d23b)
* **deps:** widen firebase peer range to support host v24 (7aababe)
* **gcm:** message variability (544eb08)


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* **push:** single process-wide router that routes pushes by shop_id (5c0d88d)
* **rn:** multi-instance push routing, per-shop identity, demo + E2E (10e1641)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** partition per-shop UI state — stories-viewed and popup overlay (4b73088)
* **sdk:** public multi-instance facade and push handoff (0f0d3bb)
* **sdk:** registry and pure resolvers, register each instance by shop_id (0bd3c18)
* **sdk:** rm jest (d0cce5d)
* **sdk:** send gift_package on purchase (dfeaa23)
* **sdk:** sid token generation (4a34846)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.18 (2026-08-17)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **deps:** bump axios to 0.33.0 (de5d23b)
* **deps:** widen firebase peer range to support host v24 (7aababe)
* **gcm:** message variability (544eb08)


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* **push:** single process-wide router that routes pushes by shop_id (5c0d88d)
* **rn:** multi-instance push routing, per-shop identity, demo + E2E (10e1641)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** partition per-shop UI state — stories-viewed and popup overlay (4b73088)
* **sdk:** public multi-instance facade and push handoff (0f0d3bb)
* **sdk:** registry and pure resolvers, register each instance by shop_id (0bd3c18)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.17 (2026-07-17)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)
* **stories:** StoriesList opens the built-in StoryViewer itself (696e78e)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.16 (2026-07-16)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)
* **stories:** expose StoriesList/StoryViewer via /stories subpath (3b7bf5d)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.15 (2026-06-26)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* add product counters, category and collection methods; parse profile response (dc7e886)
* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.14 (2026-06-22)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.13 (2026-06-17)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.12 (2026-05-13)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.11 (2026-04-27)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.10 (2026-04-22)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.9 (2026-04-22)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## Unreleased

### Features

* **sdk:** strict purchase tracking — `trackPurchase(request)` with typed `PurchaseTrackingRequest` / `PurchaseItemRequest` (camelCase API, snake_case only on the wire). Client-side validation; `tax_free` is sent only when `isTaxFree` is `true`; optional keys are omitted when unset. Demo app and Detox harness: `trackPurchase_minimal` / `trackPurchase_full`.

### Deprecations

* **sdk:** `track('purchase', …)` — use `trackPurchase` instead; the legacy path logs a one-time migration warning.

### Migration

Replace legacy `track('purchase', data)` with `trackPurchase({ orderId, orderPrice, items })` where each item has required `id`, `amount` (integer > 0), and `price` (finite number). Map `data.order` → `orderId`, `data.order_price` → `orderPrice`, and `data.products` → `items` (ensure each product supplies `amount` and `price`; the old `products`/`quantity`-only shape is not equivalent to the strict contract).

## 4.0.8 (2026-04-15)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.7 (2026-04-09)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.6 (2026-02-24)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.5 (2026-02-04)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.4 (2026-01-28)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.3 (2026-01-23)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* add .js extensions to ESM imports in tests and mock native modules (41317ad)
* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.2 (2025-12-09)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 4.0.1 (2025-10-27)


* [DEV-359] feat!(main): support expo apps, rm native module. Kudos https://github.com/ahmetkuslular (dc9762c)


### Bug Fixes

* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)


### BREAKING CHANGES

* rm react-native-device-info, dynamically import if
needed



## 3.1.3 (2025-08-22)


### Bug Fixes

* **gcm:** message variability (544eb08)


### Features

* **common:** bump version (ce7e70d)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** in-app push notifications (#51) (6fa0296)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)



## 3.1.2 (2025-08-22)


### Bug Fixes

* **gcm:** message variability (544eb08)
* **sdk:** sid logic (#43) (570c075)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add blank search method (#40) (ff10756)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add excluded_merchants property to search types (#46) (0912cee)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* check image_url (#44) (0cfcfab)
* **common:** bump version (ce7e70d)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** include types for exclude_brands (#50) (cd1d301)
* **sdk:** remove notifee (71e7e79)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 3.1.1 (2025-08-22)


### Bug Fixes

* **gcm:** message variability (544eb08)
* **sdk:** sid logic (#43) (570c075)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add blank search method (#40) (ff10756)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add excluded_merchants property to search types (#46) (0912cee)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* check image_url (#44) (0cfcfab)
* **common:** bump version (ce7e70d)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** bump device-info (1d1f10e)
* **sdk:** getToken to use correct token (d07df14)
* **sdk:** remove notifee (71e7e79)
* **sdk:** rm jest (d0cce5d)
* **sdk:** sid token generation (4a34846)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 3.0.1 (2025-08-20)


### Bug Fixes

* **gcm:** message variability (544eb08)
* **sdk:** sid logic (#43) (570c075)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add blank search method (#40) (ff10756)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add excluded_merchants property to search types (#46) (0912cee)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* check image_url (#44) (0cfcfab)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** remove notifee (71e7e79)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 2.0.6 (2025-06-18)


### Bug Fixes

* **gcm:** message variability (544eb08)
* **sdk:** sid logic (#43) (570c075)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add blank search method (#40) (ff10756)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add excluded_merchants property to search types (#46) (0912cee)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* check image_url (#44) (0cfcfab)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** remove notifee (71e7e79)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 2.0.5 (2024-12-26)


### Bug Fixes

* **sdk:** sid logic (#43) (570c075)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add blank search method (#40) (ff10756)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add excluded_merchants property to search types (#46) (0912cee)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* check image_url (#44) (0cfcfab)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** remove notifee (71e7e79)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 2.0.4 (2024-12-11)


### Bug Fixes

* **sdk:** sid logic (#43) (570c075)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add blank search method (#40) (ff10756)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* check image_url (#44) (0cfcfab)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** remove notifee (71e7e79)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 2.0.3 (2024-12-05)


### Bug Fixes

* **sdk:** sid logic (#43) (570c075)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add blank search method (#40) (ff10756)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* check image_url (#44) (0cfcfab)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** remove notifee (71e7e79)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 2.0.2 (2024-11-22)


### Bug Fixes

* **sdk:** sid logic (#43) (570c075)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add blank search method (#40) (ff10756)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** remove notifee (71e7e79)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 2.0.1 (2024-11-05)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add blank search method (#40) (ff10756)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** remove notifee (71e7e79)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 1.8.3 (2024-10-29)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add blank search method (#40) (ff10756)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** remove notifee (71e7e79)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 1.8.2 (2024-10-21)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add blank search method (#40) (ff10756)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** remove notifee (71e7e79)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 1.8.1 (2024-08-14)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** remove notifee (71e7e79)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 1.7.4 (2024-07-31)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* **sdk:** track mobile pushes (eadf5f4)
* swap auto-changelog for standard-changelog (ec88b46)



## 1.7.3 (2024-07-17)


### Features

* add array to track wish request (da7bc28)
* add autoSendPushToken argument (2826b68)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add date check (a9b7069)
* add function to send token after app initialization (7a7bd29)
* add functions to get and push token sent date in storage (75e5ce0)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* add types (ffec1d5)
* add types to functions (1cf1b75)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* check application initialization (152e928)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* swap auto-changelog for standard-changelog (ec88b46)



## 1.7.2 (2024-05-29)


### Features

* add array to track wish request (da7bc28)
* add cart method (7a0dd8b)
* add custom properties to track purchase request (d58f5af)
* add new action step to identify base commit in master (95930a9)
* add persona-synchronization.yaml (17ddf01)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* swap auto-changelog for standard-changelog (ec88b46)



## 1.7.1 (2024-05-09)


### Features

* add array to track wish request (da7bc28)
* add custom properties to track purchase request (d58f5af)
* add persona-synchronization.yaml (17ddf01)
* BREAKING CHANGE use @notifee/react-native for requesting alarm permissions (0e23088)



## 1.6.33 (2024-04-23)


### Features

* add new action step to identify base commit in master (95930a9)
* connect sdk to dev app (48788fa)
* move to sdk (85a1e1e)
* swap auto-changelog for standard-changelog (ec88b46)

#### 1.6.31

- Chore: test app config `#6`
- Feat: add react native sdk `#2`
- Feat: application for local development `#1`
- Fix: click event `#5`
- Feat: auto generating changelog on publish `#4`
- fix/click-notification-code `#2`
- Fix/push notification `#1`

<!-- auto-changelog-above -->
#### 1.5.7 (May 12, 2022)
##### Changes
* add Trigger subscription methods
* add debug log
* upd mobile push tracking

#### 1.5.6 (Feb 15, 2022)
##### Changes

* Update the event tracking to json format

##### Documentation Changes

* Update README.md
