import * as React from 'react';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import MicIcon from '@mui/icons-material/Mic';

import { ReactComponent as ThreadEntryIcon } from '../../resources/img/icons/fab-menu-thread.svg';
import { ReplyArrowIcon } from './ReplyArrowIcon';

export interface SelectionReplyToolbarProps {
	/** Inline position inside the selection layer. */
	style?: React.CSSProperties;
	/** Show the voice-note button (hidden where voice notes are off). */
	showVoice?: boolean;
	/** Show "Start thread" (hidden where threads are off). */
	showThread?: boolean;
	onReply: () => void;
	onReplyWithVoice: () => void;
	onStartThread: () => void;
}

/**
 * The small bar over a marked passage: reply, reply by voice note, and —
 * as the last option — start a thread on that passage. Same white card,
 * radius and shadow as the message action menu.
 */
export const SelectionReplyToolbar = forwardRef<
	HTMLDivElement,
	SelectionReplyToolbarProps
>(
	(
		{
			style,
			showVoice = true,
			showThread = true,
			onReply,
			onReplyWithVoice,
			onStartThread
		},
		ref
	) => {
		const { t: translate } = useTranslation();
		const voiceLabel = translate('message.selectionReply.replyVoice');

		return (
			<div
				ref={ref}
				role="toolbar"
				aria-label={translate('message.selectionReply.toolbar')}
				className="selectionReply__toolbar"
				data-cy="selection-reply-toolbar"
				style={style}
				// Keep the native selection while a button is pressed.
				onMouseDown={(event) => event.preventDefault()}
			>
				<button
					type="button"
					className="selectionReply__toolbarButton"
					onClick={onReply}
				>
					<ReplyArrowIcon />
					<span>{translate('message.selectionReply.reply')}</span>
				</button>
				{showVoice && (
					<>
						<span
							className="selectionReply__toolbarDivider"
							aria-hidden
						/>
						<button
							type="button"
							className="selectionReply__toolbarButton selectionReply__toolbarButton--icon"
							onClick={onReplyWithVoice}
							aria-label={voiceLabel}
							title={voiceLabel}
						>
							<MicIcon fontSize="inherit" aria-hidden />
						</button>
					</>
				)}
				{showThread && (
					<>
						<span
							className="selectionReply__toolbarDivider"
							aria-hidden
						/>
						<button
							type="button"
							className="selectionReply__toolbarButton"
							onClick={onStartThread}
						>
							<ThreadEntryIcon
								aria-hidden
								className="selectionReply__threadIcon"
							/>
							<span>
								{translate(
									'message.selectionReply.startThread'
								)}
							</span>
						</button>
					</>
				)}
			</div>
		);
	}
);

SelectionReplyToolbar.displayName = 'SelectionReplyToolbar';
