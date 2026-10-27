/**
 * WP-06 Activity Timeline — client-side string rendering (Slice 0a).
 *
 * Renders an event's visible title/text from its i18n templates (ADR-AT-01: the
 * server record is text-free; every visible string is produced client-side).
 *
 * Migration bridge: until the strict text-free record migration lands (Slice 2)
 * the backend still sends `title`/`text`. Those are passed as `fallbackTitle` /
 * `fallbackText` and used only as the i18n `defaultValue`, so:
 *   - seeded types render from their template, and
 *   - not-yet-migrated / unknown types still show the server text instead of a
 *     raw key.
 * When the server stops sending text, the templates become the sole source and
 * nothing else here changes — no server-side rendered text is introduced.
 */

import { EventDescriptor } from './types';

/** Minimal translate signature, satisfied by i18next's `t`. */
export type TranslateFn = (
	key: string,
	options?: Record<string, unknown>
) => string;

export interface EventStringInput {
	/** Server-provided title used only as i18n defaultValue (pre-Slice-2). */
	fallbackTitle?: string | null;
	/** Server-provided text used only as i18n defaultValue (pre-Slice-2). */
	fallbackText?: string | null;
	/** Structured interpolation values for the template (e.g. name, topic). */
	interpolation?: Record<string, unknown>;
}

export interface RenderedEventStrings {
	title: string;
	text: string;
}

/**
 * Handover events whose wording depends on the frozen server `accessType`
 * (CO_ACCESS = temporary read access, TAKEOVER = case changes hands).
 * `withoutAccessType` names the variant used while the producer does not send
 * the field: `null` keeps the base (takeover) wording, which is only allowed
 * when the backend can emit nothing else for that event.
 */
const HANDOVER_ACCESS_WORDING: Record<
	string,
	{ withoutAccessType: 'generic' | null }
> = {
	// ORISO-UserService creates colleague offers as TAKEOVER only
	// (CaseHandoverService#createOffer rejects CO_ACCESS reasons).
	'case.handover.offer.received': { withoutAccessType: null },
	// Granted covers both a temporary co-access and a completed takeover.
	'case.handover.granted': { withoutAccessType: 'generic' }
};

export const renderEventStrings = (
	descriptor: EventDescriptor,
	translate: TranslateFn,
	input: EventStringInput = {}
): RenderedEventStrings => {
	const interpolation: Record<string, unknown> = { ...input.interpolation };
	let titleTemplate = descriptor.titleTemplate;
	let textTemplate = descriptor.textTemplate;
	const handover = HANDOVER_ACCESS_WORDING[descriptor.eventType];
	if (handover) {
		// #1714: real names from the producer; never a raw {{placeholder}}.
		interpolation.fromConsultantName =
			interpolation.initiatorName ||
			translate('caseHandover.history.unknownColleague');
		interpolation.toConsultantName =
			interpolation.requesterName ||
			translate('caseHandover.history.unknownColleague');
		// The persisted event owns the access semantics. A reason label can
		// not reconstruct policy, so an absent accessType falls back to the
		// wording that is true for every access type this event can carry.
		const variant =
			interpolation.accessType === 'CO_ACCESS'
				? 'coAccess'
				: interpolation.accessType === 'TAKEOVER'
					? null
					: handover.withoutAccessType;
		if (variant) {
			titleTemplate = titleTemplate.replace(
				/\.title$/,
				`.${variant}.title`
			);
			textTemplate = textTemplate.replace(/\.text$/, `.${variant}.text`);
		}
	}
	const title = translate(titleTemplate, {
		defaultValue: input.fallbackTitle ?? '',
		...interpolation
	});
	const text = translate(textTemplate, {
		defaultValue: input.fallbackText ?? '',
		...interpolation
	});
	return { title, text };
};
