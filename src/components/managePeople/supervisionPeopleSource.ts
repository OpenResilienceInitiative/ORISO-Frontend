import { fetchAgencyConsultantList } from '../../api/apiGetAgencyConsultantList';
import type { Consultant } from '../../api/apiGetAgencyConsultantList';
import { apiAddSessionSupervisor } from '../../api/apiAddSessionSupervisor';
import { apiGetSessionSupervisors } from '../../api/apiGetSessionSupervisors';
import type { SessionSupervisor } from '../../api/apiGetSessionSupervisors';
import { apiRemoveSessionSupervisor } from '../../api/apiRemoveSessionSupervisor';
import { apiReplaceSessionSupervisor } from '../../api/apiReplaceSessionSupervisor';
import { filterEligibleSupervisorConsultants } from '../sessionHeader/supervisorDirectory';
import {
	ManagedPeopleSource,
	ManagedPerson,
	PersonCandidate,
	readablePersonName
} from './managedPeople';

export interface SupervisionPeopleSourceOptions {
	sessionId: number;
	/** Directory of the case's agency; the caller resolves it from the session. */
	agencyId: string | null;
	currentConsultantId?: string | null;
	/**
	 * Shown for a supervisor the directory does not name. Never the login: it
	 * would reach the dialog and the case room's system message.
	 */
	unknownName: string;
	/**
	 * After a change: system message, notifications, practice refresh,
	 * history keys. Never awaited: the dialog shows the new state at once.
	 */
	onChanged?: (change: SupervisionChange) => void | Promise<void>;
}

export type SupervisionChange =
	| { kind: 'added'; name: string }
	| { kind: 'removed'; name: string }
	| {
			kind: 'replaced';
			from: string;
			to: string;
			/** The side room the new supervisor continues (#2494 *6). */
			sideRoomId?: string | null;
			supervisorMatrixUserId?: string | null;
	  };

/** Bookkeeping must neither block nor break the dialog. */
const announce = (
	onChanged: SupervisionPeopleSourceOptions['onChanged'],
	change: SupervisionChange
) => {
	try {
		void Promise.resolve(onChanged?.(change)).catch(() => undefined);
	} catch {
		// The change itself succeeded.
	}
};

const consultantName = (consultant: Consultant): string =>
	readablePersonName(
		[consultant.firstName, consultant.lastName].filter(Boolean).join(' ') ||
			consultant.displayName,
		consultant.username,
		consultant.consultantId
	);

/**
 * Supervision of one case, on the endpoints the header already used. The
 * server decides who may supervise: a person who is not marked as supervisor,
 * the counsellor themselves and people already in never appear as candidates.
 * Names are never an encoded `enc.` user name (the DTO has no display name).
 */
export const createSupervisionPeopleSource = ({
	sessionId,
	agencyId,
	currentConsultantId,
	unknownName,
	onChanged
}: SupervisionPeopleSourceOptions): ManagedPeopleSource => {
	let supervisors: SessionSupervisor[] = [];
	let directory: Consultant[] = [];

	const nameOfSupervisor = (supervisor: SessionSupervisor): string => {
		const known = directory.find(
			({ consultantId }) =>
				consultantId === supervisor.supervisorConsultantId
		);
		// Without the directory only the login is known; a login is not a
		// name to show in the dialog or to post into the case room.
		return known ? consultantName(known) : unknownName;
	};

	return {
		kind: 'supervision',
		requiresReason: true,
		replaceCanNotifyClient: true,
		loadMembers: async () => {
			supervisors = await apiGetSessionSupervisors(sessionId);
			if (agencyId && directory.length === 0) {
				// A refused directory only costs the nicer names.
				directory = await fetchAgencyConsultantList(agencyId).catch(
					() => []
				);
			}
			return supervisors.map(
				(supervisor): ManagedPerson => ({
					id: String(supervisor.id),
					name: nameOfSupervisor(supervisor),
					role: 'supervisor',
					since: supervisor.addedDate,
					reason: supervisor.notes ?? undefined,
					isSelf:
						supervisor.supervisorConsultantId ===
						currentConsultantId,
					canRemove: true,
					canReplace: true
				})
			);
		},
		loadCandidates: async (): Promise<PersonCandidate[]> => {
			if (!agencyId) {
				throw new Error('No agency for the supervisor directory');
			}
			// The current supervisors are read here too: the members request
			// runs in parallel and may not have answered yet.
			[directory, supervisors] = await Promise.all([
				fetchAgencyConsultantList(agencyId),
				apiGetSessionSupervisors(sessionId)
			]);
			return filterEligibleSupervisorConsultants({
				consultants: directory,
				currentConsultantId,
				currentSupervisorIds: supervisors.map(
					({ supervisorConsultantId }) => supervisorConsultantId
				)
			}).map((consultant) => ({
				id: consultant.consultantId,
				name: consultantName(consultant)
			}));
		},
		addPerson: async (candidate, { reason }) => {
			await apiAddSessionSupervisor(sessionId, candidate.id, reason);
			announce(onChanged, { kind: 'added', name: candidate.name });
		},
		/**
		 * One server step (#2494 *6): the server checks the new person first,
		 * so a refused candidate leaves the case unchanged. It keeps the
		 * supervision side room, posts the one notice there and logs one swap.
		 */
		replacePerson: async (person, candidate, { reason, notifyClient }) => {
			const added = await apiReplaceSessionSupervisor(
				sessionId,
				Number(person.id),
				candidate.id,
				reason,
				notifyClient !== false
			);
			announce(onChanged, {
				kind: 'replaced',
				from: person.name,
				to: candidate.name,
				sideRoomId: added?.matrixRoomId,
				supervisorMatrixUserId: added?.supervisorMatrixUserId
			});
		},
		removePerson: async (person) => {
			await apiRemoveSessionSupervisor(sessionId, Number(person.id));
			announce(onChanged, { kind: 'removed', name: person.name });
		}
	};
};
