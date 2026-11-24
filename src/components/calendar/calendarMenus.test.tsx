// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CalendarEntry } from './calendarModel';
import {
	EdgeMenuContent,
	EntryMenuContent,
	MonthDayMenuContent,
	MoveForm,
	RequestMenuContent,
	SettingsMenuContent
} from './calendarMenus';

const i18n = vi.hoisted(() => ({ language: 'de' }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) =>
			values ? `${key} ${JSON.stringify(values)}` : key,
		i18n
	})
}));

afterEach(() => {
	cleanup();
	i18n.language = 'de';
});

const entry = (start: Date, end: Date): CalendarEntry => ({
	id: 'a1',
	type: 'appointment',
	start: start.toISOString(),
	end: end.toISOString(),
	ownerId: 'me'
});

const move = (shown: CalendarEntry, date?: string) => {
	const onSubmit = vi.fn();
	const { container } = render(
		<MoveForm
			entry={shown}
			mode="move"
			entries={[]}
			ownerId="me"
			onSubmit={onSubmit}
			onBack={() => undefined}
		/>
	);
	if (date)
		fireEvent.change(
			container.querySelector('input[type="date"]') as HTMLInputElement,
			{ target: { value: date } }
		);
	fireEvent.submit(
		container.querySelector(
			'[data-cy="calendar-move-form"]'
		) as HTMLFormElement
	);
	return onSubmit;
};

describe('MoveForm — the end date (review 4574775688)', () => {
	it('keeps an entry over two days as it is when saved unchanged', () => {
		const start = new Date(2026, 10, 16, 10);
		const end = new Date(2026, 10, 17, 11);
		expect(move(entry(start, end))).toHaveBeenCalledWith(start, end);
	});

	it('moves an entry over midnight as a whole', () => {
		const onSubmit = move(
			entry(new Date(2026, 10, 16, 23), new Date(2026, 10, 17, 1)),
			'2026-11-20'
		);
		expect(onSubmit).toHaveBeenCalledWith(
			new Date(2026, 10, 20, 23),
			new Date(2026, 10, 21, 1)
		);
	});
});

describe('MoveForm — a reason with the proposal (US#1663)', () => {
	const shown = entry(new Date(2026, 10, 16, 10), new Date(2026, 10, 16, 11));
	const form = (mode: 'move' | 'propose') => {
		const onSubmit = vi.fn();
		const view = render(
			<MoveForm
				entry={shown}
				mode={mode}
				entries={[]}
				ownerId="me"
				onSubmit={onSubmit}
				onBack={() => undefined}
			/>
		);
		const submit = () =>
			fireEvent.submit(
				view.container.querySelector(
					'[data-cy="calendar-move-form"]'
				) as HTMLFormElement
			);
		return { ...view, onSubmit, submit };
	};

	it('sends the trimmed reason with a proposal, at most 500 characters', () => {
		const { container, onSubmit, submit } = form('propose');
		const reason = container.querySelector(
			'[data-cy="calendar-move-reason"]'
		) as HTMLTextAreaElement;
		expect(reason.maxLength).toBe(500);
		fireEvent.change(reason, { target: { value: '  Raum belegt ' } });
		submit();
		expect(onSubmit).toHaveBeenCalledWith(
			new Date(shown.start),
			new Date(shown.end),
			'Raum belegt'
		);
	});

	it('sends no reason when the field stays empty', () => {
		const { onSubmit, submit } = form('propose');
		submit();
		expect(onSubmit).toHaveBeenCalledWith(
			new Date(shown.start),
			new Date(shown.end)
		);
	});

	it('asks for no reason when one moves an own entry', () => {
		const { container } = form('move');
		expect(
			container.querySelector('[data-cy="calendar-move-reason"]')
		).toBeNull();
	});
});

