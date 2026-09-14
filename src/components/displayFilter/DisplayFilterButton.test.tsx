// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DisplayFilterButton } from './DisplayFilterButton';

vi.mock('@mui/icons-material/Tune', () => ({
	default: () => <svg data-testid="tune-icon" />
}));

describe('DisplayFilterButton (#1377)', () => {
	afterEach(cleanup);

	it('is a dialog trigger with the customised dot only when customised', () => {
		const onClick = vi.fn();
		const { rerender } = render(
			<DisplayFilterButton
				label="Anzeige-Filter"
				customised={false}
				open={false}
				onClick={onClick}
				controlsId="dlg"
			/>
		);
		const button = screen.getByRole('button', { name: 'Anzeige-Filter' });
		expect(button.getAttribute('aria-haspopup')).toBe('dialog');
		expect(button.getAttribute('aria-expanded')).toBe('false');
		expect(button.getAttribute('aria-controls')).toBe('dlg');
		expect(button.querySelector('.displayFilterButton__dot')).toBeNull();

		fireEvent.click(button);
		expect(onClick).toHaveBeenCalledTimes(1);

		rerender(
			<DisplayFilterButton
				label="Anzeige-Filter"
				customised
				open
				onClick={onClick}
			/>
		);
		expect(button.getAttribute('aria-expanded')).toBe('true');
		expect(
			button.querySelector('.displayFilterButton__dot')
		).not.toBeNull();
	});
});
