/** Only conversation capabilities may be resolved at an agency leaf. */
export const CONVERSATION_FEATURE_KEYS = [
	'featureCallsEnabled',
	'featureAudioCallsEnabled',
	'featureAudioCallsAnonymousChatsEnabled',
	'featureAudioCallsOneOnOneChatsEnabled',
	'featureAudioCallsGroupChatsEnabled',
	'featureAudioCallsSupervisionChatsEnabled',
	'featureVideoCallsEnabled',
	'featureVideoCallsAnonymousChatsEnabled',
	'featureVideoCallsOneOnOneChatsEnabled',
	'featureVideoCallsGroupChatsEnabled',
	'featureVideoCallsSupervisionChatsEnabled',
	'featureVoiceMessagesEnabled',
	'featureVoiceMessagesAnonymousChatsEnabled',
	'featureVoiceMessagesOneOnOneChatsEnabled',
	'featureVoiceMessagesGroupChatsEnabled',
	'featureVoiceMessagesSupervisionChatsEnabled',
	'featureMediaUploadEnabled',
	'featureMediaUploadAnonymousChatsEnabled',
	'featureMediaUploadOneOnOneChatsEnabled',
	'featureMediaUploadGroupChatsEnabled',
	'featureMediaUploadSupervisionChatsEnabled',
	'featureMediaInlineDisplayEnabled',
	'featureMediaInlineDisplayAnonymousChatsEnabled',
	'featureMediaInlineDisplayOneOnOneChatsEnabled',
	'featureMediaInlineDisplayGroupChatsEnabled',
	'featureMediaInlineDisplaySupervisionChatsEnabled',
	'featureGroupChatV2Enabled',
	'featureInternalGroupChatEnabled',
	'featureSelfHelpGroupsEnabled'
] as const;
export type ConversationFeatureKey = (typeof CONVERSATION_FEATURE_KEYS)[number];
export type ConversationFeatureSettings = Partial<
	Record<ConversationFeatureKey, boolean>
>;
export interface AgencyFeaturePolicy {
	value: boolean;
	mode: 'ENFORCED' | 'SUGGESTED';
	inherited: boolean;
}
export type AgencyFeaturePolicies = Partial<
	Record<ConversationFeatureKey, AgencyFeaturePolicy>
>;

/** A snapshot scoped to the open conversation, never a global tenant mutation. */
export interface AgencyConversationPolicy {
	agencyId: number | null;
	tenantId?: number | null;
	state: 'loading' | 'ready' | 'unavailable';
	settings?: import('./UserDataInterface').AgencySettingsInterface | null;
}
