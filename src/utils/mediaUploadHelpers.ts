import { TenantDataSettingsInterface } from '../globalState/interfaces/TenantDataInterface';

export type MediaChatType = 'anonymous' | 'oneOnOne' | 'group' | 'supervision';

/**
 * Effective "may media be uploaded" value for a chat type, from the
 * featureMediaUpload* family (successor of the retired
 * featureAttachmentUploadDisabled, ADR-015). Absent flags count as enabled —
 * the backend defaults the whole family to on.
 */
export const hasMediaUploadFeature = (
	settings: Partial<TenantDataSettingsInterface> | undefined,
	chatType: MediaChatType
): boolean => {
	const {
		featureMediaUploadEnabled = true,
		featureMediaUploadAnonymousChatsEnabled = true,
		featureMediaUploadOneOnOneChatsEnabled = true,
		featureMediaUploadGroupChatsEnabled = true,
		featureMediaUploadSupervisionChatsEnabled = true
	} = settings || {};

	if (featureMediaUploadEnabled === false) {
		return false;
	}
	switch (chatType) {
		case 'anonymous':
			return featureMediaUploadAnonymousChatsEnabled !== false;
		case 'group':
			return featureMediaUploadGroupChatsEnabled !== false;
		case 'supervision':
			return featureMediaUploadSupervisionChatsEnabled !== false;
		default:
			return featureMediaUploadOneOnOneChatsEnabled !== false;
	}
};
