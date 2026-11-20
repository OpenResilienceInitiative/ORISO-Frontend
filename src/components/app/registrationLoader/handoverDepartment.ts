/**
 * The department (ADR-003: agency × topic) a person registered for, carried
 * across the document load after "Registrieren". The waiting room's legal
 * links open that department's documents on both sides of the load; without
 * it they would fall back to the platform's (ADR-022).
 *
 * Best-effort like the rest of the hand-off: Web Storage may be disabled,
 * and then the links fall back to the platform documents.
 */
export type HandoverDepartment = { agencyId: number; topicId: number };

const KEY = 'handover-department';
const GROUP_KEY = 'handover-group-join';

type WithId = { id?: number | string } | null | undefined;

/* One derivation for the frame before the load and the value stored for after
   it, so the two cannot drift apart (#1219). */
export const toHandoverDepartment = (data: {
	agency?: WithId;
	topic?: WithId;
	mainTopic?: WithId;
}): HandoverDepartment | null => {
	const topicId = (data.topic || data.mainTopic)?.id;
	return data.agency?.id && topicId
		? { agencyId: Number(data.agency.id), topicId: Number(topicId) }
		: null;
};

const isDepartment = (value: unknown): value is HandoverDepartment =>
	typeof value === 'object' &&
	value !== null &&
	Number.isInteger((value as HandoverDepartment).agencyId) &&
	Number.isInteger((value as HandoverDepartment).topicId);

export const rememberHandoverDepartment = (
	department: HandoverDepartment | null
) => {
	try {
		if (department) sessionStorage.setItem(KEY, JSON.stringify(department));
		else sessionStorage.removeItem(KEY);
	} catch {
		/* the links fall back to the platform documents */
	}
};

export const readHandoverDepartment = (): HandoverDepartment | null => {
	try {
		const parsed: unknown = JSON.parse(
			sessionStorage.getItem(KEY) ?? 'null'
		);
		return isDepartment(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

/**
 * Whether the registration joined a group (`getGroupJoin` accepted the link),
 * decided before the load. The URL keeps `gcid` either way, so after the load
 * it cannot tell a group join from an ordinary registration on a group link.
 */
export const rememberHandoverGroupJoin = (joinsTheGroup: boolean) => {
	try {
		sessionStorage.setItem(GROUP_KEY, String(joinsTheGroup));
	} catch {
		/* the app falls back to the URL */
	}
};

/** `null` when nothing was stored, so the caller can fall back to the URL. */
export const readHandoverGroupJoin = (): boolean | null => {
	try {
		const stored = sessionStorage.getItem(GROUP_KEY);
		return stored === 'true' ? true : stored === 'false' ? false : null;
	} catch {
		return null;
	}
};

export const forgetHandoverDepartment = () => {
	rememberHandoverDepartment(null);
	try {
		sessionStorage.removeItem(GROUP_KEY);
	} catch {
		/* nothing to forget */
	}
};
