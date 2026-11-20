#import <React/RCTEventEmitter.h>

// The codegen spec of the TurboModule. The new architecture always has it: a missing one is a build error
// there. An app on the old architecture may build without it (React Native generates it there only from
// some versions on): the module then compiles as a plain event emitter with no exported method, and the SDK
// runs in JavaScript, as the README says.
#if defined(RCT_NEW_ARCH_ENABLED) || __has_include(<PersonaClickNativeSpec/PersonaClickNativeSpec.h>)
#import <PersonaClickNativeSpec/PersonaClickNativeSpec.h>
#define PersonaClick_NATIVE_SPEC 1
#endif

#if __has_include(<PersonaClickReactNativeSdk/PersonaClickReactNativeSdk-Swift.h>)
#import <PersonaClickReactNativeSdk/PersonaClickReactNativeSdk-Swift.h>
#else
#import "PersonaClickReactNativeSdk-Swift.h"
#endif

static NSString *const PersonaClickStateChanged = @"PersonaClickStateChanged";
static NSString *const PersonaClickPopup = @"PersonaClickPopup";
static NSString *const PersonaClickLog = @"PersonaClickLog";

/// The SDK's TurboModule: hands every call to `PersonaClickNativeImpl` (Swift) and its state events to
/// JavaScript. Declared here, not in a header: a public header would go into the pod's module, which the
/// Swift part builds without React Native's generated headers.
#ifdef PersonaClick_NATIVE_SPEC
@interface PersonaClickNative : RCTEventEmitter <NativePersonaClickSpec>
@end
#else
@interface PersonaClickNative : RCTEventEmitter
@end
#endif

@implementation PersonaClickNative {
  PersonaClickNativeImpl *_impl;
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE(PersonaClickNative)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    _impl = [PersonaClickNativeImpl new];
    __weak PersonaClickNative *weakSelf = self;
    _impl.onStateChanged = ^(NSDictionary<NSString *, id> *snapshot) {
      [weakSelf emitState:snapshot];
    };
    _impl.onPopup = ^BOOL(NSDictionary<NSString *, id> *event) {
      return [weakSelf emitPopup:event];
    };
    _impl.onLog = ^(NSDictionary<NSString *, id> *message) {
      [weakSelf emitLog:message];
    };
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ PersonaClickStateChanged, PersonaClickPopup, PersonaClickLog ];
}

- (void)startObserving
{
  _hasListeners = YES;
}

- (void)stopObserving
{
  _hasListeners = NO;
}

- (void)emitState:(NSDictionary *)snapshot
{
  if (_hasListeners) {
    [self sendEventWithName:PersonaClickStateChanged body:snapshot];
  }
}

/// A message of the SDK's log for JavaScript; dropped while it has no listener. Comes on the SDK's log queue.
- (void)emitLog:(NSDictionary *)message
{
  if (_hasListeners) {
    [self sendEventWithName:PersonaClickLog body:message];
  }
}

/// A server popup for JavaScript; NO while it has no listener, so the Swift side holds it.
- (BOOL)emitPopup:(NSDictionary *)event
{
  if (!_hasListeners) {
    return NO;
  }
  [self sendEventWithName:PersonaClickPopup body:event];
  return YES;
}

- (void)invalidate
{
  [_impl invalidate];
  [super invalidate];
}

/// The Swift side rejects with a code, a message and, for an HTTP error, its codes: JavaScript gets
/// them in the error's `userInfo`.
static void (^Rejecter(RCTPromiseRejectBlock reject))(NSString *, NSString *, NSDictionary *)
{
  return ^(NSString *code, NSString *message, NSDictionary *userInfo) {
    NSError *error = userInfo ? [NSError errorWithDomain:@"PersonaClickNative" code:0 userInfo:userInfo] : nil;
    reject(code, message, error);
  };
}

- (void)initializeShop:(NSDictionary *)config
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [_impl initializeShop:config resolve:resolve reject:Rejecter(reject)];
}

- (void)setLogHandler:(BOOL)enabled
{
  [_impl setLogHandler:enabled];
}

- (void)getDeviceId:(NSString *)shopId
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [_impl deviceId:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)queueEvent:(NSString *)shopId
              path:(NSString *)path
              body:(NSDictionary *)body
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [_impl queueEvent:shopId path:path body:body resolve:resolve reject:Rejecter(reject)];
}

