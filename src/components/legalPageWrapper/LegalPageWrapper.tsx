import clsx from 'clsx';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Stage } from '../stage/stage';
import './legalPageWrapper.styles.scss';
import { LegalContentRenderer } from '../legalContent/LegalContentRenderer';
import { resolveLegalContent } from '../../utils/legalContent';

export interface LegalPageWrapperProps {
	className?: string;
	/**
	 * Server-resolved legal content (single HTML string). Backwards
	 * compatible path: old backends only deliver this.
	 */
	content?: string | null;
	/**
	 * Raw multilingual legal content (language->HTML map with optional
	 * `<lang>__meta` machine-translation markers) from the new additive
	 * TenantService fields `content.impressumLanguages` /
	 * `content.privacyLanguages`. Accepts the object shape delivered by the
	 * backend or an already-serialized JSON string. When it has renderable
	 * content it is preferred over `content`, so the client resolves the UI
	 * language itself and can show the machine-translation /
	 * original-language notices. Absent on older backends.
	 */
	rawContent?: string | Record<string, string> | null;
	/**
	 * True while the tenant data has not arrived yet. Suppresses the
	 * placeholder warning so it does not flash during the initial load.
	 */
	loading?: boolean;
}

/**
 * Shared layout for the public tenant legal pages (/impressum, /datenschutz,
 * terms). Content preference:
 * 1. `rawContent` (raw language map, new backend) -> client-side resolution
 *    via LegalContentRenderer incl. MT + fallback-language notices.
 * 2. `content` (server-resolved string, old backend) -> rendered unchanged,
 *    no notices — exactly the previous behavior.
 * 3. Neither renderable (missing/empty tenant legal text) -> a clearly
 *    visible placeholder warning instead of silently rendering nothing.
 */
export const LegalPageWrapper = ({
	className,
	content,
	rawContent,
	loading = false
}: LegalPageWrapperProps) => {
	const { t } = useTranslation();

	// The backend delivers the raw map as an object; the resolver works on
	// the serialized form (same as department legal content).
	const rawContentString =
		typeof rawContent === 'string'
			? rawContent
			: rawContent && typeof rawContent === 'object'
				? JSON.stringify(rawContent)
				: undefined;

	// "Renderable" check is language-independent: resolveLegalContent
	// returns null only when there is no non-empty content in any language
	// (e.g. an empty map from a tenant without stored content).
	const effectiveContent = resolveLegalContent(rawContentString, 'de')
		? rawContentString
		: content;
	const isPlaceholder =
		!loading && !resolveLegalContent(effectiveContent, 'de');

	return (
		<div className={clsx('legalPageWrapper stageLayout', className)}>
			<Stage className="stageLayout__stage" />
			<div className={clsx('stageLayout__content', className)}>
				<section className="template">
					{isPlaceholder ? (
						<p
							className="legalPageWrapper__placeholderNotice"
							role="note"
						>
							{t('legal.notice.placeholder')}
						</p>
					) : (
						<LegalContentRenderer content={effectiveContent} />
					)}
				</section>
			</div>
		</div>
	);
};
