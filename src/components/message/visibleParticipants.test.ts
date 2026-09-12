import { describe, expect, it } from 'vitest';
import {
	buildVisibleParticipantRules,
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
 *
 * The identities are modelled in the shapes the product really ships
 * (review B2 D-1): the session/supervisor DTOs carry the base32-ENCODED
 * Keycloak username (`enc.<base32>`, `UsernameTranscoder`), the Matrix
 * localpart is the DECODED username lower-cased (`AssignEnquiryFacade`),
 * consultant ids are UUIDs and the asker's Matrix id arrives verbatim as
 * `askerMatrixUserId`.
 */
const SERVER = 'pre-dev.dreambau.com';
// encodeUsername('mona.simpson') / encodeUsername('bettina.berg')
const MONA_ENCODED = 'enc.NVXW4YJOONUW24DTN5XA....';
const BETTINA_ENCODED = 'enc.MJSXI5DJNZQS4YTFOJTQ....';
const MONA_UUID = '4f7d2a1e-6c3b-4b8e-9a12-0f5e6d7c8b9a';
const BETTINA_UUID = 'b1c2d3e4-f5a6-4718-8c9d-0e1f2a3b4c5d';
const MONA_MATRIX = `@mona.simpson:${SERVER}`;
const BETTINA_MATRIX = `@bettina.berg:${SERVER}`;
const ASKER_MATRIX = `@enc.onxw43tfnzrgy5lnmvptiny.:${SERVER}`;

const member = (
	userId: string,
	overrides: Partial<StackParticipant> = {}
): StackParticipant => ({
	userId,
	username: userId.replace(/^@|:.*$/g, ''),
	displayName: userId.replace(/^@|:.*$/g, ''),
	...overrides
});

const asker = member(ASKER_MATRIX, {
	displayName: 'sonnenblume_47',
	isAsker: true
});
const consultant = member(MONA_MATRIX, { displayName: 'Mona Simpson' });
const supervisor = member(BETTINA_MATRIX, { displayName: 'Bettina Berg' });
const silent = Array.from({ length: 5 }, (_, i) =>
	member(`@silent${i + 1}.simpson:${SERVER}`, {
		displayName: `Silent${i + 1} Simpson`
	})
);
const roomMembers = [asker, consultant, supervisor, ...silent];

/** What `SessionItemComponent` / `SessionHeaderComponent` hand over today. */
const sessionRules: VisibleParticipantRules = {
	mode: 'session',
	asker: { ids: [ASKER_MATRIX, 'enc.ONXW43TFNZRGY5LNMVPTINY.'] },
	consultant: {
		ids: [MONA_ENCODED, MONA_UUID, MONA_UUID, MONA_MATRIX],
		displayName: 'Mona S.'
	},
	supervisors: [
		{ ids: [BETTINA_ENCODED, BETTINA_UUID], displayName: 'Bettina B.' }
	]
};

describe('participantIdentityKeys', () => {
	it('derives the Matrix localpart from a Matrix id and a bare username', () => {
		expect(participantIdentityKeys(`@Mona.Simpson:${SERVER}`)).toContain(
			'mona.simpson'
		);
		expect(participantIdentityKeys('mona.simpson')).toContain(
			'mona.simpson'
		);
	});

	it('decodes an enc.<base32> DTO username to the Matrix localpart', () => {
		expect(participantIdentityKeys(MONA_ENCODED)).toContain('mona.simpson');
		expect(participantIdentityKeys(BETTINA_ENCODED)).toContain(
			'bettina.berg'
		);
	});

	it('keeps the asker key stable between the DTO spelling and the room id', () => {
		const fromRoom = participantIdentityKeys(ASKER_MATRIX);
		const fromDto = participantIdentityKeys('enc.ONXW43TFNZRGY5LNMVPTINY.');
		expect(Array.from(fromRoom).some((key) => fromDto.has(key))).toBe(true);
	});

	it('does not throw on an enc.-prefixed value that is not base32', () => {
		expect(() =>
			participantIdentityKeys('enc.sonnenblume_47')
		).not.toThrow();
		expect(participantIdentityKeys('enc.sonnenblume_47')).toContain(
			'sonnenblume_47'
		);
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

	it('finds the consultant through consultantMatrixUserId alone (session DTO field)', () => {
		const visible = filterVisibleParticipants(roomMembers, {
			...sessionRules,
			consultant: {
				ids: [MONA_UUID, MONA_MATRIX],
				displayName: 'Mona S.'
			}
		});
		expect(visible.map((p) => p.userId)).toContain(consultant.userId);
	});

	it('finds the consultant through the encoded DTO username alone', () => {
		const visible = filterVisibleParticipants(roomMembers, {
			...sessionRules,
			consultant: {
				ids: [MONA_ENCODED, MONA_UUID],
				displayName: 'Mona S.'
			}
		});
		expect(visible.map((p) => p.userId)).toContain(consultant.userId);
	});

	it('finds a supervisor through the encoded supervisorUsername + UUID pair', () => {
		const visible = filterVisibleParticipants(roomMembers, {
			...sessionRules,
			supervisors: [{ ids: [BETTINA_ENCODED, BETTINA_UUID] }]
		});
		expect(visible.map((p) => p.userId)).toContain(supervisor.userId);
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
			asker: { ids: [ASKER_MATRIX] },
			supervisors: []
		});
		expect(visible.map((p) => p.userId)).toEqual([asker.userId]);
	});

	it('a UUID alone never matches anybody (no fuzzy match)', () => {
		const visible = filterVisibleParticipants(roomMembers, {
			...sessionRules,
			consultant: { ids: [undefined, MONA_UUID] }
		});
		expect(visible.some((p) => p.userId === consultant.userId)).toBe(false);
	});
});

describe('filterVisibleParticipants — supervision side room', () => {
	const supervisionMembers = [consultant, supervisor, ...silent];

	it('shows the counterpart and me (consultant + supervisor) — never silent members', () => {
		const visible = filterVisibleParticipants(supervisionMembers, {
			mode: 'supervision',
			self: { ids: ['mona.simpson', MONA_UUID, MONA_MATRIX] },
			consultant: {
				ids: [MONA_ENCODED, MONA_UUID, MONA_MATRIX],
				displayName: 'Mona S.'
			},
			supervisors: [
				{
					ids: [BETTINA_ENCODED, BETTINA_UUID],
					displayName: 'Bettina B.'
				}
			]
		});
		expect(visible.map((p) => p.userId)).toEqual([
			consultant.userId,
			supervisor.userId
		]);
	});

	it('never shows the asker in the supervision room, even if the room lists them', () => {
		const visible = filterVisibleParticipants(roomMembers, {
			mode: 'supervision',
			asker: { ids: [ASKER_MATRIX] },
			consultant: { ids: [MONA_ENCODED, MONA_MATRIX] },
			supervisors: [{ ids: [BETTINA_ENCODED] }]
		});
		expect(visible.map((p) => p.userId)).toEqual([
			consultant.userId,
			supervisor.userId
		]);
	});

	it('keeps me visible as the supervisor even before the supervisor list is loaded', () => {
		const visible = filterVisibleParticipants(supervisionMembers, {
			mode: 'supervision',
			self: { ids: ['bettina.berg', BETTINA_UUID, BETTINA_MATRIX] },
			consultant: { ids: [MONA_ENCODED, MONA_UUID, MONA_MATRIX] },
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

/**
 * `buildVisibleParticipantRules` is the ONE rule builder for the session
 * header and the side panels (live finding, pre-dev session 74): the panel
 * used to build supervisor identities from usernames only, so the marker
 * name (`supervisorDisplayNames`, keyed by `supervisorConsultantIds`) never
 * applied and the avatar fell back to the Matrix profile name
 * `sv_supervisor` → initial "S" next to the title "Bettina B.".
 */
describe('buildVisibleParticipantRules', () => {
	const SELF_MATRIX = `@mona.simpson:${SERVER}`;
	const marker = {
		supervisedByMe: false,
		supervisorConsultantIds: [BETTINA_UUID],
		supervisorDisplayNames: ['Bettina B.'],
		counsellorDisplayName: 'Mona S.'
	};
	const supervisorRow = {
		supervisorConsultantId: BETTINA_UUID,
		supervisorUsername: BETTINA_ENCODED,
		supervisorMatrixUserId: BETTINA_MATRIX
	};
	const baseInput = {
		mode: 'session' as const,
		isGroup: false,
		marker,
		supervisors: [supervisorRow],
		askerIds: [ASKER_MATRIX, 'enc.ONXW43TFNZRGY5LNMVPTINY.'],
		consultant: {
			username: MONA_ENCODED,
			id: MONA_UUID,
			consultantId: MONA_UUID,
			displayName: 'Mona Simpson'
		},
		consultantMatrixUserId: MONA_MATRIX,
		self: {
			ids: [MONA_ENCODED, MONA_UUID, SELF_MATRIX],
			displayName: 'Mona Simpson'
		}
	};

	it('names a supervisor from the marker by consultant id, Matrix id first', () => {
		const rules = buildVisibleParticipantRules(baseInput);
		expect(rules.supervisors).toEqual([
			{
				ids: [BETTINA_MATRIX, BETTINA_ENCODED, BETTINA_UUID],
				displayName: 'Bettina B.'
			}
		]);
	});

	it('names the consultant by counsellorDisplayName, consultantMatrixUserId first', () => {
		const rules = buildVisibleParticipantRules(baseInput);
		expect(rules.consultant).toEqual({
			ids: [MONA_MATRIX, MONA_ENCODED, MONA_UUID, MONA_UUID],
			displayName: 'Mona S.'
		});
	});

	it('falls back to the consultant DTO display name without a marker name', () => {
		const rules = buildVisibleParticipantRules({
			...baseInput,
			marker: { ...marker, counsellorDisplayName: undefined }
		});
		expect(rules.consultant?.displayName).toBe('Mona Simpson');
	});

	it('leaves a supervisor unnamed when the marker has no name for them', () => {
		const rules = buildVisibleParticipantRules({
			...baseInput,
			marker: undefined
		});
		expect(rules.supervisors[0].displayName).toBeUndefined();
		expect(rules.supervisors[0].ids).toEqual([
			BETTINA_MATRIX,
			BETTINA_ENCODED,
			BETTINA_UUID
		]);
	});

	it('appends me as a supervisor when the marker says supervisedByMe', () => {
		const rules = buildVisibleParticipantRules({
			...baseInput,
			marker: { ...marker, supervisedByMe: true },
			supervisors: []
		});
		expect(rules.supervisors).toEqual([
			{
				ids: [MONA_ENCODED, MONA_UUID, SELF_MATRIX],
				displayName: 'Mona Simpson'
			}
		]);
	});

	it('appends me as a supervisor when the supervisors call says so (before the marker lands)', () => {
		const rules = buildVisibleParticipantRules({
			...baseInput,
			marker: undefined,
			supervisors: [],
			selfIsSupervisor: true
		});
		expect(rules.supervisors.map((s) => s.ids)).toEqual([
			[MONA_ENCODED, MONA_UUID, SELF_MATRIX]
		]);
	});

	it('always carries self (for the supervision room) and the asker ids', () => {
		const rules = buildVisibleParticipantRules({
			...baseInput,
			mode: 'supervision'
		});
		expect(rules.mode).toBe('supervision');
		expect(rules.self?.ids).toEqual([MONA_ENCODED, MONA_UUID, SELF_MATRIX]);
		expect(rules.asker?.ids).toEqual(baseInput.askerIds);
	});

	it('is a group rule for group chats whatever mode is asked for', () => {
		expect(
			buildVisibleParticipantRules({ ...baseInput, isGroup: true }).mode
		).toBe('group');
	});

	it('yields no consultant identity when the session has none', () => {
		expect(
			buildVisibleParticipantRules({ ...baseInput, consultant: null })
				.consultant
		).toBeNull();
	});

	it('renders the marker name over the Matrix profile name in the side panel (session 74)', () => {
		const supervisorFromMatrix = member(BETTINA_MATRIX, {
			username: 'sv_supervisor',
			displayName: 'sv_supervisor'
		});
		const visible = filterVisibleParticipants(
			[consultant, supervisorFromMatrix, ...silent],
			buildVisibleParticipantRules({
				...baseInput,
				mode: 'supervision',
				supervisors: [
					{ ...supervisorRow, supervisorMatrixUserId: undefined }
				]
			})
		);
		expect(visible.map((p) => p.displayName)).toEqual([
			'Mona S.',
			'Bettina B.'
		]);
	});
});
