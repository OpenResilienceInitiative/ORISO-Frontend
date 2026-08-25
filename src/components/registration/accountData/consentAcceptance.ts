import { ConsentTextData } from '../../../api/apiGetConsentText';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';

/**
 * Whether the selected Fachbereich *could* carry a Träger-authored consent
 * text — which is true of every Fachbereich that has been selected at all.
 *
 * This used to also require `hasPublishedDpp`, on the reasoning that a
 * department without a published policy cannot carry a sentence, so the
 * request could be skipped and the static wording shown with no waiting.
 *
 * That reasoning was wrong, and wrong in the one direction that matters. The
 * AgencyService contract defines the flag as a policy **of its own**
 * (`generated/agencyservice.d.ts`), while legal texts inherit: a department
 * with no policy of its own is governed by the Träger's, and
 * `/legal` resolves that with `sourceLevel: 'TENANT'`. So exactly the
 * departments that inherit reported `false`, skipped the request, and offered
 * the platform sentence — collecting agreement to wording that does not govern
 * them. That is the defect this whole module exists to prevent, arriving
 * through the applicability check instead of the render path
 * (ORISO-Frontend#1110).
 *
 * The saved request was an optimisation resting on a false premise, so it is
 * gone. What it bought — never showing a pending state for the common case —
 * is not worth showing the wrong sentence to the uncommon one.
 */
export const departmentMayHaveConsentText = (
	agency?: AgencyDataInterface,
	topic?: TopicsDataInterface
): boolean => !!agency?.id && !!topic?.id;

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
/**
 * A short, stable fingerprint of the wording itself.
 *
 * Not a security primitive and not required to be one — it only has to change
 * when the sentence changes, so a stored acceptance stops matching wording it
 * was never given for.
 */
const sentenceFingerprint = (sentence: string): string => {
	let hash = 5381;
	for (let i = 0; i < sentence.length; i++) {
		hash = ((hash << 5) + hash + sentence.charCodeAt(i)) | 0;
	}
	return `fp${(hash >>> 0).toString(36)}`;
};

export const consentBindingKey = (
	agencyId: number | null | undefined,
	topicId: number | null | undefined,
	versionId: number | null | undefined,
	/**
	 * The sentence as displayed, or a stand-in for it.
	 *
	 * Always part of the key, alongside the version rather than instead of it.
	 * Inherited Träger wording may carry `versionId: null`, so without this
	 * every revision of it collapsed onto one key; and a versioned text shown
	 * in another language is different wording even though the version is
	 * unchanged. The platform fallback passes its locale, having no wording of
	 * its own to fingerprint.
	 */
	renderedSentence?: string | null
): string => {
	/* Version and wording are separate components, not alternatives. Keying on
	   the version alone let a versioned text keep its binding across a language
	   switch — the reader sees other words, the box stays ticked. Keying on the
	   wording alone would miss a republished text that happens to read the same
	   in the shown language. Either changing must untick (ORISO-Frontend#1110). */
	const wording = renderedSentence
		? sentenceFingerprint(renderedSentence)
		: 'none';
	return `${agencyId ?? 'none'}:${topicId ?? 'none'}:${versionId ?? 'none'}:${wording}`;
};

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
 * It carried a third component for applicability, back when that depended on
 * `departments` arriving after the agency. Since applicability now follows from
 * the two ids alone (see `departmentMayHaveConsentText`), that component could
 * not vary independently of them — an inert field, and tests asserting it
 * flipped could not fail. Removed rather than kept as decoration.
 *
 * Computed during render from props, never in an effect: a key written by an
 * effect would itself lag behind the inputs it describes, which is the very
 * gap it exists to close.
 */
export const consentInputKey = (
	agency?: AgencyDataInterface,
	topic?: TopicsDataInterface
): string => [agency?.id ?? 'none', topic?.id ?? 'none'].join(':');

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
): boolean =>
	resolution.status === 'pending' || resolution.inputKey === inputKey;

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

/**
 * The resolution that actually applies to the inputs on screen.
 *
 * Two jobs, and both have to happen during render rather than in an effect:
 *
 * 1. A settled answer for *other* inputs is not an answer here, so it is
 *    treated as `pending` until the effect replaces it.
 * 2. An **unconfigured** input needs no effect at all. A Fachbereich that
 *    cannot carry a Träger sentence issues no request, so nothing is ever
 *    pending for it and the answer — today's static wording — is knowable
 *    synchronously. Deriving it here is what keeps that case from flickering
 *    through a disabled checkbox and a "loading" notice while nothing loads,
 *    which is exactly what happened when only the key was compared: switching
 *    from a configured department to an unconfigured one left the previous
 *    answer mismatched, and rule 1 alone turned that into a spurious `pending`.
 *
 * Shared by both components so the answer and the gate cannot disagree.
 */
export const effectiveConsentResolution = (
	resolution: ConsentResolution,
	agency?: AgencyDataInterface,
	topic?: TopicsDataInterface
): ConsentResolution => {
	const inputKey = consentInputKey(agency, topic);

	if (!departmentMayHaveConsentText(agency, topic)) {
		return { status: 'resolved', consentText: null, inputKey };
	}

	return answersSelection(resolution, inputKey)
		? resolution
		: { status: 'pending' };
};
