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
	it('D11: the app shell declares the same list-to-card gap as the stage (24 px from the list cards, 12 px inner gutter)', () => {
		const css = compileStyles(
			'src/components/app/authenticatedApp.styles.scss'
		);
		// T13/T34/D11: `--pane-gap` = the card margin token, and the list
		// cards end 12 px before the column edge (`sessionsList__scrollContainer`
		// desktop margin) — both declared where the list column lives, so the
		// handle centres in the VISIBLE 24 px gap in the app as on the stage.
		expect(css).toMatch(
			/@media \(min-width: 900px\)\s*\{\s*\.app__wrapper \.contentWrapper__list\s*\{[^}]*--pane-gap:\s*var\(--session-card-margin, 24px\);[^}]*--pane-inner-gutter:\s*12px;/s
		);
	});

	it('keeps every populated session card independently rounded', () => {
		const css = compileStyles(
			'src/components/sessionsListItem/sessionsListItem.styles.scss'
		);

		expect(css).toMatch(
			/\.sessionsListItem__content\s*\{[^}]*min-height:\s*160px;[^}]*border-radius:\s*24px;/s
		);
		// T5 (Frank's BSP): 24 px between cards.
		expect(css).toMatch(/\.sessionsListItem\s*\{[^}]*margin:\s*0 0 24px;/s);
	});

	it('reserves side hairlines for the empty state and exposes the dragbar', () => {
		const css = compileStyles(
			'src/components/sessionsList/sessionsList.styles.scss'
		);

		expect(css).toMatch(
			/\.sessionsList__emptyState[^{}]*\{[^}]*border-right:\s*1px solid #fff;/s
		);
		expect(css).toMatch(
			/\.sessionsList__resizeHandle[^{}]*\{[^}]*width:\s*24px;/s
		);
		// T5: press-and-hold / drag need the browser's touch scrolling off
		// on the hit zone and the resize cursor.
		expect(css).toMatch(
			/\.sessionsList__resizeHandle[^{}]*\{[^}]*cursor:\s*col-resize;[^}]*touch-action:\s*none;/s
		);
		expect(css).toMatch(
			// T13: half the handle plus half the host's pane gap — centred in
			// the gap between list and chat card. T34: the host may declare
			// how far its list cards end before the column edge
			// (`--pane-inner-gutter`); the gap is measured from the cards.
			/\.sessionsList__resizeHandle--end[^{}]*\{[^}]*right:\s*calc\(-12px - var\(--pane-gap, 0px\) \/ 2 \+ var\(--pane-inner-gutter, 0px\)\);/s
		);
		expect(css).toMatch(
			/\.sessionsList__resizeHandle--start[^{}]*\{[^}]*left:\s*-12px;/s
		);
		// T5: the pill is centred on the handle's full height and never
		// follows the list's scroll thumb; the chevron toggle is gone.
		expect(css).toMatch(
			/\.sessionsList__resizeHandlePill[^{}]*\{[^}]*top:\s*50%;[^}]*width:\s*8px;[^}]*height:\s*48px;[^}]*background:\s*var\(--m3-primary-fixed-dim, #ffb4aa\);/s
		);
		expect(css).not.toContain('[data-scrollable=true]');
		expect(css).not.toContain('--sessions-list-thumb-top');
		expect(css).not.toContain('.sessionsList__resizeToggle');
	});
});
