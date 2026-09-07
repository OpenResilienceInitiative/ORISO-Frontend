import * as React from 'react';
import { useState } from 'react';
import { ErstantwortInfoOverlay } from './ErstantwortInfoOverlay';
import { faqQuestionFor } from './erstantwortFaqQuestions';
import { ResolvedBaustein } from './erstantwortResolve';
import './ErstantwortInfoLinks.styles.scss';

/**
 * The informational Bausteine as inline links that open the app's existing
 * dialog — variant (v2) of `VORSCHLAG-erstantwort-faq-layout-2026-09-07.md`.
 *
 * Same rule as the FAQ variant: the two safety Bausteine (`noPersonalData`,
 * `emergencyNumbers`, `UNTOGGLEABLE_BAUSTEIN_IDS`, ADR-018 §6) never appear
 * here. They stay full bubbles above, unfoldable and unmissable.
 *
 * The links are `<button>`, not `<a>`: they open a dialog in place, they have
 * no href a person could open in a new tab, and an anchor without one is a
 * screen-reader trap. They are styled as links because that is what they behave
 * like in the sentence.
 */

export interface ErstantwortInfoLinksProps {
	bausteine: ResolvedBaustein[];
	translate?: (key: string, defaultValue: string) => string;
}

export const ErstantwortInfoLinks: React.FC<ErstantwortInfoLinksProps> = ({
	bausteine,
	translate
}) => {
	const [openId, setOpenId] = useState<string | null>(null);

	const labelFor = (baustein: ResolvedBaustein): string => {
		const question = faqQuestionFor(baustein.id);
		if (!question) return baustein.headline ?? baustein.id;
		return (
			translate?.(question.key, question.defaultQuestion) ??
			question.defaultQuestion
		);
	};

	const open = bausteine.find((baustein) => baustein.id === openId);

	return (
		<>
			<ul className="erstantwortInfoLinks">
				{bausteine.map((baustein) => (
					<li key={baustein.id}>
						<button
							type="button"
							className="erstantwortInfoLinks__link"
							data-testid={`erstantwort-info-link-${baustein.id}`}
							onClick={() => setOpenId(baustein.id)}
						>
							{labelFor(baustein)}
						</button>
					</li>
				))}
			</ul>
			{open && (
				<ErstantwortInfoOverlay
					baustein={open}
					headline={labelFor(open)}
					onClose={() => setOpenId(null)}
				/>
			)}
		</>
	);
};
