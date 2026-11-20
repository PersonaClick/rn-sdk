// The JavaScript side of the native module (lib/native/bridge.js): it hands every call to the module as
// it is, and the module's state events to the listener.

const loadBridge = (nativeModule) => {
  let bridge
  jest.isolateModules(() => {
    jest.doMock('../specs/NativePersonaClick', () => ({ __esModule: true, default: nativeModule }))
    bridge = require('../lib/native/bridge').nativeBridge
  })
  return bridge
}

const fakeModule = () => ({
  initializeShop: jest.fn(async (config) => ({ shopId: config.shopId, state: 'initializing', deviceId: null, sessionId: null })),
  getDeviceId: jest.fn(async () => 'did-1'),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
})

afterEach(() => {
  jest.dontMock('../specs/NativePersonaClick')
})

test('there is no bridge without the native module', () => {
  expect(loadBridge(null)).toBeNull()
})

test('there is no bridge when the module has no methods (the old architecture on iOS)', () => {
  expect(loadBridge({ addListener: jest.fn(), removeListeners: jest.fn() })).toBeNull()
})

test('initializeShop hands the config to the module and resolves with its snapshot', async () => {
  const native = fakeModule()
  const bridge = loadBridge(native)

  const snapshot = await bridge.initializeShop({ shopId: 'shop-a', stream: 'ios' })

  expect(native.initializeShop).toHaveBeenCalledWith({ shopId: 'shop-a', stream: 'ios' })
  expect(snapshot).toEqual({ shopId: 'shop-a', state: 'initializing', deviceId: null, sessionId: null })
})

test('getDeviceId asks the module for the shop', async () => {
  const native = fakeModule()
  const bridge = loadBridge(native)

  await expect(bridge.getDeviceId('shop-a')).resolves.toBe('did-1')
  expect(native.getDeviceId).toHaveBeenCalledWith('shop-a')
})

test('a rejection of the module reaches the caller as an SdkError of its type', async () => {
  const native = fakeModule()
  native.getDeviceId.mockRejectedValue(Object.assign(new Error('no shop'), { code: 'notInitialized' }))
  const bridge = loadBridge(native)

  const error = await bridge.getDeviceId('nope').catch((e) => e)
  expect(error.name).toBe('SdkError')
  expect(error).toMatchObject({ type: 'notInitialized', message: 'no shop' })
})

test('an HTTP error keeps its codes', async () => {
  const native = fakeModule()
  native.queueEvent = jest.fn(async () => {
    throw Object.assign(new Error('The server answered 422'), { code: 'http', userInfo: { httpCode: 422, serverCode: 'bad_code' } })
  })
  const bridge = loadBridge(native)

  const error = await bridge.queueEvent('shop-a', 'track/slider', {}).catch((e) => e)
  expect(error).toMatchObject({ type: 'http', httpCode: 422, serverCode: 'bad_code' })
})

test('onStateChanged hears the state events until it is stopped', () => {
  const native = fakeModule()
  const bridge = loadBridge(native)
  const { DeviceEventEmitter } = require('react-native')
  const heard = []

  const stop = bridge.onStateChanged((snapshot) => heard.push(snapshot))
  DeviceEventEmitter.emit('PersonaClickStateChanged', { shopId: 'shop-a', state: 'ready', deviceId: 'did-1', sessionId: 'sid-1' })
  stop()
  DeviceEventEmitter.emit('PersonaClickStateChanged', { shopId: 'shop-a', state: 'refused', deviceId: 'did-1', sessionId: null })

  expect(heard).toEqual([{ shopId: 'shop-a', state: 'ready', deviceId: 'did-1', sessionId: 'sid-1' }])
  // The module learns about the listener: iOS sends events only while it has one, and both platforms
  // answer a new listener with the shops' snapshots.
  expect(native.addListener).toHaveBeenCalledWith('PersonaClickStateChanged')
  expect(native.removeListeners).toHaveBeenCalledWith(1)
})

test('every namespace method goes to the module with its arguments as they are', async () => {
  const native = { ...fakeModule(), productsGetInfo: jest.fn(async () => ({ id: '37' })), cartClear: jest.fn(async () => null) }
  const bridge = loadBridge(native)

  await expect(bridge.productsGetInfo('shop-a', '37')).resolves.toEqual({ id: '37' })
  await expect(bridge.cartClear('shop-a', 'secret', null, null, null, 'ext', null)).resolves.toBeNull()
  expect(native.productsGetInfo).toHaveBeenCalledWith('shop-a', '37')
  expect(native.cartClear).toHaveBeenCalledWith('shop-a', 'secret', null, null, null, 'ext', null)
})

test('a rejection of a namespace method is an SdkError with its codes', async () => {
  const native = {
    ...fakeModule(),
    collectionsGet: jest.fn(async () => {
      throw Object.assign(new Error('The server answered 400'), { code: 'http', userInfo: { httpCode: 400 } })
    }),
  }
  const bridge = loadBridge(native)

  const error = await bridge.collectionsGet('shop-a', '12').catch((e) => e)
  expect(error).toMatchObject({ name: 'SdkError', type: 'http', httpCode: 400, message: 'The server answered 400' })
})

test('a call the module throws on at once (an argument codegen refuses) rejects as invalidArgument', async () => {
  const native = {
    ...fakeModule(),
    segmentsAdd: jest.fn(() => {
      throw new TypeError('Expected argument 1 of method "segmentsAdd" to be a number')
    }),
  }
  const bridge = loadBridge(native)

  await expect(bridge.segmentsAdd('shop-a', '12', null, null)).rejects.toMatchObject({ name: 'SdkError', type: 'invalidArgument' })
})

