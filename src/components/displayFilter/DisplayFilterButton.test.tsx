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
				customisedLabel="Filter angepasst"
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

		expect(button.getAttribute('aria-describedby')).toBeNull();

		rerender(
			<DisplayFilterButton
				label="Anzeige-Filter"
				customised
				customisedLabel="Filter angepasst"
				open
				onClick={onClick}
			/>
		);
		expect(button.getAttribute('aria-expanded')).toBe('true');
		expect(
			button.querySelector('.displayFilterButton__dot')
		).not.toBeNull();
		// The dot is decorative; the state reaches screen readers as description.
		const describedBy = button.getAttribute('aria-describedby');
		expect(describedBy).not.toBeNull();
		expect(
			document.getElementById(describedBy as string)?.textContent
		).toBe('Filter angepasst');
		expect(button.getAttribute('aria-label')).toBe('Anzeige-Filter');
	});

	it('renders as a bare glyph in the compact form', () => {
		render(
			<DisplayFilterButton
				label="Anzeige-Filter"
				customised
				customisedLabel="Filter angepasst"
				open={false}
				onClick={() => undefined}
				compact
			/>
		);
		expect(
			screen.getByRole('button', { name: 'Anzeige-Filter' }).className
		).toContain('displayFilterButton--compact');
	});
});
