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

	it('builds its list entry from the pill it shares with the Activity Timeline', () => {
		expect(existsSync(resolve(process.cwd(), pillPath))).toBe(true);
		const pill = read(pillPath);
		expect(settings).toMatch(/@import '\.\/listEntryPill';/);
		expect(pill).toMatch(/@mixin list-entry-pill\(/);
		expect(pill).toMatch(/@include control-focus-ring\(1px\)/);
		for (const sheet of [calendar, timeline]) {
			expect(sheet).toMatch(/@include list-entry-pill(\(|;)/);
			expect(sheet).toMatch(/@include list-entry-pill-time;/);
		}
	});

	it('takes its breakpoints from the shared mixin, not raw media queries', () => {
		expect(calendar).toMatch(/@include breakpoint\(\$fromMedium\)/);
		expect(calendar).not.toMatch(/@media \(width >= 600px\)/);
	});
});
