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
	tourTargetSelector,
	TourRunState
} from './tourEngine';
import { waitForTarget } from './targetReadiness';
import type {
	TourDefinition,
	TourEvent,
	TourPlacement,
	TourProgress,
	TourStep
} from './types';

export interface ProductTourAdapterProps {
	tour: TourDefinition;
	/** All app-level gates passed; the adapter renders nothing when false. */
	active: boolean;
	/** A higher-priority blocking surface (e.g. the 2FA dialog) is visible. */
	paused?: boolean;
	/** Bounded wait for a step target before it is skipped as missing. */
	targetTimeoutMs?: number;
	onEvent?: (event: TourEvent, step?: TourStep) => void;
	/** Called exactly once when the tour reaches completed or skipped. */
	onTerminalStatus?: (progress: TourProgress) => void | Promise<void>;
	tooltipComponent?: React.ComponentType<any>;
}

const DEFAULT_TARGET_TIMEOUT_MS = 4000;

export const ProductTourAdapter = ({
	tour,
	active,
	paused = false,
	targetTimeoutMs = DEFAULT_TARGET_TIMEOUT_MS,
	onEvent,
	onTerminalStatus,
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

	const applyRunState = useCallback((next: TourRunState) => {
		runStateRef.current = next;
		setRunState(next);
	}, []);

	const { steps } = tour;
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
			Promise.resolve(onTerminalStatus?.(progress)).catch(() => {
				// A failed write must not crash the tour surface; the caller
				// owns retry/reporting semantics.
				terminalReportedRef.current = false;
			});
		},
		[onTerminalStatus, tour.id, tour.version]
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
			return false;
		},
		[applyRunState, emit, navigate, reportTerminal, steps, targetTimeoutMs]
	);

	// Gate the initial run: prepare step 0 (route + target) before Joyride
	// ever positions against the page.
	useEffect(() => {
		if (!active || startedPreparingRef.current) {
			return;
		}
		startedPreparingRef.current = true;
		prepareStep(0).then((prepared) => {
			if (prepared) {
				applyRunState({ ...runStateRef.current, run: true });
			}
		});
	}, [active, applyRunState, prepareStep]);

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
		},
		[applyRunState, emit, prepareStep, reportTerminal, steps]
	);

	if (!active) {
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
				zIndex: 53
			}}
		/>
	);
};
