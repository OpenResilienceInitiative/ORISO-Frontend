import { describe, expect, it } from 'vitest';
import { compileString } from 'sass';

const tildeImporter = {
	findFileUrl(url: string) {
		if (!url.startsWith('~')) {
			return null;
		}

		return new URL(
			`../../../node_modules/${url.slice(1)}`,
			import.meta.url
		);
	}
};

const compileTagStyles = () =>
	compileString(
		[
			'@import "src/resources/styles/settings.scss";',
			'@import "src/components/tag/tag.styles.scss";'
		].join('\n'),
		{
			loadPaths: ['.', 'node_modules'],
			importers: [tildeImporter]
		}
	).css;

describe('Tag styles', () => {
	it('keeps the yellow tag readable when Material 3 on-primary is white', () => {
		const css = compileTagStyles();

		expect(css).toMatch(
			/\.tag--yellow\s*\{[^}]*background-color:\s*#ffdca3;[^}]*color:\s*var\(--m3-on-surface,\s*rgba\(0,\s*0,\s*0,\s*0\.9\)\);/s
		);
	});
});
