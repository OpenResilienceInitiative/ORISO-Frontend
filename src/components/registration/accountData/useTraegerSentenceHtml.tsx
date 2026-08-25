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
 * The hrefs the platform's own legal links point at.
 *
 * Read off surviving, *usable* `<a href>` values — not searched for anywhere in
 * the HTML, and not counting anchors with nothing to click.
 * A Träger sentence may legitimately carry its own link, so "contains any
 * anchor" is not enough; and the policy URL may appear as visible text, so
 * "contains this string" is not enough either. What has to survive is a
 * clickable link to that target (ORISO-Frontend#1110).
 */
const anchorTargets = (html: string): string[] =>
	Array.from(html.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g))
		/* An anchor with the right href but no readable content is not a usable
		   link: nothing to click, no accessible name. Counting it would suppress
		   the fallback and leave the mandatory disclosure unreachable. */
		.filter(([, , content]) =>
			content
				.replace(/<[^>]*>/g, '')
				.replace(INVISIBLE_CHARACTERS, '')
				.trim()
		)
		.map(([, href]) => href);

/** Characters that occupy no visual space, matched as a class rather than listed. */
const INVISIBLE_CHARACTERS = /\p{Cf}/gu;

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
			/* Invisible formatting characters survive `trim()`, so
			   `\u200B{{legal_links}}` would count as authored wording while the
			   help-seeker sees nothing. Entity spellings need no special
			   handling: the sanitiser decodes them first, so `&#x200B;` is
			   already the character by the time it reaches here — measured, not
			   assumed (ORISO-Frontend#1110). */
			.replace(INVISIBLE_CHARACTERS, '')
			.trim();
		if (!traegerOwnText) {
			return null;
		}
		/* Substitute first, sanitize second. The other order would let a token
		   smuggled into an attribute (`href="{{legal_links}}"`) inject markup
		   past the sanitizer; this way every byte that reaches the DOM has been
		   through the allowlist, our own anchors included. */
		const rendered = sanitizeConsentHtml(
			substituteLegalLinks(resolved.html, legalLinksHtml)
		);
		/* The links must survive to the DOM, not merely be substituted. A token
		   sitting in an attribute the allowlist drops — `<span
		   title="{{legal_links}}">…</span>` — is substituted happily, and then
		   the sanitizer removes the attribute together with the anchors it now
		   contains. `hasLegalLinksToken` saw a token, so nothing was appended,
		   and the sentence renders with no policy links at all: the platform's
		   one mandatory disclosure, gone. Check the result rather than the
		   intent, and append if it did not survive (ORISO-Frontend#1110). */
		const survivingHrefs = anchorTargets(rendered);
		return anchorTargets(legalLinksHtml).every((href) =>
			survivingHrefs.includes(href)
		)
			? rendered
			: `${rendered} ${sanitizeConsentHtml(legalLinksHtml)}`;
	}, [consentText, i18n?.language, legalLinksHtml]);
};
