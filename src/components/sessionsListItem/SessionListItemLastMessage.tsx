import React from 'react';
import { useTranslation } from 'react-i18next';
import { ALIAS_LAST_MESSAGES } from '../../resources/scripts/config';
import { toMessagePreviewText } from '../../utils/messagePreviewText';
import { ReactComponent as ThreadGlyph } from '../../resources/img/icons/fab-menu-thread.svg';
import { ReactComponent as VoiceGlyph } from '../../resources/img/icons/audio-on.svg';
import type { ListPreviewGlyph } from './matrixRoomPreview';

interface SessionListItemLastMessageProps {
	showSpan?: boolean;
	showLanguage?: boolean;
	language?: string;
	lastMessage: string | null;
	lastMessageType?: string | null;
	/** Thread / voice marks drawn before the text (Frank, 16.09.2026). */
	glyphs?: ListPreviewGlyph[];
}

const GLYPHS: Record<
	ListPreviewGlyph,
	{ Icon: React.FC<React.SVGProps<SVGSVGElement>>; labelKey: string }
> = {
	thread: { Icon: ThreadGlyph, labelKey: 'chatStage.switcher.kind.thread' },
	voice: { Icon: VoiceGlyph, labelKey: 'sessionList.preview.voice' }
};

export const SessionListItemLastMessage: React.FC<
	SessionListItemLastMessageProps
> = ({
	showSpan,
	language,
	lastMessage,
	lastMessageType,
	showLanguage,
	glyphs = []
}) => {
	const { t: translate } = useTranslation();

	// do not show anything
	if (showSpan) return <span></span>;
	if (!lastMessage && !lastMessageType && glyphs.length === 0) return null;

	const languageAddOn = (
		<span>
			{/* we need a &nbsp; here, to ensure correct spacing for long messages */}
			{showLanguage && language && language.toUpperCase()} |&nbsp;
		</span>
	);

	let aliasMessage = ALIAS_LAST_MESSAGES[lastMessageType];
	const previewMessage = toMessagePreviewText(lastMessage);

	// reassign_consultant alias can have multiple states
	if (lastMessageType === 'REASSIGN_CONSULTANT') {
		try {
			if (JSON.parse(lastMessage)?.status) {
				aliasMessage += `.${JSON.parse(lastMessage).status}`;
			}
		} catch {
			// if no json -> do nothing
		}
	}

	return (
		<div
			className={`sessionsListItem__subject ${
				aliasMessage ? 'sessionsListItem__subject--aliasMessage' : ''
			}`}
		>
			{glyphs.map((glyph) => {
				const { Icon, labelKey } = GLYPHS[glyph];
				return (
					<Icon
						key={glyph}
						className={`sessionsListItem__previewGlyph sessionsListItem__previewGlyph--${glyph}`}
						role="img"
						aria-label={translate(labelKey)}
						focusable="false"
					/>
				);
			})}
			{showLanguage && language && languageAddOn}
			{aliasMessage ? translate(aliasMessage) : previewMessage}
		</div>
	);
};
