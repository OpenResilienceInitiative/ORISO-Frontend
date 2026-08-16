import { ConsentTextData } from '../../../api/apiGetConsentText';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';
import { getDepartmentForTopic } from '../../departmentLegal/getDepartmentForTopic';

/**
 * Whether the selected Fachbereich *could* carry a Träger-authored consent
 * text. The sentence is a field of the department's data-protection policy
 * (ADR-021 decision 4), so a department without a published policy cannot have
 * one — which is decidable from data the registration already holds, with no
 * request and therefore no waiting.
 */
export const departmentMayHaveConsentText = (
	agency?: AgencyDataInterface,
	topic?: TopicsDataInterface
): boolean =>
	getDepartmentForTopic(agency, topic)?.hasPublishedDpp === true &&
	!!agency?.id &&
	!!topic?.id;

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
	versionId: number | null | undefined
): string =>
	`${agencyId ?? 'none'}:${topicId ?? 'none'}:${versionId ?? 'none'}`;

/**
 * The complete input state a consent resolution is an answer to.
 *
 * This exists because the same defect has now appeared three times, each time
 * because the identity of a resolution was one field narrower than the set of
 * things that can change what the answer should be:
 *
 * 1. no identity at all — a resolution from before the fetch settled counted;
 * 2. agency/topic missing — an answer for the previous Beratungsstelle counted;
 * 3. applicability missing — an answer produced while the department looked
 *    like it had no published policy still counted after the agency data
 *    arrived and revealed that it does, so the platform wording stayed
 *    acceptable although the Träger sentence is the one that must apply.
 *
 * Widening the comparison by one field each time only postpones the fourth
 * instance. So the identity is derived here, in one place, from *everything*
 * that feeds the decision — and it is a single opaque string, so a comparison
 * cannot accidentally check some of it. Adding a fourth input means editing
 * this function and nothing else; every comparison stays correct by
 * construction.
 *
 * Computed during render from props, never in an effect: a key written by an
 * effect would itself lag behind the inputs it describes, which is the very
 * gap it exists to close.
 */
export const consentInputKey = (
	agency?: AgencyDataInterface,
	topic?: TopicsDataInterface
): string =>
	[
		agency?.id ?? 'none',
		topic?.id ?? 'none',
		// Not redundant with the ids: `departments` can arrive after the agency
		// itself, flipping applicability for an unchanged agency/topic pair.
		departmentMayHaveConsentText(agency, topic) ? 'dpp' : 'no-dpp'
	].join(':');

/**
 * Whether the sentence a help-seeker is asked to agree to is known yet.
 *
 * `pending` is not a cosmetic loading state: while it holds, there is no
 * wording on screen, and consent to wording nobody has seen is not consent.
 * Everything that can record agreement has to be inert until this resolves.
 *
 * Both settled states carry the `inputKey` they were produced for. It is
 * required rather than optional on purpose: a future state cannot forget it.
 */
export type ConsentResolution =
	| { status: 'pending' }
	| {
			/**
			 * The backend was asked and could not answer. Distinct from
			 * `resolved` with a null sentence, which means "asked, and there is
			 * no Träger wording". Treating the two alike would let a dropped
			 * request enable acceptance of the platform sentence for a
			 * Fachbereich whose own wording governs — the error path arriving
			 * at exactly the outcome the pending gate exists to prevent.
			 */
			status: 'unavailable';
			inputKey: string;
	  }
	| {
			status: 'resolved';
			consentText: ConsentTextData | null;
			inputKey: string;
	  };

/**
 * Whether a settled resolution still describes the inputs on screen.
 *
 * Resolutions are written in effects, which run after the commit that changed
 * an input. For that gap both the label and `AccountData` would otherwise still
 * be holding an answer to a question nobody is asking any more — long enough
 * for a paint, and therefore long enough for a click. A stale answer is treated
 * as "not answered yet".
 *
 * `pending` carries no key and is always current: it makes no claim about any
 * particular input state.
 */
export const answersSelection = (
	resolution: ConsentResolution,
	inputKey: string
): boolean => resolution.status === 'pending' || resolution.inputKey === inputKey;

/**
 * Whether the consent on screen may be accepted at all.
 *
 * Strictly narrower than `answersSelection`, and the two must not be conflated:
 * `unavailable` *is* a current answer — it is why the failure notice renders
 * instead of the sentence — but it is emphatically not permission to accept
 * anything. `pending` and `unavailable` both answer false here; only a
 * `resolved` answer for the current inputs opens the gate.
 *
 * Pure, and used by both components, so neither can drift from the other and
 * neither depends on effect ordering for correctness.
 */
export const mayAcceptConsent = (
	resolution: ConsentResolution,
	inputKey: string
): boolean =>
	resolution.status === 'resolved' && answersSelection(resolution, inputKey);
