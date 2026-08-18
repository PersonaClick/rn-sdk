import PersonaClick, { UnknownShopIdError, AmbiguousShopError } from '../index.js'

// Smoke test for the public facade wired onto the PersonaClick class (Release 3, index.js). Verifies the
// static methods exist and delegate, the error classes are exported, and the index <-> facade
// factory cycle is broken (importing index sets the factory). Avoids constructing a real SDK so no
// network init() fires — the resolution logic itself is covered in facade.test.js.

beforeEach(() => {
  PersonaClick.reset() // clears pending registrations
})

describe('PersonaClick facade class', () => {
  test('exposes the static facade methods', () => {
    expect(typeof PersonaClick.initialize).toBe('function')
    expect(typeof PersonaClick.registerShops).toBe('function')
    expect(typeof PersonaClick.getInstance).toBe('function')
    expect(typeof PersonaClick.isInitialized).toBe('function')
    expect(typeof PersonaClick.awaitInstance).toBe('function')
  })

  test('is still a constructable class (back-compat)', () => {
    // The deprecated `new PersonaClick(...)` path stays a class extending the SDK — its prototype carries
    // the instance API (track, recommend, ...). Not instantiated here to avoid the network init().
    expect(typeof PersonaClick).toBe('function')
    expect(typeof PersonaClick.prototype.track).toBe('function')
    expect(typeof PersonaClick.prototype.recommend).toBe('function')
  })

  test('getInstance with nothing registered throws UnknownShopIdError', () => {
    expect(() => PersonaClick.getInstance()).toThrow(UnknownShopIdError)
  })

  test('registerShops (lazy) leaves the shop uninitialized until first use', () => {
    PersonaClick.registerShops([{ shopId: 'shop-a' }])
    expect(PersonaClick.isInitialized('shop-a')).toBe(false)
  })

  test('exports the error classes and they subclass Error', () => {
    expect(new UnknownShopIdError('x')).toBeInstanceOf(Error)
    expect(new AmbiguousShopError('x')).toBeInstanceOf(Error)
    expect(new UnknownShopIdError('x').name).toBe('UnknownShopIdError')
    expect(new AmbiguousShopError('x').name).toBe('AmbiguousShopError')
  })
})
