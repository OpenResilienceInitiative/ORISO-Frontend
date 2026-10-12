import * as React from 'react';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import htmlParser from '../../resources/scripts/util/htmlParser';
import {
	normalizeLegalLang,
	resolveLegalContent
} from '../../utils/legalContent';
import { sanitizeLegalHtml } from './legalHtmlSanitizer';
import './legalContent.styles.scss';

export interface LegalContentRendererProps {
	/**
	 * Raw legal content: either plain HTML or a JSON language->HTML map
	 * (optionally with `<lang>__meta` machine-translation markers).
	 */
	content: string | null | undefined;
	className?: string;
	/** Optional explicit language for public legal flows that provide their own selector. */
	language?: string;
}

/**
 * Renders a legal text (imprint / data privacy policy) resolved to the
 * user's UI language (spec S2):
 * - missing translation -> original language + "shown in its original
 *   language" notice
 * - machine translated -> "machine translated - the German version is
 *   legally binding" notice with a toggle to the original text
 * - `__meta` keys are never rendered as content
 */
export const LegalContentRenderer = ({
	content,
	className,
	language
}: LegalContentRendererProps) => {
	const { t, i18n } = useTranslation();
	const [showOriginal, setShowOriginal] = useState(false);

	const uiLang = normalizeLegalLang(language ?? i18n?.language);
	const resolved = useMemo(
		() => resolveLegalContent(content, uiLang),
		[content, uiLang]
	);
	const displayed = useMemo(
		() =>
			showOriginal && resolved
				? resolveLegalContent(content, resolved.originalLang)
				: resolved,
		[showOriginal, resolved, content]
	);
	const sanitizedHtml = useMemo(
		() => sanitizeLegalHtml(displayed?.html),
		[displayed]
	);

	if (!displayed) {
		return null;
	}

	const showsFallbackLanguage = !showOriginal && displayed.lang !== uiLang;

	return (
		<div className={clsx('legalContentRenderer', className)}>
			{showsFallbackLanguage && (
				<p className="legalContentRenderer__notice" role="note">
					{t('legal.notice.fallbackLanguage')}
				</p>
			)}
			{displayed.isMachineTranslated && (
				<p
					className="legalContentRenderer__notice legalContentRenderer__notice--machineTranslated"
					role="note"
				>
					{t('legal.notice.machineTranslated')}{' '}
					<button
						type="button"
						className="legalContentRenderer__noticeAction"
						onClick={() => setShowOriginal(true)}
					>
						{t('legal.notice.showOriginal')}
					</button>
				</p>
			)}
			{showOriginal && (
				<p className="legalContentRenderer__notice" role="note">
					{t('legal.notice.showingOriginal')}{' '}
					<button
						type="button"
						className="legalContentRenderer__noticeAction"
						onClick={() => setShowOriginal(false)}
					>
						{t('legal.notice.showTranslation')}
					</button>
				</p>
			)}
			<div className="legalContentRenderer__content">
				{htmlParser(sanitizedHtml)}
			</div>
		</div>
	);
};
