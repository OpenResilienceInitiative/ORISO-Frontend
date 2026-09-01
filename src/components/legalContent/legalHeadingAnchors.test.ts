// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
	slugifyAnchorId,
	stampHeadingAnchors,
	truncateAnchorChipLabel,
	ANCHOR_CHIP_LABEL_MAX
} from './legalHeadingAnchors';

const render = (html: string): HTMLElement => {
	const root = document.createElement('div');
	root.innerHTML = html;
	return root;
};

describe('slugifyAnchorId', () => {
	/** Same vocabulary as the Admin's slug, so an id means the same on both. */
	it('produces the readable slug the Admin editor produces', () => {
		expect(slugifyAnchorId('1. Geltungsbereich')).toBe('1-geltungsbereich');
		expect(slugifyAnchorId('§ 4 Maßnahmen')).toBe('4-massnahmen');
		expect(slugifyAnchorId('Über uns')).toBe('uber-uns');
	});

	it('never returns an empty id', () => {
		expect(slugifyAnchorId('———')).toBe('section');
		expect(slugifyAnchorId('')).toBe('section');
	});
});

describe('truncateAnchorChipLabel', () => {
	it('leaves a short chapter alone', () => {
		expect(truncateAnchorChipLabel('Ihre Rechte')).toBe('Ihre Rechte');
	});

	it('never exceeds the budget, ellipsis included', () => {
		const long =
			'§ 4 Technische und organisatorische Maßnahmen nach Artikel 32';
		const cut = truncateAnchorChipLabel(long);
		expect(cut.length).toBeLessThanOrEqual(ANCHOR_CHIP_LABEL_MAX);
		expect(cut.endsWith('…')).toBe(true);
	});

	it('cuts on a word boundary where there is one near the end', () => {
		expect(
			truncateAnchorChipLabel(
				'Verantwortlich fuer diese Plattform ist wer'
			)
		).toBe('Verantwortlich fuer diese…');
	});
});

describe('stampHeadingAnchors', () => {
	it('gives every heading a readable id and returns them in document order', () => {
		const root = render(
			'<h1>Datenschutz</h1><p>x</p><h2>Ihre Rechte</h2><h2>Speicherdauer</h2>'
		);

		expect(stampHeadingAnchors(root)).toEqual([
			{ id: 'datenschutz', text: 'Datenschutz', level: 1 },
			{ id: 'ihre-rechte', text: 'Ihre Rechte', level: 2 },
			{ id: 'speicherdauer', text: 'Speicherdauer', level: 2 }
		]);
	});

	/**
	 * The reason this runs on the rendered DOM rather than on the stored HTML:
	 * every text published before the chapter feature existed has no ids at all,
	 * and the sanitizer strips any that were written by hand into a generic tag.
	 */
	it('makes the headings themselves reachable by id', () => {
		const root = render('<h2>Ihre Rechte</h2>');
		stampHeadingAnchors(root);

		expect(root.querySelector('#ihre-rechte')?.tagName).toBe('H2');
	});

	it('suffixes a duplicate instead of pointing two chapters at one heading', () => {
		const root = render('<h2>Kontakt</h2><h2>Kontakt</h2>');

		expect(stampHeadingAnchors(root).map(({ id }) => id)).toEqual([
			'kontakt',
			'kontakt-2'
		]);
	});

	/**
	 * A stored text can carry an id on an ordinary element that an in-text
	 * `#cross-reference` points at. Slugging a later heading onto that same id
	 * would silently send the chip to the paragraph.
	 */
	it('does not steal an id that another element already uses', () => {
		const root = render('<p id="kontakt">…</p><h2>Kontakt</h2>');

		expect(stampHeadingAnchors(root).map(({ id }) => id)).toEqual([
			'kontakt-2'
		]);
	});

	it('keeps an id that survived sanitising, so cross references still resolve', () => {
		const root = render('<h2 id="handwritten">Kontakt</h2>');

		expect(stampHeadingAnchors(root).map(({ id }) => id)).toEqual([
			'handwritten'
		]);
	});

	it('skips an empty heading — a chip to nothing is worse than no chip', () => {
		const root = render('<h2></h2><h2>Ihre Rechte</h2>');

		expect(stampHeadingAnchors(root).map(({ id }) => id)).toEqual([
			'ihre-rechte'
		]);
	});

	/** The chips move focus to the heading, and a heading is not focusable. */
	it('makes the headings programmatically focusable', () => {
		const root = render('<h2>Ihre Rechte</h2>');
		stampHeadingAnchors(root);

		expect(
			root.querySelector('#ihre-rechte')?.getAttribute('tabindex')
		).toBe('-1');
	});

	it('survives being handed nothing', () => {
		expect(stampHeadingAnchors(null)).toEqual([]);
	});
});
