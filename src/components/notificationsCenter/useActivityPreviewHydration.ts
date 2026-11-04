import { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AUTHORITIES,
	hasUserAuthority,
	SessionsDataContext,
	UserDataContext
} from '../../globalState';
import { getExtendedSession } from '../../globalState/helpers/stateHelpers';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import type { MatrixActivityPreviewLabels } from '../../utils/matrixActivityPreview';
import { useActivityPreviewCache } from './useActivityPreviewCache';
import { useSideRoomPreviewGate, type SideRoom } from './sideRoomPreviewGate';
import { useGroupPreviewGate } from './groupPreviewGate';
import { chatEndedTextKey } from '../message/messageConstants';
import {
	activityEventConversation,
	describeActivityEvent
} from './activityEvent';
import {
	requiresCaseHandoverCheck,
	useCaseHandoverPreviewGate
} from './caseHandoverPreviewGate';

/**
 * #924 / #1888: the decrypted one-line previews of the Timeline's message
 * cards, behind the case-handover gate.
 *
 * Returns the sources to mount a MatrixActivityPreviewHydrator for (only
 * cards that are allowed to show content), the callback those hydrators
 * report to, and `visiblePreview` — the only way a hydrated text may be
 * read, so a card that loses its allowance never shows it, not even for one
 * paint.
 */
