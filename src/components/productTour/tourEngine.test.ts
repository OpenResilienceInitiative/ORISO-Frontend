import { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { describe, expect, it } from 'vitest';
import {
	effectivePlacement,
	initialTourRunState,
	isTourAvailable,
	mapStepsToJoyride,
	reduceTourCallback,
	resolveTourSteps,
	routeMatches
} from './tourEngine';
import type { TourDefinition, TourStep } from './types';

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

describe('mapStepsToJoyride advanceOn', () => {
	it('carries advanceOn into the joyride step data so the tooltip can hide Next', () => {
		const joyrideSteps = mapStepsToJoyride([
			{
				id: 'accept',
				target: 'enquiry-accept-button',
				titleKey: 't',
				contentKey: 'c',
				advanceOn: { type: 'click' }
			}
		]);

		expect(joyrideSteps[0].data).toEqual({ advanceOn: { type: 'click' } });
	});

	it('leaves the step data untouched for ordinary steps', () => {
		const joyrideSteps = mapStepsToJoyride([
			{ id: 'a', target: 'a-target', titleKey: 't', contentKey: 'c' }
		]);

		expect(joyrideSteps[0]).not.toHaveProperty('data');
	});
});

describe('mapStepsToJoyride hideBack', () => {
	it('carries hideBack into the joyride step data so the tooltip can hide Back', () => {
		const joyrideSteps = mapStepsToJoyride([
			{
				id: 'after-accept',
				target: '',
				titleKey: 't',
				contentKey: 'c',
				hideBack: true
			}
		]);

		expect(joyrideSteps[0].data).toEqual({ hideBack: true });
	});

	it('keeps advanceOn and hideBack side by side', () => {
		const joyrideSteps = mapStepsToJoyride([
			{
				id: 'a',
				target: 'a-target',
				titleKey: 't',
				contentKey: 'c',
				advanceOn: { type: 'click' },
				hideBack: true
			}
		]);

		expect(joyrideSteps[0].data).toEqual({
			advanceOn: { type: 'click' },
			hideBack: true
		});
	});

	it('leaves the step data untouched when hideBack is not set', () => {
		const joyrideSteps = mapStepsToJoyride([
			{ id: 'a', target: 'a-target', titleKey: 't', contentKey: 'c' }
		]);

		expect(joyrideSteps[0]).not.toHaveProperty('data');
	});
});

describe('routeMatches', () => {
	const at = (pathname: string, search = '') => ({ pathname, search });

	it('matches an exact path', () => {
		expect(
			routeMatches(
				'/sessions/consultant/sessionPreview',
				at('/sessions/consultant/sessionPreview')
			)
		).toBe(true);
	});

	it('does not match another path or a longer one', () => {
		expect(routeMatches('/sessions/consultant', at('/profile'))).toBe(
			false
		);
		expect(
			routeMatches(
				'/sessions/consultant',
				at('/sessions/consultant/sessionView')
			)
		).toBe(false);
	});

	it('matches dynamic segments of a router pattern', () => {
		const path = '/sessions/consultant/sessionView/:roomId/:sessionId';

		expect(
			routeMatches(path, at('/sessions/consultant/sessionView/abc/42'))
		).toBe(true);
		expect(
			routeMatches(path, at('/sessions/consultant/sessionView/abc'))
		).toBe(false);
	});

	it('ignores a trailing slash', () => {
		expect(routeMatches('/profile', at('/profile/'))).toBe(true);
	});

	it('ignores the location query when the path names none', () => {
		expect(routeMatches('/profile', at('/profile', '?tab=help'))).toBe(
			true
		);
	});

	it('requires every query param the path names', () => {
		const path = '/sessions/consultant/sessionView/:rid/:id?channel=team';
		const base = '/sessions/consultant/sessionView/a/1';

		expect(routeMatches(path, at(base, '?channel=team'))).toBe(true);
		expect(routeMatches(path, at(base, '?x=1&channel=team'))).toBe(true);
		expect(routeMatches(path, at(base, '?channel=main'))).toBe(false);
		expect(routeMatches(path, at(base))).toBe(false);
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

	it('emits optional_step_skipped instead of target_missing for an optional step', () => {
		const { state, events } = reduceTourCallback(
			{ status: 'in_progress', stepIndex: 1, run: true },
			cb({ type: EVENTS.TARGET_NOT_FOUND, index: 1 }),
			5,
			[{}, { optional: true }, {}, {}, {}]
		);

		expect(events).toContain('optional_step_skipped');
		expect(events).not.toContain('target_missing');
		expect(state.stepIndex).toBe(2);
		expect(state.run).toBe(true);
	});

	it('completes the tour when the trailing missing step is optional', () => {
		const { state, events } = reduceTourCallback(
			{ ...initialTourRunState, status: 'in_progress', stepIndex: 4 },
			cb({ type: EVENTS.TARGET_NOT_FOUND, index: 4 }),
			5,
			[{}, {}, {}, {}, { optional: true }]
		);

		expect(state.run).toBe(false);
		expect(state.status).toBe('completed');
		expect(events).toContain('optional_step_skipped');
		expect(events).toContain('tour_completed');
	});

	it('keeps closing without completion when the trailing missing step is required', () => {
		const { state, events } = reduceTourCallback(
			{ ...initialTourRunState, status: 'in_progress', stepIndex: 4 },
			cb({ type: EVENTS.TARGET_NOT_FOUND, index: 4 }),
			5,
			[{}, {}, {}, {}, {}]
		);

		expect(state.run).toBe(false);
		expect(state.status).toBe('in_progress');
		expect(events).toContain('target_missing');
		expect(events).not.toContain('tour_completed');
	});

	it('never completes backward even when the first missing step is optional', () => {
		const { state, events } = reduceTourCallback(
			{ status: 'in_progress', stepIndex: 0, run: true },
			cb({
				type: EVENTS.TARGET_NOT_FOUND,
				action: ACTIONS.PREV,
				index: 0
			}),
			5,
			[{ optional: true }, {}, {}, {}, {}]
		);

		expect(state.run).toBe(false);
		expect(state.status).toBe('in_progress');
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

describe('resolveTourSteps', () => {
	const step = (id: string, when?: TourStep['when']): TourStep => ({
		id,
		target: '',
		titleKey: `t.${id}`,
		contentKey: `c.${id}`,
		...(when ? { when } : {})
	});
	const tour = (
		steps: TourStep[],
		when?: TourDefinition['when']
	): TourDefinition => ({
		id: 'variant-tour',
		version: 1,
		surface: 'frontend',
		audiences: ['consultant'],
		titleKey: 't',
		summaryKey: 's',
		steps,
		...(when ? { when } : {})
	});
	const team = { flag: 'featureTeamDiscussionEnabled' };

	it('keeps steps without a condition and returns them unchanged', () => {
		const plain = [step('a'), step('b')];

		expect(resolveTourSteps(tour(plain), {})).toEqual(plain);
	});

	it('treats an unset flag as ON, so a step needing the flag stays', () => {
		const steps = [step('a'), step('team', team), step('b')];

		const resolved = resolveTourSteps(tour(steps), { flags: {} });

		expect(resolved.map((s) => s.id)).toEqual(['a', 'team', 'b']);
	});

	it('drops a step whose flag is explicitly off and keeps the order of the rest', () => {
		const steps = [step('a'), step('team', team), step('b')];

		const resolved = resolveTourSteps(tour(steps), {
			flags: { featureTeamDiscussionEnabled: false }
		});

		expect(resolved.map((s) => s.id)).toEqual(['a', 'b']);
	});

	it('supports a step that only shows while the flag is off', () => {
		const steps = [
			step('a'),
			step('no-team', { ...team, equals: false }),
			step('b')
		];

		expect(
			resolveTourSteps(tour(steps), {
				flags: { featureTeamDiscussionEnabled: false }
			}).map((s) => s.id)
		).toEqual(['a', 'no-team', 'b']);
		expect(
			resolveTourSteps(tour(steps), {
				flags: { featureTeamDiscussionEnabled: true }
			}).map((s) => s.id)
		).toEqual(['a', 'b']);
	});

	it('requires every condition of a list', () => {
		const steps = [
			step('both', [team, { flag: 'featureSupervisionEnabled' }])
		];

		expect(
			resolveTourSteps(tour(steps), {
				flags: { featureSupervisionEnabled: false }
			})
		).toEqual([]);
		expect(resolveTourSteps(tour(steps), {})).toHaveLength(1);
	});

	it('returns no steps when the tour-level condition fails', () => {
		const supervision = { flag: 'featureSupervisionEnabled' };
		const t = tour([step('a')], supervision);

		expect(
			resolveTourSteps(t, { flags: { featureSupervisionEnabled: false } })
		).toEqual([]);
		expect(
			isTourAvailable(t, { flags: { featureSupervisionEnabled: false } })
		).toBe(false);
		expect(isTourAvailable(t, {})).toBe(true);
	});

	it('strips resolved conditions so resolving twice cannot disagree', () => {
		const steps = [step('a'), step('no-team', { ...team, equals: false })];
		const flagsOff = { flags: { featureTeamDiscussionEnabled: false } };

		const once = resolveTourSteps(tour(steps), flagsOff);
		const twice = resolveTourSteps(tour(once), {});

		expect(once.every((s) => s.when === undefined)).toBe(true);
		expect(twice.map((s) => s.id)).toEqual(['a', 'no-team']);
	});
});
