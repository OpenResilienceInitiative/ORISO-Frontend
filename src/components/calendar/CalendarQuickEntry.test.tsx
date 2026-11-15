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
import { CalendarSidebar, QuickEntry } from './CalendarSidebar';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

// Monday 16 November 2026, 09:50.
const NOW = new Date(2026, 10, 16, 9, 50);
const CONVERSATIONS = [
	{ sessionId: 4401, username: 'ruhiges_yak' },
	{ sessionId: 4402, username: 'mutige_eule' }
];

const open = (onCreate: React.ComponentProps<typeof QuickEntry>['onCreate']) =>
	render(
		<QuickEntry
			ownerId="me"
			now={NOW}
			entries={[]}
			conversations={CONVERSATIONS}
			workingHours={[]}
			onCreate={onCreate}
		/>
	);

const input = () =>
	document.querySelector<HTMLInputElement>(
		'[data-cy="calendar-quick-input"]'
	) as HTMLInputElement;
const submit = () =>
	act(async () => {
		fireEvent.submit(input().form as HTMLFormElement);
	});

describe('QuickEntry — the draft until it is created (review 4574775715)', () => {
	it('keeps the line when creating fails', async () => {
		const onCreate = vi.fn(() => Promise.reject(new Error('500')));
		open(onCreate);
		fireEvent.change(input(), {
			target: { value: 'morgen 14 Uhr Video ruhiges' }
		});
		await submit();
		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(input().value).toBe('morgen 14 Uhr Video ruhiges');
	});

	it('clears the line once the entry exists', async () => {
		open(() => Promise.resolve());
		fireEvent.change(input(), {
			target: { value: 'morgen 14 Uhr Video ruhiges' }
		});
		await submit();
		expect(input().value).toBe('');
	});
});

describe('QuickEntry — conversation named in the line (review 4574779936)', () => {
	it('replaces an earlier pick with the conversation the line names', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		open(onCreate);
		fireEvent.change(input(), { target: { value: 'morgen 14 Uhr Video' } });
		fireEvent.click(screen.getByText('ruhiges_yak'));
		fireEvent.change(input(), {
			target: { value: 'morgen 14 Uhr Video mutige' }
		});
		await submit();
		expect(onCreate).toHaveBeenCalledWith([
			expect.objectContaining({ sessionId: 4402 })
		]);
	});

	it('keeps the pick while the line names nobody', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		open(onCreate);
		fireEvent.change(input(), { target: { value: 'morgen 14 Uhr Video' } });
		fireEvent.click(screen.getByText('ruhiges_yak'));
		fireEvent.change(input(), { target: { value: 'morgen 15 Uhr Video' } });
		await submit();
		expect(onCreate).toHaveBeenCalledWith([
			expect.objectContaining({ sessionId: 4401 })
		]);
	});
});

describe('QuickEntry — a name that fits several conversations (review 4575297354)', () => {
	it('drops the earlier pick, so it cannot be saved for the wrong person', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		render(
			<QuickEntry
				ownerId="me"
				now={NOW}
				entries={[]}
				conversations={[
					...CONVERSATIONS,
					{ sessionId: 4403, username: 'kluge_eule' }
				]}
				workingHours={[]}
				onCreate={onCreate}
			/>
		);
		fireEvent.change(input(), {
			target: { value: 'morgen 10 video mutige_eule' }
		});
		fireEvent.change(input(), {
			target: { value: 'morgen 10 video eule' }
		});
		await submit();
		expect(onCreate).not.toHaveBeenCalled();
		// "Still missing: who" (the stub translation shows the key).
		expect(
			document.querySelector('#calendar-quick-status')?.textContent
		).toBe('calendar.quick.missing');
	});
});

describe('QuickEntry — while creating (reviews 4575297363, 4575297365)', () => {
	const deferred = () => {
		let resolve: () => void = () => undefined;
		const promise = new Promise<void>((r) => {
			resolve = r;
		});
		return { promise, resolve };
	};
	const save = () =>
		document.querySelector<HTMLButtonElement>(
			'[data-cy="calendar-quick-save"]'
		) as HTMLButtonElement;

	it('creates once and keeps Save off until the request settles', async () => {
		const running = deferred();
		const onCreate = vi.fn(() => running.promise);
		open(onCreate);
		fireEvent.change(input(), {
			target: { value: 'morgen 14 Uhr Video ruhiges' }
		});
		await submit();
		await submit();
		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(save().disabled).toBe(true);
		await act(async () => running.resolve());
		expect(input().value).toBe('');
	});

	it('keeps a line typed while the earlier one was being created', async () => {
		const running = deferred();
		open(() => running.promise);
		fireEvent.change(input(), {
			target: { value: 'morgen 14 Uhr Video ruhiges' }
		});
		await submit();
		fireEvent.change(input(), {
			target: { value: 'morgen 16 Uhr Video mutige' }
		});
		await act(async () => running.resolve());
		expect(input().value).toBe('morgen 16 Uhr Video mutige');
	});
});

