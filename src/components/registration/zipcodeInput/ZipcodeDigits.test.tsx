// @vitest-environment jsdom

import * as React from 'react';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

	it('steps back and clears on backspace in an empty slot', () => {
		render(<Harness initial="12" />);

		fireEvent.keyDown(slot(3), { key: 'Backspace' });

		expect(emitted()).toBe('1');
		expect(document.activeElement).toBe(slot(2));
	});
});
