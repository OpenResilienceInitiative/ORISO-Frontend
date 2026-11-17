// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
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

const tab = (name: 'appointment' | 'blocker' | 'absence') =>
	screen.queryByRole('tab', { name: `calendar.dialog.tabs.${name}` })!;

describe('NewEntryDialog — "Neuer Eintrag" with Termin | Sperrzeit (prototype v17)', () => {
	it('opens on the tab it is given, under one title', () => {
		open({ initialTab: 'blocker' });
		expect(screen.getByText('calendar.dialog.createTitle')).toBeTruthy();
		expect(tab('blocker').getAttribute('aria-selected')).toBe('true');
		expect(tab('appointment').getAttribute('aria-selected')).toBe('false');
		expect(screen.getByTestId('calendar-blocker-dialog')).toBeTruthy();
		expect(screen.getByTestId('calendar-blocker-save')).toBeTruthy();
	});

	it('is a tab list whose tabs control the form below (review 4595635797)', () => {
		open({ initialTab: 'blocker' });
		const list = screen.getByRole('tablist', {
			name: 'calendar.dialog.entryKind'
		});
		const tabs = within(list).getAllByRole('tab');
		expect(tabs).toEqual([tab('appointment'), tab('blocker')]);
		// The hooks for end-to-end tests stay.
		expect(tabs.map((el) => el.dataset.cy)).toEqual([
			'calendar-new-tab-appointment',
			'calendar-new-tab-blocker'
		]);
		const panel = screen.getByRole('tabpanel');
		expect(tab('blocker').id).toBeTruthy();
		expect(tab('appointment').id).not.toBe(tab('blocker').id);
		expect(panel.getAttribute('aria-labelledby')).toBe(tab('blocker').id);
		expect(tab('blocker').getAttribute('aria-controls')).toBe(panel.id);
		expect(tab('appointment').getAttribute('aria-controls')).toBe(panel.id);
		// The form is inside the panel; Save stays in the dialog's bar.
		expect(
			panel.querySelector('[data-cy="calendar-blocker-all-day"]')
		).toBeTruthy();
		// One stop for Tab: the selected tab, the other through the arrows.
		expect(tab('blocker').tabIndex).toBe(0);
		expect(tab('appointment').tabIndex).toBe(-1);
		expect(tab('blocker').hasAttribute('aria-pressed')).toBe(false);

		fireEvent.click(tab('appointment'));
		expect(tab('appointment').getAttribute('aria-selected')).toBe('true');
		expect(tab('appointment').tabIndex).toBe(0);
		expect(tab('blocker').tabIndex).toBe(-1);
		expect(
			screen.getByRole('tabpanel').getAttribute('aria-labelledby')
		).toBe(tab('appointment').id);
	});

	it('switches with the arrow keys, Home and End, and moves the focus along', () => {
		open();
		const selected = () =>
			screen
				.getAllByRole('tab')
				.find((el) => el.getAttribute('aria-selected') === 'true');
		tab('appointment').focus();
		fireEvent.keyDown(tab('appointment'), { key: 'ArrowRight' });
		expect(selected()).toBe(tab('blocker'));
		expect(document.activeElement).toBe(tab('blocker'));
		expect(screen.getByTestId('calendar-blocker-dialog')).toBeTruthy();
		// It wraps round at either end.
		fireEvent.keyDown(tab('blocker'), { key: 'ArrowRight' });
		expect(selected()).toBe(tab('appointment'));
		expect(document.activeElement).toBe(tab('appointment'));
		fireEvent.keyDown(tab('appointment'), { key: 'ArrowLeft' });
		expect(selected()).toBe(tab('blocker'));
		fireEvent.keyDown(tab('blocker'), { key: 'Home' });
		expect(selected()).toBe(tab('appointment'));
		expect(document.activeElement).toBe(tab('appointment'));
		fireEvent.keyDown(tab('appointment'), { key: 'End' });
		expect(selected()).toBe(tab('blocker'));
		expect(document.activeElement).toBe(tab('blocker'));
		expect(screen.getByTestId('calendar-blocker-dialog')).toBeTruthy();
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

	it('has an icon above its title (Frank *1)', () => {
		open();
		expect(document.querySelector('.m3Dialog__heroIcon svg')).toBeTruthy();
	});

	it('offers "Art" as four tiles in a wrapping grid, also for a slot without a kind (Frank *1, test C7)', () => {
		const onSaveAppointment = vi.fn();
		open({ slot: SLOT, initialSessionId: 7, onSaveAppointment });
		const tiles = Array.from(
			document.querySelectorAll<HTMLElement>(
				'.calendarDialog__kinds [data-cy^="calendar-dialog-kind-"]'
			)
		);
		expect(tiles.map((b) => b.dataset.cy)).toEqual([
			'calendar-dialog-kind-video',
			'calendar-dialog-kind-phone',
			'calendar-dialog-kind-onsite',
			'calendar-dialog-kind-chat'
		]);
		expect(tiles[0].getAttribute('aria-pressed')).toBe('true');
		fireEvent.click(tiles[1]);
		expect(tiles[1].getAttribute('aria-pressed')).toBe('true');
		fireEvent.click(screen.getByTestId('calendar-appointment-save'));
		expect(onSaveAppointment).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'phone', start: SLOT.start })
		);
	});

	it('shows no kind tiles when the slot already has its kind', () => {
		open({ slot: { ...SLOT, kind: 'phone' } });
		expect(document.querySelector('.calendarDialog__kinds')).toBeNull();
	});
});

