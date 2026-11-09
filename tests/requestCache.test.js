import {
  createRequestCache,
  requestCacheKey,
  REQUEST_CACHE_LIMIT,
  REQUEST_CACHE_STALL,
  REQUEST_CACHE_TTL,
} from '../components/widgets/requestCache'

// The in-memory cache behind the data widgets: TTL, size limit, in-flight merging, no cached errors.

function setup(options = {}) {
  let time = 0
  const clock = {
    now: () => time,
    advance: (ms) => {
      time += ms
    },
  }
  return { cache: createRequestCache({ now: clock.now, ...options }), clock }
}

describe('Request cache — key', () => {
  test('shop, kind and params make the key; param order does not matter', () => {
    const a = requestCacheKey('shop', 'recommend', { code: 'x', item: 1, extra: undefined })
    expect(a).toBe(requestCacheKey('shop', 'recommend', { item: 1, code: 'x' }))
    expect(a).not.toBe(requestCacheKey('other', 'recommend', { item: 1, code: 'x' }))
    expect(a).not.toBe(requestCacheKey('shop', 'collection', { item: 1, code: 'x' }))
    expect(a).not.toBe(requestCacheKey('shop', 'recommend', { item: 2, code: 'x' }))
    expect(requestCacheKey('shop', 'recommend')).toBe(requestCacheKey('shop', 'recommend', {}))
  })

  test('values with a separator inside, dates, maps and sets do not collide', () => {
    expect(requestCacheKey('a|b', 'c', {})).not.toBe(requestCacheKey('a', 'b|c', {}))
    expect(requestCacheKey('s', 'search', { query: 'tv&sort=price' })).not.toBe(
      requestCacheKey('s', 'search', { query: 'tv', sort: 'price' }),
    )
    expect(requestCacheKey('s', 'k', { from: new Date(0) })).not.toBe(requestCacheKey('s', 'k', { from: new Date(1000) }))
    expect(requestCacheKey('s', 'k', { ids: new Set([1]) })).not.toBe(requestCacheKey('s', 'k', { ids: new Set([2]) }))
    expect(requestCacheKey('s', 'k', { ids: new Set([1, 2]) })).toBe(requestCacheKey('s', 'k', { ids: new Set([2, 1]) }))
    expect(requestCacheKey('s', 'k', { m: new Map([['a', 1]]) })).not.toBe(requestCacheKey('s', 'k', { m: new Map([['a', 2]]) }))
  })
})

