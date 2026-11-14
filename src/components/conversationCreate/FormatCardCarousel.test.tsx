// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { FormatCardCarousel } from './FormatCardCarousel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

/** Card width plus the 32px gap, as in the stylesheet. */
const CARD_STEP = 392;

/**
 * jsdom does no layout: scroll geometry is given to the row by hand, each
 * card reports where it sits for the current `scrollLeft`, and the browser's
 * own `scrollTo` is replaced by one that moves `scrollLeft`.
 */
const stubGeometry = (
	scroller: HTMLElement,
	{
		scrollWidth,
		clientWidth,
		scrollLeft = 0
	}: { scrollWidth: number; clientWidth: number; scrollLeft?: number }
) => {
	Object.defineProperty(scroller, 'scrollWidth', {
		configurable: true,
		value: scrollWidth
	});
	Object.defineProperty(scroller, 'clientWidth', {
		configurable: true,
		value: clientWidth
	});
	scroller.scrollLeft = scrollLeft;
	scroller.getBoundingClientRect = () =>
		({ left: 0, right: clientWidth, width: clientWidth }) as DOMRect;
	(Array.from(scroller.children) as HTMLElement[]).forEach((card, index) => {
		Object.defineProperty(card, 'offsetWidth', {
			configurable: true,
			value: 360
		});
		card.getBoundingClientRect = () => {
			const left = index * CARD_STEP - scroller.scrollLeft;
			return { left, right: left + 360, width: 360 } as DOMRect;
		};
	});
	const scrollTo = vi.fn(({ left }: { left: number }) => {
		scroller.scrollLeft = left;
		fireEvent.scroll(scroller);
	});
	Object.defineProperty(scroller, 'scrollTo', {
		configurable: true,
		value: scrollTo
	});
	return scrollTo;
};

const renderRow = () =>
	render(
		<FormatCardCarousel>
			<section>Gesprächskreis</section>
			<section>Interna besprechen</section>
			<section>Direktlink</section>
		</FormatCardCarousel>
	);

const getScroller = (container: HTMLElement) =>
	container.querySelector<HTMLElement>('.formatCardCarousel__scroller')!;

describe('FormatCardCarousel', () => {
	it('renders every card and no arrow buttons while nothing overflows', () => {
		const { container } = renderRow();
		stubGeometry(getScroller(container), {
			scrollWidth: 600,
			clientWidth: 600
		});
		fireEvent.scroll(getScroller(container));

		expect(screen.getByText('Gesprächskreis')).toBeTruthy();
		expect(screen.getByText('Direktlink')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('shows both arrows when cards overflow, previous disabled at the start', () => {
		const { container } = renderRow();
		stubGeometry(getScroller(container), {
			scrollWidth: 1100,
			clientWidth: 400
		});
		fireEvent.scroll(getScroller(container));

		const previous = screen.getByRole('button', {
			name: 'groupChat.format.cardsPrevious'
		}) as HTMLButtonElement;
		const next = screen.getByRole('button', {
			name: 'groupChat.format.cardsNext'
		}) as HTMLButtonElement;
		expect(previous.disabled).toBe(true);
		expect(next.disabled).toBe(false);
	});

	it('moves one card per click and disables the arrow at either end', () => {
		const { container } = renderRow();
		const scroller = getScroller(container);
		const scrollTo = stubGeometry(scroller, {
			scrollWidth: 1000,
			clientWidth: 700
		});
		fireEvent.scroll(scroller);

		const previous = screen.getByRole('button', {
			name: 'groupChat.format.cardsPrevious'
		}) as HTMLButtonElement;
		const next = screen.getByRole('button', {
			name: 'groupChat.format.cardsNext'
		}) as HTMLButtonElement;

		fireEvent.click(next);
		// The next snap position (392px) lies past the 300px of travel, so
		// the row goes to its end.
		expect(scrollTo.mock.calls[0][0].left).toBe(300);
		expect(next.disabled).toBe(true);
		expect(previous.disabled).toBe(false);

		fireEvent.click(previous);
		expect(scrollTo.mock.calls[1][0].left).toBe(0);
		expect(previous.disabled).toBe(true);
		expect(next.disabled).toBe(false);
	});

	it('uses real, focusable buttons so the arrows work from the keyboard', () => {
		const { container } = renderRow();
		stubGeometry(getScroller(container), {
			scrollWidth: 1100,
			clientWidth: 400
		});
		fireEvent.scroll(getScroller(container));

		const next = screen.getByRole('button', {
			name: 'groupChat.format.cardsNext'
		});
		expect(next.tagName).toBe('BUTTON');
		expect(next.getAttribute('type')).toBe('button');
		next.focus();
		expect(document.activeElement).toBe(next);
	});
});
