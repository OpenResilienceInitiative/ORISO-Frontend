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
const LOCALE_SWITCH_STYLES = read('localeSwitch.styles.scss');
const LANGUAGE_DROPDOWN = read('..', 'select', 'LanguageSelectDropdown.tsx');

const ICON_SLOT = 'navigation__icon-slot';
const LANGUAGE_SLOT = 'navigation__icon-slot--language';

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

				// A rule aimed at a different modifier — `--tile`, `--live`,
				// `--logout` — cannot reach the language slot, whether or not
				// it carries a negation.
				const canReachLanguageSlot = tokens.some(
					(token) => token === ICON_SLOT || token === LANGUAGE_SLOT
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
			.filter((token) => token === ICON_SLOT);

		expect(policed.length).toBeGreaterThan(0);
	});

	it('lifts the portalled menu from the styles object, not from a stylesheet', () => {
		// react-select's own hook: immune both to a wrong classNamePrefix and
		// to a rule nested under a parent the portalled node never sits in.
		// The z-index is pinned, because react-select's default of 1 would
		// satisfy a looser check while leaving the menu behind the rail.
		expect(LANGUAGE_DROPDOWN).toMatch(
			/menuPortal:\s*\([^)]*\)\s*=>\s*\(\{[\s\S]*?zIndex:\s*1000\b/
		);
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
