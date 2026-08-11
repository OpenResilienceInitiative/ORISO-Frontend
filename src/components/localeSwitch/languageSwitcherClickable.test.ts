/**
 * Regression guard for #998 — "Language switcher in the navigation rail cannot
 * be opened by mouse".
 *
 * Two independent defects made the locale menu unopenable, and both are the
 * kind that survive review because nothing about them looks wrong in isolation.
 *
 * 1. `navigation.styles.scss` sets `pointer-events: none` on the icon slots so
 *    clicks fall through the swappable icon SVG to the stable link wrapper. An
 *    early rule excluded the language slot explicitly; a later, broader rule
 *    introduced during the M3 bottom-nav rebuild did not, and its higher
 *    specificity won. The language slot holds a react-select control rather
 *    than a link, and the element it would fall through to has no click
 *    handler, so the menu simply never opened.
 *
 * 2. The portalled menu was lifted from a stylesheet — first with the wrong
 *    `classNamePrefix`, then, once that was corrected, still from inside the
 *    `.localeSwitch` block, which compiles to a descendant selector while
 *    `menuPortalTarget` mounts the menu under `document.body`. Two different
 *    reasons for the same dead rule.
 *
 * Both are asserted from source rather than from a rendered snapshot: the
 * failure mode is a stylesheet that no longer says what someone meant, which a
 * component test would not notice.
 *
 * The assertions resolve the SCSS nesting properly rather than substring-
 * matching the nearest selector. An earlier version of this file did the
 * latter, which would have passed a comma-separated list that disabled
 * pointer events on the language slot directly, as long as *some* other part
 * of the list carried a `:not(...)`.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const read = (...segments: string[]) =>
	readFileSync(join(__dirname, ...segments), 'utf-8');

const NAVIGATION_STYLES = read('..', 'app', 'navigation.styles.scss');
const NAVIGATION_BAR = read('..', 'app', 'NavigationBar.tsx');
const LOCALE_SWITCH_STYLES = read('localeSwitch.styles.scss');
const LANGUAGE_DROPDOWN = read('..', 'select', 'LanguageSelectDropdown.tsx');

const ICON_SLOT = 'navigation__icon-slot';
const LANGUAGE_SLOT = 'navigation__icon-slot--language';

/**
 * Every icon-slot class the language slot actually carries, read from the
 * component rather than assumed.
 *
 * This matters: the slot is rendered with `navigation__icon-slot`,
 * `--row` *and* `--language` together, so a rule written against `--row`
 * reaches it just as surely as one written against the base class. An earlier
 * version of this file assumed modifiers were mutually exclusive and would
 * therefore have ignored exactly that rule.
 */
const languageSlotClasses = (): string[] => {
	const declaration = NAVIGATION_BAR.split('\n').find((line) =>
		line.includes(LANGUAGE_SLOT)
	);
	return Array.from(
		(declaration ?? '').matchAll(/(navigation__icon-slot(?:--[\w-]+)?)/g)
	).map((match) => match[1]);
};

const LANGUAGE_SLOT_CLASSES = languageSlotClasses();

/** The body of a `key: (…) => ({ … })` callback, matched brace by brace. */
const callbackBody = (source: string, key: string): string => {
	const start = source.indexOf(`${key}:`);
	if (start === -1) {
		return '';
	}
	const open = source.indexOf('({', start);
	if (open === -1) {
		return '';
	}
	let depth = 0;
	for (let i = open + 1; i < source.length; i++) {
		if (source[i] === '{') depth++;
		else if (source[i] === '}') {
			depth--;
			if (depth === 0) {
				return source.slice(open + 1, i + 1);
			}
		}
	}
	return '';
};

const stripComments = (source: string) =>
	source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const splitSelectorList = (selector: string): string[] =>
	selector
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);

/** SCSS `&` resolution: a nested list expanded against every parent. */
const resolveAgainstParents = (parents: string[], nested: string): string[] => {
	if (parents.length === 0) {
		return splitSelectorList(nested);
	}
	return parents.flatMap((parent) =>
		splitSelectorList(nested).map((part) =>
			part.includes('&')
				? part.replace(/&/g, parent)
				: `${parent} ${part}`
		)
	);
};

/**
 * Every fully resolved selector that carries `pointer-events: none`.
 *
 * Walks the brace structure so nesting is honoured, rather than reading the
 * nearest line that happens to open a block.
 */
