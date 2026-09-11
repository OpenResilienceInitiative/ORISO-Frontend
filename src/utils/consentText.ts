/**
 * Client half of the split placeholder substitution (ADR-021 decision 5).
 *
 * The server substitutes what it knows — `{{Beratungsstelle}}`, `{{Thema}}`,
 * contact data — before the sentence ever reaches the browser. Exactly one
 * token is left for the client: `{{legal_links}}`, because the link targets
 * come from this frontend's deployment configuration (`LegalLinksProvider` /
 * `settings.legalLinks`) and the backend does not know them.
 *
 * Token dialect is `{{key}}`, never Freemarker `${key}` (ADR-021 decision 6):
 * `${...}` can invoke object methods in Freemarker, which would make
 * Träger-authored text a template-injection surface.
 */

/** Whitespace inside the braces is tolerated — `{{ legal_links }}` is a typo, not a defect. */
const LEGAL_LINKS_TOKEN = /\{\{\s*legal_links\s*\}\}/g;

export const hasLegalLinksToken = (sentence: string): boolean =>
	new RegExp(LEGAL_LINKS_TOKEN.source).test(sentence);

/**
 * Client-side fallback for `{{Beratungsstelle}}` and `{{Thema}}`.
 *
 * ADR-021 decision 5 assigns these to the server: AgencyService should render
 * them before the text ever reaches this browser. In practice `GET
 * /agencies/{id}/topics/{tid}/legal` returns the raw text on today's backend
 * (issue #1263) — a help-seeker then sees `{{Thema}}` next to a checkbox they
 * must tick.
 *
 * Substitute them here so the reader gets real names, and leave the token
 * dialect alone: matching only `{{key}}` (not `${key}`) so nothing that comes
 * from a Träger template is ever executed. Whitespace inside the braces is
 * tolerated — same rule as `{{legal_links}}`.
 * ponytail: client fallback for a server defect. Remove once AgencyService
 * substitutes both tokens on `/agencies/{id}/topics/{tid}/legal`.
 */
export const substituteConsentContext = (
	sentence: string,
	{ agencyName, topicName }: { agencyName?: string; topicName?: string }
): string =>
	sentence
		.replace(
			/\{\{\s*Beratungsstelle\s*\}\}/g,
			agencyName ?? '{{Beratungsstelle}}'
		)
		.replace(/\{\{\s*Thema\s*\}\}/g, topicName ?? '{{Thema}}');

/**
 * Replaces `{{legal_links}}` with the rendered links markup.
 *
 * Two details that are easy to get wrong:
 *
 * - The replacement is passed as a **function**, so `$&`, `$1` and friends
 *   inside the links markup are inserted literally instead of being read as
 *   `String.replace` substitution patterns.
 * - A sentence **without** the token gets the links appended rather than
 *   dropped. ADR-021 decision 2 makes the token mandatory at publication time,
 *   validated server-side — but a consent sentence that silently loses its
 *   link to the policy it consents to would be the single worst failure mode
 *   here, so the client does not rely on that validator having run.
 */
/**
 * Removes the mandatory `{{legal_links}}` token.
 *
 * Used when deciding whether a Träger actually authored any wording: the token
 * is the platform's requirement, not the Träger's sentence, so it must not
 * count as text (ORISO-Frontend#1110).
 */
export const stripLegalLinksToken = (sentence: string): string =>
	sentence.replace(LEGAL_LINKS_TOKEN, ' ');

export const substituteLegalLinks = (
	sentence: string,
	legalLinksHtml: string
): string => {
	if (!hasLegalLinksToken(sentence)) {
		return `${sentence} ${legalLinksHtml}`;
	}
	return sentence.replace(LEGAL_LINKS_TOKEN, () => legalLinksHtml);
};
