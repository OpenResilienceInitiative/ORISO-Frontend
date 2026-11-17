// @vitest-environment oriso-jsdom
import * as React from 'react';
import { createContext } from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import dayjs, { type Dayjs } from 'dayjs';
import { UserDataContext } from '../../globalState';
import { apiSetAbsence } from '../../api';
import { AbsenceFormular } from './AbsenceFormular';

vi.mock('../../globalState', () => ({
	UserDataContext: createContext(null)
}));
vi.mock('../../api', () => ({ apiSetAbsence: vi.fn() }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, string>) =>
			options ? `${key} ${Object.values(options).join(' ')}` : key,
		i18n: { language: 'de' }
	})
}));
vi.mock('../overlay/Overlay', () => ({
	Overlay: () => null,
	OVERLAY_FUNCTIONS: { CLOSE: 'CLOSE' }
}));
vi.mock('../form/OrisoDatePicker', () => ({
	OrisoDatePicker: ({
		label,
		value,
		onChange,
		disabled
	}: {
		label: string;
		value: Dayjs | null;
		onChange?: (value: Dayjs | null) => void;
		disabled?: boolean;
	}) => (
		<input
			aria-label={label}
			disabled={disabled}
			value={value ? value.format('YYYY-MM-DD') : ''}
			onChange={(e) =>
				onChange?.(e.target.value ? dayjs(e.target.value) : null)
			}
		/>
	)
}));

const reloadUserData = vi.fn(() => Promise.resolve());

const renderWith = (userData: Record<string, unknown>) =>
	render(
		<UserDataContext.Provider
			value={
				{
					userData: { absenceMessage: '', ...userData },
					reloadUserData
				} as never
			}
		>
			<AbsenceFormular />
		</UserDataContext.Provider>
	);

const switchOf = () =>
	screen.getByRole('switch', {
		name: 'absence.checkbox.label'
	}) as HTMLInputElement;

beforeEach(() => {
	vi.mocked(apiSetAbsence).mockReset();
	vi.mocked(apiSetAbsence).mockResolvedValue(undefined as never);
});
afterEach(cleanup);

describe('AbsenceFormular — planned absence dates (ORISO-Frontend#2303)', () => {
	it('switches on with the optional first and last day', async () => {
		renderWith({ absent: false });
		fireEvent.change(
			screen.getByLabelText('profile.functions.absence.from'),
			{ target: { value: '2026-12-21' } }
		);
		fireEvent.change(
			screen.getByLabelText('profile.functions.absence.until'),
			{ target: { value: '2027-01-03' } }
		);
		fireEvent.click(switchOf());
		await waitFor(() =>
			expect(apiSetAbsence).toHaveBeenCalledWith(true, '', {
				start: '2026-12-21',
				end: '2027-01-03'
			})
		);
	});

	it('switches on without dates: until further notice, as before', async () => {
		renderWith({ absent: false });
		fireEvent.click(switchOf());
		await waitFor(() =>
			expect(apiSetAbsence).toHaveBeenCalledWith(true, '', {
				start: null,
				end: null
			})
		);
		expect(
			screen.getByText('profile.functions.absence.dateHint')
		).toBeTruthy();
	});

	it('shows a planned absence as switched on, with its first day', () => {
		renderWith({
			absent: false,
			absenceStart: '2026-12-21',
			absenceEnd: '2027-01-03'
		});
		expect(switchOf().checked).toBe(true);
		expect(
			screen.getByText(/profile\.functions\.absence\.planned/)
		).toBeTruthy();
		expect(
			(
				screen.getByLabelText(
					'profile.functions.absence.from'
				) as HTMLInputElement
			).value
		).toBe('2026-12-21');
	});

	it('names the last day of a running absence', () => {
		renderWith({ absent: true, absenceEnd: '2027-01-03' });
		expect(
			screen.getByText(/profile\.functions\.absence\.activeUntil/)
		).toBeTruthy();
	});

	it('switching off ends the absence together with its days', async () => {
		renderWith({
			absent: false,
			absenceStart: '2026-12-21',
			absenceEnd: '2027-01-03'
		});
		fireEvent.click(switchOf());
		await waitFor(() =>
			expect(apiSetAbsence).toHaveBeenCalledWith(false, '', {
				start: null,
				end: null
			})
		);
	});

	it('refuses an end before the start', () => {
		renderWith({ absent: false });
		fireEvent.change(
			screen.getByLabelText('profile.functions.absence.from'),
			{ target: { value: '2026-12-21' } }
		);
		fireEvent.change(
			screen.getByLabelText('profile.functions.absence.until'),
			{ target: { value: '2026-12-20' } }
		);
		expect(
			screen.getByText('profile.functions.absence.invalidRange')
		).toBeTruthy();
		expect(switchOf().disabled).toBe(true);
	});
});
