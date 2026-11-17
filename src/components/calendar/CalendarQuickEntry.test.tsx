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

describe('QuickEntry — a slow first save shows progress (test finding C13)', () => {
	it('says "saving" with a spinner until the entry exists', async () => {
		let done: (value: boolean) => void = () => undefined;
		open(() => new Promise<boolean>((resolve) => (done = resolve)));
		fireEvent.change(input(), {
			target: { value: 'morgen 14 Uhr Video ruhiges' }
		});
		await submit();
		const save = document.querySelector(
			'[data-cy="calendar-quick-save"]'
		) as HTMLButtonElement;
		expect(save.getAttribute('aria-busy')).toBe('true');
		expect(save.textContent).toBe('calendar.quick.saving');
		expect(save.querySelector('[role="progressbar"]')).not.toBeNull();
		await act(async () => done(true));
		expect(save.getAttribute('aria-busy')).toBe('false');
		expect(save.textContent).toBe('calendar.quick.save');
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
		// "Still missing: who" (the stub translation shows the key), with
		// the range already set in bold.
		const status = document.querySelector('#calendar-quick-status');
		expect(status?.textContent).toMatch(/^calendar\.quick\.missing /);
		expect(status?.querySelector('strong')).not.toBeNull();
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
			onShowEntry={() => undefined}
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

describe('QuickEntry — a typed range stays whole (test C2)', () => {
	it('saves 9:00–12:30 as typed and names the length', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		open(onCreate);
		fireEvent.change(input(), {
			target: { value: '2.12. 9-12:30 Sperrzeit' }
		});
		expect(
			screen.getByRole('combobox', { name: 'calendar.quick.duration' })
				.textContent
		).toBe('calendar.quick.lengthBoth');
		await submit();
		expect(onCreate).toHaveBeenCalledWith([
			expect.objectContaining({
				type: 'blocker',
				start: new Date(2026, 11, 2, 9),
				end: new Date(2026, 11, 2, 12, 30)
			})
		]);
	});
});

describe('QuickEntry — the kinds lead the box (Frank *5.1)', () => {
	it('puts the five kind chips first, in one group above the line', () => {
		open(vi.fn());
		const form = document.querySelector('.calendarQuick__form')!;
		const first = form.firstElementChild as HTMLElement;
		expect(first.className).toBe('calendarQuick__kinds');
		expect(
			first.querySelectorAll('[data-cy^="calendar-quick-kind-"]')
		).toHaveLength(5);
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

describe('QuickEntry — its own box, as in prototype v17', () => {
	const WEEK = [1, 2, 3, 4, 5].map((weekday) => ({
		weekday,
		start: '08:00',
		end: '18:00'
	}));
	const status = () =>
		document.querySelector('#calendar-quick-status') as HTMLElement;
	const quick = () =>
		document.querySelector('[data-cy="calendar-quick"]') as HTMLElement;
	const box = () =>
		render(
			<QuickEntry
				ownerId="me"
				now={NOW}
				entries={[]}
				conversations={CONVERSATIONS}
				workingHours={WEEK}
				onCreate={() => undefined}
			/>
		);

	it('has no heading of its own', () => {
		box();
		expect(quick().querySelector('h2')).toBeNull();
		expect(quick().getAttribute('aria-label')).toBe('calendar.quick.title');
	});

	it('rests until it is used: no status, people or buttons', () => {
		box();
		expect(quick().classList).toContain('calendarQuick--idle');
		fireEvent.focus(input());
		expect(quick().classList).not.toContain('calendarQuick--idle');
		fireEvent.blur(input());
		expect(quick().classList).toContain('calendarQuick--idle');
		// Once something is typed it stays open.
		fireEvent.change(input(), { target: { value: 'morgen' } });
		expect(quick().classList).not.toContain('calendarQuick--idle');
	});

	it('says what it will be, in bold, and warns outside the working hours', () => {
		box();
		fireEvent.change(input(), {
			target: { value: 'morgen 14 Uhr Video ruhiges' }
		});
		expect(status().classList).toContain('calendarQuick__status--ready');
		expect(status().textContent).toContain('calendar.quick.ready');
		expect(status().querySelector('strong')).not.toBeNull();
		expect(
			status().querySelector('[data-cy="calendar-quick-outside"]')
		).toBeNull();
		fireEvent.change(input(), {
			target: { value: 'morgen 20 Uhr Video ruhiges' }
		});
		expect(
			status().querySelector('[data-cy="calendar-quick-outside"]')
				?.textContent
		).toBe(' · calendar.quick.outsideHours');
	});

	it('offers up to five people with their avatars while "with whom" is open', () => {
		render(
			<QuickEntry
				ownerId="me"
				now={NOW}
				entries={[]}
				conversations={Array.from({ length: 7 }, (_, i) => ({
					sessionId: 5000 + i,
					username: `person_${i}`
				}))}
				workingHours={WEEK}
				onCreate={() => undefined}
			/>
		);
		fireEvent.change(input(), { target: { value: 'morgen 14 Uhr Video' } });
		const people = document.querySelectorAll('.calendarQuick__person');
		expect(people).toHaveLength(5);
		const avatar = people[0].querySelector('.calendarQuick__personAvatar');
		expect(avatar?.textContent).toBe('P0');
		expect(avatar?.className).toMatch(/calAvatar--tone-\d/);
	});

	it('names the lengths as in the prototype', async () => {
		box();
		fireEvent.mouseDown(
			screen.getByRole('combobox', { name: 'calendar.quick.duration' })
		);
		const lengths = await screen.findAllByRole('option');
		expect(lengths.map((o) => o.textContent)).toEqual([
			'calendar.quick.lengths.30',
			'calendar.quick.lengths.45',
			'calendar.quick.lengths.60',
			'calendar.quick.lengths.90',
			'calendar.quick.lengths.120'
		]);
	});
});

describe('QuickEntry — each line is read fresh (test finding C3)', () => {
	it('drops the conversation and length the previous line named', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		open(onCreate);
		fireEvent.change(input(), {
			target: { value: 'morgen 14-15:30 Video ruhiges' }
		});
		// A new line that names neither: no conversation, the default length.
		fireEvent.change(input(), { target: { value: 'Do 14 Uhr Sperrzeit' } });
		await submit();
		expect(onCreate).toHaveBeenCalledWith([
			expect.objectContaining({
				type: 'blocker',
				start: new Date(2026, 10, 19, 14),
				end: new Date(2026, 10, 19, 15)
			})
		]);
	});
});
