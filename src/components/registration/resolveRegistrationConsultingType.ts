import { AgencyDataInterface } from '../../globalState/interfaces';
import { ConsultingTypeInterface } from '../../globalState/interfaces/ConsultingTypeInterface';

const resolveFromAgency = (
	agency?: AgencyDataInterface
): string | undefined => {
	if (agency?.consultingType != null) {
		return String(agency.consultingType);
	}
	if (agency?.consultingTypeRel?.id != null) {
		return String(agency.consultingTypeRel.id);
	}
	return undefined;
};

export const resolveRegistrationConsultingType = (
	agency?: AgencyDataInterface,
	registrationConsultingType?: ConsultingTypeInterface | null,
	consultantAgencies?: AgencyDataInterface[]
): string | undefined => {
	for (const candidate of [agency, ...(consultantAgencies ?? [])]) {
		const resolved = resolveFromAgency(candidate);
		if (resolved) {
			return resolved;
		}
	}
	if (registrationConsultingType?.id != null) {
		return String(registrationConsultingType.id);
	}
	return undefined;
};
