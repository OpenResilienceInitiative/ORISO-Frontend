// @vitest-environment oriso-jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within
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
import {
	InvitationDialog,
	type InvitationDialogProps
} from './InvitationDialog';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) =>
			options?.count !== undefined ? `${key}:${options.count}` : key
	})
}));

/* The dial and calendar have their own tests: here they only hand over a value. */
type PickerProps = {
	label: string;
	value: Dayjs | null;
	onChange?: (value: Dayjs | null) => void;
};
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
/* Like the real picker, the time field commits its text again on blur. */
const commitTime =
	(onChange?: (value: Dayjs | null) => void) =>
	(e: { target: { value: string } }) =>
		onChange?.(e.target.value ? dayjs(e.target.value, 'HH:mm') : null);
vi.mock('../form/OrisoTimePicker', () => ({
	OrisoTimePicker: ({ label, value, onChange }: PickerProps) => (
		<input
			aria-label={label}
			value={value ? value.format('HH:mm') : ''}
			onChange={commitTime(onChange)}
			onBlur={commitTime(onChange)}
		/>
	)
}));

dayjs.extend(customParseFormat);

const SLOT = 'sessionList.timeline.appointment.dialog';
const KEYS = 'directInvitation.dialog';
const NOW = new Date(2026, 10, 3, 12, 0);
const local = (day: number, hour: number) => new Date(2026, 10, day, hour, 0);

const setField = (name: string, value: string) =>
	fireEvent.change(screen.getByLabelText(`${SLOT}.${name}`), {
		target: { value }
	});
const setTime = (name: 'start' | 'end', hour: number) =>
	setField(name, `${String(hour).padStart(2, '0')}:00`);
const click = async (name: string) => {
	await act(async () => {
		fireEvent.click(screen.getByRole('button', { name }));
	});
};
const toggle = (name: string) =>
	fireEvent.click(screen.getByRole('switch', { name }));

