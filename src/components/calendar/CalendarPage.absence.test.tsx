// @vitest-environment oriso-jsdom
/**
 * ORISO-Frontend#2303: "Neu" → "Abwesenheit" sets the planned absence the
 * profile holds; the dialog closes once it is stored.
 */
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import dayjs, { type Dayjs } from 'dayjs';
import { CalendarPage } from './CalendarPage';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
vi.mock('../form/OrisoDatePicker', () => ({
	OrisoDatePicker: ({
		label,
		value,
		onChange
	}: {
		label: string;
		value: Dayjs | null;
		onChange?: (value: Dayjs | null) => void;
	}) => (
		<input
			aria-label={label}
			value={value ? value.format('YYYY-MM-DD') : ''}
			onChange={(e) =>
				onChange?.(e.target.value ? dayjs(e.target.value) : null)
			}
		/>
	)
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

const page = (props: Partial<React.ComponentProps<typeof CalendarPage>>) =>
	render(
		<CalendarPage
			role="consultant"
			ownerId="me"
			now={new Date(2026, 10, 16, 9, 50)}
			entries={[]}
			initialView="week"
			onCreate={() => Promise.resolve()}
			{...props}
		/>
	);

const openNew = () =>
	fireEvent.click(
		document.querySelector('[data-cy="calendar-create"]') as HTMLElement
	);

describe('CalendarPage — planned absence from "Neuer Eintrag" (#2303)', () => {
	it('stores the absence and closes the dialog', async () => {
		const onSaveAbsence = vi.fn(() => Promise.resolve());
		page({ onSaveAbsence });
		openNew();
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-new-tab-absence"]'
			) as HTMLElement
		);
		fireEvent.change(screen.getByLabelText('calendar.absence.from'), {
			target: { value: '2026-12-21' }
		});
		fireEvent.change(screen.getByLabelText('calendar.absence.until'), {
			target: { value: '2027-01-03' }
		});
		fireEvent.click(screen.getByTestId('calendar-absence-save'));
		expect(onSaveAbsence).toHaveBeenCalledWith({
			start: '2026-12-21',
			end: '2027-01-03',
			message: ''
		});
		await waitFor(() =>
			expect(screen.queryByTestId('calendar-absence-dialog')).toBeNull()
		);
	});

	it('offers no absence tab without a way to store it', () => {
		page({});
		openNew();
		expect(
			document.querySelector('[data-cy="calendar-new-tab-absence"]')
		).toBeNull();
	});
});
