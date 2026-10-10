import * as React from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { TFunction } from 'i18next';
import type {
	DpaSignPreviewResponse,
	DpaSignatureResponse
} from '../../api/apiDpaSignature';
import { LegalContentRenderer } from '../legalContent/LegalContentRenderer';
import { resolveLegalContent } from '../../utils/legalContent';
import { formatDpaDate, parseDpaUtcTime } from './formatDpaDate';
import './dpaSignedContract.styles.scss';

export interface DpaPrintReceipt {
	preview: DpaSignPreviewResponse;
	language: string;
	confirmation: DpaSignatureResponse & {
		signerName: string;
		signerPosition: string;
		signedAt: string;
	};
}

/** Never attach a receipt to a different contract, or fill missing server data from the form. */
export const createDpaPrintReceipt = (
	preview: DpaSignPreviewResponse,
	confirmation: DpaSignatureResponse,
	language: string
): DpaPrintReceipt | null => {
	const { signerName, signerPosition, signedAt, dpaVersion } = confirmation;
	if (
		confirmation.status !== 'SIGNED' ||
		!signerName?.trim() ||
		!signerPosition?.trim() ||
		!signedAt ||
		!Number.isFinite(parseDpaUtcTime(signedAt)) ||
		!dpaVersion ||
		parseDpaUtcTime(dpaVersion) !== parseDpaUtcTime(preview.dpaVersion) ||
		!preview.tenantName?.trim() ||
		!resolveLegalContent(preview.content, language)
	) {
		return null;
	}
	return {
		preview: { ...preview },
		language,
		confirmation: { ...confirmation, signerName, signerPosition, signedAt }
	};
};

/** A body-level print document escapes the app's scroll ports and screen layout. */
export const DpaSignedContract = ({
	receipt,
	t
}: {
	receipt: DpaPrintReceipt;
	t: TFunction;
}) => {
	useEffect(() => {
		document.body.classList.add('dpaSignedContractReady');
		return () => document.body.classList.remove('dpaSignedContractReady');
	}, []);
	const { preview, confirmation, language } = receipt;
	return createPortal(
		<article
			className="dpaSignedContract"
			role="document"
			aria-label={t('dpaSign.contractHeading')}
			lang={language}
		>
			<header>
				<h1>{t('dpaSign.contractHeading')}</h1>
				<p>
					{t('dpaSign.version')}{' '}
					{formatDpaDate(preview.dpaVersion, language)}
				</p>
			</header>
			<LegalContentRenderer
				content={preview.content}
				language={language}
			/>
			<section className="dpaSignedContract__confirmation">
				<h2>{t('dpaSign.signerHeading')}</h2>
				<dl>
					<dt>{t('dpaSign.organisation')}</dt>
					<dd>{preview.tenantName}</dd>
					<dt>{t('dpaSign.confirmedBy')}</dt>
					<dd>{confirmation.signerName}</dd>
					<dt>{t('dpaSign.signerPosition')}</dt>
					<dd>{confirmation.signerPosition}</dd>
					<dt>{t('dpaSign.confirmedAt')}</dt>
					<dd>{formatDpaDate(confirmation.signedAt, language)}</dd>
					{confirmation.signerOrganisation && (
						<>
							<dt>{t('dpaSign.signerNote')}</dt>
							<dd>{confirmation.signerOrganisation}</dd>
						</>
					)}
				</dl>
			</section>
		</article>,
		document.body
	);
};
