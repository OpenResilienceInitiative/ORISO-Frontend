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
 * Proposals follow UserService's contract "move proposals v1" (ADR-032
 * addendum): the proposer sends and withdraws, the appointment's owner
 * accepts or declines. The page shows each side only when its host passes
 * the callbacks for it.
 */
import type { CalendarEntry, CalendarRole } from './calendarModel';

export type EntryAction =
	| 'show'
	| 'start'
	| 'chat'
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
		const chat = !!can.chat && entry.sessionId !== undefined;
		// A chat appointment starts in its conversation: "Zum Chat" alone,
		// not "Chat öffnen" beside it (Frank, 2026-11-16).
		if (
			can.start &&
			entry.kind &&
			STARTABLE.includes(entry.kind) &&
			!(entry.kind === 'chat' && chat)
		)
			actions.push('start');
		// "Zum Chat" whenever the appointment belongs to a conversation.
		if (chat) actions.push('chat');
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
	/**
	 * The entry's time when the proposal was made: the "from" of "from →
	 * to", also when the entry itself is not loaded.
	 */
	entryStart?: string;
	entryEnd?: string;
	proposerId?: string;
	proposerName?: string;
	/** The entry's owner, who accepts or declines. */
	approverId?: string;
	approverName?: string;
	/** Why the proposer asks (UserService#1663). */
	reason?: string;
	createdAt?: string;
}

/**
 * UserService answered 409 to "Annehmen": the proposal no longer applies.
 * The answer names no cause (no longer open; the appointment moved, was
 * cancelled or began; the proposed start passed; the conversation was
 * finished or reassigned), so the page says it neutrally.
 */
export class ProposalNoLongerValid extends Error {
	constructor() {
		super('PROPOSAL_NO_LONGER_VALID');
	}
}

/** The proposal waits for `ownerId`: it is about one of their entries. */
export const receivedBy = (proposal: MoveProposal, ownerId: string) =>
	!!proposal.approverId && proposal.approverId === ownerId;

/**
 * The entry a proposal is about, from what the proposal itself carries, for
 * an entry outside the loaded time (or a colleague not shown).
 */
const standInEntry = (proposal: MoveProposal): CalendarEntry | undefined =>
	proposal.entryStart && proposal.entryEnd && proposal.approverId
		? {
				id: proposal.entryId,
				type: 'appointment',
				start: proposal.entryStart,
				end: proposal.entryEnd,
				ownerId: proposal.approverId,
				movable: false
			}
		: undefined;

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

/**
 * Proposals paired with their entry, oldest first: the loaded entry, else
 * one made from the proposal's own times. A proposal with neither is
 * dropped.
 */
export const openProposals = (
	proposals: MoveProposal[],
	entries: CalendarEntry[]
) =>
	proposals.flatMap((proposal) => {
		const entry =
			entries.find((e) => e.id === proposal.entryId) ??
			standInEntry(proposal);
		return entry ? [{ proposal, entry }] : [];
	});

/** Whoever has to accept the proposal: the entry's owner. */
export const approverOf = (entry: CalendarEntry) => entry.ownerId;