describe('InvitationDialog (#2252)', () => {
	const onSubmit = vi.fn();
	const onClose = vi.fn();

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'], now: NOW });
		vi.clearAllMocks();
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	const open = (props: Partial<InvitationDialogProps> = {}) =>
		render(
			<InvitationDialog
				variant="invitation"
				onSubmit={onSubmit}
				onClose={onClose}
				{...props}
			/>
		);

	describe('Direkteinladung', () => {
		it('needs no date: without appointment it is valid until deleted', async () => {
			open();
			expect(screen.queryByLabelText(`${SLOT}.date`)).toBeNull();
			await click(`${KEYS}.createAction`);

			expect(onSubmit).toHaveBeenCalledWith({
				appointment: null,
				link: { validityMinutes: null, access: 'both', knock: true }
			});
		});

		it('with appointment sends start, end and 24 hours validity', async () => {
			open();
			toggle(`${KEYS}.withAppointment`);
			setField('date', '2026-11-05');
			setTime('start', 14);
			setTime('end', 15);
			await click(`${KEYS}.createAction`);

			expect(onSubmit).toHaveBeenCalledWith({
				appointment: { start: local(5, 14), end: local(5, 15) },
				link: { validityMinutes: 1440, access: 'both', knock: true }
			});
		});

		it('"Mit Termin" preselects today at the next half hour, one hour long (#2358)', () => {
			/* NOW is 12:00 on the 3rd. */
			open();
			toggle(`${KEYS}.withAppointment`);
			const value = (name: string) =>
				(screen.getByLabelText(`${SLOT}.${name}`) as HTMLInputElement)
					.value;
			expect(value('date')).toBe('2026-11-03');
			expect(value('start')).toBe('12:30');
			expect(value('end')).toBe('13:30');
		});

		it('setting Beginn moves Ende to Beginn + 1 h (#2358)', async () => {
			open();
			toggle(`${KEYS}.withAppointment`);
			setField('date', '2026-11-05');
			setTime('start', 16);
			expect(
				(screen.getByLabelText(`${SLOT}.end`) as HTMLInputElement).value
			).toBe('17:00');
			await click(`${KEYS}.createAction`);
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					appointment: { start: local(5, 16), end: local(5, 17) }
				})
			);
		});

		it('leaving Beginn unchanged keeps a custom Ende (#2358)', async () => {
			open();
			toggle(`${KEYS}.withAppointment`);
			setField('date', '2026-11-05');
			setTime('start', 16);
			setTime('end', 18);
			fireEvent.blur(screen.getByLabelText(`${SLOT}.start`));
			await click(`${KEYS}.createAction`);
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					appointment: { start: local(5, 16), end: local(5, 18) }
				})
			);
		});

		it('late in the evening the default is tomorrow 10:00 and can be created (#2358)', async () => {
			vi.setSystemTime(new Date(2026, 10, 3, 22, 45));
			open();
			toggle(`${KEYS}.withAppointment`);
			await click(`${KEYS}.createAction`);
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					appointment: { start: local(4, 10), end: local(4, 11) }
				})
			);
		});

		it.each([
			['end equal to start', '2026-11-05', 14, 14, 'order'],
			['end before start', '2026-11-05', 14, 13, 'order'],
			['a time already past today', '2026-11-03', 9, 10, 'past']
		])('refuses %s', async (_name, date, start, end, error) => {
			open();
			toggle(`${KEYS}.withAppointment`);
			setField('date', date);
			setTime('start', start);
			setTime('end', end);
			await click(`${KEYS}.createAction`);

			expect(screen.getByRole('alert').textContent).toBe(
				`${SLOT}.error.${error}`
			);
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it('keeps the appointment of an invitation being edited', async () => {
			open({
				mode: 'edit',
				initial: {
					start: local(5, 14),
					end: local(5, 15),
					withAppointment: true
				}
			});
			/* The backend cannot drop an appointment from an invitation. */
			expect(
				screen.queryByRole('switch', {
					name: `${KEYS}.withAppointment`
				})
			).toBeNull();
			await click(`${KEYS}.saveAction`);
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					appointment: { start: local(5, 14), end: local(5, 15) }
				})
			);
		});

		it('still saves an invitation whose appointment has started', async () => {
			/* NOW is 12:00 on the 3rd: the appointment runs 11–13. */
			open({
				mode: 'edit',
				initial: {
					start: local(3, 11),
					end: local(3, 13),
					withAppointment: true,
					validityMinutes: 1440,
					access: 'both',
					knock: true
				}
			});
			toggle(`${KEYS}.knock`);
			await click(`${KEYS}.saveAction`);

			expect(screen.queryByRole('alert')).toBeNull();
			expect(onSubmit).toHaveBeenCalledWith({
				appointment: { start: local(3, 11), end: local(3, 13) },
				link: { validityMinutes: 1440, access: 'both', knock: false },
				/* Only what the counsellor changed is written back. */
				changed: {
					appointment: false,
					validityMinutes: false,
					access: false,
					knock: true
				}
			});
		});

		describe('an appointment over midnight (23:00 to 00:00)', () => {
			const overnight = {
				start: local(5, 23),
				end: local(6, 0),
				withAppointment: true,
				validityMinutes: 1440,
				access: 'both' as const,
				knock: true
			};

			it('stays editable: changing only the link keeps its end on the next day', async () => {
				open({ mode: 'edit', initial: overnight });
				toggle(`${KEYS}.knock`);
				await click(`${KEYS}.saveAction`);

				expect(screen.queryByRole('alert')).toBeNull();
				expect(onSubmit).toHaveBeenCalledWith(
					expect.objectContaining({
						appointment: { start: local(5, 23), end: local(6, 0) },
						changed: expect.objectContaining({
							appointment: false,
							knock: true
						})
					})
				);
			});

			it('comes from the calendar as it is (Chat erstellen with the slot)', async () => {
				open({ initial: overnight });
				await click(`${KEYS}.createAction`);

				expect(onSubmit).toHaveBeenCalledWith(
					expect.objectContaining({
						appointment: { start: local(5, 23), end: local(6, 0) }
					})
				);
			});

			it('ends on the start day again once the end time is after the start', async () => {
				open({ mode: 'edit', initial: overnight });
				setField('end', '23:30');
				await click(`${KEYS}.saveAction`);

				expect(onSubmit).toHaveBeenCalledWith(
					expect.objectContaining({
						appointment: {
							start: local(5, 23),
							end: new Date(2026, 10, 5, 23, 30)
						}
					})
				);
			});
		});

		it('refuses moving a started appointment to another past start', async () => {
			open({
				mode: 'edit',
				initial: {
					start: local(3, 11),
					end: local(3, 13),
					withAppointment: true
				}
			});
			setTime('start', 10);
			await click(`${KEYS}.saveAction`);

			expect(screen.getByRole('alert').textContent).toBe(
				`${SLOT}.error.past`
			);
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it('refuses an empty time once a date is wanted', async () => {
			open();
			toggle(`${KEYS}.withAppointment`);
			setField('end', '');
			await click(`${KEYS}.createAction`);

			expect(screen.getByRole('alert').textContent).toBe(
				`${SLOT}.error.incomplete`
			);
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it('steps the validity in hours and opens a list on the field', async () => {
			open();
			toggle(`${KEYS}.withAppointment`);
			await click(`${KEYS}.validity.more`);
			await click(`${KEYS}.validity.more`);
			expect(
				screen.getByRole('button', { name: /validity\.label/ })
					.textContent
			).toContain(`${KEYS}.validity.hours:26`);
			await click(`${KEYS}.validity.less`);

			fireEvent.click(
				screen.getByRole('button', { name: /validity\.label/ })
			);
			const list = screen.getByRole('listbox');
			fireEvent.click(
				within(list).getByRole('option', {
					name: `${KEYS}.validity.minutes:30`
				})
			);
			await click(`${KEYS}.createAction`);

			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					link: expect.objectContaining({ validityMinutes: 30 })
				})
			);
		});

		it('disables the steppers at both ends', async () => {
			open({ initial: { validityMinutes: 2880 } });
			toggle(`${KEYS}.withAppointment`);
			expect(
				(
					screen.getByRole('button', {
						name: `${KEYS}.validity.more`
					}) as HTMLButtonElement
				).disabled
			).toBe(true);
		});

		it('sends the chosen access and the knock switch', async () => {
			open();
			fireEvent.click(
				screen.getByRole('button', { name: `${KEYS}.access.accounts` })
			);
			toggle(`${KEYS}.knock`);
			await click(`${KEYS}.createAction`);

			expect(onSubmit).toHaveBeenCalledWith({
				appointment: null,
				link: {
					validityMinutes: null,
					access: 'accounts',
					knock: false
				}
			});
		});
	});

	describe('Termin anlegen in a 1:1 conversation', () => {
		it('needs a date and invites nobody unless asked', async () => {
			open({ variant: 'appointment', allowGuestInvite: true });
			expect(
				screen.queryByRole('switch', { name: `${KEYS}.knock` })
			).toBeNull();
			setField('date', '2026-11-05');
			setTime('start', 9);
			setTime('end', 10);
			await click(`${SLOT}.createAction`);

			expect(onSubmit).toHaveBeenCalledWith({
				appointment: { start: local(5, 9), end: local(5, 10) },
				link: null
			});
		});

		it('adds the link settings when more people are invited', async () => {
			open({ variant: 'appointment', allowGuestInvite: true });
			toggle(`${KEYS}.inviteOthers`);
			fireEvent.click(
				screen.getByRole('button', { name: `${KEYS}.access.guests` })
			);
			await click(`${SLOT}.createAction`);

			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					link: {
						validityMinutes: 1440,
						access: 'guests',
						knock: true
					}
				})
			);
		});

		it('hides the invite section where it is not offered', () => {
			open({ variant: 'appointment' });
			expect(
				screen.queryByRole('switch', { name: `${KEYS}.inviteOthers` })
			).toBeNull();
		});
	});

	it('shows an error from the caller and waits while saving', () => {
		open({ error: 'failed', saving: true });
		expect(screen.getByRole('alert').textContent).toBe('failed');
		expect(
			(
				screen.getByRole('button', {
					name: `${KEYS}.createAction`
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
	});
});
