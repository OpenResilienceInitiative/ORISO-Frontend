import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Overlay, OverlayItem, OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import { BUTTON_TYPES } from '../button/Button';
import { ResolvedBaustein } from './erstantwortResolve';

/**
 * One informational Baustein shown in the app's existing dialog — variant (v2)
 * of `VORSCHLAG-erstantwort-faq-layout-2026-09-07.md`.
 *
 * **No new modal.** This is the same `Overlay` that `ErstantwortEmailOverlay`
 * already opens from this very sequence, so the two dialogs the Erstantwort can
 * produce look and behave identically: same scrim, same focus trap, same close
 * button, same portal into `#overlay`.
 *
 * The body is passed as `nestedComponent` rather than as `copy`, which is the
 * one deviation from the e-mail overlay and a deliberate one: `copy` is run
 * through `translate()`, and a frozen Baustein body is finished wording, not a
 * key. Sending it through i18next would work only by accident (a missing key
 * returns itself) and would break the moment a body happened to look like a key.
 */

export interface ErstantwortInfoOverlayProps {
	/** The Baustein whose frozen wording is being shown. */
	baustein: ResolvedBaustein;
	/** Dialog headline — the question form, so it matches the link pressed. */
	headline: string;
	onClose: () => void;
}

export const ErstantwortInfoOverlay: React.FC<ErstantwortInfoOverlayProps> = ({
	baustein,
	headline,
	onClose
}) => {
	const { t } = useTranslation();

	const item: OverlayItem = {
		headline,
		nestedComponent: (
			<div className="erstantwortInfoOverlay__body">
				<p style={{ margin: 0, whiteSpace: 'pre-line' }}>
					{baustein.body}
				</p>
				{baustein.links?.length ? (
					<ul className="erstantwort__links">
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
			</div>
		),
		buttonSet: [
			{
				label: t('app.close', 'Schließen'),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.PRIMARY
			}
		]
	};

	return (
		<Overlay
			item={item}
			handleOverlay={(buttonFunction: string) => {
				if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) onClose();
			}}
		/>
	);
};
