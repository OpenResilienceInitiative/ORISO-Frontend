// @vitest-environment jsdom
import * as React from 'react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { GroupChatInterval } from '../../groupChat/createChatHelpers';
import { RepeatCountField } from './RepeatCountField';

// Identity translator that keeps the count, so assertions see key + number.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) =>
			options?.count !== undefined ? `${key}:${options.count}` : key
	})
}));

const DATES = 'groupChat.circle.rows.repeatDates';
const ONCE = 'groupChat.info.settings.repetition.single';
const option = (interval: string) =>
	`groupChat.create.interval.options.${interval}`;

const Harness = ({
	initialCount,
	initialInterval = 'WEEKLY',
	onChange
}: {
	initialCount: number;
	initialInterval?: GroupChatInterval;
	onChange?: (value: {
		repeatCount: number;
		interval: GroupChatInterval;
	}) => void;
}) => {
	const [value, setValue] = useState({
		repeatCount: initialCount,
		interval: initialInterval
	});
	const [open, setOpen] = useState(false);
	return (
		<RepeatCountField
			repeatCount={value.repeatCount}
			interval={value.interval}
			chosen
			open={open}
			onOpenChange={setOpen}
			onChange={(next) => {
				setValue(next);
				onChange?.(next);
			}}
		/>
	);
};

const field = () => document.querySelector('.repeatCountField') as HTMLElement;
const countLine = () =>
	field().querySelector('.repeatCountField__count')?.textContent;
const intervalLine = () =>
	field().querySelector('.repeatCountField__interval')?.textContent ?? null;
const stepUp = () =>
	fireEvent.click(
		field().querySelector('.splitButton__step--up') as HTMLElement
	);
const stepDown = () =>
	fireEvent.click(
		field().querySelector('.splitButton__step--down') as HTMLElement
	);
const openMenu = () =>
	fireEvent.click(field().querySelector('.splitButton__main') as HTMLElement);
const optionLabels = () =>
	within(screen.getByRole('listbox'))
		.getAllByRole('option')
		.map((node) => node.textContent);

describe('RepeatCountField (#1499)', () => {
	afterEach(cleanup);

	it('shows the number of dates large and the interval small', () => {
		render(<Harness initialCount={10} initialInterval="MONTHLY" />);
		expect(countLine()).toBe(`${DATES}:10`);
		expect(intervalLine()).toBe(option('monthly'));
	});

	it('reads a single date as "einmalig" on one line', () => {
		render(<Harness initialCount={1} />);
		expect(countLine()).toBe(ONCE);
		expect(intervalLine()).toBeNull();
	});

	it('offers "einmalig" first in the menu, and marks it at one date', () => {
		render(<Harness initialCount={1} />);
		openMenu();
		expect(optionLabels()).toEqual([
			ONCE,
			option('daily'),
			option('weekly'),
			option('biweekly'),
			option('monthly'),
			option('quarterly'),
			option('yearly')
		]);
		expect(
			screen
				.getByRole('option', { name: ONCE })
				.getAttribute('aria-selected')
		).toBe('true');
	});

	it('picking "einmalig" resets the count to one and keeps the interval', () => {
		const onChange = vi.fn();
		render(
			<Harness
				initialCount={10}
				initialInterval="MONTHLY"
				onChange={onChange}
			/>
		);
		openMenu();
		fireEvent.click(screen.getByRole('option', { name: ONCE }));
		expect(onChange).toHaveBeenLastCalledWith({
			repeatCount: 1,
			interval: 'MONTHLY'
		});
		expect(countLine()).toBe(ONCE);
		expect(screen.queryByRole('listbox')).toBeNull();
	});

	it('changing the interval keeps the count', () => {
		render(<Harness initialCount={10} />);
		openMenu();
		fireEvent.click(screen.getByRole('option', { name: option('daily') }));
		expect(countLine()).toBe(`${DATES}:10`);
		expect(intervalLine()).toBe(option('daily'));
	});

	it('picking a real interval at one date starts the smallest series', () => {
		render(<Harness initialCount={1} />);
		openMenu();
		fireEvent.click(
			screen.getByRole('option', { name: option('monthly') })
		);
		expect(countLine()).toBe(`${DATES}:2`);
		expect(intervalLine()).toBe(option('monthly'));
	});

	it('stepping down to one date reads "einmalig"', () => {
		render(<Harness initialCount={2} />);
		stepDown();
		expect(countLine()).toBe(ONCE);
	});

	it('stepping from one to two opens the interval menu without "einmalig"', () => {
		render(<Harness initialCount={1} />);
		stepUp();
		expect(countLine()).toBe(`${DATES}:2`);
		expect(optionLabels()).not.toContain(ONCE);
		expect(optionLabels()).toHaveLength(6);
		expect(document.activeElement?.getAttribute('role')).toBe('option');
	});

	it('dismissing the auto-opened menu keeps the last interval', () => {
		render(<Harness initialCount={1} initialInterval="BIWEEKLY" />);
		stepUp();
		fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
		expect(screen.queryByRole('listbox')).toBeNull();
		expect(intervalLine()).toBe(option('biweekly'));
		expect(countLine()).toBe(`${DATES}:2`);
	});

	it('stepping up inside a series does not open the menu', () => {
		render(<Harness initialCount={2} />);
		stepUp();
		expect(countLine()).toBe(`${DATES}:3`);
		expect(screen.queryByRole('listbox')).toBeNull();
	});
});
