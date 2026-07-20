/**
 * FE#514 / ADR-016 — pure presentational half of the Team-Besprechung panel.
 * Kept free of transport/globalState imports so jsdom tests and Storybook can
 * load it without dragging in lottie/matrix (see TeamDiscussionPanel.tsx for
 * the container).
 */
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TeamDiscussion } from '../../api/apiTeamDiscussion';
import { TeamDiscussionMessage } from './teamDiscussionHelpers';
import './teamDiscussion.styles.scss';

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
