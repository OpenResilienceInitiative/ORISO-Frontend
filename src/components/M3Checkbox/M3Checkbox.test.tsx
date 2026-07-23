// @vitest-environment jsdom
/** #576 — M3 checkbox: real input semantics behind the drawn M3 box. */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	cleanup,
	configure,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { M3Checkbox } from './index';

configure({ testIdAttribute: 'data-cy' });

describe('M3Checkbox', () => {
	afterEach(cleanup);

	it('renders a real checkbox input with the label', () => {
		render(
			<M3Checkbox
				checked={false}
				onChange={() => undefined}
				label="Per E-Mail senden"
				dataCy="cb"
			/>
		);
		const input = screen.getByTestId('cb') as HTMLInputElement;
		expect(input.type).toBe('checkbox');
		expect(input.checked).toBe(false);
		expect(screen.getByText('Per E-Mail senden')).toBeTruthy();
	});

	it('reports toggles through onChange', () => {
		const onChange = vi.fn();
		render(
			<M3Checkbox
				checked={false}
				onChange={onChange}
				label="x"
				dataCy="cb"
			/>
		);
		fireEvent.click(screen.getByTestId('cb'));
		expect(onChange).toHaveBeenCalledWith(true);
	});
});
