import PersonaClick from '../index.js'
import { trackFromStory, trackStoryProductView } from '../components/Stories/storyTracking'

const mockRequest = jest.fn()
jest.mock('../lib/client.js', () => {
  const actual = jest.requireActual('../lib/client.js')
  return {
    ...actual,
    request: (...args) => mockRequest(...args),
  }
})

const tick = () => new Promise(setImmediate)

// The story viewer tracks a tap — the element's click, a product's view — and goes on to open the
// element's link. Nothing a tracking call does reaches the tap: chaining on `track`, which returns
// nothing, threw a TypeError before the link opened.
describe('Stories — tracking from the viewer', () => {
  let sdk
  let warn

  beforeEach(() => {
    jest.spyOn(PersonaClick.prototype, 'init').mockImplementation(() => {})
    mockRequest.mockImplementation(() => Promise.resolve({}))
    sdk = new PersonaClick('357382bf66ac0ce2f1722677c59511', 'android', true)
    jest.spyOn(sdk, 'push').mockImplementation((callback) => callback())
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    mockRequest.mockReset()
  })

  test('a product view goes out as a view of that product from the story', async () => {
    trackStoryProductView(sdk, 'p1', 'story-code')
    await tick()

    const pushes = mockRequest.mock.calls.filter(([url]) => url === 'push').map((call) => call[2].params)
    expect(pushes).toHaveLength(1)
    expect(pushes[0]).toMatchObject({
      event: 'view',
      items: [{ id: 'p1' }],
      recommended_by: 'stories',
      recommended_code: 'story-code',
    })
  })

  test('a tracking call that throws does not reach the tap', async () => {
    expect(() => trackFromStory(() => { throw new TypeError('no track') })).not.toThrow()
    expect(() => trackStoryProductView({}, 'p1', 'story-code')).not.toThrow()
    await tick()

    expect(warn).toHaveBeenCalledTimes(2)
  })

  test('a tracking call whose promise rejects is caught', async () => {
    const rejected = jest.fn()
    process.on('unhandledRejection', rejected)
    try {
      trackFromStory(() => Promise.reject(new Error('offline')))
      await tick()
      await tick()
    } finally {
      process.off('unhandledRejection', rejected)
    }

    expect(rejected).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('Story tracking failed:', expect.any(Error))
  })
})
