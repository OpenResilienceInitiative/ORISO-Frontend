// @vitest-environment node

/**
 * Guard for secondary ("muted") text contrast (Frontend#1134).
 * Measured on Dev on 27 Nov 2026 with axe: the session-list date on a read
 * card fell to 3.3:1 (faded with opacity) and the profile hint text to 4.4:1
 * (a fixed #6b7280 grey that ignores the scheme and contrast setting). WCAG AA
 * needs 4.5:1. Secondary text takes the themed on-surface-variant role, which
 * the colour engine keeps above 4.5:1 in every scheme and contrast level.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const read = (path: string) =>
	readFileSync(resolve(process.cwd(), path), 'utf8');

describe('muted text contrast', () => {
	it('does not fade the session-list date on read cards', () => {
		const list = read(
			'src/components/sessionsListItem/sessionsListItem.styles.scss'
		);
		const readBlock = list.slice(
			list.indexOf('&--read {'),
			list.indexOf('&:hover {', list.indexOf('&--read {'))
		);
		expect(readBlock).not.toMatch(/__date\s*\{[^}]*opacity/);
	});

	it.each([
		'src/components/profile/profile.styles.scss',
		'src/components/notificationsCenter/notificationsCenter.styles.scss',
		'src/components/draftsCenter/draftsCenter.styles.scss'
	])('%s draws secondary text with the themed role', (path) => {
		expect(read(path)).not.toMatch(/color:\s*#6b7280/i);
	});
});
