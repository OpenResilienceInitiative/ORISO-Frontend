// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { snapTargets } from './HoverScrollArrows';

/**
 * A track 700px wide with three 360px cards, 392px apart, starting 4px in
 * (the track's own padding). jsdom does no layout, so geometry is stubbed.
 */
const makeTrack = (trackStyle: Partial<CSSStyleDeclaration>) => {
	const track = document.createElement('div');
	Object.assign(track.style, trackStyle);
	Object.defineProperty(track, 'scrollWidth', { value: 1152 });
	Object.defineProperty(track, 'clientWidth', { value: 700 });
	track.getBoundingClientRect = () => ({ left: 0 }) as DOMRect;
	[0, 1, 2].forEach((index) => {
		const card = document.createElement('section');
		card.style.scrollSnapAlign = 'start';
		Object.defineProperty(card, 'offsetWidth', { value: 360 });
		card.getBoundingClientRect = () =>
			({ left: 4 + index * 392, width: 360 }) as DOMRect;
		track.appendChild(card);
	});
	document.body.appendChild(track);
	return track;
};

afterEach(() => {
	document.body.innerHTML = '';
});

describe('snapTargets', () => {
	it('puts each card start on the track edge without scroll-padding', () => {
		expect(snapTargets(makeTrack({}))).toEqual([4, 396, 452]);
	});

	it('keeps scroll-padding between the track edge and the snapped card', () => {
		// FE#2218: with 4px scroll-padding the first card already sits at its
		// snap position at scrollLeft 0, so "next" must target the second card.
		expect(snapTargets(makeTrack({ scrollPaddingLeft: '4px' }))).toEqual([
			0, 392, 452
		]);
	});
});
