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
const COLLEAGUES = [
	{
		id: 'kai',
		displayName: 'Kai Colleague',
		agencyName: 'Beratungsstelle Nord',
		relation: 'sameAgency' as const
	},
	{
		id: 'far',
		displayName: 'Far Colleague',
		agencyName: 'Süd',
		relation: 'sameTenant' as const,
		internalChat: false
	}
];

const open = (
	props: Partial<React.ComponentProps<typeof NewEntryDialog>> = {}
) => {
	const onSaveAppointment = vi.fn();
	render(
		<NewEntryDialog
			open
			initialTab="appointment"
			conversations={[{ sessionId: 7, username: 'mutige_eule' }]}
			colleagues={COLLEAGUES}
			entries={[]}
			ownerId="me"
			now={NOW}
			onSaveAppointment={onSaveAppointment}
			onSaveBlocker={() => undefined}
			onClose={() => undefined}
			{...props}
		/>
	);
	return onSaveAppointment;
};

const withColleague = () =>
	screen.getByRole('radio', { name: 'calendar.dialog.withColleague' });

describe('"Neuer Eintrag" with a colleague (FE#2305)', () => {
	it('puts "Ratsuchende Person | Kolleg:in" on the line of the tabs', () => {
		open();
		const group = screen.getByRole('radiogroup', {
			name: 'calendar.dialog.withWhom'
		});
		const tabs = screen.getByRole('tablist');
		expect(group.parentElement).toBe(tabs.parentElement);
		expect(
			within(group)
				.getAllByRole('radio')
				.map((r) => r.getAttribute('aria-checked'))
		).toEqual(['true', 'false']);
	});

	it('makes the appointment with a colleague instead of a conversation', () => {
		const onSave = open();
		fireEvent.click(withColleague());
		expect(
			screen.queryByLabelText('calendar.dialog.conversation')
		).toBeNull();
		fireEvent.change(screen.getByLabelText('calendar.dialog.colleague'), {
			target: { value: 'kai' }
		});
		fireEvent.click(
			screen.getByRole('button', { name: 'calendar.kinds.onsite' })
		);
		fireEvent.click(screen.getByTestId('calendar-appointment-save'));
		expect(onSave).toHaveBeenCalledTimes(1);
		const draft = onSave.mock.calls[0][0];
		expect(draft.colleagueId).toBe('kai');
		expect(draft.sessionId).toBeUndefined();
		expect(draft.kind).toBe('onsite');
	});

	it('asks for the colleague before saving', () => {
		const onSave = open();
		fireEvent.click(withColleague());
		fireEvent.click(screen.getByTestId('calendar-appointment-save'));
		expect(onSave).not.toHaveBeenCalled();
		expect(screen.getByRole('alert').textContent).toBe(
			'calendar.dialog.error.colleague'
		);
	});

	it('offers only "Vor Ort" where no internal chat is allowed', () => {
		const onSave = open();
		fireEvent.click(withColleague());
		fireEvent.change(screen.getByLabelText('calendar.dialog.colleague'), {
			target: { value: 'far' }
		});
		expect(
			screen.queryByRole('button', { name: 'calendar.kinds.video' })
		).toBeNull();
		expect(screen.getByText('calendar.dialog.onsiteOnly')).toBeTruthy();
		fireEvent.click(screen.getByTestId('calendar-appointment-save'));
		expect(onSave.mock.calls[0][0]).toEqual(
			expect.objectContaining({ colleagueId: 'far', kind: 'onsite' })
		);
	});

	it('moves through the switch with the arrow keys', () => {
		open();
		const [conversation, colleague] = within(
			screen.getByRole('radiogroup')
		).getAllByRole('radio');
		expect(conversation.tabIndex).toBe(0);
		expect(colleague.tabIndex).toBe(-1);
		fireEvent.keyDown(conversation, { key: 'ArrowRight' });
		expect(colleague.getAttribute('aria-checked')).toBe('true');
	});

	it('offers no switch without colleagues, nor on Sperrzeit', () => {
		open({ colleagues: [] });
		expect(screen.queryByRole('radiogroup')).toBeNull();
		cleanup();
		open({ initialTab: 'blocker' });
		expect(screen.queryByRole('radiogroup')).toBeNull();
	});
});
