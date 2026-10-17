// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiGetTenantConsultantList,
	Consultant,
	fetchAgencyConsultantList
} from '../../../api/apiGetAgencyConsultantList';
import { loadInternalChatColleagues } from './loadInternalChatColleagues';

vi.mock('../../../api/apiGetAgencyConsultantList', () => ({
	apiGetTenantConsultantList: vi.fn(),
	fetchAgencyConsultantList: vi.fn()
}));

const person = (consultantId: string, agencyIds?: number[]): Consultant => ({
	consultantId,
	firstName: consultantId,
	lastName: '',
	displayName: consultantId,
	username: consultantId,
	...(agencyIds && { agencies: agencyIds.map((id) => ({ id })) })
});

const me = person('me', [7]);
const sameCentre = person('same-centre', [7]);
const otherCentre = person('other-centre', [9]);

beforeEach(() => {
	vi.resetAllMocks();
});

describe('loadInternalChatColleagues', () => {
	it('lists the counselling centre for AGENCY without asking for the whole Träger', async () => {
		vi.mocked(fetchAgencyConsultantList).mockResolvedValue([
			me,
			sameCentre
		]);

		const result = await loadInternalChatColleagues({
			scope: 'AGENCY',
			agencyId: 7,
			currentUserId: 'me'
		});

		expect(fetchAgencyConsultantList).toHaveBeenCalledWith('7');
		expect(apiGetTenantConsultantList).not.toHaveBeenCalled();
		expect(result).toEqual([sameCentre]);
	});

	it('treats an empty centre (204) as nobody to pick', async () => {
		vi.mocked(fetchAgencyConsultantList).mockResolvedValue({} as never);
		await expect(
			loadInternalChatColleagues({
				scope: 'AGENCY',
				agencyId: 7,
				currentUserId: 'me'
			})
		).resolves.toEqual([]);
	});

	it('falls back to the Träger directory narrowed to the centre when the centre list is refused', async () => {
		vi.mocked(fetchAgencyConsultantList).mockRejectedValue(
			new Error('FORBIDDEN')
		);
		vi.mocked(apiGetTenantConsultantList).mockResolvedValue([
			me,
			sameCentre,
			otherCentre,
			person('centre-unknown')
		]);

		const result = await loadInternalChatColleagues({
			scope: 'AGENCY',
			agencyId: 7,
			currentUserId: 'me'
		});

		expect(result).toEqual([sameCentre]);
	});

	it('fails when neither list can be read, so the picker can offer a retry', async () => {
		vi.mocked(fetchAgencyConsultantList).mockRejectedValue(new Error('x'));
		vi.mocked(apiGetTenantConsultantList).mockRejectedValue(new Error('y'));
		await expect(
			loadInternalChatColleagues({
				scope: 'AGENCY',
				agencyId: 7,
				currentUserId: 'me'
			})
		).rejects.toThrow();
	});

	it.each(['TENANT', 'PLATFORM'] as const)(
		'lists the whole directory for %s, without the user and without duplicates',
		async (scope) => {
			vi.mocked(apiGetTenantConsultantList).mockResolvedValue([
				me,
				sameCentre,
				otherCentre,
				otherCentre
			]);

			const result = await loadInternalChatColleagues({
				scope,
				agencyId: 7,
				currentUserId: 'me'
			});

			expect(fetchAgencyConsultantList).not.toHaveBeenCalled();
			expect(result).toEqual([sameCentre, otherCentre]);
		}
	);

	it('offers nobody for AGENCY while no centre is chosen', async () => {
		await expect(
			loadInternalChatColleagues({
				scope: 'AGENCY',
				agencyId: null,
				currentUserId: 'me'
			})
		).resolves.toEqual([]);
		expect(fetchAgencyConsultantList).not.toHaveBeenCalled();
	});
});
