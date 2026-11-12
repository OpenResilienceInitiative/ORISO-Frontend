// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const { HandoverCarousel } = await import('./HandoverCarousel');

const CARD = 372;
const GAP = 20;
const TRACK = 784; // roughly two cards: the case where the ends clamp

/** jsdom has no PointerEvent: a plain event carrying the mouse fields. */
const mousePointer = (type: string, clientX = 400) => {
	const event = new MouseEvent(type, {
		bubbles: true,
		button: 0,
		clientX
	});
	Object.defineProperty(event, 'pointerType', { value: 'mouse' });
	Object.defineProperty(event, 'pointerId', { value: 1 });
	return event;
};

/**
 * jsdom has no layout: give the track and its three cards the desktop
 * geometry (372 px cards, 20 px gaps, a 784 px track) and record where a
 * released mouse drag asks the track to snap to.
 */
const renderWithGeometry = () => {
	const { container } = render(<HandoverCarousel />);
	const track = container.querySelector<HTMLElement>(
		'[data-cy="handover-carousel"]'
	)!;
	let scrollLeft = 0;
	const max = 3 * CARD + 2 * GAP - TRACK;
	Object.defineProperty(track, 'scrollLeft', {
		configurable: true,
		get: () => scrollLeft,
		set: (value: number) => {
			scrollLeft = Math.min(max, Math.max(0, value));
		}
	});
	Object.defineProperty(track, 'clientWidth', { value: TRACK });
	Object.defineProperty(track, 'scrollWidth', {
		value: 3 * CARD + 2 * GAP
	});
	track.getBoundingClientRect = () => ({ left: 0 }) as DOMRect;
	(Array.from(track.children) as HTMLElement[]).forEach((card, index) => {
		Object.defineProperty(card, 'offsetWidth', { value: CARD });
		card.getBoundingClientRect = () =>
			({ left: index * (CARD + GAP) - scrollLeft }) as DOMRect;
	});
	const scrollTo = vi.fn();
	track.scrollTo = scrollTo as unknown as typeof track.scrollTo;
	/** Press at the start, drag the track to `at` (via a detour, so even a
	 *  drag back to 0 really moves), release; returns the snap target. */
	const release = (at: number) => {
		scrollLeft = 0;
		fireEvent(track, mousePointer('pointerdown', 400));
		fireEvent(track, mousePointer('pointermove', 400 - at - 20));
		fireEvent(track, mousePointer('pointermove', 400 - at));
		fireEvent(track, mousePointer('pointerup', 400 - at));
		return scrollTo.mock.calls.at(-1)?.[0]?.left;
	};
	/** Press and release without moving: a click on a card. */
	const click = (at: number) => {
		scrollLeft = at;
		fireEvent(track, mousePointer('pointerdown', 400));
		fireEvent(track, mousePointer('pointermove', 402));
		fireEvent(track, mousePointer('pointerup', 402));
		return { scrollTo, track, scrollLeft: () => scrollLeft };
	};
	return { release, click, max };
};

describe('HandoverCarousel mouse drag snap', () => {
	afterEach(cleanup);

	it('keeps the first card when released at the start', () => {
		const { release } = renderWithGeometry();
		expect(release(0)).toBe(0);
	});

	it('keeps the last card when released at the end', () => {
		const { release, max } = renderWithGeometry();
		expect(release(max)).toBe(max);
	});

	it('snaps to the middle card when released near it', () => {
		const { release } = renderWithGeometry();
		expect(release(190)).toBe(CARD + GAP - (TRACK - CARD) / 2);
	});

	// ORISO-Admin#1506: a click on a card while a dot's smooth scroll is
	// still under way re-picked the card from the half-way position and
	// threw the chosen step away.
	it('treats a press without movement as a click: no snap, no takeover', () => {
		const { click } = renderWithGeometry();
		const { scrollTo, track, scrollLeft } = click(40);
		expect(scrollTo).not.toHaveBeenCalled();
		expect(scrollLeft()).toBe(40);
		expect(track.dataset.dragging).toBeUndefined();
	});
});
