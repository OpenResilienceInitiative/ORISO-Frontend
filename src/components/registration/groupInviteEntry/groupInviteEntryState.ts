import { parseGroupChatInviteId } from '../../groupChat/groupChatInviteLink';
/**
 * Self-help group invite entry (#1499, FE#1289): `/login?gcid=<id>&aid=<agency>`
 * brings a newcomer to the designed entry screen (Storybook "0a — Eintritt:
 * ohne Konto") instead of topic → postcode → agency. The link already names
 * the agency; the topic follows from it when the agency has exactly one.
 */

/** Steps the entry screen covers: the link answers the first three. */
const INVITE_ENTRY_STEP_NAMES = [
	'topic-selection',
	'zipcode',
	'agency-selection',
	'account-data'
];

/** Router state of the entry's "Einloggen": show the form, do not bounce back. */
export const INVITE_LOGIN_STATE = { inviteLogin: true } as const;

export const isInviteLoginState = (state: unknown): boolean =>
	Boolean(
		state &&
			typeof state === 'object' &&
			(state as { inviteLogin?: unknown }).inviteLogin === true
	);

const present = (value?: string | null) => Boolean(value?.trim());

export const shouldOpenGroupInviteEntry = ({
	gcid,
	aid,
	hasSession,
	loginChosen
}: {
	gcid?: string | null;
	aid?: string | null;
	hasSession: boolean;
	loginChosen: boolean;
}): boolean => present(gcid) && present(aid) && !hasSession && !loginChosen;

export const buildGroupInviteEntryPath = (gcid: string, aid: string) =>
	`/registration/account-data?${new URLSearchParams({
		gcid: gcid.trim(),
		aid: aid.trim()
	}).toString()}`;

export const getGroupInviteTopicId = (
	agency?: { topicIds?: number[] | null } | null
): number | null => {
	const ids = Array.from(new Set(agency?.topicIds ?? []));
	return ids.length === 1 ? ids[0] : null;
};

export type GroupInviteEntryState = 'none' | 'pending' | 'entry' | 'steps';

export const resolveGroupInviteEntry = ({
	gcid,
	aid,
	agency,
	mainTopic,
	stepNames,
	consultingTypeReady
}: {
	gcid?: string | null;
	aid?: string | null;
	agency?: { id?: number; topicIds?: number[] | null } | null;
	mainTopic?: { id?: number } | null;
	stepNames: string[];
	consultingTypeReady: boolean;
}): GroupInviteEntryState => {
	if (!present(gcid) || !present(aid)) {
		return 'none';
	}
	if (!agency) {
		return 'steps';
	}
	if (!consultingTypeReady) {
		return 'pending';
	}
	// Age or state asked by the consulting type: only the steps can collect them.
	if (stepNames.some((name) => !INVITE_ENTRY_STEP_NAMES.includes(name))) {
		return 'steps';
	}
	const topicId = getGroupInviteTopicId(agency);
	if (topicId == null) {
		return 'steps';
	}
	return mainTopic?.id === topicId ? 'entry' : 'pending';
};

/**
 * The group a registration joins instead of opening a counselling enquiry
 * (#1499), with the invite token its link carries (`gcid=<id>.<token>`,
 * ORISO-UserService#1237). Only when the person registers at the agency the
 * link names; an agency picked in the steps is an ordinary counselling
 * registration.
 */
export const getGroupJoin = ({
	gcid,
	aid,
	agencyId
}: {
	gcid?: string | null;
	aid?: string | null;
	agencyId?: string | number | null;
}): { chatId: number; inviteToken?: string } | undefined => {
	const invite = parseGroupChatInviteId(gcid);
	if (!invite || !present(aid) || String(agencyId ?? '') !== aid.trim()) {
		return undefined;
	}
	return invite.inviteToken
		? { chatId: Number(invite.seriesId), inviteToken: invite.inviteToken }
		: { chatId: Number(invite.seriesId) };
};
