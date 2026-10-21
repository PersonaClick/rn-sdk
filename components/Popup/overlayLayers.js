import React, { useEffect, useState } from 'react'

/**
 * Extra overlay layers rendered by `<SdkPopupOverlay>` next to the in-app popup. A feature
 * registers its layer component when its own module is imported, so the overlay host never
 * imports feature code itself: an app that does not use the feature bundles nothing extra and
 * renders nothing extra.
 *
 * Used by the stories V2 `PersonalizationStories.show(...)` to present the viewer without a
 * mounted stories widget.
 */

/** @type {Map<string, Function>} key -> layer component */
const layers = new Map()
const listeners = new Set()

/**
 * Registers (or replaces) the layer under [key]. Mounted overlays re-render to pick it up.
 * @param {string} key
 * @param {Function} Component
 */
export function registerOverlayLayer(key, Component) {
  if (layers.get(key) === Component) return
  layers.set(key, Component)
  listeners.forEach((listener) => listener())
}

/** Number of mounted overlay hosts that render the layers. */
let mountedHosts = 0

/** True when at least one `<SdkPopupOverlay>` is mounted and renders the layers. */
export function hasOverlayHost() {
  return mountedHosts > 0
}

/** Renders every registered layer. Rendered once per `<SdkPopupOverlay>`. */
export function OverlayLayers() {
  const [, setVersion] = useState(0)
  useEffect(() => {
    mountedHosts += 1
    const listener = () => setVersion((value) => value + 1)
    listeners.add(listener)
    return () => {
      mountedHosts -= 1
      listeners.delete(listener)
    }
  }, [])
  return (
    <>
      {Array.from(layers.entries()).map(([key, Component]) => (
        <Component key={key} />
      ))}
    </>
  )
}
