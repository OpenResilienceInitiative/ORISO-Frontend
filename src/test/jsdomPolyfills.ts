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

/**
 * jsdom 24 does not implement the Web Storage API (localStorage/
 * sessionStorage) at all — added upstream only in jsdom 26. Several
 * production modules (notificationSettings store, thread unread state, the
 * i18n dev toolbar) read/write localStorage at module load or in effects, so
 * without this every jsdom-environment test touching them throws
 * "Cannot read properties of undefined". A minimal in-memory Storage
 * implementation is sufficient — tests only need get/set/remove/clear
 * semantics, not persistence across runs.
 */
class InMemoryStorage implements Storage {
	private store = new Map<string, string>();

	get length(): number {
		return this.store.size;
	}

	clear(): void {
		this.store.clear();
	}

	getItem(key: string): string | null {
		return this.store.has(key) ? this.store.get(key)! : null;
	}

	key(index: number): string | null {
		return Array.from(this.store.keys())[index] ?? null;
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	setItem(key: string, value: string): void {
		this.store.set(key, String(value));
	}
}

if (typeof window !== 'undefined') {
	if (typeof window.localStorage === 'undefined') {
		Object.defineProperty(window, 'localStorage', {
			value: new InMemoryStorage(),
			configurable: true
		});
	}
	if (typeof window.sessionStorage === 'undefined') {
		Object.defineProperty(window, 'sessionStorage', {
			value: new InMemoryStorage(),
			configurable: true
		});
	}
}
