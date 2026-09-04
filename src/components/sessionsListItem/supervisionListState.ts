/**
 * Supervision state of one session-list row (ADR-008, list marker).
 *
 * The backend (UserService, `SessionDTO.supervision`) tells the list whether
 * the requesting consultant is an active supervisor of the session and who the
 * supervisors are. Before that field existed the list could only guess from
 * `consultant.id !== me`, which is also true for every silent member and every
 * case-handover candidate — so the supervisor saw the eye icon and "request
 * access" instead of a supervision marker.
 *
 * Contract:
 *   - `'supervisedByMe'`    → the viewer is an active supervisor of the row.
 *   - `'supervisedByOthers'` → at least one supervisor exists, the viewer is not
 *                              one of them (typically: the owning consultant).
 *   - `'none'`              → no supervisors, OR the backend did not send the
 *                              marker at all (`supervision === undefined`).
 *                              Callers that need the old heuristic must check
 *                              `hasSupervisionMarker` themselves.
 */
export type SupervisionListState =
	| 'none'
	| 'supervisedByMe'
	| 'supervisedByOthers';

export interface SupervisionMarker {
	supervisedByMe?: boolean;
	supervisorConsultantIds?: ReadonlyArray<string | number>;
	supervisorDisplayNames?: ReadonlyArray<string>;
}

export interface SupervisionListSessionInput {
	item?: {
		supervision?: SupervisionMarker | null;
	} | null;
	consultant?: {
		id?: string | number;
	} | null;
}

const getMarker = (
	session: SupervisionListSessionInput | null | undefined
): SupervisionMarker | undefined => session?.item?.supervision ?? undefined;

/** True when the backend sent the marker (even an empty one). */
export const hasSupervisionMarker = (
	session: SupervisionListSessionInput | null | undefined
): boolean => getMarker(session) !== undefined;

export const getSupervisionListState = (
	session: SupervisionListSessionInput | null | undefined,
	userId: string | number | null | undefined
): SupervisionListState => {
	const marker = getMarker(session);
	if (!marker || userId === undefined || userId === null || userId === '') {
		return 'none';
	}
	const ids = (marker.supervisorConsultantIds ?? []).map(String);
	if (marker.supervisedByMe === true || ids.includes(String(userId))) {
		return 'supervisedByMe';
	}
	if (ids.length > 0) {
		return 'supervisedByOthers';
	}
	return 'none';
};

export const isActiveSupervisorOf = (
	session: SupervisionListSessionInput | null | undefined,
	userId: string | number | null | undefined
): boolean => getSupervisionListState(session, userId) === 'supervisedByMe';

/** Display names of all supervisors; ids stand in for missing names. */
export const getSupervisorDisplayNames = (
	session: SupervisionListSessionInput | null | undefined
): string[] => {
	const marker = getMarker(session);
	if (!marker) {
		return [];
	}
	const ids = (marker.supervisorConsultantIds ?? []).map(String);
	const names = marker.supervisorDisplayNames ?? [];
	const count = Math.max(ids.length, names.length);
	const result: string[] = [];
	for (let i = 0; i < count; i += 1) {
		const name = (names[i] || '').trim();
		result.push(name || ids[i] || '');
	}
	return result.filter(Boolean);
};
