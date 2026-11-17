// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { BlockerDialog } from './BlockerDialog';
import {
	MAX_BLOCKER_OCCURRENCES,
	type AppointmentDraft,
	type CalendarEntry
} from './calendarModel';

dayjs.extend(customParseFormat);

const i18n = vi.hoisted(() => ({ language: 'de' }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) =>
			options?.count === undefined ? key : `${key}#${options.count}`,
		i18n
	})
}));

/* The dial and calendar have their own tests: here they only hand over a value. */
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

afterEach(() => {
	cleanup();
	i18n.language = 'de';
});

const NOW = new Date(2026, 10, 14, 12, 0);

const open = (
	slot?: { start: Date; end: Date },
	onSave: (drafts: AppointmentDraft[]) => void = () => undefined,
	now = NOW
) =>
	render(
		<BlockerDialog
			open
			slot={slot}
			entries={[]}
			ownerId="me"
			now={now}
			onSave={onSave}
			onClose={() => undefined}
		/>
	);

const save = () => screen.getByTestId('calendar-blocker-save');

describe('BlockerDialog — date span of the selection', () => {
	it('keeps the end date of a slot that runs over several days', () => {
		const onSave = vi.fn();
		open(
			{
				start: new Date(2026, 10, 16, 8),
				end: new Date(2026, 10, 18, 12)
			},
			onSave
		);
		fireEvent.click(save());
		const [[drafts]] = onSave.mock.calls;
		expect(drafts).toHaveLength(1);
		expect(drafts[0].start).toEqual(new Date(2026, 10, 16, 8));
		expect(drafts[0].end).toEqual(new Date(2026, 10, 18, 12));
	});

	it('keeps a slot from 23:00 to midnight', () => {
		const onSave = vi.fn();
		open(
			{
				start: new Date(2026, 10, 16, 23),
				end: new Date(2026, 10, 17, 0)
			},
			onSave
		);
		fireEvent.click(save());
		expect(onSave.mock.calls[0][0][0].end).toEqual(
			new Date(2026, 10, 17, 0)
		);
	});

	it('keeps a 23:00–midnight slot on its day when the end is edited (review 4577641942)', () => {
		const onSave = vi.fn();
		open(
			{
				start: new Date(2026, 10, 16, 23),
				end: new Date(2026, 10, 17, 0)
			},
			onSave
		);
		fireEvent.change(screen.getByLabelText('calendar.dialog.end'), {
			target: { value: '23:45' }
		});
		fireEvent.click(save());
		const [[drafts]] = onSave.mock.calls;
		expect(drafts).toHaveLength(1);
		expect(drafts[0].start).toEqual(new Date(2026, 10, 16, 23));
		expect(drafts[0].end).toEqual(new Date(2026, 10, 16, 23, 45));
	});

	it('blocks only the day of a 23:00–midnight slot when made all-day', () => {
		const onSave = vi.fn();
		open(
			{
				start: new Date(2026, 10, 16, 23),
				end: new Date(2026, 10, 17, 0)
			},
			onSave
		);
		fireEvent.click(
			screen.getByRole('switch', { name: 'calendar.blocker.allDay' })
		);
		fireEvent.click(save());
		const [[drafts]] = onSave.mock.calls;
		expect(drafts).toHaveLength(1);
		expect(drafts[0].start).toEqual(new Date(2026, 10, 16));
		expect(drafts[0].end).toEqual(new Date(2026, 10, 16, 23, 59, 59, 999));
	});

	it('turns a month selection of whole days into an all-day blocker', () => {
		const onSave = vi.fn();
		// Two days in the month view: 16 and 17 November, end exclusive.
		open(
			{ start: new Date(2026, 10, 16), end: new Date(2026, 10, 18) },
			onSave
		);
		expect(save().hasAttribute('disabled')).toBe(false);
		fireEvent.click(save());
		const draft = onSave.mock.calls[0][0][0];
		expect(draft.allDay).toBe(true);
		expect(draft.start).toEqual(new Date(2026, 10, 16));
		expect(draft.end).toEqual(new Date(2026, 10, 17, 23, 59, 59, 999));
	});
});

