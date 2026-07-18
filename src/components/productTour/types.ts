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
}

export interface TourDefinition {
	id: string;
	version: number;
	surface: 'frontend' | 'admin';
	audiences: TourAudience[];
	titleKey: string;
	summaryKey: string;
	steps: TourStep[];
}

export interface TourProgress {
	tourId: string;
	tourVersion: number;
	status: TourStatus;
	currentStepId?: string;
	startedAt?: string;
	completedAt?: string;
}

export type TourEvent =
	| 'tour_started'
	| 'step_viewed'
	| 'step_completed'
	| 'tour_skipped'
	| 'tour_completed'
	| 'tour_restarted'
	| 'target_missing';
