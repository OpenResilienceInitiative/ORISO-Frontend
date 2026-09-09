// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import {
	readMenuEffects,
	saveMenuEffects,
	useMenuEffects
} from './useMenuEffects';

const { reducedMotion } = vi.hoisted(() => ({
	reducedMotion: { value: false }
}));
vi.mock('@mui/material', () => ({ useMediaQuery: () => reducedMotion.value }));
function Control() {
	const { enabled, motionEnabled, setEnabled } = useMenuEffects();
	return (
		<button onClick={() => setEnabled(!enabled)}>
			{String(enabled)}:{String(motionEnabled)}
		</button>
	);
}
beforeEach(() => {
	localStorage.clear();
	reducedMotion.value = false;
});
afterEach(cleanup);
describe('menu display preference', () => {
	it('defaults on and persists separately for each account', () => {
		expect(readMenuEffects('anna')).toBe(true);
		saveMenuEffects(false, 'anna');
		expect(readMenuEffects('anna')).toBe(false);
		expect(readMenuEffects('samira')).toBe(true);
		saveMenuEffects(true, 'anna');
		expect(readMenuEffects('anna')).toBe(true);
	});
	it('keeps the setting usable when writing browser storage fails', () => {
		const write = vi
			.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(() => {
				throw new Error('quota');
			});
		try {
			saveMenuEffects(false, 'storage-unavailable');
			expect(readMenuEffects('storage-unavailable')).toBe(false);
		} finally {
			write.mockRestore();
			saveMenuEffects(true, 'storage-unavailable');
		}
	});
	it('updates every mounted consumer immediately', () => {
		render(
			<>
				<Control />
				<Control />
			</>
		);
		fireEvent.click(screen.getAllByRole('button')[0]);
		expect(screen.getAllByText('false:false')).toHaveLength(2);
	});
	it('honours reduced motion without disabling the backdrop', () => {
		reducedMotion.value = true;
		render(<Control />);
		expect(screen.getByText('true:false')).toBeTruthy();
	});
	it('switches preference when the signed-in account changes', () => {
		saveMenuEffects(false, 'anna');
		const provider = (userId: string) => (
			<UserDataContext.Provider
				value={
					{ userData: { userId } } as React.ContextType<
						typeof UserDataContext
					>
				}
			>
				<Control />
			</UserDataContext.Provider>
		);
		const view = render(provider('anna'));
		expect(screen.getByText('false:false')).toBeTruthy();
		view.rerender(provider('samira'));
		expect(screen.getByText('true:true')).toBeTruthy();
	});
});
