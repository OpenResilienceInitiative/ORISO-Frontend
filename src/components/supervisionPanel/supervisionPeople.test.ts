import { describe, expect, it } from 'vite-plus/test';
import {
	enrichSupervisionParticipants,
	readableSupervisionName,
	resolveSupervisionPeople,
	type SupervisionPersonSource,
	type SupervisionRosterEntry
} from './supervisionPeople';

// The live Dev case of FE#2344: Bart counsels, Mona supervises. The agency
// roster holds two people of each name, the backend #996 name of both is
// their login, Bart picked the dog motif and Mona picked nothing.
const BART = '@bart.simpson_at_openresilience.cc:dev.oriso.org';
const MONA = '@mona.simpson_at_trail.ist:dev.oriso.org';

const roster: SupervisionRosterEntry[] = [
	{ consultantId: 'bart-1', firstName: 'Bart', lastName: 'Simpson' },
	{ consultantId: 'bart-2', firstName: 'Bart', lastName: 'Simpson' },
	{
		consultantId: 'mona-1',
		firstName: 'Mona',
		lastName: 'Simpson',
		displayName: 'Mona Simpson'
	},
	{ consultantId: 'mona-2', firstName: 'Mona', lastName: 'Simpson' }
];

const sources: SupervisionPersonSource[] = [
	{
		matrixUserId: BART,
		role: 'consultant',
		consultantId: 'bart-1',
		internalName: 'bart.simpson_at_openresilience.cc',
		identity: { avatarKind: 'ICON', avatarId: 'dog' }
	},
	{
		matrixUserId: MONA,
		role: 'supervisor',
		consultantId: 'mona-2',
		internalName: 'mona.simpson_at_trail.ist'
	}
];

describe('readableSupervisionName', () => {
	it('keeps a real internal display name (#996 order)', () => {
		expect(
			readableSupervisionName({
				source: { ...sources[1], internalName: 'Supervisorin Mona' },
				roster
			})
		).toBe('Supervisorin Mona');
	});

	it('replaces a bare login with the roster name, marked by the login domain when the name is not unique', () => {
		expect(readableSupervisionName({ source: sources[1], roster })).toBe(
			'Mona Simpson (trail.ist)'
		);
		expect(readableSupervisionName({ source: sources[0], roster })).toBe(
			'Bart Simpson (openresilience.cc)'
		);
	});

	it('uses the plain roster name when it is unique', () => {
		expect(
			readableSupervisionName({
				source: sources[1],
				roster: [roster[3]]
			})
		).toBe('Mona Simpson');
	});

	it('never shows an encoded user name and falls back to the decoded login', () => {
		expect(
			readableSupervisionName({
				source: {
					matrixUserId: MONA,
					role: 'supervisor',
					internalName: 'enc.NVXW4YJOONUW24DTN5XF6YLUL52HEYLJNQXGS43U'
				},
				roster: []
			})
		).toBe('mona.simpson@trail.ist');
	});
});

describe('resolveSupervisionPeople', () => {
	it('gives each person a name, a role and the avatar choice the chat uses', () => {
		const people = resolveSupervisionPeople({ sources, roster });
		expect(people.get(BART)).toMatchObject({
			name: 'Bart Simpson (openresilience.cc)',
			firstName: 'Bart',
			lastName: 'Simpson',
			role: 'consultant',
			choice: { kind: 'motif', file: expect.stringMatching(/dog/i) }
		});
		// No pick: the counsellor initials, exactly like beside her messages.
		expect(people.get(MONA)).toMatchObject({
			name: 'Mona Simpson (trail.ist)',
			role: 'supervisor',
			choice: { kind: 'initials' }
		});
	});

	it('lets the supervisor role win when one person is listed twice', () => {
		const people = resolveSupervisionPeople({
			sources: [
				{ ...sources[1], role: 'consultant' },
				{ ...sources[1], role: 'supervisor' }
			],
			roster
		});
		expect(people.get(MONA)?.role).toBe('supervisor');
	});
});

describe('enrichSupervisionParticipants', () => {
	it('names the header avatars with person, role and chosen avatar', () => {
		const people = resolveSupervisionPeople({ sources, roster });
		const [bart, mona, unknown] = enrichSupervisionParticipants(
			[
				{
					userId: BART,
					displayName: 'bart.simpson_at_openresilience.cc'
				},
				{ userId: MONA, displayName: 'mona.simpson_at_trail.ist' },
				{ userId: '@x:dev.oriso.org', displayName: 'x' }
			],
			people,
			{ consultant: 'Berater:in', supervisor: 'Supervisor:in' }
		);
		expect(bart).toMatchObject({
			displayName: 'Bart Simpson (openresilience.cc)',
			roleLabel: 'Berater:in',
			avatarKind: 'ICON',
			avatarId: 'dog'
		});
		expect(mona).toMatchObject({
			displayName: 'Mona Simpson (trail.ist)',
			roleLabel: 'Supervisor:in',
			avatarKind: 'INITIALS'
		});
		expect(unknown).toEqual({
			userId: '@x:dev.oriso.org',
			displayName: 'x'
		});
	});
});
