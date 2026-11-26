import { describe, expect, it } from 'vite-plus/test';
import { compileString } from 'sass';

/*
 * Dark hover ink contracts (PR #2544 review). CSS `:hover` cannot be held in
 * a Storybook play function (user-event dispatches events, not the pointer
 * state), so these pin the compiled rules instead.
 */
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

const DARK = String.raw`html\[data-oriso-personal-scheme=['"]?dark['"]?\]`;

describe('dark hover ink', () => {
	it('thread kind chip: dark hover uses the brand text tone, not the on-fixed ink', () => {
		const css = compileStyles(
			'src/components/chatStage/sidePanel.styles.scss'
		);

		expect(css).toMatch(
			new RegExp(
				`${DARK} \\.panelHeader--thread \\.panelHeader__kindButton:not\\(:disabled\\):hover[^{]*\\{[^}]*color:\\s*var\\(--oriso-primary-text,`,
				's'
			)
		);
	});

	it('transparent small icon: dark hover glyph is on-primary on the primary hover fill', () => {
		const css = compileStyles('src/components/button/button.styles.scss');

		expect(css).toMatch(
			new RegExp(
				`${DARK} \\.button__smallIcon--transparent:hover svg\\s*\\{[^}]*fill:\\s*var\\(--m3-on-primary,`,
				's'
			)
		);
	});
});
