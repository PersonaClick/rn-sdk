import PersonaClick from '../index.js'

// Device-id policy: the SDK must NOT seed the did with a hardware id. The first `/init` for a fresh
// install goes out with an empty did and the server-assigned did is persisted; two shops on one
// device therefore get DISTINCT server-assigned dids/seances (multi-instance isolation). An existing
// install (cached did) reuses it, and an explicit host-provided deviceInfo.id is honored. Mirror of
// the Android RegisterManagerDidTest.

const mockRequest = jest.fn()
const mockGetData = jest.fn()

jest.mock('../lib/client.js', () => {
  const actual = jest.requireActual('../lib/client.js')
  return {
    ...actual,
    request: (...args) => mockRequest(...args),
    getData: (...args) => mockGetData(...args),
  }
})

async function waitForInit(sdk) {
  for (let i = 0; i < 200; i++) {
    if (sdk.isInit()) return
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error('SDK did not initialize in time')
}

function initParamsFor(shopId) {
  const call = mockRequest.mock.calls.find(
    ([endpoint, sid]) => endpoint === 'init' && (shopId === undefined || sid === shopId)
  )
  return call ? call[2].params : null
}

describe('MainSDK did policy (no hardware seeding)', () => {
  beforeEach(() => {
    mockRequest.mockReset()
    mockGetData.mockReset()
    mockGetData.mockResolvedValue({}) // fresh install by default: no cached did
    mockRequest.mockImplementation((endpoint, shopId) => {
      if (endpoint === 'init') {
        // Server mints a did/seance per shop_id when the request carries no did.
        return Promise.resolve({ did: `did-${shopId}`, seance: `seance-${shopId}` })
      }
      return Promise.resolve({})
    })
  })

  afterEach(() => jest.clearAllMocks())

  test('a fresh install sends no did — the server assigns it', async () => {
    const sdk = new PersonaClick('shop-fresh', 'android', false, false)
    jest.spyOn(sdk, 'push').mockImplementation((cb) => cb())
    await waitForInit(sdk)

    expect(initParamsFor('shop-fresh')).toBeTruthy()
    expect(initParamsFor('shop-fresh').did).toBeUndefined()
    expect(sdk.deviceId).toBe('did-shop-fresh')
    expect(sdk.userSeance).toBe('seance-shop-fresh')
  })

  test('two shops on one device get DISTINCT server-assigned dids and seances', async () => {
    const a = new PersonaClick('shop-a', 'android', false, false)
    const b = new PersonaClick('shop-b', 'android', false, false)
    jest.spyOn(a, 'push').mockImplementation((cb) => cb())
    jest.spyOn(b, 'push').mockImplementation((cb) => cb())
    await waitForInit(a)
    await waitForInit(b)

    // Neither shop leaked a shared hardware did into its /init.
    expect(initParamsFor('shop-a').did).toBeUndefined()
    expect(initParamsFor('shop-b').did).toBeUndefined()

    expect(a.deviceId).toBe('did-shop-a')
    expect(b.deviceId).toBe('did-shop-b')
    expect(a.deviceId).not.toBe(b.deviceId)
    expect(a.userSeance).not.toBe(b.userSeance)
  })

  test('an existing install reuses its cached did (no re-identification)', async () => {
    mockGetData.mockResolvedValue({ did: 'CACHED_DID' })
    const sdk = new PersonaClick('shop-existing', 'android', false, false)
    jest.spyOn(sdk, 'push').mockImplementation((cb) => cb())
    await waitForInit(sdk)

    expect(initParamsFor('shop-existing').did).toBe('CACHED_DID')
  })
})
