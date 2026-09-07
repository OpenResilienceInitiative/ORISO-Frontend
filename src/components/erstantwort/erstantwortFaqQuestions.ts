/**
 * **Proposal, not shipped wording.** The question-form headlines the FAQ layout
 * needs (`VORSCHLAG-erstantwort-faq-layout-2026-09-07.md`).
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
 * event. Only the headline above a collapsed row is new, and only for Bausteine
 * that are informational.
 */

export interface ErstantwortFaqQuestion {
	/** i18n key, following the catalogue's `erstantwort.<id>.*` convention. */
	key: string;
	/** German fallback so Storybook and a missing key both read as real text. */
	defaultQuestion: string;
}

/**
 * The informational Bausteine, in catalogue order. Every one of them is
 * `toggleable` or purely descriptive — none of them is a safety Baustein, and
 * `UNTOGGLEABLE_BAUSTEIN_IDS` (`noPersonalData`, `emergencyNumbers`) is
 * deliberately absent: those two never move behind a closed row.
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
		modalityNote: {
			key: 'erstantwort.modalityNote.question',
			defaultQuestion: 'Wie läuft die Beratung ab?'
		},
		dataProtection: {
			key: 'erstantwort.dataProtection.question',
			defaultQuestion: 'Was passiert mit meinen Daten?'
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
