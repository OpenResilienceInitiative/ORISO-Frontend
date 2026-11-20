import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

/**
 * Switches the counsellor's absence on or off. The optional first and last
 * day (YYYY-MM-DD, inclusive) make it a planned absence (ORISO-Frontend#2303);
 * without them it lasts until switched off. Switching off clears the days.
 */
export const apiSetAbsence = async (
	absentBoolVal: boolean,
	message: string,
	range?: { start?: string | null; end?: string | null }
) => {
	const url = endpoints.setAbsence;
	const absenceData = JSON.stringify({
		absent: absentBoolVal,
		message: message ?? null,
		...(absentBoolVal && range?.start && { start: range.start }),
		...(absentBoolVal && range?.end && { end: range.end })
	});

	return fetchData({
		url: url,
		method: FETCH_METHODS.PUT,
		bodyData: absenceData
	});
};
