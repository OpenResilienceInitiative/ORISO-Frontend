import { fetchAgencyConsultantList } from '../../api/apiGetAgencyConsultantList';
import type { Consultant } from '../../api/apiGetAgencyConsultantList';
import { apiAddSessionSupervisor } from '../../api/apiAddSessionSupervisor';
import { apiGetSessionSupervisors } from '../../api/apiGetSessionSupervisors';
import type { SessionSupervisor } from '../../api/apiGetSessionSupervisors';
import { apiRemoveSessionSupervisor } from '../../api/apiRemoveSessionSupervisor';
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
	/** After a change: system message, notifications, practice refresh. */
	onChanged?: (
		change:
			| { kind: 'added'; name: string }
			| { kind: 'removed'; name: string }
			| { kind: 'replaced'; from: string; to: string }
	) => void | Promise<void>;
}

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
	onChanged
}: SupervisionPeopleSourceOptions): ManagedPeopleSource => {
	let supervisors: SessionSupervisor[] = [];
	let directory: Consultant[] = [];

	const nameOfSupervisor = (supervisor: SessionSupervisor): string => {
		const known = directory.find(
			({ consultantId }) =>
				consultantId === supervisor.supervisorConsultantId
		);
		return known
			? consultantName(known)
			: readablePersonName(
					null,
					supervisor.supervisorUsername,
					supervisor.supervisorConsultantId
				);
	};

	return {
		kind: 'supervision',
		requiresReason: true,
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
			directory = await fetchAgencyConsultantList(agencyId);
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
			await onChanged?.({ kind: 'added', name: candidate.name });
		},
		/**
		 * One step for the counsellor: the old supervisor goes first, so nobody
		 * keeps reading along after the counsellor chose to change. If adding
		 * the new person then fails, the removal still stands and is reported,
		 * and the error reaches the dialog, which reloads the real state.
		 */
		replacePerson: async (person, candidate, { reason }) => {
			await apiRemoveSessionSupervisor(sessionId, Number(person.id));
			try {
				await apiAddSessionSupervisor(sessionId, candidate.id, reason);
			} catch (error) {
				await onChanged?.({ kind: 'removed', name: person.name });
				throw error;
			}
			await onChanged?.({
				kind: 'replaced',
				from: person.name,
				to: candidate.name
			});
		},
		removePerson: async (person) => {
			await apiRemoveSessionSupervisor(sessionId, Number(person.id));
			await onChanged?.({ kind: 'removed', name: person.name });
		}
	};
};