- (void)setSource:(NSString *)shopId
             type:(NSString *)type
             code:(NSString *)code
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  [_impl setSource:shopId type:type code:code resolve:resolve reject:Rejecter(reject)];
}

// Pushes of shops not started: `registerShops`, `handlePush`.

- (void)registerShops:(NSArray *)configs
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [_impl registerShops:configs resolve:resolve reject:Rejecter(reject)];
}

- (void)handlePush:(NSDictionary *)payload
             event:(NSString *)event
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [_impl handlePush:payload event:event resolve:resolve reject:Rejecter(reject)];
}

// The instance: `flush`, `releaseShop`, `deleteUserCredentials`.

- (void)flush:(NSString *)shopId
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  [_impl flush:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)releaseShop:(NSString *)shopId
{
  [_impl releaseShop:shopId];
}

- (void)deleteUserCredentials:(NSString *)shopId
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  [_impl deleteUserCredentials:shopId resolve:resolve reject:Rejecter(reject)];
}

// The namespaces of the SDK contract: each goes to the Swift method of the same name.

- (void)trackingProductView:(NSString *)shopId
    itemId:(NSString *)itemId
    source:(NSDictionary * _Nullable)source
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingProductView:shopId itemId:itemId source:source resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingCategoryView:(NSString *)shopId
    categoryId:(NSString *)categoryId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingCategoryView:shopId categoryId:categoryId resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingSearch:(NSString *)shopId
    query:(NSString *)query
    results:(NSArray * _Nullable)results
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingSearch:shopId query:query results:results resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingAddToCart:(NSString *)shopId
    item:(NSDictionary *)item
    source:(NSDictionary * _Nullable)source
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingAddToCart:shopId item:item source:source resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingSyncCart:(NSString *)shopId
    items:(NSArray *)items
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingSyncCart:shopId items:items resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingRemoveFromCart:(NSString *)shopId
    itemId:(NSString *)itemId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingRemoveFromCart:shopId itemId:itemId resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingAddToFavorites:(NSString *)shopId
    itemId:(NSString *)itemId
    source:(NSDictionary * _Nullable)source
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingAddToFavorites:shopId itemId:itemId source:source resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingSyncFavorites:(NSString *)shopId
    itemIds:(NSArray *)itemIds
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingSyncFavorites:shopId itemIds:itemIds resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingRemoveFromFavorites:(NSString *)shopId
    itemId:(NSString *)itemId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingRemoveFromFavorites:shopId itemId:itemId resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingPurchase:(NSString *)shopId
    request:(NSDictionary *)request
    source:(NSDictionary * _Nullable)source
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingPurchase:shopId request:request source:source resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingStoryView:(NSString *)shopId
    storyId:(NSString *)storyId
    slideId:(NSString *)slideId
    code:(NSString * _Nullable)code
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingStoryView:shopId storyId:storyId slideId:slideId code:code resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingStoryClick:(NSString *)shopId
    storyId:(NSString *)storyId
    slideId:(NSString *)slideId
    code:(NSString * _Nullable)code
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingStoryClick:shopId storyId:storyId slideId:slideId code:code resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingBannerView:(NSString *)shopId
    bannerId:(NSString *)bannerId
    code:(NSString *)code
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingBannerView:shopId bannerId:bannerId code:code resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingBannerClick:(NSString *)shopId
    bannerId:(NSString *)bannerId
    code:(NSString *)code
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingBannerClick:shopId bannerId:bannerId code:code resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingPopupShown:(NSString *)shopId
    popupId:(double)popupId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingPopupShown:shopId popupId:popupId resolve:resolve reject:Rejecter(reject)];
}

- (void)trackingCustom:(NSString *)shopId
    event:(NSString *)event
    time:(NSNumber *)time
    category:(NSString * _Nullable)category
    label:(NSString * _Nullable)label
    value:(NSNumber *)value
    customFields:(NSDictionary * _Nullable)customFields
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl trackingCustom:shopId event:event time:time category:category label:label value:value customFields:customFields resolve:resolve reject:Rejecter(reject)];
}

