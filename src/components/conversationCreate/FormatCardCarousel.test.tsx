// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { FormatCardCarousel } from './FormatCardCarousel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

/**
 * jsdom does no layout: scroll geometry is given to the row by hand, and the
 * browser's own `scrollBy` is replaced by one that moves `scrollLeft`.
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
	const scrollBy = vi.fn(({ left }: { left: number }) => {
		scroller.scrollLeft += left;
		fireEvent.scroll(scroller);
	});
	Object.defineProperty(scroller, 'scrollBy', {
		configurable: true,
		value: scrollBy
	});
	return scrollBy;
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
		// Cards are 360px wide with a 32px gap in the stylesheet; jsdom has no
		// layout, so the first card reports its own width.
		Object.defineProperty(scroller.firstElementChild!, 'offsetWidth', {
			configurable: true,
			value: 360
		});
		const scrollBy = stubGeometry(scroller, {
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
		expect(scrollBy).toHaveBeenCalledWith(
			expect.objectContaining({ left: expect.any(Number) })
		);
		expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);
		// One 360px step exceeds the 300px of travel: the row is at its end.
		expect(next.disabled).toBe(true);
		expect(previous.disabled).toBe(false);

		fireEvent.click(previous);
		expect(scrollBy.mock.calls[1][0].left).toBeLessThan(0);
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
