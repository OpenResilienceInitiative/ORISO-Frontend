import { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { describe, expect, it } from 'vitest';
import {
	effectivePlacement,
	initialTourRunState,
	mapStepsToJoyride,
	reduceTourCallback
} from './tourEngine';
import type { TourStep } from './types';

describe('mapStepsToJoyride', () => {
	it('maps a centered step without target to a body-centered joyride step', () => {
		const steps: TourStep[] = [
			{
				id: 'intro',
				target: '',
				titleKey: 'walkthrough.step.0.title',
				contentKey: 'walkthrough.step.0.intro',
				placement: 'center'
			}
		];

		const joyrideSteps = mapStepsToJoyride(steps);

		expect(joyrideSteps).toHaveLength(1);
		expect(joyrideSteps[0].target).toBe('body');
		expect(joyrideSteps[0].placement).toBe('center');
		expect(joyrideSteps[0].id).toBe('intro');
	});

	it('maps a semantic target name to a data-tour-target selector', () => {
		const steps: TourStep[] = [
			{
				id: 'archive',
				target: 'sessions-archive-tab',
				titleKey: 'walkthrough.step.4.title',
				contentKey: 'walkthrough.step.4.intro'
			}
		];

		const joyrideSteps = mapStepsToJoyride(steps);

		expect(joyrideSteps[0].target).toBe(
			'[data-tour-target="sessions-archive-tab"]'
		);
	});

	it('defaults placement to bottom and passes an explicit placement through', () => {
		const steps: TourStep[] = [
			{
				id: 'a',
				target: 'a-target',
				titleKey: 't',
				contentKey: 'c'
			},
			{
				id: 'b',
				target: 'b-target',
				titleKey: 't',
				contentKey: 'c',
				placement: 'right'
			}
		];

		const joyrideSteps = mapStepsToJoyride(steps);

		expect(joyrideSteps[0].placement).toBe('bottom');
		expect(joyrideSteps[1].placement).toBe('right');
	});
});

describe('reduceTourCallback', () => {
	const cb = (
		over: Partial<Record<'action' | 'index' | 'status' | 'type', any>>
	) => ({
		action: ACTIONS.UPDATE,
		index: 0,
		status: STATUS.RUNNING,
		type: EVENTS.TOOLTIP,
		...over
	});

	it('marks the tour started and in progress on tour:start', () => {
		const { state, events } = reduceTourCallback(
			initialTourRunState,
			cb({ type: EVENTS.TOUR_START }),
			5
		);

		expect(state.status).toBe('in_progress');
		expect(events).toContain('tour_started');
	});

	it('records step_viewed when a step tooltip is shown', () => {
		const { events } = reduceTourCallback(
			{ ...initialTourRunState, status: 'in_progress' },
			cb({ type: EVENTS.TOOLTIP, index: 1 }),
			5
		);

		expect(events).toContain('step_viewed');
	});

	it('advances the step index and records step_completed on next', () => {
		const { state, events } = reduceTourCallback(
			{ status: 'in_progress', stepIndex: 1, run: true },
			cb({ type: EVENTS.STEP_AFTER, action: ACTIONS.NEXT, index: 1 }),
			5
		);

		expect(state.stepIndex).toBe(2);
		expect(events).toContain('step_completed');
		expect(state.run).toBe(true);
	});

	it('steps back without recording completion on prev', () => {
		const { state, events } = reduceTourCallback(
			{ ...initialTourRunState, status: 'in_progress', stepIndex: 2 },
			cb({ type: EVENTS.STEP_AFTER, action: ACTIONS.PREV, index: 2 }),
			5
		);

		expect(state.stepIndex).toBe(1);
		expect(events).not.toContain('step_completed');
	});

	it('completes the tour when next is clicked on the final step', () => {
		const { state, events } = reduceTourCallback(
			{ ...initialTourRunState, status: 'in_progress', stepIndex: 4 },
			cb({ type: EVENTS.STEP_AFTER, action: ACTIONS.NEXT, index: 4 }),
			5
		);

		expect(state.run).toBe(false);
		expect(state.status).toBe('completed');
		expect(events).toContain('tour_completed');
	});

	it('records skipped, not completed, when the tour is closed mid-way', () => {
		const { state, events } = reduceTourCallback(
			{ ...initialTourRunState, status: 'in_progress', stepIndex: 2 },
			cb({ type: EVENTS.STEP_AFTER, action: ACTIONS.CLOSE, index: 2 }),
			5
		);

		expect(state.run).toBe(false);
		expect(state.status).toBe('skipped');
		expect(events).toContain('tour_skipped');
		expect(events).not.toContain('tour_completed');
	});

	it('records skipped when the skip button ends the tour', () => {
		const { state, events } = reduceTourCallback(
			{ ...initialTourRunState, status: 'in_progress', stepIndex: 1 },
			cb({
				type: EVENTS.TOUR_END,
				action: ACTIONS.SKIP,
				status: STATUS.SKIPPED,
				index: 1
			}),
			5
		);

		expect(state.run).toBe(false);
		expect(state.status).toBe('skipped');
		expect(events).toContain('tour_skipped');
	});

	it('skips a missing target safely and records target_missing', () => {
		const { state, events } = reduceTourCallback(
			{ status: 'in_progress', stepIndex: 1, run: true },
			cb({ type: EVENTS.TARGET_NOT_FOUND, index: 1 }),
			5
		);

		expect(events).toContain('target_missing');
		expect(state.stepIndex).toBe(2);
		expect(state.run).toBe(true);
	});

	it('closes without completion when the final step target is missing', () => {
		const { state, events } = reduceTourCallback(
			{ ...initialTourRunState, status: 'in_progress', stepIndex: 4 },
			cb({ type: EVENTS.TARGET_NOT_FOUND, index: 4 }),
			5
		);

		expect(state.run).toBe(false);
		expect(state.status).toBe('in_progress');
		expect(events).toContain('target_missing');
		expect(events).not.toContain('tour_completed');
	});

	it('treats finishing via tour:end with finished status as completed once', () => {
		const { state, events } = reduceTourCallback(
			{
				...initialTourRunState,
				status: 'completed',
				stepIndex: 4,
				run: false
			},
			cb({
				type: EVENTS.TOUR_END,
				action: ACTIONS.NEXT,
				status: STATUS.FINISHED,
				index: 4
			}),
			5
		);

		expect(state.status).toBe('completed');
		expect(events).not.toContain('tour_completed');
	});
});

describe('effectivePlacement', () => {
	it('keeps the configured placement for a normal-sized target', () => {
		expect(
			effectivePlacement(
				'right',
				{ width: 300, height: 400 },
				{ width: 1440, height: 900 }
			)
		).toBe('right');
	});

	it('centers the tooltip when the target dominates the viewport', () => {
		expect(
			effectivePlacement(
				'right',
				{ width: 390, height: 700 },
				{ width: 390, height: 844 }
			)
		).toBe('center');
	});

	it('keeps center as center', () => {
		expect(
			effectivePlacement(
				'center',
				{ width: 100, height: 100 },
				{ width: 1440, height: 900 }
			)
		).toBe('center');
	});
});

describe('reduceTourCallback target_missing direction', () => {
	const cb = (over: Record<string, any>) => ({
		action: ACTIONS.UPDATE,
		index: 0,
		status: STATUS.RUNNING,
		type: EVENTS.TOOLTIP,
		...over
	});

	it('moves backward when the missing target was reached via prev', () => {
		const { state, events } = reduceTourCallback(
			{ status: 'in_progress', stepIndex: 2, run: true },
			cb({
				type: EVENTS.TARGET_NOT_FOUND,
				action: ACTIONS.PREV,
				index: 2
			}),
			5
		);

		expect(events).toContain('target_missing');
		expect(state.stepIndex).toBe(1);
		expect(state.run).toBe(true);
	});

	it('closes without terminal status when prev hits a missing first step', () => {
		const { state } = reduceTourCallback(
			{ status: 'in_progress', stepIndex: 0, run: true },
			cb({
				type: EVENTS.TARGET_NOT_FOUND,
				action: ACTIONS.PREV,
				index: 0
			}),
			5
		);

		expect(state.run).toBe(false);
		expect(state.status).toBe('in_progress');
	});
});

describe('effectivePlacement axis-specific coverage', () => {
	it('centers a side placement when the target spans the viewport width', () => {
		// Full-width, half-height list on mobile: no horizontal space for a
		// right-anchored tooltip even though total area coverage is < 0.6.
		expect(
			effectivePlacement(
				'right',
				{ width: 390, height: 400 },
				{ width: 390, height: 844 }
			)
		).toBe('center');
	});

	it('keeps a bottom placement for a wide but flat target', () => {
		expect(
			effectivePlacement(
				'bottom',
				{ width: 390, height: 120 },
				{ width: 390, height: 844 }
			)
		).toBe('bottom');
	});

	it('centers a bottom placement when the target spans the viewport height', () => {
		expect(
			effectivePlacement(
				'bottom',
				{ width: 200, height: 820 },
				{ width: 390, height: 844 }
			)
		).toBe('center');
	});
});
