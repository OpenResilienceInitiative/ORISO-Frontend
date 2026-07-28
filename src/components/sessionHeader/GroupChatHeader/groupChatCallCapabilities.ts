export const groupChatCallCapabilities = (
	modality?: 'TEXT' | 'AUDIO' | 'VIDEO',
	isInternalGroup = false
): { audio: boolean; video: boolean } => {
	// Internal chats do not expose a modality picker. The backend therefore
	// persists the default TEXT value even though their toolbar must keep both
	// real-time call actions available.
	if (isInternalGroup) return { audio: true, video: true };
	if (!modality) return { audio: true, video: true };
	return {
		audio: modality === 'AUDIO' || modality === 'VIDEO',
		video: modality === 'VIDEO'
	};
};
