# PersonaClick React Native SDK


## Installation

PersonaClick React Native SDK is available through [GitHub](https://github.com/PersonaClick/rn-sdk/). To install it, run next command in terminal:

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
yarn add react-native-push-notification
yarn add @react-native-firebase/app
yarn add @react-native-firebase/messaging
```
## iOS manual Installation
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

## Android manual Installation

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


# Usage

SDK is used for several tasks:

1. Initialize SDK and user's session
2. Events tracking
3. Track custom event
4. Product recommendations
5. Product search
6. Save profile settings
7. Create new push token

## Initialization

Initialize SDK object and use it anywhere in your application. (!) Remember to initialize SDK only once on application launch.

```js
import PersonaClick from '@personaclick/rn-sdk';

...
const pcsdk = new PersonaClick("YOUR_SHOP_ID", "Stream")
```

## Check init

```js
pcsdk.isInit(); // returns true/false
```

## Events tracking

Track user's behavior to collect data. There are several types of events:

```js


// View product (simple way)
pcsdk.track("view", 37);

// View product (try to avoid it)
pcsdk.track("view", {
    id: 37,
    stock: true
});

// View product after user clicked on recommender block
pcsdk.track("view", {
  id: PRODUCT_ID,
  recommended_by: 'dynamic',
  recommended_code: 'UNIQUE_RECOMMENDER_CODE'
});

// View product, after user clicked on search results
pcsdk.track("view", {
  id: PRODUCT_ID,
  recommended_by: 'full_search',
  recommended_code: QUERY_STRING
});
// ... or instant search dropdown
pcsdk.track("view", {
  id: PRODUCT_ID,
  recommended_by: 'instant_search',
  recommended_code: QUERY_STRING
});

// View category
pcsdk.track("category", 100500);

// Add product to cart (simple way)
pcsdk.track("cart", id);

// Add product to cart with amount and track recommender
pcsdk.track("cart", {
  id: PRODUCT_ID,
  amount: PRODUCT_QUANTITY,
  recommended_by: 'dynamic',
  recommended_code: 'UNIQUE_RECOMMENDER_CODE'
});

// Remove product from cart
pcsdk.track("remove_from_cart", id);

// Add product to favorities
pcsdk.track("wish", id);

// Remove product from favorities
pcsdk.track("remove_wish", id);

// Track purchase (several products)
pcsdk.track("purchase", {
  products: [
      {id: 37, price: 318, amount: 3},
      {id: 187, price: 5000, amount: 1}
  ],
  order: 'N318',
  order_price: 29999
});

// Track user search
pcsdk.track("search", "This is a search example");
```

## Track custom event
```js
// Simple tracking
pcsdk.trackEvent('my_event');

// Tracking with custom parameters
pcsdk.trackEvent('my_event', {
  category: "event category", 
  label: "event label",
  value: 100
});
```

## Product search

```js
const type = 'instant_search'; // full_search, ...

let search_query = 'your_search_text';

pcsdk.search({
  type,
  search_query,
  // other params
}) 
  .then((res) => {
    console.log(res);
  })
  .catch((error) => {
    console.log(error);
  });
```

## Product recommendations

```js
const recommender_code = 'recommender_code'; 

const params = {
  item: 100500,
  exclude: [3, 14, 159, 26535],
  search_query: "To be or not to be"
 // other params
};

pcsdk.recommend(recommender_code, params) 
  .then((res) => {
    console.log(res);
  })
  .catch((error) => {
    console.log(error);
  });
```

## User clicked on mobile push

```js
const params = {
  code: 'CODE',
  type: 'mobile_push_transactional'
};

pcsdk.notificationClicked(params) 
  .then((res) => {
    console.log(res);
  })
  .catch((error) => {
    console.log(error);
  });
```

## Save profile settings

```js
const params = {
  first_name: 'Jane',
  last_name: 'Smith'
};

pcsdk.setProfile(params);
```

## Create new push token

```js
pcsdk.initPush();
```

## License

PersonaClick React Native SDK is available under the MIT license. See the LICENSE file for more info.
