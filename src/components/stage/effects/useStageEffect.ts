import { RefObject, useEffect, useRef, useState } from 'react';
import { loadStageEffect } from './loadStageEffect';
import { StageEffect, StageEffectName } from './types';

/** Below this the stage is not rendered at all, so no effect code is fetched. */
export const STAGE_EFFECT_MIN_WIDTH = 900;

export type StageEffectPhase =
	/** Nothing requested yet — the login screen is still becoming usable. */
	| 'idle'
	/** Chunk is being fetched. */
	| 'loading'
	/** Running. */
	| 'active'
	/** Deliberately not run: mobile, reduced motion, `none`, or a load failure. */
	| 'skipped';

const prefersReducedMotion = () =>
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Idle margin before the effect may start, once the stage is on screen. */
const IDLE_TIMEOUT_MS = 1200;
/** How often the visibility fallback re-checks, in ms. */
const VISIBILITY_POLL_MS = 250;

/**
 * Runs `callback` once the browser is idle — with a hard backstop.
 *
 * `requestIdleCallback` is an optimisation, not a guarantee: on a busy page, in
 * some headless environments and in a background tab it can simply never fire,
 * and the effect would then never start. The timer alongside it makes the idle
 * hint an accelerator rather than a dependency.
 */
const whenIdle = (callback: () => void): (() => void) => {
	if (typeof window === 'undefined') {
		return () => undefined;
	}

	let done = false;
	const run = () => {
		if (done) {
			return;
		}
		done = true;
		callback();
	};

	const timer = window.setTimeout(run, IDLE_TIMEOUT_MS);
	let idleHandle: number | null = null;
	if (typeof window.requestIdleCallback === 'function') {
		idleHandle = window.requestIdleCallback(run, {
			timeout: IDLE_TIMEOUT_MS
		});
	}

	return () => {
		done = true;
		window.clearTimeout(timer);
		if (idleHandle !== null) {
			window.cancelIdleCallback(idleHandle);
		}
	};
};

/**
 * Fires `callback` when `element` is within `margin` px of the viewport.
 *
 * Deliberately not `IntersectionObserver` alone: inside scaled or transformed
 * containers — which is exactly how design previews and Storybook render the
 * stage — it can stay silent, and the effect would never start. The rect poll
 * is the source of truth; the observer only makes the common case react faster.
 */
const whenOnScreen = (
	element: HTMLElement,
	margin: number,
	callback: () => void
): (() => void) => {
	let done = false;
	let timer: number | null = null;
	let observer: IntersectionObserver | null = null;

	const finish = () => {
		if (done) {
			return;
		}
		done = true;
		if (timer !== null) {
			window.clearInterval(timer);
		}
		observer?.disconnect();
		callback();
	};

	const check = () => {
		const rect = element.getBoundingClientRect();
		if (!rect.width || !rect.height) {
			return;
		}
		const onScreen =
			rect.bottom > -margin &&
			rect.top < window.innerHeight + margin &&
			rect.right > -margin &&
			rect.left < window.innerWidth + margin;
		if (onScreen) {
			finish();
		}
	};

	if (typeof IntersectionObserver === 'function') {
		observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					finish();
				}
			},
			{ rootMargin: `${margin}px` }
		);
		observer.observe(element);
	}
	timer = window.setInterval(check, VISIBILITY_POLL_MS);
	check();

	return () => {
		done = true;
		if (timer !== null) {
			window.clearInterval(timer);
		}
		observer?.disconnect();
	};
};

/**
 * Runs the tenant's stage effect — but only once the login screen is already
 * usable, and only where it makes sense.
 *
 * Load order (Frank, 2026-08-07): markup, form and buttons paint first with no
 * effect code in the critical path. Then, when the browser is idle *and* the
 * stage is actually on screen, the one selected chunk is fetched and started.
 *
 * Never runs when:
 *   - the viewport is too narrow to show the stage — the code is not fetched,
 *     so mobile visitors pay nothing on their data plan;
 *   - the visitor prefers reduced motion;
 *   - the tenant chose `none`.
 */
export const useStageEffect = (
	name: StageEffectName,
	{
		hostRef,
		canvasRef,
		intensity = 1,
		enabled = true
	}: {
		hostRef: RefObject<HTMLElement>;
		canvasRef: RefObject<HTMLCanvasElement>;
		intensity?: number;
		enabled?: boolean;
	}
): StageEffectPhase => {
	const [phase, setPhase] = useState<StageEffectPhase>('idle');
	const effectRef = useRef<StageEffect | null>(null);

	useEffect(() => {
		if (!enabled || name === 'none') {
			setPhase('skipped');
			return undefined;
		}
		if (typeof window === 'undefined') {
			return undefined;
		}
		if (window.innerWidth < STAGE_EFFECT_MIN_WIDTH) {
			setPhase('skipped');
			return undefined;
		}
		const reducedMotion = prefersReducedMotion();

		let cancelled = false;
		let frameHandle: number | null = null;
		let cancelVisibility: (() => void) | null = null;
		let cancelIdle: (() => void) | null = null;

		const start = async () => {
			const host = hostRef.current;
			const canvas = canvasRef.current;
			if (!host || !canvas || cancelled) {
				return;
			}

			setPhase('loading');
			let factory;
			try {
				factory = await loadStageEffect(name);
			} catch {
				// A missing chunk must never break the login screen — the stage
				// simply stays as it is without the effect.
				if (!cancelled) {
					setPhase('skipped');
				}
				return;
			}
			if (!factory || cancelled) {
				if (!cancelled) {
					setPhase('skipped');
				}
				return;
			}

			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const width = canvas.clientWidth;
			const height = canvas.clientHeight;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);

			const effect = factory({
				canvas,
				host,
				width,
				height,
				intensity,
				reducedMotion
			});
			if (!effect || cancelled) {
				effect?.destroy?.();
				return;
			}

			effectRef.current = effect;
			setPhase('active');

			const startedAt = performance.now();
			const tick = () => {
				// Nothing is drawn while the tab is in the background: a login
				// screen left open in another tab must not keep a core busy.
				if (!document.hidden) {
					effect.frame((performance.now() - startedAt) / 1000);
				}
				// Reduced motion gets exactly one resting frame, then stops.
				if (!reducedMotion) {
					frameHandle = requestAnimationFrame(tick);
				}
			};
			frameHandle = requestAnimationFrame(tick);
		};

		const host = hostRef.current;
		if (!host) {
			return undefined;
		}

		// Start a little before the stage scrolls in, so the first frame is
		// already there when it arrives.
		cancelVisibility = whenOnScreen(host, 250, () => {
			cancelIdle = whenIdle(() => {
				void start();
			});
		});

		return () => {
			cancelled = true;
			cancelVisibility?.();
			cancelIdle?.();
			if (frameHandle !== null) {
				cancelAnimationFrame(frameHandle);
			}
			effectRef.current?.destroy?.();
			effectRef.current = null;
		};
	}, [name, hostRef, canvasRef, intensity, enabled]);

	return phase;
};
