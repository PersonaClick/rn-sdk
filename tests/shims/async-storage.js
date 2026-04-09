/** In-memory AsyncStorage for Jest. */
const mem = new Map()

const AsyncStorage = {
  getItem: (key) => Promise.resolve(mem.has(key) ? mem.get(key) : null),
  setItem: (key, value) => {
    mem.set(key, String(value))
    return Promise.resolve()
  },
  removeItem: (key) => {
    mem.delete(key)
    return Promise.resolve()
  },
  multiGet: (keys) =>
    Promise.resolve(keys.map((key) => [key, mem.has(key) ? mem.get(key) : null])),
  multiSet: (pairs) => {
    for (const [key, value] of pairs) {
      mem.set(key, String(value))
    }
    return Promise.resolve()
  },
  multiRemove: (keys) => {
    for (const key of keys) {
      mem.delete(key)
    }
    return Promise.resolve()
  },
  clearAll: () => {
    mem.clear()
    return Promise.resolve()
  },
}

export default AsyncStorage
