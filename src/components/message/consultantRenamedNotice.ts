/**
 * OBP 2.1 #119 / ORISO-UserService#1533: the server posts this notice into a
 * counsellor's active chats when their published display name changes. It
 * carries both names only; the wording is translated here, in the reader's
 * own language.
 */
export const SYSTEM_NOTIFICATION_CONSULTANT_RENAMED = 'CONSULTANT_RENAMED';

export interface ConsultantRenamedNotice {
	oldName: string;
	newName: string;
}

const nonBlank = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

export const parseConsultantRenamedNotice = (
	payload: unknown
): ConsultantRenamedNotice | null => {
	if (!payload || typeof payload !== 'object') return null;
	const { type, oldName, newName } = payload as Record<string, unknown>;
	if (type !== SYSTEM_NOTIFICATION_CONSULTANT_RENAMED) return null;
	const previous = nonBlank(oldName);
	const next = nonBlank(newName);
	// Only a real change is announced (the server skips no-ops too).
	return previous && next && previous !== next
		? { oldName: previous, newName: next }
		: null;
};

export const consultantRenamedNoticeText = (
	notice: ConsultantRenamedNotice,
	translate: (key: string, options?: Record<string, unknown>) => string
): { title: string; description: string } => ({
	title: translate('message.consultantRenamedTitle'),
	description: translate('message.consultantRenamedDescription', {
		oldName: notice.oldName,
		newName: notice.newName
	})
});
