// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import { toAgencyContact } from './apiGetAgencyContactPerson';

describe('toAgencyContact (ORISO-Admin#1534)', () => {
	it('keeps a well-formed answer', () => {
		expect(
			toAgencyContact({
				source: 'OWN',
				people: [
					{
						role: 'CONTACT',
						displayName: ' Maria ',
						email: 'maria@example.org',
						isConsultant: true,
						chatConsultantId: 'c-1'
					}
				],
				traegerContactEmail: 'info@example.org'
			})
		).toEqual({
			source: 'OWN',
			people: [
				{
					role: 'CONTACT',
					displayName: 'Maria',
					email: 'maria@example.org',
					isConsultant: true,
					chatConsultantId: 'c-1'
				}
			],
			traegerContactEmail: 'info@example.org'
		});
	});

	it('drops malformed people and an unknown role', () => {
		const contact = toAgencyContact({
			source: 'FALLBACK_AGENCY_ADMINS',
			people: [
				null,
				{ role: 'ADMIN', displayName: '' },
				{ role: 'BOSS', displayName: 'X' },
				{ role: 'ADMIN', displayName: 'Alex' }
			]
		});
		expect(contact.people.map((p) => p.displayName)).toEqual(['Alex']);
		expect(contact.people[0].chatConsultantId).toBeNull();
		expect(contact.people[0].isConsultant).toBe(false);
	});

	it.each([
		['an empty body (204)', {}],
		['no people', { source: 'OWN', people: [] }],
		[
			'an unknown source',
			{ source: 'MAGIC', people: [{ role: 'ADMIN', displayName: 'A' }] }
		]
	])('treats %s as SUPPORT_EMAIL', (_label, body) => {
		expect(toAgencyContact(body)).toEqual({
			source: 'SUPPORT_EMAIL',
			people: [],
			traegerContactEmail: null
		});
	});
});
