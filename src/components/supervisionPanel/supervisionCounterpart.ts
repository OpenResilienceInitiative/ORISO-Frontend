/**
 * Who the supervision side room is "with" (WP-B2, #996).
 *
 * The consultant talks to the supervisor; the supervisor talks to the
 * responsible consultant. Both sides are named by a display name, never by a
 * real name: `firstName`/`lastName` are deliberately not read, even when
 * they are the only fields present (the consultant session-list DTO carries
 * only `{ id, firstName, lastName }` for the consultant). The supervision
 * marker therefore carries `counsellorDisplayName` (backend #996 rule) — that
 * is the first choice in the supervisor view; the by-id lookup of the
 * consultant stays as the fallback for older backends.
 *
 * Rule per candidate: display name → username → next candidate → fallback.
 */

export type SupervisionViewerRole = 'consultant' | 'supervisor';

export interface CounterpartNameSource {
	displayName?: string | null;
	username?: string | null;
	userName?: string | null;
}

export interface SupervisionCounterpartInput {
	role: SupervisionViewerRole;
	/** Supervisor view: `supervision.counsellorDisplayName` from the marker. */
	counsellorDisplayName?: string | null;
	/** Supervisor view: the responsible consultant, possibly resolved by id. */
	consultant?: CounterpartNameSource | null;
	/** Consultant view: list-DTO display names of the supervisors. */
	supervisorDisplayNames?: ReadonlyArray<string | null | undefined>;
	/** Consultant view: usernames from the session-supervisors call. */
	supervisorUsernames?: ReadonlyArray<string | null | undefined>;
	/** Shown when nothing usable is known yet. */
	fallback: string;
}

const clean = (value: string | null | undefined): string =>
	(value ?? '').trim();

/** Display name first, then username — never a real name. */
export const pickDisplayOrUsername = (
	source: CounterpartNameSource | null | undefined
): string =>
	clean(source?.displayName) ||
	clean(source?.username) ||
	clean(source?.userName);

export const pickSupervisionCounterpartName = ({
	role,
	counsellorDisplayName,
	consultant,
	supervisorDisplayNames = [],
	supervisorUsernames = [],
	fallback
}: SupervisionCounterpartInput): string => {
	if (role === 'supervisor') {
		return (
			clean(counsellorDisplayName) ||
			pickDisplayOrUsername(consultant) ||
			fallback
		);
	}
	const firstUsable = (list: ReadonlyArray<string | null | undefined>) =>
		list.map(clean).find(Boolean) ?? '';
	return (
		firstUsable(supervisorDisplayNames) ||
		firstUsable(supervisorUsernames) ||
		fallback
	);
};

export interface AppointmentSupervisorSource {
	supervisorConsultantId?: string | null;
	supervisorUsername?: string | null;
	supervisorMatrixUserId?: string | null;
}

/**
 * The supervisor an appointment is booked with (FE#2494). Id and name come
 * from the same supervisor row, so a case with two supervisors never books
 * one person under the other's (or a combined) name: the name is that
 * person's resolved side-room name, else their username.
 */
export const pickAppointmentSupervisor = (
	supervisors: ReadonlyArray<AppointmentSupervisorSource>,
	ownUserId: string | null | undefined,
	peopleByMatrixId: ReadonlyMap<string, { name?: string | null }>
): { id: string; displayName: string } | undefined => {
	const supervisor = supervisors.find(
		(s) =>
			s.supervisorConsultantId && s.supervisorConsultantId !== ownUserId
	);
	if (!supervisor?.supervisorConsultantId) return undefined;
	const person = supervisor.supervisorMatrixUserId
		? peopleByMatrixId.get(supervisor.supervisorMatrixUserId)
		: undefined;
	return {
		id: supervisor.supervisorConsultantId,
		displayName: clean(person?.name) || clean(supervisor.supervisorUsername)
	};
};
