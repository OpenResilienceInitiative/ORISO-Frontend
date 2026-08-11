import * as React from 'react';
import { useCallback, useState } from 'react';
import { Text } from '../text/Text';
import { LegalLinkModal } from './LegalLinkModal';
import { useLegalLinkContent } from './useLegalLinkContent';

export interface LegalLinkButtonProps {
	/** Already-translated label, as handed down by `LegalLinks`. */
	label: string;
	url: string;
	/** BEM class of the surrounding surface, e.g. `stage__legalLinksItem`. */
	textClassName?: string;
}

/**
 * A legal link on a public page (stage, stage layout footer).
 *
 * Opens the tenant-authored text in a dialog instead of tearing the user out
 * of the login flow into a new tab. When the platform operator has not
 * authored the text yet, it degrades to today's behaviour and opens the
 * configured legal URL — better an external page than an empty dialog.
 */
export const LegalLinkButton = ({
	label,
	url,
	textClassName
}: LegalLinkButtonProps) => {
	const { content } = useLegalLinkContent(label, url);
	const [isModalOpen, setIsModalOpen] = useState(false);

	const handleClick = useCallback(() => {
		if (content) {
			setIsModalOpen(true);
			return;
		}
		window.open(url, '_blank', 'noopener,noreferrer');
	}, [content, url]);

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
				<LegalLinkModal title={label} url={url} onClose={closeModal} />
			)}
		</>
	);
};
