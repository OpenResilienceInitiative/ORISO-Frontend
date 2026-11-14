import * as React from 'react';
import { useTranslation } from 'react-i18next';
import MicIcon from '@mui/icons-material/Mic';

import { ComposerContextBar } from './ComposerContextBar';
import { formatClock } from '../voicePlayer/voicePlayerLayout';

/** One 32px reply bar plus the 4px gap to the next one. */
export const CONTEXT_BAR_STEP_PX = 36;

export interface ComposerPendingQuote {
	id: string;
	/** Event the answer refers to (m.in_reply_to on send). */
	eventId: string;
	/** Display name of the quoted author. */
	author: string;
	/** The passage the sender marked, plain text. */
	excerpt: string;
	/** Where the passage started in its message (repeated text). */
	excerptStart?: number | null;
	/** Text answer written in the selection popover, if any. */
	replyText?: string;
	/** Length of the voice answer recorded in the popover, if any. */
	voiceDurationSec?: number | null;
}

export interface ComposerPendingQuotesProps {
	quotes: ComposerPendingQuote[];
	onRemove?: (id: string) => void;
	/** Reply/edit bars that share the column with the collected quotes. */
	children?: React.ReactNode;
}

/**
 * Selection reply: answers to marked passages, collected for the next send.
 * Each answer is its own "Reply Bar_v2" (the same bar as a direct reply),
 * numbered so several of them stay apart; they stack in one column.
 */
export const ComposerPendingQuotes = ({
	quotes,
	onRemove,
	children
}: ComposerPendingQuotesProps) => {
	const { t: translate } = useTranslation();

	return (
		<div
			className="messageSubmit__contextStack"
			data-cy="composer-pending-quotes"
		>
			{quotes.map((quote, index) => (
				<ComposerContextBar
					key={quote.id}
					kind="reply"
					lead={translate('message.selectionReply.pendingLead', {
						number: index + 1,
						author: quote.author
					})}
					quote={
						<>
							{`„${quote.excerpt}“`}
							{quote.replyText && (
								<span className="messageSubmit__pendingQuoteAnswer">
									{` · ${quote.replyText}`}
								</span>
							)}
							{quote.voiceDurationSec ? (
								<span className="messageSubmit__pendingQuoteVoice">
									<MicIcon
										fontSize="inherit"
										aria-hidden
										focusable={false}
									/>
									{translate(
										'message.selectionReply.voiceDuration',
										{
											duration: formatClock(
												quote.voiceDurationSec
											)
										}
									)}
								</span>
							) : null}
						</>
					}
					statusLabel={translate(
						'message.selectionReply.pendingStatus',
						{ number: index + 1, author: quote.author }
					)}
					cancelLabel={translate('message.selectionReply.remove', {
						number: index + 1
					})}
					onCancel={() => onRemove?.(quote.id)}
				/>
			))}
			{children}
		</div>
	);
};
