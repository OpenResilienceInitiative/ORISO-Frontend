import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sessionStyles = () =>
	fs.readFileSync(
		path.join(process.cwd(), 'src/components/session/session.styles.scss'),
		'utf8'
	);

describe('session header and timeline layout', () => {
	it('keeps the timeline in flow when an optional toolbar precedes it', () => {
		const scss = sessionStyles();

		expect(scss).not.toContain('& > div:nth-child(2)');
		expect(scss).toMatch(
			/& > \.session__content\s*\{[\s\S]*?flex:\s*1;[\s\S]*?min-height:\s*0;[\s\S]*?position:\s*relative;/
		);
	});

	it('activates the chat container border on session focus outside the composer', () => {
		const scss = sessionStyles();

		expect(scss).toMatch(
			/&:focus-within:not\(:has\(\.textarea__wrapper-send-message--selected\)\)\s*\{[\s\S]*?border:\s*2px solid var\(--m3-primary-container/
		);
	});
});
