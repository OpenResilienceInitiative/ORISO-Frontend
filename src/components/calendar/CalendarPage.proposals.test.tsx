// @vitest-environment oriso-jsdom
/**
 * Move proposals on the receiving side (contract "move proposals v1"): the
 * colleague's proposal waits under "Offene Verschiebungen" and dashed in the
 * grid; "Annehmen" moves the appointment, "Ablehnen" keeps it. Only a
 * colleague's appointment can be proposed. The grid is a stub that hands
 * out its callbacks.
 */
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarPage, type CalendarPageProps } from './CalendarPage';
import { ProposalNoLongerValid, type MoveProposal } from './calendarActions';
import type { CalendarEntry, Colleague } from './calendarModel';
import type { MenuAnchor } from './CalendarView';

// Keys with their values, so a test can tell which times a text names.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) =>
			values
				? `${key}(${Object.entries(values)
						.map(([k, v]) => `${k}=${String(v)}`)
						.join(';')})`
				: key,
		i18n: { language: 'de' }
	})
}));

const grid: {
	proposals?: { proposal: MoveProposal; entry: CalendarEntry }[];
	onProposalOpen?: (proposal: MoveProposal, anchor: MenuAnchor) => void;
	onEntryOpen?: (
		entry: CalendarEntry,
		anchor: MenuAnchor,
		mode: 'list' | 'move'
	) => void;
} = {};
vi.mock('./CalendarView', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./CalendarView')>();
	return {
		...actual,
		CalendarView: (props: typeof grid) => {
			grid.proposals = props.proposals;
			grid.onProposalOpen = props.onProposalOpen;
			grid.onEntryOpen = props.onEntryOpen;
			return <div data-testid="calendar-view" />;
		}
	};
});

afterEach(cleanup);
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;

const NOW = new Date(2026, 10, 16, 9);
const at = (day: number, hour: number) =>
	new Date(2026, 10, day, hour).toISOString();

const OWN: CalendarEntry = {
	id: 'a1',
	type: 'appointment',
	kind: 'video',
	title: 'ruhiges_yak',
	sessionId: 4401,
	start: at(17, 9),
	end: at(17, 10),
	ownerId: 'me',
	movable: true
};
const KAYA: Colleague = {
	id: 'kaya',
	displayName: 'A. Kaya',
	agencyName: 'Nord',
	relation: 'sameAgency'
};
const REQUEST: MoveProposal = {
	id: 'p1',
	entryId: 'a1',
	start: at(18, 14),
	end: at(18, 15),
	entryStart: at(17, 9),
	entryEnd: at(17, 10),
	proposerId: 'kaya',
	proposerName: 'A. Kaya',
	approverId: 'me'
};

const page = (props: Partial<CalendarPageProps> = {}) =>
	render(
		<CalendarPage
			role="consultant"
			ownerId="me"
			now={NOW}
			entries={[OWN]}
			colleagues={[KAYA]}
			receivedProposals={[REQUEST]}
			onAcceptProposal={vi.fn()}
			onDeclineProposal={vi.fn()}
			{...props}
		/>
	);

const byCy = (name: string) =>
	document.querySelector<HTMLElement>(`[data-cy="${name}"]`);

