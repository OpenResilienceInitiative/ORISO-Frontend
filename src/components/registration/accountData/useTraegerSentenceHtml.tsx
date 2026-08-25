import * as React from 'react';
import { useContext, useMemo } from 'react';
import { renderToString } from 'react-dom/server';
import { useTranslation } from 'react-i18next';
import LegalLinks from '../../legalLinks/LegalLinks';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { ConsentTextData } from '../../../api/apiGetConsentText';
import { sanitizeConsentHtml } from '../../legalContent/legalHtmlSanitizer';
import {
	normalizeLegalLang,
	resolveLegalContent
} from '../../../utils/legalContent';
import {
	stripLegalLinksToken,
	substituteLegalLinks
} from '../../../utils/consentText';

/**
 * The Träger-authored sentence as it would actually reach the DOM, or `null`
 * when there is none to show.
 *
 * This lives on its own because two places need the *same* answer and used to
 * compute it separately: `ConsentSentence` decided what to render, while
 * `AccountData` decided whether the checkbox may be ticked and which version
 * an acceptance binds to. When those two disagreed — a Träger text exists, but
 * its language map resolves to nothing or sanitizes to empty — the help-seeker
 * was shown the platform wording while their acceptance was bound to the
 * Träger `versionId`. They would have consented to wording they never saw
 * (ORISO-Frontend#1110, reported by Shirloin).
 *
 * One hook, two callers, so the rendered sentence and the gate cannot diverge:
 * whatever this returns is exactly what is on screen.
 *
 * Returns `null` in two distinguishable situations, and the caller must tell
 * them apart: no Träger text is configured (`consentText === null`, the normal
 * case, platform wording applies), versus a Träger text that cannot be
 * rendered (a real fault — nothing may be accepted).
 */
/**
 * Characters that occupy no visual space: zero-width space/non-joiner/joiner,
 * word joiner, BOM, and the soft hyphen. Text made only of these is not text.
 */
const INVISIBLE_CHARACTERS = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

export const useTraegerSentenceHtml = (
	consentText: ConsentTextData | null
): string | null => {
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

	return useMemo(() => {
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
		/* Does the TRÄGER's own wording survive the allowlist? The mandatory
		   `{{legal_links}}` token is removed first: it is the platform's
		   requirement, not authored wording, so a "sentence" consisting only of
		   that token would otherwise count as text and enable acceptance while
		   the help-seeker sees nothing but policy links and the cookie notice —
		   no consent statement at all. Measured before
		   substitution and on its own, because `substituteLegalLinks` appends
		   the legal links when the `{{legal_links}}` token is absent — so an
		   empty or fully-stripped sentence would otherwise come back "non-empty"
		   carrying nothing but our anchors. The help-seeker would then see a
		   bare link with no sentence and still bind to the Träger versionId,
		   which is the reported defect wearing a different hat. */
		const traegerOwnText = stripLegalLinksToken(
			sanitizeConsentHtml(resolved.html)
		)
			.replace(/<[^>]*>/g, '')
			/* Zero-width and other invisible formatting characters survive both
			   the sanitizer and `trim()`, so `\u200B{{legal_links}}` would count
			   as authored wording while the help-seeker sees nothing. What must
			   be non-empty is what they can actually read. */
			.replace(INVISIBLE_CHARACTERS, '')
			.trim();
		if (!traegerOwnText) {
			return null;
		}
		/* Substitute first, sanitize second. The other order would let a token
		   smuggled into an attribute (`href="{{legal_links}}"`) inject markup
		   past the sanitizer; this way every byte that reaches the DOM has been
		   through the allowlist, our own anchors included. */
		return sanitizeConsentHtml(
			substituteLegalLinks(resolved.html, legalLinksHtml)
		);
	}, [consentText, i18n?.language, legalLinksHtml]);
};