export const useActivityPreviewHydration = (feed: NotificationFeedItem[]) => {
	const { t: translate, i18n } = useTranslation();
	const language = i18n.language;
	const { userData } = useContext(UserDataContext);
	const sessions = useContext(SessionsDataContext)?.sessions;
	const previewLabels = useMemo<MatrixActivityPreviewLabels>(
		() => ({
			image: translate('notifications.center.preview.image'),
			file: translate('notifications.center.preview.file'),
			audio: translate('notifications.center.preview.audio'),
			video: translate('notifications.center.preview.video'),
			notice: translate('notifications.center.preview.notice'),
			// System notices read as the chat words them (MessageItemComponent).
			userLeftChat: hasUserAuthority(
				AUTHORITIES.CONSULTANT_DEFAULT,
				userData
			)
				? translate('message.userLeftChat')
				: translate('message.consultantLeftChat'),
			chatEndedText: (endedBy) =>
				translate(
					chatEndedTextKey(
						endedBy,
						hasUserAuthority(
							AUTHORITIES.CONSULTANT_DEFAULT,
							userData
						)
					)
				),
			inquiryAccepted: translate(
				'notifications.events.inquiryAccepted.text'
			),
			caseHandoverTakenOver: translate(
				'caseHandover.systemMessage.tookOverTitle'
			),
			systemNotification: translate('message.systemNotificationTitle'),
			unsupported: translate('notifications.center.preview.unsupported'),
			// The chat's own wording for a message this device cannot decrypt.
			undecryptable: translate('e2ee.message.encryption.text'),
			pending: translate('notifications.center.preview.pending'),
			roomUnavailable: translate(
				'notifications.center.preview.roomUnavailable'
			),
			eventUnavailable: translate(
				'notifications.center.preview.eventUnavailable'
			)
		}),
		[translate, userData]
	);
	const candidatePreviewSources = useMemo(
		() =>
			feed.flatMap((item) => {
				if (
					item.eventType !== 'message.new' &&
					item.eventType !== 'thread.reply.new'
				) {
					return [];
				}
				const matrixEventId = item.params?.matrixEventId;
				// By room first: a numeric id can also be a group chat's (#1888).
				const {
					sessionId: eventSessionId,
					roomId: eventRoom,
					channelKind
				} = activityEventConversation(item);
				const session =
					getExtendedSession(
						eventRoom || undefined,
						sessions || []
					) ??
					getExtendedSession(
						eventSessionId === null
							? undefined
							: String(eventSessionId),
						sessions || []
					);
				// A numeric id can collide between cases and groups. Until the room
				// resolves, its authorization policy is unknown.
				if (!session) return [];
				const differentRoom = !!eventRoom && session.rid !== eventRoom;
				const namesSideRoom =
					channelKind === 'supervision' || channelKind === 'team';
				const side: SideRoom | null =
					differentRoom &&
					session.isSession &&
					session.item?.id &&
					eventRoom &&
					namesSideRoom
						? {
								sessionId: session.item.id,
								room: eventRoom,
								kind: channelKind
							}
						: null;
				if ((differentRoom || namesSideRoom) && !side) return [];
				const sessionId =
					session.isSession && session.item?.id != null
						? String(session.item.id)
						: null;
				const roomRef = eventRoom || session.rid;
				if (!matrixEventId || !roomRef) {
					return [];
				}
				return [
					{
						activityEventId: item.id,
						roomRef,
						matrixEventId,
						senderName: item.params?.senderName,
						fallbackText: describeActivityEvent(
							item,
							translate,
							language
						).text,
						labels: previewLabels,
						sessionId,
						side,
						group: session?.isGroup
							? {
									id: session.item?.id,
									room: session.rid,
									active: session.item?.active,
									subscribed: session.item?.subscribed
								}
							: null,
						needsCaseHandoverCheck: requiresCaseHandoverCheck(
							session,
							userData?.userId
						)
					}
				];
			}),
		[feed, previewLabels, sessions, translate, language, userData?.userId]
	);
	// Only sessions that could be curtained cost a status request; a group
	// chat, an enquiry or one's own case previews without one.
	const checkedSessionIds = useMemo(
		() =>
			Array.from(
				new Set(
					candidatePreviewSources
						.filter(
							(source) =>
								source.needsCaseHandoverCheck &&
								source.sessionId
						)
						.map((source) => source.sessionId as string)
				)
			).sort(),
		[candidatePreviewSources]
	);
	const isCaseHandoverPreviewAllowed = useCaseHandoverPreviewGate(
		checkedSessionIds,
		userData?.userId
	);
	const groups = useMemo(() => {
		const byId = new Map();
		candidatePreviewSources.forEach(({ group }) => {
			if (group?.id && group.room) byId.set(group.id, group);
		});
		return Array.from(byId.values()).sort((a, b) => a.id - b.id);
	}, [candidatePreviewSources]);
	const isGroupAllowed = useGroupPreviewGate(
		groups,
		userData?.userName,
		userData?.userId
	);
	const sides = useMemo(() => {
		const unique = new Map<string, SideRoom>();
		candidatePreviewSources.forEach(({ side }) => {
			if (side)
				unique.set(`${side.sessionId}:${side.kind}:${side.room}`, side);
		});
		return Array.from(unique.values()).sort((a, b) =>
			`${a.sessionId}:${a.kind}:${a.room}`.localeCompare(
				`${b.sessionId}:${b.kind}:${b.room}`
			)
		);
	}, [candidatePreviewSources]);
	const isSideAllowed = useSideRoomPreviewGate(
		sides,
		userData?.userId,
		userData?.userName
	);
	const messagePreviewSources = useMemo(
		() =>
			candidatePreviewSources
				.filter((source) => {
					if (source.side && !isSideAllowed(source.side))
						return false;
					if (
						source.group &&
						(!source.group.id ||
							source.group.room !== source.roomRef ||
							!isGroupAllowed(source.roomRef))
					)
						return false;
					if (!source.needsCaseHandoverCheck) {
						return true;
					}
					// A card whose session cannot even be named is one we have
					// no way to clear, so it never hydrates.
					return (
						Boolean(source.sessionId) &&
						isCaseHandoverPreviewAllowed(source.sessionId)
					);
				})
				.map(
					({
						needsCaseHandoverCheck: _needsCheck,
						group: _group,
						side: _side,
						sessionId: _sessionId,
						...source
					}) => source
				),
		[
			candidatePreviewSources,
			isCaseHandoverPreviewAllowed,
			isGroupAllowed,
			isSideAllowed
		]
	);
	const { onPreviewChange, visiblePreview } = useActivityPreviewCache(
		messagePreviewSources,
		userData?.userId,
		userData?.userName
	);

	return {
		sources: messagePreviewSources,
		onPreviewChange,
		visiblePreview
	};
};
