// @vitest-environment jsdom

import * as React from 'react';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ZipcodeDigits } from './ZipcodeDigits';

/** Controlled the way ZipcodeInput drives it: one string, five slots. */
const Harness = ({ initial = '' }: { initial?: string }) => {
	const [value, setValue] = useState(initial);
	return (
		<>
			<ZipcodeDigits
				value={value}
				onChange={setValue}
				digitLabel={(position) => `Ziffer ${position}`}
			/>
			<output data-cy="emitted">{value}</output>
		</>
	);
};

const slot = (position: number) =>
	screen.getByLabelText(`Ziffer ${position}`) as HTMLInputElement;
const emitted = () =>
	(document.querySelector('output') as HTMLOutputElement).textContent;

afterEach(cleanup);

describe('ZipcodeDigits', () => {
	it('never lets a digit land in a slot the user has not reached yet', () => {
		render(<Harness />);

		// Clicking the third box on an empty row used to accept a digit there;
		// the joined value then placed it first, so the postcode on screen and
		// the postcode submitted disagreed.
		fireEvent.focus(slot(3));
		expect(document.activeElement).toBe(slot(1));

		fireEvent.change(slot(1), { target: { value: '7' } });
		expect(emitted()).toBe('7');
		expect(slot(1).value).toBe('7');
		expect(slot(3).value).toBe('');
	});

	it('keeps the row hole-free when a middle digit is cleared', () => {
		render(<Harness initial="12345" />);

		fireEvent.change(slot(3), { target: { value: '' } });

		// Same as deleting a character in a plain text field: the tail closes
		// up. What must not happen is a gap that makes slot and position drift.
		expect(emitted()).toBe('1245');
		expect(slot(1).value).toBe('1');
		expect(slot(2).value).toBe('2');
		expect(slot(3).value).toBe('4');
		expect(slot(4).value).toBe('5');
		expect(slot(5).value).toBe('');
	});

	it('fills the whole row from a pasted postcode', () => {
		render(<Harness />);

		fireEvent.change(slot(1), { target: { value: '50667' } });

		expect(emitted()).toBe('50667');
		expect(slot(5).value).toBe('7');
	});

	it('fills the row in order when a postcode is typed key by key', async () => {
		// The other tests drive one chosen slot at a time with `fireEvent`,
		// which writes to the element they name regardless of where the browser
		// actually put the caret. Real typing goes wherever focus is, so the
		// post-write focus move has to be exercised for real: a guard reading a
		// `value` React has not re-rendered yet bounces focus back onto the slot
		// just filled, and the next key overwrites it instead of advancing.
		const user = userEvent.setup();
		render(<Harness />);

		await user.click(slot(1));
		await user.keyboard('12345');

		expect(emitted()).toBe('12345');
		expect(slot(1).value).toBe('1');
		expect(slot(2).value).toBe('2');
		expect(slot(3).value).toBe('3');
		expect(slot(4).value).toBe('4');
		expect(slot(5).value).toBe('5');
	});

	it('types a postcode whose digits repeat', async () => {
		// A repeated digit leaves the emitted string unchanged for that slot,
		// so any fix that keys the focus move off a *changed* value would stall
		// here. Reported as `11111` landing four digits deep.
		const user = userEvent.setup();
		render(<Harness />);

		await user.click(slot(1));
		await user.keyboard('11111');

		expect(emitted()).toBe('11111');
	});

	it('steps back and clears on backspace in an empty slot', () => {
		render(<Harness initial="12" />);

		fireEvent.keyDown(slot(3), { key: 'Backspace' });

		expect(emitted()).toBe('1');
		expect(document.activeElement).toBe(slot(2));
	});
});
