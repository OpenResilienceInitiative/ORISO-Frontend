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

const { '*': _anyTagAttributes, ...LEGAL_TAG_ATTRIBUTES } =
	LEGAL_HTML_SANITIZE_OPTIONS.allowedAttributes as Record<string, string[]>;

/**
 * The allowlist for a **consent sentence**, as opposed to a whole legal
 * document: identical, minus `class` on every tag.
 *
 * `class` is not merely useless in a one-sentence consent label, it is
 * dangerous there. `htmlParser` — the rendering path every authored legal
 * string goes through — implements a documented convention where a node whose
 * class is exactly `remove` is replaced by an empty fragment. That is a
 * reasonable authoring tool inside a long policy document. Inside a consent
 * sentence it means `<span class="remove">{{legal_links}}</span>` passes the
 * server's mandatory-token validation (ADR-021 decision 2) and then silently
 * deletes the links the token exists to guarantee — defeating the one
 * technical protection the platform's mandatory disclosures have.
 *
 * Dropping the whole attribute rather than blocklisting the string `remove`:
 * a blocklist would only move the problem to whatever the next parser
 * convention is, and a consent sentence has no legitimate use for a class.
 */
export const CONSENT_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	...LEGAL_HTML_SANITIZE_OPTIONS,
	allowedAttributes: LEGAL_TAG_ATTRIBUTES
};

/**
 * Sanitizes an authored **legal document** (imprint, data-protection policy)
 * before it is rendered.
 *
 * Anything that reaches a browser from a Träger-authored field must go through
 * here or through `sanitizeConsentHtml` — `sanitize-html` strips every tag and
 * attribute outside the allowlist, so `<script>` and `on*` handlers cannot
 * survive.
 */
export const sanitizeLegalHtml = (html: string | null | undefined): string =>
	typeof html === 'string' && html !== ''
		? sanitizeHtml(html, LEGAL_HTML_SANITIZE_OPTIONS)
		: '';

/**
 * Sanitizes an authored **consent sentence** — the one a help-seeker ticks at
 * registration, and the one the anonymous consent gate shows before the first
 * message. Stricter than `sanitizeLegalHtml` by exactly one attribute; see
 * `CONSENT_HTML_SANITIZE_OPTIONS`.
 */
export const sanitizeConsentHtml = (html: string | null | undefined): string =>
	typeof html === 'string' && html !== ''
		? sanitizeHtml(html, CONSENT_HTML_SANITIZE_OPTIONS)
		: '';
