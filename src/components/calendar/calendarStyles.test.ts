// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const stylesheet = readFileSync(
	resolve(process.cwd(), 'src/components/calendar/calendar.styles.scss'),
	'utf8'
);

describe('calendar stylesheet', () => {
	it('defines the focus ring once and shares it', () => {
		expect(
			stylesheet.match(/outline:\s*2px solid var\(--m3-primary/g) ?? []
		).toHaveLength(1);
		expect(
			(stylesheet.match(/@include calendar-focus-ring/g) ?? []).length
		).toBeGreaterThan(0);
	});
});
