import * as React from 'react';
import { FC, useContext, useMemo } from 'react';
import { renderToString } from 'react-dom/server';
import { Link, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import LegalLinks from '../../legalLinks/LegalLinks';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { ConsentTextData } from '../../../api/apiGetConsentText';
import { sanitizeLegalHtml } from '../../legalContent/legalHtmlSanitizer';
import htmlParser from '../../../resources/scripts/util/htmlParser';
import {
	normalizeLegalLang,
	resolveLegalContent
} from '../../../utils/legalContent';
import { substituteLegalLinks } from '../../../utils/consentText';

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
	const { t, i18n } = useTranslation();
	const legalLinks = useContext(LegalLinksContext);

	/* The links rendered once as markup, so they can be spliced into a string
	   the backend authored. Same technique as the anonymous variant in
	   `SessionItemComponent`. `filter` keeps the registration-relevant subset
	   and `params` carries the `aid` placeholder the fallback passes too, so
	   both shapes link to exactly the same documents. */
	const legalLinksHtml = useMemo(
		() =>
			renderToString(
				<LegalLinks
					legalLinks={legalLinks}
					delimiter={', '}
					lastDelimiter={t('registration.dataProtection.label.and')}
					filter={(legalLink) => legalLink.registration}
					params={{ aid: null }}
				/>
			),
		[legalLinks, t]
	);

	const traegerSentenceHtml = useMemo(() => {
		if (!consentText) {
			return null;
		}
		// The sentence may arrive as the same language->HTML map the other
		// legal texts use, or as plain HTML. `resolveLegalContent` handles both.
		const resolved = resolveLegalContent(
			consentText.sentence,
			normalizeLegalLang(i18n?.language)
		);
		if (!resolved) {
			return null;
		}
		/* Substitute first, sanitize second. The other order would let a token
		   smuggled into an attribute (`href="{{legal_links}}"`) inject markup
		   past the sanitizer; this way every byte that reaches the DOM has been
		   through the allowlist, our own anchors included. */
		return sanitizeLegalHtml(
			substituteLegalLinks(resolved.html, legalLinksHtml)
		);
	}, [consentText, i18n?.language, legalLinksHtml]);

	if (!traegerSentenceHtml) {
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
				sx={{ display: 'block' }}
				data-cy="consent-sentence-traeger"
			>
				{htmlParser(traegerSentenceHtml)}
			</Typography>
			<Typography
				component="span"
				variant="body2"
				sx={{ display: 'block', mt: '4px', color: 'text.secondary' }}
				data-cy="consent-cookie-notice"
			>
				{t(
					'registration.dataProtection.cookieNotice',
					'Für Authentifizierung und Navigation verwendet diese Webseite Cookies.'
				)}
			</Typography>
		</>
	);
};
