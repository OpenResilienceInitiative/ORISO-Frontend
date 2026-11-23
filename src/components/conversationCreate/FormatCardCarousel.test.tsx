// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { FormatCardCarousel } from './FormatCardCarousel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { position?: number }) =>
			options?.position ? `${key} ${options.position}` : key
	})
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

const arrow = (name: string) =>
	screen.queryByRole('button', { name, hidden: true });

describe('FormatCardCarousel', () => {
	it('renders every card and no arrows or dots while nothing overflows', () => {
		const { container } = renderRow();
		stubGeometry(getScroller(container), {
			scrollWidth: 600,
			clientWidth: 600
		});
		fireEvent.scroll(getScroller(container));

		expect(screen.getByText('Gesprächskreis')).toBeTruthy();
		expect(screen.getByText('Direktlink')).toBeTruthy();
		expect(screen.queryAllByRole('button', { hidden: true })).toHaveLength(
			0
		);
	});

	it('uses the edge arrows: only "next" at the start, plus one dot per card', () => {
		const { container } = renderRow();
		stubGeometry(getScroller(container), {
			scrollWidth: 1100,
			clientWidth: 400
		});
		fireEvent.scroll(getScroller(container));

		expect(arrow('groupChat.format.cardsPrevious')).toBeNull();
		expect(arrow('groupChat.format.cardsNext')).toBeTruthy();
		// The edge control (overlay), not the big pills under the row.
		expect(
			container.querySelector(
				'[data-cy="format-card-carousel-arrows-controls"]'
			)
		).toBeNull();
		expect(
			screen.getAllByRole('button', { name: /groupChat.format.goToCard/ })
		).toHaveLength(3);
	});

	it('moves one card per click; at the end only "previous" is left', () => {
		const { container } = renderRow();
		const scroller = getScroller(container);
		const scrollTo = stubGeometry(scroller, {
			scrollWidth: 1000,
			clientWidth: 700
		});
		fireEvent.scroll(scroller);

		fireEvent.click(arrow('groupChat.format.cardsNext')!);
		// The next snap position (392px) lies past the 300px of travel, so
		// the row goes to its end.
		expect(scrollTo.mock.calls[0][0].left).toBe(300);
		expect(arrow('groupChat.format.cardsNext')).toBeNull();
		expect(arrow('groupChat.format.cardsPrevious')).toBeTruthy();

		fireEvent.click(arrow('groupChat.format.cardsPrevious')!);
		expect(scrollTo.mock.calls[1][0].left).toBe(0);
		expect(arrow('groupChat.format.cardsPrevious')).toBeNull();
	});

	it('jumps to a card from its page dot (touch and keyboard)', () => {
		const { container } = renderRow();
		const scroller = getScroller(container);
		const scrollTo = stubGeometry(scroller, {
			scrollWidth: 1200,
			clientWidth: 400
		});
		fireEvent.scroll(scroller);

		fireEvent.click(
			screen.getByRole('button', { name: 'groupChat.format.goToCard 2' })
		);
		expect(scrollTo.mock.calls[0][0].left).toBe(CARD_STEP);
		const dots = screen.getAllByRole('button', {
			name: /groupChat.format.goToCard/
		});
		expect(dots[1].getAttribute('aria-current')).toBe('true');
	});

	it('shows the arrows when cards are added after the first layout', async () => {
		// The Direktlink card can arrive later (availability loads): the row
		// starts to overflow without the row or a card changing size.
		const { container, rerender } = render(
			<FormatCardCarousel>
				<section>Gesprächskreis</section>
			</FormatCardCarousel>
		);
		const scroller = getScroller(container);
		stubGeometry(scroller, { scrollWidth: 700, clientWidth: 700 });
		fireEvent.scroll(scroller);
		expect(arrow('groupChat.format.cardsNext')).toBeNull();

		rerender(
			<FormatCardCarousel>
				<section>Gesprächskreis</section>
				<section>Interna besprechen</section>
				<section>Direktlink</section>
			</FormatCardCarousel>
		);
		stubGeometry(scroller, { scrollWidth: 1152, clientWidth: 700 });

		await waitFor(() =>
			expect(arrow('groupChat.format.cardsNext')).toBeTruthy()
		);
	});
});
