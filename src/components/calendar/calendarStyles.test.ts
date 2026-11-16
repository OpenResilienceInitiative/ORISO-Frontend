// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const read = (path: string) =>
	readFileSync(resolve(process.cwd(), path), 'utf8');

const calendar = read('src/components/calendar/calendar.styles.scss');
const timeline = read(
	'src/components/sessionsList/timeline/futureZone.styles.scss'
);
const listItemSelection = read('src/resources/styles/_listItemSelection.scss');
const settings = read('src/resources/styles/settings.scss');
const pillPath = 'src/resources/styles/_listEntryPill.scss';

describe('calendar stylesheet', () => {
	it('takes its focus ring from the shared list-item styles', () => {
		expect(listItemSelection).toMatch(/@mixin control-focus-ring\(/);
		expect(calendar).not.toMatch(/@mixin [\w-]*focus/);
		expect(calendar).not.toMatch(/(^|[^-])outline:\s*\d+px solid/m);
		expect(
			(calendar.match(/@include control-focus-ring\(/g) ?? []).length
		).toBeGreaterThan(0);
	});

	it('shares the list-entry anatomy with the Activity Timeline', () => {
		expect(existsSync(resolve(process.cwd(), pillPath))).toBe(true);
		const pill = read(pillPath);
		expect(settings).toMatch(/@import '\.\/listEntryPill';/);
		expect(pill).toMatch(/@mixin list-entry-pill\(/);
		expect(pill).toMatch(/@include control-focus-ring\(1px\)/);
		expect(timeline).toMatch(/@include list-entry-pill(\(|;)/);
		expect(timeline).toMatch(/@include list-entry-pill-time;/);
		// "Als Nächstes" in the calendar is the shared pill in the
		// prototype's card tone (v17), with the shared two-line text, and no
		// copy of the old pill entry is left behind.
		expect(calendar).toMatch(
			/\.calendarSide__row \{\s*@include list-entry-pill;/
		);
		expect(calendar).toMatch(/@include list-entry-pill-text;/);
		expect(calendar).not.toMatch(/\.calendarPage__entry/);
	});

	it('centres the list grip in the gap to the stage, not on the shell gutter (Frank *2)', () => {
		expect(calendar).toMatch(
			/\.calendarSide__frame \{[^}]*--pane-gap:\s*12px;[^}]*--pane-inner-gutter:\s*0px;/s
		);
		expect(calendar).toMatch(/^\.calendarPage \{[^}]*gap: 12px;/m);
	});

	it('takes its breakpoints from the shared mixin, not raw media queries', () => {
		expect(calendar).toMatch(/@include breakpoint\(\$fromMedium\)/);
		expect(calendar).toMatch(/@include breakpoint\(\$fromLarge\)/);
		expect(calendar).not.toMatch(/@media \(width >= 600px\)/);
		expect(calendar).not.toMatch(/@media \(max-width: 899px\)/);
		expect(calendar).not.toMatch(/@media[^{]*\d+px/);
	});
});
