/**
 * A counsellor knocking on a self-help group she is not part of (#1499).
 * Mirrors UserService `GroupChatJoinRequestDTO` (moderator view) and
 * `GroupChatJoinRequestStatusDTO` (the knocker's own view, which carries no
 * group data at all — Frank, 23.09.2026).
 */
export type GroupChatJoinRequestStatus =
	| 'PENDING'
	| 'ADMITTED'
	| 'DECLINED'
	| 'CANCELLED';

export type GroupChatJoinAdmitRole = 'PARTICIPANT' | 'CO_MODERATOR';

/** The moderator's own role in the group — decides what she may grant. */
export type GroupChatModeratorRole = 'OWNER' | 'CO_MODERATOR';

export interface GroupChatJoinRequester {
	consultantId: string;
	displayName: string;
	firstName?: string | null;
	lastName?: string | null;
	agencyName?: string | null;
	tenantName?: string | null;
	/** Shares a Beratungsstelle with the group. */
	sameAgency: boolean;
	/** Same Träger as the group's owner. */
	sameTenant: boolean;
}

export interface GroupChatJoinRequest {
	id: number;
	seriesId: number;
	groupTitle: string;
	status: GroupChatJoinRequestStatus;
	requestedAt: string;
	decidedAt?: string | null;
	via: 'INVITE_LINK';
	requester: GroupChatJoinRequester;
	/** The caller's own role in that group — what she may grant. */
	viewerRole: GroupChatModeratorRole;
}

export interface GroupChatJoinRequestOwnStatus {
	id: number;
	status: GroupChatJoinRequestStatus;
	requestedAt: string;
	decidedAt?: string | null;
}

/**
 * Who may be granted co-moderation: only the owner grants it, and only to a
 * colleague of her own Träger — the rule the server already applies when
 * co-moderators are picked (`GroupChatParticipantReconciliationService`).
 */
export const coModerationBlockedReason = (
	request: GroupChatJoinRequest
): 'notOwner' | 'otherTenant' | null => {
	if (request.viewerRole !== 'OWNER') return 'notOwner';
	if (!request.requester.sameTenant) return 'otherTenant';
	return null;
};

/** Minutes since the knock, never negative (clock skew). */
export const minutesSince = (requestedAt: string, now: Date) =>
	Math.max(
		0,
		Math.floor((now.getTime() - new Date(requestedAt).getTime()) / 60_000)
	);
