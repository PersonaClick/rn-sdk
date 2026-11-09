import { sdkError, sdkResult } from '../components/widgets/sdkResult'

// SDK methods resolve with the error instead of rejecting (lib/client.js request()); the adapter
// turns such answers into rejections for the data widgets.

describe('sdkResult', () => {
  test('a resolved Error (network, axios) rejects with it', async () => {
    const error = new Error('Network Error')
    await expect(sdkResult(Promise.resolve(error))).rejects.toBe(error)
  })

  test('an error body rejects with its message and keeps the body', async () => {
    const body = { status: 'error', message: 'Incorrect shop credentials' }
    const rejection = sdkResult(Promise.resolve(body)).catch((e) => e)
    const error = await rejection
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Incorrect shop credentials')
    expect(error.response).toBe(body)
  })

  test('a body with an HTTP error status rejects', async () => {
    await expect(sdkResult({ status: 400 })).rejects.toThrow('Request failed: 400')
    await expect(sdkResult({ status: 503, message: 'down' })).rejects.toThrow('down')
  })

  test('a normal answer resolves as is; a rejection passes through', async () => {
    const answer = { products: [], products_total: 0, status: 200 }
    await expect(sdkResult(Promise.resolve(answer))).resolves.toBe(answer)
    await expect(sdkResult('plain')).resolves.toBe('plain')
    const error = new Error('rejected')
    await expect(sdkResult(Promise.reject(error))).rejects.toBe(error)
  })

  test('an answer of an unexpected shape rejects when a check is given', async () => {
    const isList = (r) => Array.isArray(r && r.products)
    await expect(sdkResult({ html: '<html>' }, isList)).rejects.toThrow('Unexpected response')
    await expect(sdkResult({ products: [] }, isList)).resolves.toEqual({ products: [] })
  })

  test('sdkError: only errors are errors', () => {
    expect(sdkError(null)).toBeNull()
    expect(sdkError({ status: 'success' })).toBeNull()
    expect(sdkError({ status: 200 })).toBeNull()
    expect(sdkError([])).toBeNull()
  })
})
