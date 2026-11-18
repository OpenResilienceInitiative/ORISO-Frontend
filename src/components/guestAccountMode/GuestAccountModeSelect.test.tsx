// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { GuestAccountModeSelect } from './GuestAccountModeSelect';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

const trigger = () =>
	screen.getByRole('button', { name: 'guestAccountMode.option.PERMANENT' });

describe('GuestAccountModeSelect', () => {
	it('shows the chosen mode, its label and its hint', () => {
		render(<GuestAccountModeSelect value="PERMANENT" onChange={vi.fn()} />);
		expect(trigger()).toBeTruthy();
		expect(screen.getByText('guestAccountMode.label')).toBeTruthy();
		expect(
			screen.getByText('guestAccountMode.hint.PERMANENT')
		).toBeTruthy();
		expect(screen.queryByRole('listbox')).toBeNull();
	});

	it('opens the three modes as a listbox and picks one', () => {
		const onChange = vi.fn();
		render(
			<GuestAccountModeSelect value="PERMANENT" onChange={onChange} />
		);
		fireEvent.click(trigger());
		const options = screen.getAllByRole('option');
		expect(options.map((option) => option.textContent)).toEqual([
			'guestAccountMode.option.TEMPORARY',
			'guestAccountMode.option.GUEST_CHOOSES',
			'guestAccountMode.option.PERMANENT'
		]);
		fireEvent.click(options[1]);
		expect(onChange).toHaveBeenCalledWith('GUEST_CHOOSES');
		expect(screen.queryByRole('listbox')).toBeNull();
	});

	it('offers only the modes the server allows', () => {
		render(
			<GuestAccountModeSelect
				value="PERMANENT"
				allowed={['GUEST_CHOOSES', 'PERMANENT']}
				onChange={vi.fn()}
			/>
		);
		fireEvent.click(trigger());
		expect(
			screen.getAllByRole('option').map((option) => option.textContent)
		).toEqual([
			'guestAccountMode.option.GUEST_CHOOSES',
			'guestAccountMode.option.PERMANENT'
		]);
	});

	it('shows nothing when no mode is allowed at all', () => {
		const { container } = render(
			<GuestAccountModeSelect
				value="PERMANENT"
				allowed={[]}
				onChange={vi.fn()}
			/>
		);
		expect(container.textContent).toBe('');
	});

	/* The call share popover and the edit dialog are MUI modals. */
	it('opens its menu inside the surrounding modal, and Escape closes only the menu', () => {
		const onModalKey = vi.fn();
		render(
			<div className="MuiModal-root" onKeyDown={onModalKey}>
				<GuestAccountModeSelect value="PERMANENT" onChange={vi.fn()} />
			</div>
		);
		fireEvent.click(trigger());
		const listbox = screen.getByRole('listbox');
		expect(listbox.closest('.MuiModal-root')).toBeTruthy();

		fireEvent.keyDown(listbox, { key: 'Escape' });
		expect(screen.queryByRole('listbox')).toBeNull();
		expect(onModalKey).not.toHaveBeenCalled();
	});
});
