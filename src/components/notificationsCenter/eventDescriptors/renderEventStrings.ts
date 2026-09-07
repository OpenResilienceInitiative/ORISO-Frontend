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

export const renderEventStrings = (
	descriptor: EventDescriptor,
	translate: TranslateFn,
	input: EventStringInput = {}
): RenderedEventStrings => {
	const interpolation = { ...input.interpolation };
	const pushOfferEvent =
		/^case\.handover\.(offered|accepted|declined|expired)$/.test(
			descriptor.eventType
		);
	let titleTemplate = descriptor.titleTemplate;
	let textTemplate = descriptor.textTemplate;
	if (pushOfferEvent) {
		for (const key of ['fromConsultantName', 'toConsultantName']) {
			if (!interpolation[key])
				interpolation[key] = translate(
					'caseHandover.history.unknownConsultant'
				);
		}
		// The persisted event owns these semantics. Older events without the
		// additive field stay neutral; a reason name cannot reconstruct policy.
		const variant =
			interpolation.accessType === 'CO_ACCESS'
				? 'coAccess'
				: interpolation.accessType === 'TAKEOVER'
					? null
					: 'generic';
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
