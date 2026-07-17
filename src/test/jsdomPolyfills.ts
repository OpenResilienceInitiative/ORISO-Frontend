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
 * Node >= 22 ships its own `localStorage`/`sessionStorage` globals (behind
 * `--localstorage-file`; enabled by default in recent versions). Without that
 * flag the global is a getter that returns `undefined`. Vitest's jsdom
 * environment only copies window keys onto `globalThis` when they are absent
 * there or on its known-keys allowlist — and the Web Storage globals are on
 * neither (vitest 3.2.x), so Node's undefined-returning getter shadows
 * jsdom's working implementation. Any test (or module under test) touching
 * bare `localStorage` then crashes with
 * "Cannot read properties of undefined (reading 'getItem')".
 *
 * Bridge the gap with an in-memory Storage — same semantics jsdom would have
 * provided. Guarded so it is a no-op under the node environment and on
 * runtimes where the environment already supplies a real Storage.
 */
class MemoryStorage {
	private store = new Map<string, string>();
	get length(): number {
		return this.store.size;
	}
	clear(): void {
		this.store.clear();
	}
	getItem(key: string): string | null {
		return this.store.get(String(key)) ?? null;
	}
	key(index: number): string | null {
		return [...this.store.keys()][index] ?? null;
	}
	removeItem(key: string): void {
		this.store.delete(String(key));
	}
	setItem(key: string, value: string): void {
		this.store.set(String(key), String(value));
	}
}

if (typeof document !== 'undefined') {
	for (const key of ['localStorage', 'sessionStorage'] as const) {
		let storageMissing = false;
		try {
			storageMissing = globalThis[key] === undefined;
		} catch {
			storageMissing = true;
		}
		if (storageMissing) {
			Object.defineProperty(globalThis, key, {
				value: new MemoryStorage(),
				configurable: true,
				writable: true
			});
		}
	}
}
