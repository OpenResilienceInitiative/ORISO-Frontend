import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useInRouterContext } from 'react-router-dom';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { GdprIcon, ImprintIcon } from '../../resources/img/icons';
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
 *
 * The sheet is the shared {@link M3Dialog}, the Admin panel's dialog anatomy, so a legal
 * notice, a confirm box and an error box are one design across both surfaces. It carries
 * the ORISO legal artboards rather than the MUI fingerprint/description glyphs that stood
 * here, and its body scrolls: a published legal text is far longer than this dialog is
 * tall, and the title and the actions have to stay reachable while it is read.
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

	const platformNoteFallback =
		kind === 'privacy'
			? 'Sie sind hier noch bei keiner Beratungsstelle angemeldet — dieser Hinweis gilt für die Plattform selbst.'
			: 'Sie sind hier noch bei keiner Beratungsstelle angemeldet — wer die Plattform betreibt, steht im vollständigen Impressum.';
	const platformNote =
		scope === 'platform'
			? translate(platformLegalNoteKey(kind), platformNoteFallback)
			: null;

	return (
		<M3Dialog
			title={translate(`legal.modal.${kind}.title`)}
			icon={kind === 'privacy' ? <GdprIcon /> : <ImprintIcon />}
			onClose={onClose}
			data-testid={`legal-modal-${kind}`}
			actions={[
				{
					label: translate('legal.modal.back'),
					onClick: onClose,
					testId: 'legal-modal-back'
				},
				{
					label: translate('legal.modal.confirm'),
					onClick: onClose,
					primary: true,
					testId: 'legal-modal-confirm'
				}
			]}
		>
			{scope === 'platform' ? (
				<div
					className="legalLinkModal__platformNote"
					data-testid="legal-platform"
				>
					{platformNote?.split('\n\n').map((paragraph) => (
						<p key={paragraph}>{paragraph}</p>
					))}
					{url && (
						<p>
							<LegalFullTextLink
								url={url}
								label={translate(
									PLATFORM_LEGAL_FULL_TEXT_KEY,
									'Vollständigen Text öffnen'
								)}
								onNavigate={onClose}
							/>
						</p>
					)}
				</div>
			) : content ? (
				<LegalContentRenderer
					className="legalLinkModal__content"
					content={content}
				/>
			) : (
				<div
					className="legalLinkModal__missing"
					data-testid="legal-missing"
				>
					<p>
						{translate(
							'legal.modal.missing.text',
							'Für dieses Angebot ist hier kein Rechtstext hinterlegt.'
						)}
					</p>
					{url && (
						<p>
							<LegalFullTextLink
								url={url}
								label={translate(
									'legal.modal.missing.link',
									'Zur hinterlegten Adresse'
								)}
								onNavigate={onClose}
							/>
						</p>
					)}
				</div>
			)}
		</M3Dialog>
	);
};

/**
 * The way out of the dialog to the full document.
 *
 * `/impressum` and `/datenschutz` are routes of this very app, and the configured
 * legal URL points at them unless a deployment overrides it. Opening a route of
 * the app in a new browser tab boots the whole SPA a second time — the "something
 * completely new gets loaded" this dialog was built to stop. So a same-origin
 * target is a router navigation, and only a genuinely external address (an
 * operator's own website, set via `REACT_APP_LEGAL_*_URL`) still opens a tab.
 *
 * Outside a router — Storybook, isolated tests — there is no navigation to make,
 * so it degrades to a plain link.
 */
const LegalFullTextLink = ({
	url,
	label,
	onNavigate
}: {
	url: string;
	label: string;
	onNavigate: () => void;
}) => {
	const inRouter = useInRouterContext();
	const internalPath = getInternalPath(url);

	if (internalPath && inRouter) {
		return (
			<RouterLink to={internalPath} onClick={onNavigate}>
				{label}
			</RouterLink>
		);
	}

	return (
		<a href={url} target="_blank" rel="noopener noreferrer">
			{label}
		</a>
	);
};

/**
 * `path + search + hash` when `url` points back at this app, otherwise `null`.
 * A malformed URL is treated as external: it is then handed to the browser
 * unchanged rather than fed to the router as a route that does not exist.
 */
export const getInternalPath = (url: string): string | null => {
	if (typeof window === 'undefined') {
		return null;
	}
	try {
		const parsed = new URL(url, window.location.origin);
		return parsed.origin === window.location.origin
			? `${parsed.pathname}${parsed.search}${parsed.hash}`
			: null;
	} catch {
		return null;
	}
};
