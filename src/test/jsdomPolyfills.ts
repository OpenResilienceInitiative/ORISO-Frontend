/**
 * jsdom is missing a few layout APIs that ProseMirror/TipTap call from their
 * focus + scroll-into-view path. When the editor is focused in a test, that
 * path runs asynchronously (via a timer), so the missing method surfaces as an
 * *unhandled* error that Vitest counts as a failure — even when the assertion
 * itself would pass. It is timing-dependent, which is why it only flaked in CI.
 *
 * Polyfilling the missing methods with harmless empty-rect stubs removes the
 * error class deterministically. Everything here is guarded so the file is a
 * no-op in the node test environment (no DOM globals present).
 */

const emptyRect = (): DOMRect => ({
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	top: 0,
	left: 0,
	right: 0,
	bottom: 0,
	toJSON: () => ({})
});

const emptyRectList = (): DOMRectList => {
	const list = {
		length: 0,
		item: () => null,
		[Symbol.iterator]: function* () {
			// no rects in a headless DOM
		}
	};
	return list as unknown as DOMRectList;
};

if (typeof Range !== 'undefined') {
	if (typeof Range.prototype.getClientRects !== 'function') {
		Range.prototype.getClientRects = emptyRectList;
	}
	if (typeof Range.prototype.getBoundingClientRect !== 'function') {
		Range.prototype.getBoundingClientRect = emptyRect;
	}
}

if (typeof Element !== 'undefined') {
	if (typeof Element.prototype.getClientRects !== 'function') {
		Element.prototype.getClientRects = emptyRectList;
	}
	if (typeof Element.prototype.scrollIntoView !== 'function') {
		Element.prototype.scrollIntoView = () => {};
	}
}
