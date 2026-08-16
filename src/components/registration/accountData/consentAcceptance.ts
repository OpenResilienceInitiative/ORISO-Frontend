import { ConsentTextData } from '../../../api/apiGetConsentText';

/**
 * Identity of the exact consent a help-seeker can give.
 *
 * The registration draft used to record consent as a bare boolean, from a time
 * when there was one sentence for everyone. Since ADR-021 decision 4 the
 * wording belongs to a Fachbereich and changes with its policy version, so a
 * boolean no longer says what was agreed to. Accept agency A's sentence, go
 * back, pick agency B, return — and a restored `true` would carry A's
 * agreement onto B's wording, which was never shown, let alone accepted.
 *
 * Storing *what* was accepted rather than *that* something was accepted makes
 * that impossible by construction: the acceptance simply stops matching. It
 * also keeps the user's work on legitimate back-navigation, which clearing on
 * every agency/topic change would throw away.
 *
 * The version is part of the key because a Träger publishing new wording makes
 * the previous agreement an agreement to a different text (ADR-022 decision 5
 * draws the same line for running sessions). `none` covers backends that do
 * not carry the version history yet — there the department alone is the
 * identity, which is what the pre-#250 product had.
 */
export const consentBindingKey = (
	agencyId: number | null | undefined,
	topicId: number | null | undefined,
	versionId: string | null | undefined
): string =>
	`${agencyId ?? 'none'}:${topicId ?? 'none'}:${versionId ?? 'none'}`;

/**
 * Whether the sentence a help-seeker is asked to agree to is known yet.
 *
 * `pending` is not a cosmetic loading state: while it holds, there is no
 * wording on screen, and consent to wording nobody has seen is not consent.
 * Everything that can record agreement has to be inert until this resolves.
 */
export type ConsentResolution =
	| { status: 'pending' }
	| {
			status: 'resolved';
			consentText: ConsentTextData | null;
			/**
			 * The selection this answer belongs to. A resolution answers the
			 * question that produced it and no other.
			 */
			agencyId?: number;
			topicId?: number;
	  };

/**
 * Whether a resolution answers the selection currently on screen.
 *
 * Resolutions are written in effects, which run after the commit that changed
 * the selection. For that gap both the label and `AccountData` would otherwise
 * still be holding the previous Beratungsstelle's answer — long enough for a
 * paint, and therefore long enough for a click. Acting on it would show the
 * previous sentence with an enabled checkbox and record a binding that pairs
 * the *new* agency with the *previous* wording.
 *
 * Pure, and used by both components, so neither can drift from the other and
 * neither depends on effect ordering for correctness.
 */
export const isResolutionForSelection = (
	resolution: ConsentResolution,
	agencyId: number | undefined,
	topicId: number | undefined
): boolean =>
	resolution.status === 'resolved' &&
	resolution.agencyId === agencyId &&
	resolution.topicId === topicId;
