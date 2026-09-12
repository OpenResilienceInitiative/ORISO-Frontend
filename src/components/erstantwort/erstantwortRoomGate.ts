import { Modality } from '../session/getModality';

/**
 * How a recognised Erstantwort (`FIRST_RESPONSE`) event is drawn in a room.
 *
 * - `'sequence'`    → the staged Carimat sequence (ADR-018).
 * - `'unavailable'` → one short neutral system line. Used where the sequence
 *                     would be a category error: an internal counsellor room
 *                     (`INTERNAL_GROUP`) has no advice seeker to greet, and the
 *                     catalogue would silently resolve to Agency Counselling.
 *                     Also used when the modality cannot be determined — the
 *                     alternative is the generic system-notification chrome,
 *                     which prints the raw JSON payload.
 * - `'none'`        → not an Erstantwort event; render as usual.
 *
 * Why this exists: team-agency 1:1 sessions were stamped `INTERNAL_GROUP`
 * (ADR-006 gap, UserService WP-A fixes the stamping) and the counsellor saw
 * the raw payload in the mail chat.
 */
export type ErstantwortRenderMode = 'sequence' | 'unavailable' | 'none';

const EXCLUDED_MODALITIES: ReadonlySet<Modality> = new Set([
	Modality.INTERNAL_GROUP
]);

export const getErstantwortRenderMode = (
	isErstantwortEvent: boolean,
	modality: Modality | undefined
): ErstantwortRenderMode => {
	if (!isErstantwortEvent) {
		return 'none';
	}
	if (modality === undefined || EXCLUDED_MODALITIES.has(modality)) {
		return 'unavailable';
	}
	return 'sequence';
};
