import { TenantDataSettingsInterface } from '../globalState/interfaces/TenantDataInterface';

/** `team`: the team chat beside an open enquiry (FE#2491). */
export type MediaChatType =
	| 'anonymous'
	| 'oneOnOne'
	| 'group'
	| 'supervision'
	| 'team';

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
		featureMediaUploadSupervisionChatsEnabled = true,
		featureMediaUploadTeamDiscussionsEnabled = true
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
		case 'team':
			return featureMediaUploadTeamDiscussionsEnabled !== false;
		default:
			return featureMediaUploadOneOnOneChatsEnabled !== false;
	}
};

/**
 * Effective "render media inline as scaled thumbnails" value for a chat type,
 * from the featureMediaInlineDisplay* family. Off means media arrives as a
 * plain downloadable file — nothing is rendered. Same absent-defaults-to-on
 * semantics as {@link hasMediaUploadFeature}.
 */
export const hasMediaInlineDisplayFeature = (
	settings: Partial<TenantDataSettingsInterface> | undefined,
	chatType: MediaChatType
): boolean => {
	const {
		featureMediaInlineDisplayEnabled = true,
		featureMediaInlineDisplayAnonymousChatsEnabled = true,
		featureMediaInlineDisplayOneOnOneChatsEnabled = true,
		featureMediaInlineDisplayGroupChatsEnabled = true,
		featureMediaInlineDisplaySupervisionChatsEnabled = true,
		featureMediaInlineDisplayTeamDiscussionsEnabled = true
	} = settings || {};

	if (featureMediaInlineDisplayEnabled === false) {
		return false;
	}
	switch (chatType) {
		case 'anonymous':
			return featureMediaInlineDisplayAnonymousChatsEnabled !== false;
		case 'group':
			return featureMediaInlineDisplayGroupChatsEnabled !== false;
		case 'supervision':
			return featureMediaInlineDisplaySupervisionChatsEnabled !== false;
		case 'team':
			return featureMediaInlineDisplayTeamDiscussionsEnabled !== false;
		default:
			return featureMediaInlineDisplayOneOnOneChatsEnabled !== false;
	}
};