describe('NewEntryDialog — planned absence tab (ORISO-Frontend#2303)', () => {
	const APPOINTMENT_INSIDE = {
		id: 'a1',
		type: 'appointment' as const,
		kind: 'video' as const,
		ownerId: 'me',
		title: 'mutige_eule',
		start: new Date(2026, 11, 22, 10).toISOString(),
		end: new Date(2026, 11, 22, 11).toISOString()
	};

	it('offers "Abwesenheit" only where an absence can be saved', () => {
		open();
		expect(tab('absence')).toBeNull();
		cleanup();
		open({ onSaveAbsence: () => undefined });
		expect(tab('absence')).toBeTruthy();
		fireEvent.click(tab('absence'));
		expect(screen.getByTestId('calendar-absence-dialog')).toBeTruthy();
	});

	it('lets the arrow keys wrap over the tabs that are there', () => {
		open({ onSaveAbsence: () => undefined });
		fireEvent.keyDown(tab('appointment'), { key: 'ArrowLeft' });
		expect(tab('absence').getAttribute('aria-selected')).toBe('true');
		cleanup();
		open();
		fireEvent.keyDown(tab('appointment'), { key: 'ArrowLeft' });
		expect(tab('blocker').getAttribute('aria-selected')).toBe('true');
	});

	it('saves the date range and message as the absence', () => {
		const onSaveAbsence = vi.fn();
		open({ initialTab: 'absence', onSaveAbsence });
		fireEvent.change(screen.getByLabelText('calendar.absence.from'), {
			target: { value: '2026-12-21' }
		});
		fireEvent.change(screen.getByLabelText('calendar.absence.until'), {
			target: { value: '2027-01-03' }
		});
		fireEvent.change(screen.getByLabelText('calendar.absence.message'), {
			target: { value: 'Im Urlaub' }
		});
		fireEvent.click(screen.getByTestId('calendar-absence-save'));
		expect(onSaveAbsence).toHaveBeenCalledWith({
			start: '2026-12-21',
			end: '2027-01-03',
			message: 'Im Urlaub'
		});
	});

	it('refuses a range that ends before it starts', () => {
		open({ initialTab: 'absence', onSaveAbsence: () => undefined });
		fireEvent.change(screen.getByLabelText('calendar.absence.from'), {
			target: { value: '2026-12-21' }
		});
		fireEvent.change(screen.getByLabelText('calendar.absence.until'), {
			target: { value: '2026-12-20' }
		});
		expect(
			(screen.getByTestId('calendar-absence-save') as HTMLButtonElement)
				.disabled
		).toBe(true);
	});

	it('warns about own appointments inside the range and does not cancel them (Frank 2026-11-17)', () => {
		const onSaveAbsence = vi.fn();
		open({
			initialTab: 'absence',
			entries: [APPOINTMENT_INSIDE],
			onSaveAbsence
		});
		fireEvent.change(screen.getByLabelText('calendar.absence.from'), {
			target: { value: '2026-12-21' }
		});
		fireEvent.change(screen.getByLabelText('calendar.absence.until'), {
			target: { value: '2027-01-03' }
		});
		const warning = screen.getByTestId('calendar-absence-conflicts');
		expect(warning.textContent).toContain('mutige_eule');
		fireEvent.click(screen.getByTestId('calendar-absence-save'));
		expect(onSaveAbsence).toHaveBeenCalledTimes(1);
	});
});