describe('RequestMenuContent — the reason (US#1663)', () => {
	const proposal = {
		id: 'p1',
		entryId: 'a1',
		start: new Date(2026, 10, 18, 14).toISOString(),
		end: new Date(2026, 10, 18, 15).toISOString(),
		proposerName: 'A. Kaya'
	};
	const from = { start: proposal.start, end: proposal.end };

	it('shows the reason above the answers', () => {
		const { container } = render(
			<RequestMenuContent
				proposal={{ ...proposal, reason: 'Raum belegt' }}
				from={from}
			/>
		);
		expect(
			container.querySelector('[data-cy="calendar-request-reason"]')
				?.textContent
		).toContain('Raum belegt');
	});

	it('shows no reason line without one', () => {
		const { container } = render(
			<RequestMenuContent proposal={proposal} from={from} />
		);
		expect(
			container.querySelector('[data-cy="calendar-request-reason"]')
		).toBeNull();
	});
});

describe('menu dates in the app language (review 4574981864)', () => {
	// Monday 16 November 2026.
	const monday = new Date(2026, 10, 16);

	it('names the grip day in French on a French page', () => {
		i18n.language = 'fr';
		const { container } = render(
			<EdgeMenuContent
				edge="end"
				day={monday}
				from="17:00"
				to="18:00"
				remember={false}
				onRemember={() => undefined}
				onChoose={() => undefined}
			/>
		);
		expect(container.textContent).toContain('lundi 16 novembre 2026');
		expect(container.textContent).not.toMatch(/Montag|Monday/);
	});

	it('names the month day in Turkish on a Turkish page', () => {
		i18n.language = 'tr';
		const { container } = render(
			<MonthDayMenuContent
				start={monday}
				days={1}
				onAllDay={() => undefined}
				onWithTime={() => undefined}
				onAppointment={() => undefined}
			/>
		);
		expect(container.textContent).toContain('Kasım');
		expect(container.textContent).not.toMatch(/November/);
	});
});

const cyOrder = (container: HTMLElement) =>
	[...container.querySelectorAll('[data-cy]')].map((el) =>
		el.getAttribute('data-cy')
	);

describe('entry menu — head and actions, prototype v17 (#118, #119)', () => {
	const appointment: CalendarEntry = {
		...entry(new Date(2026, 10, 16, 9), new Date(2026, 10, 16, 10)),
		kind: 'video',
		title: 'mutige_eule'
	};
	const open = (shown: CalendarEntry, props = {}) =>
		render(
			<EntryMenuContent
				entry={shown}
				actions={['start', 'chat', 'move', 'cancel']}
				mode="list"
				entries={[]}
				ownerId="me"
				onMode={() => undefined}
				onAction={() => undefined}
				onMove={() => undefined}
				{...props}
			/>
		);

	it('shows the person in their tone, the kind as a tag and "Sie und <Name>"', () => {
		const { container } = open(appointment);
		const avatar = container.querySelector('.calendarMenu__avatar');
		expect(avatar?.className).toMatch(/calAvatar--tone-\d/);
		expect(avatar?.textContent).toBe('ME');
		expect(container.querySelector('.calendarMenu__tag')?.textContent).toBe(
			'calendar.nouns.video'
		);
		const who = container.querySelector('[data-cy="calendar-entry-who"]');
		expect(who?.textContent).toContain(
			'calendar.entryMenu.withYou {"name":"mutige_eule"}'
		);
		expect(who?.querySelector('.calAvatar--me')).not.toBeNull();
	});

	it('says under each action what it does', () => {
		const { container } = open(appointment);
		const sub = (action: string) =>
			container.querySelector(
				`[data-cy="calendar-entry-${action}"] .chatMenuDropdown__itemDescription`
			)?.textContent;
		expect(sub('start')).toBe(
			'calendar.entryMenu.startSub {"name":"mutige_eule"}'
		);
		expect(sub('chat')).toBe(
			'calendar.entryMenu.chatSub {"name":"mutige_eule"}'
		);
		expect(sub('move')).toBe('calendar.entryMenu.moveSub');
		expect(sub('cancel')).toBe(
			'calendar.entryMenu.cancelSub {"name":"mutige_eule"}'
		);
	});

	it('names who confirms a proposal on a colleague\'s entry, without "Sie und"', () => {
		const { container } = open(
			{ ...appointment, ownerId: 'kaya' },
			{
				actions: ['propose'],
				colleague: { id: 'kaya', displayName: 'A. Kaya' }
			}
		);
		expect(
			container.querySelector(
				'[data-cy="calendar-entry-propose"] .chatMenuDropdown__itemDescription'
			)?.textContent
		).toBe('calendar.entryMenu.proposeSub {"name":"A. Kaya"}');
		expect(
			container.querySelector('[data-cy="calendar-entry-who"]')
		).toBeNull();
	});

	it('leads a blocker with its kind instead of a person', () => {
		const { container } = open(
			{
				...entry(new Date(2026, 10, 16, 9), new Date(2026, 10, 16, 10)),
				type: 'blocker'
			},
			{ actions: ['remove'] }
		);
		expect(container.querySelector('.calendarMenu__avatar')).toBeNull();
		expect(container.querySelector('.calendarMenu__kdot')).not.toBeNull();
		expect(container.querySelector('.calendarMenu__tag')?.textContent).toBe(
			'calendar.nouns.blocker'
		);
		expect(
			container.querySelector('[data-cy="calendar-entry-who"]')
		).toBeNull();
	});
});

