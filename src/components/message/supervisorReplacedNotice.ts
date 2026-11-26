/**
 * ORISO-Frontend#2494 *6: the server posts this notice into the supervision
 * side room when the counsellor replaces the supervisor. The old supervisor
 * has already left the room, so only the counsellor and the new supervisor
 * read it; the client room never gets it. The payload carries names and the
 * reason only; the wording is translated here, in the reader's language
 * (same pattern as the rename notice).
 */
export const SYSTEM_NOTIFICATION_SUPERVISOR_REPLACED = 'SUPERVISOR_REPLACED';

export interface SupervisorReplacedNotice {
	previousName: string;
	newName: string;
	reason?: string;
}

const nonBlank = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

export const parseSupervisorReplacedNotice = (
	payload: unknown
): SupervisorReplacedNotice | null => {
	if (!payload || typeof payload !== 'object') return null;
	const { type, previousName, newName, reason } = payload as Record<
		string,
		unknown
	>;
	if (type !== SYSTEM_NOTIFICATION_SUPERVISOR_REPLACED) return null;
	const previous = nonBlank(previousName);
	const next = nonBlank(newName);
	if (!previous || !next) return null;
	const why = nonBlank(reason);
	return why
		? { previousName: previous, newName: next, reason: why }
		: { previousName: previous, newName: next };
};

export const supervisorReplacedNoticeText = (
	notice: SupervisorReplacedNotice,
	translate: (key: string, options?: Record<string, unknown>) => string
): { title: string; description: string } => {
	// A short name such as "Mona S." already ends the sentence; avoid "S..".
	const change = translate('message.supervisionChangedDescription', {
		name: notice.newName,
		from: notice.previousName
	}).replace(/\.\.$/, '.');
	return {
		title: translate('message.supervisionChangedTitle'),
		description: notice.reason
			? `${change} ${translate('message.supervisionChangedReason', {
					reason: notice.reason
				})}`
			: change
	};
};
