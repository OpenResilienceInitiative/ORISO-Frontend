// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { WorkingHoursDialog } from './WorkingHoursDialog';
import type { WorkingHours } from './calendarWorkingHours';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

const open = (
	hours: WorkingHours,
	onSave: React.ComponentProps<typeof WorkingHoursDialog>['onSave'] = vi.fn()
) =>
	render(
		<WorkingHoursDialog
			open
			hours={hours}
			now={new Date(2026, 10, 16, 9)}
			onSave={onSave}
			onClose={() => undefined}
		/>
	);

const save = () => screen.getByTestId('calendar-working-hours-save');

describe('WorkingHoursDialog — the window limit (review 4575297370)', () => {
	// 14 windows already: three on Monday and Tuesday, two on Wednesday to
	// Saturday, Sunday off.
	const FULL: WorkingHours = [
		...[1, 2].flatMap((weekday) => [
			{ weekday, start: '08:00', end: '10:00' },
			{ weekday, start: '11:00', end: '13:00' },
			{ weekday, start: '14:00', end: '16:00' }
		]),
		...[3, 4, 5, 6].flatMap((weekday) => [
			{ weekday, start: '08:00', end: '12:00' },
			{ weekday, start: '13:00', end: '16:00' }
		])
	];

	it('refuses another day before the dialog closes, and says why', () => {
		const onSave = vi.fn();
		open(FULL, onSave);
		expect(save().hasAttribute('disabled')).toBe(false);
		fireEvent.click(screen.getByRole('switch', { name: 'Sonntag' }));
		expect(save().hasAttribute('disabled')).toBe(true);
		expect(
			screen
				.getAllByRole('alert')
				.some(
					(el) => el.textContent === 'calendar.workingHours.tooMany'
				)
		).toBe(true);
		fireEvent.click(save());
		expect(onSave).not.toHaveBeenCalled();
	});
});
