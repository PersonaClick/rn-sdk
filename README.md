# PersonaClick React Native SDK


## Installation

PersonaClick React Native SDK is available through [GitHub](https://github.com/PersonaClick/rn-sdk/). To install it, run next command in terminal:

```
yarn add react-native-personaclick
```
or 

```
yarn add https://github.com/PersonaClick/rn-sdk.git
```

Also need added AsyncStorage plugin:
```
yarn add @react-native-async-storage/async-storage
```

# Usage

SDK is used for several tasks:

1. Initialize SDK and user's session
2. Events tracking
3. Product recommendations
4. Product search

## Initialization

Initialize SDK object and use it anywhere in your application. (!) Remember to initialize SDK only once on application launch.

```js
import PersonaClick from 'react-native-personaclick';

.....
const personaclicksdk = new PersonaClick("YOUR_SHOP_ID", "Stream")
```

## Check init

```js
personaclicksdk.isInit(); // returns true/false
```

## Events tracking

Track user's behavior to collect data. There are several types of events:

```js
const event = 'view'; // or search, ...

const params = {
  item_id: [] // array of products
};

personaclicksdk.track(event, {params})
  .then((res) => {
    console.log(res);
  })
  .catch((error) => {
    console.log(error);
  });

```

## Product search

```js
const type = 'instant_search'; // full_search, ...

let search_query = 'your_search_text';

personaclicksdk.search({
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

personaclicksdk.recommend(recommender_code, {params}) 
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

personaclicksdk.notificationClicked({params}) 
  .then((res) => {
    console.log(res);
  })
  .catch((error) => {
    console.log(error);
  });
```

## License

PersonaClick React Native SDK is available under the MIT license. See the LICENSE file for more info.