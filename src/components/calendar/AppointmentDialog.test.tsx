// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { AppointmentDialog } from './AppointmentDialog';

dayjs.extend(customParseFormat);

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

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

const open = (slot: { start: Date; end: Date }, onSave = vi.fn()) => {
	render(
		<AppointmentDialog
			open
			slot={{ ...slot, kind: 'video' }}
			conversations={[{ sessionId: 7, username: 'mutige_eule' }]}
			entries={[]}
			ownerId="me"
			now={NOW}
			onSave={onSave}
			onClose={() => undefined}
		/>
	);
	fireEvent.change(screen.getByLabelText('calendar.dialog.conversation'), {
		target: { value: '7' }
	});
	fireEvent.click(screen.getByTestId('calendar-appointment-save'));
	return onSave;
};

describe('AppointmentDialog — selected slot', () => {
	it('keeps a slot that ends at midnight on the next date', () => {
		const onSave = open({
			start: new Date(2026, 10, 16, 23),
			end: new Date(2026, 10, 17, 0)
		});
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({
				start: new Date(2026, 10, 16, 23),
				end: new Date(2026, 10, 17, 0)
			})
		);
	});

	it('keeps a slot over night', () => {
		const onSave = open({
			start: new Date(2026, 10, 16, 20),
			end: new Date(2026, 10, 17, 8)
		});
		expect(onSave.mock.calls[0][0].end).toEqual(new Date(2026, 10, 17, 8));
	});

	it('asks for the times when the month view selected a whole day', () => {
		const onSave = open({
			start: new Date(2026, 10, 16),
			end: new Date(2026, 10, 17)
		});
		expect(screen.getByLabelText('calendar.dialog.start')).toBeTruthy();
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({
				start: new Date(2026, 10, 16, 10),
				end: new Date(2026, 10, 16, 11)
			})
		);
	});
});

describe('with a colleague (FE#2305)', () => {
	const colleagues = [
		{
			id: 'kai',
			displayName: 'Kai Colleague',
			agencyName: 'Beratungsstelle Nord',
			relation: 'sameAgency' as const
		}
	];

	it('makes the appointment with a colleague instead of a conversation', () => {
		const onSave = vi.fn();
		render(
			<AppointmentDialog
				open
				conversations={[{ sessionId: 7, username: 'mutige_eule' }]}
				colleagues={colleagues}
				entries={[]}
				ownerId="me"
				now={NOW}
				onSave={onSave}
				onClose={() => undefined}
			/>
		);
		fireEvent.click(
			screen.getByRole('radio', { name: 'calendar.dialog.withColleague' })
		);
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
		const onSave = vi.fn();
		render(
			<AppointmentDialog
				open
				conversations={[]}
				colleagues={colleagues}
				entries={[]}
				ownerId="me"
				now={NOW}
				onSave={onSave}
				onClose={() => undefined}
			/>
		);
		fireEvent.click(
			screen.getByRole('radio', { name: 'calendar.dialog.withColleague' })
		);
		fireEvent.click(screen.getByTestId('calendar-appointment-save'));
		expect(onSave).not.toHaveBeenCalled();
		expect(screen.getByRole('alert').textContent).toBe(
			'calendar.dialog.error.colleague'
		);
	});

	it('offers no choice when there are no colleagues', () => {
		render(
			<AppointmentDialog
				open
				conversations={[]}
				entries={[]}
				ownerId="me"
				now={NOW}
				onSave={vi.fn()}
				onClose={() => undefined}
			/>
		);
		expect(
			screen.queryByRole('radio', {
				name: 'calendar.dialog.withColleague'
			})
		).toBeNull();
	});
});

describe('without an internal chat (FE#2305, Frank 2026-11-17)', () => {
	it('offers only "Vor Ort" for a colleague one may not chat with', () => {
		const onSave = vi.fn();
		render(
			<AppointmentDialog
				open
				conversations={[]}
				colleagues={[
					{
						id: 'far',
						displayName: 'Far Colleague',
						agencyName: 'Süd',
						relation: 'sameTenant',
						internalChat: false
					}
				]}
				entries={[]}
				ownerId="me"
				now={NOW}
				onSave={onSave}
				onClose={() => undefined}
			/>
		);
		fireEvent.click(
			screen.getByRole('radio', { name: 'calendar.dialog.withColleague' })
		);
		fireEvent.change(screen.getByLabelText('calendar.dialog.colleague'), {
			target: { value: 'far' }
		});
		expect(
			screen.queryByRole('button', { name: 'calendar.kinds.video' })
		).toBeNull();
		expect(
			screen.getByRole('button', { name: 'calendar.kinds.onsite' })
		).toBeTruthy();
		expect(screen.getByText('calendar.dialog.onsiteOnly')).toBeTruthy();
		fireEvent.click(screen.getByTestId('calendar-appointment-save'));
		expect(onSave.mock.calls[0][0]).toEqual(
			expect.objectContaining({ colleagueId: 'far', kind: 'onsite' })
		);
	});
});
