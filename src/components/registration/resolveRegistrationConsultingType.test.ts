import { describe, expect, it } from 'vitest';
import { AgencyDataInterface } from '../../globalState/interfaces';
import { resolveRegistrationConsultingType } from './resolveRegistrationConsultingType';

describe('resolveRegistrationConsultingType', () => {
	it('prefers agency consultingType over consultingTypeRel and context fallback', () => {
		expect(
			resolveRegistrationConsultingType(
				{
					id: 1,
					consultingType: 2,
					consultingTypeRel: { id: 3 } as any,
					city: '',
					description: '',
					name: '',
					offline: false,
					postcode: ''
				},
				{ id: 4 } as any
			)
		).toBe('2');
	});

	it('falls back to consultingTypeRel and registrationConsultingType', () => {
		expect(
			resolveRegistrationConsultingType(
				{
					id: 1,
					consultingTypeRel: { id: 3 } as any,
					city: '',
					description: '',
					name: '',
					offline: false,
					postcode: ''
				} as AgencyDataInterface,
				{ id: 4 } as any
			)
		).toBe('3');

		expect(
			resolveRegistrationConsultingType(
				{
					id: 1,
					city: '',
					description: '',
					name: '',
					offline: false,
					postcode: ''
				} as AgencyDataInterface,
				{ id: 4 } as any
			)
		).toBe('4');
	});

	it('falls back to consultant agencies when selected agency has no consulting type', () => {
		expect(
			resolveRegistrationConsultingType(
				{
					id: 1,
					city: '',
					description: '',
					name: '',
					offline: false,
					postcode: ''
				} as AgencyDataInterface,
				null,
				[
					{
						id: 1,
						consultingType: 1,
						city: '',
						description: '',
						name: '',
						offline: false,
						postcode: ''
					}
				]
			)
		).toBe('1');
	});
});
