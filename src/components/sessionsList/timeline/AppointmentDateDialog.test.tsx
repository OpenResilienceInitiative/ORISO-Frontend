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
const { invite } = vi.hoisted(() => ({ invite: vi.fn() }));
vi.mock('../../../api/apiDirectLinks', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../../api/apiDirectLinks')>()),
	apiCreateSessionDirectInvitation: invite
}));
vi.mock('qrcode', () => ({
	default: { toDataURL: () => Promise.resolve('data:image/png;base64,') }
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

		// The Art travels with it (default video), as from the calendar.
		expect(create).toHaveBeenCalledWith(4401, {
			startTime: local(5, 14),
			endTime: local(5, 15),
			kind: 'VIDEO'
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

	/* #2252: ⋮ "Termin anlegen" with "Weitere Personen per Link einladen". */
	describe('inviting more people by link', () => {
		const link = {
			id: '12',
			name: 'Termin',
			topic: '',
			medium: 'VIDEO',
			temporary: true,
			active: true,
			url: 'https://app.example/invite/t12',
			joinsExistingSession: true
		};
		const openWithInvite = () =>
			render(
				<AppointmentDateDialog
					sessionId={4401}
					matrixRoomId="!room:x"
					onClose={onClose}
					allowGuestInvite
				/>
			);
		const inviteSwitch = () =>
			screen.getByRole('switch', {
				name: 'directInvitation.dialog.inviteOthers'
			});

		it('saves the appointment with its Art, binds the invitation to it, then shows the link', async () => {
			create.mockResolvedValue({ id: 'a1' });
			invite.mockResolvedValue(link);
			const changed = vi.fn();
			const stop = onAppointmentsChanged(changed);
			openWithInvite();
			setField('date', '2026-11-05');
			setTime('start', 14);
			setTime('end', 15);
			fireEvent.click(inviteSwitch());
			await clickButton(`${KEYS}.createAction`);
			stop();

			// One save path with the calendar: appointment first (it carries
			// the Art), then the invitation that meets at it.
			expect(create).toHaveBeenCalledWith(4401, {
				startTime: local(5, 14),
				endTime: local(5, 15),
				kind: 'VIDEO'
			});
			expect(invite).toHaveBeenCalledWith(4401, {
				appointmentId: 'a1',
				medium: 'VIDEO',
				validityAfterEndMinutes: 1440,
				accessMode: 'BOTH',
				knock: true
			});
			expect(changed).toHaveBeenCalledTimes(1);
			expect(notice).toHaveBeenCalledWith(
				expect.objectContaining({ kind: 'created', sessionId: 4401 })
			);
			expect(
				await screen.findByTestId('direct-link-share-dialog')
			).toBeTruthy();
			expect(onClose).not.toHaveBeenCalled();
		});

		it('takes the chosen Art for the appointment and the link', async () => {
			create.mockResolvedValue({ id: 'a1' });
			invite.mockResolvedValue(link);
			openWithInvite();
			fireEvent.click(
				document.querySelector<HTMLElement>(
					'[data-cy="calendar-dialog-kind-phone"]'
				)!
			);
			fireEvent.click(inviteSwitch());
			await clickButton(`${KEYS}.createAction`);

			expect(create).toHaveBeenCalledWith(
				4401,
				expect.objectContaining({ kind: 'PHONE' })
			);
			expect(invite).toHaveBeenCalledWith(
				4401,
				expect.objectContaining({ medium: 'AUDIO' })
			);
		});

		it('keeps the saved appointment when the link is refused, and a retry only adds the link', async () => {
			create.mockResolvedValue({ id: 'a1' });
			invite.mockRejectedValueOnce(new Response(null, { status: 409 }));
			openWithInvite();
			fireEvent.click(inviteSwitch());
			await clickButton(`${KEYS}.createAction`);

			expect(screen.getByRole('alert').textContent).toBe(
				'directInvitation.dialog.linkFailedAfterAppointment'
			);
			// The appointment exists: the conversation hears of it once.
			expect(notice).toHaveBeenCalledTimes(1);
			expect(onClose).not.toHaveBeenCalled();

			invite.mockResolvedValue(link);
			await clickButton(`${KEYS}.createAction`);

			expect(create).toHaveBeenCalledTimes(1);
			expect(invite).toHaveBeenCalledTimes(2);
			expect(invite).toHaveBeenLastCalledWith(
				4401,
				expect.objectContaining({ appointmentId: 'a1' })
			);
			expect(notice).toHaveBeenCalledTimes(1);
			expect(
				await screen.findByTestId('direct-link-share-dialog')
			).toBeTruthy();
		});

		it('moves the saved appointment first when the time changed before the retry', async () => {
			create.mockResolvedValue({ id: 'a1' });
			invite.mockRejectedValueOnce(new Response(null, { status: 409 }));
			openWithInvite();
			setField('date', '2026-11-05');
			setTime('start', 14);
			setTime('end', 15);
			fireEvent.click(inviteSwitch());
			await clickButton(`${KEYS}.createAction`);

			invite.mockResolvedValue(link);
			setTime('end', 16);
			await clickButton(`${KEYS}.createAction`);

			expect(create).toHaveBeenCalledTimes(1);
			expect(move).toHaveBeenCalledWith(4401, 'a1', {
				startTime: local(5, 14),
				endTime: local(5, 16),
				kind: 'VIDEO'
			});
			// The conversation still shows 14–15: it hears of the move.
			expect(notice).toHaveBeenCalledTimes(2);
			expect(notice).toHaveBeenLastCalledWith(
				expect.objectContaining({
					kind: 'moved',
					start: new Date(local(5, 14)),
					end: new Date(local(5, 16))
				})
			);
		});

		it('announces a moved time even when the link is refused again, and only once', async () => {
			create.mockResolvedValue({ id: 'a1' });
			invite.mockRejectedValue(new Response(null, { status: 409 }));
			const changed = vi.fn();
			const stop = onAppointmentsChanged(changed);
			openWithInvite();
			setField('date', '2026-11-05');
			setTime('start', 14);
			setTime('end', 15);
			fireEvent.click(inviteSwitch());
			await clickButton(`${KEYS}.createAction`);
			expect(changed).toHaveBeenCalledTimes(1);

			setTime('end', 16);
			await clickButton(`${KEYS}.createAction`);
			expect(move).toHaveBeenCalledTimes(1);
			expect(changed).toHaveBeenCalledTimes(2);
			expect(notice).toHaveBeenCalledTimes(2);
			expect(notice).toHaveBeenLastCalledWith(
				expect.objectContaining({
					kind: 'moved',
					end: new Date(local(5, 16))
				})
			);

			// Unchanged since: the next retry only tries the link again.
			await clickButton(`${KEYS}.createAction`);
			stop();
			expect(move).toHaveBeenCalledTimes(1);
			expect(changed).toHaveBeenCalledTimes(2);
			expect(notice).toHaveBeenCalledTimes(2);
		});

		it('stores a changed Art before the retry, without a second notice', async () => {
			create.mockResolvedValue({ id: 'a1' });
			invite.mockRejectedValueOnce(new Response(null, { status: 409 }));
			const changed = vi.fn();
			const stop = onAppointmentsChanged(changed);
			openWithInvite();
			setField('date', '2026-11-05');
			setTime('start', 14);
			setTime('end', 15);
			fireEvent.click(inviteSwitch());
			await clickButton(`${KEYS}.createAction`);

			invite.mockResolvedValue(link);
			fireEvent.click(
				document.querySelector<HTMLElement>(
					'[data-cy="calendar-dialog-kind-phone"]'
				)!
			);
			await clickButton(`${KEYS}.createAction`);
			stop();

			// Telefon for the link means Telefon for the stored appointment.
			expect(move).toHaveBeenCalledWith(4401, 'a1', {
				startTime: local(5, 14),
				endTime: local(5, 15),
				kind: 'PHONE'
			});
			expect(invite).toHaveBeenLastCalledWith(
				4401,
				expect.objectContaining({
					appointmentId: 'a1',
					medium: 'AUDIO'
				})
			);
			// The time did not change: the notice in the chat still holds.
			expect(notice).toHaveBeenCalledTimes(1);
			expect(changed).toHaveBeenCalledTimes(2);
		});

		it('says why when the conversation is not encrypted, and that the appointment stands', async () => {
			create.mockResolvedValue({ id: 'a1' });
			invite.mockRejectedValue(
				new Response(
					JSON.stringify({
						reason: 'DIRECT_INVITATION_ROOM_NOT_ENCRYPTED'
					}),
					{ status: 409 }
				)
			);
			openWithInvite();
			fireEvent.click(inviteSwitch());
			await clickButton(`${KEYS}.createAction`);

			expect((await screen.findByRole('alert')).textContent).toBe(
				'directInvitation.dialog.roomNotEncrypted directInvitation.dialog.appointmentSaved'
			);
			expect(onClose).not.toHaveBeenCalled();
		});

		it('keeps the plain appointment when nobody else is invited', async () => {
			openWithInvite();
			await clickButton(`${KEYS}.createAction`);

			expect(create).toHaveBeenCalled();
			expect(invite).not.toHaveBeenCalled();
		});

		it('does not offer the invitation without permission', () => {
			open();
			expect(
				screen.queryByRole('switch', {
					name: 'directInvitation.dialog.inviteOthers'
				})
			).toBeNull();
		});
	});
});
