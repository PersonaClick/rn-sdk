import { attachStoriesShowHost, requestStoriesShow, activeStoriesShow } from '../components/widgets/storiesShow'

// PersonalizationStories.show(...) — the request queue behind the overlay host (rule D / B8).

describe('Stories V2 — show without a bar', () => {
  test('without a host the promise resolves at once and onError explains why', async () => {
    const onError = jest.fn()
    await requestStoriesShow({ code: 'x', onError })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(String(onError.mock.calls[0][0])).toMatch(/SdkPopupOverlay/)
  })

  test('the host renders the request; finishing it clears the host and resolves', async () => {
    const rendered = []
    const detach = attachStoriesShowHost((request) => rendered.push(request))
    const done = jest.fn()
    const shown = requestStoriesShow({ code: 'x', startStoryId: 40 }).then(done)
    expect(rendered[0].options).toEqual({ code: 'x', startStoryId: 40 })
    activeStoriesShow().finish()
    await shown
    expect(done).toHaveBeenCalled()
    expect(rendered[1]).toBeNull()
    detach()
  })

  test('a new show replaces the current one, which resolves', async () => {
    const rendered = []
    const detach = attachStoriesShowHost((request) => rendered.push(request))
    const first = requestStoriesShow({ code: 'a' })
    requestStoriesShow({ code: 'b' })
    await first
    expect(activeStoriesShow().options.code).toBe('b')
    activeStoriesShow().finish()
    detach()
  })
})

describe('Stories V2 — widget module', () => {
  test('exports a ref-forwarding component with a static show()', () => {
    const PersonalizationStories = require('../components/widgets/Stories').default
    expect(typeof PersonalizationStories.show).toBe('function')
    expect(PersonalizationStories.$$typeof).toBe(Symbol.for('react.forward_ref'))
  })
})
