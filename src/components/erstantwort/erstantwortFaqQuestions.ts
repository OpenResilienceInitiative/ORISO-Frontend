/**
 * **Proposal, not shipped wording.** The question-form headlines the FAQ layout
 * needs (`VORSCHLAG-erstantwort-faq-layout-2026-09-07.md`, and for Modul 1
 * `VERDRAHTUNG-modul1-faq-2026-09-07.md`).
 *
 * The catalogue's headlines are written as *statements* — "Wer Ihre Nachricht
 * liest", "Wann Sie eine Antwort erhalten". That is right above an open
 * paragraph and wrong on a closed row: a collapsed row has to read as the thing
 * the person would have asked, or nobody opens it. So a FAQ layout needs a
 * second headline per Baustein, not a reuse of the first.
 *
 * Deliberately a **separate map rather than a field on the catalogue entry**:
 * the catalogue is the ADR-018 contract between platform and Träger and must not
 * grow a field for a layout nobody has chosen yet. If the FAQ variant is
 * adopted, `questionHeadlineKey` / `defaultQuestionHeadline` move onto
 * `ErstantwortCatalogueEntry` and this file disappears.
 *
 * Bodies are **never** touched — ADR-018 §4 freezes the wording of a persisted
 * event. Only the headline above a collapsed row is new.
 *
 * ## The two safety Bausteine now have questions too — read this before reusing
 *
 * `noPersonalData` and `emergencyNumbers` are `UNTOGGLEABLE_BAUSTEIN_IDS`
 * (ADR-018 §6: "no toggle at all"). Until 2026-09-07 this file deliberately had
 * **no** question for them, because the earlier proposal kept them as open
 * bubbles. Frank then decided that Modul 1 folds **every** question into the
 * accordion, explicitly including "Soll ich meinen Namen nennen oder nicht?",
 * so that the sequence shows nothing but short lines.
 *
 * Why that is not a breach of §6, and where it still needs a decision:
 *
 * - **Collapsing is not switching off.** §6 forbids a *toggle* — a Träger
 *   configuration that makes the Baustein disappear. A disclosure row is
 *   present in the DOM, present on screen, and present in the accessibility
 *   tree; nothing about it is configurable and no Träger can remove it.
 * - **The ordering guarantee holds.** §5/§6 require the safety Bausteine before
 *   every optional action. The FAQ bubble sits above `emailNotification` and
 *   `accountProtection`, so both safety texts are still passed before any
 *   optional action is offered.
 * - **What is genuinely a product decision** is putting the emergency numbers
 *   one tap away from somebody in an acute crisis. That is not a rule this file
 *   can settle, so `ErstantwortModul1.stories.tsx` ships both shapes — folded
 *   and left open — and the recommendation lives in the Verdrahtung document.
 *
 * A consumer that wants the pre-2026-09-07 behaviour asks for
 * `ERSTANTWORT_FAQ_BAUSTEIN_IDS` (informational only); the folded-everything
 * order is `ERSTANTWORT_MODUL1_FAQ_ROW_IDS`.
 */

export interface ErstantwortFaqQuestion {
	/** i18n key, following the catalogue's `erstantwort.<id>.*` convention. */
	key: string;
	/** German fallback so Storybook and a missing key both read as real text. */
	defaultQuestion: string;
}

/**
 * The informational Bausteine, in catalogue order — the set the first proposal
 * (`Templates/Erstantwort-Layouts`, v1) folds away. No safety Baustein is in
 * here, and none may be added: that variant keeps them as open bubbles, and a
 * silent change to this array would change what that story is comparing.
 */
export const ERSTANTWORT_FAQ_BAUSTEIN_IDS = [
	'whoReadsAlong',
	'responseDeadline',
	'modalityNote',
	'dataProtection',
	'freeNotice'
] as const;

export type ErstantwortFaqBausteinId =
	(typeof ERSTANTWORT_FAQ_BAUSTEIN_IDS)[number];

/**
 * Modul 1's row order, which is **Frank's order, not catalogue order**
 * (2026-09-07). The catalogue runs `whoReadsAlong · responseDeadline ·
 * modalityNote · noPersonalData · emergencyNumbers · dataProtection ·
 * freeNotice`; this list pulls `noPersonalData` up to the third row and pushes
 * `emergencyNumbers` to the last.
 *
 * The reading behind it: rows 1–3 are what a person asks in the first seconds
 * ("who sees this, when do I hear back, do I have to say who I am"), and the
 * emergency numbers are the row you scan for when you need them rather than one
 * you read in order.
 *
 * `freeNotice` sits **after** the emergency numbers on purpose: it is the one
 * Träger-authored row, and no Träger text should be able to push the emergency
 * row further down. That is a stricter reading than the catalogue's "just before
 * the closing", not a looser one. Open point for Frank all the same.
 */
export const ERSTANTWORT_MODUL1_FAQ_ROW_IDS = [
	'whoReadsAlong',
	'responseDeadline',
	'noPersonalData',
	'modalityNote',
	'dataProtection',
	'emergencyNumbers',
	'freeNotice'
] as const;

export const ERSTANTWORT_FAQ_QUESTIONS: Record<string, ErstantwortFaqQuestion> =
	{
		whoReadsAlong: {
			key: 'erstantwort.whoReadsAlong.question',
			defaultQuestion: 'Wer liest meine Nachricht?'
		},
		responseDeadline: {
			key: 'erstantwort.responseDeadline.question',
			defaultQuestion: 'Wann bekomme ich eine Antwort?'
		},
		/* Frank's wording, shortened to fit one line on a 390px phone. His spoken
		   form was "Soll ich meinen Namen nennen oder nicht?"; the trailing
		   "oder nicht" wraps the row on a phone and adds nothing a question mark
		   does not already carry. */
		noPersonalData: {
			key: 'erstantwort.noPersonalData.question',
			defaultQuestion: 'Soll ich meinen Namen nennen?'
		},
		modalityNote: {
			key: 'erstantwort.modalityNote.question',
			defaultQuestion: 'Wie läuft die Beratung ab?'
		},
		dataProtection: {
			key: 'erstantwort.dataProtection.question',
			defaultQuestion: 'Was passiert mit meinen Daten?'
		},
		/* Deliberately the person's own words in a crisis rather than a label:
		   "Notfallnummern" is what the platform calls it, "Was, wenn es nicht
		   warten kann?" is what somebody thinks at 2 a.m. The Baustein's own
		   headline ("Wenn es nicht warten kann") is the statement form of the
		   same sentence, so the two stay recognisably one thing. */
		emergencyNumbers: {
			key: 'erstantwort.emergencyNumbers.question',
			defaultQuestion: 'Was, wenn es nicht warten kann?'
		},
		/* The Freier Hinweis has no question the platform can know — its whole
		   point is that the catalogue does not anticipate its content. This
		   fallback keeps the row readable; a Träger that fills the Baustein
		   should be able to type its question too (open point for Frank). */
		freeNotice: {
			key: 'erstantwort.freeNotice.question',
			defaultQuestion: 'Was diese Beratungsstelle noch sagt'
		}
	};

export const faqQuestionFor = (
	id: string
): ErstantwortFaqQuestion | undefined => ERSTANTWORT_FAQ_QUESTIONS[id];
