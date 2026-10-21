import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { useTranslation } from 'react-i18next';
import { chatTransportService } from '../../services/chatTransportService';
import { getMatrixClientService } from '../../services/matrixClientRegistry';
import { extractReactionEvents } from '../../utils/matrixTimelineEventFormatter';
import {
	aggregateReactions,
	type ReactionEvent
} from '../../utils/messageRelations';
import {
	computeThreadSummaries,
	formatThreadEntryPreview
} from '../../utils/threadSummaries';
import { ActiveSessionContext } from '../../globalState/provider/ActiveSessionProvider';
import { SessionsDataContext } from '../../globalState/provider/SessionsDataProvider';
import {
	getContact,
	getExtendedSession,
	type ExtendedSessionInterface
} from '../../globalState/helpers/stateHelpers';
import type { MessageItem } from '../message/MessageItemComponent';
import { MessageTimeline } from '../session/MessageTimeline';
import { buildRoomTimeline } from '../session/roomTimeline';
import { buildReplyQuotePreview } from '../session/replyQuote';
import { CHAT_TYPE_SINGLE_CHAT } from '../session/sessionHelpers';
import {
	usePreviewHistoryPaging,
	type PreviewHistoryStatus
} from './usePreviewHistoryPaging';
import './conversationPreview.styles';

const EMPTY_TIMELINE: PreviewTimeline = { messages: [], reactionEvents: [] };

/* The preview never decrypts with legacy room keys and never reports
   decryption errors: it shows what the app's Matrix client already holds. */
const PREVIEW_E2EE_PARAMS = {
	key: null,
	keyID: null,
	encrypted: false,
	subscriptionKeyLost: false
} as any;
const ignore = () => undefined;

/** One row per event id, even where a page overlaps the cached window. */
const uniqueEvents = (events: any[]) => {
	const seen = new Set<string>();
	return events.filter((event) => {
		const id = event?.getId?.();
		if (!id) return true;
		if (seen.has(id)) return false;
		seen.add(id);
		return true;
	});
};

/** #929: the explicit control at the top of the preview. */
const PreviewHistoryControl = ({
	status,
	onLoadOlder,
	translate
}: {
	status: PreviewHistoryStatus;
	onLoadOlder: () => void;
	translate: (key: string) => string;
}) => {
	if (status === 'end') {
		return (
			<p className="conversationPreview__historyStart">
				{translate('notifications.center.preview.historyStart')}
			</p>
		);
	}
	const loading = status === 'loading';
	return (
		<div className="conversationPreview__history">
			{status === 'error' && (
				<p className="conversationPreview__historyError" role="alert">
					{translate('notifications.center.preview.loadOlderFailed')}
				</p>
			)}
			<button
				type="button"
				className="conversationPreview__loadOlder"
				onClick={onLoadOlder}
				disabled={loading}
				aria-busy={loading}
			>
				{translate(
					loading
						? 'notifications.center.preview.loadingOlder'
						: status === 'error'
							? 'notifications.center.preview.retryLoadOlder'
							: 'notifications.center.preview.loadOlder'
				)}
			</button>
		</div>
	);
};

interface PreviewTimeline {
	messages: MessageItem[];
	reactionEvents: ReactionEvent[];
}

/** A room the session list has not loaded yet still renders its rows. */
const fallbackSession = (roomId: string): ExtendedSessionInterface =>
	({
		rid: roomId,
		type: CHAT_TYPE_SINGLE_CHAT,
		item: { matrixRoomId: roomId, topic: '' }
	}) as ExtendedSessionInterface;

/**
 * #420 / #847: read-only conversation preview for the Activity Timeline
 * detail pane.
 *
 * Renders the room through the chat's own pipeline (`buildRoomTimeline`) and
 * rows (`MessageTimeline` → `MessageItemComponent`), so bubbles, formatting
 * (incl. `[[align:…]]`), avatars, reactions, replies and thread entries look
 * exactly as in the chat. `readOnly` removes everything that writes.
 *
 * Events come from the app's OWN Matrix client (already synced and
 * decrypting — ADR-AT-01: previews are hydrated client-side). This component
 * NEVER registers an active view, sends no read receipts and marks nothing
 * read: opening the real chat does all three, and the server then stops
 * sending exactly the timeline entries this view exists to show. So it
 * provides its own `ActiveSessionContext` WITHOUT `readActiveSession`, and
 * uses `ActiveSessionContext.Provider` directly rather than
 * `ActiveSessionProvider`, which would publish itself as the call manager's
 * active session.
 */
