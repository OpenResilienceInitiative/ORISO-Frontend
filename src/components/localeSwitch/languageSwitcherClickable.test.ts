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
 * 2. `localeSwitch.styles.scss` lifted the portalled menu with a class built
 *    from the wrong `classNamePrefix`, so the rule matched nothing and the menu
 *    kept react-select's default `z-index: 1`.
 *
 * Both are asserted from source rather than from a rendered snapshot: the
 * failure mode is a stylesheet that no longer says what someone meant, which a
 * component test would not notice.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const read = (...segments: string[]) =>
	readFileSync(join(__dirname, ...segments), 'utf-8');

const NAVIGATION_STYLES = read('..', 'app', 'navigation.styles.scss');
const LOCALE_SWITCH_STYLES = read('localeSwitch.styles.scss');
const LANGUAGE_DROPDOWN = read('..', 'select', 'LanguageSelectDropdown.tsx');

const LANGUAGE_SLOT = 'navigation__icon-slot--language';

/**
 * The selector block a declaration sits in — the nearest preceding line that
 * opens a brace.
 */
const enclosingSelector = (
	source: string,
	declarationIndex: number
): string => {
	const before = source.slice(0, declarationIndex);
	const lines = before.split('\n');
	for (let i = lines.length - 1; i >= 0; i--) {
		if (lines[i].trimEnd().endsWith('{')) {
			// Selectors may wrap across several lines before the brace.
			const selector: string[] = [lines[i]];
			for (let j = i - 1; j >= 0 && !/[;{}]\s*$/.test(lines[j]); j--) {
				selector.unshift(lines[j]);
			}
			return selector.join(' ');
		}
	}
	return '';
};

describe('language switcher stays clickable (#998)', () => {
	it('never disables pointer events on the language slot', () => {
		const offenders: string[] = [];

		for (const match of NAVIGATION_STYLES.matchAll(
			/pointer-events:\s*none/g
		)) {
			const selector = enclosingSelector(
				NAVIGATION_STYLES,
				match.index ?? 0
			);
			const touchesIconSlots = selector.includes('navigation__icon-slot');
			const excludesLanguage =
				selector.includes(LANGUAGE_SLOT) && selector.includes(':not(');

			if (touchesIconSlots && !excludesLanguage) {
				offenders.push(selector.trim().replace(/\s+/g, ' '));
			}
		}

		expect(offenders).toEqual([]);
	});

	it('lifts the portalled menu from the styles object, not from a stylesheet', () => {
		// react-select's own hook: immune both to a wrong classNamePrefix and
		// to a rule nested under a parent the portalled node never sits in.
		expect(LANGUAGE_DROPDOWN).toMatch(/menuPortal:\s*\(styles, state\)/);
		expect(LANGUAGE_DROPDOWN).toMatch(/menuPortal:[\s\S]{0,200}?zIndex/);
	});

	it('does not try to style the portalled menu from localeSwitch.styles.scss', () => {
		// `menuPortalTarget` mounts the menu under document.body, so every
		// selector in this stylesheet — all of it nested under `.localeSwitch`
		// — compiles to a descendant selector that can never match it.
		const declarations = LOCALE_SWITCH_STYLES.split('\n')
			.filter(
				(line) =>
					!line.trim().startsWith('/*') &&
					!line.trim().startsWith('*')
			)
			.join('\n');

		expect(declarations).not.toContain('__menu-portal');
	});
});
