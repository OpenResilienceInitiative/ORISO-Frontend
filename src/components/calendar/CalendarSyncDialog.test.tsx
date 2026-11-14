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
import { CalendarSyncDialog } from './CalendarSyncDialog';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

const URL = 'https://outlook.office365.com/owa/calendar/x/calendar.ics';

const open = (
	props: Partial<React.ComponentProps<typeof CalendarSyncDialog>> = {}
) =>
	render(
		<CalendarSyncDialog
			open
			feed={{ url: 'https://app.test/feed.ics' }}
			busyImport={{ host: 'outlook.office365.com' }}
			onCopyFeed={() => undefined}
			onResetFeed={() => undefined}
			onSaveImport={() => undefined}
			onRemoveImport={() => undefined}
			onClose={() => undefined}
			{...props}
		/>
	);

const field = () =>
	document.querySelector<HTMLInputElement>(
		'[data-cy="calendar-import-url"] input'
	) as HTMLInputElement;
const button = (attribute: string) =>
	document.querySelector<HTMLButtonElement>(
		`[data-cy="${attribute}"], [data-testid="${attribute}"]`
	) as HTMLButtonElement;

describe('CalendarSyncDialog — busy-time import', () => {
	it('keeps the private address when saving fails, so it can be sent again', async () => {
		let fail: (error: Error) => void = () => undefined;
		const onSaveImport = vi.fn(
			() =>
				new Promise<void>((_, reject) => {
					fail = reject;
				})
		);
		open({ onSaveImport });
		fireEvent.change(field(), { target: { value: URL } });
		fireEvent.click(button('calendar-import-save'));
		// No second request while the first is running.
		expect(button('calendar-import-save').disabled).toBe(true);
		await act(async () => fail(new Error('400')));
		expect(field().value).toBe(URL);
		expect(button('calendar-import-save').disabled).toBe(false);
		expect(screen.getByRole('alert').textContent).toBe(
			'calendar.saveFailed'
		);
	});

	it('clears the address once it is stored', async () => {
		open({ onSaveImport: () => Promise.resolve() });
		fireEvent.change(field(), { target: { value: URL } });
		await act(async () => {
			fireEvent.click(button('calendar-import-save'));
		});
		expect(field().value).toBe('');
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('says so when removing the import fails', async () => {
		open({ onRemoveImport: () => Promise.reject(new Error('500')) });
		await act(async () => {
			fireEvent.click(button('calendar-import-remove'));
		});
		expect(screen.getByRole('alert').textContent).toBe(
			'calendar.saveFailed'
		);
	});
});
