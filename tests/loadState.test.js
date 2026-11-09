import { createLoadController, isEmptyData, LoadState, LOAD_STATUS } from '../components/widgets/loadState'

// The internal load state of the data widgets: Idle | Loading | Content | Empty | Error, plus retry.

function setup(options) {
  const states = []
  const controller = createLoadController({ ...options, onChange: (state) => states.push(state) })
  return { controller, states }
}

describe('Load state', () => {
  test('starts idle', () => {
    expect(createLoadController().state).toBe(LoadState.idle)
    expect(LoadState.idle.status).toBe(LOAD_STATUS.IDLE)
  })

  test('loading, then content with the data', async () => {
    const { controller, states } = setup()
    const loading = controller.load(() => Promise.resolve([1, 2]))
    expect(controller.state).toBe(LoadState.loading)
    await loading
    expect(controller.state).toEqual({ status: 'content', data: [1, 2] })
    expect(states.map((s) => s.status)).toEqual(['loading', 'content'])
  })

  test('an empty answer is Empty; the widget may say what empty means', async () => {
    const { controller } = setup()
    await controller.load(() => Promise.resolve([]))
    expect(controller.state).toBe(LoadState.empty)
    await controller.load(() => Promise.resolve(null))
    expect(controller.state).toBe(LoadState.empty)

    const custom = createLoadController({ isEmpty: (data) => !data.recommends.length })
    await custom.load(() => Promise.resolve({ recommends: [] }))
    expect(custom.state.status).toBe('empty')
    await custom.load(() => Promise.resolve({ recommends: [{ id: 1 }] }))
    expect(custom.state.status).toBe('content')
  })

  test('a failure is Error with the error; the promise still resolves', async () => {
    const { controller } = setup()
    const error = new Error('offline')
    await expect(controller.load(() => Promise.reject(error))).resolves.toBeUndefined()
    expect(controller.state).toEqual({ status: 'error', error })

    await controller.load(() => {
      throw new Error('sync')
    })
    expect(controller.state.status).toBe('error')
    expect(controller.state.error.message).toBe('sync')
  })

  test('an SDK answer that is an error is Error, not Content', async () => {
    const { controller } = setup()
    const error = new Error('Network Error')
    await controller.load(() => Promise.resolve(error))
    expect(controller.state).toEqual({ status: 'error', error })
    await controller.load(() => Promise.resolve({ status: 'error', message: 'bad' }))
    expect(controller.state.status).toBe('error')
    expect(controller.state.error.message).toBe('bad')
  })

  test('an exception in isEmpty or onChange is Error, and the promise still resolves', async () => {
    const bug = new Error('host bug')
    const throwingEmpty = createLoadController({
      isEmpty: () => {
        throw bug
      },
    })
    await expect(throwingEmpty.load(() => Promise.resolve([1]))).resolves.toBeUndefined()
    expect(throwingEmpty.state).toEqual({ status: 'error', error: bug })

    const seen = []
    const throwingOnContent = createLoadController({
      onChange: (state) => {
        seen.push(state.status)
        if (state.status === 'content') throw bug
      },
    })
    await expect(throwingOnContent.load(() => Promise.resolve([1]))).resolves.toBeUndefined()
    expect(throwingOnContent.state).toEqual({ status: 'error', error: bug })
    expect(seen).toEqual(['loading', 'content', 'error'])

    const loader = jest.fn().mockResolvedValue([1])
    const alwaysThrowing = createLoadController({
      onChange: () => {
        throw bug
      },
    })
    await expect(alwaysThrowing.load(loader)).resolves.toBeUndefined()
    expect(alwaysThrowing.state).toEqual({ status: 'error', error: bug })
    expect(loader).not.toHaveBeenCalled()
  })

  test('retry runs the last load again', async () => {
    const { controller, states } = setup()
    const loader = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(['ok'])
    await controller.load(loader)
    expect(controller.state.status).toBe('error')

    await controller.retry()
    expect(loader).toHaveBeenCalledTimes(2)
    expect(controller.state).toEqual({ status: 'content', data: ['ok'] })
    expect(states.map((s) => s.status)).toEqual(['loading', 'error', 'loading', 'content'])
  })

  test('the loader is told to force on retry only, so Retry goes past the request cache', async () => {
    const { controller } = setup()
    const loader = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(['ok'])
    await controller.load(loader)
    await controller.retry()
    expect(loader.mock.calls).toEqual([[{ force: false }], [{ force: true }]])
  })

  test('retry without a load does nothing', async () => {
    const { controller, states } = setup()
    await controller.retry()
    expect(controller.state).toBe(LoadState.idle)
    expect(states).toEqual([])
  })

  test('an answer of an outdated load is dropped', async () => {
    const { controller } = setup()
    let finishFirst
    const first = controller.load(() => new Promise((resolve) => (finishFirst = resolve)))
    const second = controller.load(() => Promise.resolve(['second']))
    await second
    finishFirst(['first'])
    await first
    expect(controller.state).toEqual({ status: 'content', data: ['second'] })
  })

  test('reset goes idle and drops the answer in flight; retry has nothing to repeat', async () => {
    const { controller } = setup()
    let finish
    const pending = controller.load(() => new Promise((resolve) => (finish = resolve)))
    controller.reset()
    finish(['late'])
    await pending
    expect(controller.state).toBe(LoadState.idle)
    await controller.retry()
    expect(controller.state).toBe(LoadState.idle)
  })

  test('isEmptyData: nothing or an empty array', () => {
    expect(isEmptyData(undefined)).toBe(true)
    expect(isEmptyData([])).toBe(true)
    expect(isEmptyData([0])).toBe(false)
    expect(isEmptyData({})).toBe(false)
  })
})
