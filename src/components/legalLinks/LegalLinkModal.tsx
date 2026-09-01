import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useInRouterContext } from 'react-router-dom';
import { routePathNames } from '../../resources/scripts/config';
import { toSameOriginRoute } from '../stageLayout/stageLayoutRoutes';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { GdprIcon, ImprintIcon } from '../../resources/img/icons';
import { LegalTextReader } from '../legalContent/LegalTextReader';
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
	const documentTitle = translate(`legal.modal.${kind}.title`);

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
			title={documentTitle}
			icon={kind === 'privacy' ? <GdprIcon /> : <ImprintIcon />}
			onClose={onClose}
			closeLabel={translate('app.close', 'Schließen')}
			/* A published document is long-form reading and gets the wider sheet;
			   the short platform note would only end up with a very short measure
			   in it. */
			width={scope === 'platform' || !content ? 560 : 760}
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
				/* A published legal text gets the reading surface, not a wall of
				   text: chapter chips, in-place scrolling and a fullscreen mode,
				   the same three the Admin panel's legal reader carries. */
				<LegalTextReader
					content={content}
					label={documentTitle}
					onClose={onClose}
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
 * The paths this app actually **registers a route for** — not the paths it has
 * names for. Same-origin is not enough to hand a URL to the router: a
 * deployment can point `REACT_APP_LEGAL_*_URL` at a same-origin document that
 * is not a route (`/documents/privacy.pdf`), and `app.tsx` funnels unknown
 * paths into `AuthenticatedApp` — a signed-out reader would be bounced to the
 * login screen instead of reaching the document.
 *
 * `routePathNames.termsAndConditions` is deliberately NOT here, however much it
 * looks like it belongs: its route is commented out in `initApp.tsx`, so
 * `/nutzungsbedingungen` is an unknown path and would hit exactly that
 * catch-all. Add it back here in the same change that re-enables the route,
 * never before — `routePathNames` records intent, the router records reality.
 */
const IN_APP_LEGAL_PATHS = [routePathNames.imprint, routePathNames.privacy];

export const getInternalPath = (url: string): string | null => {
	if (typeof window === 'undefined') {
		return null;
	}
	// One answer to "is this our origin" for the whole app: the stage layout's
	// helper, which compares `URL.origin` rather than matching a prefix — so a
	// protocol-relative `//evil.example/x` or a userinfo host like
	// `https://our.origin@evil.example/` resolves foreign and stays a browser
	// link.
	const route = toSameOriginRoute(url);
	if (!route) {
		return null;
	}
	const queryStart = route.search(/[?#]/);
	const pathname = queryStart === -1 ? route : route.slice(0, queryStart);
	const rest = queryStart === -1 ? '' : route.slice(queryStart);
	// Trailing slashes are equivalent for routing; a deeper path is not.
	const normalized = pathname.replace(/\/+$/, '') || '/';
	return IN_APP_LEGAL_PATHS.includes(normalized)
		? `${normalized}${rest}`
		: null;
};
