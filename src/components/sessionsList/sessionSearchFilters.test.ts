// @vitest-environment oriso-jsdom
/**
 * Search-menu filter axes (#1195, FE#1725).
 *
 * Person rows are `<role>:<userId>:<agencyId>`; selecting the client or the
 * counsellor keeps every session that person takes part in. The agency axis
 * is a single choice, because a handover never crosses centres.
 */

import { describe, expect, it } from 'vite-plus/test';
import { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import { sessionMatchesAgency } from './sessionSearchPeople';
import { sessionMatchesToolbar } from './sessionToolbarFilters';

const session = (id: number, agencyId?: number): ListItemInterface =>
	({
		user: { username: 'iene_lou_7575' },
		consultant: {
			consultantId: 'c-1',
			username: 'ingrid.k',
			displayName: 'Ingrid Koschmider'
		},
		session: { id, agencyId }
	}) as unknown as ListItemInterface;

const matches = (raw: ListItemInterface, selectedPersonIds: string[]) =>
	sessionMatchesToolbar(
		raw,
		{ item: raw.session } as any,
		'',
		null,
		selectedPersonIds,
		[]
	);

describe('sessionMatchesToolbar — person keys (FE#1725)', () => {
	it('keeps the session when its client is selected', () => {
		expect(matches(session(14055, 77), ['asker:iene_lou_7575:77'])).toBe(
			true
		);
	});

	it('keeps every session of a selected counsellor in that agency', () => {
		expect(matches(session(1, 77), ['consultant:c-1:77'])).toBe(true);
		expect(matches(session(2, 77), ['consultant:c-1:77'])).toBe(true);
	});

	it('drops the same counsellor in another agency', () => {
		expect(matches(session(3, 42), ['consultant:c-1:77'])).toBe(false);
	});

	it('combines several people with OR', () => {
		expect(
			matches(session(3, 42), ['consultant:c-1:77', 'consultant:c-1:42'])
		).toBe(true);
	});
});

describe('sessionMatchesAgency — single choice (FE#1725 US12)', () => {
	it('keeps every session when no agency is selected', () => {
		expect(sessionMatchesAgency(session(1, 77), null)).toBe(true);
	});

	it('keeps a session belonging to the selected agency', () => {
		expect(sessionMatchesAgency(session(1, 77), '77')).toBe(true);
	});

	it('drops a session belonging to another agency', () => {
		expect(sessionMatchesAgency(session(1, 42), '77')).toBe(false);
	});

	it('reads the agency object when the session carries no agencyId', () => {
		const raw = {
			user: { username: 'x' },
			session: { id: 5 },
			agency: { id: 77, name: 'Beratungsstelle Mainz' }
		} as unknown as ListItemInterface;

		expect(sessionMatchesAgency(raw, '77')).toBe(true);
	});

	it('drops a session with no agency at all when an agency is selected', () => {
		const raw = {
			user: { username: 'x' },
			session: { id: 5 }
		} as unknown as ListItemInterface;

		expect(sessionMatchesAgency(raw, '77')).toBe(false);
	});
});
