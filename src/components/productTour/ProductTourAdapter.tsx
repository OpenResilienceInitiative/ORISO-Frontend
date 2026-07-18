import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Joyride from 'react-joyride';
import type { CallBackProps } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
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

	const [runState, setRunState] = useState<TourRunState>({
		...initialTourRunState,
		run: true
	});
	// The index Joyride actually shows; advanced only after route + target
	// for that step are ready.
	const [readyIndex, setReadyIndex] = useState(0);

	const startedAtRef = useRef<string | undefined>(undefined);
	const terminalReportedRef = useRef(false);
	const prepareTokenRef = useRef(0);
	const locationRef = useRef(location);
	locationRef.current = location;

	const steps = tour.steps;
	const joyrideSteps = useMemo(() => mapStepsToJoyride(steps), [steps]);

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
	 * waits (bounded) for its target. A missing target is skipped safely; if
	 * no presentable step remains the tour closes without completion.
	 */
	const prepareStep = useCallback(
		async (index: number) => {
			const token = ++prepareTokenRef.current;
			for (let i = index; i < steps.length; i++) {
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
						return;
					}
					if (!found) {
						emit('target_missing', step);
						continue;
					}
				}
				setReadyIndex(i);
				setRunState((prev) => ({ ...prev, stepIndex: i }));
				return;
			}
			// No presentable step left: close without recording completion.
			setRunState((prev) => ({ ...prev, run: false }));
		},
		[emit, navigate, steps, targetTimeoutMs]
	);

	const handleCallback = useCallback(
		(data: CallBackProps) => {
			const stepForIndex = (index: number): TourStep | undefined =>
				steps[index];

			setRunState((prev) => {
				const { state, events } = reduceTourCallback(
					prev,
					{
						action: data.action,
						index: data.index,
						status: data.status,
						type: data.type
					},
					steps.length
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
				if (
					state.status === 'skipped' &&
					events.includes('tour_skipped')
				) {
					reportTerminal('skipped', stepForIndex(data.index)?.id);
				}

				if (state.run && state.stepIndex !== prev.stepIndex) {
					// Advance asynchronously once route + target are ready.
					prepareStep(state.stepIndex);
					// Keep showing the previous step until prepared.
					return { ...state, stepIndex: prev.stepIndex };
				}
				return state;
			});
		},
		[emit, prepareStep, reportTerminal, steps]
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
			showSkipButton={false}
			disableScrolling={false}
			callback={handleCallback}
			tooltipComponent={tooltipComponent}
			locale={{
				back: translate('walkthrough.step.prev'),
				next: translate('walkthrough.step.next'),
				last: translate('walkthrough.step.done'),
				close: translate('walkthrough.step.done'),
				skip: translate('walkthrough.step.done')
			}}
			styles={{
				options: {
					zIndex: 53
				}
			}}
		/>
	);
};
