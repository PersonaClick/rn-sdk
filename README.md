# PersonaClick React Native SDK

## Installation

PersonaClick React Native SDK is available through [GitHub](https://github.com/PersonaClick/rn-sdk.git). To install it, run next command in terminal:

```
yarn add @personaclick/rn-sdk
```

or

```
yarn add https://github.com/PersonaClick/rn-sdk.git
```

Also need added AsyncStorage plugin:

```
yarn add @react-native-async-storage/async-storage
```

and react-native-device-info

```
yarn add react-native-device-info
```

For push notification:

```
yarn add @react-native-firebase/app
yarn add @react-native-firebase/messaging
yarn add @notifee/react-native
```

## iOS Additional Installation

Open your `/ios/{projectName}/AppDelegate.m` file, and add the following:
At the top of the file, import the Firebase SDK:

```
#import <Firebase.h>
```

Open a terminal window and navigate to the location of the Xcode project for your app

```
cd ios/
pod install
```

Disable auto-registration the device

```json
// firebase.json
{
  "react-native": {
    "messaging_ios_auto_register_for_remote_messages": false
  }
}
```

On iOS, when a message is received the device silently starts your application in a background state. To get around this problem, you can configure your application. Use this property to conditionally render null ("nothing") if your app is launched in the background:

```js
// index.js
import { AppRegistry } from 'react-native'

function HeadlessCheck({ isHeadless }) {
  if (isHeadless) {
    // App has been launched in the background by iOS, ignore
    return null
  }

  return <App />
}

function App() {
  // Your application
}

AppRegistry.registerComponent('app', () => HeadlessCheck)
```

To inject a isHeadless prop into your app, please update your AppDelegate.m file as instructed below:

```
/ add this import statement at the top of your `AppDelegate.m` file
#import "RNFBMessagingModule.h"

// in "(BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions" method
// Use `addCustomPropsToUserProps` to pass in props for initialization of your app
// Or pass in `nil` if you have none as per below example
// For `withLaunchOptions` please pass in `launchOptions` object
NSDictionary *appProperties = [RNFBMessagingModule addCustomPropsToUserProps:nil withLaunchOptions:launchOptions];

// Find the `RCTRootView` instance and update the `initialProperties` with your `appProperties` instance
RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge
                                             moduleName:@"nameOfYourApp"
                                             initialProperties:appProperties];
```

#### iOS Background Limitation

If the iOS Background App Refresh mode is off, your handler configured in setBackgroundMessageHandler will not be triggered.

## Android Additional Installation

In your `android/build.gradle`

```gradle
buildscript {
    dependencies {
        ...
        //Add this \/
        classpath 'com.google.gms:google-services:4.3.4'
    }
```

In your `android/app/build.gradle` add

```gradle
apply plugin: 'com.google.gms.google-services'
```

in `android/app/src/main/AndroidManifest.xml` add

```gradle
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"
                     android:maxSdkVersion="32"/>
    <uses-permission android:name="android.permission.USE_EXACT_ALARM"
                     android:minSdkVersion="33"/>
```

# Usage

SDK is used for several tasks:

1. Initialize SDK and user's session
2. Events tracking
3. Track custom event
4. Track push
5. Product recommendations
6. Product search
7. Save profile settings
8. Init push
9. Set push token notification
10. Triggers
    1. Price drop
    2. Back in Stock
11. Segments
    1. Add user to a segment
    2. Remove user from a segment
    3. Get user segments

## Initialization

Initialize SDK object and use it anywhere in your application. (!) Remember to initialize SDK only once on application launch.

```js
import PersonaClick from '@personaclick/rn-sdk';

...
const rnsdk = new PersonaClick("YOUR_SHOP_ID", "Stream");
```

## Check init

```js
rnsdk.isInit() // returns true/false
```

## Events tracking

Track user's behavior to collect data. There are several types of events:

```js
// View product (simple way)
rnsdk.track('view', 37)

// View product (try to avoid it)
rnsdk.track('view', {
  id: 37,
  stock: true,
})

// View product after user clicked on recommender block
rnsdk.track('view', {
  id: PRODUCT_ID,
  recommended_by: 'dynamic',
  recommended_code: 'UNIQUE_RECOMMENDER_CODE',
})

// View product, after user clicked on search results
rnsdk.track('view', {
  id: PRODUCT_ID,
  recommended_by: 'full_search',
  recommended_code: QUERY_STRING,
})
// ... or instant search dropdown
rnsdk.track('view', {
  id: PRODUCT_ID,
  recommended_by: 'instant_search',
  recommended_code: QUERY_STRING,
})

// View category
rnsdk.track('category', 100500)

// Add product to cart (simple way)
rnsdk.track('cart', id)

// Add product to cart with amount and track recommender
rnsdk.track('cart', {
  id: PRODUCT_ID,
  amount: PRODUCT_AMOUNT,
  recommended_by: 'dynamic',
  recommended_code: 'UNIQUE_RECOMMENDER_CODE',
})

//Send the full current cart
rnsdk.track('cart', [
  {
    id: FIRST_PRODUCT_ID,
    amount: FIRST_PRODUCT_AMOUNT,
  },
  ...{
    id: LAST_PRODUCT_ID,
    amount: LAST_PRODUCT_AMOUNT,
  },
])

// Remove product from cart
rnsdk.track('remove_from_cart', id)

// Add product to favorities
rnsdk.track('wish', id)

// Remove product from favorities
rnsdk.track('remove_wish', id)

// Track purchase (several products)
rnsdk.track('purchase', {
  products: [
    { id: 37, price: 318, amount: 3 },
    { id: 187, price: 5000, amount: 1 },
  ],
  order: 'N318',
  order_price: 29999,
})

// Track user search
rnsdk.track('search', 'This is a search example')
```

## Track custom event

```js
// Simple tracking
rnsdk.trackEvent('my_event')

// Tracking with custom parameters
rnsdk.trackEvent('my_event', {
  category: 'event category',
  label: 'event label',
  value: 100,
})
```

## Track push notifications

```js
const params = {
  code: 'CODE',
  type: 'TYPE',
}
// Track user click notification
rnsdk.notificationClicked(params)

// Track Notification received
rnsdk.notificationReceived(params)
```

## Product search

```js
const type = 'instant_search' // full_search, ...

let search_query = 'your_search_text'

rnsdk
  .search({
    type: type,
    search_query: search_query,
    // other params
  })
  .then((res) => {
    console.log(res)
  })
```

## Product recommendations

```js
const recommender_code = 'recommender_code'

const params = {
  item: 100500,
  exclude: [3, 14, 159, 26535],
  search_query: 'To be or not to be',
  // other params
}

rnsdk.recommend(recommender_code, params).then((res) => {
  console.log(res)
})
```

## Save profile settings

```js
const params = {
  id: 100500,
  email: 'john.doe@examplemail.com',
  phone: '4400114527199',
  first_name: 'John',
  last_name: 'Doe',
  birthday: '1990-03-11',
  age: 31,
  gender: 'm',
  location: 'NY',
  bought_something: true,
  loyalty_id: '000001234567',
  loyalty_card_location: 'NY',
  loyalty_status: '5% discount',
  loyalty_bonuses: 1123,
  loyalty_bonuses_to_next_level: 1877,
  fb_id: '000000000354677',
  vk_id: 'vk031845',
  telegram_id: '0125762968357835',
  kids: [
    { gender: 'm', birthday: '2001-04-12' },
    { gender: 'f', birthday: '2015-07-28' },
  ],
  auto: [{ brand: 'Nissan', model: 'Qashqai', vds: 'TM7N243E4G0BJG978' }],
}

rnsdk.setProfile(params)
```

## Read profile info

```js
rnsdk.getProfile().then((res) => {
  console.log(res)
})
```

## Init push notification

```js
//Set use Firebase messaging only. Call this method before initPush;
rnsdk.firebase_only(true);

// Simple init
rnsdk.initPush();

//onClick listener
rnsdk.initPush(onClickCallback);

// onReceivetive listener
rnsdk.initPush(false, onReceiveCallback);

// you can use different callback for notification, when app is in background.
rnsdk.initPush(false, onReceiveCallback, onBackgroundReceiveCallback);
// If onBackgroundReceiveCallback not specified, used onReceiveCallback listener.

// onClickCallback params
{
  "data": {
    "body": "MESSAGE_BODY",
    "icon": "MESSAGE_ICON",
    "id": "MESSAGE_ID",
    "image": "MESSAGE_IMAGE",
    "title": "MESSAGE_TITLE",
    "type": "MESSAGE_TYPE"
  },
  "from": "MESSAGE_FROM",
  "messageId": "FMC_MESSAGE_ID",
  "sentTime": TIMESTAMP,
  "ttl": TTL_VALUE
}
// onReceiveCallBack, onBackgroundReceiveCallback params
{
  "data": {
    "action_urls": "[]",
    "actions": "[]",
    "body": "MESSAGE_BODY",
    "icon": "MESSAGE_ICON",
    "id": "MESSAGE_ID",
    "image": "MESSAGE_IMAGE",
    "title": "MESSAGE_TITLE",
    "type": "MESSAGE_TYPE"
  },
  "from": "MESSAGE_FROM",
  "messageId": "FMC_MESSAGE_ID",
  "sentTime": TIMESTAMP,
  "ttl": TTL_VALUE
}

```

### IMPORTANT! Сall initPush method on app initialization

## Set push token notification

```js
rnsdk.setPushTokenNotification('NEW_TOKEN')
```

## Triggers

### Price drop

```js
// Subscribing
rnsdk.triggers('subscribe_for_product_price', {
  email: 'John.Doe@store.com',
  item: '3323',
  price: 160,
})

// Unsubscribing from specific products
rnsdk.triggers('unsubscribe_from_product_price', {
  email: 'John.Doe@store.com',
  item_ids: [3323, 100500, 'ABCDEF'],
})

// Unsubscribing from all products
rnsdk.triggers('unsubscribe_from_product_price', {
  email: 'John.Doe@store.com',
  item_ids: [],
})
```

### Back in Stock

```js
// Subscribing
rnsdk.triggers('subscribe_for_product_available', {
  email: 'John.Doe@store.com',
  item: '3323',
  properties: { fashion_size: 'XL' },
})

// Unsubscribing from specific products
rnsdk.triggers('unsubscribe_from_product_available', {
  email: 'John.Doe@store.com',
  item_ids: [3323, 100500, 'ABCDEF'],
})

// Unsubscribing from all products
rnsdk.triggers('unsubscribe_from_product_available', {
  email: 'John.Doe@store.com',
  item_ids: [],
})
```

### Manage subscriptions

```js
// Subscribe user to all kids of email campaigns and SMS
rnsdk.subscriptions('manage', {
  email: 'my@example.com',
  phone: '+100000000000',
  email_bulk: true,
  email_chain: true,
  email_transactional: true,
  sms_bulk: true,
  sms_chain: true,
  sms_transactional: true,
})

// Change only specific subscriptions
rnsdk.subscriptions('manage', {
  email: 'my@example.com',
  phone: '+100000000000',
  email_chain: true,
  sms_bulk: true,
  sms_transactional: true,
})

// Change without phone
rnsdk.subscriptions('manage', {
  email: 'my@example.com',
  email_chain: true,
  sms_bulk: true,
  sms_transactional: true,
})
```

## Segments

### Add user to a segment

```js
// Using all possible identifiers
rnsdk.segments('add', {
  email: 'jane@example.com',
  phone: '+10000000000',
  segment_id: 'SEGMENT_ID',
})

// With phone only
rnsdk.segments('add', {
  phone: '+10000000000',
  segment_id: 'SEGMENT_ID',
})

// With email only
rnsdk.segments('add', {
  email: 'jane@example.com',
  segment_id: 'SEGMENT_ID',
})

// Without any contacts: `did` is used automatically
rnsdk.segments('add', {
  segment_id: 'SEGMENT_ID',
})
```

### Remove user from a segment

```js
// Using all possible identifiers
rnsdk.segments('remove', {
  email: 'jane@example.com',
  phone: '+10000000000',
  segment_id: 'SEGMENT_ID',
})

// With phone only
rnsdk.segments('remove', {
  phone: '+10000000000',
  segment_id: 'SEGMENT_ID',
})

// With email only
rnsdk.segments('remove', {
  email: 'jane@example.com',
  segment_id: 'SEGMENT_ID',
})

// Without any contacts: `did` is used automatically
rnsdk.segments('remove', {
  segment_id: 'SEGMENT_ID',
})
```

### Get user segments

```js
// Using all possible identifiers
rnsdk.segments('get').then((res) => {
  // segments (type: array of objects)
  // each object has the following properties:
  // "id" as Segment ID
  // "type" as Segment Type ("dynamic", "static")
})
```

##

## License

PersonaClick React Native SDK is available under the MIT license. See the LICENSE file for more info.
