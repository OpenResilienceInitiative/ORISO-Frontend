// @vitest-environment jsdom
import * as React from 'react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ZipcodeDigits } from './ZipcodeDigits';

afterEach(cleanup);

const Harness = ({ initial = '' }: { initial?: string }) => {
	const [value, setValue] = useState(initial);
	return (
		<>
			<ZipcodeDigits
				value={value}
				onChange={setValue}
				digitLabel={(position) => `Ziffer ${position}`}
			/>
			<output data-testid="value">{value}</output>
		</>
	);
};

const digit = (position: number) =>
	screen.getByLabelText(`Ziffer ${position}`) as HTMLInputElement;

const row = () =>
	[1, 2, 3, 4, 5].map((position) => digit(position).value).join('|');

const currentValue = () => screen.getByTestId('value').textContent;

/** What the browser does when a character is typed into an empty field. */
const type = (position: number, text: string) =>
	fireEvent.change(digit(position), { target: { value: text } });

describe('ZipcodeDigits', () => {
	it('advances to the next field as digits are typed', () => {
		render(<Harness />);

		type(1, '1');
		type(2, '0');
		type(3, '1');
		type(4, '1');
		type(5, '7');

		expect(row()).toBe('1|0|1|1|7');
		expect(currentValue()).toBe('10117');
		expect(document.activeElement).toBe(digit(5));
	});

	it('drops non-numeric characters', () => {
		render(<Harness />);

		type(1, 'a');
		expect(currentValue()).toBe('');

		type(1, '4');
		expect(currentValue()).toBe('4');
	});

	it('steps back and clears the previous field on backspace in an empty one', () => {
		render(<Harness initial="1011" />);

		fireEvent.keyDown(digit(5), { key: 'Backspace' });

		expect(currentValue()).toBe('101');
		expect(document.activeElement).toBe(digit(4));
	});

	it('leaves a filled field to the browser on backspace', () => {
		render(<Harness initial="10117" />);

		// The handler must not intercept here: the browser deletes the
		// character itself and the resulting change event clears the field.
		fireEvent.keyDown(digit(5), { key: 'Backspace' });
		expect(document.activeElement).not.toBe(digit(4));

		type(5, '');
		expect(currentValue()).toBe('1011');
	});

	it('does not step back past the first field', () => {
		render(<Harness />);

		fireEvent.keyDown(digit(1), { key: 'Backspace' });

		expect(currentValue()).toBe('');
	});

	it('spreads a pasted postcode across the row', () => {
		render(<Harness />);

		type(1, '10117');

		expect(row()).toBe('1|0|1|1|7');
		expect(document.activeElement).toBe(digit(5));
	});

	it('spreads a paste from the middle without overflowing', () => {
		render(<Harness initial="12" />);

		type(3, '999999');

		expect(currentValue()).toBe('12999');
	});

	it('moves the caret with the arrow keys', () => {
		render(<Harness initial="10117" />);

		fireEvent.keyDown(digit(3), { key: 'ArrowLeft' });
		expect(document.activeElement).toBe(digit(2));

		fireEvent.keyDown(digit(2), { key: 'ArrowRight' });
		expect(document.activeElement).toBe(digit(3));
	});

	it('does not run past the ends with the arrow keys', () => {
		render(<Harness initial="10117" />);

		digit(1).focus();
		fireEvent.keyDown(digit(1), { key: 'ArrowLeft' });
		expect(document.activeElement).toBe(digit(1));

		digit(5).focus();
		fireEvent.keyDown(digit(5), { key: 'ArrowRight' });
		expect(document.activeElement).toBe(digit(5));
	});
});
