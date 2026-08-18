import { request } from '../lib/client.js'
import axios from 'axios'

// Regression guard for the cross-shop did leak. The PersonaClick backend sets a device `did` cookie on
// /init (scoped to .personaClick.ru). React Native shares one native cookie store across every request and
// defaults XHR `withCredentials` to true, so without an explicit opt-out a second shop's /init would
// replay the first shop's did cookie and both shops would collapse onto one server-assigned did.
// Every SDK request must therefore go out cookie-less (withCredentials: false); identity travels in
// the per-shop `did`/`seance` query params instead.

jest.mock('axios', () => jest.fn())

describe('SDK requests never carry cookies', () => {
  beforeEach(() => {
    axios.mockReset()
    axios.mockResolvedValue({ data: { did: 'd', seance: 's' } })
  })

  test('request() calls axios with withCredentials:false', async () => {
    await request('init', 'shop-x', { params: { shop_id: 'shop-x', stream: 'android' } })

    expect(axios).toHaveBeenCalledTimes(1)
    expect(axios.mock.calls[0][0]).toEqual(
      expect.objectContaining({ withCredentials: false })
    )
  })
})
