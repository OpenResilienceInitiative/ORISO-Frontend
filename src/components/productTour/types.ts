/**
 * Shared ORISO product-tour domain contract.
 *
 * The same names and semantics are implemented app-locally in ORISO-Frontend
 * and ORISO-Admin (design: 0 - Docs/plans/2026-07-18-react-joyride-product-tours-design.md).
 * Definitions carry i18n keys and behavior metadata only — never rendered text.
 */

export type TourAudience =
	| 'asker'
	| 'consultant'
	| 'agency_admin'
	| 'tenant_admin'
	| 'platform_admin';

export type TourStatus =
	| 'not_started'
	| 'in_progress'
	| 'completed'
	| 'skipped';

export type TourPlacement =
	| 'auto'
	| 'center'
	| 'top'
	| 'bottom'
	| 'left'
	| 'right';

/**
 * Data-only visibility condition on a tenant feature flag. Definitions are
 * shared data with ORISO-Admin, so conditions never carry functions.
 */
export interface TourCondition {
	/** Tenant flag name, e.g. `featureTeamDiscussionEnabled`. */
	flag: string;
	/**
	 * Required state of the flag, default `true`. An unset flag counts as ON
	 * (the app-wide `!== false` convention), so `{ flag }` holds until a
	 * Träger switches the feature off.
	 */
	equals?: boolean;
}

/** One condition, or a list that must all hold. */
export type TourWhen = TourCondition | TourCondition[];

/** Values a tour's conditions are resolved against, once when it starts. */
export interface TourResolveContext {
	flags?: Record<string, unknown>;
}

/**
 * What lets a step finish by itself instead of through "Next". The tooltip
 * hides "Next" on such a step; Back and close keep working. Only fires while
 * the step is shown, never for something that happened earlier.
 */
export type TourAdvanceOn =
	/** A click on `target` (a tour target name; default the step's own). */
	| { type: 'click'; target?: string }
	/**
	 * The location matches `path`: a router pattern such as
	 * `/sessions/consultant/sessionView/:rid/:id`, optionally with query
	 * params (`?channel=team`) that must all be present. Level-triggered, so a
	 * step already on that location advances at once.
	 */
	| { type: 'route'; path: string }
	/** `emitTourEvent(name)` from the tour event bus. */
	| { type: 'event'; name: string };

export interface TourStep {
	id: string;
	/** Route to navigate to before showing this step; relative app path. */
	route?: string;
	/**
	 * Semantic target name resolved as `[data-tour-target="<name>"]`.
	 * Empty string means a centered step without a page target.
	 */
	target: string;
	titleKey: string;
	contentKey: string;
	placement?: TourPlacement;
	/**
	 * An optional step is skipped silently when its target is missing
	 * (`optional_step_skipped` instead of `target_missing`), and a tour whose
	 * trailing optional targets are absent still completes. Use it for steps
	 * whose anchors only exist with content (an open session, a queued
	 * request) so tours finish on a fresh account without demo data.
	 */
	optional?: boolean;
	/** Finish this step without "Next"; see {@link TourAdvanceOn}. */
	advanceOn?: TourAdvanceOn;
	/**
	 * Variant condition. The step is dropped from the tour when it fails,
	 * resolved once at start (`resolveTourSteps`).
	 */
	when?: TourWhen;
}

export interface TourDefinition {
	id: string;
	version: number;
	surface: 'frontend' | 'admin';
	audiences: TourAudience[];
	titleKey: string;
	summaryKey: string;
	steps: TourStep[];
	/** The tour is unavailable (no steps) when this fails; see `isTourAvailable`. */
	when?: TourWhen;
	/**
	 * Default `true`. `false` disables ESC and overlay clicks so neither can
	 * mark the tour skipped; the explicit close button still ends it. For
	 * guided flows where an accidental dismissal would abort the exercise.
	 */
	dismissible?: boolean;
}

export interface TourProgress {
	tourId: string;
	tourVersion: number;
	status: TourStatus;
	currentStepId?: string;
	startedAt?: string;
	/**
	 * Timestamp of reaching a terminal status — set for BOTH 'completed' and
	 * 'skipped'. `status` is the single source of truth for the outcome;
	 * consumers must never infer completion from this field alone.
	 */
	completedAt?: string;
}

export type TourEvent =
	| 'tour_started'
	| 'step_viewed'
	| 'step_completed'
	| 'tour_skipped'
	| 'tour_completed'
	| 'tour_restarted'
	| 'target_missing'
	| 'optional_step_skipped';
