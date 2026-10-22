import { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';
import { isActiveSupervisorOf } from '../sessionsListItem/supervisionListState';
import { requiresCaseHandoverCheck } from './caseHandoverPreviewGate';

/**
 * #1824: what a person may do from the Activity Timeline conversation preview.
 *
 * Pure policy over facts the Timeline already has. It fails closed: a fact it
 * cannot establish answers read-only, because a preview that wrongly writes is
 * worse than one that sends the person to the conversation. Anything that
 * would leave the Timeline (re-opening an archived conversation, calls,
 * consent) is never offered.
 */
export type PreviewChannelKind = 'thread' | 'supervision' | 'team';

export type PreviewReadOnlyReason =
	| 'sessionUnknown'
	| 'internalRoom'
	| 'archived'
	| 'enquiry'
	| 'supervisor'
	| 'coAccess'
	| 'notJoined'
	| 'consentGate';

export interface PreviewCapabilities {
	composer: boolean;
	react: boolean;
	/** Edit and delete own messages (the row still applies the tenant's
	 * Message_AllowDeleting setting and asks before deleting). */
	manageOwn: boolean;
	readOnlyReason: PreviewReadOnlyReason | null;
}

export interface PreviewPolicyInput {
	session: ExtendedSessionInterface | null | undefined;
	/** The room the preview shows; the session must own it. */
	roomId: string;
	userId: string | undefined;
	channelKind: PreviewChannelKind | null;
	/** Own Matrix membership of the room is `join`. */
	roomJoined: boolean;
	/** `undefined` while the user data has not loaded. */
	viewerIsAdviceSeeker: boolean | undefined;
	/** `dataPrivacyConfirmation` is on record (the chat's consent gates). */
	privacyAcceptanceRecorded: boolean;
	/** Live-chat modality (the chat's anonymous experience). */
	isAnonymousChat?: boolean;
}

const readOnly = (
	readOnlyReason: PreviewReadOnlyReason,
	react = false
): PreviewCapabilities => ({
	composer: false,
	react,
	manageOwn: false,
	readOnlyReason
});

export const resolvePreviewCapabilities = ({
	session,
	roomId,
	userId,
	channelKind,
	roomJoined,
	viewerIsAdviceSeeker,
	privacyAcceptanceRecorded,
	isAnonymousChat = false
}: PreviewPolicyInput): PreviewCapabilities => {
	const sessionRoomId = session?.rid || session?.item?.matrixRoomId;
	// Session ids and group ids are separate id spaces: a lookup by id alone
	// can return another conversation, so the room must match.
	if (
		!session?.item ||
		sessionRoomId !== roomId ||
		viewerIsAdviceSeeker === undefined
	) {
		return readOnly('sessionUnknown');
	}
	// D5: the supervision side room and the internal counsellor chat stay
	// read-only until slice S6 has proven which Timeline entries they produce.
	if (channelKind === 'supervision' || channelKind === 'team') {
		return readOnly('internalRoom');
	}
	if (session.isArchive) {
		return readOnly('archived');
	}
	if (session.isEnquiry) {
		return readOnly('enquiry');
	}
	// The chat lets a supervisor react but never write.
	if (isActiveSupervisorOf(session, userId)) {
		return readOnly('supervisor', true);
	}
	// A consultant who does not own the case reads it through co-access.
	if (
		!viewerIsAdviceSeeker &&
		!session.isGroup &&
		requiresCaseHandoverCheck(session, userId)
	) {
		return readOnly('coAccess');
	}
	if (session.isGroup && !roomJoined) {
		return readOnly('notJoined');
	}
	// The chat's consent gates (group privacy statement, anonymous asker) rest
	// on the recorded agreement; without it the Timeline cannot know the gate
	// was passed.
	if (
		viewerIsAdviceSeeker &&
		(session.isGroup || isAnonymousChat) &&
		!privacyAcceptanceRecorded
	) {
		return readOnly('consentGate');
	}

	return {
		composer: true,
		react: true,
		manageOwn: channelKind !== 'thread' && !isAnonymousChat,
		readOnlyReason: null
	};
};
