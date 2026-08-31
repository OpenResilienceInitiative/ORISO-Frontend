import * as React from 'react';
import { useTranslation } from 'react-i18next';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { CircularProgress } from '@mui/material';
import { OrisoDialog } from '../modal/OrisoDialog';
import { LegalContentRenderer } from '../legalContent/LegalContentRenderer';
import { useLegalLinkContent } from './useLegalLinkContent';
import { useDepartmentLegal } from '../../api/useDepartmentLegal';
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
	 * for public pages where no Beratungsstelle has been chosen yet.
	 * `'agency'` loads the department's published Impressum/DPP (profile card).
	 * Default `'tenant'` renders the carrier-authored document, which is what
	 * the session views want.
	 */
	scope?: 'tenant' | 'platform' | 'agency';
	/** Required when `scope` is `'agency'`. */
	agencyId?: number;
	/** Required when `scope` is `'agency'`. */
	topicId?: number;
};

/**
 * Dialog for a legal link (imprint, privacy).
 *
 * Renders the text authored for the requested level and **nothing else**. Until
 * 2026-08-17 this component carried a hardcoded English consent agreement as a fallback:
 * it named an operator that does not exist, claimed hosting on AWS and Azure and a
 * 365-day deletion period — none of which applies to this platform — and left
 * `{{USERNAME}}` unsubstituted. It reached help-seekers in the session views, which open
 * the dialog unconditionally.
 *
 * A legal text is authored per tenant (ADR-014 shared legal text objects, ADR-021
 * legal-text hierarchy and versioning) or per department, or it does not exist.
 * The client must never invent one: an unconfigured text is a configuration gap
 * and is named as such, with the configured address offered as the way out — the
 * same degradation public pages already apply in `LegalLinkButton`.
 */
export const LegalLinkModal = ({
	title,
	rawLabel,
	url,
	onClose,
	scope = 'tenant',
	agencyId,
	topicId
}: LegalLinkModalProps) => {
	const { t: translate } = useTranslation();
	const { kind, content } = useLegalLinkContent(title, url, rawLabel);
	const isAgency = scope === 'agency';
	const { data: departmentLegal, loading: agencyLoading } =
		useDepartmentLegal(
			isAgency ? agencyId : null,
			isAgency ? topicId : null,
			{
				enabled: isAgency
			}
		);
	const agencyContent =
		kind === 'privacy'
			? departmentLegal?.dpp?.content
			: departmentLegal?.imprint?.content;

	const platformNoteFallback =
		kind === 'privacy'
			? 'Sie sind hier noch bei keiner Beratungsstelle angemeldet — dieser Hinweis gilt für die Plattform selbst.'
			: 'Sie sind hier noch bei keiner Beratungsstelle angemeldet — wer die Plattform betreibt, steht im vollständigen Impressum.';
	const platformNote =
		scope === 'platform'
			? translate(platformLegalNoteKey(kind), platformNoteFallback)
			: null;

	const missing = (
		<div className="legalLinkModal__missing" data-testid="legal-missing">
			<p>
				{translate(
					'legal.modal.missing.text',
					'Für dieses Angebot ist hier kein Rechtstext hinterlegt.'
				)}
			</p>
			{url && (
				<p>
					<a href={url} target="_blank" rel="noopener noreferrer">
						{translate(
							'legal.modal.missing.link',
							'Zur hinterlegten Adresse'
						)}
					</a>
				</p>
			)}
		</div>
	);

	let body: React.ReactNode;
	if (scope === 'platform') {
		body = (
			<div
				className="legalLinkModal__platform"
				data-testid="legal-platform"
			>
				{platformNote?.split('\n\n').map((paragraph) => (
					<p key={paragraph}>{paragraph}</p>
				))}
				{url && (
					<p>
						<a href={url} target="_blank" rel="noopener noreferrer">
							{translate(
								PLATFORM_LEGAL_FULL_TEXT_KEY,
								'Vollständigen Text öffnen'
							)}
						</a>
					</p>
				)}
			</div>
		);
	} else if (isAgency) {
		if (agencyLoading) {
			body = (
				<CircularProgress
					size={20}
					aria-label="loading"
					data-testid="legal-loading"
				/>
			);
		} else if (agencyContent) {
			body = (
				<div data-testid="legal-agency">
					<LegalContentRenderer
						className="legalLinkModal__content"
						content={agencyContent}
					/>
				</div>
			);
		} else {
			body = missing;
		}
	} else if (content) {
		body = (
			<LegalContentRenderer
				className="legalLinkModal__content"
				content={content}
			/>
		);
	} else {
		body = missing;
	}

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
			{body}
		</OrisoDialog>
	);
};
