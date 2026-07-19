/**
 * FE#514 / ADR-016 — Team-Besprechung panel.
 *
 * A flat, team-only discussion attached to one open enquiry, backed by a
 * separate Matrix room (US#473) the advice seeker can never access. The panel
 * carries a permanent team-only marker, shows a read-only state once the
 * enquiry was accepted (hard close), and posts through the normal transport
 * with the team-discussion producer flag so the backend hybrid fan-out runs.
 *
 * Split container (API/Matrix wiring) vs. {@link TeamDiscussionPanelView}
 * (pure presentation) following the CaseHandoverCurtain pattern, so Storybook
 * exercises every state without network.
 */
import * as React from 'react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiGetTeamDiscussion,
	apiOpenTeamDiscussion,
	TeamDiscussion
} from '../../api/apiTeamDiscussion';
import { chatTransportService } from '../../services/chatTransportService';
import { getMatrixClientService } from '../../services/matrixClientRegistry';
import { UserDataContext } from '../../globalState';
import { invalidateTeamDiscussionCache } from './TeamDiscussionBadge';
import {
	mapTimelineToDiscussionMessages,
	TeamDiscussionMessage
} from './teamDiscussionHelpers';
import {
	TeamDiscussionPanelView,
	TeamDiscussionPanelViewProps
} from './TeamDiscussionPanelView';
import './teamDiscussion.styles.scss';

const TIMELINE_LIMIT = 100;
const ROOM_SYNC_RETRY_MS = 2000;

export { TeamDiscussionPanelView };
export type { TeamDiscussionPanelViewProps };

/* ------------------------------------------------------------------ *
 * Container
 * ------------------------------------------------------------------ */

interface TeamDiscussionPanelProps {
	sessionId: number;
	/** Collapsed by default; the toggle header always renders. */
	initiallyOpen?: boolean;
	/**
	 * ADR-016: starting a discussion is only possible on an open enquiry.
	 * After acceptance the panel appears solely when an (archived) discussion
	 * already exists — read-only archive access, never a new start.
	 */
	allowCreate?: boolean;
}

export const TeamDiscussionPanel = ({
	sessionId,
	initiallyOpen = false,
	allowCreate = true
}: TeamDiscussionPanelProps) => {
	const { t: translate } = useTranslation();
	const { userData } = useContext(UserDataContext);

	const [isOpen, setIsOpen] = useState(false);
	const [discussion, setDiscussion] = useState<TeamDiscussion | null>(null);
	const [discussionLoaded, setDiscussionLoaded] = useState(false);
	const [messages, setMessages] = useState<TeamDiscussionMessage[]>([]);
	const [draft, setDraft] = useState('');
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isArchived = discussion?.status === 'ARCHIVED';

	useEffect(() => {
		let cancelled = false;
		apiGetTeamDiscussion(sessionId)
			.then((result) => {
				if (!cancelled) {
					setDiscussion(result);
					setDiscussionLoaded(true);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setDiscussionLoaded(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	// Deep-link (?teamDiscussion=1): reactive, not mount-time only — a
	// notification click while already viewing the session updates the URL
	// without remounting. Opens the panel and joins the room; join failures
	// surface as the regular open error instead of being swallowed.
	const deepLinkHandledRef = useRef(false);
	useEffect(() => {
		deepLinkHandledRef.current = false;
	}, [sessionId]);
	useEffect(() => {
		if (
			!initiallyOpen ||
			!discussionLoaded ||
			!discussion ||
			deepLinkHandledRef.current
		) {
			return;
		}
		deepLinkHandledRef.current = true;
		setIsOpen(true);
		apiOpenTeamDiscussion(sessionId)
			.then((joined) => joined && setDiscussion(joined))
			.catch(() => setError(translate('teamDiscussion.error.open')));
	}, [initiallyOpen, discussionLoaded, discussion, sessionId, translate]);

	const refreshMessages = useCallback((matrixRoomId: string) => {
		const ownMatrixUserId =
			getMatrixClientService()?.getClient?.()?.getUserId?.() || null;
		const room = chatTransportService.getMatrixRoom(matrixRoomId);
		const events = chatTransportService.getMatrixRoomMessages(
			matrixRoomId,
			TIMELINE_LIMIT
		);
		setMessages(
			mapTimelineToDiscussionMessages(
				events,
				ownMatrixUserId,
				(matrixUserId) =>
					room?.getMember?.(matrixUserId)?.name || undefined
			)
		);
	}, []);

	useEffect(() => {
		const matrixRoomId = discussion?.matrixRoomId;
		if (!matrixRoomId || !isOpen) {
			return;
		}
		refreshMessages(matrixRoomId);
		// Right after a lazy join the room may not be synced yet — one retry.
		const retry = window.setTimeout(
			() => refreshMessages(matrixRoomId),
			ROOM_SYNC_RETRY_MS
		);
		const unsubscribe = chatTransportService.onMatrixTimeline(
			matrixRoomId,
			() => refreshMessages(matrixRoomId)
		);
		return () => {
			window.clearTimeout(retry);
			unsubscribe?.();
		};
	}, [discussion?.matrixRoomId, isOpen, refreshMessages]);

	const handleToggle = () => {
		if (!discussion) {
			if (!allowCreate) {
				return;
			}
			setError(null);
			apiOpenTeamDiscussion(sessionId)
				.then((result) => {
					setDiscussion(result);
					setIsOpen(true);
					invalidateTeamDiscussionCache(sessionId);
				})
				.catch(() => setError(translate('teamDiscussion.error.open')));
			return;
		}
		if (!isOpen) {
			// Joins the caller into the room (idempotent on the backend).
			apiOpenTeamDiscussion(sessionId)
				.then((result) => result && setDiscussion(result))
				.catch(() => undefined);
		}
		setIsOpen(!isOpen);
	};

	const handleSend = () => {
		const message = draft.trim();
		if (!message || !discussion?.matrixRoomId || isSending || isArchived) {
			return;
		}
		setIsSending(true);
		setError(null);
		chatTransportService
			.sendTextMessage({
				roomIdOrSessionId: discussion.matrixRoomId,
				matrixRoomId: discussion.matrixRoomId,
				message,
				sendMailNotification: false,
				isEncrypted: false,
				teamDiscussion: true,
				senderDisplayName: userData?.userName || null
			})
			.then(() => {
				setDraft('');
				refreshMessages(discussion.matrixRoomId);
			})
			.catch(() => setError(translate('teamDiscussion.error.send')))
			.finally(() => setIsSending(false));
	};

	if (!discussionLoaded) {
		return null;
	}

	if (!discussion && !allowCreate) {
		return null;
	}

	return (
		<TeamDiscussionPanelView
			discussion={discussion}
			messages={messages}
			isOpen={isOpen}
			draft={draft}
			isSending={isSending}
			error={error}
			onToggle={handleToggle}
			onDraftChange={setDraft}
			onSend={handleSend}
		/>
	);
};
