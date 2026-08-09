import { describe, expect, it } from 'vitest';
import { compileString } from 'sass';

const tildeImporter = {
	findFileUrl(url: string) {
		if (!url.startsWith('~')) return null;

		return new URL(
			`../../../node_modules/${url.slice(1)}`,
			import.meta.url
		);
	}
};

const compileStyles = (stylesheet: string) =>
	compileString(
		[
			'@import "src/resources/styles/settings.scss";',
			`@import "${stylesheet}";`
		].join('\n'),
		{
			loadPaths: ['.', 'node_modules'],
			importers: [tildeImporter]
		}
	).css;

describe('session list visual contracts', () => {
	it('keeps every populated session card independently rounded', () => {
		const css = compileStyles(
			'src/components/sessionsListItem/sessionsListItem.styles.scss'
		);

		expect(css).toMatch(
			/\.sessionsListItem__content\s*\{[^}]*min-height:\s*160px;[^}]*border-radius:\s*24px;/s
		);
		expect(css).toMatch(/\.sessionsListItem\s*\{[^}]*margin:\s*0 0 6px;/s);
	});

	it('reserves side hairlines for the empty state and exposes the dragbar', () => {
		const css = compileStyles(
			'src/components/sessionsList/sessionsList.styles.scss'
		);

		expect(css).toMatch(
			/\.sessionsList__emptyState[^{}]*\{[^}]*border-right:\s*1px solid #fff;/s
		);
		expect(css).toMatch(
			/\.sessionsList__resizeHandle[^{}]*\{[^}]*right:\s*-12px;[^}]*width:\s*24px;/s
		);
		expect(css).toMatch(
			/\.sessionsList__resizeHandlePill[^{}]*\{[^}]*width:\s*8px;[^}]*height:\s*48px;[^}]*background:\s*var\(--m3-primary-fixed-dim, #ffb4aa\);/s
		);
		expect(css).toContain('[data-scrollable=true]');
		expect(css).toContain('top: var(--sessions-list-thumb-top);');
		expect(css).toContain('height: var(--sessions-list-thumb-height);');
	});
});
