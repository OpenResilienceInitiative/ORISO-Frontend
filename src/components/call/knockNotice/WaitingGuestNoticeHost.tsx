import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	AUTHORITIES,
	hasUserAuthority,
	NotificationsContext,
	SessionsDataContext,
	UserDataContext
} from '../../../globalState';
import { callManager } from '../../../services/CallManager';
import { directLinkCallName } from '../callRoomName';
import { startRoomCall } from '../startRoomCall';
import type { StartRoomCallOptions } from '../startRoomCall';
import { CallKnockNotice } from './CallKnockNotice';
import type { CallKnockTransport } from './callKnockTransport';
import { useCallKnocks } from './useCallKnocks';
import { waitingConversations } from './waitingGuests';
import type { WaitingConversation } from './waitingGuests';

/** Starts the conversation's call, exactly as its call button does. */
export type StartWaitingGuestCall = (
	options: StartRoomCallOptions
) => Promise<void> | void;

interface ConversationKnocksProps {
	conversation: WaitingConversation;
	/** Only the conversation waiting longest shows its notice. */
	shown: boolean;
	onWaiting: (sessionId: number, waiting: boolean) => void;
	onEnterCall: (conversation: WaitingConversation) => void;
	transport?: CallKnockTransport;
	playSound?: () => void;
}

/**
 * The people knocking in one conversation. Letting somebody in starts the
 * call first — inside the click, because the browser hands out camera and
 * microphone only during it — and admits them while it connects. The person
 * let in joins the call as soon as it rings.
 */
const ConversationKnocks = ({
	conversation,
	shown,
	onWaiting,
	onEnterCall,
	transport,
	playSound
}: ConversationKnocksProps) => {
	const { t } = useTranslation();
	const { people, busy, admit, decline, admitAll } = useCallKnocks({
		enabled: true,
		scope: { sessionId: conversation.sessionId },
		...(transport ? { transport } : {}),
		...(playSound ? { playSound } : {})
	});
	const waiting = people.length > 0;
	const { sessionId } = conversation;
	useEffect(() => {
		onWaiting(sessionId, waiting);
		return () => onWaiting(sessionId, false);
	}, [onWaiting, sessionId, waiting]);

	if (!shown) return null;
	return (
		<CallKnockNotice
			people={people}
			placement="page"
			busy={busy}
			admitLabel={t('calls.knock.startAndAdmit')}
			onAdmit={(knockId) => {
				onEnterCall(conversation);
				void admit(knockId);
			}}
			onDecline={(knockId) => void decline(knockId)}
			onAdmitAll={() => {
				onEnterCall(conversation);
				void admitAll();
			}}
		/>
	);
};

const noCallInProgress = () =>
	!callManager.hasActiveCall() && !callManager.getWaitingCall();

const useNoCallInProgress = () => {
	const [idle, setIdle] = useState(noCallInProgress);
	useEffect(() => {
		const update = () => setIdle(noCallInProgress());
		update();
		return callManager.subscribe(update);
	}, []);
	return idle;
};

export interface WaitingGuestNoticeProps {
	/** Conversations with a recent knock entry, waiting longest first. */
	conversations: WaitingConversation[];
	/** Starts the call of the conversation and opens it. */
	onEnterCall: (conversation: WaitingConversation) => void;
	transport?: CallKnockTransport;
	playSound?: () => void;
}

/**
 * The notice itself, without the app around it: asks the server who still
 * waits in each conversation and shows the one waiting longest.
 */
export const WaitingGuestNotice = ({
	conversations,
	onEnterCall,
	transport,
	playSound
}: WaitingGuestNoticeProps) => {
	const [waiting, setWaiting] = useState<ReadonlySet<number>>(new Set());
	const onWaiting = useCallback((sessionId: number, isWaiting: boolean) => {
		setWaiting((current) => {
			if (current.has(sessionId) === isWaiting) return current;
			const next = new Set(current);
			if (isWaiting) next.add(sessionId);
			else next.delete(sessionId);
			return next;
		});
	}, []);
	const shown = conversations.find((c) => waiting.has(c.sessionId));
	return (
		<>
			{conversations.map((conversation) => (
				<ConversationKnocks
					key={conversation.sessionId}
					conversation={conversation}
					shown={conversation.sessionId === shown?.sessionId}
					onWaiting={onWaiting}
					onEnterCall={onEnterCall}
					transport={transport}
					playSound={playSound}
				/>
			))}
		</>
	);
};

export interface WaitingGuestNoticeHostProps {
	transport?: CallKnockTransport;
	start?: StartWaitingGuestCall;
	playSound?: () => void;
	/** Fixed clock (Storybook, tests). */
	nowMs?: number;
}

/**
 * Somebody waits for the counsellor and no call is running (P0, Frank,
 * 25 Nov 2026): a guest who opened an audio or video Direkteinladung
 * without a date sat in the waiting room, while the counsellor only got an
 * entry in the Zeitstrahl. The people waiting could be let in from inside a
 * running call only (`GroupCallWidget`), and there was no call yet.
 *
 * So the same notice shows wherever the counsellor is in the app. One click
 * starts the call of that conversation and lets the person in. In a call
 * the call's own notice takes over, and this one steps back.
 *
 * Which conversations to ask about comes from the knock entries already in
 * the notification feed; whether somebody still waits is asked from the
 * server per conversation, so a knock that was answered or withdrawn never
 * shows.
 */
export const WaitingGuestNoticeHost = ({
	transport,
	start = startRoomCall,
	playSound,
	nowMs
}: WaitingGuestNoticeHostProps) => {
	const navigate = useNavigate();
	const { userData } = useContext(UserDataContext) ?? { userData: null };
	const feed = useContext(NotificationsContext)?.notificationFeed;
	const sessions = useContext(SessionsDataContext)?.sessions;
	const idle = useNoCallInProgress();
	const isCounsellor = Boolean(
		userData && hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
	);
	// The feed changes with every poll; the conversations rarely do.
	const key = useMemo(
		() =>
			JSON.stringify(
				isCounsellor && feed
					? waitingConversations(feed, nowMs ?? Date.now())
					: []
			),
		[feed, isCounsellor, nowMs]
	);
	const conversations = useMemo<WaitingConversation[]>(
		() => JSON.parse(key),
		[key]
	);
	const onEnterCall = useCallback(
		(conversation: WaitingConversation) => {
			void start({
				roomId: conversation.roomId,
				isVideo: conversation.isVideo,
				isGroup: false,
				// #2170: the call is called what the direct link was called.
				roomName: directLinkCallName(
					sessions?.find(
						(item) =>
							item.session?.matrixRoomId === conversation.roomId
					)?.session
				)
			});
			if (conversation.path) navigate(conversation.path);
		},
		[navigate, sessions, start]
	);

	if (!isCounsellor || !idle) return null;
	return (
		<WaitingGuestNotice
			conversations={conversations}
			onEnterCall={onEnterCall}
			transport={transport}
			playSound={playSound}
		/>
	);
};
