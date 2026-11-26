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
import { httpCallKnockTransport } from './callKnockTransport';
import type { CallKnockTransport } from './callKnockTransport';
import { useCallKnocks } from './useCallKnocks';
import type { CallKnockBusy } from './useCallKnocks';
import { waitingConversations } from './waitingGuests';
import type { WaitingConversation } from './waitingGuests';

/**
 * Starts the conversation's call, exactly as its call button does, and says
 * whether it did: no camera or microphone, no room — then it did not.
 */
export type StartWaitingGuestCall = (
	options: StartRoomCallOptions
) => Promise<boolean>;

/** Opens the conversation and starts its call; `false` when no call started. */
export type EnterWaitingGuestCall = (
	conversation: WaitingConversation
) => Promise<boolean>;

interface ConversationKnocksProps {
	conversation: WaitingConversation;
	onEnterCall: EnterWaitingGuestCall;
	transport: CallKnockTransport;
	playSound?: () => void;
}

/**
 * The people knocking in one conversation. Letting somebody in starts the
 * call first — inside the click, because the browser hands out camera and
 * microphone only during it — and admits them while it connects. The person
 * let in joins the call as soon as it rings. When the call does not start
 * (no camera or microphone, no room) nobody is admitted: the person keeps
 * waiting and stays in the notice.
 */
const ConversationKnocks = ({
	conversation,
	onEnterCall,
	transport,
	playSound
}: ConversationKnocksProps) => {
	const { t } = useTranslation();
	const { people, busy, admit, decline, admitAll } = useCallKnocks({
		enabled: true,
		scope: { sessionId: conversation.sessionId },
		transport,
		...(playSound ? { playSound } : {})
	});
	const [starting, setStarting] = useState<CallKnockBusy>(null);
	const startThen = (
		key: NonNullable<CallKnockBusy>,
		letIn: () => Promise<unknown>
	) => {
		if (starting !== null) return;
		setStarting(key);
		onEnterCall(conversation)
			.then((started) => (started ? letIn() : undefined))
			.catch(() => undefined)
			.finally(() => setStarting(null));
	};

	return (
		<CallKnockNotice
			people={people}
			placement="page"
			busy={busy ?? starting}
			admitLabel={t('calls.knock.startAndAdmit')}
			onAdmit={(knockId) => startThen(knockId, () => admit(knockId))}
			onDecline={(knockId) => void decline(knockId)}
			onAdmitAll={() => startThen('all', () => admitAll())}
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
	/** Conversations with a knock entry: where each opens and calls. */
	conversations: WaitingConversation[];
	/** Starts the call of the conversation and opens it. */
	onEnterCall: EnterWaitingGuestCall;
	transport?: CallKnockTransport;
	playSound?: () => void;
}

/**
 * The notice itself, without the app around it: asks the server once for
 * everybody who waits for this counsellor, and shows the conversation of the
 * person waiting longest. One conversation at a time: a call takes one.
 */
export const WaitingGuestNotice = ({
	conversations,
	onEnterCall,
	transport = httpCallKnockTransport,
	playSound
}: WaitingGuestNoticeProps) => {
	/* Conversations somebody waits in, the longest wait first. */
	const [waitingIn, setWaitingIn] = useState<number[]>([]);
	useEffect(
		() =>
			transport.watchAllPending((knocks) =>
				setWaitingIn([
					...new Set(
						knocks
							.map((knock) => knock.sessionId)
							.filter(
								(id): id is number => typeof id === 'number'
							)
					)
				])
			),
		[transport]
	);
	const shown = waitingIn
		.map((id) => conversations.find((c) => c.sessionId === id))
		.find(Boolean);
	if (!shown) return null;
	return (
		<ConversationKnocks
			key={shown.sessionId}
			conversation={shown}
			onEnterCall={onEnterCall}
			transport={transport}
			playSound={playSound}
		/>
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
 * Who waits is the server's answer (one list for all conversations), so a
 * knock that was answered or withdrawn never shows. Where a conversation
 * opens and which room its call starts in comes from the knock entry
 * already in the notification feed.
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
	const onEnterCall = useCallback<EnterWaitingGuestCall>(
		async (conversation) => {
			// Started inside the click: the browser hands out camera and
			// microphone only then.
			const started = start({
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
			return started;
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
