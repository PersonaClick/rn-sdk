import { migrateLegacyIdentity, getData } from '../lib/client.js'
import { getStorageKey } from '../utils'
import AsyncStorage from '@react-native-async-storage/async-storage'

// The single-shop upgrade guarantee. Before per-shop partitioning (v2.0.0) did/session lived in one
// global AsyncStorage blob at '@PersonaClick'; partitioning moved them to '@PersonaClick_<shopId>_' WITHOUT carrying
// the old value forward, so a v1 -> v2 single-shop upgrade read an empty partition and was silently
// re-registered by the server (a fresh did). migrateLegacyIdentity adopts the pre-partition identity
// into the first shop's partition, consume-once, so the did survives — parity with the native
// iOS/Android migration. These assert it through the REAL AsyncStorage round-trip (the in-memory shim),
// i.e. the exact getData() path MainSDK.init reads to attach the did to the first /init.

const LEGACY_KEY = '@PersonaClick' // SDK_STORAGE_NAME — the pre-partition global store

beforeEach(() => AsyncStorage.clearAll())

const seedLegacy = (blob) => AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(blob))

describe('single-shop upgrade — legacy identity migration', () => {
  test('an existing single-shop install keeps its did/seance after upgrade', async () => {
    await seedLegacy({ did: 'OLD_DID', seance: 'OLD_SID', sid: 'OLD_SID' })

    await migrateLegacyIdentity('shop-a')

    // getData is exactly what MainSDK.init reads to attach the did to the first /init.
    const data = await getData('shop-a')
    expect(data.did).toBe('OLD_DID')
    expect(data.seance).toBe('OLD_SID')
    // Landed in the shop partition, not left only in the global blob.
    const partition = JSON.parse(await AsyncStorage.getItem(getStorageKey('', 'shop-a')))
    expect(partition.did).toBe('OLD_DID')
  })

  test('a second shop does not clone the legacy identity (consume-once)', async () => {
    await seedLegacy({ did: 'OLD_DID', seance: 'OLD_SID' })

    await migrateLegacyIdentity('shop-a') // first shop adopts it
    await migrateLegacyIdentity('shop-b') // a second shop must start fresh

    expect((await getData('shop-a')).did).toBe('OLD_DID')
    expect((await getData('shop-b')).did).toBeUndefined()
  })

  test('migration does not overwrite a shop that already has a did', async () => {
    await seedLegacy({ did: 'OLD_DID' })
    await AsyncStorage.setItem(getStorageKey('', 'shop-a'), JSON.stringify({ did: 'PARTITION_DID' }))

    await migrateLegacyIdentity('shop-a')

    expect((await getData('shop-a')).did).toBe('PARTITION_DID')
  })

  test('a fresh install with no legacy identity adopts nothing', async () => {
    await migrateLegacyIdentity('shop-a')

    expect((await getData('shop-a')).did).toBeUndefined()
  })
})
