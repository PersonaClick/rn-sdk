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
