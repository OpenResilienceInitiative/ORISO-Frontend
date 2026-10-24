import { describe, expect, it } from 'vitest';
import type { Consultant } from '../../../api/apiGetAgencyConsultantList';
import {
	filterColleaguesForScope,
	resolveRecipientScope
} from './recipientScope';

const colleague = (consultantId: string, agencyIds?: number[]): Consultant => ({
	consultantId,
	firstName: consultantId,
	lastName: '',
	displayName: consultantId,
	username: consultantId,
	...(agencyIds && { agencies: agencyIds.map((id) => ({ id })) })
});

describe('resolveRecipientScope', () => {
	it.each(['AGENCY', 'TENANT', 'PLATFORM'] as const)(
		'reads %s from the public tenant payload',
		(value) => {
			expect(
				resolveRecipientScope({
					internalGroupChat: { recipientScope: { value } }
				})
			).toBe(value);
		}
	);

	it.each([
		['no tenant', undefined],
		['a tenant without the setting', {}],
		['a setting without a value', { internalGroupChat: {} }],
		[
			'an unknown value',
			{ internalGroupChat: { recipientScope: { value: 'GALAXY' } } }
		]
	])('falls back to the counselling centre for %s', (_label, tenant) => {
		expect(resolveRecipientScope(tenant as never)).toBe('AGENCY');
	});
});

describe('filterColleaguesForScope', () => {
	const sameCentre = colleague('same-centre', [7, 8]);
	const otherCentre = colleague('other-centre', [9]);
	const unknownCentre = colleague('unknown-centre');
	const all = [sameCentre, otherCentre, unknownCentre];

	it('offers only colleagues known to belong to the chosen counselling centre for AGENCY', () => {
		expect(
			filterColleaguesForScope({
				scope: 'AGENCY',
				colleagues: all,
				agencyId: 7
			})
		).toEqual([sameCentre]);
	});

	it('offers nobody for AGENCY while no centre is chosen', () => {
		expect(
			filterColleaguesForScope({
				scope: 'AGENCY',
				colleagues: all,
				agencyId: null
			})
		).toEqual([]);
	});

	it('fails closed: a colleague whose centres are not delivered is not offered', () => {
		expect(
			filterColleaguesForScope({
				scope: 'AGENCY',
				colleagues: [unknownCentre, colleague('empty-list', [])],
				agencyId: 7
			})
		).toEqual([]);
	});

	it.each(['TENANT', 'PLATFORM'] as const)(
		'offers the whole directory for %s regardless of the centre',
		(scope) => {
			expect(
				filterColleaguesForScope({
					scope,
					colleagues: all,
					agencyId: 7
				})
			).toEqual(all);
		}
	);
});