describe('CalendarPage — "Offene Verschiebungen" for proposals received', () => {
	it('lists who proposes what: the name, the old and the new time', () => {
		page();
		const section = byCy('calendar-requests') as HTMLElement;
		expect(
			within(section).getByRole('heading', {
				name: 'calendar.proposal.open'
			})
		).toBeTruthy();
		const row = byCy('calendar-received-p1') as HTMLElement;
		expect(row.textContent).toContain('A. Kaya');
		const open = within(row).getByRole('button', {
			name: /calendar\.proposal\.requestLabel/
		});
		const name = open.getAttribute('aria-label') ?? '';
		expect(name).toContain('name=A. Kaya');
		// Old and new time, in words for screen readers.
		expect(name).toMatch(/from=[^;]*09:00–10:00/);
		expect(name).toMatch(/to=[^;)]*14:00–15:00/);
		// Both answers are buttons that say what they answer.
		expect(
			within(row)
				.getByRole('button', {
					name: /calendar\.proposal\.acceptLabel/
				})
				.getAttribute('aria-label')
		).toContain('name=A. Kaya');
		expect(
			within(row).getByRole('button', {
				name: /calendar\.proposal\.declineLabel/
			}).textContent
		).toBe('calendar.proposal.decline');
	});

	it('names which appointment would move: its kind and conversation (test finding C21)', () => {
		page();
		const row = byCy('calendar-received-p1') as HTMLElement;
		const what = byCy('calendar-received-what-p1') as HTMLElement;
		expect(row.contains(what)).toBe(true);
		expect(what.textContent).toContain('ruhiges_yak');
		expect(what.textContent).toContain('calendar.kinds.video');
	});

	it('shows the reason the colleague gave in the row (US#1663)', () => {
		page({ receivedProposals: [{ ...REQUEST, reason: 'Raum belegt' }] });
		const reason = byCy('calendar-received-reason-p1') as HTMLElement;
		expect(
			(byCy('calendar-received-p1') as HTMLElement).contains(reason)
		).toBe(true);
		expect(reason.textContent).toContain('Raum belegt');
	});

	it('shows no reason line when the colleague gave none', () => {
		page();
		expect(byCy('calendar-received-reason-p1')).toBeNull();
	});

	it('names the old time from the proposal when the appointment is not loaded', () => {
		page({ entries: [] });
		const row = byCy('calendar-received-p1') as HTMLElement;
		expect(row.textContent).toMatch(/from=[^;]*09:00–10:00/);
	});

	it('shows nothing to answer without the answer callbacks', () => {
		page({ onAcceptProposal: undefined, onDeclineProposal: undefined });
		expect(byCy('calendar-requests')).toBeNull();
		expect(grid.proposals).toEqual([]);
	});

	it('accepts: the handler gets the proposal, the move notice follows', async () => {
		const onAcceptProposal = vi.fn(() => Promise.resolve());
		page({ onAcceptProposal });
		await act(async () => {
			fireEvent.click(byCy('calendar-received-accept-p1') as HTMLElement);
		});
		expect(onAcceptProposal).toHaveBeenCalledWith(REQUEST);
		expect(
			screen.getByText(/^calendar\.moved\(date=.*14:00–15:00\)$/)
		).toBeTruthy();
	});

	it('declines: the handler gets the proposal, the appointment stays', async () => {
		const onDeclineProposal = vi.fn(() => Promise.resolve());
		page({ onDeclineProposal });
		await act(async () => {
			fireEvent.click(
				byCy('calendar-received-decline-p1') as HTMLElement
			);
		});
		expect(onDeclineProposal).toHaveBeenCalledWith(REQUEST);
		expect(
			screen.getByText(
				/^calendar\.proposal\.declined\(date=.*09:00–10:00\)$/
			)
		).toBeTruthy();
	});

	it('says the proposal no longer applies when the appointment moved meanwhile', async () => {
		page({
			onAcceptProposal: () => Promise.reject(new ProposalNoLongerValid())
		});
		await act(async () => {
			fireEvent.click(byCy('calendar-received-accept-p1') as HTMLElement);
		});
		expect(
			screen.getByText('calendar.proposal.noLongerValid')
		).toBeTruthy();
		expect(screen.queryByText(/^calendar\.moved/)).toBeNull();
	});

	it('shows the usual failure notice for any other failure', async () => {
		page({ onDeclineProposal: () => Promise.reject(new Error('500')) });
		await act(async () => {
			fireEvent.click(
				byCy('calendar-received-decline-p1') as HTMLElement
			);
		});
		expect(screen.getByText('calendar.saveFailed')).toBeTruthy();
	});

	it('answers once: a second click while the first answer runs sends nothing', async () => {
		let settle: () => void = () => undefined;
		const onAcceptProposal = vi.fn(
			() => new Promise<void>((resolve) => (settle = resolve))
		);
		page({ onAcceptProposal });
		const accept = byCy('calendar-received-accept-p1') as HTMLButtonElement;
		await act(async () => {
			fireEvent.click(accept);
		});
		expect(accept.disabled).toBe(true);
		await act(async () => {
			fireEvent.click(accept);
		});
		expect(onAcceptProposal).toHaveBeenCalledTimes(1);
		await act(async () => settle());
	});

	it('draws the proposed time in the grid and answers it from there', async () => {
		const onDeclineProposal = vi.fn();
		page({ onDeclineProposal });
		expect(grid.proposals).toEqual([{ proposal: REQUEST, entry: OWN }]);
		await act(async () => grid.onProposalOpen?.(REQUEST, { x: 10, y: 10 }));
		const menu = byCy('calendar-menu-request') as HTMLElement;
		expect(
			within(menu).getByRole('menuitem', {
				name: /calendar\.proposal\.accept/
			})
		).toBeTruthy();
		fireEvent.click(byCy('calendar-request-decline') as HTMLElement);
		expect(onDeclineProposal).toHaveBeenCalledWith(REQUEST);
	});

	it('opens the bottom sheet on phone and tablet only while a request is open', () => {
		const { unmount } = page({ compact: true });
		expect(byCy('calendar-sheet')).not.toBeNull();
		unmount();
		page({ compact: true, receivedProposals: [] });
		expect(byCy('calendar-sheet')).toBeNull();
	});
});