- (void)productsGetInfo:(NSString *)shopId
    itemId:(NSString *)itemId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl productsGetInfo:shopId itemId:itemId resolve:resolve reject:Rejecter(reject)];
}

- (void)productsGetList:(NSString *)shopId
    request:(NSDictionary * _Nullable)request
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl productsGetList:shopId request:request resolve:resolve reject:Rejecter(reject)];
}

- (void)productsGetCounters:(NSString *)shopId
    itemId:(NSString *)itemId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl productsGetCounters:shopId itemId:itemId resolve:resolve reject:Rejecter(reject)];
}

- (void)productsGetCategory:(NSString *)shopId
    categoryId:(NSString *)categoryId
    request:(NSDictionary * _Nullable)request
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl productsGetCategory:shopId categoryId:categoryId request:request resolve:resolve reject:Rejecter(reject)];
}

- (void)collectionsGet:(NSString *)shopId
    collectionId:(NSString *)collectionId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl collectionsGet:shopId collectionId:collectionId resolve:resolve reject:Rejecter(reject)];
}

- (void)recommendationsGet:(NSString *)shopId
    code:(NSString *)code
    request:(NSDictionary * _Nullable)request
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl recommendationsGet:shopId code:code request:request resolve:resolve reject:Rejecter(reject)];
}

- (void)searchBlank:(NSString *)shopId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl searchBlank:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)searchInstant:(NSString *)shopId
    query:(NSString *)query
    locations:(NSArray * _Nullable)locations
    excludedMerchants:(NSArray * _Nullable)excludedMerchants
    excludedBrands:(NSArray * _Nullable)excludedBrands
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl searchInstant:shopId query:query locations:locations excludedMerchants:excludedMerchants excludedBrands:excludedBrands resolve:resolve reject:Rejecter(reject)];
}

- (void)searchFull:(NSString *)shopId
    query:(NSString *)query
    request:(NSDictionary * _Nullable)request
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl searchFull:shopId query:query request:request resolve:resolve reject:Rejecter(reject)];
}

- (void)searchAgentDialog:(NSString *)shopId
    sessionId:(NSNumber *)sessionId
    locations:(NSArray * _Nullable)locations
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl searchAgentDialog:shopId sessionId:sessionId locations:locations resolve:resolve reject:Rejecter(reject)];
}

- (void)searchAgent:(NSString *)shopId
    message:(NSString *)message
    sessionId:(NSNumber *)sessionId
    locations:(NSArray * _Nullable)locations
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl searchAgent:shopId message:message sessionId:sessionId locations:locations resolve:resolve reject:Rejecter(reject)];
}

- (void)cartGet:(NSString *)shopId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl cartGet:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)cartClear:(NSString *)shopId
    shopSecret:(NSString *)shopSecret
    email:(NSString * _Nullable)email
    phone:(NSString * _Nullable)phone
    loyaltyId:(NSString * _Nullable)loyaltyId
    externalId:(NSString * _Nullable)externalId
    telegramId:(NSString * _Nullable)telegramId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl cartClear:shopId shopSecret:shopSecret email:email phone:phone loyaltyId:loyaltyId externalId:externalId telegramId:telegramId resolve:resolve reject:Rejecter(reject)];
}

- (void)profileGet:(NSString *)shopId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl profileGet:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)profileSet:(NSString *)shopId
    request:(NSDictionary *)request
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl profileSet:shopId request:request resolve:resolve reject:Rejecter(reject)];
}

- (void)profileGetLastOrder:(NSString *)shopId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl profileGetLastOrder:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)profileGetOrders:(NSString *)shopId
    shopSecret:(NSString *)shopSecret
    did:(NSString * _Nullable)did
    email:(NSString * _Nullable)email
    phone:(NSString * _Nullable)phone
    loyaltyId:(NSString * _Nullable)loyaltyId
    externalId:(NSString * _Nullable)externalId
    dateFrom:(NSString * _Nullable)dateFrom
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl profileGetOrders:shopId shopSecret:shopSecret did:did email:email phone:phone loyaltyId:loyaltyId externalId:externalId dateFrom:dateFrom resolve:resolve reject:Rejecter(reject)];
}

- (void)subscriptionsManage:(NSString *)shopId
    request:(NSDictionary *)request
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl subscriptionsManage:shopId request:request resolve:resolve reject:Rejecter(reject)];
}

