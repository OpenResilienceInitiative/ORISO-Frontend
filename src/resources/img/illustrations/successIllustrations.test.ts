import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = 'src/resources/img/illustrations';

const asset = (name: string) =>
	fs.readFileSync(path.join(process.cwd(), DIR, name), 'utf8');

/**
 * The success illustrations are inlined by SVGR, so their fills resolve against
 * the tenant scheme at runtime. They must not carry the old hard-coded green,
 * and they must keep a literal fallback for contexts where the M3 custom
 * properties are not on the element (e-mail previews, bare Storybook frames).
 */
describe('success illustrations follow the tenant scheme', () => {
	it.each(['check.svg', 'envelope-check.svg'])(
		'%s paints its accent with the brand role, not success green',
		(name) => {
			const svg = asset(name);

			expect(svg).toContain('fill="var(--m3-primary, #a5000a)"');
			expect(svg).toContain('fill="var(--m3-on-primary, #ffffff)"');
			expect(svg.toLowerCase()).not.toContain('#80dd8a');
		}
	);

	it('check.svg no longer ships a generic cls-* stylesheet', () => {
		// Inlined SVG <style> blocks apply document-wide, so the Illustrator
		// default class names leak across every illustration on the page.
		const svg = asset('check.svg');

		expect(svg).not.toContain('<style>');
		expect(svg).not.toContain('class="cls-');
	});
});
