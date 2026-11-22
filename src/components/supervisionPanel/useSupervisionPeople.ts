/**
 * The people of one case's supervision side room (FE#2344), resolved once
 * for the panel header and the side-room messages.
 *
 * Sources, all already on the session page: the session's counsellor (list
 * DTO + supervision marker), the active supervisors (supervisors call +
 * marker names), the viewer's own avatar, and the agency roster the
 * "Manage people" dialog shows the same people. The roster is read only
 * while the side room exists; a refused or failed read leaves the names on
 * the backend/login fallback (`supervisionPeople.ts`).
 */
import { useEffect, useMemo, useState } from 'react';
import {
	apiGetAgencyConsultantList,
	type Consultant
} from '../../api/apiGetAgencyConsultantList';
import type { SessionSupervisor } from '../../api/apiGetSessionSupervisors';
import type { AvatarIdentity } from '../../utils/avatarChoice';
import {
	resolveSupervisionPeople,
	type SupervisionPeople,
	type SupervisionPersonSource
} from './supervisionPeople';

export interface UseSupervisionPeopleInput {
	enabled: boolean;
	agencyId?: number | string | null;
	consultant?: {
		id?: string | null;
		matrixUserId?: string | null;
		/** Marker `counsellorDisplayName` (#996). */
		internalName?: string | null;
		identity?: AvatarIdentity | null;
	};
	supervisors: readonly SessionSupervisor[];
	marker?: {
		supervisorConsultantIds?: readonly string[] | null;
		supervisorDisplayNames?: readonly string[] | null;
	} | null;
	self?: { userId?: string | null; identity?: AvatarIdentity | null };
}

type RosterSnapshot = { key: string; roster: Consultant[] };

export const useSupervisionPeople = ({
	enabled,
	agencyId,
	consultant,
	supervisors,
	marker,
	self
}: UseSupervisionPeopleInput): SupervisionPeople => {
	const rosterKey = enabled && agencyId ? String(agencyId) : '';
	const [snapshot, setSnapshot] = useState<RosterSnapshot | null>(null);

	useEffect(() => {
		if (!rosterKey) return undefined;
		let cancelled = false;
		void apiGetAgencyConsultantList(rosterKey).then((roster) => {
			if (!cancelled) {
				setSnapshot({
					key: rosterKey,
					roster: Array.isArray(roster) ? roster : []
				});
			}
		});
		return () => {
			cancelled = true;
		};
	}, [rosterKey]);

	// A roster of another agency never names this case's people.
	const roster = snapshot?.key === rosterKey ? snapshot.roster : null;

	return useMemo(() => {
		if (!enabled) return new Map();
		const identityOf = (consultantId?: string | null) =>
			consultantId && consultantId === self?.userId
				? self?.identity
				: undefined;
		const markerIds = (marker?.supervisorConsultantIds ?? []).map(String);
		const markerNames = marker?.supervisorDisplayNames ?? [];
		const sources: SupervisionPersonSource[] = [];
		if (consultant?.matrixUserId) {
			sources.push({
				matrixUserId: consultant.matrixUserId,
				role: 'consultant',
				consultantId: consultant.id,
				internalName: consultant.internalName,
				identity: identityOf(consultant.id) ?? consultant.identity
			});
		}
		supervisors.forEach((supervisor) => {
			if (!supervisor.supervisorMatrixUserId) return;
			const index = markerIds.indexOf(
				String(supervisor.supervisorConsultantId)
			);
			sources.push({
				matrixUserId: supervisor.supervisorMatrixUserId,
				role: 'supervisor',
				consultantId: supervisor.supervisorConsultantId,
				internalName:
					index >= 0
						? markerNames[index]
						: supervisor.supervisorUsername,
				identity: identityOf(supervisor.supervisorConsultantId)
			});
		});
		return resolveSupervisionPeople({ sources, roster: roster ?? [] });
	}, [enabled, consultant, supervisors, marker, self, roster]);
};
