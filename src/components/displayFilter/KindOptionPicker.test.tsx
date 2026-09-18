// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KindOptionPicker } from './KindOptionPicker';

const OPTIONS = [
	{ id: 'default', label: 'Standard' },
	{ id: 'ton-3', label: 'Ton 3' },
	{ id: 'none', label: 'Kein Ton' }
];

describe('KindOptionPicker (#1377 small split button with menu)', () => {
	afterEach(cleanup);

	it('shows the selected option, opens the menu on the arrow and reports the pick', () => {
		const onSelect = vi.fn();
		const onMain = vi.fn();
		render(
			<KindOptionPicker
				options={OPTIONS}
				selected="ton-3"
				onSelect={onSelect}
				onMain={onMain}
				mainLabel="Ton anhören: Mail"
				menuLabel="Ton wählen: Mail"
			/>
		);
		const main = screen.getByRole('button', { name: 'Ton anhören: Mail' });
		expect(main.textContent).toContain('Ton 3');
		fireEvent.click(main);
		expect(onMain).toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Ton wählen: Mail' }));
		fireEvent.click(screen.getByRole('menuitem', { name: 'Kein Ton' }));
		expect(onSelect).toHaveBeenCalledWith('none');
	});
});
