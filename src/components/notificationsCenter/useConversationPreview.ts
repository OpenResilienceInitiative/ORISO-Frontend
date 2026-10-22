import { useContext, useEffect, useMemo, useState } from 'react';
import {
	apiGetCaseHandoverStatus,
	type CaseHandoverStatus
} from '../../api/apiCaseHandover';
import { apiGetSessionSupervisors } from '../../api/apiGetSessionSupervisors';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import {
	AUTHORITIES,
	hasUserAuthority
} from '../../globalState/helpers/stateHelpers';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import { useSession } from '../../hooks/useSession';
import { useTeamDiscussionChannel } from '../../hooks/useTeamDiscussionChannel';
import { chatTransportService } from '../../services/chatTransportService';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import {
	isCaseHandoverAccessControlled,
	isCaseHandoverCoAccess
} from '../session/caseHandoverHelpers';
import { getModality, Modality } from '../session/getModality';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { isActiveSupervisorOf } from '../sessionsListItem/supervisionListState';
import { activityEventConversation } from './activityEvent';
import {
	type PreviewCapabilities,
	type PreviewCaseHandover,
	type PreviewRoomKind,
	resolvePreviewCapabilities
} from './previewCapabilities';

/** Where the preview's composer sends, as the chat's side panels do. */
export type PreviewComposerTarget = {
	targetRoomId?: string;
	targetChannelKind?: 'team';
	teamDiscussion?: boolean;
	feedbackMailIntent?: boolean;
	accent?: 'supervision' | 'team';
};

export interface ConversationPreviewModel {
	/** The room the preview shows. */
	roomId: string;
	threadRootId: string | null;
	/** The counselling session the room belongs to, once loaded. */
	session: ReturnType<typeof useSession>['session'] | null;
	roomKind: PreviewRoomKind | null;
	capabilities: PreviewCapabilities;
	composerTarget: PreviewComposerTarget;
	/** For the co-access notice (its end date). */
	caseHandoverStatus: CaseHandoverStatus | null;
	senderDisplayName: string | null;
}

const isConsultantUser = (userData: any): boolean =>
	hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) ||
	(userData?.userRoles || []).includes('CONSULTANT');

