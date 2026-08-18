'use strict'

/**
 * Pure decision logic behind `PersonaClick.getInstance` (Release 3): given the requested `shopId` (or
 * none) and the sets of live and pending shops, decides which instance to return, whether one must
 * be lazily materialized, or which error to raise. Side-effect-free so the resolution rules can be
 * tested without constructing or initializing an SDK.
 *
 * Mirrors the Android `InstanceResolver` (`personalization-sdk`); the JS shape is a discriminated
 * object `{ type, shopId? }` instead of a Kotlin sealed interface.
 */

/**
 * Resolution kinds.
 * @readonly
 * @enum {string}
 */
export const ResolutionType = {
  /** An initialized instance exists for this shop — return it. */
  EXISTING: 'existing',
  /** A registration exists but is not initialized yet — materialize it now. */
  PENDING: 'pending',
  /** No live instance and no registration matches — raise UnknownShopIdError. */
  NOT_REGISTERED: 'notRegistered',
  /** No shopId given and more than one shop registered — raise AmbiguousShopError. */
  AMBIGUOUS: 'ambiguous',
}

/**
 * @param {string | null | undefined} requestedShopId
 * @param {Set<string> | Iterable<string>} liveShopIds
 * @param {Set<string> | Iterable<string>} pendingShopIds
 * @returns {{ type: string, shopId?: string }}
 */
export function resolve(requestedShopId, liveShopIds, pendingShopIds) {
  const live = liveShopIds instanceof Set ? liveShopIds : new Set(liveShopIds)
  const pending = pendingShopIds instanceof Set ? pendingShopIds : new Set(pendingShopIds)

  if (requestedShopId != null) {
    if (live.has(requestedShopId)) return { type: ResolutionType.EXISTING, shopId: requestedShopId }
    if (pending.has(requestedShopId)) return { type: ResolutionType.PENDING, shopId: requestedShopId }
    return { type: ResolutionType.NOT_REGISTERED }
  }

  const all = new Set([...live, ...pending])
  if (all.size === 0) return { type: ResolutionType.NOT_REGISTERED }
  if (all.size === 1) {
    const only = all.values().next().value
    return live.has(only)
      ? { type: ResolutionType.EXISTING, shopId: only }
      : { type: ResolutionType.PENDING, shopId: only }
  }
  return { type: ResolutionType.AMBIGUOUS }
}

export default { ResolutionType, resolve }
