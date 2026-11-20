import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// The app's push callbacks (`sdk/contract/notifications.md`): `notifications.setCallbacks` of a shop and
// `PersonaClick.setPushCallbacks` of every shop hear a push event the SDK saw itself — its handlers or
// `PersonaClick.handlePush` — once the native queue accepted it, once per event of a message, with the push
// as `PushPayload`; `onToken` hears a token the SDK's own registration got. The native module and axios
// are fakes: nothing reaches a server.

jest.mock('axios', () => jest.fn())

jest.mock('../lib/native/bridge', () => ({
  nativeBridge: {},
  toSdkError: (e) => e,
  DEFAULT_STREAM: jest.requireActual('../lib/native/bridge').DEFAULT_STREAM,
}))

// eslint-disable-next-line import/first
import { nativeBridge as mockNative } from '../lib/native/bridge'
// eslint-disable-next-line import/first
import PersonaClick, { PushEvent } from '../index.js'
// eslint-disable-next-line import/first
import registry from '../lib/registry/SdkRegistry'
// eslint-disable-next-line import/first
import { pushPayload, resetPushCallbacks } from '../lib/push/pushCallbacks'
// eslint-disable-next-line import/first
import { SdkError } from '../lib/facade/errors'

const SHOP = 'callbacks-shop'
const OTHER = 'callbacks-other-shop'

let snapshot

const { NAMESPACE_METHODS } = jest.requireActual('../lib/native/bridge')

function resetNative() {
  snapshot = { shopId: SHOP, state: 'ready', deviceId: 'native-did', sessionId: 'native-sid', segment: 'A' }
  for (const name of NAMESPACE_METHODS) mockNative[name] = jest.fn(async () => undefined)
  Object.assign(mockNative, {
    initializeShop: jest.fn(async (config) => ({ ...snapshot, shopId: config.shopId })),
    getDeviceId: jest.fn(async () => snapshot.deviceId),
    queueEvent: jest.fn(async () => undefined),
    setSource: jest.fn(async () => undefined),
    releaseShop: jest.fn(),
    registerShops: jest.fn(async () => true),
    handlePush: jest.fn(async (data) => data.shop_id),
    onStateChanged: jest.fn(() => () => {}),
  })
}

const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const push = (shop, id = 'c1', type = 'bulk', extra = {}) => ({
  messageId: `m-${id}`,
  data: { shop_id: shop, id, type, title: 'Sale', body: 'Up to 50%', ...extra },
})

async function liveShop(shopId = SHOP) {
  const sdk = PersonaClick.initialize({ shopId, autoSendPushToken: false })
  await settle()
  return sdk
}

beforeEach(async () => {
  await AsyncStorage.clearAll()
  axios.mockReset()
  axios.mockImplementation(() => Promise.resolve({ data: { status: 'success' } }))
  PersonaClick.reset()
  registry.reset()
  resetPushCallbacks()
  resetNative()
})

