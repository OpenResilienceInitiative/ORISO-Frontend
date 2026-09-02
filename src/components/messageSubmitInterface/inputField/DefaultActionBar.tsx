import * as React from 'react';
import type { TFunction } from 'i18next';
import MicIcon from '@mui/icons-material/Mic';
import AddReactionOutlinedIcon from '@mui/icons-material/AddReactionOutlined';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import AddIcon from '@mui/icons-material/Add';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import { ToolbarButton } from './ToolbarButton';
import './composerToolbar.styles.scss';

/** Figma "SVG - Text formatieren": T glyph with pen, opens the full tools. */
const TextFormatIcon = () => (
	<span className="composerToolbar__textFormatIcon" aria-hidden="true">
		<svg width="11" height="10" viewBox="0 0 11 10" fill="none">
			<path
				d="M0 1.2V0.800001C0 0.358173 0.358173 0 0.8 0H10.1474C10.5892 0 10.9474 0.358172 10.9474 0.800001V1.35103C10.9474 1.79286 10.5892 2 10.1474 2H6.4V7.6C6.4 7.2 6.4 7.73624 6.4 7.6L4.21052 10V2H2.4H0.8C0.358172 2 0 2 0 1.2Z"
				fill="currentColor"
			/>
		</svg>
		<svg width="9" height="10" viewBox="0 0 9 10" fill="none">
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M0 9.68V7.10875L6.16 0.347875C6.26083 0.236958 6.37771 0.15125 6.51063 0.09075C6.64354 0.03025 6.78333 0 6.93 0C7.07667 0 7.21875 0.03025 7.35625 0.09075C7.49375 0.15125 7.6175 0.242 7.7275 0.363L8.48375 1.21C8.59375 1.32092 8.67396 1.452 8.72438 1.60325C8.77479 1.7545 8.8 1.91079 8.8 2.07213C8.8 2.22338 8.77479 2.3721 8.72438 2.51831C8.67396 2.66452 8.59375 2.79813 8.48375 2.91913L2.3375 9.68H0ZM1.87 8.47H1.1V7.623L5.37625 2.904L6.16 3.76613L1.87 8.47Z"
				fill="currentColor"
			/>
		</svg>
	</span>
);

export interface DefaultActionBarProps {
	onOpenTools: () => void;
	/** Mic is hidden entirely when voice messages are disabled for this chat. */
	showMic: boolean;
	isRecording: boolean;
	onMicClick: () => void;
	isEmojiOpen: boolean;
	onEmojiClick: () => void;
	onMentionClick: () => void;
	showAttachment: boolean;
	onAttachmentClick: () => void;
	isExpanded: boolean;
	onExpandToggle: () => void;
	translate: TFunction;
}

/**
 * Default (editor closed) action bar — Figma "Standard Tool…" strip:
 * text-format toggle, mic*, emoji, mention, add, maximize. The mic icon
 * disappears automatically when audio messages are disabled (Figma note on
 * node 7104:34790).
 */
export const DefaultActionBar = ({
	onOpenTools,
	showMic,
	isRecording,
	onMicClick,
	isEmojiOpen,
	onEmojiClick,
	onMentionClick,
	showAttachment,
	onAttachmentClick,
	isExpanded,
	onExpandToggle,
	translate
}: DefaultActionBarProps) => (
	<div className="composerToolbar composerToolbar--default">
		<ToolbarButton
			label={translate('message.submit.toolbar.openTools')}
			onClick={onOpenTools}
		>
			<TextFormatIcon />
		</ToolbarButton>
		{showMic && (
			<ToolbarButton
				label={translate('message.submit.toolbar.voiceRecording.label')}
				title={translate(
					'message.submit.toolbar.voiceRecording.tooltip'
				)}
				onClick={onMicClick}
				selected={isRecording}
			>
				<MicIcon fontSize="inherit" />
			</ToolbarButton>
		)}
		<ToolbarButton
			label={translate('message.submit.toolbar.emoji')}
			onClick={onEmojiClick}
			selected={isEmojiOpen}
			expanded={isEmojiOpen}
			data-emoji-picker-toggle=""
		>
			<AddReactionOutlinedIcon fontSize="inherit" />
		</ToolbarButton>
		<ToolbarButton
			label={translate('message.submit.toolbar.mention')}
			onClick={onMentionClick}
		>
			<AlternateEmailIcon fontSize="inherit" />
		</ToolbarButton>
		{showAttachment && (
			<ToolbarButton
				label={translate('message.submit.toolbar.attachment')}
				onClick={onAttachmentClick}
			>
				<AddIcon fontSize="inherit" />
			</ToolbarButton>
		)}
		<ToolbarButton
			label={translate(
				isExpanded
					? 'message.submit.toolbar.minimize'
					: 'message.submit.toolbar.maximize'
			)}
			onClick={onExpandToggle}
		>
			{isExpanded ? (
				<CloseFullscreenIcon fontSize="inherit" />
			) : (
				<OpenInFullIcon fontSize="inherit" />
			)}
		</ToolbarButton>
	</div>
);
