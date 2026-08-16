import sanitizeHtml from 'sanitize-html';

/**
 * The single allowlist every piece of authored legal HTML passes through.
 *
 * Extracted from `LegalContentRenderer` so that the *other* place which
 * renders authored legal HTML — the anonymous consent gate — cannot drift
 * away from it. Two allowlists would mean two answers to "is a `<script>`
 * allowed here", and the answer has to be one.
 *
 * `a[href,target,rel]` is deliberately kept: the consent sentence is worthless
 * without a working link to the document it consents to (ADR-021 decision 2 —
 * a consent text cannot even be published without the `{{legal_links}}` token).
 */
export const LEGAL_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
	allowedAttributes: {
		'*': ['class'],
		'a': ['href', 'name', 'target', 'rel'],
		'img': ['src', 'alt', 'title', 'width', 'height', 'loading']
	},
	allowedSchemes: ['http', 'https', 'mailto', 'tel'],
	allowedSchemesByTag: {
		img: ['http', 'https']
	},
	allowProtocolRelative: false
};

/**
 * Sanitizes authored legal HTML (imprint, data-protection policy, consent
 * sentence) before it is rendered.
 *
 * Anything that reaches a browser from a Träger-authored field must go through
 * here — `sanitize-html` strips every tag and attribute outside the allowlist
 * above, so `<script>` and `on*` handlers cannot survive.
 */
export const sanitizeLegalHtml = (html: string | null | undefined): string =>
	typeof html === 'string' && html !== ''
		? sanitizeHtml(html, LEGAL_HTML_SANITIZE_OPTIONS)
		: '';
