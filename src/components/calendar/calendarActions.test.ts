import { describe, expect, it } from 'vite-plus/test';
import {
	addProposal,
	entryActions,
	openProposals,
	withdrawProposal,
	type MoveProposal
} from './calendarActions';
import type { CalendarEntry } from './calendarModel';

const base = {
	start: '2026-11-16T09:00:00.000Z',
	end: '2026-11-16T10:00:00.000Z'
};
const all = {
	start: true,
	join: true,
	move: true,
	propose: true,
	cancel: true,
	remove: true
};
const context = { ownerId: 'me', role: 'consultant' as const, can: all };

const own: CalendarEntry = {
	...base,
	id: 'a1',
	type: 'appointment',
	kind: 'video',
	ownerId: 'me'
};

describe('entryActions', () => {
	it('lets one start, move and cancel an own appointment', () => {
		expect(entryActions(own, context)).toEqual(['start', 'move', 'cancel']);
	});

	it('has nothing to start for an on-site appointment', () => {
		expect(entryActions({ ...own, kind: 'onsite' }, context)).toEqual([
			'move',
			'cancel'
		]);
	});

	it('moves and removes an own blocker, leaves imported busy time alone', () => {
		expect(entryActions({ ...own, type: 'blocker' }, context)).toEqual([
			'move',
			'remove'
		]);
		expect(entryActions({ ...own, type: 'busy' }, context)).toEqual([]);
	});

	it('joins a group date and never moves it', () => {
		expect(entryActions({ ...own, type: 'group' }, context)).toEqual([
			'join'
		]);
	});

	it("proposes a move of a colleague's appointment, not of their blocker", () => {
		const colleague = { ...own, ownerId: 'kaya', movable: false };
		expect(entryActions(colleague, context)).toEqual(['propose']);
		expect(
			entryActions({ ...colleague, type: 'blocker' }, context)
		).toEqual([]);
		expect(entryActions({ ...colleague, type: 'busy' }, context)).toEqual(
			[]
		);
	});

	it('offers only what the host can handle', () => {
		expect(
			entryActions({ ...own, ownerId: 'kaya' }, { ...context, can: {} })
		).toEqual([]);
		expect(
			entryActions(own, { ...context, can: { cancel: true } })
		).toEqual(['cancel']);
	});

	it('gives an advice seeker only the start of an own appointment', () => {
		expect(entryActions(own, { ...context, role: 'asker' })).toEqual([
			'start'
		]);
	});
});

describe('move proposals', () => {
	const proposal: MoveProposal = {
		id: 'p1',
		entryId: 'k1',
		start: '2026-11-17T09:00:00.000Z',
		end: '2026-11-17T10:00:00.000Z'
	};

	it('keeps one proposal per entry', () => {
		const next = addProposal([proposal], { ...proposal, id: 'p2' });
		expect(next).toEqual([{ ...proposal, id: 'p2' }]);
	});

	it('withdraws a proposal', () => {
		expect(withdrawProposal([proposal], 'p1')).toEqual([]);
	});

	it('pairs proposals with their entry and drops orphans', () => {
		const entry = { ...own, id: 'k1', ownerId: 'kaya' };
		expect(
			openProposals(
				[proposal, { ...proposal, id: 'p3', entryId: 'gone' }],
				[entry]
			)
		).toEqual([{ proposal, entry }]);
	});
});
