// @vitest-environment oriso-jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import * as React from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { FETCH_ERRORS } from '../../../api/fetchData';
import { AppointmentDateDialog } from './AppointmentDateDialog';
import { onAppointmentsChanged } from './conversationAppointments';
import type { FutureEntry } from './timelineModel';

const { create, move, notice } = vi.hoisted(() => ({
	create: vi.fn(),
	move: vi.fn(),
	notice: vi.fn()
}));
vi.mock('../../../api/apiSessionAppointments', () => ({
	apiCreateSessionAppointment: create,
	apiMoveSessionAppointment: move
}));
vi.mock('./useAppointmentNotice', () => ({
	useAppointmentNotice: () => notice
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

/* The dial and calendar have their own tests: here they only hand over a value. */
type PickerProps = {
	label: string;
	value: Dayjs | null;
	onChange?: (value: Dayjs | null) => void;
};
vi.mock('../../form/OrisoDatePicker', () => ({
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
vi.mock('../../form/OrisoTimePicker', () => ({
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

dayjs.extend(customParseFormat);

const KEYS = 'sessionList.timeline.appointment.dialog';
const NOW = new Date(2026, 10, 3, 12, 0);
const local = (day: number, hour: number, minute = 0) =>
	new Date(2026, 10, day, hour, minute).toISOString();

const setField = (name: string, value: string) =>
	fireEvent.change(screen.getByLabelText(`${KEYS}.${name}`), {
		target: { value }
	});
/* A same-day time parsed by the stand-in picker: only hour and minute count. */
const setTime = (name: 'start' | 'end', hour: number) =>
	setField(name, `${String(hour).padStart(2, '0')}:00`);
const clickButton = async (name: string) => {
	await act(async () => {
		fireEvent.click(screen.getByRole('button', { name }));
	});
};

describe('AppointmentDateDialog', () => {
	const onClose = vi.fn();

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'], now: NOW });
		vi.clearAllMocks();
		create.mockResolvedValue({});
		move.mockResolvedValue({});
		notice.mockResolvedValue(undefined);
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	const open = (entry?: FutureEntry) =>
		render(
			<AppointmentDateDialog
				sessionId={4401}
				matrixRoomId="!room:x"
				entry={entry}
				onClose={onClose}
			/>
		);

	it('creates with start and end, reloads, closes and leaves a notice', async () => {
		const changed = vi.fn();
		const stop = onAppointmentsChanged(changed);
		open();
		setField('date', '2026-11-05');
		setTime('start', 14);
		setTime('end', 15);
		await clickButton(`${KEYS}.createAction`);
		stop();

		expect(create).toHaveBeenCalledWith(4401, {
			startTime: local(5, 14),
			endTime: local(5, 15)
		});
		expect(changed).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(notice).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 'created',
				sessionId: 4401,
				matrixRoomId: '!room:x'
			})
		);
	});

	it('moves an existing appointment by its id', async () => {
		open({
			start: new Date(local(6, 9)),
			end: new Date(local(6, 10)),
			booking: { appointmentId: 'a-1' }
		} as unknown as FutureEntry);
		setTime('end', 11);
		await clickButton(`${KEYS}.moveAction`);

		expect(move).toHaveBeenCalledWith(4401, 'a-1', {
			startTime: local(6, 9),
			endTime: local(6, 11)
		});
		expect(create).not.toHaveBeenCalled();
		expect(notice).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'moved' })
		);
	});

	it.each([
		['end equal to start', '2026-11-05', 14, 14, 'order'],
		['end before start', '2026-11-05', 14, 13, 'order'],
		['a time already past today', '2026-11-03', 9, 10, 'past']
	])('refuses %s', async (_name, date, start, end, error) => {
		open();
		setField('date', date);
		setTime('start', start);
		setTime('end', end);
		await clickButton(`${KEYS}.createAction`);

		expect(screen.getByRole('alert').textContent).toBe(
			`${KEYS}.error.${error}`
		);
		expect(create).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('refuses an empty time field', async () => {
		open();
		setField('end', '');
		await clickButton(`${KEYS}.createAction`);

		expect(screen.getByRole('alert').textContent).toBe(
			`${KEYS}.error.incomplete`
		);
		expect(create).not.toHaveBeenCalled();
	});

	it.each([
		['a conflict', new Error(FETCH_ERRORS.CONFLICT), 'conflict'],
		['any other backend error', new Error('boom'), 'failed']
	])('stays open and shows %s', async (_name, cause, error) => {
		create.mockRejectedValue(cause);
		open();
		await clickButton(`${KEYS}.createAction`);

		expect(screen.getByRole('alert').textContent).toBe(
			`${KEYS}.error.${error}`
		);
		expect(onClose).not.toHaveBeenCalled();
		expect(notice).not.toHaveBeenCalled();
		expect(
			(
				screen.getByRole('button', {
					name: `${KEYS}.createAction`
				}) as HTMLButtonElement
			).disabled
		).toBe(false);
	});

	it('cancel closes without saving', async () => {
		open();
		await clickButton('app.cancel');

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(create).not.toHaveBeenCalled();
		expect(notice).not.toHaveBeenCalled();
	});
});