const selectorsDisablingPointerEvents = (source: string): string[] => {
	const stack: string[][] = [];
	const matches: string[] = [];
	let buffer = '';

	for (const line of stripComments(source).split('\n')) {
		if (/pointer-events:\s*none/.test(line)) {
			matches.push(...(stack[stack.length - 1] ?? []));
		}
		for (const character of line) {
			if (character === '{') {
				const parents = stack[stack.length - 1] ?? [];
				const head = buffer.trim();
				// At-rules (`@include breakpoint(...)`, `@media`) wrap rules
				// without changing what they match — pass the parents through.
				stack.push(
					head.startsWith('@')
						? parents
						: resolveAgainstParents(parents, head)
				);
				buffer = '';
			} else if (character === '}' || character === ';') {
				// `}` closes a block; `;` ends a declaration. Either way the
				// buffer holds no part of the next selector.
				if (character === '}') {
					stack.pop();
				}
				buffer = '';
			} else {
				buffer += character;
			}
		}
		buffer += ' ';
	}

	return matches;
};

/**
 * Class tokens of the icon-slot family that a selector applies outside any
 * `:not(...)` — i.e. what the rule actually has to match.
 */
const iconSlotTokens = (selector: string): string[] =>
	Array.from(
		withoutNegations(selector).matchAll(
			/\.(navigation__icon-slot(?:--[\w-]+)?)/g
		)
	).map((match) => match[1]);

/** The selector with every `:not(...)` clause removed. */
const withoutNegations = (selector: string) =>
	selector.replace(/:not\([^)]*\)/g, '');

const negationClauses = (selector: string) =>
	selector.match(/:not\(([^)]*)\)/g) ?? [];

describe('language switcher stays clickable (#998)', () => {
	it('never disables pointer events on the language slot', () => {
		const offenders = selectorsDisablingPointerEvents(NAVIGATION_STYLES)
			.filter((selector) => {
				const tokens = iconSlotTokens(selector);
				if (tokens.length === 0) {
					return false;
				}

				// A rule reaches the language slot when every icon-slot class
				// it requires is one the slot actually carries. `--tile`,
				// `--live` and `--logout` are therefore out of scope, while
				// `--row` is emphatically not.
				const canReachLanguageSlot = tokens.every((token) =>
					LANGUAGE_SLOT_CLASSES.includes(token)
				);
				if (!canReachLanguageSlot) {
					return false;
				}

				return !negationClauses(selector).some((clause) =>
					clause.includes(LANGUAGE_SLOT)
				);
			})
			.map((selector) => selector.replace(/\s+/g, ' ').trim());

		expect(offenders).toEqual([]);
	});

	it('finds the rules it is meant to police', () => {
		// Guards the guard: if the parser stops recognising the declarations,
		// the assertion above would pass vacuously.
		const policed = selectorsDisablingPointerEvents(NAVIGATION_STYLES)
			.flatMap(iconSlotTokens)
			.filter((token) => LANGUAGE_SLOT_CLASSES.includes(token));

		expect(policed.length).toBeGreaterThan(0);
	});

	it('knows which classes the language slot carries', () => {
		// The reachability rule is only as good as this list. If the slot is
		// ever rendered from a variable instead of a literal, this fails loudly
		// rather than quietly excusing every rule.
		expect(LANGUAGE_SLOT_CLASSES).toContain(ICON_SLOT);
		expect(LANGUAGE_SLOT_CLASSES).toContain(LANGUAGE_SLOT);
		expect(LANGUAGE_SLOT_CLASSES).toContain(`${ICON_SLOT}--row`);
	});

	it('lifts the portalled menu from the styles object, not from a stylesheet', () => {
		// react-select's own hook: immune both to a wrong classNamePrefix and
		// to a rule nested under a parent the portalled node never sits in.
		// The body is extracted brace by brace so that a `zIndex` belonging to
		// some later style callback cannot satisfy this on menuPortal's behalf,
		// and the value is pinned — react-select's default of 1 is precisely
		// what leaves the menu behind the rail.
		const body = callbackBody(LANGUAGE_DROPDOWN, 'menuPortal');

		expect(body).not.toBe('');
		expect(body).toMatch(/zIndex:\s*1000\b/);
	});

	it('does not try to style the portalled menu from localeSwitch.styles.scss', () => {
		// `menuPortalTarget` mounts the menu under document.body, so every
		// selector in this stylesheet — all of it nested under `.localeSwitch`
		// — compiles to a descendant selector that can never match it.
		expect(stripComments(LOCALE_SWITCH_STYLES)).not.toContain(
			'__menu-portal'
		);
	});
});
