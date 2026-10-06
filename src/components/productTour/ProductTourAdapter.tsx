import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Joyride } from 'react-joyride';
import type { EventData } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
	effectivePlacement,
	initialTourRunState,
	mapStepsToJoyride,
	reduceTourCallback,
	resolveTourSteps,
	tourTargetSelector,
	TourRunState
} from './tourEngine';
import { waitForTarget } from './targetReadiness';
import type {
	TourDefinition,
	TourEvent,
	TourPlacement,
	TourProgress,
	TourResolveContext,
	TourStep
} from './types';

export interface ProductTourAdapterProps {
	tour: TourDefinition;
	/** All app-level gates passed; the adapter renders nothing when false. */
	active: boolean;
	/** A higher-priority blocking surface (e.g. the 2FA dialog) is visible. */
	paused?: boolean;
	/**
	 * Resolves the `when` conditions of the tour and its steps once, when the
	 * tour mounts. Without it, unset flags apply (everything ON). Hosts that
	 * count steps themselves resolve first and pass the resolved tour.
	 */
	context?: TourResolveContext;
	/** Bounded wait for a step target before it is skipped as missing. */
	targetTimeoutMs?: number;
	onEvent?: (event: TourEvent, step?: TourStep) => void;
	/** Called exactly once when the tour reaches completed or skipped. */
	onTerminalStatus?: (progress: TourProgress) => void | Promise<void>;
	/**
	 * Host setup (e.g. entering practice mode). Runs before the first step is
	 * prepared; the tour starts once it resolves, and never starts if it
	 * rejects.
	 */
	onBeforeStart?: () => void | Promise<void>;
	/**
	 * Host teardown. At most once per mount, after the terminal status was
	 * written, when the tour stops without one, or on unmount. Waits for a
	 * still-pending setup, and never runs when setup never began.
	 */
	onEnd?: () => void;
	tooltipComponent?: React.ComponentType<any>;
}

const DEFAULT_TARGET_TIMEOUT_MS = 4000;

