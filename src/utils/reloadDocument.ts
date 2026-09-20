/**
 * Loads the current address again as a document.
 *
 * A seam, not an abstraction: `window.location.reload()` cannot be spied on in
 * jsdom, so code that must prove it re-boots the app calls this instead.
 */
export const reloadDocument = () => window.location.reload();