const displayNameOf = (userData: any): string | null =>
	userData?.displayName ||
	userData?.userName ||
	`${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() ||
	null;

/** One request per session, kept while the session stays selected. */
const useSessionLookup = <T>(
	sessionId: number | undefined,
	load: ((sessionId: number) => Promise<T>) | null
): { sessionId: number; value: T | null } | null => {
	const [state, setState] = useState<{
		sessionId: number;
		value: T | null;
	} | null>(null);
	useEffect(() => {
		if (!sessionId || !load) {
			setState(null);
			return undefined;
		}
		let cancelled = false;
		load(sessionId)
			.catch(() => null)
			.then((value) => {
				if (!cancelled) {
					setState({ sessionId, value: value ?? null });
				}
			});
		return () => {
			cancelled = true;
		};
	}, [sessionId, load]);
	return state?.sessionId === sessionId ? state : null;
};

/**
 * #1824: the deep model behind the Activity Timeline's conversation preview.
 *
 * Given the selected activity event, it finds the conversation (the session,
 * loaded like the chat loads it — by room, falling back to the session id for
 * a side room), which of its rooms the event is in (main room, supervision
 * side room, team room), and everything the chat decides on: role,
 * supervisor, case-handover status, team discussion state, membership,
 * consent and thread settings. It returns what the preview may do there and
 * where its composer sends. Nothing here writes, marks read or registers an
 * active view.
 */
export const useConversationPreview = (
	event: Pick<
		NotificationFeedItem,
		'eventType' | 'category' | 'actionPath' | 'sourceSessionId' | 'params'
	> | null,
	{ visible }: { visible: boolean }
): ConversationPreviewModel | null => {
	const { userData } = useContext(UserDataContext);
	const conversation = useMemo(
		() => (event ? activityEventConversation(event) : null),
		[event]
	);
	const roomId = visible ? (conversation?.roomId ?? null) : null;
	const { session } = useSession(
		roomId,
		roomId ? (conversation?.sessionId ?? undefined) : undefined
	);
	const sessionId = session?.item?.id as number | undefined;
	const isConsultant = userData ? isConsultantUser(userData) : undefined;
	const tenant = getTenantSettings() || {};

	// The chat learns the side room and the viewer's supervisor role from the
	// same request (ADR-008).
	const counselling =
		Boolean(isConsultant) && Boolean(session) && !session?.isGroup;
	const supervisors = useSessionLookup(
		counselling ? sessionId : undefined,
		counselling && tenant.featureSupervisionEnabled !== false
			? apiGetSessionSupervisors
			: null
	);
	const sideRoomId = supervisors?.value?.find?.(
		(s) => s.matrixRoomId
	)?.matrixRoomId;
	const supervisesThis =
		isActiveSupervisorOf(session, userData?.userId) ||
		Boolean(
			supervisors?.value?.some?.(
				(s) =>
					String(s.supervisorConsultantId) ===
					String(userData?.userId)
			)
		);

	// Read only — the Timeline never creates a team discussion.
	const { discussion } = useTeamDiscussionChannel({
		sessionId,
		enabled:
			counselling &&
			tenant.featureTeamDiscussionEnabled !== false &&
			getModality(session as any) === Modality.AGENCY_COUNSELLING,
		allowCreate: false,
		teamChannelRequested: false
	});

	const roomKind: PreviewRoomKind | null = !session
		? null
		: roomId === session.rid || roomId === session.item?.matrixRoomId
			? 'main'
			: sideRoomId && roomId === sideRoomId
				? 'supervision'
				: discussion?.matrixRoomId && roomId === discussion.matrixRoomId
					? 'team'
					: null;

	// The chat's own rule for when a case-handover status decides access.
	const handoverControlled =
		roomKind === 'main' &&
		Boolean(session) &&
		isCaseHandoverAccessControlled({
			activeSession: session as any,
			userData,
			type: SESSION_LIST_TYPES.MY_SESSION
		});
	const handover = useSessionLookup(
		handoverControlled ? sessionId : undefined,
		handoverControlled ? apiGetCaseHandoverStatus : null
	);
	const caseHandover: PreviewCaseHandover = !handoverControlled
		? 'notRequired'
		: !handover
			? 'loading'
			: {
					// A refused or failed status shows less, not more.
					canViewContent: Boolean(handover.value?.canViewContent),
					coAccess: isCaseHandoverCoAccess(handover.value)
				};

	// Membership is read from the Matrix client: follow its changes so an
	// accepted knock or a kick is not served from stale permissions.
	const [, setRoomVersion] = useState(0);
	useEffect(() => {
		if (!roomId) {
			return undefined;
		}
		const bump = () => setRoomVersion((version) => version + 1);
		const detachLifecycle = chatTransportService.onMatrixRoomLifecycle(
			roomId,
			bump
		);
		const detachTimeline = chatTransportService.onMatrixTimeline(
			roomId,
			bump
		);
		return () => {
			detachLifecycle?.();
			detachTimeline?.();
		};
	}, [roomId]);
	const roomJoined =
		Boolean(roomId) &&
		chatTransportService.getMatrixRoom(roomId!)?.getMyMembership?.() ===
			'join';

	if (!roomId || !conversation) {
		return null;
	}

	const isAnonymousChat =
		Boolean(session) && getModality(session as any) === Modality.LIVE_CHAT;
	const chatType = session?.isGroup
		? 'group'
		: isAnonymousChat
			? 'anonymous'
			: 'oneOnOne';
	const threadsEnabled =
		tenant.featureThreadsEnabled !== false &&
		(chatType === 'group'
			? tenant.featureThreadsGroupChatsEnabled !== false
			: chatType === 'anonymous'
				? tenant.featureThreadsAnonymousChatsEnabled !== false
				: tenant.featureThreadsOneOnOneEnabled !== false);

	const capabilities = resolvePreviewCapabilities({
		session,
		roomKind,
		channelKind: conversation.channelKind,
		viewer: { userId: userData?.userId, isConsultant },
		isSupervisorOfSession: supervisesThis,
		caseHandover,
		roomJoined,
		privacyAcceptanceRecorded: Boolean(
			String(userData?.dataPrivacyConfirmation ?? '').trim()
		),
		isAnonymousChat,
		teamDiscussionOpen: discussion?.status === 'OPEN',
		threadsEnabled
	});

	return {
		roomId,
		threadRootId: conversation.threadRootId,
		session: session ?? null,
		roomKind,
		capabilities,
		composerTarget:
			roomKind === 'supervision'
				? {
						targetRoomId: roomId,
						accent: 'supervision',
						feedbackMailIntent: true
					}
				: roomKind === 'team'
					? {
							targetRoomId: roomId,
							targetChannelKind: 'team',
							teamDiscussion: true,
							accent: 'team'
						}
					: {},
		caseHandoverStatus:
			handover?.value && typeof handover.value === 'object'
				? (handover.value as CaseHandoverStatus)
				: null,
		senderDisplayName: displayNameOf(userData)
	};
};
