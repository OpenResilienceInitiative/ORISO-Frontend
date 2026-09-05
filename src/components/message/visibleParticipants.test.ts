import { describe, expect, it } from 'vitest';
import {
	filterVisibleParticipants,
	participantIdentityKeys,
	type VisibleParticipantRules
} from './visibleParticipants';
import {
	resolveParticipantStack,
	type StackParticipant
} from './participantStack';

/**
 * ADR-002 silent membership: every counsellor of the agency is a Matrix
 * member of every session room (technical eligibility for hand-over and
 * supervision), but the room header must never show them. The visible set
 * of a 1:1 session is the asker, the assigned consultant and the active
 * supervisors — nobody else — and "+N" counts only those.
 */
const member = (
	userId: string,
	overrides: Partial<StackParticipant> = {}
): StackParticipant => ({
	userId,
	username: userId,
	displayName: userId.replace(/^@|:.*$/g, ''),
	...overrides
});

const asker = member('@enc.sonnenblume_47:oriso.invalid', {
	displayName: 'sonnenblume_47',
	isAsker: true
});
const consultant = member('@mona.s:oriso.invalid', {
	displayName: 'Mona Sommer'
});
const supervisor = member('@bettina.b:oriso.invalid', {
	displayName: 'Bettina Berg'
});
const silent = Array.from({ length: 5 }, (_, i) =>
	member(`@silent${i + 1}.simpson:oriso.invalid`, {
		displayName: `Silent${i + 1} Simpson`
	})
);
const roomMembers = [asker, consultant, supervisor, ...silent];

const sessionRules: VisibleParticipantRules = {
	mode: 'session',
	asker: { ids: ['@enc.sonnenblume_47:oriso.invalid'] },
	consultant: { ids: ['mona.s@oriso.invalid'], displayName: 'Mona S.' },
	supervisors: [
		{ ids: ['bettina.b@oriso.invalid'], displayName: 'Bettina B.' }
	]
};

describe('participantIdentityKeys', () => {
	it('derives the same key from a Matrix id, a username and an e-mail username', () => {
		expect(participantIdentityKeys('@Mona.S:oriso.invalid')).toContain(
			'mona.s'
		);
		expect(participantIdentityKeys('mona.s@oriso.invalid')).toContain(
			'mona.s'
		);
		expect(participantIdentityKeys('mona.s')).toContain('mona.s');
	});

	it('strips the asker enc. prefix so the room id matches the session id', () => {
		expect(
			participantIdentityKeys('@enc.sonnenblume_47:oriso.invalid')
		).toContain('sonnenblume_47');
	});

	it('yields nothing for empty input', () => {
		expect(participantIdentityKeys(undefined).size).toBe(0);
		expect(participantIdentityKeys('  ').size).toBe(0);
	});
});

describe('filterVisibleParticipants — 1:1 session (ADR-002 silent members)', () => {
	it('shows exactly asker, consultant and supervisor out of eight room members — no "+N"', () => {
		const visible = filterVisibleParticipants(roomMembers, sessionRules);
		expect(visible.map((p) => p.userId)).toEqual([
			asker.userId,
			consultant.userId,
			supervisor.userId
		]);
		const stack = resolveParticipantStack(visible);
		expect(stack.visible).toHaveLength(3);
		expect(stack.overflow).toBe(0);
	});

	it('never shows a silent member, whatever their activity', () => {
		const visible = filterVisibleParticipants(
			roomMembers.map((p) => ({ ...p, lastActivity: 999 })),
			sessionRules
		);
		expect(visible.some((p) => p.userId.includes('silent'))).toBe(false);
	});

	it('names the consultant and supervisors by their internal display name (#996), never "First Last"', () => {
		const visible = filterVisibleParticipants(roomMembers, sessionRules);
		expect(
			visible.find((p) => p.userId === consultant.userId)?.displayName
		).toBe('Mona S.');
		expect(
			visible.find((p) => p.userId === supervisor.userId)?.displayName
		).toBe('Bettina B.');
		// The asker keeps the header's naming (#1209).
		expect(visible.find((p) => p.isAsker)?.displayName).toBe(
			'sonnenblume_47'
		);
	});

	it('shows only the asker while no consultant is assigned and no supervisor is known', () => {
		const visible = filterVisibleParticipants(roomMembers, {
			mode: 'session',
			asker: { ids: ['sonnenblume_47'] },
			supervisors: []
		});
		expect(visible.map((p) => p.userId)).toEqual([asker.userId]);
	});

	it('matches the consultant by consultant id or username, whichever the room carries', () => {
		const visible = filterVisibleParticipants(roomMembers, {
			...sessionRules,
			consultant: { ids: [undefined, 'consultant-uuid-1', 'Mona.S'] }
		});
		expect(visible.some((p) => p.userId === consultant.userId)).toBe(true);
	});
});

describe('filterVisibleParticipants — supervision side room', () => {
	const supervisionMembers = [consultant, supervisor, ...silent];

	it('shows only the counterpart and me (consultant + supervisor) — never silent members', () => {
		const visible = filterVisibleParticipants(supervisionMembers, {
			mode: 'supervision',
			self: { ids: ['@mona.s:oriso.invalid'] },
			consultant: {
				ids: ['mona.s@oriso.invalid'],
				displayName: 'Mona S.'
			},
			supervisors: [{ ids: ['bettina.b'], displayName: 'Bettina B.' }]
		});
		expect(visible.map((p) => p.userId)).toEqual([
			consultant.userId,
			supervisor.userId
		]);
	});

	it('never shows the asker in the supervision room, even if the room lists them', () => {
		const visible = filterVisibleParticipants(roomMembers, {
			mode: 'supervision',
			asker: { ids: [asker.userId] },
			consultant: { ids: ['mona.s'] },
			supervisors: [{ ids: ['bettina.b'] }]
		});
		expect(visible.map((p) => p.userId)).toEqual([
			consultant.userId,
			supervisor.userId
		]);
	});

	it('keeps me visible as the supervisor even before the supervisor list is loaded', () => {
		const visible = filterVisibleParticipants(supervisionMembers, {
			mode: 'supervision',
			self: { ids: ['@bettina.b:oriso.invalid'] },
			consultant: { ids: ['mona.s'] },
			supervisors: []
		});
		expect(visible.map((p) => p.userId)).toEqual([
			consultant.userId,
			supervisor.userId
		]);
	});
});

describe('filterVisibleParticipants — group chat', () => {
	it('keeps every joined member', () => {
		const visible = filterVisibleParticipants(roomMembers, {
			mode: 'group',
			supervisors: []
		});
		expect(visible).toHaveLength(roomMembers.length);
	});
});
