import { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';

/**
 * #1824: what a person may do from the Activity Timeline conversation preview,
 * one rule per row of the issue's table and the same facts the chat decides
 * on. Pure, so every row is a unit test.
 *
 * It fails closed: a fact it cannot establish answers read-only, because a
 * preview that wrongly writes is worse than one that sends the person to the
 * conversation. Anything that would leave the Timeline (re-opening an
 * archived conversation, calls, consent) is never offered.
 */
export type PreviewChannelKind = 'thread' | 'supervision' | 'team';

/** Which of the session's rooms the preview shows. */
export type PreviewRoomKind = 'main' | 'supervision' | 'team';

export type PreviewReadOnlyReason =
	| 'sessionUnknown'
	| 'curtained'
	| 'coAccess'
	| 'archived'
	| 'enquiry'
	| 'supervisor'
	| 'notJoined'
	| 'consentGate'
	| 'teamClosed';

export interface PreviewCapabilities {
	composer: boolean;
	react: boolean;
	/** Edit and delete own messages (the row still applies the tenant's
	 * Message_AllowDeleting setting and asks before deleting). */
	manageOwn: boolean;
	/** Open a thread from a main-room message and answer there. */
	threadReply: boolean;
	readOnlyReason: PreviewReadOnlyReason | null;
	/** The case-handover curtain: the conversation must not be shown. */
	contentHidden: boolean;
}

/** `notRequired` for one's own case, a group or an enquiry (#924). */
export type PreviewCaseHandover =
	| 'notRequired'
	| 'loading'
	| { canViewContent: boolean; coAccess: boolean };

export interface PreviewPolicyInput {
	/** The counselling session the room belongs to. */
	session: ExtendedSessionInterface | null | undefined;
	/** null: the room is none of the session's rooms. */
	roomKind: PreviewRoomKind | null;
	/** Only `thread` matters here; side rooms come as `roomKind`. */
	channelKind: PreviewChannelKind | null;
	/** `isConsultant` is undefined while the user data has not loaded. */
	viewer: { userId: string | undefined; isConsultant: boolean | undefined };
	isSupervisorOfSession: boolean;
	caseHandover: PreviewCaseHandover;
	/** Own Matrix membership of the shown room is `join`. */
	roomJoined: boolean;
	/** `dataPrivacyConfirmation` on record (the chat's consent gates). */
	privacyAcceptanceRecorded: boolean;
	/** Live-chat modality (the chat's anonymous experience). */
	isAnonymousChat: boolean;
	/** The session's team discussion is `OPEN`. */
	teamDiscussionOpen: boolean;
	/** The tenant allows threads for this kind of chat. */
	threadsEnabled: boolean;
	/** A fact the decision needs is still loading (supervisors, group info). */
	stillLoading: boolean;
	/** The chat's anonymous gates (consent, pseudonym, waiting room) are up
	 * (`shouldBlockAnonymousInquiryChat`). */
	anonymousGateBlocked: boolean;
	/** The chat shows its join view instead of a composer: group stopped,
	 * not subscribed or the viewer banned (`shouldShowGroupChatJoinView`). */
	groupJoinBlocked: boolean;
}

const readOnly = (
	readOnlyReason: PreviewReadOnlyReason,
	{ react = false, contentHidden = false } = {}
): PreviewCapabilities => ({
	composer: false,
	react,
	manageOwn: false,
	threadReply: false,
	readOnlyReason,
	contentHidden
});

const writable = ({
	manageOwn = true,
	threadReply = false
}: {
	manageOwn?: boolean;
	threadReply?: boolean;
}): PreviewCapabilities => ({
	composer: true,
	react: true,
	manageOwn,
	threadReply,
	readOnlyReason: null,
	contentHidden: false
});

export const resolvePreviewCapabilities = ({
	session,
	roomKind,
	channelKind,
	viewer,
	isSupervisorOfSession,
	caseHandover,
	roomJoined,
	privacyAcceptanceRecorded,
	isAnonymousChat,
	teamDiscussionOpen,
	threadsEnabled,
	stillLoading,
	anonymousGateBlocked,
	groupJoinBlocked
}: PreviewPolicyInput): PreviewCapabilities => {
	// #924: nothing of the case shows until its handover status is known.
	if (caseHandover === 'loading') {
		return readOnly('sessionUnknown', { contentHidden: true });
	}
	if (
		!session?.item ||
		!roomKind ||
		viewer.isConsultant === undefined ||
		stillLoading ||
		// The event names a side channel, but the room is the main room.
		(roomKind === 'main' &&
			(channelKind === 'supervision' || channelKind === 'team'))
	) {
		return readOnly('sessionUnknown');
	}
	if (caseHandover !== 'notRequired') {
		if (!caseHandover.canViewContent) {
			return readOnly('curtained', { contentHidden: true });
		}
		if (caseHandover.coAccess) {
			return readOnly('coAccess');
		}
	}

	// The internal rooms belong to counsellors only (ADR-008 / ADR-016).
	if (roomKind === 'team') {
		if (!viewer.isConsultant) {
			return readOnly('sessionUnknown');
		}
		if (session.isArchive) {
			return readOnly('archived');
		}
		return teamDiscussionOpen ? writable({}) : readOnly('teamClosed');
	}
	if (roomKind === 'supervision') {
		if (!viewer.isConsultant) {
			return readOnly('sessionUnknown');
		}
		if (session.isArchive) {
			return readOnly('archived');
		}
		return roomJoined ? writable({}) : readOnly('notJoined');
	}

	if (session.isArchive) {
		return readOnly('archived');
	}
	if (session.isEnquiry) {
		return readOnly('enquiry');
	}
	// The chat gives a supervisor no composer, but lets them react.
	if (isSupervisorOfSession) {
		return readOnly('supervisor', { react: true });
	}
	if (session.isGroup && (!roomJoined || groupJoinBlocked)) {
		return readOnly('notJoined');
	}
	// The chat's consent gates (group privacy statement, anonymous asker) rest
	// on the recorded agreement; without it the Timeline cannot know the gate
	// was passed.
	if (
		!viewer.isConsultant &&
		(((session.isGroup || isAnonymousChat) && !privacyAcceptanceRecorded) ||
			(isAnonymousChat && anonymousGateBlocked))
	) {
		return readOnly('consentGate');
	}
	if (channelKind === 'thread') {
		return writable({ manageOwn: false });
	}
	return writable({
		manageOwn: !isAnonymousChat,
		threadReply: threadsEnabled && !isAnonymousChat
	});
};