describe('BlockerDialog — incomplete fields', () => {
	it('does not save a cleared start time as midnight', () => {
		open();
		expect(save().hasAttribute('disabled')).toBe(false);
		fireEvent.change(screen.getByLabelText('calendar.dialog.start'), {
			target: { value: '' }
		});
		expect(save().hasAttribute('disabled')).toBe(true);
	});

	it('does not save a weekly series without its last day as one blocker', () => {
		open();
		fireEvent.click(
			within(
				screen.getByRole('group', { name: 'calendar.blocker.repeat' })
			).getAllByRole('button')[0]
		);
		expect(save().hasAttribute('disabled')).toBe(false);
		fireEvent.change(screen.getByLabelText('calendar.blocker.until'), {
			target: { value: '' }
		});
		expect(save().hasAttribute('disabled')).toBe(true);
	});

	it('refuses a series the occurrence bound would cut', () => {
		open();
		const repeat = within(
			screen.getByRole('group', { name: 'calendar.blocker.repeat' })
		).getAllByRole('button');
		repeat.forEach((chip) => fireEvent.click(chip));
		fireEvent.change(screen.getByLabelText('calendar.blocker.until'), {
			target: { value: '2027-06-30' }
		});
		expect(save().hasAttribute('disabled')).toBe(true);
		expect(screen.getByRole('status').textContent).toContain(
			'calendar.blocker.tooMany'
		);
		expect(MAX_BLOCKER_OCCURRENCES).toBe(120);
	});
});

describe('BlockerDialog — today and language', () => {
	it('allows an all-day blocker for today', () => {
		open({ start: new Date(2026, 10, 14), end: new Date(2026, 10, 15) });
		expect(save().hasAttribute('disabled')).toBe(false);
	});

	it('names the weekdays in the reader language', () => {
		i18n.language = 'fr';
		open();
		const chips = within(
			screen.getByRole('group', { name: 'calendar.blocker.repeat' })
		).getAllByRole('button');
		expect(chips[0].textContent).toBe('lun.');
	});
});

