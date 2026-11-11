import { describe, expect, it } from 'vite-plus/test';
import {
	getSessionMenuAgency,
	getSessionMenuLegalDepartment
} from './sessionMenuAgency';

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

// ORISO-Admin#1490: the ⋮ menu's Impressum/Datenschutz must open the advice
// centre's published document, which is keyed by (agency, topic).
describe('getSessionMenuLegalDepartment', () => {
	it("names the session's agency and topic", () => {
		expect(
			getSessionMenuLegalDepartment(
				session({
					agency: sessionAgency,
					isGroup: false,
					item: { topic: { id: 14, name: 'Schulden' } }
				})
			)
		).toEqual({ agencyId: 7, topicId: 14 });
	});

	it('falls back to mainTopicId when the topic object is absent', () => {
		expect(
			getSessionMenuLegalDepartment(
				session({
					agency: sessionAgency,
					item: { topic: null, mainTopicId: 22 }
				})
			)
		).toEqual({ agencyId: 7, topicId: 22 });
	});

	it("uses a group's hosting agency", () => {
		expect(
			getSessionMenuLegalDepartment(
				session({
					agency: sessionAgency,
					isGroup: true,
					item: { assignedAgencies: [groupAgency], mainTopicId: 5 }
				})
			)
		).toEqual({ agencyId: 101, topicId: 5 });
	});

	it('is null without a topic, so the dialog keeps the tenant text', () => {
		expect(
			getSessionMenuLegalDepartment(
				session({ agency: sessionAgency, item: { topic: 'Schulden' } })
			)
		).toBeNull();
	});

	it('is null without an agency', () => {
		expect(
			getSessionMenuLegalDepartment(
				session({ item: { topic: { id: 14, name: 'Schulden' } } })
			)
		).toBeNull();
	});
});
