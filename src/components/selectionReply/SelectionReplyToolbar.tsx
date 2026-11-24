import * as React from 'react';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import MicIcon from '@mui/icons-material/Mic';

import { ReactComponent as ThreadEntryIcon } from '../../resources/img/icons/fab-menu-thread.svg';
import { ReactComponent as BlurIcon } from '../../resources/img/icons/blur_400.svg';
import { ReactComponent as SupervisionIcon } from '../../resources/img/icons/supervision_nocirc_400_24px.svg';
import { ReactComponent as TeamChatIcon } from '../../resources/img/icons/team-chat-3p.svg';
import { ReplyArrowIcon } from './ReplyArrowIcon';

export interface SelectionReplyToolbarProps {
	/** Inline position inside the selection layer. */
	style?: React.CSSProperties;
	/** Show the voice-note button (hidden where voice notes are off). */
	showVoice?: boolean;
	/** Show "Thread" (hidden where threads are off). */
	showThread?: boolean;
	onReply: () => void;
	onReplyWithVoice: () => void;
	onStartThread: () => void;
	/**
	 * FE#2494 *7: put the passage into the Supervision side chat's own
	 * reply field. Without a handler (no supervision room) not shown.
	 */
	onReplyInSupervision?: () => void;
	/** FE#2494 *7: the same into the enquiry's team side chat. */
	onReplyInTeam?: () => void;
	/**
	 * Moderators only: "Blur" hides the passage for everyone. Without a
	 * handler the entry is not shown.
	 */
	onBlur?: () => void;
}

/**
 * One icon button of the bar. The label is its accessible name and shows as
 * a small tip on hover and keyboard focus, on desktop and phone alike.
 */
export const ToolbarAction = ({
	label,
	icon,
	onClick,
	dataCy,
	withLabel = false
}: {
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	dataCy?: string;
	/** A menu row with its words (bubble menu) instead of an icon with a tip. */
	withLabel?: boolean;
}) =>
	withLabel ? (
		<button
			type="button"
			className="selectionReply__toolbarButton selectionReply__menuRow"
			onClick={onClick}
			data-cy={dataCy}
		>
			{icon}
			<span>{label}</span>
		</button>
	) : (
		<button
			type="button"
			className="selectionReply__toolbarButton selectionReply__toolbarButton--icon"
			onClick={onClick}
			aria-label={label}
			data-cy={dataCy}
		>
			{icon}
			<span className="selectionReply__toolbarTip" aria-hidden>
				{label}
			</span>
		</button>
	);

const Divider = () => (
	<span className="selectionReply__toolbarDivider" aria-hidden />
);

/**
 * The small bar over a marked passage: reply, reply by voice note, reply in
 * the Supervision or team side chat, start a thread on that passage and, for
 * moderators, blur it. Icons only; each
 * label appears as a tip. Same white card, radius and shadow as the message
 * action menu.
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
			onStartThread,
			onReplyInSupervision,
			onReplyInTeam,
			onBlur
		},
		ref
	) => {
		const { t: translate } = useTranslation();

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
				<ToolbarAction
					label={translate('message.selectionReply.reply')}
					icon={<ReplyArrowIcon />}
					onClick={onReply}
				/>
				{showVoice && (
					<ToolbarAction
						label={translate('message.selectionReply.replyVoice')}
						icon={<MicIcon fontSize="inherit" aria-hidden />}
						onClick={onReplyWithVoice}
					/>
				)}
				{onReplyInSupervision && (
					<ToolbarAction
						label={translate(
							'message.selectionReply.replyInSupervision'
						)}
						icon={
							<SupervisionIcon
								aria-hidden
								className="selectionReply__sideRoomIcon"
							/>
						}
						onClick={onReplyInSupervision}
						dataCy="selection-reply-supervision"
					/>
				)}
				{onReplyInTeam && (
					<ToolbarAction
						label={translate('message.selectionReply.replyInTeam')}
						icon={
							<TeamChatIcon
								aria-hidden
								className="selectionReply__sideRoomIcon"
							/>
						}
						onClick={onReplyInTeam}
						dataCy="selection-reply-team"
					/>
				)}
				{showThread && (
					<ToolbarAction
						label={translate('message.selectionReply.startThread')}
						icon={
							<ThreadEntryIcon
								aria-hidden
								className="selectionReply__threadIcon"
							/>
						}
						onClick={onStartThread}
					/>
				)}
				{onBlur && (
					<>
						<Divider />
						<ToolbarAction
							label={translate('message.selectionReply.blur')}
							icon={
								<BlurIcon
									aria-hidden
									className="selectionReply__blurIcon"
								/>
							}
							onClick={onBlur}
							dataCy="selection-blur"
						/>
					</>
				)}
			</div>
		);
	}
);

SelectionReplyToolbar.displayName = 'SelectionReplyToolbar';
