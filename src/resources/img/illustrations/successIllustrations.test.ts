import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = 'src/resources/img/illustrations';

const asset = (name: string) =>
	fs.readFileSync(path.join(process.cwd(), DIR, name), 'utf8');

/**
 * These are the reduced-motion fallbacks for the success animations, inlined by
 * SVGR so their fills resolve against the tenant scheme. They must carry no
 * hard-coded accent, and must keep a literal fallback for contexts where the M3
 * custom properties are absent.
 */
describe('success illustrations follow the tenant scheme', () => {
	it.each(['check.svg', 'envelope-check.svg'])(
		'%s paints its accent with the brand role, not a fixed colour',
		(name) => {
			const svg = asset(name);

			expect(svg).toContain('fill="var(--m3-primary, #a5000a)"');
			expect(svg).toContain(
				'fill="var(--m3-on-surface-variant, #444748)"'
			);
			// #80dd8a was the old green accent, #33cccc the source turquoise
			// the fallbacks were exported with.
			expect(svg.toLowerCase()).not.toContain('#80dd8a');
			expect(svg.toLowerCase()).not.toContain('#33cccc');
		}
	);

	it('backs the illustration disc with white and a light accent ring, not green', () => {
		const settings = fs.readFileSync(
			path.join(process.cwd(), 'src/resources/styles/settings.scss'),
			'utf8'
		);

		expect(settings).toContain(
			'$illustration-background-info: var(--m3-on-primary, #ffffff);'
		);
		expect(settings).toContain(
			'$illustration-border-accent: 1px solid var(--m3-on-primary-container, #ffe2de);'
		);
		expect(settings).not.toContain('rgba(79, 204, 92, 0.12)');
	});

	it('ships no generic cls-* stylesheet', () => {
		// Inlined SVG <style> blocks apply document-wide, so the Illustrator
		// default class names leak across every illustration on the page.
		['check.svg', 'envelope-check.svg'].forEach((name) => {
			const svg = asset(name);

			expect(svg).not.toContain('<style>');
			expect(svg).not.toContain('class="cls-');
		});
	});
});
