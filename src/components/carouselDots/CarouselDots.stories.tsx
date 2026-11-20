import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { CarouselDots } from './CarouselDots';

/** Holds the active slide like a real carousel owner does. */
const Controlled = ({
	count = 3,
	start = 0
}: {
	count?: number;
	start?: number;
}) => {
	const [active, setActive] = useState(start);
	return (
		<div style={{ padding: 32 }}>
			<p data-testid="active-slide">Folie {active + 1}</p>
			<CarouselDots
				data-cy="carousel-dots"
				count={count}
				activeIndex={active}
				onSelect={setActive}
				getLabel={(index, total) =>
					`Zu Schritt ${index + 1} von ${total}`
				}
			/>
		</div>
	);
};

const meta = {
	title: 'Atoms/CarouselDots',
	component: CarouselDots,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Page dots for any carousel. Every dot is a button with a 24 px target around its 6 px mark. Pointing at the row makes all dots grow together, so it is clear they can be clicked; the active pill slides smoothly to its new place. Stateless: the owner passes the active slide and handles `onSelect`. Used by the waiting-room carousel "So geht es weiter" (#2139).'
			}
		}
	},
	args: {
		count: 3,
		activeIndex: 0,
		onSelect: () => undefined,
		getLabel: (index: number, total: number) =>
			`Zu Schritt ${index + 1} von ${total}`
	}
} satisfies Meta<typeof CarouselDots>;

export default meta;
type Story = StoryObj<typeof meta>;

const dotsOf = (canvasElement: HTMLElement) =>
	within(canvasElement).getAllByRole('button', { name: /Zu Schritt/ });
const markWidth = (dot: HTMLElement) =>
	parseFloat(getComputedStyle(dot, '::before').width);
const markHeight = (dot: HTMLElement) =>
	parseFloat(getComputedStyle(dot, '::before').height);

/** A click on any dot makes it the active one; the target is 24 px. */
export const ClickSelects: Story = {
	render: () => <Controlled />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const dots = dotsOf(canvasElement);
		expect(dots).toHaveLength(3);
		for (const dot of dots) {
			const rect = dot.getBoundingClientRect();
			expect(rect.height).toBeGreaterThanOrEqual(24);
			expect(rect.width).toBeGreaterThanOrEqual(24);
		}

		await userEvent.click(dots[2]);
		expect(canvas.getByTestId('active-slide')).toHaveTextContent('Folie 3');
		expect(dots[2]).toHaveAttribute('aria-current', 'true');
		expect(dots[0]).toHaveAttribute('aria-current', 'false');

		await userEvent.click(dots[0]);
		expect(canvas.getByTestId('active-slide')).toHaveTextContent('Folie 1');
		// The active pill is wider than the others.
		await waitFor(() =>
			expect(markWidth(dots[0])).toBeGreaterThan(markWidth(dots[1]))
		);
	}
};

/** Pointing at the row grows every dot, the active pill too. */
export const HoverGrowsAllDots: Story = {
	render: () => <Controlled />,
	play: async ({ canvasElement }) => {
		const dots = dotsOf(canvasElement);
		const before = dots.map(markHeight);
		const activeBefore = markWidth(dots[0]);

		await userEvent.hover(dots[1]);
		await waitFor(() => {
			dots.forEach((dot, index) =>
				expect(markHeight(dot)).toBeGreaterThan(before[index])
			);
			expect(markWidth(dots[0])).toBeGreaterThan(activeBefore);
		});

		await userEvent.unhover(dots[1]);
		await waitFor(() =>
			dots.forEach((dot, index) =>
				expect(markHeight(dot)).toBe(before[index])
			)
		);
	}
};

/** Tab reaches every dot, Enter selects it. */
export const KeyboardSelects: Story = {
	render: () => <Controlled />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const dots = dotsOf(canvasElement);
		await userEvent.tab();
		expect(dots[0]).toHaveFocus();
		await userEvent.tab();
		expect(dots[1]).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		expect(canvas.getByTestId('active-slide')).toHaveTextContent('Folie 2');
	}
};

/** Five slides, the third active: the component is not tied to three. */
export const FiveSlides: Story = {
	render: () => <Controlled count={5} start={2} />,
	play: async ({ canvasElement }) => {
		const dots = dotsOf(canvasElement);
		expect(dots).toHaveLength(5);
		expect(dots[2]).toHaveAttribute('aria-current', 'true');
	}
};
