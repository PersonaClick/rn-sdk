/**
 * Runs a tracking call of the story viewer so that nothing it does — a throw, a rejected promise —
 * reaches the tap: the element's link opens either way. `track` returns nothing, and chaining
 * `.catch` on it threw a TypeError before the link could open; `trackStoryClick` and
 * `trackStoryView` return promises that reject offline or on a bad id, and nothing caught them.
 */
export function trackFromStory(call) {
  Promise.resolve()
    .then(call)
    .catch((err) => {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('Story tracking failed:', err)
      }
    })
}

/** Product view from a story: a product element of a slide, or a product of the carousel. */
export function trackStoryProductView(sdk, productId, code) {
  trackFromStory(() =>
    sdk.track('view', {
      id: productId,
      recommended_by: 'stories',
      recommended_code: code,
    })
  )
}
