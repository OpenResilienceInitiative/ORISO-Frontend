import { getModality, Modality } from '../session/getModality';

interface GroupChatAuthorizationSession {
	consultant?: { id?: string };
	item?: { moderators?: string[] };
}

interface GroupChatAuthorizationUser {
	userId?: string;
}

interface V2GroupChatSession {
	isGroup?: boolean;
	item?: {
		modality?: string;
		consultingType?: number;
	};
}

export const isV2GroupChatSession = ({
	isGroup,
	item
}: V2GroupChatSession): boolean =>
	Boolean(
		isGroup && ['TEXT', 'AUDIO', 'VIDEO'].includes(item?.modality || '')
	);

export const isGroupChatOwner = (
	activeSession: GroupChatAuthorizationSession,
	userData?: GroupChatAuthorizationUser
) => {
	if (activeSession.consultant?.id && userData?.userId) {
		return activeSession.consultant.id === userData.userId;
	} else {
		return false;
	}
};

export const canModerateGroupChat = (
	activeSession: GroupChatAuthorizationSession,
	userData?: GroupChatAuthorizationUser
): boolean =>
	Boolean(
		userData?.userId &&
			(isGroupChatOwner(activeSession, userData) ||
				activeSession.item?.moderators?.includes(userData.userId))
	);

interface GroupChatJoinViewOptions {
	isGroup: boolean;
	active?: boolean;
	subscribed?: boolean;
	isBanned: boolean;
}

export const shouldShowGroupChatJoinView = ({
	isGroup,
	active,
	subscribed,
	isBanned
}: GroupChatJoinViewOptions): boolean =>
	isGroup && (!active || !subscribed || isBanned);

type ModalitySession = Parameters<typeof getModality>[0];

export interface GroupChatWaitingAreaVisibility {
	/** The countdown clock ("Ihr Gruppen-Chat beginnt …") plus its calendar slot. */
	showCountdown: boolean;
	/** The cycling netiquette rules. */
	showRules: boolean;
	/** The standalone `"Spielregeln" des Chats` headline above the rules. */
	showRulesHeadline: boolean;
}

/**
 * Which parts of the group-chat waiting area a join view may render.
 *
 * The waiting area — countdown clock, "add to calendar", the netiquette
 * spotlight and the asker-facing "Ihre Beratung öffnet den Raum gleich" copy —
 * belongs to *scheduled* group chats with askers (self-help circles). Internal
 * team chats (ADR-006 `Modality.INTERNAL_GROUP`) are persistent rooms for
 * colleagues: there is no session to wait for, so counting down to one is
 * meaningless there and is not rendered at all (#979). The join/start button
 * itself stays — the room still has to be opened server-side before messages
 * can flow.
 */
export const getGroupChatWaitingAreaVisibility = (
	session: ModalitySession,
	plannedStart: Date | null
): GroupChatWaitingAreaVisibility => {
	if (getModality(session) === Modality.INTERNAL_GROUP) {
		return {
			showCountdown: false,
			showRules: false,
			showRulesHeadline: false
		};
	}

	const showCountdown = Boolean(plannedStart);
	return {
		showCountdown,
		showRules: true,
		// The countdown carries its own headline; a second static one above it
		// would just repeat the frame.
		showRulesHeadline: !showCountdown
	};
};
