export const groupChatCallCapabilities = (
	modality?: 'TEXT' | 'AUDIO' | 'VIDEO'
): { audio: boolean; video: boolean } => {
	if (!modality) return { audio: true, video: true };
	return {
		audio: modality === 'AUDIO' || modality === 'VIDEO',
		video: modality === 'VIDEO'
	};
};