describe('PushPayload', () => {
  test('an FCM push: its strings, the buttons with their links, the target, the sound of the platform', () => {
    const payload = pushPayload({
      data: {
        shop_id: SHOP,
        id: 'c1',
        type: 'chain',
        title: 'Sale',
        body: 'Up to 50%',
        icon: 'https://i/icon.png',
        image: 'https://i/a.png,https://i/b.png',
        actions: JSON.stringify([{ action: 'buy', title: 'Buy' }, { action: 'later', title: 'Later' }]),
        action_urls: JSON.stringify(['https://shop/buy']),
        event: JSON.stringify({ type: 'product', uri: '37', payload: { tier: 'gold' } }),
        source: 'mailing',
        ios_sound_file: 'chime.caf',
        android_sound_file: 'chime',
      },
    })

    expect(payload).toEqual({
      shopId: SHOP,
      code: 'c1',
      type: 'chain',
      title: 'Sale',
      body: 'Up to 50%',
      icon: 'https://i/icon.png',
      image: 'https://i/a.png,https://i/b.png',
      actions: [{ id: 'buy', title: 'Buy', url: 'https://shop/buy' }, { id: 'later', title: 'Later', url: null }],
      target: { type: 'product', uri: '37', payload: { tier: 'gold' } },
      source: 'mailing',
      // The test platform is iOS.
      sound: 'chime.caf',
      data: expect.objectContaining({ id: 'c1', type: 'chain', event: expect.any(String) }),
    })
  })

  test('a direct APNs push: src and event are objects, the texts in aps.alert, the image in image_url', () => {
    const payload = pushPayload({
      src: { id: 'c2', type: 'bulk' },
      event: { type: 'web', uri: 'https://shop/sale' },
      aps: { alert: { title: 'Hi', body: 'Text' } },
      image_url: 'https://i/a.png',
    }, OTHER)

    expect(payload).toMatchObject({
      shopId: OTHER,
      code: 'c2',
      type: 'bulk',
      title: 'Hi',
      body: 'Text',
      image: 'https://i/a.png',
      actions: [],
      target: { type: 'web', uri: 'https://shop/sale', payload: {} },
      data: expect.objectContaining({ src: JSON.stringify({ id: 'c2', type: 'bulk' }) }),
    })
  })

  test('a push without id and type is not the SDK\'s; one with a notification takes its texts', () => {
    expect(pushPayload({ data: { title: 'Other sender' } })).toBeNull()
    expect(pushPayload({ data: { id: 'c3', type: 'bulk' }, notification: { title: 'T', body: 'B' } }))
      .toMatchObject({ title: 'T', body: 'B', target: null, sound: null, icon: null })
  })
})

describe('a shop\'s callbacks', () => {
  test('hear the event once the native queue accepted it, with the push; once per event of a message', async () => {
    const sdk = await liveShop()
    let accept
    mockNative.notificationsTrack.mockImplementationOnce(() => new Promise((resolve) => {
      accept = resolve
    }))
    const onDelivered = jest.fn()
    const onClicked = jest.fn()
    sdk.notifications.setCallbacks({ onDelivered, onClicked })

    await expect(PersonaClick.handlePush(push(SHOP), PushEvent.DELIVERED)).resolves.toBe(SHOP)
    await settle()
    expect(mockNative.notificationsTrack).toHaveBeenCalledWith(SHOP, 'delivered', 'c1', 'bulk')
    expect(onDelivered).not.toHaveBeenCalled()

    accept(null)
    await settle()
    expect(onDelivered).toHaveBeenCalledTimes(1)
    expect(onDelivered.mock.calls[0][0]).toMatchObject({ shopId: SHOP, code: 'c1', type: 'bulk', title: 'Sale', body: 'Up to 50%' })

    // A repeat of the event of the message: the native SDK sends nothing more, the callback hears nothing more.
    PersonaClick.handlePush(push(SHOP), PushEvent.DELIVERED)
    PersonaClick.handlePush(push(SHOP), PushEvent.CLICKED)
    await settle()
    expect(onDelivered).toHaveBeenCalledTimes(1)
    expect(onClicked).toHaveBeenCalledTimes(1)
  })

  test('the app\'s own notifications.track* call no callback', async () => {
    const sdk = await liveShop()
    const onOpened = jest.fn()
    sdk.notifications.setCallbacks({ onOpened })

    await sdk.notifications.trackOpened('c1', 'bulk')
    sdk.notificationOpened({ code: 'c2', type: 'bulk' })
    await settle()

    expect(mockNative.notificationsTrack).toHaveBeenCalledTimes(2)
    expect(onOpened).not.toHaveBeenCalled()
  })

  test('an event the native SDK refused calls none', async () => {
    const sdk = await liveShop()
    const onClosed = jest.fn()
    sdk.notifications.setCallbacks({ onClosed })
    mockNative.notificationsTrack.mockRejectedValueOnce(new SdkError('shopBlocked', 'refused'))

    await PersonaClick.handlePush(push(SHOP), PushEvent.CLOSED)
    await settle()

    expect(onClosed).not.toHaveBeenCalled()
  })

  test('the SDK\'s own handlers tell them too: a push received, drawn, tapped, dismissed', async () => {
    const sdk = await liveShop()
    const heard = []
    sdk.notifications.setCallbacks({
      onDelivered: (p) => heard.push(['delivered', p.code]),
      onOpened: (p) => heard.push(['opened', p.code]),
      onClicked: (p) => heard.push(['clicked', p.code]),
      onClosed: (p) => heard.push(['closed', p.code]),
    })
    const orchestrator = sdk._pushOrchestrator

    await orchestrator._handleBackgroundMessage(push(SHOP, 'd1'), SHOP)
    await sdk.showNotification(push(SHOP, 'o1'))
    await orchestrator._handleNotifeeDismissed({ detail: { notification: { data: { id: 'x1', type: 'chain' } } } })
    await settle()

    expect(heard).toEqual(expect.arrayContaining([['delivered', 'd1'], ['opened', 'o1'], ['closed', 'x1']]))
  })

  test('the shared callbacks hear a shop without its own; a shop\'s own wins, one by one', async () => {
    const own = await liveShop(SHOP)
    await liveShop(OTHER)
    const shared = { onDelivered: jest.fn(), onClicked: jest.fn() }
    PersonaClick.setPushCallbacks(shared)
    const ownClicked = jest.fn()
    own.notifications.setCallbacks({ onClicked: ownClicked })

    PersonaClick.handlePush(push(SHOP, 'a1'), PushEvent.CLICKED)
    PersonaClick.handlePush(push(SHOP, 'a1'), PushEvent.DELIVERED)
    PersonaClick.handlePush(push(OTHER, 'b1'), PushEvent.CLICKED)
    await settle()

    expect(ownClicked).toHaveBeenCalledWith(expect.objectContaining({ shopId: SHOP, code: 'a1' }))
    expect(shared.onDelivered).toHaveBeenCalledWith(expect.objectContaining({ shopId: SHOP, code: 'a1' }))
    expect(shared.onClicked).toHaveBeenCalledTimes(1)
    expect(shared.onClicked).toHaveBeenCalledWith(expect.objectContaining({ shopId: OTHER, code: 'b1' }))

    // null removes the shared ones, {} a shop's own.
    PersonaClick.setPushCallbacks(null)
    own.notifications.setCallbacks({})
    PersonaClick.handlePush(push(SHOP, 'a2'), PushEvent.CLICKED)
    await settle()
    expect(ownClicked).toHaveBeenCalledTimes(1)
    expect(shared.onClicked).toHaveBeenCalledTimes(1)
  })

  test('a callback that throws is logged and changes nothing', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const sdk = await liveShop()
    sdk.notifications.setCallbacks({
      onDelivered: () => {
        throw new Error('boom')
      },
    })

    await expect(PersonaClick.handlePush(push(SHOP), PushEvent.DELIVERED)).resolves.toBe(SHOP)
    await settle()

    expect(errors).toHaveBeenCalledWith(expect.stringMatching(/onDelivered.*callback_failed/), 'boom')
    errors.mockRestore()
  })
})