- (void)subscriptionsCheck:(NSString *)shopId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl subscriptionsCheck:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)subscriptionsSubscribeForPriceDrop:(NSString *)shopId
    itemId:(NSString *)itemId
    currentPrice:(double)currentPrice
    email:(NSString * _Nullable)email
    phone:(NSString * _Nullable)phone
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl subscriptionsSubscribeForPriceDrop:shopId itemId:itemId currentPrice:currentPrice email:email phone:phone resolve:resolve reject:Rejecter(reject)];
}

- (void)subscriptionsUnsubscribeFromPriceDrop:(NSString *)shopId
    itemIds:(NSArray *)itemIds
    email:(NSString * _Nullable)email
    phone:(NSString * _Nullable)phone
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl subscriptionsUnsubscribeFromPriceDrop:shopId itemIds:itemIds email:email phone:phone resolve:resolve reject:Rejecter(reject)];
}

- (void)subscriptionsSubscribeForBackInStock:(NSString *)shopId
    itemId:(NSString *)itemId
    properties:(NSDictionary * _Nullable)properties
    email:(NSString * _Nullable)email
    phone:(NSString * _Nullable)phone
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl subscriptionsSubscribeForBackInStock:shopId itemId:itemId properties:properties email:email phone:phone resolve:resolve reject:Rejecter(reject)];
}

- (void)subscriptionsUnsubscribeFromBackInStock:(NSString *)shopId
    itemIds:(NSArray *)itemIds
    email:(NSString * _Nullable)email
    phone:(NSString * _Nullable)phone
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl subscriptionsUnsubscribeFromBackInStock:shopId itemIds:itemIds email:email phone:phone resolve:resolve reject:Rejecter(reject)];
}

- (void)segmentsAdd:(NSString *)shopId
    segmentId:(double)segmentId
    email:(NSString * _Nullable)email
    phone:(NSString * _Nullable)phone
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl segmentsAdd:shopId segmentId:segmentId email:email phone:phone resolve:resolve reject:Rejecter(reject)];
}

- (void)segmentsRemove:(NSString *)shopId
    segmentId:(double)segmentId
    email:(NSString * _Nullable)email
    phone:(NSString * _Nullable)phone
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl segmentsRemove:shopId segmentId:segmentId email:email phone:phone resolve:resolve reject:Rejecter(reject)];
}

- (void)segmentsGet:(NSString *)shopId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl segmentsGet:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)notificationsTrack:(NSString *)shopId
    event:(NSString *)event
    code:(NSString *)code
    type:(NSString *)type
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl notificationsTrack:shopId event:event code:code type:type resolve:resolve reject:Rejecter(reject)];
}

- (void)notificationsSetPushToken:(NSString *)shopId
    token:(NSString *)token
    provider:(NSString *)provider
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl notificationsSetPushToken:shopId token:token provider:provider resolve:resolve reject:Rejecter(reject)];
}

- (void)notificationsGetPushToken:(NSString *)shopId
    provider:(NSString * _Nullable)provider
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl notificationsGetPushToken:shopId provider:provider resolve:resolve reject:Rejecter(reject)];
}

- (void)notificationsGetHistory:(NSString *)shopId
    shopSecret:(NSString *)shopSecret
    type:(NSString *)type
    phone:(NSString * _Nullable)phone
    email:(NSString * _Nullable)email
    externalId:(NSString * _Nullable)externalId
    loyaltyId:(NSString * _Nullable)loyaltyId
    channel:(NSString * _Nullable)channel
    limit:(NSNumber *)limit
    page:(NSNumber *)page
    dateFrom:(NSString * _Nullable)dateFrom
    did:(NSString * _Nullable)did
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl notificationsGetHistory:shopId shopSecret:shopSecret type:type phone:phone email:email externalId:externalId loyaltyId:loyaltyId channel:channel limit:limit page:page dateFrom:dateFrom did:did resolve:resolve reject:Rejecter(reject)];
}

- (void)storiesGet:(NSString *)shopId
    code:(NSString *)code
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl storiesGet:shopId code:code resolve:resolve reject:Rejecter(reject)];
}

