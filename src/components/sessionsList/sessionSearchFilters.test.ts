// @vitest-environment jsdom
/**
 * Search-menu filter axes (#1195).
 *
 * JOB1 — a counsellor who belongs to two agencies must be able to filter along
 * both of them, so the agency axis accepts a set of agency ids.
 *
 * JOB5 — person rows are now `<sessionId>:<role>`, but the session list is
 * still filtered by session, so selecting either the client or the counsellor
 * of a session must keep that session visible.
 */

import { describe, expect, it } from 'vitest';
import { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import { sessionMatchesAgencies } from './sessionSearchPeople';
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

describe('sessionMatchesToolbar — role-suffixed person ids (JOB5)', () => {
	it('keeps the session when its client row is selected', () => {
		expect(matches(session(14055), ['14055:asker'])).toBe(true);
	});

	it('keeps the session when its counsellor row is selected', () => {
		expect(matches(session(14055), ['14055:consultant'])).toBe(true);
	});

	it('drops a session whose id is not among the selected rows', () => {
		expect(matches(session(999), ['14055:asker'])).toBe(false);
	});
});

describe('sessionMatchesAgencies — two-agency filtering (JOB1)', () => {
	it('keeps every session when no agency is selected', () => {
		expect(sessionMatchesAgencies(session(1, 77), [])).toBe(true);
	});

	it('keeps a session belonging to the single selected agency', () => {
		expect(sessionMatchesAgencies(session(1, 77), [77])).toBe(true);
	});

	it('drops a session belonging to another agency', () => {
		expect(sessionMatchesAgencies(session(1, 42), [77])).toBe(false);
	});

	it('filters along both agencies of a two-agency counsellor', () => {
		const selected = [77, 42];

		expect(sessionMatchesAgencies(session(1, 77), selected)).toBe(true);
		expect(sessionMatchesAgencies(session(2, 42), selected)).toBe(true);
		expect(sessionMatchesAgencies(session(3, 13), selected)).toBe(false);
	});

	it('reads the agency object when the session carries no agencyId', () => {
		const raw = {
			user: { username: 'x' },
			session: { id: 5 },
			agency: { id: 77, name: 'Beratungsstelle Mainz' }
		} as unknown as ListItemInterface;

		expect(sessionMatchesAgencies(raw, [77])).toBe(true);
	});

	it('drops a session with no agency at all when an agency is selected', () => {
		const raw = {
			user: { username: 'x' },
			session: { id: 5 }
		} as unknown as ListItemInterface;

		expect(sessionMatchesAgencies(raw, [77])).toBe(false);
	});
});
