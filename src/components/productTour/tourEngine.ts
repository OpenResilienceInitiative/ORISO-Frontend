import { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import type { Step } from 'react-joyride';
import type { TourEvent, TourStatus, TourStep } from './types';

export const tourTargetSelector = (target: string) =>
	`[data-tour-target="${target}"]`;

export const mapStepsToJoyride = (steps: TourStep[]): Step[] =>
	steps.map((step) => ({
		id: step.id,
		target: step.target ? tourTargetSelector(step.target) : 'body',
		placement: step.placement ?? (step.target ? 'bottom' : 'center'),
		title: step.titleKey,
		content: step.contentKey
	}));

/**
 * A side placement is meaningless when the target effectively fills the
 * viewport (e.g. the session list column on mobile) — the tooltip would be
 * positioned off-screen. Fall back to a centered overlay in that case.
 */
export const effectivePlacement = (
	placement: TourStep['placement'],
	targetRect: { width: number; height: number } | null,
	viewport: { width: number; height: number }
): TourStep['placement'] => {
	if (!targetRect || placement === 'center') {
		return placement;
	}
	const coverage =
		(Math.min(targetRect.width, viewport.width) *
			Math.min(targetRect.height, viewport.height)) /
		(viewport.width * viewport.height);
	return coverage >= 0.6 ? 'center' : placement;
};

export interface TourRunState {
	status: TourStatus;
	stepIndex: number;
	run: boolean;
}

export const initialTourRunState: TourRunState = {
	status: 'not_started',
	stepIndex: 0,
	run: false
};

/** The subset of Joyride's CallBackProps the reducer consumes. */
export interface TourCallbackInput {
	action: string;
	index: number;
	status: string;
	type: string;
}

export interface TourReduction {
	state: TourRunState;
	events: TourEvent[];
}

/**
 * Pure transition function from a Joyride callback to the next controlled
 * run-state plus the domain events it implies. Closing or skipping is never
 * reported as completion; a missing final target closes the tour without a
 * terminal status so it stays resumable.
 */
export const reduceTourCallback = (
	state: TourRunState,
	cb: TourCallbackInput,
	stepCount: number
): TourReduction => {
	const events: TourEvent[] = [];
	let next = { ...state };
	const isLastStep = cb.index >= stepCount - 1;

	if (cb.type === EVENTS.TOUR_START) {
		next.status = 'in_progress';
		next.run = true;
		events.push('tour_started');
		return { state: next, events };
	}

	if (cb.type === EVENTS.TOOLTIP) {
		events.push('step_viewed');
		return { state: next, events };
	}

	if (cb.type === EVENTS.TARGET_NOT_FOUND) {
		events.push('target_missing');
		if (isLastStep) {
			next.run = false;
		} else {
			next.stepIndex = cb.index + 1;
		}
		return { state: next, events };
	}

	if (cb.type === EVENTS.STEP_AFTER) {
		if (cb.action === ACTIONS.CLOSE) {
			next.run = false;
			next.status = 'skipped';
			events.push('tour_skipped');
			return { state: next, events };
		}
		if (cb.action === ACTIONS.PREV) {
			next.stepIndex = Math.max(0, cb.index - 1);
			return { state: next, events };
		}
		if (cb.action === ACTIONS.NEXT) {
			events.push('step_completed');
			if (isLastStep) {
				next.run = false;
				next.status = 'completed';
				events.push('tour_completed');
			} else {
				next.stepIndex = cb.index + 1;
			}
			return { state: next, events };
		}
	}

	if (cb.type === EVENTS.TOUR_END) {
		if (cb.status === STATUS.SKIPPED && state.status !== 'completed') {
			next.run = false;
			next.status = 'skipped';
			events.push('tour_skipped');
		} else if (
			cb.status === STATUS.FINISHED &&
			state.status !== 'completed'
		) {
			next.run = false;
			next.status = 'completed';
			events.push('tour_completed');
		}
		return { state: next, events };
	}

	return { state: next, events };
};
