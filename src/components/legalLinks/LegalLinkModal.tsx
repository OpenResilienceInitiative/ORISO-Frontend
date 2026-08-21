import * as React from 'react';
import { useTranslation } from 'react-i18next';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { OrisoDialog } from '../modal/OrisoDialog';
import { LegalContentRenderer } from '../legalContent/LegalContentRenderer';
import { useLegalLinkContent } from './useLegalLinkContent';
import {
	PLATFORM_LEGAL_FULL_TEXT_KEY,
	platformLegalNoteKey
} from './platformLegalNote';
import './legalLinkModal.styles';

type LegalLinkModalProps = {
	title: string;
	/** Untranslated i18n key, when the caller has one — see `getLegalLinkKind`. */
	rawLabel?: string;
	url: string;
	onClose: () => void;
	/**
	 * `'platform'` shows the short platform note plus a link to the full text,
	 * for public pages where no Beratungsstelle has been chosen yet. Default
	 * `'tenant'` renders the carrier-authored document, which is what the
	 * session views want.
	 */
	scope?: 'tenant' | 'platform';
};

/**
 * Dialog for a legal link (imprint, privacy).
 *
 * Renders the text the operator authored for this tenant and **nothing else**. Until
 * 2026-08-17 this component carried a hardcoded English consent agreement as a fallback:
 * it named an operator that does not exist, claimed hosting on AWS and Azure and a
 * 365-day deletion period — none of which applies to this platform — and left
 * `{{USERNAME}}` unsubstituted. It reached help-seekers in the session views, which open
 * the dialog unconditionally.
 *
 * A legal text is authored per tenant (ADR-014 shared legal text objects, ADR-021
 * legal-text hierarchy and versioning) or it does not exist. The client must never invent
 * one: an unconfigured text is a configuration gap and is named as such, with the
 * configured address offered as the way out — the same degradation public pages already
 * apply in `LegalLinkButton`.
 */
export const LegalLinkModal = ({
	title,
	rawLabel,
	url,
	onClose,
	scope = 'tenant'
}: LegalLinkModalProps) => {
	const { t: translate } = useTranslation();
	const { kind, content } = useLegalLinkContent(title, url, rawLabel);

	return (
		<OrisoDialog
			open
			title={translate(`legal.modal.${kind}.title`)}
			icon={
				kind === 'privacy' ? (
					<DescriptionOutlinedIcon />
				) : (
					<FingerprintIcon />
				)
			}
			onClose={onClose}
			backLabel={translate('legal.modal.back')}
			confirmLabel={translate('legal.modal.confirm')}
		>
			{content ? (
				<LegalContentRenderer
					className="legalLinkModal__content"
					content={content}
				/>
			) : (
				<div className="legalLinkModal__missing" data-testid="legal-missing">
					<p>
						{translate(
							'legal.modal.missing.text',
							'Für dieses Angebot ist hier kein Rechtstext hinterlegt.'
						)}
					</p>
					{url && (
						<p>
							<a
								href={url}
								target="_blank"
								rel="noopener noreferrer"
							>
								{translate(
									'legal.modal.missing.link',
									'Zur hinterlegten Adresse'
								)}
							</a>
						</p>
					)}
				</div>
			)}
		</OrisoDialog>
	);
};