describe('Request cache — load', () => {
  test('a fresh answer is served without a new request, for 10 minutes', async () => {
    const { cache, clock } = setup()
    const loader = jest.fn().mockResolvedValue({ products: [1] })

    await expect(cache.load('k', loader)).resolves.toEqual({ products: [1] })
    clock.advance(REQUEST_CACHE_TTL - 1)
    await expect(cache.load('k', loader)).resolves.toEqual({ products: [1] })
    expect(cache.peek('k')).toEqual({ products: [1] })
    expect(loader).toHaveBeenCalledTimes(1)

    clock.advance(1)
    expect(cache.peek('k')).toBeUndefined()
    await cache.load('k', loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('the same request in flight is made once', async () => {
    const { cache } = setup()
    let finish
    const loader = jest.fn(() => new Promise((resolve) => (finish = resolve)))

    const first = cache.load('k', loader)
    const second = cache.load('k', loader)
    expect(loader).toHaveBeenCalledTimes(1)
    finish('answer')
    await expect(Promise.all([first, second])).resolves.toEqual(['answer', 'answer'])
    expect(cache.size).toBe(1)
  })

  test('errors are not cached, and callers in flight all get the error', async () => {
    const { cache } = setup()
    const loader = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('ok')

    const first = cache.load('k', loader)
    const second = cache.load('k', loader)
    await expect(first).rejects.toThrow('offline')
    await expect(second).rejects.toThrow('offline')
    expect(cache.size).toBe(0)
    expect(cache.peek('k')).toBeUndefined()

    await expect(cache.load('k', loader)).resolves.toBe('ok')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('an SDK answer that is an error rejects and is not cached', async () => {
    const { cache } = setup()
    const networkError = new Error('Network Error')
    const loader = jest
      .fn()
      .mockResolvedValueOnce(networkError)
      .mockResolvedValueOnce({ status: 'error', message: 'Incorrect shop credentials' })
      .mockResolvedValueOnce({ recommends: [] })

    await expect(cache.load('k', loader)).rejects.toBe(networkError)
    expect(cache.peek('k')).toBeUndefined()
    await expect(cache.load('k', loader)).rejects.toThrow('Incorrect shop credentials')
    expect(cache.size).toBe(0)
    await expect(cache.load('k', loader)).resolves.toEqual({ recommends: [] })
    expect(loader).toHaveBeenCalledTimes(3)
  })

  test('a loader that throws synchronously is a rejected load', async () => {
    const { cache } = setup()
    await expect(
      cache.load('k', () => {
        throw new Error('bad')
      }),
    ).rejects.toThrow('bad')
    expect(cache.size).toBe(0)
  })

  test('holds 32 entries; the oldest goes first', async () => {
    const { cache, clock } = setup()
    for (let i = 0; i < REQUEST_CACHE_LIMIT; i += 1) {
      await cache.load(`k${i}`, () => Promise.resolve(i))
      clock.advance(1)
    }
    expect(cache.size).toBe(REQUEST_CACHE_LIMIT)

    await cache.load('new', () => Promise.resolve('new'))
    expect(cache.size).toBe(REQUEST_CACHE_LIMIT)
    expect(cache.peek('k0')).toBeUndefined()
    expect(cache.peek('k1')).toBe(1)
    expect(cache.peek('new')).toBe('new')
  })

  test('a refreshed entry counts as the newest', async () => {
    const { cache, clock } = setup({ limit: 2 })
    await cache.load('a', () => Promise.resolve('a1'))
    await cache.load('b', () => Promise.resolve('b'))
    clock.advance(REQUEST_CACHE_TTL)
    await cache.load('a', () => Promise.resolve('a2'))
    await cache.load('c', () => Promise.resolve('c'))
    expect(cache.peek('a')).toBe('a2')
    expect(cache.peek('b')).toBeUndefined()
  })

  test('clear() drops everything; an answer started before it is not stored', async () => {
    const { cache } = setup()
    await cache.load('k', () => Promise.resolve(1))
    let finish
    const pending = cache.load('late', () => new Promise((resolve) => (finish = resolve)))

    cache.clear()
    expect(cache.size).toBe(0)
    finish('late')
    await expect(pending).resolves.toBe('late')
    expect(cache.peek('late')).toBeUndefined()
  })
})

describe('Request cache — a request in flight never locks the key', () => {
  // A loader whose answers the test releases by hand, one per call.
  function manualLoader() {
    const calls = []
    const loader = jest.fn(() => new Promise((resolve, reject) => calls.push({ resolve, reject })))
    return { loader, calls }
  }
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  test('a request hung for 30 s takes no new waiters: a new one goes to the network', async () => {
    const { cache, clock } = setup()
    const { loader, calls } = manualLoader()
    const first = cache.load('k', loader)
    clock.advance(REQUEST_CACHE_STALL - 1)
    cache.load('k', loader)
    expect(loader).toHaveBeenCalledTimes(1)

    clock.advance(1)
    const second = cache.load('k', loader)
    expect(loader).toHaveBeenCalledTimes(2)

    // The new generation answers first and is stored; the late old answer goes to its own waiters only.
    calls[1].resolve('new')
    await expect(second).resolves.toBe('new')
    calls[0].resolve('old')
    await expect(first).resolves.toBe('old')
    expect(cache.peek('k')).toBe('new')
  })

  test('an old generation answering before the new one is not stored', async () => {
    const { cache, clock } = setup()
    const { loader, calls } = manualLoader()
    cache.load('k', loader)
    clock.advance(REQUEST_CACHE_STALL)
    const second = cache.load('k', loader)
    calls[0].resolve('old')
    await flush()
    expect(cache.peek('k')).toBeUndefined()
    calls[1].resolve('new')
    await second
    expect(cache.peek('k')).toBe('new')
  })

  test('when every waiter unsubscribes, the same key loads again', async () => {
    const { cache } = setup()
    const { loader, calls } = manualLoader()
    const onValue = jest.fn()
    const offA = cache.subscribe('k', loader, { onValue })
    const offB = cache.subscribe('k', loader, { onValue })
    expect(loader).toHaveBeenCalledTimes(1)
    offA()
    offB()

    const again = cache.load('k', loader)
    expect(loader).toHaveBeenCalledTimes(2)
    calls[0].resolve('first')
    calls[1].resolve('second')
    await expect(again).resolves.toBe('second')
    // Unsubscribed waiters are never called.
    expect(onValue).not.toHaveBeenCalled()
  })

  test('clear() in flight: the answer reaches its waiters but is not stored; the key loads anew', async () => {
    const { cache } = setup()
    const { loader, calls } = manualLoader()
    const pending = cache.load('k', loader)
    cache.clear()
    cache.load('k', loader)
    expect(loader).toHaveBeenCalledTimes(2)
    calls[0].resolve('before clear')
    await expect(pending).resolves.toBe('before clear')
    expect(cache.peek('k')).toBeUndefined()
  })

  test('force goes past a fresh answer and past the request in flight', async () => {
    const { cache } = setup()
    await cache.load('k', () => Promise.resolve('cached'))
    const forced = jest.fn().mockResolvedValue('forced')
    await expect(cache.load('k', forced, { force: true })).resolves.toBe('forced')
    expect(cache.peek('k')).toBe('forced')

    const { loader, calls } = manualLoader()
    cache.load('other', loader)
    cache.load('other', loader, { force: true })
    expect(loader).toHaveBeenCalledTimes(2)
    calls.forEach((call) => call.resolve('x'))
  })

  test('a waiter whose callback throws does not stop the others', async () => {
    const { cache } = setup()
    const { loader, calls } = manualLoader()
    const after = jest.fn()
    cache.subscribe('k', loader, {
      onValue: () => {
        throw new Error('host bug')
      },
    })
    cache.subscribe('k', loader, { onValue: after })
    calls[0].resolve('answer')
    await flush()
    expect(after).toHaveBeenCalledWith('answer')
    expect(cache.peek('k')).toBe('answer')

    const failed = manualLoader()
    const onError = jest.fn()
    cache.subscribe('e', failed.loader, {
      onError: () => {
        throw new Error('host bug')
      },
    })
    cache.subscribe('e', failed.loader, { onError })
    failed.calls[0].reject(new Error('offline'))
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  test('a cached answer is delivered asynchronously and not after unsubscribe', async () => {
    const { cache } = setup()
    await cache.load('k', () => Promise.resolve('cached'))
    const onValue = jest.fn()
    cache.subscribe('k', () => Promise.resolve('unused'), { onValue })
    expect(onValue).not.toHaveBeenCalled()
    await flush()
    expect(onValue).toHaveBeenCalledWith('cached')

    const late = jest.fn()
    const off = cache.subscribe('k', () => Promise.resolve('unused'), { onValue: late })
    off()
    await flush()
    expect(late).not.toHaveBeenCalled()
  })
})
