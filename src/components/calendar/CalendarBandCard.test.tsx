// @vitest-environment oriso-jsdom
/**
 * A click on "2 von 4 belegt" opens a card: who is busy with what, who is
 * free, their calendars side by side, a move proposal, one's own entry at
 * that time (Frank *16.2, 2026-11-17).
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CalendarEntry, Colleague } from './calendarModel';
import {
	CalendarBandCard,
	type CalendarBandCardProps
} from './CalendarBandCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options ? `${key} ${JSON.stringify(options)}` : key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

const person = (id: string, displayName: string): Colleague => ({
	id,
	displayName,
	agencyName: 'Nord',
	agencyShort: 'BS-N',
	relation: 'sameAgency'
});
const KAYA = person('kaya', 'A. Kaya');
const NOWAK = person('nowak', 'P. Nowak');
const DEMIR = person('demir', 'E. Demir');
const at = (hour: number, minute = 0) =>
	new Date(2026, 10, 16, hour, minute).toISOString();
const KAYA_VIDEO: CalendarEntry = {
	id: 'k1',
	type: 'appointment',
	kind: 'video',
	title: 'frohe_amsel',
	ownerId: 'kaya',
	start: at(11),
	end: at(12)
};
const NOWAK_BLOCKER: CalendarEntry = {
	id: 'n1',
	type: 'blocker',
	ownerId: 'nowak',
	start: at(10, 30),
	end: at(12)
};
const BAND = {
	start: new Date(2026, 10, 16, 11),
	end: new Date(2026, 10, 16, 12),
	busy: ['kaya', 'nowak']
};

const Card = (props: Partial<CalendarBandCardProps>) => (
	<CalendarBandCard
		band={BAND}
		busy={[
			{ colleague: KAYA, entries: [KAYA_VIDEO] },
			{ colleague: NOWAK, entries: [NOWAK_BLOCKER] }
		]}
		free={[DEMIR]}
		moveActionOf={(entry) => (entry.id === 'k1' ? 'propose' : null)}
		onShowCalendar={vi.fn()}
		onMoveEntry={vi.fn()}
		onCreate={vi.fn()}
		onClose={vi.fn()}
		variant="side"
		{...props}
	/>
);

const card = () => screen.getByTestId('calendar-band-card');

describe('CalendarBandCard — who is busy in a band (Frank *16.2)', () => {
	it('names the stretch and how many are busy', () => {
		render(<Card />);
		expect(card().textContent).toContain('11:00–12:00');
		expect(
			screen.getByRole('heading', {
				name: 'calendar.bandSome {"busy":2,"total":3}'
			})
		).toBeTruthy();
	});

	it('lists each busy colleague with what keeps them busy', () => {
		render(<Card />);
		const kaya = screen.getByTestId('calendar-band-person-kaya');
		expect(kaya.textContent).toContain('A. Kaya');
		expect(kaya.textContent).toContain('BS-N');
		expect(kaya.textContent).toContain('calendar.kinds.video');
		expect(kaya.textContent).toContain('11:00–12:00');
		// The advice seeker only where the colleague's Träger allows it:
		// the data then carries the name.
		expect(kaya.textContent).toContain('frohe_amsel');
		const nowak = screen.getByTestId('calendar-band-person-nowak');
		expect(nowak.textContent).toContain('calendar.types.blocker');
		expect(nowak.textContent).toContain('10:30–12:00');
	});

	it('shows a phone appointment with a handset, not a microphone (Frank *19)', () => {
		const NOWAK_PHONE: CalendarEntry = {
			id: 'n2',
			type: 'appointment',
			kind: 'phone',
			ownerId: 'nowak',
			start: at(11),
			end: at(12)
		};
		render(
			<Card
				busy={[
					{ colleague: KAYA, entries: [KAYA_VIDEO] },
					{ colleague: NOWAK, entries: [NOWAK_PHONE] }
				]}
			/>
		);
		const nowak = screen.getByTestId('calendar-band-person-nowak');
		expect(
			nowak.querySelector('[data-testid="CallOutlinedIcon"]')
		).not.toBeNull();
	});

	it('lists who is free', () => {
		render(<Card />);
		const free = screen.getByTestId('calendar-band-free');
		expect(free.textContent).toContain('calendar.bandCard.free');
		expect(free.textContent).toContain('E. Demir');
	});

	it('says when nobody shown is free', () => {
		render(<Card free={[]} />);
		expect(screen.getByTestId('calendar-band-free').textContent).toContain(
			'calendar.bandCard.nobodyFree'
		);
	});

	it('opens a colleague’s calendar side by side, or everyone’s', () => {
		const onShowCalendar = vi.fn();
		render(<Card onShowCalendar={onShowCalendar} />);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'calendar.bandCard.showLabel {"name":"A. Kaya"}'
			})
		);
		expect(onShowCalendar).toHaveBeenLastCalledWith('kaya');
		fireEvent.click(
			screen.getByRole('button', { name: /calendar\.bandCard\.all/ })
		);
		expect(onShowCalendar).toHaveBeenLastCalledWith(null);
	});

	it('offers a move proposal only where the backend takes one', () => {
		const onMoveEntry = vi.fn();
		render(<Card onMoveEntry={onMoveEntry} />);
		const propose = screen.getAllByRole('button', {
			name: /calendar\.entryMenu\.propose/
		});
		expect(propose).toHaveLength(1);
		fireEvent.click(propose[0]);
		expect(onMoveEntry).toHaveBeenCalledWith(KAYA_VIDEO, propose[0]);
		// A colleague's Sperrzeit: only they can change it.
		expect(
			screen.getByTestId('calendar-band-person-nowak').textContent
		).toContain('calendar.bandCard.ownerOnly {"name":"P. Nowak"}');
	});

	it('says "Verschieben" for an appointment one may move oneself (co-access)', () => {
		render(<Card moveActionOf={(e) => (e.id === 'k1' ? 'move' : null)} />);
		expect(
			screen.getByRole('button', { name: /calendar\.entryMenu\.move/ })
		).toBeTruthy();
	});

	it('enters something of one’s own at that time', () => {
		const onCreate = vi.fn();
		render(<Card onCreate={onCreate} />);
		const add = screen.getByRole('button', {
			name: /calendar\.bandCard\.create/
		});
		fireEvent.click(add);
		expect(onCreate).toHaveBeenCalledWith(add);
	});

	it('goes back to the list in the side column, with the button or Escape', () => {
		const onClose = vi.fn();
		render(<Card onClose={onClose} />);
		fireEvent.click(
			screen.getByRole('button', { name: 'calendar.bandCard.back' })
		);
		expect(onClose).toHaveBeenCalledTimes(1);
		fireEvent.keyDown(card(), { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it('leaves closing to the menu at the band', () => {
		render(<Card variant="menu" />);
		expect(
			screen.queryByRole('button', { name: 'calendar.bandCard.back' })
		).toBeNull();
	});

	it('names the one colleague shown and has no "Frei"', () => {
		render(
			<Card
				band={{ ...BAND, busy: ['kaya'] }}
				busy={[{ colleague: KAYA, entries: [KAYA_VIDEO] }]}
				free={[]}
			/>
		);
		expect(
			screen.getByRole('heading', {
				name: 'calendar.bandOne {"name":"A. Kaya"}'
			})
		).toBeTruthy();
		expect(screen.queryByTestId('calendar-band-free')).toBeNull();
	});
});
