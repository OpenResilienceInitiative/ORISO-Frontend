/* eslint-disable no-template-curly-in-string --
 * This module's entire job is to emit `${...}` as *literal text* for Thymeleaf
 * and FreeMarker. Every occurrence flagged by this rule is intended output, not
 * a JavaScript template literal someone forgot to backtick.
 */
/**
 * Template dialects.
 *
 * The kit is TypeScript and none of the services that actually send mail can
 * import it. So the build emits the *same* markup three times, differing only in
 * how a placeholder is written:
 *
 *   plain       {{username}}            direct SMTP senders in UserService
 *   thymeleaf   [[${username}]]         MailService
 *   freemarker  ${(username!'')?html}   Keycloak theme
 *
 * Placeholder *names* never change, so `Email/Foundations → Catalogue` stays the
 * single source of truth for what a given mail needs, whichever engine renders
 * it.
 *
 * The conversion is a post-process on the rendered markup rather than a second
 * renderer. That is deliberate: one renderer means one layout, and a dialect can
 * never quietly disagree with what Storybook shows.
 */

import { emailLogoCell } from './emailAtoms';
import { emailDefaultBrand } from './emailTokens';

export const EMAIL_DIALECTS = ['plain', 'thymeleaf', 'freemarker'] as const;

export type EmailDialect = (typeof EMAIL_DIALECTS)[number];

export interface EmailDialectInfo {
	/** Who consumes this dialect. */
	consumer: string;
	/** How a placeholder is written in the body text. */
	syntax: string;
	/** File suffix for the two MIME parts. */
	extension: { html: string; text: string };
}

export const EMAIL_DIALECT_INFO: Record<EmailDialect, EmailDialectInfo> = {
	plain: {
		consumer: 'UserService direct-SMTP senders (plain string replacement)',
		syntax: '{{name}}',
		extension: { html: 'html', text: 'txt' }
	},
	thymeleaf: {
		consumer: 'MailService',
		syntax: '[[${name}]]',
		extension: { html: 'html', text: 'txt' }
	},
	freemarker: {
		consumer: 'Keycloak e-mail theme',
		syntax: "${(name!'')?html}",
		extension: { html: 'html.ftl', text: 'txt.ftl' }
	}
};

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * An opening tag with fully quoted attributes. Safe as a regex *only* because
 * this kit generates the markup itself: every attribute is double-quoted and
 * `emailEscape` has already turned any `"` in a value into `&quot;`.
 */
const OPENING_TAG = /<([a-zA-Z][\w-]*)((?:\s+[a-zA-Z:-]+="[^"]*")*)(\s*\/?)>/g;

const ATTRIBUTE = /([a-zA-Z:-]+)="([^"]*)"/g;

/**
 * Attributes we are prepared to make dynamic. Thymeleaf offers a `th:*` twin for
 * each of these; anything outside the list is a mistake we want to hear about at
 * build time rather than discover in a sent mail.
 */
const DYNAMIC_ATTRIBUTES = new Set([
	'href',
	'src',
	'style',
	'bgcolor',
	'alt',
	'title',
	'width',
	'height',
	'align',
	'valign',
	'class'
]);

const hasPlaceholder = (value: string): boolean => {
	PLACEHOLDER.lastIndex = 0;
	return PLACEHOLDER.test(value);
};

/**
 * Turns an attribute value into a Thymeleaf literal-substitution expression:
 * `background-color:{{primaryColor}};` → `|background-color:${primaryColor};|`.
 *
 * Literal substitution is the only form that survives a `style` attribute, which
 * contains commas — `th:attr="style=..."` would split the value on them.
 */
const thymeleafLiteral = (value: string, attribute: string): string => {
	if (value.includes('|')) {
		throw new Error(
			`emailDialect: cannot express ${attribute}="${value}" as a Thymeleaf ` +
				'literal substitution — the value contains a "|".'
		);
	}
	return `|${value.replace(PLACEHOLDER, (_, key: string) => `\${${key}}`)}|`;
};

/**
 * Gives an opening tag a `th:*` twin for every attribute carrying a placeholder.
 *
 * Takes the already-captured groups rather than re-running `OPENING_TAG`: the
 * caller is mid-iteration over that same global regex, and a nested `replace`
 * would reset its `lastIndex` underneath it.
 */