describe('a shop registered without an instance', () => {
  test('its push goes to the native SDK and the shared callbacks hear it', async () => {
    const onDelivered = jest.fn()
    PersonaClick.setPushCallbacks({ onDelivered })
    PersonaClick.register([{ shopId: SHOP }])
    await settle()

    await expect(PersonaClick.handlePush(push(SHOP, 'p1'), PushEvent.DELIVERED)).resolves.toBe(SHOP)
    await settle()

    expect(mockNative.handlePush).toHaveBeenCalledWith(expect.objectContaining({ shop_id: SHOP, id: 'p1' }), 'delivered')
    expect(onDelivered).toHaveBeenCalledWith(expect.objectContaining({ shopId: SHOP, code: 'p1' }))
    expect(registry.byShopId(SHOP)).toBeFalsy()
  })
})

describe('onToken', () => {
  test('hears a token the SDK\'s own registration got, once per token; not one the app hands over', async () => {
    const sdk = await liveShop()
    const onToken = jest.fn()
    sdk.notifications.setCallbacks({ onToken })

    sdk._pushOrchestrator._handleTokenRefresh('fresh-token')
    sdk._pushOrchestrator._handleTokenRefresh('fresh-token')
    await sdk.notifications.setPushToken('app-token', 'fcm')
    await settle()

    expect(onToken).toHaveBeenCalledTimes(1)
    expect(onToken).toHaveBeenCalledWith({ token: 'fresh-token', provider: expect.stringMatching(/^(apns|fcm)$/) })
  })
})
