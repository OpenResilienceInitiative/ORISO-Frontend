import { useEffect, useMemo, useRef, useState } from 'react';
import { AUTHORITIES, hasUserAuthority } from '../../globalState';
import { getExtendedSession } from '../../globalState/helpers/stateHelpers';
import { chatTransportService } from '../../services/chatTransportService';
import { getModality, Modality } from '../session/getModality';
import { resolvePreviewChannel } from './previewChannel';
import { resolvePreviewCapabilities } from './previewCapabilities';
import { selectActivityEventsSeenWhileReading } from './seenWhileReading';

/**
 * #1824: everything the Timeline needs to hand the conversation preview: what
 * the person may do in this room, who they write as, and the D1 rule that new
 * events of the room being read count as seen.
 */
export const useConversationPreviewState = ({
	showPreview,
	selectedNotification,
	selectedRoomId,
	sessions,
	userData,
	unreadOnly,
	feed,
	resolveRoomId,
	isMessageEvent,
	markNotificationAsRead
}: {
	showPreview: boolean;
	selectedNotification: any;
	selectedRoomId: string | null;
	sessions: any[] | undefined;
	userData: any;
	unreadOnly: boolean;
	feed: ReadonlyArray<{ id: string; readAt?: unknown }>;
	resolveRoomId: (item: any) => string | null;
	isMessageEvent: (item: any) => boolean;
	markNotificationAsRead: (id: string) => void;
}) => {
	// Bumped when the room's membership or timeline changes, so an accepted
	// knock or a kick is not served from stale permissions.
	const [roomVersion, setRoomVersion] = useState(0);

	useEffect(() => {
		if (!showPreview || !selectedRoomId) {
			return undefined;
		}
		const bump = () => setRoomVersion((version) => version + 1);
		const detachLifecycle = chatTransportService.onMatrixRoomLifecycle(
			selectedRoomId,
			bump
		);
		const detachTimeline = chatTransportService.onMatrixTimeline(
			selectedRoomId,
			bump
		);
		return () => {
			detachLifecycle?.();
			detachTimeline?.();
		};
	}, [showPreview, selectedRoomId]);

	const channel = useMemo(
		() => resolvePreviewChannel(selectedNotification ?? {}),
		[selectedNotification]
	);

	const capabilities = useMemo(() => {
		if (!selectedRoomId) {
			return undefined;
		}
		// By room, not by id: session ids and group ids are separate spaces.
		const session = getExtendedSession(selectedRoomId, sessions || []);
		return resolvePreviewCapabilities({
			session,
			roomId: selectedRoomId,
			userId: userData?.userId,
			channelKind: channel.kind,
			roomJoined:
				chatTransportService
					.getMatrixRoom(selectedRoomId)
					?.getMyMembership?.() === 'join',
			viewerIsAdviceSeeker: userData
				? !hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
				: undefined,
			privacyAcceptanceRecorded: Boolean(
				String(userData?.dataPrivacyConfirmation ?? '').trim()
			),
			isAnonymousChat: session
				? getModality(session as any) === Modality.LIVE_CHAT
				: false
		});
		// roomVersion: membership is read from the Matrix client, not state.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedRoomId, sessions, userData, channel.kind, roomVersion]);

	const senderDisplayName =
		userData?.displayName ||
		userData?.userName ||
		`${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() ||
		null;

	// D1: only events that arrive AFTER the preview opened count as seen.
	const knownIds = useRef<{ roomId: string | null; ids: Set<string> }>({
		roomId: null,
		ids: new Set()
	});
	useEffect(() => {
		if (!showPreview || !selectedRoomId) {
			knownIds.current = { roomId: null, ids: new Set() };
			return;
		}
		if (knownIds.current.roomId !== selectedRoomId) {
			knownIds.current = {
				roomId: selectedRoomId,
				ids: new Set(feed.map((item) => item.id))
			};
			return;
		}
		selectActivityEventsSeenWhileReading({
			feed,
			visibleRoomId: selectedRoomId,
			knownIds: knownIds.current.ids,
			resolveRoomId,
			isMessageEvent,
			unreadOnly
		}).forEach((id) => {
			knownIds.current.ids.add(id);
			markNotificationAsRead(id);
		});
	}, [
		showPreview,
		selectedRoomId,
		feed,
		unreadOnly,
		resolveRoomId,
		isMessageEvent,
		markNotificationAsRead
	]);

	return {
		capabilities,
		threadRootId: channel.threadRootId,
		senderDisplayName
	};
};
