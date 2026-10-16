import { describe, expect, it } from 'vitest';
import { getSessionMenuAgency } from './sessionMenuAgency';

const groupAgency = { id: 101, name: 'Beratungsstelle Mitte' };
const sessionAgency = { id: 7, name: 'Beratungsstelle Nord' };

const session = (overrides: Record<string, unknown>) =>
	({ item: {}, ...overrides }) as Parameters<typeof getSessionMenuAgency>[0];

describe('getSessionMenuAgency', () => {
	it('uses the session agency when there is one', () => {
		expect(
			getSessionMenuAgency(
				session({
					agency: sessionAgency,
					isGroup: true,
					item: { assignedAgencies: [groupAgency] }
				})
			)
		).toBe(sessionAgency);
	});

	it("falls back to a group's first assigned agency", () => {
		expect(
			getSessionMenuAgency(
				session({
					isGroup: true,
					item: { assignedAgencies: [groupAgency, sessionAgency] }
				})
			)
		).toBe(groupAgency);
	});

	it('names no agency for a group without assigned agencies', () => {
		expect(
			getSessionMenuAgency(
				session({ isGroup: true, item: { assignedAgencies: [] } })
			)
		).toBeUndefined();
	});

	it('ignores assignedAgencies outside groups', () => {
		expect(
			getSessionMenuAgency(
				session({
					isGroup: false,
					item: { assignedAgencies: [groupAgency] }
				})
			)
		).toBeUndefined();
	});
});
