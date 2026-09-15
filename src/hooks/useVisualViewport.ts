import { useEffect, useState } from 'react';

export interface VisualViewportMetrics {
	/** Height of the area the user can actually see, in px. */
	height: number;
	/** How far the visual viewport is scrolled down inside the layout one. */
	offsetTop: number;
	/**
	 * Gap between the bottom of the layout viewport and the bottom of the
	 * visible one — the soft keyboard, essentially. 0 when nothing covers it.
	 */
	bottomInset: number;
}

const readViewport = (): VisualViewportMetrics | null => {
	const viewport = window.visualViewport;
	if (!viewport) {
		return null;
	}
	const height = Math.round(viewport.height);
	const offsetTop = Math.round(viewport.offsetTop);
	return {
		height,
		offsetTop,
		// window.innerHeight stays at the layout viewport on iOS Safari when
		// the keyboard opens, which is exactly the difference we want.
		bottomInset: Math.max(
			0,
			Math.round(window.innerHeight - height - offsetTop)
		)
	};
};

const sameMetrics = (
	a: VisualViewportMetrics | null,
	b: VisualViewportMetrics | null
): boolean =>
	a === b ||
	(!!a &&
		!!b &&
		a.height === b.height &&
		a.offsetTop === b.offsetTop &&
		a.bottomInset === b.bottomInset);

/**
 * Tracks `window.visualViewport` — the part of the page the user can actually
 * see (ORISO-Frontend#1248).
 *
 * On iOS Safari the *layout* viewport does not shrink when the soft keyboard
 * opens, so `100vh`, `inset: 0` and `bottom: X` all resolve against a rectangle
 * roughly twice the height of what is visible. Anything sized or anchored that
 * way ends up partly behind the keyboard. `visualViewport` is the only API that
 * reports the real thing.
 *
 * Returns `null` where the API is missing (older Safari, jsdom, SSR). Callers
 * are expected to fall back to `100dvh`, which is the closest static
 * approximation.
 *
 * @param active pass `false` to stop listening — the listeners are only worth
 * having while something is actually sized from them.
 */
export const useVisualViewport = (
	active: boolean = true
): VisualViewportMetrics | null => {
	const [metrics, setMetrics] = useState<VisualViewportMetrics | null>(() =>
		typeof window === 'undefined' || !active ? null : readViewport()
	);

	useEffect(() => {
		if (typeof window === 'undefined' || !active) {
			setMetrics(null);
			return undefined;
		}

		const viewport = window.visualViewport;
		if (!viewport) {
			setMetrics(null);
			return undefined;
		}

		const update = () =>
			setMetrics((previous) => {
				const next = readViewport();
				// iOS fires `scroll` continuously during pinch-zoom and while
				// panning with the keyboard up. Handing back the previous
				// object lets React bail out of the render entirely, which
				// matters because the host component is very large.
				return sameMetrics(previous, next) ? previous : next;
			});
		update();

		// `scroll` matters as much as `resize`: iOS shifts the visual viewport
		// inside the layout one rather than resizing it in some situations.
		viewport.addEventListener('resize', update);
		viewport.addEventListener('scroll', update);
		return () => {
			viewport.removeEventListener('resize', update);
			viewport.removeEventListener('scroll', update);
		};
	}, [active]);

	return metrics;
};