describe('⋮ settings — order of prototype v17 (#122)', () => {
	it('sets up first, then "Ansicht wählen" with sub-lines and the check on the right', () => {
		const onRepeatBlocker = vi.fn();
		const { container } = render(
			<SettingsMenuContent
				workingHoursSummary="Mo–Fr 08:00–18:00"
				switcherStyle="digits"
				onWorkingHours={() => undefined}
				onRepeatBlocker={onRepeatBlocker}
				onFreeDays={() => undefined}
				onSync={() => undefined}
				rememberedEdge="day"
				onForgetEdge={() => undefined}
				onSwitcherStyle={() => undefined}
				showGrips
				onShowGrips={() => undefined}
			/>
		);
		expect(cyOrder(container)).toEqual([
			'calendar-settings-working-hours',
			'calendar-settings-grips',
			'calendar-settings-repeat-blocker',
			'calendar-settings-free-days',
			'calendar-settings-sync',
			'calendar-settings-forget-edge',
			'calendar-settings-switcher-menu',
			'calendar-settings-switcher-digits'
		]);
		const digits = container.querySelector(
			'[data-cy="calendar-settings-switcher-digits"]'
		) as HTMLElement;
		expect(digits.getAttribute('aria-checked')).toBe('true');
		expect(
			digits.querySelector('.chatMenuDropdown__itemDescription')
				?.textContent
		).toBe('calendar.settings.switcherDigitsSub');
		expect(digits.querySelector('kbd svg')).not.toBeNull();
		expect(
			container.querySelector(
				'[data-cy="calendar-settings-switcher-menu"] kbd svg'
			)
		).toBeNull();
		fireEvent.click(
			container.querySelector(
				'[data-cy="calendar-settings-repeat-blocker"]'
			) as HTMLElement
		);
		expect(onRepeatBlocker).toHaveBeenCalled();
	});
});

describe('⋮ settings — Sprechstunden (FE#2287)', () => {
	it('offers them right after the working hours, with their summary', () => {
		const onConsultationHours = vi.fn();
		const { container } = render(
			<SettingsMenuContent
				workingHoursSummary="Mo–Fr 08:00–18:00"
				consultationHoursSummary="Di 09:00–12:00"
				switcherStyle="digits"
				onWorkingHours={() => undefined}
				onConsultationHours={onConsultationHours}
				onSwitcherStyle={() => undefined}
			/>
		);
		expect(cyOrder(container).slice(0, 2)).toEqual([
			'calendar-settings-working-hours',
			'calendar-settings-consultation-hours'
		]);
		const item = container.querySelector(
			'[data-cy="calendar-settings-consultation-hours"]'
		) as HTMLElement;
		expect(
			item.querySelector('.chatMenuDropdown__itemDescription')
				?.textContent
		).toBe('Di 09:00–12:00');
		fireEvent.click(item);
		expect(onConsultationHours).toHaveBeenCalled();
	});

	it('says when none are set', () => {
		const { container } = render(
			<SettingsMenuContent
				switcherStyle="digits"
				onConsultationHours={() => undefined}
				onSwitcherStyle={() => undefined}
			/>
		);
		expect(
			container.querySelector(
				'[data-cy="calendar-settings-consultation-hours"] .chatMenuDropdown__itemDescription'
			)?.textContent
		).toBe('calendar.consultationHours.none');
	});
});
