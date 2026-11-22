import { DepartmentLegalData } from '../../../api/apiGetDepartmentLegal';
import { resolveLegalContent } from '../../../utils/legalContent';

/**
 * Whether the department legal lookup answered, and answered that no privacy
 * text exists for the centre at any level (department, centre, Träger,
 * platform): `/legal` then returns 200 with `sourceLevel: NONE` and no content.
 *
 * This only checks that a text *exists*. It never says the stored text is
 * legally correct, and an unknown answer (`null`: 404, failed lookup) is not a
 * missing notice — nothing is claimed about a centre we could not read
 * (ORISO-AgencyService#366).
 */
export const isPrivacyNoticeMissing = (
	data: DepartmentLegalData | null | undefined
): boolean => !!data && !resolveLegalContent(data.dpp?.content, 'de');
