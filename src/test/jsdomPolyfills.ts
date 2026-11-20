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

/**
 * jsdom ships no `ResizeObserver`, and application code is entitled to expect
 * one — `pond.js` (the verbatim-ported call backdrop) observes itself in
 * `connectedCallback`, where a missing global surfaces as an *unhandled*
 * error during React's commit phase rather than as a failed assertion.
 *
 * The stub observes nothing, which is the honest behaviour for a DOM with no
 * layout: there are no size changes to report. Code that needs a real
 * callback stubs its own, as `FilterChipRow.test.tsx` does.
 */
if (typeof document !== 'undefined' && typeof ResizeObserver === 'undefined') {
	Object.defineProperty(globalThis, 'ResizeObserver', {
		configurable: true,
		writable: true,
		value: class {
			observe(): void {}
			unobserve(): void {}
			disconnect(): void {}
		}
	});
}

/**
 * jsdom has no 2D canvas: the optional `canvas` package is not installed, so
 * `getContext('2d')` returns `null`. Any code that then reaches for a drawing
 * method throws — and because the throw happens inside a custom element's
 * `connectedCallback` or inside Lottie's module body, it surfaces as an
 * *unhandled* error that collapses the whole test file rather than as a
 * failed assertion.
 *
 * Two real cases in this repository, both of which did exactly that:
 *   - `pond.js`, the verbatim-ported call backdrop, calls `setTransform` from
 *     its own `resize()` on connect;
 *   - `lottie-web` sets `fillStyle` while loading, which took down the whole
 *     group-call harness test.
 *
 * The stub records nothing and draws nothing, which is the honest behaviour
 * for a DOM with no pixels. A test that needs to inspect what was drawn has
 * to run in the browser project, where there is a real canvas — and that is
 * where this repository already measures contrast and geometry.
 */
if (typeof HTMLCanvasElement !== 'undefined') {
	const stub2d = (): CanvasRenderingContext2D => {
		const noop = (): void => {};
		const context: Record<string, unknown> = {
			canvas: null,
			// Filled below; these two return values rather than undefined
			// because callers use them.
			createLinearGradient: () => ({ addColorStop: noop }),
			createRadialGradient: () => ({ addColorStop: noop }),
			createPattern: () => null,
			getImageData: () => ({
				data: new Uint8ClampedArray(4),
				width: 1,
				height: 1
			}),
			measureText: () => ({ width: 0 }),
			getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
			getLineDash: () => [],
			isPointInPath: () => false,
			isPointInStroke: () => false
		};
		for (const name of [
			'arc',
			'arcTo',
			'beginPath',
			'bezierCurveTo',
			'clearRect',
			'clip',
			'closePath',
			'drawImage',
			'ellipse',
			'fill',
			'fillRect',
			'fillText',
			'lineTo',
			'moveTo',
			'putImageData',
			'quadraticCurveTo',
			'rect',
			'resetTransform',
			'restore',
			'rotate',
			'save',
			'scale',
			'setLineDash',
			'setTransform',
			'stroke',
			'strokeRect',
			'strokeText',
			'transform',
			'translate'
		])
			context[name] = noop;
		return context as unknown as CanvasRenderingContext2D;
	};

	const original = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function getContext(
		this: HTMLCanvasElement,
		...args: Parameters<HTMLCanvasElement['getContext']>
	) {
		const real = original?.apply(this, args) ?? null;
		if (real !== null) return real;
		const context = args[0] === '2d' ? stub2d() : null;
		if (context !== null)
			Object.defineProperty(context, 'canvas', { value: this });
		return context;
	} as HTMLCanvasElement['getContext'];
}
