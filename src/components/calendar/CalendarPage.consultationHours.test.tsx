// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarPage } from './CalendarPage';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

if (typeof window.ResizeObserver === 'undefined')
	window.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;

afterEach(cleanup);

const NOW = new Date(2026, 10, 16, 9, 0);

describe('CalendarPage — Sprechstunden (FE#2287)', () => {
	it('opens them from ⋮ and hands the saved settings on', () => {
		const onSave = vi.fn();
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[]}
				consultationHours={{
					windows: [{ weekday: 2, start: '09:00', end: '12:00' }],
					autoAccept: true,
					noticeDays: 1,
					slotMinutes: 60
				}}
				onSaveConsultationHours={onSave}
			/>
		);
		fireEvent.click(
			document.querySelector('[data-cy="calendar-settings"]') as Element
		);
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-settings-consultation-hours"]'
			) as Element
		);
		expect(
			screen.getByTestId('calendar-consultation-hours-dialog')
		).toBeTruthy();
		fireEvent.mouseDown(
			screen.getByRole('combobox', {
				name: 'calendar.consultationHours.slotMinutes'
			})
		);
		fireEvent.click(screen.getAllByRole('option')[0]);
		fireEvent.click(screen.getByTestId('consultation-hours-save'));

		expect(onSave).toHaveBeenCalledWith({
			windows: [{ weekday: 2, start: '09:00', end: '12:00' }],
			autoAccept: true,
			noticeDays: 1,
			slotMinutes: 30
		});
	});

	it('stays open, its save held, until the save settles, and keeps the draft when it fails', async () => {
		let settle: (ok: boolean) => void = () => undefined;
		const onSave = vi.fn(
			() =>
				new Promise<void>((resolve, reject) => {
					settle = (ok) =>
						ok ? resolve() : reject(new Error('down'));
				})
		);
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[]}
				consultationHours={{
					windows: [{ weekday: 2, start: '09:00', end: '12:00' }],
					autoAccept: true,
					noticeDays: 1,
					slotMinutes: 60
				}}
				onSaveConsultationHours={onSave}
			/>
		);
		fireEvent.click(
			document.querySelector('[data-cy="calendar-settings"]') as Element
		);
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-settings-consultation-hours"]'
			) as Element
		);
		const save = () =>
			screen.getByTestId('consultation-hours-save') as HTMLButtonElement;
		fireEvent.click(save());

		// Pending: still open, and no second save on top of it.
		expect(
			screen.getByTestId('calendar-consultation-hours-dialog')
		).toBeTruthy();
		expect(save().disabled).toBe(true);

		// Failed: still open with the draft, ready to try again.
		await act(async () => settle(false));
		expect(save().disabled).toBe(false);
		fireEvent.click(save());
		expect(onSave).toHaveBeenCalledTimes(2);

		// Saved: closed.
		await act(async () => settle(true));
		expect(
			screen.queryByTestId('calendar-consultation-hours-dialog')
		).toBeNull();
	});

	it('says they failed to load and offers to load them again', () => {
		const onRetry = vi.fn();
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[]}
				consultationHoursFailed
				onRetryConsultationHours={onRetry}
				onSaveConsultationHours={() => undefined}
			/>
		);
		fireEvent.click(
			document.querySelector('[data-cy="calendar-settings"]') as Element
		);
		const item = document.querySelector(
			'[data-cy="calendar-settings-consultation-hours"]'
		) as HTMLElement;
		expect(item.textContent).toContain(
			'calendar.consultationHours.loadFailed'
		);
		fireEvent.click(item);
		expect(onRetry).toHaveBeenCalledTimes(1);
		expect(
			screen.queryByTestId('calendar-consultation-hours-dialog')
		).toBeNull();
	});

	it('offers nothing before they are loaded', () => {
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[]}
				onSaveConsultationHours={() => undefined}
			/>
		);
		fireEvent.click(
			document.querySelector('[data-cy="calendar-settings"]') as Element
		);
		expect(
			document.querySelector(
				'[data-cy="calendar-settings-consultation-hours"]'
			)
		).toBeNull();
	});
});