export const ConversationPreview = ({
	roomId,
	threadRootId
}: {
	roomId: string | null;
	threadRootId?: string | null;
}) => {
	const { t: translate } = useTranslation();
	const sessionsContext = useContext(SessionsDataContext);
	const [timeline, setTimeline] = useState<PreviewTimeline>(EMPTY_TIMELINE);
	const [roomAvailable, setRoomAvailable] = useState<boolean>(false);
	const listRef = useRef<HTMLDivElement | null>(null);
	// Deliberately a ref: loadMessages must stay identity-stable across
	// renders (its identity drives the subscription effect), and translate's
	// identity is not guaranteed by i18next.
	const translateRef = useRef(translate);
	translateRef.current = translate;
	const ownUserId =
		getMatrixClientService()?.getClient?.()?.getUserId?.() || '';
	// #929: scroll geometry captured right before an older page is shown.
	const prependAnchor = useRef<{ top: number; height: number } | null>(null);
	const lastMessageId = useRef<string | undefined>(undefined);
	const captureScroll = useCallback(() => {
		const list = listRef.current;
		prependAnchor.current = list
			? { top: list.scrollTop, height: list.scrollHeight }
			: null;
	}, []);
	const { limit, status, loadOlder, refreshStatus } = usePreviewHistoryPaging(
		roomId,
		captureScroll
	);

	const loadMessages = useCallback(() => {
		const room = roomId ? chatTransportService.getMatrixRoom(roomId) : null;
		if (!roomId || !room) {
			setRoomAvailable(false);
			setTimeline(EMPTY_TIMELINE);
			return;
		}
		setRoomAvailable(true);
		const events = uniqueEvents(
			chatTransportService.getMatrixRoomMessages(roomId, limit)
		);
		setTimeline({
			messages: buildRoomTimeline(
				events,
				roomId,
				room,
				translateRef.current('e2ee.message.encryption.text')
			),
			reactionEvents: extractReactionEvents(events)
		});
		refreshStatus();
	}, [roomId, limit, refreshStatus]);

	useEffect(() => {
		loadMessages();
		if (!roomId) {
			return;
		}
		// Live updates straight from the client's sync (decryption included);
		// deliberately NO active-view registration and NO read receipts.
		const detach = chatTransportService.onMatrixTimeline(roomId, () =>
			loadMessages()
		);
		return () => {
			detach?.();
		};
	}, [roomId, loadMessages]);

	const activeSession = useMemo(
		() =>
			roomId
				? getExtendedSession(roomId, sessionsContext?.sessions) ||
					fallbackSession(roomId)
				: null,
		[roomId, sessionsContext?.sessions]
	);
	const sessionContextValue = useMemo(
		() => ({ activeSession, avatarMembers: [] }),
		[activeSession]
	);

	const { messages, reactionEvents } = timeline;
	const visibleMessages = useMemo(() => {
		if (!threadRootId) {
			return messages;
		}
		// Same rows as the chat's thread panel: the root, then its replies.
		const root = messages.find((message) => message._id === threadRootId);
		const replies = messages.filter(
			(message) => message.threadRootEventId === threadRootId
		);
		return root ? [root, ...replies] : replies;
	}, [messages, threadRootId]);

	const threadSummaries = useMemo(() => {
		const map = new Map<
			string,
			{ replyCount: number; lastReplyText: string }
		>();
		computeThreadSummaries(messages).forEach((summary, rootId) => {
			map.set(rootId, {
				replyCount: summary.replyCount,
				lastReplyText: formatThreadEntryPreview(summary)
			});
		});
		return map;
	}, [messages]);

	const reactionsFor = useCallback(
		(messageId: string) =>
			aggregateReactions(reactionEvents, messageId, ownUserId),
		[reactionEvents, ownUserId]
	);
	const resolveReplyQuote = useCallback(
		(replyToEventId?: string | null) => {
			const target = replyToEventId
				? messages.find((message) => message._id === replyToEventId)
				: null;
			return target ? buildReplyQuotePreview(target) : null;
		},
		[messages]
	);
	const isMyMessage = useCallback(
		(userId: string) => Boolean(ownUserId) && userId === ownUserId,
		[ownUserId]
	);

	// Open at the newest message and follow new ones; when an older page is
	// prepended, keep the rows the reader is looking at in place (#929).
	useLayoutEffect(() => {
		const list = listRef.current;
		const anchor = prependAnchor.current;
		const newestId = visibleMessages[visibleMessages.length - 1]?._id;
		const appended = newestId !== lastMessageId.current;
		lastMessageId.current = newestId;
		if (!list) return;
		if (anchor && !appended) {
			prependAnchor.current = null;
			list.scrollTop = anchor.top + (list.scrollHeight - anchor.height);
			return;
		}
		if (appended) {
			prependAnchor.current = null;
			list.scrollTop = list.scrollHeight;
		}
	}, [visibleMessages]);

	const historyControl = (
		<PreviewHistoryControl
			status={status}
			onLoadOlder={() => void loadOlder()}
			translate={translate}
		/>
	);

	if (!roomId || !roomAvailable || !activeSession) {
		return (
			<div className="conversationPreview conversationPreview--empty">
				<p className="conversationPreview__notice">
					{translate('notifications.center.preview.unavailable')}
				</p>
			</div>
		);
	}

	if (visibleMessages.length === 0) {
		return (
			<div className="conversationPreview conversationPreview--empty">
				<p className="conversationPreview__notice">
					{translate('notifications.center.preview.empty')}
				</p>
				{/* A thread root can sit further back than the cached window. */}
				{status !== 'end' && historyControl}
			</div>
		);
	}

	return (
		<ActiveSessionContext.Provider value={sessionContextValue}>
			<div
				className="conversationPreview"
				ref={listRef}
				data-testid="conversation-preview"
			>
				{historyControl}
				<MessageTimeline
					messages={visibleMessages}
					renderMode={threadRootId ? 'thread' : 'main'}
					threadRootId={threadRootId}
					forceShow={Boolean(threadRootId)}
					keyPrefix="preview-"
					clientName={
						getContact(activeSession)?.username ||
						translate('sessionList.user.consultantUnknown')
					}
					askerMatrixUserIdFor={() =>
						activeSession.item?.askerMatrixUserId
					}
					isMyMessage={isMyMessage}
					handleDecryptionErrors={ignore}
					handleDecryptionSuccess={ignore}
					e2eeParams={PREVIEW_E2EE_PARAMS}
					threadSummaryFor={(id) => threadSummaries.get(id)}
					resolveReplyQuote={resolveReplyQuote}
					reactionsFor={reactionsFor}
					readOnly
				/>
			</div>
		</ActiveSessionContext.Provider>
	);
};
