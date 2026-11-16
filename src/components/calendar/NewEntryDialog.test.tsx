// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { NewEntryDialog } from './NewEntryDialog';

dayjs.extend(customParseFormat);

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

/* The pickers have their own tests: here they only hand over a value. */
type PickerProps = {
	label: string;
	value: Dayjs | null;
	onChange?: (value: Dayjs | null) => void;
};
vi.mock('../form/OrisoTimePicker', () => ({
	OrisoTimePicker: ({ label, value, onChange }: PickerProps) => (
		<input
			aria-label={label}
			value={value ? value.format('HH:mm') : ''}
			onChange={(e) =>
				onChange?.(
					e.target.value ? dayjs(e.target.value, 'HH:mm') : null
				)
			}
		/>
	)
}));
vi.mock('../form/OrisoDatePicker', () => ({
	OrisoDatePicker: ({ label, value, onChange }: PickerProps) => (
		<input
			aria-label={label}
			value={value ? value.format('YYYY-MM-DD') : ''}
			onChange={(e) =>
				onChange?.(e.target.value ? dayjs(e.target.value) : null)
			}
		/>
	)
}));
vi.mock('../form/OrisoCalendar', () => ({
	OrisoCalendar: () => null
}));
vi.mock('../form/OrisoSelect', () => ({
	OrisoSelect: ({
		label,
		value,
		onChange
	}: {
		label: string;
		value: string;
		onChange: (event: { target: { value: string } }) => void;
	}) => (
		<input
			aria-label={label}
			value={value}
			onChange={(e) => onChange({ target: { value: e.target.value } })}
		/>
	)
}));

afterEach(cleanup);

const NOW = new Date(2026, 10, 14, 12, 0);
const SLOT = {
	start: new Date(2026, 10, 16, 14),
	end: new Date(2026, 10, 16, 15)
};

const open = (
	props: Partial<React.ComponentProps<typeof NewEntryDialog>> = {}
) =>
	render(
		<NewEntryDialog
			open
			initialTab="appointment"
			conversations={[{ sessionId: 7, username: 'mutige_eule' }]}
			entries={[]}
			ownerId="me"
			now={NOW}
			onSaveAppointment={() => undefined}
			onSaveBlocker={() => undefined}
			onClose={() => undefined}
			{...props}
		/>
	);

const tab = (name: 'appointment' | 'blocker') =>
	document.querySelector<HTMLElement>(
		`[data-cy="calendar-new-tab-${name}"]`
	)!;

describe('NewEntryDialog — "Neuer Eintrag" with Termin | Sperrzeit (prototype v17)', () => {
	it('opens on the tab it is given, under one title', () => {
		open({ initialTab: 'blocker' });
		expect(screen.getByText('calendar.dialog.createTitle')).toBeTruthy();
		expect(tab('blocker').getAttribute('aria-pressed')).toBe('true');
		expect(tab('appointment').getAttribute('aria-pressed')).toBe('false');
		expect(screen.getByTestId('calendar-blocker-dialog')).toBeTruthy();
		expect(screen.getByTestId('calendar-blocker-save')).toBeTruthy();
	});

	it('switches between the forms and keeps what was entered', () => {
		open({ slot: { ...SLOT, kind: 'phone' } });
		expect(screen.getByTestId('calendar-appointment-dialog')).toBeTruthy();
		fireEvent.change(
			screen.getByLabelText('calendar.dialog.conversation'),
			{ target: { value: '7' } }
		);
		fireEvent.click(tab('blocker'));
		expect(screen.getByTestId('calendar-blocker-dialog')).toBeTruthy();
		expect(screen.queryByTestId('calendar-appointment-save')).toBeNull();
		fireEvent.click(tab('appointment'));
		expect(
			(
				screen.getByLabelText(
					'calendar.dialog.conversation'
				) as HTMLInputElement
			).value
		).toBe('7');
	});

	it('saves each tab through its own path', () => {
		const onSaveAppointment = vi.fn();
		const onSaveBlocker = vi.fn();
		open({
			slot: { ...SLOT, kind: 'phone' },
			initialSessionId: 7,
			onSaveAppointment,
			onSaveBlocker
		});
		fireEvent.click(screen.getByTestId('calendar-appointment-save'));
		expect(onSaveAppointment).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'appointment',
				kind: 'phone',
				sessionId: 7,
				start: SLOT.start,
				end: SLOT.end
			})
		);
		fireEvent.click(tab('blocker'));
		fireEvent.click(screen.getByTestId('calendar-blocker-save'));
		expect(onSaveBlocker).toHaveBeenCalledWith([
			expect.objectContaining({
				type: 'blocker',
				start: SLOT.start,
				end: SLOT.end
			})
		]);
	});
});
