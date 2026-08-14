import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const conversationCreateStyles = () =>
	fs.readFileSync(
		path.join(
			process.cwd(),
			'src/components/conversationCreate/conversationCreate.styles.scss'
		),
		'utf8'
	);

const chipGridBlock = () => {
	const scss = conversationCreateStyles();
	const start = scss.indexOf('.personChipGrid {');
	expect(start).toBeGreaterThan(-1);
	return scss.slice(start, scss.indexOf('&__chip', start));
};

/**
 * #1010. jsdom does not lay out, so the regression cannot be caught by
 * rendering — but its cause is a single declaration, and that can be pinned.
 *
 * `align-content: flex-end` on a wrapping flex container pushes overflow out of
 * the *start* edge, where it does not count towards `scrollHeight`. The browser
 * then reports nothing to scroll, renders no scrollbar, and every chip past the
 * last visible row sits above the container with its remove button unreachable.
 */
describe('person chip grid overflow', () => {
	it('scrolls instead of pushing chips out of the top', () => {
		const block = chipGridBlock();

		expect(block).toMatch(/align-content:\s*flex-start;/);
		expect(block).not.toMatch(/align-content:\s*flex-end;/);
		expect(block).toMatch(/overflow-y:\s*auto;/);
		expect(block).toMatch(/max-height:\s*100%;/);
	});

	it('still lets the media overlay hold the chips at the bottom', () => {
		const scss = conversationCreateStyles();
		const overlay = scss.slice(
			scss.indexOf('&__mediaOverlay'),
			scss.indexOf('&__content')
		);

		expect(overlay).toMatch(/flex-direction:\s*column;/);
		expect(overlay).toMatch(/justify-content:\s*flex-end;/);
	});
});
