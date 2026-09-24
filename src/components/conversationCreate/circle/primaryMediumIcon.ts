import { GroupChatModality } from '../../groupChat/createChatHelpers';

export type PrimaryMediumIcon =
	| 'generic-outline'
	| 'chat-outline'
	| 'chat-filled'
	| 'audio-outline'
	| 'audio-filled'
	| 'video-outline'
	| 'video-filled';

/**
 * Selects the master icon for the primary medium row. Resting or elevated
 * controls use the 400 glyph; a chosen tonal value uses its filled partner.
 */
export const resolvePrimaryMediumIcon = (
	modality: GroupChatModality | undefined,
	filled: boolean
): PrimaryMediumIcon => {
	if (!modality) {
		return 'generic-outline';
	}
	const family =
		modality === 'VIDEO'
			? 'video'
			: modality === 'AUDIO'
				? 'audio'
				: 'chat';
	return `${family}-${filled ? 'filled' : 'outline'}`;
};