const toThymeleafTag = (
	whole: string,
	name: string,
	attrs: string,
	close: string
): string => {
	if (!hasPlaceholder(attrs)) {
		return whole;
	}

	const added: string[] = [];
	ATTRIBUTE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = ATTRIBUTE.exec(attrs)) !== null) {
		const [, attribute, value] = match;
		if (!hasPlaceholder(value)) {
			continue;
		}
		if (!DYNAMIC_ATTRIBUTES.has(attribute)) {
			throw new Error(
				`emailDialect: <${name}> carries a placeholder in an attribute ` +
					`we have no Thymeleaf mapping for: "${attribute}".`
			);
		}
		added.push(`th:${attribute}="${thymeleafLiteral(value, attribute)}"`);
	}

	// The original attribute stays. Thymeleaf overwrites it at render time, and
	// keeping it means the template file still reads as the mail it produces.
	return `<${name}${attrs} ${added.join(' ')}${close}>`;
};

/**
 * Delimits a parked tag during the text pass. Deliberately a control character:
 * body copy legitimately contains things like "24 Stunden", so anything
 * readable would collide with real content.
 */
const GUARD = '\u0000';

const RESTORE = new RegExp(`${GUARD}(\\d+)${GUARD}`, 'g');

/**
 * Rewrites placeholders for Thymeleaf.
 *
 * Text nodes use inline expressions (`[[${x}]]`), which Thymeleaf 3 processes in
 * HTML templates without any enclosing `th:inline`. Attributes cannot use inline
 * expressions, so they get a `th:*` twin instead — which means the text pass
 * must not be able to see inside a tag. Hence parking the tags first.
 */
const toThymeleafHtml = (html: string): string => {
	const tags: string[] = [];
	const parked = html.replace(
		OPENING_TAG,
		(whole, name: string, attrs: string, close: string) => {
			tags.push(toThymeleafTag(whole, name, attrs, close));
			return `${GUARD}${tags.length - 1}${GUARD}`;
		}
	);

	const withText = parked.replace(
		PLACEHOLDER,
		(_, key: string) => `[[\${${key}}]]`
	);

	return withText.replace(RESTORE, (_, index: string) => tags[Number(index)]);
};

/**
 * FreeMarker has one syntax for every position, so there is nothing to park.
 *
 * `!''` keeps a missing variable from aborting the whole render — a mail with a
 * blank line beats a mail that never leaves the server. `?html` is explicit
 * because Keycloak builds its FreeMarker configuration without an output format,
 * so nothing is escaped for us.
 */
const toFreemarker = (source: string, escape: boolean): string => {
	const hostile = source.match(/\$\{|<#|#\{/);
	if (hostile) {
		throw new Error(
			`emailDialect: the markup already contains "${hostile[0]}", which ` +
				'FreeMarker would try to interpret.'
		);
	}
	return source.replace(PLACEHOLDER, (_, key: string) =>
		escape ? `\${(${key}!'')?html}` : `\${${key}!''}`
	);
};

/**
 * Folds the header's logo cell into a single `{{logoCell}}` token.
 *
 * A template file cannot express "logo, but only when one is configured", and
 * plain string replacement has no conditional syntax. So the plain dialect
 * hands the whole cell to the consumer as one placeholder: UserService's
 * renderer expands `{{logoCell}}` back into exactly this markup when a logo
 * URL is set, and into nothing when it is blank — an `<img src="">` would
 * render as a broken-image icon next to the platform name.
 *
 * The replacement matches the cell as rendered for the placeholder brand, so a
 * preview built with a concrete brand keeps its real `<img>` untouched.
 */
const toPlainHtml = (html: string): string =>
	html.split(emailLogoCell(emailDefaultBrand)).join('{{logoCell}}');

/** Rewrites a rendered `text/html` part into the given dialect. */
export const toEmailDialectHtml = (
	html: string,
	dialect: EmailDialect
): string => {
	switch (dialect) {
		case 'thymeleaf':
			return toThymeleafHtml(html);
		case 'freemarker':
			return toFreemarker(html, true);
		default:
			return toPlainHtml(html);
	}
};

/** Rewrites a rendered `text/plain` part into the given dialect. */
export const toEmailDialectText = (
	text: string,
	dialect: EmailDialect
): string => {
	switch (dialect) {
		case 'thymeleaf':
			// Thymeleaf TEXT mode understands the same inline expression.
			return text.replace(
				PLACEHOLDER,
				(_, key: string) => `[[\${${key}}]]`
			);
		case 'freemarker':
			return toFreemarker(text, false);
		default:
			return text;
	}
};
