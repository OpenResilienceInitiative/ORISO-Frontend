import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { GroupChatInterval } from '../../groupChat/createChatHelpers';
import { RepeatCountField } from './RepeatCountField';
import '../conversationCreate.styles.scss';

/**
 * #1499: the repetition row of the Gesprächskreis settings. A specialised
 * `SplitButton` stepper (the base atom stays untouched): the number of dates
 * is the value ("10 Termine"), the interval its unit below ("Wöchentlich").
 *
 * - One date reads "einmalig"; "einmalig" is also the first menu entry and
 *   picking it sets the count to one.
 * - Stepping from one to two dates opens the interval menu right away,
 *   without "einmalig". Closing it without a pick keeps the last interval.
 */

type DemoProps = {
	repeatCount: number;
	interval: GroupChatInterval;
};

const Demo = ({ repeatCount, interval }: DemoProps) => {
	const [value, setValue] = useState({ repeatCount, interval });
	const [open, setOpen] = useState(false);
	return (
		<div style={{ maxWidth: 360, padding: 16 }}>
			<RepeatCountField
				repeatCount={value.repeatCount}
				interval={value.interval}
				chosen
				open={open}
				onOpenChange={setOpen}
				onChange={setValue}
			/>
		</div>
	);
};

const meta = {
	title: 'Molecules/RepeatCountField',
	component: Demo,
	tags: ['autodocs'],
	args: { repeatCount: 10, interval: 'WEEKLY' }
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);
const field = (canvasElement: HTMLElement) =>
	canvasElement.querySelector('.repeatCountField') as HTMLElement;
const lines = (canvasElement: HTMLElement) => ({
	count: field(canvasElement).querySelector('.repeatCountField__count')
		?.textContent,
	interval:
		field(canvasElement).querySelector('.repeatCountField__interval')
			?.textContent ?? null
});
const stepButton = (canvasElement: HTMLElement, direction: 'up' | 'down') =>
	field(canvasElement).querySelector(
		`.splitButton__step--${direction}`
	) as HTMLElement;
const mainButton = (canvasElement: HTMLElement) =>
	field(canvasElement).querySelector('.splitButton__main') as HTMLElement;
const optionNames = (listbox: HTMLElement) =>
	within(listbox)
		.getAllByRole('option')
		.map((node) => node.textContent);

export const OneDate: Story = {
	name: 'Count 1 · einmalig',
	args: { repeatCount: 1 },
	play: async ({ canvasElement }) => {
		await expect(lines(canvasElement)).toEqual({
			count: 'einmalig',
			interval: null
		});
	}
};

const INTERVALS: GroupChatInterval[] = [
	'DAILY',
	'WEEKLY',
	'BIWEEKLY',
	'MONTHLY',
	'QUARTERLY',
	'YEARLY'
];

/** Ten dates with every interval: the unit decides what "10" means. */
export const TenDatesEveryInterval: Story = {
	name: 'Count 10 · every interval',
	render: () => (
		<div style={{ display: 'grid', gap: 8 }}>
			{INTERVALS.map((interval) => (
				<Demo key={interval} repeatCount={10} interval={interval} />
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const intervals = Array.from(
			canvasElement.querySelectorAll('.repeatCountField__interval')
		).map((node) => node.textContent);
		await expect(intervals).toEqual([
			'Täglich',
			'Wöchentlich',
			'Alle zwei Wochen',
			'Monatlich',
			'Vierteljährlich',
			'Jährlich'
		]);
		const counts = Array.from(
			canvasElement.querySelectorAll('.repeatCountField__count')
		).map((node) => node.textContent);
		await expect(new Set(counts)).toEqual(new Set(['10 Termine']));
	}
};

export const TenDatesMonthly: Story = {
	name: 'Count 10 · Monatlich',
	args: { repeatCount: 10, interval: 'MONTHLY' }
};

/** Frank's rule: from one to two dates the interval is asked for at once. */
export const OneToTwoOpensMenu: Story = {
	name: '1 → 2 opens the interval menu',
	args: { repeatCount: 1, interval: 'WEEKLY' },
	play: async ({ canvasElement }) => {
		await userEvent.click(stepButton(canvasElement, 'up'));
		const listbox = await body(canvasElement).findByRole('listbox');
		await expect(lines(canvasElement).count).toBe('2 Termine');
		await expect(optionNames(listbox)).toEqual([
			'Täglich',
			'Wöchentlich',
			'Alle zwei Wochen',
			'Monatlich',
			'Vierteljährlich',
			'Jährlich'
		]);
		// The last interval is marked, so closing without a pick is visible.
		await expect(
			within(listbox).getByRole('option', { name: 'Wöchentlich' })
		).toHaveAttribute('aria-selected', 'true');
		await userEvent.click(
			within(listbox).getByRole('option', { name: 'Monatlich' })
		);
		await waitFor(() =>
			expect(lines(canvasElement)).toEqual({
				count: '2 Termine',
				interval: 'Monatlich'
			})
		);
	}
};

/** Screenshot state: the menu the ▲ press opened, left open. */
export const OneToTwoMenuOpen: Story = {
	name: '1 → 2 · menu open (screenshot)',
	args: { repeatCount: 1, interval: 'WEEKLY' },
	play: async ({ canvasElement }) => {
		await userEvent.click(stepButton(canvasElement, 'up'));
		await body(canvasElement).findByRole('listbox');
	}
};

export const PickOnceResets: Story = {
	name: 'Picking einmalig resets to 1',
	args: { repeatCount: 10, interval: 'MONTHLY' },
	play: async ({ canvasElement }) => {
		await userEvent.click(mainButton(canvasElement));
		const listbox = await body(canvasElement).findByRole('listbox');
		await expect(optionNames(listbox)[0]).toBe('einmalig');
		await userEvent.click(
			within(listbox).getByRole('option', { name: 'einmalig' })
		);
		await waitFor(() =>
			expect(lines(canvasElement)).toEqual({
				count: 'einmalig',
				interval: null
			})
		);
		// Back to a series: the interval chosen before comes back.
		await userEvent.click(stepButton(canvasElement, 'up'));
		const again = await body(canvasElement).findByRole('listbox');
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(again).not.toBeInTheDocument());
		await expect(lines(canvasElement)).toEqual({
			count: '2 Termine',
			interval: 'Monatlich'
		});
	}
};

/** Keyboard: focus lands in the menu, arrows move, Escape returns to the row. */
export const KeyboardFocusAndEscape: Story = {
	name: 'Keyboard · menu focus and Escape',
	args: { repeatCount: 1, interval: 'WEEKLY' },
	play: async ({ canvasElement }) => {
		stepButton(canvasElement, 'up').focus();
		await userEvent.keyboard('{Enter}');
		const listbox = await body(canvasElement).findByRole('listbox');
		await waitFor(() =>
			expect(document.activeElement).toBe(
				within(listbox).getByRole('option', { name: 'Täglich' })
			)
		);
		await userEvent.keyboard('{ArrowDown}');
		await expect(document.activeElement).toBe(
			within(listbox).getByRole('option', { name: 'Wöchentlich' })
		);
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(listbox).not.toBeInTheDocument());
		// Focus returns to the row, the fallback interval stays.
		await expect(document.activeElement).toBe(mainButton(canvasElement));
		await expect(lines(canvasElement)).toEqual({
			count: '2 Termine',
			interval: 'Wöchentlich'
		});
		// The row's accessible name carries both halves.
		await expect(mainButton(canvasElement)).toHaveAccessibleName(
			'2 Termine Wöchentlich'
		);
	}
};
