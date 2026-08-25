import * as React from 'react';
import { FC, useContext } from 'react';
import { Link, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import LegalLinks from '../../legalLinks/LegalLinks';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { ConsentTextData } from '../../../api/apiGetConsentText';
import htmlParser from '../../../resources/scripts/util/htmlParser';
import { useTraegerSentenceHtml } from './useTraegerSentenceHtml';

export interface ConsentSentenceProps {
	/**
	 * The Träger-authored consent text of the selected Fachbereich, or `null`
	 * when none is configured — which is the normal case today and must render
	 * exactly the pre-#250 sentence.
	 */
	consentText: ConsentTextData | null;
}

/**
 * The consent sentence itself — everything the checkbox label shows, and
 * nothing about where the text came from. `DataProtectionConsentLabel` owns
 * the fetch; this component owns the rendering, which is what makes both the
 * fallback and the Träger shape reviewable in Storybook without a backend.
 *
 * **Fallback** (`consentText === null`): the three i18n fragments
 * (`registration.dataProtection.label.{prefix,and,suffix}`) assembled around
 * `<LegalLinks>`, byte-for-byte as before EPIC ORISO-AgencyService#250. The
 * cookie notice is part of the `suffix` there, so no addendum is added.
 *
 * **Träger sentence**: `{{Beratungsstelle}}` and `{{Thema}}` were substituted
 * server-side (ADR-021 decision 5); this substitutes `{{legal_links}}` with
 * the real anchors, sanitizes through the shared legal-HTML allowlist, and
 * renders the fixed, non-editable cookie/authentication notice beneath
 * (decision 2 — a Träger text *replaces* the platform sentence, so the
 * platform's mandatory disclosure has to survive that replacement on its own).
 */
export const ConsentSentence: FC<ConsentSentenceProps> = ({ consentText }) => {
	const { t } = useTranslation();
	const legalLinks = useContext(LegalLinksContext);

	const traegerSentence = useTraegerSentenceHtml(consentText);

	/* Platform wording applies only when no Träger text is configured. A
	   configured text that cannot be rendered is a fault, not a reason to show
	   different wording than the acceptance binds to (ORISO-Frontend#1110) — the
	   gate in `AccountData` keeps the checkbox disabled for exactly this case.
	
	   Rendering nothing here left a disabled checkbox with no accessible name
	   and no hint that registration cannot continue — a dead end, and the same
	   shape as the pending and unavailable branches the label already handles
	   with a message. Say what happened instead. */
	if (consentText && !traegerSentence) {
		return (
			<span role="alert" data-cy="consent-sentence-unrenderable">
				{t(
					'registration.dataProtection.unrenderable',
					'Der Einwilligungstext dieser Beratungsstelle kann derzeit nicht angezeigt werden. Bitte versuchen Sie es später erneut oder wenden Sie sich an die Beratungsstelle.'
				)}
			</span>
		);
	}

	if (!traegerSentence) {
		return (
			<Typography>
				<LegalLinks
					delimiter={', '}
					filter={(legalLink) => legalLink.registration}
					legalLinks={legalLinks}
					params={{ aid: null }}
					prefix={t('registration.dataProtection.label.prefix')}
					lastDelimiter={t('registration.dataProtection.label.and')}
					suffix={t('registration.dataProtection.label.suffix')}
				>
					{(label, url) => (
						<Link target="_blank" href={url}>
							{label}
						</Link>
					)}
				</LegalLinks>
			</Typography>
		);
	}

	return (
		<>
			<Typography
				component="span"
				/* The anchors here come from `renderToString` and are therefore
				   plain `<a>`, not the MUI `<Link>` the fallback renders. Style
				   them the same way (`primary.main`, always underlined) so the
				   two shapes are indistinguishable to a help-seeker — a policy
				   link that does not read as a link is a consent problem, not a
				   cosmetic one. */
				sx={{
					'display': 'block',
					'& a': {
						color: 'primary.main',
						textDecoration: 'underline'
					}
				}}
				data-cy="consent-sentence-traeger"
			>
				{htmlParser(traegerSentence.html)}
			</Typography>
			{traegerSentence.isMachineTranslated && (
				<Typography
					component="span"
					variant="body2"
					role="note"
					sx={{
						display: 'block',
						mt: '4px',
						color: 'text.secondary'
					}}
					data-cy="consent-machine-translated"
				>
					{t(
						'legal.notice.machineTranslated',
						'Maschinell übersetzt — rechtlich verbindlich ist die deutsche Fassung.'
					)}
				</Typography>
			)}
			{!traegerSentence.isMachineTranslated &&
				traegerSentence.lang !== traegerSentence.originalLang && (
					<Typography
						component="span"
						variant="body2"
						role="note"
						sx={{
							display: 'block',
							mt: '4px',
							color: 'text.secondary'
						}}
						data-cy="consent-fallback-language"
					>
						{t(
							'legal.notice.fallbackLanguage',
							'Dieser Text liegt nicht in Ihrer Sprache vor und wird in seiner Originalsprache angezeigt.'
						)}
					</Typography>
				)}
			<Typography
				component="span"
				variant="body2"
				sx={{ display: 'block', mt: '4px', color: 'text.secondary' }}
				data-cy="consent-cookie-notice"
			>
				{/* The client owns this wording. ORISO-AgencyService#256 states
				    it explicitly: the cookie/authentication notice "is NOT part
				    of this text: it is a fixed, non-editable addendum the
				    client renders beneath the sentence." So it comes from the
				    catalogue, not from the payload — and a Träger cannot edit
				    it away, which is the point of ADR-021 decision 2. */}
				{t(
					'registration.dataProtection.cookieNotice',
					'Für Authentifizierung und Navigation verwendet diese Webseite Cookies.'
				)}
			</Typography>
		</>
	);
};
