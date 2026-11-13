import * as React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import { VoicePlayer } from '../voicePlayer/VoicePlayer';

/**
 * One marked passage answered inside a message: the passage as quoted, and
 * the comment on it, written or spoken (voice notes are not transcribed).
 */
export interface PassageReply {
	/** The message the passage was marked in. */
	eventId: string;
	author: string;
	/** The marked text, as it stood in that message. */
	excerpt: string;
	text?: string;
	voice?: { src: string; durationSec: number } | null;
}

export interface PassageReplyBlocksProps {
	replies: PassageReply[];
	isMyMessage?: boolean;
	/** Click on a quote: back to its passage. */
	onJump?: (reply: PassageReply) => void;
}

/**
 * Several passages answered in one message, one block each, in the order
 * they were marked: quote, then its comment.
 */
export const PassageReplyBlocks = ({
	replies,
	isMyMessage,
	onJump
}: PassageReplyBlocksProps) => {
	const { t: translate } = useTranslation();
	return (
		<ol className="messageItem__passageReplies" data-cy="passage-replies">
			{replies.map((reply, index) => {
				const quoteClassName = clsx(
					'messageItem__replyQuote',
					isMyMessage && 'messageItem__replyQuote--myMessage',
					onJump && 'messageItem__replyQuote--jump'
				);
				const quoteBody = (
					<>
						<span className="messageItem__replyQuoteAuthor">
							{reply.author}
						</span>
						<span className="messageItem__replyQuoteText">
							{`„${reply.excerpt}“`}
						</span>
					</>
				);
				return (
					<li
						// Passages are fixed once the message is sent.
						// eslint-disable-next-line react/no-array-index-key
						key={`${reply.eventId}-${index}`}
						className="messageItem__passageReply"
						data-cy="passage-reply"
					>
						{onJump ? (
							<button
								type="button"
								className={quoteClassName}
								data-cy="reply-quote-jump"
								// The passage itself tells several quotes of
								// one author apart for screen-reader users.
								aria-label={`${translate(
									'message.reply.jumpToQuote',
									{ author: reply.author }
								)}: „${reply.excerpt}“`}
								onClick={(event) => {
									event.stopPropagation();
									onJump(reply);
								}}
							>
								{quoteBody}
							</button>
						) : (
							<div className={quoteClassName}>{quoteBody}</div>
						)}
						{reply.voice && (
							<VoicePlayer
								src={reply.voice.src}
								durationSec={reply.voice.durationSec}
								bubble="none"
								fill
								showMeta={false}
							/>
						)}
						{reply.text && (
							<p className="messageItem__passageReplyText">
								{reply.text}
							</p>
						)}
					</li>
				);
			})}
		</ol>
	);
};
