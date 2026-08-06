import { useEffect, useState } from 'react';

/**
 * Loading priority for the handover screen, per Frank 2026-08-06:
 *
 *   Tier 1  text, badge, cards, the gate button — pure markup and tokens,
 *           painted on the first frame, no network at all.
 *   Tier 2  the three card motifs — lazy, with their boxes reserved so nothing
 *           reflows when they land.
 *   Tier 3  decoration (the screen that slides in from the left, and whatever
 *           else the next iteration brings). Must not compete for bandwidth or
 *           main thread with tiers 1 and 2.
 *
 * This hook is the tier-3 switch. It stays `false` until the browser has been
 * idle once *and* the caller says the important objects have arrived, so the
 * expensive effects can never delay the content the user is waiting for.
 *
 * Returns `false` forever when the user prefers reduced motion — tier 3 is
 * decoration by definition, so there is nothing to fall back to.
 */
export const useDeferredFlourish = (importantObjectsReady: boolean) => {
	const [enabled, setEnabled] = useState(false);

	useEffect(() => {
		if (!importantObjectsReady) {
			return undefined;
		}

		if (
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
		) {
			return undefined;
		}

		const scheduleIdle =
			typeof window !== 'undefined' && 'requestIdleCallback' in window
				? window.requestIdleCallback.bind(window)
				: (callback: () => void) =>
						window.setTimeout(callback, 200) as unknown as number;
		const cancelIdle =
			typeof window !== 'undefined' && 'cancelIdleCallback' in window
				? window.cancelIdleCallback.bind(window)
				: (handle: number) => window.clearTimeout(handle);

		const handle = scheduleIdle(() => setEnabled(true));
		return () => cancelIdle(handle as number);
	}, [importantObjectsReady]);

	return enabled;
};
