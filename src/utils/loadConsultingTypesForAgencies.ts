import { apiGetConsultingType } from '../api';
import { apiGetAgencyById } from '../api/apiGetAgencyId';
import { AgencyDataInterface } from '../globalState/interfaces';

const enrichAgenciesWithConsultingType = async (
	agencies: AgencyDataInterface[]
): Promise<AgencyDataInterface[]> =>
	Promise.all(
		agencies.map(async (agency) => {
			if (agency?.consultingType != null || !agency?.id) {
				return agency;
			}

			const fetchedAgency = await apiGetAgencyById(
				agency.id,
				false
			).catch(() => null);
			return fetchedAgency?.consultingType != null
				? { ...agency, ...fetchedAgency }
				: agency;
		})
	);

export const loadConsultingTypesForAgencies = async (
	agencies: AgencyDataInterface[]
): Promise<AgencyDataInterface[]> => {
	const agenciesWithConsultingType =
		await enrichAgenciesWithConsultingType(agencies);

	// Get unique consultingTypes to prevent multiple requests to api
	const uniqueConsultingTypeIds = [
		...new Set(
			agenciesWithConsultingType
				.map((a) => a.consultingType)
				.filter((ct): ct is number => ct != null)
		)
	];

	return Promise.all(
		uniqueConsultingTypeIds.map((consultingTypeId) =>
			apiGetConsultingType({
				consultingTypeId
			})
		)
	).then((consultingTypes) =>
		agenciesWithConsultingType.map((a) => ({
			...a,
			consultingTypeRel: consultingTypes.find(
				(c) => c.id === a.consultingType
			)
		}))
	);
};
