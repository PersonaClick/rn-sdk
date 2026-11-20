import AsyncStorage from '@react-native-async-storage/async-storage'
import notifee from '@notifee/react-native'
import { displayPush } from '../lib/push/displayPush'
import { trackPush } from '../lib/push/trackPush'
import { typeAndCode } from '../lib/push/PushPayloadParser'
import { request } from '../lib/client'

// What the SDK draws keeps the push it draws; a push event the SDK sends from JavaScript carries the
// shop's A/B group and no session; a push's code and type are read from `src` too.

jest.mock('../lib/client', () => ({ request: jest.fn(async () => ({ status: 'success' })) }))

beforeEach(async () => {
  await AsyncStorage.clearAll()
  request.mockClear()
})

test("the drawn notification keeps the push's data: its shop, title and body among it", async () => {
  const display = jest.spyOn(notifee, 'displayNotification')

  await displayPush({ messageId: 'm-1', data: { shop_id: 'shop-a', id: 'c1', type: 'bulk', title: 'T', body: 'B', image: 'https://img' } })

  expect(display.mock.calls[0][0].data).toEqual(expect.objectContaining({
    shop_id: 'shop-a', id: 'c1', type: 'bulk', title: 'T', body: 'B', message_id: 'm-1', image: 'https://img',
  }))
  display.mockRestore()
})

test('a push event sent from JavaScript carries the stored A/B group and no session', async () => {
  await AsyncStorage.setItem('@PersonaClick_shop-a_segment', 'B')

  await trackPush('shop-a', 'delivered', { code: 'c1', type: 'bulk', stream: 'android' })

  const [url, shopId, options] = request.mock.calls[0]
  expect(url).toBe('track/delivered')
  expect(shopId).toBe('shop-a')
  expect(options.params).toEqual({ shop_id: 'shop-a', segment: 'B', code: 'c1', type: 'bulk', stream: 'android' })
  expect(options.withoutSession).toBe(true)
})

test('code and type come from the data, or from src — an object or its JSON string', () => {
  expect(typeAndCode({ data: { id: 'c1', type: 'bulk' } })).toEqual({ code: 'c1', type: 'bulk' })
  expect(typeAndCode({ data: { src: { id: 'c2', type: 'chain' } } })).toEqual({ code: 'c2', type: 'chain' })
  expect(typeAndCode({ data: { src: '{"id":"c3","type":"transactional"}' } })).toEqual({ code: 'c3', type: 'transactional' })
  expect(typeAndCode({ data: {} })).toEqual({ code: undefined, type: undefined })
})