describe('BlockerDialog — a repeat the spring clock change skips (Europe/Berlin)', () => {
	const runnerZone = process.env.TZ;
	beforeAll(() => {
		process.env.TZ = 'Europe/Berlin';
	});
	afterAll(() => {
		if (runnerZone === undefined) delete process.env.TZ;
		else process.env.TZ = runnerZone;
	});

	it('refuses the series instead of saving a reversed range', () => {
		const onSave = vi.fn();
		// Sundays 21 and 28 March 2027; 02:30 does not exist on the 28th.
		open(
			{
				start: new Date(2027, 2, 21, 2, 30),
				end: new Date(2027, 2, 21, 3, 0)
			},
			onSave
		);
		fireEvent.click(
			within(
				screen.getByRole('group', { name: 'calendar.blocker.repeat' })
			).getAllByRole('button')[6]
		);
		fireEvent.change(screen.getByLabelText('calendar.blocker.until'), {
			target: { value: '2027-03-28' }
		});
		expect(save().hasAttribute('disabled')).toBe(true);
		expect(screen.getByRole('status').textContent).toContain(
			'calendar.blocker.clockGap'
		);
		fireEvent.click(save());
		expect(onSave).not.toHaveBeenCalled();
	});

	it('saves an occurrence that keeps a length after the gap, moved forward by it', () => {
		const onSave = vi.fn();
		// 02:30–04:00 on Sunday 28 March 2027 becomes 03:30–04:00.
		open(
			{
				start: new Date(2027, 2, 21, 2, 30),
				end: new Date(2027, 2, 21, 4, 0)
			},
			onSave
		);
		fireEvent.click(
			within(
				screen.getByRole('group', { name: 'calendar.blocker.repeat' })
			).getAllByRole('button')[6]
		);
		fireEvent.change(screen.getByLabelText('calendar.blocker.until'), {
			target: { value: '2027-03-28' }
		});
		expect(save().hasAttribute('disabled')).toBe(false);
		fireEvent.click(save());
		const [[drafts]] = onSave.mock.calls;
		expect(
			drafts.map((d: AppointmentDraft) => [
				d.start.toISOString(),
				d.end.toISOString()
			])
		).toEqual([
			['2027-03-21T01:30:00.000Z', '2027-03-21T03:00:00.000Z'],
			// 03:30 and 04:00 summer time.
			['2027-03-28T01:30:00.000Z', '2027-03-28T02:00:00.000Z']
		]);
	});

	it('looks for conflicts only in ranges that exist', () => {
		// The reversed 03:30–03:00 on the 28th would "overlap" this.
		const early: CalendarEntry = {
			id: 'e1',
			type: 'appointment',
			kind: 'video',
			title: 'mutige_eule',
			start: new Date(2027, 2, 28, 1, 30).toISOString(),
			end: new Date(2027, 2, 28, 4, 0).toISOString(),
			ownerId: 'me'
		};
		render(
			<BlockerDialog
				open
				slot={{
					start: new Date(2027, 2, 21, 2, 30),
					end: new Date(2027, 2, 21, 3, 0)
				}}
				entries={[early]}
				ownerId="me"
				now={NOW}
				onSave={() => undefined}
				onClose={() => undefined}
			/>
		);
		fireEvent.click(
			within(
				screen.getByRole('group', { name: 'calendar.blocker.repeat' })
			).getAllByRole('button')[6]
		);
		fireEvent.change(screen.getByLabelText('calendar.blocker.until'), {
			target: { value: '2027-03-28' }
		});
		expect(screen.getByRole('status').textContent).not.toContain(
			'calendar.blocker.conflicts'
		);
	});
});

describe('BlockerDialog — weekly and working hours (prototype v17)', () => {
	it('starts with the weekdays it was given', () => {
		render(
			<BlockerDialog
				open
				slot={{
					start: new Date(2026, 10, 16, 18),
					end: new Date(2026, 10, 16, 20)
				}}
				initialWeekdays={[1]}
				entries={[]}
				ownerId="me"
				now={NOW}
				onSave={() => undefined}
				onClose={() => undefined}
			/>
		);
		expect(
			document
				.querySelector('[data-cy="calendar-weekday-1"]')
				?.getAttribute('aria-pressed')
		).toBe('true');
		expect(screen.getByLabelText('calendar.blocker.until')).toBeTruthy();
	});

	it('keeps the all-day state and note of the blocker it repeats (review 4589527518)', () => {
		const onSave = vi.fn();
		render(
			<BlockerDialog
				open
				slot={{
					start: new Date(2026, 10, 16),
					end: new Date(2026, 10, 16, 23, 59, 59, 999)
				}}
				initialWeekdays={[1]}
				initialAllDay
				initialNote="Supervision"
				entries={[]}
				ownerId="me"
				now={NOW}
				onSave={onSave}
				onClose={() => undefined}
			/>
		);
		fireEvent.click(save());
		const drafts = onSave.mock.calls[0][0];
		expect(drafts.length).toBeGreaterThan(1);
		expect(drafts[0].allDay).toBe(true);
		expect(drafts[0].note).toBe('Supervision');
		expect(drafts[0].start).toEqual(new Date(2026, 10, 16));
		expect(drafts[0].end).toEqual(new Date(2026, 10, 16, 23, 59, 59, 999));
	});

	it('points to the working hours for the same times every week', () => {
		const onWorkingHours = vi.fn();
		render(
			<BlockerDialog
				open
				entries={[]}
				ownerId="me"
				now={NOW}
				onWorkingHours={onWorkingHours}
				onSave={() => undefined}
				onClose={() => undefined}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'calendar.workingHours.title' })
		);
		expect(onWorkingHours).toHaveBeenCalled();
	});
});
