import { describe, expect, it } from 'vite-plus/test';
import { getSessionMenuAgency } from './sessionMenuAgency';

const groupAgency = { id: 101, name: 'Beratungsstelle Mitte' };
const sessionAgency = { id: 7, name: 'Beratungsstelle Nord' };

const session = (overrides: Record<string, unknown>) =>
	({ item: {}, ...overrides }) as Parameters<typeof getSessionMenuAgency>[0];

describe('getSessionMenuAgency', () => {
	it("prefers a group's hosting agency over the session agency", () => {
		expect(
			getSessionMenuAgency(
				session({
					agency: sessionAgency,
					isGroup: true,
					item: { assignedAgencies: [groupAgency] }
				})
			)
		).toBe(groupAgency);
	});

	it("uses a group's first assigned agency", () => {
		expect(
			getSessionMenuAgency(
				session({
					isGroup: true,
					item: { assignedAgencies: [groupAgency, sessionAgency] }
				})
			)
		).toBe(groupAgency);
	});

	it('falls back to the session agency for a group without assigned agencies', () => {
		expect(
			getSessionMenuAgency(
				session({
					agency: sessionAgency,
					isGroup: true,
					item: { assignedAgencies: [] }
				})
			)
		).toBe(sessionAgency);
	});

	it('names no agency when neither is known', () => {
		expect(
			getSessionMenuAgency(session({ isGroup: true, item: {} }))
		).toBeUndefined();
	});

	it('uses the session agency outside groups', () => {
		expect(
			getSessionMenuAgency(
				session({
					agency: sessionAgency,
					isGroup: false,
					item: { assignedAgencies: [groupAgency] }
				})
			)
		).toBe(sessionAgency);
	});
});
