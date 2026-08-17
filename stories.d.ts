import type { ComponentType } from 'react'

/**
 * Common way to point a stories component at an SDK instance: pass an explicit `sdk`, or a `shopId`
 * to resolve one through the registry (Release 3). Use one or the other — `sdk` wins if both given.
 */
export interface StoriesSdkProps {
  /** SDK instance. Optional if `shopId` is given. */
  sdk?: unknown
  /** Resolve the SDK by shop id through the registry. Ignored when `sdk` is passed. */
  shopId?: string
  /** Stories code identifier. */
  code?: string
  [key: string]: unknown
}

/** @see ./components/Stories/StoriesList */
export const StoriesList: ComponentType<StoriesSdkProps>
/** @see ./components/Stories/StoryViewer */
export const StoryViewer: ComponentType<StoriesSdkProps>
