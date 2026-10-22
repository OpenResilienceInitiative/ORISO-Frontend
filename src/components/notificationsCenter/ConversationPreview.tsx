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
	getReactionTarget,
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
import {
	CHAT_TYPE_SINGLE_CHAT,
	SESSION_LIST_TYPES
} from '../session/sessionHelpers';
import {
	usePreviewHistoryPaging,
	type PreviewHistoryStatus
} from './usePreviewHistoryPaging';
import {
	HEADER_STACK_PROPS,
	ParticipantAvatarStack
} from '../message/ParticipantAvatarStack';
import type { StackParticipant } from '../message/participantStack';
import { isTechnicalMatrixUser } from '../../utils/systemMatrixUsers';
import { resolveRoomHeaderDensity } from '../sessionHeader/roomHeaderDensity';
import useMeasure from 'react-use-measure';
import { ResizeObserver } from '@juggle/resize-observer';
import type { CaseHandoverStatus } from '../../api/apiCaseHandover';
import { SessionTypeProvider } from '../../globalState/provider/SessionTypeProvider';
import { MessageSubmitInterfaceComponent } from '../messageSubmitInterface/messageSubmitInterfaceComponent';
import { CaseHandoverReadOnlyNotice } from '../session/CaseHandoverReadOnlyNotice';
import { useConversationActions } from '../session/useConversationActions';
import { useMatrixTyping } from '../session/useMatrixTyping';
import type { PreviewCapabilities } from './previewCapabilities';
import type { PreviewComposerTarget } from './useConversationPreview';
import './conversationPreview.styles';

const EMPTY_TIMELINE: PreviewTimeline = {
	messages: [],
	reactionEvents: [],
	activityByEvent: new Map()
};

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
	activityByEvent: Map<string, number>;
}

/** A room the session list has not loaded yet still renders its rows. */
const fallbackSession = (roomId: string): ExtendedSessionInterface =>
	({
		rid: roomId,
		type: CHAT_TYPE_SINGLE_CHAT,
		item: { matrixRoomId: roomId, topic: '' }
	}) as ExtendedSessionInterface;

/** #1824: what the preview may do in its room, from `useConversationPreview`. */
export interface ConversationPreviewAccess {
	capabilities: PreviewCapabilities;
	composerTarget?: PreviewComposerTarget;
	/** The conversation the room belongs to (the main session for side rooms). */
	session?: ExtendedSessionInterface | null;
	caseHandoverStatus?: CaseHandoverStatus | null;
}

/** Read-only reasons that also rule out a read receipt. */
const NO_RECEIPT = new Set(['sessionUnknown', 'curtained', 'coAccess']);

const READ_ONLY_TEXT: Partial<Record<string, string>> = {
	archived: 'notifications.center.preview.archivedOpenToReply',
	supervisor: 'notifications.center.preview.supervisorNoComposer',
	notJoined: 'notifications.center.preview.notJoined',
	teamClosed: 'notifications.center.preview.teamClosed',
	curtained: 'notifications.center.preview.curtained'
};

/**
 * #420 / #847 / #1824: the conversation preview in the Activity Timeline
 * detail pane.
 *
 * Renders the room through the chat's own pipeline (`buildRoomTimeline`) and
 * rows (`MessageTimeline` → `MessageItemComponent`), so bubbles, formatting
 * (incl. `[[align:…]]`), avatars, reactions, replies and thread entries look
 * exactly as in the chat. Without `access` it is read-only (#420). With it
 * (#1824) it offers exactly what the room allows: the chat's own row actions
 * (`useConversationActions`), the chat's own composer, threads opened in
 * place — and still nothing that leaves the Timeline (`previewMode`).
 *
 * Events come from the app's OWN Matrix client (already synced and
 * decrypting — ADR-AT-01: previews are hydrated client-side). This component
 * NEVER registers an active view: opening the real chat does, and the server
 * then stops sending exactly the timeline entries this view exists to show.
 * It sends a read receipt only when the person acts (write, react, edit,
 * delete) or presses "Mark conversation as read" — never on opening. So it
 * provides its own `ActiveSessionContext` WITHOUT `readActiveSession`, and
 * uses `ActiveSessionContext.Provider` directly rather than
 * `ActiveSessionProvider`, which would publish itself as the call manager's
 * active session.
 */
