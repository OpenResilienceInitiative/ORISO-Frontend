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
	allowProtocolRelative: false,
	transformTags: {
		/**
		 * Every authored legal link is forced to `rel="noopener noreferrer"`,
		 * whatever the Träger wrote. Forced rather than merely allowed: with
		 * `target="_blank" rel="opener"` an author opts back out of the
		 * browser's default protection and hands the opened page a live
		 * `window.opener` handle on the registration tab, which is enough to
		 * replace it with a phishing copy while the help-seeker is reading the
		 * policy they were sent to.
		 *
		 * Same rule and same reasoning as rendered message links
		 * (`richtextHelpers.ts`, ORISO-Frontend#1080); this path had simply
		 * never been brought in line (ORISO-Frontend#1110).
		 */
		a: (tagName, attribs) => ({
			tagName,
			attribs: { ...attribs, rel: 'noopener noreferrer' }
		})
	}
};

const { '*': _anyTagAttributes, ...LEGAL_TAG_ATTRIBUTES } =
	LEGAL_HTML_SANITIZE_OPTIONS.allowedAttributes as Record<string, string[]>;

/**
 * The allowlist for a **consent sentence**, as opposed to a whole legal
 * document: identical, minus `class` on every tag and minus `img`.
 *
 * `img` is dropped because a consent sentence renders *automatically*, during
 * registration, before the help-seeker has agreed to anything. A policy
 * document is opened deliberately; this sentence is not. An `<img src>` to any
 * origin therefore makes every registering help-seeker's browser contact a
 * third party — a tracking pixel would collect their IP address at exactly the
 * moment they have consented to nothing. No consent sentence needs an image.
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
const { img: _imgAttributes, ...CONSENT_TAG_ATTRIBUTES } = LEGAL_TAG_ATTRIBUTES;

export const CONSENT_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	...LEGAL_HTML_SANITIZE_OPTIONS,
	allowedTags: (LEGAL_HTML_SANITIZE_OPTIONS.allowedTags as string[]).filter(
		(tag) => tag !== 'img'
	),
	allowedAttributes: CONSENT_TAG_ATTRIBUTES
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
