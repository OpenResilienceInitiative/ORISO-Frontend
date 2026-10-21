import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
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
import './conversationPreview.styles';

const PREVIEW_MESSAGE_LIMIT = 50;
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

	const loadMessages = useCallback(() => {
		const room = roomId ? chatTransportService.getMatrixRoom(roomId) : null;
		if (!roomId || !room) {
			setRoomAvailable(false);
			setTimeline(EMPTY_TIMELINE);
			return;
		}
		setRoomAvailable(true);
		const events = chatTransportService.getMatrixRoomMessages(
			roomId,
			PREVIEW_MESSAGE_LIMIT
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
	}, [roomId]);

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

	useEffect(() => {
		const list = listRef.current;
		if (list) {
			list.scrollTop = list.scrollHeight;
		}
	}, [visibleMessages.length]);

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
