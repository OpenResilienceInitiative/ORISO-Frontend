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
	substituteConsentContext,
	substituteLegalLinks
} from '../../../utils/consentText';

/**
 * Does this text contain anything a person could actually see?
 *
 * Asked positively, after four attempts at answering it by listing what to
 * remove. A hand-written list missed the bidi marks; `\p{Cf}` missed the
 * variation selectors; `Default_Ignorable_Code_Point` missed the interlinear
 * annotation controls; both together missed U+0085, a `Cc` control that
 * `trim()` also leaves alone. Every one of those was an enumeration of the
 * invisible, and an enumeration of the invisible is never finished.
 *
 * The complement is finite and stable: a character that is not whitespace, not
 * a control, not a format character, not a separator and not default-ignorable
 * is a character with a glyph. Verified against U+0085, U+FFF9, U+FE0F, U+200B
 * and U+00A0 on one side and letters, umlauts, Han and emoji on the other
 * (ORISO-Frontend#1110).
 */
const VISIBLE_CHARACTER =
	/[^\s\p{Cc}\p{Cf}\p{Zs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/u;

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
			VISIBLE_CHARACTER.test(content.replace(/<[^>]*>/g, ''))
		)
		.map(([, href]) => href);

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
export interface TraegerSentence {
	html: string;
	/**
	 * The language-resolved wording as the Träger authored it, before our links
	 * are spliced in. This is what a binding is keyed on: it changes when the
	 * Träger republishes and when another language is shown, and unlike the
	 * rendered form it can be reproduced from the inputs alone.
	 */
	authored: string;
	/** True when the wording shown is a machine translation. */
	isMachineTranslated: boolean;
	/** The authored, legally binding language of the wording. */
	originalLang: string;
	/** The language actually shown. */
	lang: string;
}

export interface ConsentContext {
	/** Beratungsstelle name — substituted for `{{Beratungsstelle}}` when the server left it raw (issue #1263). */
	agencyName?: string;
	/** Thema name — substituted for `{{Thema}}` on the same defensive path. */
	topicName?: string;
}

export const useTraegerSentenceHtml = (
	consentText: ConsentTextData | null,
	context: ConsentContext = {}
): TraegerSentence | null => {
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
		const resolvedRaw = resolveLegalContent(
			consentText.sentence,
			normalizeLegalLang(i18n?.language)
		);
		if (!resolvedRaw) {
			return null;
		}
		/* Fill `{{Beratungsstelle}}` and `{{Thema}}` client-side as a defensive
		   fallback for the server: ADR-021 decision 5 assigns them to
		   AgencyService, but `GET /agencies/{id}/topics/{tid}/legal` still
		   returns them raw (issue #1263). A no-op once the server catches up. */
		const resolved = {
			...resolvedRaw,
			html: substituteConsentContext(resolvedRaw.html, context)
		};
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
		).replace(/<[^>]*>/g, '');
		if (!VISIBLE_CHARACTER.test(traegerOwnText)) {
			return null;
		}
		/* Substitute first, sanitize second. The other order would let a token
		   smuggled into an attribute (`href="{{legal_links}}"`) inject markup
		   past the sanitizer; this way every byte that reaches the DOM has been
		   through the allowlist, our own anchors included. */
		const sanitised = sanitizeConsentHtml(
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
		const survivingHrefs = anchorTargets(sanitised);
		const html = anchorTargets(legalLinksHtml).every((href) =>
			survivingHrefs.includes(href)
		)
			? sanitised
			: `${sanitised} ${sanitizeConsentHtml(legalLinksHtml)}`;
		/* The translation status travels with the wording. `LegalContentRenderer`
		   tells a reader when a legal text is machine-translated and which
		   language is binding; a consent sentence needs that more, not less —
		   ticking a box next to wording whose binding version you have not seen
		   is not informed consent (ORISO-Frontend#1110). */
		return {
			html,
			authored: resolved.html,
			isMachineTranslated: resolved.isMachineTranslated,
			originalLang: resolved.originalLang,
			lang: resolved.lang
		};
	}, [
		consentText,
		i18n?.language,
		legalLinksHtml,
		context.agencyName,
		context.topicName
	]);
};
