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

	it('skips a blur that no longer fits an edited message', () => {
		const out = applyPassageBlursToHtml(
			'<p>kurz</p>',
			[{ id: 'b1', start: 10, length: 40 }],
			{ label: LABEL }
		);
		expect(out).toBe('<p>kurz</p>');
	});
});
