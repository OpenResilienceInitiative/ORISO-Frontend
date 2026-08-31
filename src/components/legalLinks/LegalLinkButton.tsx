import * as React from 'react';
import { useCallback, useState } from 'react';
import { Text } from '../text/Text';
import { LegalLinkModal } from './LegalLinkModal';

export interface LegalLinkButtonProps {
	/** Already-translated label, as handed down by `LegalLinks`. */
	label: string;
	/**
	 * The untranslated i18n key for this entry. `LegalLinks` supplies it as the
	 * third render-prop argument; it is what decides imprint vs privacy, since
	 * the translated label does not carry that reliably in every language.
	 */
	rawLabel?: string;
	url: string;
	/** BEM class of the surrounding surface, e.g. `stage__legalLinksItem`. */
	textClassName?: string;
}

/**
 * A legal link on a public page (stage, stage layout footer).
 *
 * Opens a short platform-level note in a dialog instead of tearing the user
 * out of the login flow into a new tab, with the full binding document one
 * click further.
 *
 * The note is platform level on purpose: on the stage nobody has chosen a
 * Beratungsstelle yet, so no carrier's text applies. It ships in the
 * translation catalogue and therefore always exists — there is no empty-dialog
 * case to guard against, and no reason left to fall back to a new tab.
 */
export const LegalLinkButton = ({
	label,
	rawLabel,
	url,
	textClassName
}: LegalLinkButtonProps) => {
	const [isModalOpen, setIsModalOpen] = useState(false);

	const handleClick = useCallback(() => setIsModalOpen(true), []);

	const closeModal = useCallback(() => setIsModalOpen(false), []);

	return (
		<>
			<button
				type="button"
				className="button-as-link"
				data-cy-link={url}
				onClick={handleClick}
			>
				<Text className={textClassName} type="infoSmall" text={label} />
			</button>
			{isModalOpen && (
				<LegalLinkModal
					title={label}
					rawLabel={rawLabel}
					url={url}
					scope="platform"
					onClose={closeModal}
				/>
			)}
		</>
	);
};
