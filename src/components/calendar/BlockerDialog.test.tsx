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
import { BlockerDialog } from './BlockerDialog';
import { MAX_BLOCKER_OCCURRENCES, type AppointmentDraft } from './calendarModel';

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
			{ start: new Date(2026, 10, 16, 8), end: new Date(2026, 10, 18, 12) },
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
			{ start: new Date(2026, 10, 16, 23), end: new Date(2026, 10, 17, 0) },
			onSave
		);
		fireEvent.click(save());
		expect(onSave.mock.calls[0][0][0].end).toEqual(new Date(2026, 10, 17, 0));
	});

	it('turns a month selection of whole days into an all-day blocker', () => {
		const onSave = vi.fn();
		// Two days in the month view: 16 and 17 November, end exclusive.
		open({ start: new Date(2026, 10, 16), end: new Date(2026, 10, 18) }, onSave);
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
			within(screen.getByRole('group', { name: 'calendar.blocker.repeat' }))
				.getAllByRole('button')[0]
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