test('a namespace method an older native module lacks rejects with notInitialized', async () => {
  const bridge = loadBridge(fakeModule())

  await expect(bridge.slidersGet('shop-a', 'main', null, null)).rejects.toMatchObject({ name: 'SdkError', type: 'notInitialized' })
})

describe('the instance: flush, releaseShop, deleteUserCredentials', () => {
  test('flush and deleteUserCredentials ask the module for the shop and settle as it does', async () => {
    const native = {
      ...fakeModule(),
      flush: jest.fn(async () => null),
      deleteUserCredentials: jest.fn(async () => {
        throw Object.assign(new Error('released'), { code: 'notInitialized' })
      }),
    }
    const bridge = loadBridge(native)

    await expect(bridge.flush('shop-a')).resolves.toBeNull()
    await expect(bridge.deleteUserCredentials('shop-a')).rejects.toMatchObject({ name: 'SdkError', type: 'notInitialized', message: 'released' })
    expect(native.flush).toHaveBeenCalledWith('shop-a')
    expect(native.deleteUserCredentials).toHaveBeenCalledWith('shop-a')
  })

  test('releaseShop tells the module and never throws', () => {
    const native = { ...fakeModule(), releaseShop: jest.fn() }
    const bridge = loadBridge(native)

    expect(bridge.releaseShop('shop-a')).toBeUndefined()
    expect(native.releaseShop).toHaveBeenCalledWith('shop-a')

    native.releaseShop.mockImplementation(() => {
      throw new TypeError('Expected argument 0 of method "releaseShop" to be a string')
    })
    expect(() => bridge.releaseShop(7)).not.toThrow()
  })

  test('an older native module without them: flush and deleteUserCredentials reject with notInitialized, releaseShop does nothing', async () => {
    const bridge = loadBridge(fakeModule())

    await expect(bridge.flush('shop-a')).rejects.toMatchObject({ type: 'notInitialized' })
    await expect(bridge.deleteUserCredentials('shop-a')).rejects.toMatchObject({ type: 'notInitialized' })
    expect(() => bridge.releaseShop('shop-a')).not.toThrow()
  })
})

test('onPopup hears the server popups the native SDK hands over until it is stopped', () => {
  const native = fakeModule()
  const bridge = loadBridge(native)
  const { DeviceEventEmitter } = require('react-native')
  const heard = []

  const stop = bridge.onPopup((event) => heard.push(event))
  DeviceEventEmitter.emit('PersonaClickPopup', { shopId: 'shop-a', popup: { id: 7, components: '{}' } })
  stop()
  DeviceEventEmitter.emit('PersonaClickPopup', { shopId: 'shop-a', popup: { id: 8 } })

  expect(heard).toEqual([{ shopId: 'shop-a', popup: { id: 7, components: '{}' } }])
  expect(native.addListener).toHaveBeenCalledWith('PersonaClickPopup')
})

describe('the popups of several shops', () => {
  const popupOf = (shopId, id) => ({ shopId, popup: { id } })
  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  }

  test("the native replay to the first shop's listener loses no other shop's popup: each comes to its own shop, in order", async () => {
    const native = fakeModule()
    const bridge = loadBridge(native)
    const { DeviceEventEmitter } = require('react-native')
    const a = []
    const b = []

    // Shop A starts first; the native module replays every shop's held popups to its listener.
    bridge.onPopup((event) => a.push(event.popup.id), 'shop-a')
    DeviceEventEmitter.emit('PersonaClickPopup', popupOf('shop-a', 1))
    DeviceEventEmitter.emit('PersonaClickPopup', popupOf('shop-b', 2))
    DeviceEventEmitter.emit('PersonaClickPopup', popupOf('shop-b', 3))
    await flush()
    expect(a).toEqual([1])

    // Shop B starts later and gets its own.
    bridge.onPopup((event) => b.push(event.popup.id), 'shop-b')
    await flush()
    DeviceEventEmitter.emit('PersonaClickPopup', popupOf('shop-b', 4))

    expect(b).toEqual([2, 3, 4])
    expect(a).toEqual([1])
    // One subscription for every shop.
    expect(native.addListener.mock.calls.filter(([name]) => name === 'PersonaClickPopup')).toHaveLength(1)
  })

  test('a held popup older than a minute, or of a released shop, does not come', async () => {
    const native = fakeModule()
    native.releaseShop = jest.fn()
    const bridge = loadBridge(native)
    const { DeviceEventEmitter } = require('react-native')
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000)
    const b = []
    const c = []

    bridge.onPopup(() => {}, 'shop-a')
    DeviceEventEmitter.emit('PersonaClickPopup', popupOf('shop-b', 1))
    DeviceEventEmitter.emit('PersonaClickPopup', popupOf('shop-c', 2))
    bridge.releaseShop('shop-c')
    now.mockReturnValue(1000 + 61000)
    DeviceEventEmitter.emit('PersonaClickPopup', popupOf('shop-b', 3))
    bridge.onPopup((event) => b.push(event.popup.id), 'shop-b')
    bridge.onPopup((event) => c.push(event.popup.id), 'shop-c')
    await flush()

    expect(b).toEqual([3])
    expect(c).toEqual([])
    expect(native.releaseShop).toHaveBeenCalledWith('shop-c')
    now.mockRestore()
  })

  test('a listener that throws does not keep a popup from the others', () => {
    const bridge = loadBridge(fakeModule())
    const { DeviceEventEmitter } = require('react-native')
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const heard = []

    bridge.onPopup(() => { throw new Error('boom') }, 'shop-a')
    bridge.onPopup((event) => heard.push(event.popup.id), 'shop-a')
    DeviceEventEmitter.emit('PersonaClickPopup', popupOf('shop-a', 5))

    expect(heard).toEqual([5])
    errors.mockRestore()
  })
})
