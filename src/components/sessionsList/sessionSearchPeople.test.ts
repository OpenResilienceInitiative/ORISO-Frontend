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

	it('keeps the session id recoverable from the row id', () => {
		const results = build([sessionWithBoth()]);

		expect(results.map((entry) => entry.id)).toEqual([
			'14055:asker',
			'14055:consultant'
		]);
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
