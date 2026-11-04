import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AUTHORITIES,
	hasUserAuthority,
	SessionsDataContext,
	UserDataContext
} from '../../globalState';
import { getExtendedSession } from '../../globalState/helpers/stateHelpers';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import type {
	MatrixActivityPreviewKind,
	MatrixActivityPreviewLabels
} from '../../utils/matrixActivityPreview';
import { chatEndedTextKey } from '../message/messageConstants';
import { activityEventSessionId, describeActivityEvent } from './activityEvent';
import {
	requiresCaseHandoverCheck,
	useCaseHandoverPreviewGate
} from './caseHandoverPreviewGate';

export interface HydratedActivityPreview {
	text: string;
	kind: MatrixActivityPreviewKind;
}

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
	const [hydratedMessagePreviews, setHydratedMessagePreviews] = useState<
		Record<string, HydratedActivityPreview>
	>({});
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
				const eventSessionId = activityEventSessionId(item);
				const session =
					getExtendedSession(
						item.params?.roomRef || undefined,
						sessions || []
					) ??
					getExtendedSession(
						eventSessionId === null
							? undefined
							: String(eventSessionId),
						sessions || []
					);
				const sessionId =
					eventSessionId !== null
						? String(eventSessionId)
						: session?.isSession && session.item?.id != null
							? String(session.item.id)
							: null;
				const roomRef = item.params?.roomRef || session?.rid;
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
	const isCaseHandoverPreviewAllowed =
		useCaseHandoverPreviewGate(checkedSessionIds);
	const messagePreviewSources = useMemo(
		() =>
			candidatePreviewSources
				.filter((source) => {
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
						sessionId: _sessionId,
						...source
					}) => source
				),
		[candidatePreviewSources, isCaseHandoverPreviewAllowed]
	);
	// Previews are dropped again the moment their card stops being allowed —
	// a session arriving late in SessionsDataContext can turn a hydrated card
	// into a curtained one, and the decrypted text would otherwise survive in
	// this map, still feeding the card body and the search index.
	const allowedPreviewIds = useMemo(
		() =>
			new Set(
				messagePreviewSources.map((source) => source.activityEventId)
			),
		[messagePreviewSources]
	);
	useEffect(() => {
		setHydratedMessagePreviews((current) => {
			const staleIds = Object.keys(current).filter(
				(activityEventId) => !allowedPreviewIds.has(activityEventId)
			);
			if (staleIds.length === 0) {
				return current;
			}
			const next = { ...current };
			staleIds.forEach((activityEventId) => delete next[activityEventId]);
			return next;
		});
	}, [allowedPreviewIds]);
	/**
	 * The only way a hydrated preview should ever be read.
	 *
	 * The purge above is state cleanup and lands one render late; in the render
	 * where a card loses its allowance the decrypted text is still in the map.
	 * Reading through this guard means a curtained card never shows it, not
	 * even for a single paint.
	 */
	const visiblePreview = useCallback(
		(activityEventId: string) =>
			allowedPreviewIds.has(activityEventId)
				? hydratedMessagePreviews[activityEventId]
				: undefined,
		[allowedPreviewIds, hydratedMessagePreviews]
	);
	const onPreviewChange = useCallback(
		(
			activityEventId: string,
			preview: string,
			kind: MatrixActivityPreviewKind
		) => {
			setHydratedMessagePreviews((current) =>
				current[activityEventId]?.text === preview &&
				current[activityEventId]?.kind === kind
					? current
					: {
							...current,
							[activityEventId]: { text: preview, kind }
						}
			);
		},
		[]
	);

	return {
		sources: messagePreviewSources,
		onPreviewChange,
		visiblePreview
	};
};
