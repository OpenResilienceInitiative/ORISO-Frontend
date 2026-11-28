import { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { matchPath } from 'react-router-dom';
import type { Step } from 'react-joyride';
import type {
	TourCondition,
	TourDefinition,
	TourEvent,
	TourResolveContext,
	TourStatus,
	TourStep,
	TourWhen
} from './types';

export const tourTargetSelector = (target: string) =>
	`[data-tour-target="${target}"]`;

/**
 * Whether a location reached an `advanceOn: { type: 'route' }` path: a router
 * pattern for the pathname, plus every query param the path names.
 */
export const routeMatches = (
	path: string,
	location: { pathname: string; search: string }
): boolean => {
	const [pattern, query = ''] = path.split('?');
	if (!matchPath({ path: pattern, end: true }, location.pathname)) {
		return false;
	}
	const current = new URLSearchParams(location.search);
	return [...new URLSearchParams(query)].every(
		([key, value]) => current.get(key) === value
	);
};

const conditionHolds = (
	condition: TourCondition,
	ctx: TourResolveContext
): boolean =>
	(ctx.flags?.[condition.flag] !== false) === (condition.equals ?? true);

const allHold = (conditions: TourCondition[], ctx: TourResolveContext) =>
	conditions.every((c) => conditionHolds(c, ctx));

const whenHolds = (when: TourWhen | undefined, ctx: TourResolveContext) => {
	if (when === undefined) return true;
	if ('anyOf' in when) return when.anyOf.some((all) => allHold(all, ctx));
	return allHold([when].flat(), ctx);
};

/** Tour-level condition only; steps are not looked at. */
export const isTourAvailable = (
	tour: Pick<TourDefinition, 'when'>,
	ctx: TourResolveContext = {}
): boolean => whenHolds(tour.when, ctx);

/**
 * The steps of a tour for one run: those whose conditions hold, in order, or
 * none when the tour-level condition fails. Resolve once when the tour
 * starts and hand the result to everything that counts steps (adapter,
 * reducer, host) so they agree. Resolved steps carry no `when`, which keeps
 * a second resolution harmless.
 */
export const resolveTourSteps = (
	tour: Pick<TourDefinition, 'steps' | 'when'>,
	ctx: TourResolveContext = {}
): TourStep[] => {
	if (!isTourAvailable(tour, ctx)) {
		return [];
	}
	return tour.steps
		.filter((step) => whenHolds(step.when, ctx))
		.map(({ when: _when, ...step }) => step);
};

export const mapStepsToJoyride = (steps: TourStep[]): Step[] =>
	steps.map((step) => ({
		id: step.id,
		target: step.target ? tourTargetSelector(step.target) : 'body',
		placement: step.placement ?? (step.target ? 'bottom' : 'center'),
		title: step.titleKey,
		content: step.contentKey,
		// An action step requires keyboard access to the highlighted app UI.
		...((step.advanceOn || step.interactive) && { disableFocusTrap: true }),
		// Read by the tooltip: no Next on a self-advancing step, no Back after
		// an action that cannot be undone.
		...((step.advanceOn || step.hideBack) && {
			data: {
				...(step.advanceOn && { advanceOn: step.advanceOn }),
				...(step.hideBack && { hideBack: true })
			}
		})
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
	const widthCoverage =
		Math.min(targetRect.width, viewport.width) / viewport.width;
	const heightCoverage =
		Math.min(targetRect.height, viewport.height) / viewport.height;
	// A side placement needs horizontal room, top/bottom need vertical room;
	// 'auto' can use whichever axis still has space.
	let coverage;
	if (placement === 'left' || placement === 'right') {
		coverage = widthCoverage;
	} else if (placement === 'top' || placement === 'bottom') {
		coverage = heightCoverage;
	} else {
		coverage = Math.min(widthCoverage, heightCoverage);
	}
	// A tall target leaves no room above or below it, so a top/bottom/auto
	// tooltip lands off-screen (seen on Dev with the profile and settings
	// cards, FE#2340): show it centred over the target instead.
	const tall =
		placement !== 'left' &&
		placement !== 'right' &&
		heightCoverage >= TALL_TARGET_HEIGHT_SHARE;
	return coverage >= 0.85 || tall ? 'center' : placement;
};

/** Share of the viewport height above which a target counts as tall. */
export const TALL_TARGET_HEIGHT_SHARE = 0.6;

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
 * reported as completion; a missing final REQUIRED target closes the tour
 * without a terminal status so it stays resumable. A missing final OPTIONAL
 * target (per `steps` metadata) completes the tour when moving forward —
 * trailing optional steps must never trap a fresh account in `in_progress`.
 * Guided tours can stop on every missing required target via their policy.
 */
export const reduceTourCallback = (
	state: TourRunState,
	cb: TourCallbackInput,
	stepCount: number,
	steps?: ReadonlyArray<Pick<TourStep, 'optional'>>,
	requiredTargetPolicy: TourDefinition['requiredTargetPolicy'] = 'skip'
): TourReduction => {
	const events: TourEvent[] = [];
	const next = { ...state };
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
		const isOptional = !!steps?.[cb.index]?.optional;
		events.push(isOptional ? 'optional_step_skipped' : 'target_missing');
		if (!isOptional && requiredTargetPolicy === 'stop') {
			next.run = false;
			return { state: next, events };
		}
		const direction = cb.action === ACTIONS.PREV ? -1 : 1;
		const nextIndex = cb.index + direction;
		if (nextIndex < 0 || nextIndex >= stepCount) {
			next.run = false;
			if (isOptional && direction === 1) {
				// Running forward off the end over an optional step is a
				// finished tour, not an interrupted one.
				next.status = 'completed';
				events.push('tour_completed');
			}
			// Otherwise: close without a terminal status so the tour stays
			// resumable.
		} else {
			next.stepIndex = nextIndex;
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

/**
 * How long to wait for a step's target. An optional step on a page that is
 * already there (no navigation for this step) gets a short wait: its target
 * either rendered already or does not exist for this account or viewport, so
 * several skipped steps in a row must not each cost the full timeout.
 */
export const OPTIONAL_SETTLED_TIMEOUT_MS = 600;

export const targetWaitMs = (
	step: Pick<TourStep, 'optional'>,
	navigated: boolean,
	baseMs: number
): number =>
	step.optional && !navigated
		? Math.min(baseMs, OPTIONAL_SETTLED_TIMEOUT_MS)
		: baseMs;
