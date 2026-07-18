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
import './teamDiscussion.styles.scss';

const TIMELINE_LIMIT = 100;
const ROOM_SYNC_RETRY_MS = 2000;

/* ------------------------------------------------------------------ *
 * Presentational view
 * ------------------------------------------------------------------ */

export interface TeamDiscussionPanelViewProps {
	discussion: TeamDiscussion | null;
	messages: TeamDiscussionMessage[];
	isOpen: boolean;
	draft: string;
	isSending: boolean;
	error: string | null;
	onToggle: () => void;
	onDraftChange: (value: string) => void;
	onSend: () => void;
}

export const TeamDiscussionPanelView = ({
	discussion,
	messages,
	isOpen,
	draft,
	isSending,
	error,
	onToggle,
	onDraftChange,
	onSend
}: TeamDiscussionPanelViewProps) => {
	const { t: translate } = useTranslation();
	const feedEndRef = useRef<HTMLDivElement | null>(null);
	const isArchived = discussion?.status === 'ARCHIVED';

	useEffect(() => {
		feedEndRef.current?.scrollIntoView({ block: 'end' });
	}, [messages.length]);

	return (
		<section
			className="teamDiscussion"
			data-cy="team-discussion-panel"
			aria-label={translate('teamDiscussion.title')}
		>
			<button
				type="button"
				className="teamDiscussion__toggle"
				onClick={onToggle}
				aria-expanded={isOpen}
				data-cy="team-discussion-toggle"
			>
				<span className="teamDiscussion__toggleTitle">
					{translate('teamDiscussion.title')}
				</span>
				{discussion && messages.length > 0 && (
					<span
						className="teamDiscussion__count"
						data-cy="team-discussion-count"
					>
						{translate('teamDiscussion.postCount', {
							count: messages.length
						})}
					</span>
				)}
				{isArchived && (
					<span className="teamDiscussion__archivedChip">
						{translate('teamDiscussion.archivedChip')}
					</span>
				)}
				{!discussion && (
					<span className="teamDiscussion__startHint">
						{translate('teamDiscussion.startHint')}
					</span>
				)}
			</button>

			{isOpen && discussion && (
				<div className="teamDiscussion__body">
					{/* Permanent marker — never let a counsellor be unsure
					    which side of the curtain they are writing on. */}
					<div
						className="teamDiscussion__marker"
						data-cy="team-discussion-marker"
					>
						{translate('teamDiscussion.teamOnlyMarker')}
					</div>

					{isArchived && (
						<div
							className="teamDiscussion__archivedBanner"
							data-cy="team-discussion-archived"
						>
							{translate('teamDiscussion.archivedBanner', {
								date: discussion.archiveDate
									? new Date(
											discussion.archiveDate
										).toLocaleDateString()
									: ''
							})}
						</div>
					)}

					<div className="teamDiscussion__feed">
						{messages.length === 0 && (
							<p className="teamDiscussion__empty">
								{translate('teamDiscussion.empty')}
							</p>
						)}
						{messages.map((message) => (
							<div
								key={message.id}
								className={
									'teamDiscussion__message' +
									(message.isOwn
										? ' teamDiscussion__message--own'
										: '')
								}
							>
								<span className="teamDiscussion__messageSender">
									{message.senderDisplayName}
								</span>
								<span className="teamDiscussion__messageBody">
									{message.body}
								</span>
								<span className="teamDiscussion__messageTime">
									{new Date(message.ts).toLocaleTimeString(
										[],
										{
											hour: '2-digit',
											minute: '2-digit'
										}
									)}
								</span>
							</div>
						))}
						<div ref={feedEndRef} />
					</div>

					{!isArchived && (
						<div className="teamDiscussion__composer">
							<textarea
								className="teamDiscussion__input"
								value={draft}
								onChange={(e) => onDraftChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										onSend();
									}
								}}
								placeholder={translate(
									'teamDiscussion.placeholder'
								)}
								rows={2}
								data-cy="team-discussion-input"
							/>
							<button
								type="button"
								className="teamDiscussion__send"
								onClick={onSend}
								disabled={isSending || !draft.trim()}
								data-cy="team-discussion-send"
							>
								{translate('teamDiscussion.send')}
							</button>
						</div>
					)}

					{error && (
						<p className="teamDiscussion__error" role="alert">
							{error}
						</p>
					)}
				</div>
			)}
		</section>
	);
};

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

	const [isOpen, setIsOpen] = useState(initiallyOpen);
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