describe('CalendarPage — what can be proposed', () => {
	const colleague = (over: Partial<CalendarEntry>): CalendarEntry => ({
		...OWN,
		id: 'k1',
		ownerId: 'kaya',
		title: undefined,
		sessionId: undefined,
		movable: false,
		...over
	});

	const offersPropose = (entry: CalendarEntry) => {
		cleanup();
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={entry.id === OWN.id ? [OWN] : [OWN, entry]}
				colleagues={[KAYA]}
				initialShownColleagues={['kaya']}
				onMove={vi.fn()}
				onCancelAppointment={vi.fn()}
				onRemoveBlocker={vi.fn()}
				onJoin={vi.fn()}
				onProposeMove={vi.fn()}
			/>
		);
		act(() => grid.onEntryOpen?.(entry, { x: 10, y: 10 }, 'list'));
		return byCy('calendar-entry-propose') !== null;
	};

	it('offers "Verschiebung vorschlagen" on a colleague\'s appointment', () => {
		expect(offersPropose(colleague({}))).toBe(true);
	});

	it.each([
		['blocked time', colleague({ type: 'blocker', kind: undefined })],
		['imported busy time', colleague({ type: 'busy', kind: undefined })],
		['group date', colleague({ type: 'group', kind: undefined })]
	])("never on a colleague's %s", (_what, entry) => {
		expect(offersPropose(entry)).toBe(false);
	});

	it("never on one's own entries: they are moved directly", () => {
		expect(offersPropose(OWN)).toBe(false);
		expect(byCy('calendar-entry-move')).not.toBeNull();
		expect(
			offersPropose({
				...OWN,
				id: 'b1',
				type: 'blocker',
				kind: undefined
			})
		).toBe(false);
	});

	it('offers a co-access holder "Verschieben" instead: the appointment is in their own calendar too (UserService#1655)', async () => {
		// UserService answers a proposal of a co-access holder with 400 and
		// lets them move the appointment directly.
		const onMove = vi.fn(() => Promise.resolve());
		const onProposeMove = vi.fn();
		const mine: CalendarEntry = { ...OWN, id: 'k1' };
		const kayas = colleague({});
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[mine, kayas]}
				colleagues={[KAYA]}
				initialShownColleagues={['kaya']}
				onMove={onMove}
				onProposeMove={onProposeMove}
				onCancelAppointment={vi.fn()}
			/>
		);
		act(() => grid.onEntryOpen?.(kayas, { x: 10, y: 10 }, 'list'));
		expect(byCy('calendar-entry-propose')).toBeNull();
		expect(byCy('calendar-entry-move')).not.toBeNull();
		// A double click opens the form that moves it directly.
		act(() => grid.onEntryOpen?.(kayas, { x: 10, y: 10 }, 'move'));
		const form = byCy('calendar-move-form') as HTMLFormElement;
		fireEvent.change(form.querySelector('input[type="date"]')!, {
			target: { value: '2026-11-19' }
		});
		await act(async () => {
			fireEvent.submit(form);
		});
		expect(onProposeMove).not.toHaveBeenCalled();
		expect(onMove).toHaveBeenCalledTimes(1);
		expect((onMove.mock.calls[0] as unknown[])[0]).toBe(mine);
	});

	it('refuses a proposed start in the past, as UserService would', async () => {
		const onProposeMove = vi.fn();
		const entry = colleague({});
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[entry]}
				colleagues={[KAYA]}
				initialShownColleagues={['kaya']}
				onProposeMove={onProposeMove}
			/>
		);
		act(() => grid.onEntryOpen?.(entry, { x: 10, y: 10 }, 'move'));
		const form = byCy('calendar-move-form') as HTMLFormElement;
		fireEvent.change(form.querySelector('input[type="date"]')!, {
			target: { value: '2026-11-15' }
		});
		await act(async () => {
			fireEvent.submit(form);
		});
		expect(onProposeMove).not.toHaveBeenCalled();
		expect(screen.getByText('calendar.movePast')).toBeTruthy();
	});
});
