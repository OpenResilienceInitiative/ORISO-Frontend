import { useCallback, useEffect, useRef, useState } from 'react';
import type { CarrierId } from './carrierPresence';
import type { LampMapHandle } from './lampMapEffect';

/**
 * The login screen is the first thing anyone sees, so nothing about the stage
 * graphic is allowed to sit in the critical path. This hook is the gate.
 *
 * Start-up order:
 *
 * 1. **Critical** — markup, type, form, buttons, legal links. Guaranteed by
 *    the effect only ever being reachable through the `import()` below, so it
 *    is a separate chunk that is not part of the initial bundle.
 * 2. **Gate** — desktop width *and* no `prefers-reduced-motion` *and* the
 *    container near the viewport *and* the browser idle. Only then is the
 *    chunk fetched. On a phone it never goes over the wire at all: the mobile
 *    hero is plain CSS and the stage is not rendered below `$fromXLarge`.
 * 3. **Wandering dot** — starts only once the module has painted its first
 *    frame, so the resting map is on screen before anything moves.
 * 4. **Carrier lights** — the expensive schedules are built on first hover,
 *    and pre-warmed during idle time once stage 3 is running.
 */

/** Matches `$fromXLarge`, the breakpoint at which the stage is rendered. */
export const LAMP_MAP_MIN_WIDTH = 1200;

const IDLE_TIMEOUT_MS = 2000;
const NEAR_VIEWPORT_MARGIN = 250;

type IdleHandle = { cancel: () => void };

const whenIdle = (callback: () => void): IdleHandle => {
	if (typeof window.requestIdleCallback === 'function') {
		const id = window.requestIdleCallback(() => callback(), {
			timeout: IDLE_TIMEOUT_MS
		});
		return { cancel: () => window.cancelIdleCallback?.(id) };
	}
	const id = window.setTimeout(callback, 200);
	return { cancel: () => window.clearTimeout(id) };
};

/**
 * `IntersectionObserver` alone is not enough: inside scaled or transformed
 * containers (Storybook, the design prototype) it reports nothing, and the
 * stage would stay dark forever. The observer is the fast path, the
 * scroll/resize/visibility re-check is the guarantee.
 */
const observeNearViewport = (
	element: HTMLElement,
	onNear: () => void
): (() => void) => {
	let done = false;
	const finish = () => {
		if (done) {
			return;
		}
		done = true;
		cleanup();
		onNear();
	};

	const check = () => {
		const rect = element.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) {
			return;
		}
		const near =
			rect.top < window.innerHeight + NEAR_VIEWPORT_MARGIN &&
			rect.bottom > -NEAR_VIEWPORT_MARGIN;
		if (near) {
			finish();
		}
	};

	const observer =
		typeof IntersectionObserver === 'function'
			? new IntersectionObserver(
					(entries) => {
						if (entries.some((entry) => entry.isIntersecting)) {
							finish();
						}
					},
					{ rootMargin: `${NEAR_VIEWPORT_MARGIN}px` }
				)
			: null;
	observer?.observe(element);

	window.addEventListener('scroll', check, true);
	window.addEventListener('resize', check);
	document.addEventListener('visibilitychange', check);
	const timer = window.setTimeout(check, 0);

	function cleanup() {
		observer?.disconnect();
		window.removeEventListener('scroll', check, true);
		window.removeEventListener('resize', check);
		document.removeEventListener('visibilitychange', check);
		window.clearTimeout(timer);
	}

	check();
	return cleanup;
};

export interface UseLampMapOptions {
	/** The element the pointer is tracked on — the stage panel itself. */
	containerRef: React.RefObject<HTMLElement | null>;
	/** Turns the whole thing off. */
	enabled?: boolean;
}

export interface UseLampMapResult {
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
	/** True once the module is loaded and has painted. */
	isReady: boolean;
	setCarrier: (carrier: CarrierId | null) => void;
}

export const useLampMap = ({
	containerRef,
	enabled = true
}: UseLampMapOptions): UseLampMapResult => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const handleRef = useRef<LampMapHandle | null>(null);
	const pendingCarrierRef = useRef<CarrierId | null>(null);
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!enabled || !container || !canvas) {
			return;
		}

		// Stage 2, first two conditions. Both are cheap and rule the effect
		// out entirely on phones and for anyone who asked for less motion.
		if (
			!window.matchMedia?.(`(min-width: ${LAMP_MAP_MIN_WIDTH}px)`).matches
		) {
			return;
		}
		if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
			return;
		}

		let cancelled = false;
		let idle: IdleHandle | null = null;
		let heroTimer = 0;
		let prewarmIdle: IdleHandle | null = null;

		const start = async () => {
			try {
				const { createLampMap } = await import('./lampMapEffect');
				if (cancelled) {
					return;
				}
				const handle = await createLampMap(container, canvas, {
					onFirstFrame: () => {
						if (cancelled) {
							return;
						}
						setIsReady(true);
						// Stage 3: the dot only starts once the resting map
						// is actually on screen.
						heroTimer = window.setTimeout(() => {
							handle.setHeroEnabled(true);
							// Stage 4: warm the schedules while nothing else
							// is happening, so the first hover is instant.
							prewarmIdle = whenIdle(() => handle.prewarm());
						}, 350);
					}
				});
				if (cancelled) {
					handle.destroy();
					return;
				}
				handleRef.current = handle;
				if (pendingCarrierRef.current) {
					handle.setCarrier(pendingCarrierRef.current);
				}
			} catch (error) {
				// A missing stage decoration must never take the login with
				// it. Swallow and stay on the plain gradient.
				// eslint-disable-next-line no-console
				console.warn('stage lamp map unavailable', error);
			}
		};

		const stopObserving = observeNearViewport(container, () => {
			idle = whenIdle(() => {
				if (!cancelled) {
					void start();
				}
			});
		});

		return () => {
			cancelled = true;
			stopObserving();
			idle?.cancel();
			prewarmIdle?.cancel();
			window.clearTimeout(heroTimer);
			handleRef.current?.destroy();
			handleRef.current = null;
		};
	}, [containerRef, enabled]);

	const setCarrier = useCallback((carrier: CarrierId | null) => {
		pendingCarrierRef.current = carrier;
		handleRef.current?.setCarrier(carrier);
	}, []);

	return { canvasRef, isReady, setCarrier };
};