describe('CalendarSidebar — folding quick entry on the phone (review 4574981879)', () => {
	const sidebar = (quickOpen: boolean) => (
		<CalendarSidebar
			ownerId="me"
			consultant
			now={NOW}
			entries={[]}
			colleagues={[]}
			conversations={CONVERSATIONS}
			workingHours={[]}
			onlyFacets={[]}
			hiddenFacets={[]}
			onToggleFacet={() => undefined}
			onHighlightFacet={() => undefined}
			kindsMenuOpen={false}
			onOpenKinds={() => undefined}
			openProposals={[]}
			onOpenEntry={() => undefined}
			shownColleagues={[]}
			onCreate={() => undefined}
			variant="sheet"
			quickOpen={quickOpen}
			onQuickToggle={() => undefined}
		/>
	);

	it('keeps the draft when quick entry is folded and opened again', () => {
		const { rerender } = render(sidebar(true));
		fireEvent.change(input(), { target: { value: 'morgen 14 Uhr' } });
		rerender(sidebar(false));
		expect(
			(document.getElementById('calendar-quick-panel') as HTMLElement)
				.hidden
		).toBe(true);
		rerender(sidebar(true));
		expect(input().value).toBe('morgen 14 Uhr');
	});
});

describe('QuickEntry — Tag, Beginn, Dauer under the line (Frank, prototype v15)', () => {
	it('saves the day, start and length picked in the date, time and duration fields', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		open(onCreate);
		const day = screen.getByRole('textbox', {
			name: 'calendar.quick.date'
		});
		fireEvent.change(day, { target: { value: '19.11.2026' } });
		fireEvent.blur(day);
		const start = screen.getByRole('textbox', {
			name: 'calendar.quick.time'
		});
		fireEvent.change(start, { target: { value: '14:00' } });
		fireEvent.blur(start);
		fireEvent.mouseDown(
			screen.getByRole('combobox', { name: 'calendar.quick.duration' })
		);
		const lengths = await screen.findAllByRole('option');
		// 30, 45, 60, 90 and 120 minutes, as in the prototype.
		expect(lengths).toHaveLength(5);
		fireEvent.click(lengths[4]);
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-quick-kind-blocker"]'
			) as HTMLElement
		);
		await submit();
		expect(onCreate).toHaveBeenCalledWith([
			{
				type: 'blocker',
				start: new Date(2026, 10, 19, 14, 0),
				end: new Date(2026, 10, 19, 16, 0)
			}
		]);
	});

	it('shows the line as the same outlined field, with Tag right under it', () => {
		open(() => Promise.resolve());
		expect(input().classList).toContain('MuiOutlinedInput-input');
		const when = input().closest('.MuiFormControl-root')
			?.nextElementSibling as HTMLElement;
		expect(when.className).toBe('calendarQuick__when');
		// Tag first (its own row), then Beginn and Dauer.
		expect(
			Array.from(when.children).map((c) => c.getAttribute('data-cy'))
		).toEqual([
			'calendar-quick-date',
			'calendar-quick-time',
			'calendar-quick-duration'
		]);
	});

	it('fills the fields from what the line names', () => {
		open(() => Promise.resolve());
		fireEvent.change(input(), { target: { value: 'Do 14 Uhr' } });
		expect(
			screen.getByRole<HTMLInputElement>('textbox', {
				name: 'calendar.quick.date'
			}).value
		).toBe('19.11.2026');
		expect(
			screen.getByRole<HTMLInputElement>('textbox', {
				name: 'calendar.quick.time'
			}).value
		).toBe('14:00');
	});
});

describe('QuickEntry — next free hours only when this week is known (review 4576313283)', () => {
	const WEEK = [1, 2, 3, 4, 5].map((weekday) => ({
		weekday,
		start: '08:00',
		end: '18:00'
	}));
	const pills = () =>
		document.querySelectorAll('[data-cy="calendar-quick-free"]');
	const quick = (
		freeHours: React.ComponentProps<typeof QuickEntry>['freeHours'],
		onRetryFreeHours?: () => void
	) =>
		render(
			<QuickEntry
				ownerId="me"
				now={NOW}
				entries={[]}
				conversations={CONVERSATIONS}
				workingHours={WEEK}
				onCreate={() => undefined}
				freeHours={freeHours}
				onRetryFreeHours={onRetryFreeHours}
			/>
		);

	it('offers free hours once this week is loaded', () => {
		quick('ready');
		expect(pills().length).toBeGreaterThan(0);
	});

	it('offers none while this week is loading', () => {
		quick('loading');
		expect(pills()).toHaveLength(0);
		expect(screen.getByText('calendar.quick.freeLoading')).toBeTruthy();
	});

	it('offers none when this week did not load, with a retry', () => {
		const onRetryFreeHours = vi.fn();
		quick('failed', onRetryFreeHours);
		expect(pills()).toHaveLength(0);
		expect(screen.getByText('calendar.quick.freeUnavailable')).toBeTruthy();
		fireEvent.click(
			screen.getByRole('button', { name: 'calendar.error.retry' })
		);
		expect(onRetryFreeHours).toHaveBeenCalledTimes(1);
	});
});
