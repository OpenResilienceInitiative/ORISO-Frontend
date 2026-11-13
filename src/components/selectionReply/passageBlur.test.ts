// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vitest';

import {
	applyPassageBlursToHtml,
	passageBlurFromRange,
	scramblePassage
} from './passageBlur';
import { collectText, findPassageRange } from './passageRange';

const LABEL = 'Geschwärzte Stelle';

const render = (html: string) => {
	const root = document.createElement('div');
	root.innerHTML = html;
	return root;
};

describe('scramblePassage', () => {
	it('keeps the shape: same length, spaces where they were', () => {
		const salad = scramblePassage('Mein Konto ist gesperrt', 'seed');
		expect(salad).toHaveLength(23);
		expect(salad.split(' ').map((word) => word.length)).toEqual([
			4, 5, 3, 8
		]);
		expect(salad).not.toContain('Konto');
	});

	it('is stable for one seed and differs between seeds', () => {
		expect(scramblePassage('Amtsgericht', 'a')).toBe(
			scramblePassage('Amtsgericht', 'a')
		);
		expect(scramblePassage('Amtsgericht', 'a')).not.toBe(
			scramblePassage('Amtsgericht', 'b')
		);
	});
});

describe('passageBlurFromRange + applyPassageBlursToHtml', () => {
	const html =
		'<p>Ich heiße Anna Berger und wohne in der <strong>Lindenstraße 4</strong>.</p>';
	const passage = 'Anna Berger und wohne in der Lindenstraße 4';

	const blurOf = () => {
		const bubble = render(html);
		const range = findPassageRange(bubble, passage)!;
		return { id: 'b1', ...passageBlurFromRange(bubble, range)! };
	};

	it('stores a position, never the passage itself', () => {
		const blur = blurOf();
		expect(blur).toEqual({ id: 'b1', start: 10, length: passage.length });
		expect(JSON.stringify(blur)).not.toContain('Anna');
	});

	it('replaces the passage with salad, across inline tags', () => {
		const out = render(
			applyPassageBlursToHtml(html, [blurOf()], { label: LABEL })
		);
		expect(out.textContent).not.toContain('Anna');
		expect(out.textContent).not.toContain('Lindenstraße');
		expect(out.textContent).toContain('Ich heiße');
		expect(out.querySelectorAll('.passageBlur')).toHaveLength(2);
		expect(out.querySelector('strong .passageBlur')).not.toBeNull();
	});

	it('gives readers one label and hides the salad', () => {
		const out = render(
			applyPassageBlursToHtml(html, [blurOf()], { label: LABEL })
		);
		const labels = out.querySelectorAll('.passageBlur__srLabel');
		expect(labels).toHaveLength(1);
		expect(labels[0].textContent).toBe(LABEL);
		out.querySelectorAll('.passageBlur').forEach((span) =>
			expect(span.getAttribute('aria-hidden')).toBe('true')
		);
	});

	it('keeps offsets stable, so a second blur lands right', () => {
		const once = applyPassageBlursToHtml(html, [blurOf()], {
			label: LABEL
		});
		expect(collectText(render(once)).text.length).toBe(
			collectText(render(html)).text.length
		);
	});

	it('makes the passage a button for moderators', () => {
		const out = render(
			applyPassageBlursToHtml(html, [blurOf()], {
				label: LABEL,
				removeLabel: 'Schwärzung aufheben'
			})
		);
		const first = out.querySelector('.passageBlur')!;
		expect(first.getAttribute('role')).toBe('button');
		expect(first.getAttribute('data-passage-blur-id')).toBe('b1');
		expect(out.querySelector('.passageBlur__srLabel')).toBeNull();
	});

	it('handles overlapping blurs without throwing', () => {
		const out = render(
			applyPassageBlursToHtml(
				'<p>0123456789</p>',
				[
					{ id: 'a', start: 2, length: 5 },
					{ id: 'b', start: 4, length: 5 }
				],
				{ label: LABEL, removeLabel: 'Schwärzung aufheben' }
			)
		);
		expect(out.textContent).toHaveLength(10);
		expect(out.textContent!.startsWith('01')).toBe(true);
		expect(out.textContent!.endsWith('9')).toBe(true);
		const ids = [...out.querySelectorAll('.passageBlur')].map((span) =>
			span.getAttribute('data-passage-blur-id')
		);
		expect(ids).toEqual(['a', 'b']);
	});

	it('keeps the UTF-16 length when the passage holds an emoji', () => {
		expect(scramblePassage('ok 👍 da', 'seed')).toHaveLength(
			'ok 👍 da'.length
		);
		const html = '<p>Hallo 👍 Anna, bis bald</p>';
		const out = applyPassageBlursToHtml(
			html,
			[{ id: 'b1', start: 6, length: 7 }],
			{ label: LABEL, removeLabel: 'x' }
		);
		expect(collectText(render(out)).text).toMatch(/, bis bald$/);
		expect(collectText(render(out)).text.length).toBe(
			collectText(render(html)).text.length
		);
	});

	it('disarms a link whose text is blurred', () => {
		const out = render(
			applyPassageBlursToHtml(
				'<p>Ruf an: <a href="tel:+491701234567" target="_blank">0170 1234567</a></p>',
				[{ id: 'b1', start: 8, length: 12 }],
				{ label: LABEL }
			)
		);
		const link = out.querySelector('a')!;
		expect(link.hasAttribute('href')).toBe(false);
		expect(out.innerHTML).not.toContain('1234567');
	});

	it('finds a passage across paragraphs and line breaks', () => {
		const html = '<p>Erste Zeile</p><p>zweite Zeile<br>dritte</p>';
		const root = render(html);
		expect(collectText(root).text).toBe('Erste Zeile zweite Zeile dritte');
		const range = findPassageRange(root, 'Zeile zweite Zeile dritte')!;
		expect(range.toString()).toBe('Zeilezweite Zeiledritte');
		const blur = { id: 'b1', ...passageBlurFromRange(root, range)! };
		expect(blur).toEqual({ id: 'b1', start: 6, length: 25 });
		const out = render(
			applyPassageBlursToHtml(html, [blur], { label: LABEL })
		);
		expect(out.textContent).toContain('Erste');
		expect(out.textContent).not.toContain('zweite');
		expect(out.querySelectorAll('p')).toHaveLength(2);
		expect(out.querySelector('br')).not.toBeNull();
	});

	it('drops who a blurred @mention names', () => {
		const html =
			'<p>Frag <span class="mention" data-type="mention" data-id="u1" data-label="Anna" data-mention-username="anna_b" data-mention-matrix-id="@anna:oriso">@Anna</span> bitte</p>';
		const out = applyPassageBlursToHtml(
			html,
			[{ id: 'b1', start: 5, length: 5 }],
			{ label: LABEL }
		);
		expect(out).not.toMatch(/anna|Anna/);
		expect(out).toContain('class="mention"');
	});

	it('skips a blur that no longer fits an edited message', () => {
		const out = applyPassageBlursToHtml(
			'<p>kurz</p>',
			[{ id: 'b1', start: 10, length: 40 }],
			{ label: LABEL }
		);
		expect(out).toBe('<p>kurz</p>');
	});
});