export const ConversationPreview = ({
	roomId,
	threadRootId,
	access,
	conversationPath,
	onConversationRead,
	onOpenConversation
}: {
	roomId: string | null;
	threadRootId?: string | null;
	access?: ConversationPreviewAccess;
	/** The conversation's own route: where its drafts resume. */
	conversationPath?: string | null;
	/** The conversation was read through the preview (a receipt went out). */
	onConversationRead?: () => void;
	onOpenConversation?: () => void;
}) => {
	const { t: translate } = useTranslation();
	const sessionsContext = useContext(SessionsDataContext);
	const [timeline, setTimeline] = useState<PreviewTimeline>(EMPTY_TIMELINE);
	const [roomAvailable, setRoomAvailable] = useState<boolean>(false);
	const [previewRef, previewBounds] = useMeasure({
		polyfill: ResizeObserver
	});
	const density = resolveRoomHeaderDensity({ width: previewBounds.width });
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

	const capabilities = access?.capabilities;
	// #1824: a thread opened from a main-room message stays inside the preview.
	const [openedThreadRootId, setOpenedThreadRootId] = useState<string | null>(
		null
	);
	useEffect(() => setOpenedThreadRootId(null), [roomId, threadRootId]);
	const shownThreadRootId = threadRootId || openedThreadRootId;

	// D2: reading is explicit — a write, reaction, edit, deletion or the
	// button sends the receipt; the Timeline card follows only when it went out.
	const onConversationReadRef = useRef(onConversationRead);
	onConversationReadRef.current = onConversationRead;
	const [actionFailed, setActionFailed] = useState(false);
	const [markedRead, setMarkedRead] = useState(false);
	useEffect(() => {
		setActionFailed(false);
		setMarkedRead(false);
	}, [roomId, shownThreadRootId]);
	const markConversationRead = useCallback(async () => {
		if (!roomId) {
			return;
		}
		if (await chatTransportService.markRoomAsRead(roomId)) {
			setMarkedRead(true);
			onConversationReadRef.current?.();
		}
	}, [roomId]);
	const conversationActions = useConversationActions({
		roomId,
		resetKey: `${roomId}|${shownThreadRootId}`,
		onWrite: () => {
			setActionFailed(false);
			void markConversationRead();
		},
		onWriteFailed: () => setActionFailed(true)
	});
	const typing = useMatrixTyping(capabilities?.composer ? roomId : null);

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
			reactionEvents: extractReactionEvents(events),
			activityByEvent: new Map(
				events.map((event) => [event.getId?.(), event.getTs?.() ?? 0])
			)
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
			access?.session ||
			(roomId
				? getExtendedSession(roomId, sessionsContext?.sessions) ||
					fallbackSession(roomId)
				: null),
		[access?.session, roomId, sessionsContext?.sessions]
	);
	const sessionContextValue = useMemo(
		() => ({
			activeSession,
			avatarMembers: [],
			// The composer reloads the session after a send; the preview's
			// session comes from its own loader and needs no reload here.
			reloadActiveSession: () => undefined
		}),
		[activeSession]
	);

	const { messages, reactionEvents } = timeline;
	const visibleMessages = useMemo(() => {
		if (!shownThreadRootId) {
			return messages;
		}
		// Same rows as the chat's thread panel: the root, then its replies.
		const root = messages.find(
			(message) => message._id === shownThreadRootId
		);
		const replies = messages.filter(
			(message) => message.threadRootEventId === shownThreadRootId
		);
		return root ? [root, ...replies] : replies;
	}, [messages, shownThreadRootId]);

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

	const reactionsByTarget = useMemo(() => {
		const map = new Map<string, ReactionEvent[]>();
		reactionEvents.forEach((reaction) => {
			const target = getReactionTarget(reaction.content);
			if (!target) return;
			const group = map.get(target.eventId);
			if (group) {
				group.push(reaction);
			} else {
				map.set(target.eventId, [reaction]);
			}
		});
		return map;
	}, [reactionEvents]);

	const reactionsFor = useCallback(
		(messageId: string) =>
			aggregateReactions(
				reactionsByTarget.get(messageId) ?? [],
				messageId,
				ownUserId
			),
		[reactionsByTarget, ownUserId]
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
	const openThread = useCallback(
		(message: MessageItem) => setOpenedThreadRootId(message._id),
		[]
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

	// The preview knows visible messages, not the session's privacy allow-list.
	// Derive authors from that exact slice; joined room members can include
	// silent agency counsellors and must never be exposed here (ADR-002).
	const participants = useMemo<StackParticipant[]>(() => {
		const authors = new Map<string, StackParticipant>();
		visibleMessages.forEach((message) => {
			if (!message.userId || isTechnicalMatrixUser(message.userId))
				return;
			const previous = authors.get(message.userId);
			const lastActivity = timeline.activityByEvent.get(message._id) ?? 0;
			if (!previous || lastActivity > (previous.lastActivity ?? 0)) {
				authors.set(message.userId, {
					userId: message.userId,
					username: message.userId,
					displayName: message.displayName,
					lastActivity
				});
			}
		});
		return [...authors.values()];
	}, [visibleMessages, timeline.activityByEvent]);

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

	const readOnlyReason = capabilities?.readOnlyReason ?? null;
	const openButton = onOpenConversation && (
		<button
			type="button"
			className="conversationPreview__button"
			onClick={onOpenConversation}
		>
			{translate('notifications.center.preview.openToReply')}
		</button>
	);

	// #924: a curtained case shows nothing of the conversation.
	if (capabilities?.contentHidden) {
		return (
			<div className="conversationPreview conversationPreview--empty">
				<p className="conversationPreview__notice">
					{translate(READ_ONLY_TEXT.curtained!)}
				</p>
				{openButton}
			</div>
		);
	}

	if (visibleMessages.length === 0 && !capabilities?.composer) {
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

	const canAct = Boolean(
		capabilities &&
			(capabilities.composer ||
				capabilities.react ||
				capabilities.manageOwn)
	);
	const offersReceipt =
		Boolean(capabilities) && !NO_RECEIPT.has(readOnlyReason ?? '');

	return (
		<ActiveSessionContext.Provider value={sessionContextValue as any}>
			<div className="conversationPreview" ref={previewRef}>
				{(participants.length > 0 ||
					offersReceipt ||
					openedThreadRootId) && (
					<div className="conversationPreview__header">
						{openedThreadRootId && (
							<button
								type="button"
								className="conversationPreview__button"
								onClick={() => setOpenedThreadRootId(null)}
							>
								{translate(
									'notifications.center.preview.backToConversation'
								)}
							</button>
						)}
						{participants.length > 0 && (
							<>
								<ParticipantAvatarStack
									{...HEADER_STACK_PROPS}
									participants={participants}
									maxVisible={density.stackMaxVisible}
								/>
								<span className="conversationPreview__participantLabel">
									{translate(
										'notifications.center.preview.authors'
									)}
								</span>
							</>
						)}
						{offersReceipt && (
							<span className="conversationPreview__headerActions">
								{markedRead ? (
									<span
										role="status"
										className="conversationPreview__markedRead"
									>
										{translate(
											'notifications.center.preview.markedRead'
										)}
									</span>
								) : (
									<button
										type="button"
										className="conversationPreview__button"
										onClick={() =>
											void markConversationRead()
										}
									>
										{translate(
											'notifications.center.preview.markRead'
										)}
									</button>
								)}
							</span>
						)}
					</div>
				)}
				<div
					className="conversationPreview__messages"
					ref={listRef}
					data-testid="conversation-preview"
				>
					{historyControl}
					<MessageTimeline
						messages={visibleMessages}
						renderMode={shownThreadRootId ? 'thread' : 'main'}
						threadRootId={shownThreadRootId}
						forceShow={Boolean(shownThreadRootId)}
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
						threadsEnabled
						threadSummaryFor={(id) => threadSummaries.get(id)}
						resolveReplyQuote={resolveReplyQuote}
						reactionsFor={reactionsFor}
						previewMode={canAct ? 'interactive' : 'read'}
						onOpenThread={
							capabilities?.threadReply && !shownThreadRootId
								? openThread
								: undefined
						}
						onReplyDirect={
							capabilities?.composer && !shownThreadRootId
								? conversationActions.handleReplyDirect
								: undefined
						}
						onEditDirect={
							capabilities?.manageOwn
								? conversationActions.handleEditDirect
								: undefined
						}
						onDeleteDirect={
							capabilities?.manageOwn
								? conversationActions.handleDeleteDirect
								: undefined
						}
						onReact={
							capabilities?.react
								? conversationActions.handleReact
								: undefined
						}
						onUnreact={
							capabilities?.react
								? conversationActions.handleUnreact
								: undefined
						}
					/>
				</div>
				{actionFailed && (
					<p role="alert" className="conversationPreview__error">
						{translate('notifications.center.preview.sendFailed')}
					</p>
				)}
				{capabilities?.composer ? (
					<SessionTypeProvider type={SESSION_LIST_TYPES.MY_SESSION}>
						<MessageSubmitInterfaceComponent
							key={`${roomId}|${shownThreadRootId ?? 'main'}`}
							className="conversationPreview__composer"
							placeholder={translate(
								shownThreadRootId
									? 'message.thread.placeholder'
									: 'notifications.center.preview.composerPlaceholder'
							)}
							isTyping={typing}
							handleMessageSendSuccess={() => {
								setActionFailed(false);
								void markConversationRead();
							}}
							onSendError={() => setActionFailed(true)}
							threadRootId={shownThreadRootId}
							replyTo={conversationActions.replyTo}
							onCancelReply={
								conversationActions.handleCancelReply
							}
							editingMessage={conversationActions.editingMessage}
							onCancelEdit={conversationActions.handleCancelEdit}
							messages={messages}
							isOwnMessage={isMyMessage}
							hideSupervisorAudience
							autoFocusEditor={false}
							compactHeight
							draftActionPath={conversationPath}
							allowDearchive={false}
							{...access?.composerTarget}
						/>
					</SessionTypeProvider>
				) : (
					capabilities && (
						<div className="conversationPreview__notice conversationPreview__notice--footer">
							{readOnlyReason === 'coAccess' ? (
								<CaseHandoverReadOnlyNotice
									expiresAt={
										access?.caseHandoverStatus?.expiresAt
									}
								/>
							) : (
								readOnlyReason &&
								READ_ONLY_TEXT[readOnlyReason] && (
									<p>
										{translate(
											READ_ONLY_TEXT[readOnlyReason]!
										)}
									</p>
								)
							)}
							{openButton}
						</div>
					)
				)}
			</div>
		</ActiveSessionContext.Provider>
	);
};