export const ProductTourAdapter = ({
	tour,
	active,
	paused = false,
	context,
	targetTimeoutMs = DEFAULT_TARGET_TIMEOUT_MS,
	onEvent,
	onTerminalStatus,
	onBeforeStart,
	onEnd,
	tooltipComponent
}: ProductTourAdapterProps) => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();

	// Joyride starts only after the first step's route and target are ready,
	// so every step follows the same preparation flow.
	const [runState, setRunState] = useState<TourRunState>(initialTourRunState);
	// The index Joyride actually shows; advanced only after route + target
	// for that step are ready.
	const [readyIndex, setReadyIndex] = useState(0);
	// Per-step placement corrections measured against the real target size
	// (a full-viewport target falls back to a centered tooltip).
	const [placementOverrides, setPlacementOverrides] = useState<
		Record<number, TourPlacement | undefined>
	>({});

	// Callback handling reads and writes through this ref so side effects
	// (events, navigation, persistence) never live inside a React state
	// updater, which may replay updaters and duplicate them.
	const runStateRef = useRef<TourRunState>(runState);
	const startedAtRef = useRef<string | undefined>(undefined);
	const terminalReportedRef = useRef(false);
	const prepareTokenRef = useRef(0);
	const startedPreparingRef = useRef(false);
	const locationRef = useRef(location);
	locationRef.current = location;
	const onBeforeStartRef = useRef(onBeforeStart);
	onBeforeStartRef.current = onBeforeStart;
	const onEndRef = useRef(onEnd);
	onEndRef.current = onEnd;
	// `setup` settles (never rejects) once the host setup is over, so a
	// teardown that arrives early can wait for it.
	const hostRef = useRef<{
		began: boolean;
		ended: boolean;
		setup: Promise<void> | null;
	}>({ began: false, ended: false, setup: null });

	const endTour = useCallback(() => {
		const host = hostRef.current;
		if (!host.began || host.ended) {
			return;
		}
		host.ended = true;
		const teardown = () => onEndRef.current?.();
		if (host.setup) {
			host.setup.then(teardown);
		} else {
			teardown();
		}
	}, []);

	useEffect(() => endTour, [endTour]);

	const applyRunState = useCallback((next: TourRunState) => {
		runStateRef.current = next;
		setRunState(next);
	}, []);

	// Variants are resolved once per tour: a flag flipping mid-run must not
	// change the step count under a running tour.
	const contextRef = useRef(context);
	const steps = useMemo(
		() => resolveTourSteps(tour, contextRef.current),
		[tour]
	);
	const joyrideSteps = useMemo(() => {
		const mapped = mapStepsToJoyride(steps);
		return mapped.map((step, index) =>
			placementOverrides[index]
				? { ...step, placement: placementOverrides[index] }
				: step
		);
	}, [placementOverrides, steps]);

	const emit = useCallback(
		(event: TourEvent, step?: TourStep) => {
			onEvent?.(event, step);
		},
		[onEvent]
	);

	const reportTerminal = useCallback(
		(status: 'completed' | 'skipped', currentStepId?: string) => {
			if (terminalReportedRef.current) {
				return;
			}
			terminalReportedRef.current = true;
			const progress: TourProgress = {
				tourId: tour.id,
				tourVersion: tour.version,
				status,
				currentStepId,
				startedAt: startedAtRef.current,
				completedAt: new Date().toISOString()
			};
			Promise.resolve(onTerminalStatus?.(progress))
				.catch(() => {
					// A failed write must not crash the tour surface; the caller
					// owns retry/reporting semantics.
					terminalReportedRef.current = false;
				})
				// Leave the host's mode only after the write, which a guarded
				// mode may only allow while it is still active.
				.finally(endTour);
		},
		[endTour, onTerminalStatus, tour.id, tour.version]
	);

	/**
	 * Makes step `index` presentable: navigates to its route when needed and
	 * waits (bounded) for its target. A missing target is skipped safely in
	 * the direction of travel; if no presentable step remains the tour closes
	 * without completion — unless only OPTIONAL steps were missing while
	 * moving forward past shown steps, which completes the tour (trailing
	 * optional anchors must not trap a fresh account in `in_progress`).
	 * Resolves true when a step became presentable.
	 */
	const prepareStep = useCallback(
		async (index: number, direction: 1 | -1 = 1): Promise<boolean> => {
			prepareTokenRef.current += 1;
			const token = prepareTokenRef.current;
			let requiredMissing = false;
			let lastSkipped: TourStep | undefined;
			/* eslint-disable no-await-in-loop, no-continue -- steps are prepared strictly sequentially; a skipped target falls through to the neighboring step */
			for (let i = index; i >= 0 && i < steps.length; i += direction) {
				const step = steps[i];
				if (step.route) {
					const current =
						locationRef.current.pathname +
						locationRef.current.search;
					if (current !== step.route) {
						navigate(step.route);
					}
				}
				if (step.target) {
					const found = await waitForTarget(
						tourTargetSelector(step.target),
						{ timeoutMs: targetTimeoutMs }
					);
					if (prepareTokenRef.current !== token) {
						return false;
					}
					if (!found) {
						if (step.optional) {
							emit('optional_step_skipped', step);
						} else {
							requiredMissing = true;
							emit('target_missing', step);
						}
						lastSkipped = step;
						continue;
					}
					const rect = document
						.querySelector(tourTargetSelector(step.target))
						?.getBoundingClientRect();
					const placement = effectivePlacement(
						step.placement ?? 'bottom',
						rect
							? { width: rect.width, height: rect.height }
							: null,
						{
							width: window.innerWidth,
							height: window.innerHeight
						}
					);
					setPlacementOverrides((prev) =>
						prev[i] === placement
							? prev
							: { ...prev, [i]: placement }
					);
				}
				setReadyIndex(i);
				applyRunState({ ...runStateRef.current, stepIndex: i });
				return true;
			}
			/* eslint-enable no-await-in-loop, no-continue */
			// No presentable step left. Moving forward past shown steps over
			// only-optional gaps finishes the tour; anything else closes
			// without recording completion so the tour stays resumable.
			if (direction === 1 && !requiredMissing && index > 0) {
				applyRunState({
					...runStateRef.current,
					run: false,
					status: 'completed'
				});
				emit('tour_completed', lastSkipped);
				reportTerminal('completed', lastSkipped?.id);
				return false;
			}
			applyRunState({ ...runStateRef.current, run: false });
			endTour();
			return false;
		},
		[
			applyRunState,
			emit,
			endTour,
			navigate,
			reportTerminal,
			steps,
			targetTimeoutMs
		]
	);

	// Gate the initial run: prepare step 0 (route + target) before Joyride
	// ever positions against the page.
	useEffect(() => {
		if (!active || !steps.length || startedPreparingRef.current) {
			return;
		}
		startedPreparingRef.current = true;
		const start = () =>
			prepareStep(0).then((prepared) => {
				if (prepared) {
					applyRunState({ ...runStateRef.current, run: true });
				}
			});

		const host = hostRef.current;
		host.began = true;
		let setup: Promise<void> | undefined;
		try {
			const pending = onBeforeStartRef.current?.();
			setup = pending ? Promise.resolve(pending) : undefined;
		} catch (error) {
			setup = Promise.reject(error);
		}
		if (!setup) {
			start();
			return;
		}
		host.setup = setup.then(
			() => {},
			() => {}
		);
		setup.then(
			() => {
				// Unmounted while setup was pending: teardown is on its way.
				if (!host.ended) {
					start();
				}
			},
			// The tour never starts; undo whatever the setup got done.
			endTour
		);
	}, [active, applyRunState, endTour, prepareStep, steps.length]);

	const handleCallback = useCallback(
		(data: EventData) => {
			const stepForIndex = (index: number): TourStep | undefined =>
				steps[index];

			const prev = runStateRef.current;
			const { state, events } = reduceTourCallback(
				prev,
				{
					action: data.action,
					index: data.index,
					status: data.status,
					type: data.type
				},
				steps.length,
				steps
			);

			events.forEach((event) => {
				if (event === 'tour_started') {
					startedAtRef.current = new Date().toISOString();
				}
				emit(event, stepForIndex(data.index));
			});

			if (state.status === 'completed' && events.length) {
				reportTerminal('completed', stepForIndex(data.index)?.id);
			}
			if (state.status === 'skipped' && events.includes('tour_skipped')) {
				reportTerminal('skipped', stepForIndex(data.index)?.id);
			}

			if (state.run && state.stepIndex !== prev.stepIndex) {
				// Advance asynchronously once route + target are ready; keep
				// showing the previous step until prepared.
				applyRunState({ ...state, stepIndex: prev.stepIndex });
				prepareStep(
					state.stepIndex,
					state.stepIndex < prev.stepIndex ? -1 : 1
				);
				return;
			}
			applyRunState(state);
			const isTerminal =
				state.status === 'completed' || state.status === 'skipped';
			if (prev.run && !state.run && !isTerminal) {
				// Stopped without a terminal status (e.g. a missing required
				// target): the terminal paths tear down after their write.
				endTour();
			}
		},
		[applyRunState, emit, endTour, prepareStep, reportTerminal, steps]
	);

	if (!active || !steps.length) {
		return null;
	}

	return (
		<Joyride
			steps={joyrideSteps}
			run={runState.run && !paused}
			stepIndex={readyIndex}
			continuous
			onEvent={handleCallback}
			tooltipComponent={tooltipComponent}
			locale={{
				back: translate('walkthrough.step.prev'),
				next: translate('walkthrough.step.next'),
				last: translate('walkthrough.step.done'),
				close: translate('walkthrough.step.done'),
				skip: translate('walkthrough.step.done')
			}}
			options={{
				skipBeacon: true,
				closeButtonAction: 'skip',
				// The app shell is a fixed-viewport layout; scrolling the
				// window would break it and every tour target is in view.
				skipScroll: true,
				zIndex: 53,
				// Guided flows opt out of ESC / overlay-click dismissal so a
				// stray key or click cannot mark the exercise skipped.
				...(tour.dismissible === false && {
					dismissKeyAction: false,
					overlayClickAction: false
				})
			}}
		/>
	);
};
