import * as React from 'react';
import { ErstantwortDisclosure } from './ErstantwortDisclosure';
import { faqQuestionFor } from './erstantwortFaqQuestions';
import { ResolvedBaustein } from './erstantwortResolve';
import './ErstantwortFaqGroup.styles.scss';

/**
 * The informational Bausteine as collapsed rows inside **one** Carimat bubble —
 * variant (v1) of `VORSCHLAG-erstantwort-faq-layout-2026-09-07.md`.
 *
 * What it does **not** do, and must never do: swallow a safety Baustein.
 * `noPersonalData` and `emergencyNumbers` are `UNTOGGLEABLE_BAUSTEIN_IDS`
 * (ADR-018 §6) and stay full bubbles above this one. This component only ever
 * receives Bausteine the caller selected, and it renders whatever it is given —
 * so the selection is the caller's responsibility and is asserted in the
 * layout stories.
 *
 * Bodies are passed through **verbatim**. ADR-018 §4 freezes the wording of a
 * persisted event; a layout may fold that wording up, never rewrite it. Only
 * the row headline is new (`erstantwortFaqQuestions.ts`), because a statement
 * headline does not work on a closed row — nobody opens "Wann Sie eine Antwort
 * erhalten", but they do open "Wann bekomme ich eine Antwort?".
 */

export interface ErstantwortFaqGroupProps {
	bausteine: ResolvedBaustein[];
	/**
	 * Open the first row on arrival. Both settings are in the stories: closed
	 * shows the whole sequence at a glance, open shows that the rows are
	 * openable at all.
	 */
	openFirst?: boolean;
	translate?: (key: string, defaultValue: string) => string;
}

export const ErstantwortFaqGroup: React.FC<ErstantwortFaqGroupProps> = ({
	bausteine,
	openFirst = false,
	translate
}) => {
	if (!bausteine.length) return null;

	return (
		<div className="erstantwortFaqGroup">
			{bausteine.map((baustein, index) => {
				const question = faqQuestionFor(baustein.id);
				/* A Baustein with no proposed question falls back to its own
				   headline, and to its first words if it has none — better a
				   plain row than a row labelled with an id. */
				const label = question
					? (translate?.(question.key, question.defaultQuestion) ??
						question.defaultQuestion)
					: (baustein.headline ?? baustein.body);

				return (
					<ErstantwortDisclosure
						key={baustein.id}
						question={label}
						defaultOpen={openFirst && index === 0}
						testId={`erstantwort-faq-${baustein.id}`}
					>
						<p>{baustein.body}</p>
						{baustein.links?.length ? (
							<ul>
								{baustein.links.map((link) => (
									<li key={link.url}>
										<a
											href={link.url}
											target="_blank"
											rel="noopener noreferrer"
										>
											{link.label}
										</a>
									</li>
								))}
							</ul>
						) : null}
					</ErstantwortDisclosure>
				);
			})}
		</div>
	);
};
