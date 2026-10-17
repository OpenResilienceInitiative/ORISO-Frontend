/**
 * People results for the session search menu (#1195, JOB2 + JOB5).
 *
 * The previous builder produced one row per session, named after the *client*
 * but subtitled with a hard-coded `Berater:in …`, so every client in the
 * preview list was labelled as a counsellor. Clients and counsellors are
 * separate roles and must be listed as such.
 */

import { describe, expect, it } from 'vitest';
import { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import {
	buildSearchPeopleResults,
	filterSearchPeople,
	lookupTermsOf,
	roleOfSearchWord,
	sessionMatchesSearchText,
	textAxisQuery,
	SessionSearchPeopleLabels
} from './sessionSearchPeople';

const labels: SessionSearchPeopleLabels = {
	asker: 'Ratsuchende:r',
	consultant: 'Berater:in',
	unknown: 'Unbekannt'
};

const sessionWithBoth = (): ListItemInterface =>
	({
		agency: { id: 77, name: 'Beratungsstelle Mainz' },
		user: { username: 'iene_lou_7575' },
		consultant: {
			consultantId: 'c-1',
			username: 'ingrid.k',
			displayName: 'Ingrid Koschmider'
		},
		session: { id: 14055, agencyId: 77, postcode: '30232' }
	}) as unknown as ListItemInterface;

const build = (items: ListItemInterface[]) =>
	buildSearchPeopleResults(
		items.map((raw) => ({ raw, extended: {} as any })),
		labels
	);

describe('buildSearchPeopleResults — role separation (JOB5)', () => {
	it('emits a separate row for the client and the counsellor of one session', () => {
		const results = build([sessionWithBoth()]);

		expect(results.map((entry) => entry.role)).toEqual([
			'asker',
			'consultant'
		]);
	});

	it('labels the client row as a client, not as a counsellor', () => {
		const [asker] = build([sessionWithBoth()]);

		expect(asker.name).toBe('iene_lou_7575');
		expect(asker.subtitle).toContain('Ratsuchende:r');
		expect(asker.subtitle).not.toContain('Berater:in');
	});

	it('labels the counsellor row with the counsellor display name', () => {
		const [, consultant] = build([sessionWithBoth()]);

		expect(consultant.name).toBe('Ingrid Koschmider');
		expect(consultant.subtitle).toContain('Berater:in');
	});

	it('keys each row by role, person and agency (FE#1725)', () => {
		const results = build([sessionWithBoth()]);

		expect(results.map((entry) => entry.id)).toEqual([
			'asker:iene_lou_7575:77',
			'consultant:c-1:77'
		]);
	});

	it('shows a counsellor with several cases once, holding all of them', () => {
		const second = {
			...sessionWithBoth(),
			user: { username: 'other_client' },
			session: { id: 14056, agencyId: 77, postcode: '10001' }
		} as unknown as ListItemInterface;

		const counsellors = build([sessionWithBoth(), second]).filter(
			(entry) => entry.role === 'consultant'
		);

		expect(counsellors).toHaveLength(1);
		expect(counsellors[0].sessionKeys).toEqual(['14055', '14056']);
	});

	it('falls back to the unknown label when a present person has no name', () => {
		const namelessConsultant = {
			user: { username: 'ratsuchender_4' },
			consultant: { consultantId: 'c-9' },
			session: { id: 902, agencyId: 77 }
		} as unknown as ListItemInterface;

		const [, consultant] = build([namelessConsultant]);

		expect(consultant.role).toBe('consultant');
		expect(consultant.name).toBe('Unbekannt');
	});

	it('omits a role that the session does not carry', () => {
		const askerOnly = {
			user: { username: 'ratsuchender_4' },
			session: { id: 900, agencyId: 77 }
		} as unknown as ListItemInterface;

		expect(build([askerOnly]).map((entry) => entry.role)).toEqual([
			'asker'
		]);
	});
});

describe('buildSearchPeopleResults — agency context (JOB1 + JOB2)', () => {
	it('carries the agency so the preview list can show the active agency', () => {
		const [asker] = build([sessionWithBoth()]);

		expect(asker.agencyId).toBe(77);
		expect(asker.agencyName).toBe('Beratungsstelle Mainz');
		expect(asker.subtitle).toContain('Beratungsstelle Mainz');
	});

	it('falls back to the session agencyId when no agency object is present', () => {
		const noAgencyObject = {
			user: { username: 'robbe_bo_8863' },
			session: { id: 901, agencyId: 42 }
		} as unknown as ListItemInterface;

		expect(build([noAgencyObject])[0].agencyId).toBe(42);
	});
});

describe('buildSearchPeopleResults — de-duplication', () => {
	it('does not emit the same row twice for a repeated session', () => {
		const results = build([sessionWithBoth(), sessionWithBoth()]);

		expect(results).toHaveLength(2);
	});
});

describe('buildSearchPeopleResults — avatars (JOB4)', () => {
	it('seeds the client avatar exactly as the chat does, so the animal matches', () => {
		// SessionListItemComponent feeds MessageAvatar
		// `askerMatrixUserId || user.username || 'unknown'`. Diverging here
		// would draw a different animal for the same person.
		const withMatrixId = {
			user: { username: 'iene_lou_7575' },
			session: { id: 1, askerMatrixUserId: '@iene:oriso' }
		} as unknown as ListItemInterface;
		const nameless = {
			user: {},
			session: { id: 2 }
		} as unknown as ListItemInterface;

		expect(build([withMatrixId])[0].avatarSeed).toBe('@iene:oriso');
		expect(build([nameless])[0].avatarSeed).toBe('unknown');
	});

	it('gives each person a stable avatar seed that differs per role', () => {
		const [asker, consultant] = build([sessionWithBoth()]);

		expect(asker.avatarSeed).toBeTruthy();
		expect(asker.avatarSeed).not.toBe(consultant.avatarSeed);
		expect(build([sessionWithBoth()])[0].avatarSeed).toBe(asker.avatarSeed);
	});
});

describe('filterSearchPeople — query narrowing', () => {
	const roster = [
		{
			id: '1:asker',
			name: 'iene_lou_7575',
			subtitle: 'Ratsuchende:r | Mainz',
			role: 'asker' as const,
			avatarSeed: 'a'
		},
		{
			id: '3:consultant',
			name: 'Ingrid Koschmider',
			subtitle: 'Berater:in | Mainz',
			role: 'consultant' as const,
			avatarSeed: 'c'
		}
	];

	it('returns the whole roster when nothing is typed', () => {
		expect(filterSearchPeople(roster, '')).toHaveLength(2);
	});

	it('lists only the eligible colleagues for a blank query when asked to, all of them once text is typed (FE#1152)', () => {
		const eligible = { ...roster[1], eligible: true };
		const people = [roster[0], eligible];
		const only = { eligibleOnlyWhenBlank: true };

		expect(filterSearchPeople(people, '', only)).toEqual([eligible]);
		expect(filterSearchPeople(people, '   ', only)).toEqual([eligible]);
		expect(filterSearchPeople(people, 'iene', only)).toEqual([roster[0]]);
		expect(filterSearchPeople([roster[0]], '', only)).toEqual([]);
	});

	it('narrows to matches when a query is typed', () => {
		expect(filterSearchPeople(roster, 'ingrid')).toEqual([roster[1]]);
	});

	it('matches on the subtitle as well as the name', () => {
		expect(filterSearchPeople(roster, 'Berater:in')).toEqual([roster[1]]);
	});

	it('ignores the selection entirely, so selecting never hides rows (JOB7)', () => {
		// The signature takes no selection: the bug was that selection state
		// was allowed to remove rows, making a second pick impossible.
		expect(filterSearchPeople).toHaveLength(2);
	});
});

describe('buildSearchPeopleResults — readable counsellor names (FE#1725)', () => {
	const encoded = 'enc.MFTWK3TDPFPWCZDNNFXDC...'; // agency_admin1

	it('never shows an encoded username, using the internal name instead', () => {
		const [person] = buildSearchPeopleResults([], labels, {
			eligibleCases: [
				{
					agency: { id: 2, name: 'Lichtenberg' },
					consultant: {
						consultantId: 'c-9',
						username: encoded,
						displayName: encoded,
						firstName: 'agency',
						lastName: 'admin1'
					},
					session: { id: 3, agencyId: 2 }
				} as unknown as ListItemInterface
			]
		});

		expect(person.name).toBe('agency admin1');
		expect(person.lookupQuery).toBe(encoded);
	});

	it('shows the decoded username when no other name exists', () => {
		const [person] = buildSearchPeopleResults([], labels, {
			eligibleCases: [
				{
					consultant: { consultantId: 'c-9', username: encoded },
					session: { id: 3, agencyId: 2 }
				} as unknown as ListItemInterface
			]
		});

		expect(person.name).toBe('agency_admin1');
	});

	it('prefers the internal name over a public name that is only the username', () => {
		const item = {
			...sessionWithBoth(),
			consultant: {
				consultantId: 'c-2',
				username: 'patty.bouvier_at_trail.ist',
				displayName: 'patty.bouvier_at_trail.ist',
				internalName: 'Patty Bouvier'
			}
		} as unknown as ListItemInterface;

		const consultant = build([item]).find(
			(entry) => entry.role === 'consultant'
		);

		expect(consultant?.name).toBe('Patty Bouvier');
	});
});

describe('buildSearchPeopleResults — eligible colleagues (FE#1152)', () => {
	const eligibleCase = (clientName: string, sessionId: number) =>
		({
			...sessionWithBoth(),
			user: { username: clientName },
			session: { id: sessionId, agencyId: 77, postcode: '30232' }
		}) as unknown as ListItemInterface;

	it('lists only the counsellor of an eligible case, once, never its client', () => {
		const people = buildSearchPeopleResults([], labels, {
			eligibleCases: [
				eligibleCase('client_a', 1),
				eligibleCase('client_b', 2)
			]
		});

		expect(people.map((entry) => entry.id)).toEqual(['consultant:c-1:77']);
		expect(people[0].searchText).not.toContain('client_a');
	});

	it('finds the colleague by the postcode of her eligible cases', () => {
		const [person] = buildSearchPeopleResults([], labels, {
			eligibleCases: [eligibleCase('client_a', 1)]
		});

		expect(filterSearchPeople([person], '30232')).toEqual([person]);
	});

	it('marks the colleagues of eligible cases, not the own list nor the signed-in counsellor', () => {
		const own = sessionWithBoth();
		const mine = {
			...sessionWithBoth(),
			consultant: { consultantId: 'me-1', username: 'me' }
		} as unknown as ListItemInterface;
		const people = buildSearchPeopleResults(
			[
				{ raw: own, extended: {} as any },
				{ raw: mine, extended: {} as any }
			],
			labels,
			{
				currentUser: { id: 'me-1', name: 'Me' },
				eligibleCases: [
					{
						...eligibleCase('client_a', 1),
						consultant: {
							consultantId: 'c-2',
							username: 'lisa',
							displayName: 'Lisa S.'
						}
					} as unknown as ListItemInterface,
					mine
				]
			}
		);

		expect(
			people.filter((entry) => entry.eligible).map((entry) => entry.id)
		).toEqual(['consultant:c-2:77']);
	});

	it('keeps a colleague eligible when she is also in the own list', () => {
		const people = buildSearchPeopleResults(
			[{ raw: sessionWithBoth(), extended: {} as any }],
			labels,
			{ eligibleCases: [eligibleCase('client_a', 1)] }
		);

		expect(
			people.find((entry) => entry.id === 'consultant:c-1:77')?.eligible
		).toBe(true);
	});

	it('merges the colleague with the same person from the own list', () => {
		const people = buildSearchPeopleResults(
			[{ raw: sessionWithBoth(), extended: {} as any }],
			labels,
			{ eligibleCases: [eligibleCase('client_a', 1)] }
		);

		const colleague = people.filter(
			(entry) => entry.id === 'consultant:c-1:77'
		);
		expect(colleague).toHaveLength(1);
		// The own-list case enriches her row: picking her lists it too.
		expect(colleague[0].sessionKeys).toContain('14055');
	});

	it('adds no counsellor who is only in the own list (e.g. supervised)', () => {
		const supervised = {
			...sessionWithBoth(),
			consultant: { consultantId: 'c-3', username: 'ned' },
			session: { id: 20, agencyId: 77 }
		} as unknown as ListItemInterface;
		const people = buildSearchPeopleResults(
			[{ raw: supervised, extended: {} as any }],
			labels,
			{ eligibleCases: [eligibleCase('client_a', 1)] }
		);

		expect(people.map((entry) => entry.id)).not.toContain(
			'consultant:c-3:77'
		);
		// Her client stays findable.
		expect(people.some((entry) => entry.role === 'asker')).toBe(true);
	});

	it('never lists the signed-in counsellor, even with own eligible-looking cases', () => {
		const mine = {
			...sessionWithBoth(),
			consultant: { consultantId: 'me-1', username: 'me' }
		} as unknown as ListItemInterface;
		const people = buildSearchPeopleResults(
			[{ raw: mine, extended: {} as any }],
			labels,
			{ currentUser: { id: 'me-1', name: 'Me' }, eligibleCases: [mine] }
		);

		expect(
			people.filter((entry) => entry.role === 'consultant')
		).toHaveLength(0);
	});

	it('lists no counsellor at all while nothing is eligible', () => {
		const people = buildSearchPeopleResults(
			[{ raw: sessionWithBoth(), extended: {} as any }],
			labels,
			{ eligibleCases: [] }
		);

		expect(people.map((entry) => entry.role)).toEqual(['asker']);
	});
});

describe('buildSearchPeopleResults — client lookup (FE#1725)', () => {
	it('looks a client up by her username when her display name differs', () => {
		const item = {
			...sessionWithBoth(),
			user: { username: 'iene_lou_7575', displayName: 'Iene L.' }
		} as unknown as ListItemInterface;

		const asker = build([item]).find((entry) => entry.role === 'asker');

		expect(asker?.name).toBe('Iene L.');
		expect(lookupTermsOf(asker!)).toEqual(['iene_lou_7575']);
	});
});

describe('role words in the shown language (FE#1725)', () => {
	const fr = {
		consultant: 'Conseiller·ère',
		asker: 'Personne en quête de conseil'
	};
	const tr = { consultant: 'Danışman', asker: 'Danışan' };

	it('recognises the role labels the People tab shows', () => {
		expect(roleOfSearchWord('Conseiller·ère', fr)).toBe('consultant');
		expect(roleOfSearchWord('personne en quête de conseil', fr)).toBe(
			'asker'
		);
		expect(roleOfSearchWord('Danışan', tr)).toBe('asker');
		expect(roleOfSearchWord('Danışan')).toBeNull();
	});

	it('keeps the cases with that role in the list', () => {
		expect(
			sessionMatchesSearchText(
				sessionWithBoth(),
				undefined,
				'Conseiller·ère',
				fr
			)
		).toBe(true);
	});

	it('stops narrowing by the role label once a person is picked', () => {
		expect(
			textAxisQuery('Danışman', [{ name: 'Ingrid Koschmider' }], tr)
		).toBe('');
		expect(
			textAxisQuery('Danışman 30232', [{ name: 'Ingrid Koschmider' }], tr)
		).toBe('30232');
	});

	it('lists the people of that role in the People tab', () => {
		const people = buildSearchPeopleResults(
			[{ raw: sessionWithBoth(), extended: {} as any }],
			{ ...labels, ...tr }
		);

		expect(
			filterSearchPeople(people, 'Danışan', { roleLabels: tr }).map(
				(entry) => entry.role
			)
		).toEqual(['asker']);
	});
});
