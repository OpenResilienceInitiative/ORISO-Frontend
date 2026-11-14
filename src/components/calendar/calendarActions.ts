/**
 * What one may do with a calendar entry, and the move proposals for
 * someone else's entries (Frank's prototype, 2026-11-14).
 *
 * - Own appointment: start it, move it, cancel it.
 * - Own blocker: move it, remove it. Imported busy time: nothing.
 * - Group date: join it. Group dates are never moved from the calendar.
 * - A colleague's appointment: propose a move; it stays where it is until
 *   the colleague accepts. Colleagues' blockers and busy time: nothing.
 *
 * UserService has no proposals yet; the page shows them only when its
 * host passes the proposal callbacks (Storybook does, the app does not).
 */
import type { CalendarEntry, CalendarRole } from './calendarModel';

export type EntryAction =
	| 'start'
	| 'join'
	| 'move'
	| 'propose'
	| 'cancel'
	| 'remove';

/** The kinds that open something to start: video, phone and chat. */
const STARTABLE = ['video', 'phone', 'chat'];

export interface EntryActionContext {
	ownerId: string;
	role: CalendarRole;
	/** Handlers the host passed; an action without one is not offered. */
	can: Partial<Record<EntryAction, boolean>>;
}

/** Main action first, as in the ChatMenuDropdown menus. */
export const entryActions = (
	entry: CalendarEntry,
	{ ownerId, role, can }: EntryActionContext
): EntryAction[] => {
	const own = entry.ownerId === ownerId;
	const consultant = role === 'consultant';
	const actions: EntryAction[] = [];
	if (entry.type === 'group') {
		if (can.join) actions.push('join');
		return actions;
	}
	if (!own) {
		// `movable` is about dragging one's own entries; someone else's
		// appointment is never movable, but a move can be proposed.
		if (consultant && can.propose && entry.type === 'appointment')
			actions.push('propose');
		return actions;
	}
	if (entry.type === 'appointment') {
		if (can.start && entry.kind && STARTABLE.includes(entry.kind))
			actions.push('start');
		if (consultant && can.move && entry.movable !== false)
			actions.push('move');
		if (consultant && can.cancel) actions.push('cancel');
	}
	if (entry.type === 'blocker' && consultant) {
		if (can.move && entry.movable !== false) actions.push('move');
		if (can.remove) actions.push('remove');
	}
	return actions;
};

/** A pending request to move someone else's entry. */
export interface MoveProposal {
	id: string;
	/** The entry that would move. */
	entryId: string;
	/** ISO date-time of the proposed new time. */
	start: string;
	end: string;
}

/** One proposal per entry: a new one replaces the older. */
export const addProposal = (
	proposals: MoveProposal[],
	proposal: MoveProposal
): MoveProposal[] => [
	...proposals.filter((p) => p.entryId !== proposal.entryId),
	proposal
];

export const withdrawProposal = (
	proposals: MoveProposal[],
	id: string
): MoveProposal[] => proposals.filter((p) => p.id !== id);

/** Proposals whose entry is still known, paired with it, oldest first. */
export const openProposals = (
	proposals: MoveProposal[],
	entries: CalendarEntry[]
) =>
	proposals.flatMap((proposal) => {
		const entry = entries.find((e) => e.id === proposal.entryId);
		return entry ? [{ proposal, entry }] : [];
	});

/** Whoever has to accept the proposal: the entry's owner. */
export const approverOf = (entry: CalendarEntry) => entry.ownerId;