- (void)predictGetProbabilityToPurchase:(NSString *)shopId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl predictGetProbabilityToPurchase:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)loyaltyJoin:(NSString *)shopId
    phone:(NSString *)phone
    firstName:(NSString * _Nullable)firstName
    lastName:(NSString * _Nullable)lastName
    gender:(NSString * _Nullable)gender
    birthday:(NSString * _Nullable)birthday
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl loyaltyJoin:shopId phone:phone firstName:firstName lastName:lastName gender:gender birthday:birthday resolve:resolve reject:Rejecter(reject)];
}

- (void)loyaltyGetStatus:(NSString *)shopId
    phone:(NSString *)phone
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl loyaltyGetStatus:shopId phone:phone resolve:resolve reject:Rejecter(reject)];
}

- (void)loyaltyGetPromotions:(NSString *)shopId
    locationId:(NSString * _Nullable)locationId
    promoCodes:(NSArray * _Nullable)promoCodes
    chargeBonuses:(NSNumber *)chargeBonuses
    currentTime:(NSString * _Nullable)currentTime
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl loyaltyGetPromotions:shopId locationId:locationId promoCodes:promoCodes chargeBonuses:chargeBonuses currentTime:currentTime resolve:resolve reject:Rejecter(reject)];
}

- (void)slidersGet:(NSString *)shopId
    code:(NSString *)code
    tags:(NSArray * _Nullable)tags
    locationId:(NSString * _Nullable)locationId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl slidersGet:shopId code:code tags:tags locationId:locationId resolve:resolve reject:Rejecter(reject)];
}

- (void)reviewsCreateNps:(NSString *)shopId
    rate:(double)rate
    channel:(NSString *)channel
    category:(NSString *)category
    orderId:(NSString * _Nullable)orderId
    comment:(NSString * _Nullable)comment
    label:(NSString * _Nullable)label
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl reviewsCreateNps:shopId rate:rate channel:channel category:category orderId:orderId comment:comment label:label resolve:resolve reject:Rejecter(reject)];
}

- (void)reviewsCreateCsat:(NSString *)shopId
    rate:(double)rate
    channel:(NSString *)channel
    campaign:(NSString *)campaign
    orderId:(NSString * _Nullable)orderId
    comment:(NSString * _Nullable)comment
    label:(NSString * _Nullable)label
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl reviewsCreateCsat:shopId rate:rate channel:channel campaign:campaign orderId:orderId comment:comment label:label resolve:resolve reject:Rejecter(reject)];
}

- (void)reviewsCreateCes:(NSString *)shopId
    rate:(double)rate
    channel:(NSString *)channel
    campaign:(NSString *)campaign
    orderId:(NSString * _Nullable)orderId
    comment:(NSString * _Nullable)comment
    label:(NSString * _Nullable)label
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl reviewsCreateCes:shopId rate:rate channel:channel campaign:campaign orderId:orderId comment:comment label:label resolve:resolve reject:Rejecter(reject)];
}

- (void)reviewsGetNpsCategories:(NSString *)shopId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl reviewsGetNpsCategories:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)reviewsGetNpsChannels:(NSString *)shopId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl reviewsGetNpsChannels:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)reviewsGetCsatCampaigns:(NSString *)shopId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl reviewsGetCsatCampaigns:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)reviewsGetCesCampaigns:(NSString *)shopId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl reviewsGetCesCampaigns:shopId resolve:resolve reject:Rejecter(reject)];
}

- (void)reviewsGetProductReviews:(NSString *)shopId
    itemId:(NSString *)itemId
    limit:(NSNumber *)limit
    offset:(NSNumber *)offset
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl reviewsGetProductReviews:shopId itemId:itemId limit:limit offset:offset resolve:resolve reject:Rejecter(reject)];
}

- (void)reviewsGetClientReviews:(NSString *)shopId
    orderId:(NSString *)orderId
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
{
  [_impl reviewsGetClientReviews:shopId orderId:orderId resolve:resolve reject:Rejecter(reject)];
}

- (void)addListener:(NSString *)eventName
{
  [super addListener:eventName];
  // The new listener hears every initialized shop's snapshot at once.
  [_impl replay];
}

- (void)removeListeners:(double)count
{
  [super removeListeners:count];
}

#ifdef PersonaClick_NATIVE_SPEC
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativePersonaClickSpecJSI>(params);
}
#endif

@end
