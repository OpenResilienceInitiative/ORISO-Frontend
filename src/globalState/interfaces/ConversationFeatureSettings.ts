/**
 * Single registry of conversation capabilities resolved platform -> Traeger -> agency.
 * Every conversation feature the app reads must be listed here and read through
 * useConversationFeatureSettings / resolveConversationFeatureSettings, never from raw
 * getTenantSettings() (enforced by conversationFeatureRegistry.test.ts).
 */
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
	'featureSelfHelpGroupsEnabled',
	'featureAnonymousChatEnabled',
	'featureSupervisionEnabled',
	'featureSupervisionAnonymousChatsEnabled',
	'featureSupervisionOneOnOneChatsEnabled',
	'featureThreadsEnabled',
	'featureThreadsAnonymousChatsEnabled',
	'featureThreadsGroupChatsEnabled',
	// Irregular wire name (no "Chats"); matches TenantService/AgencyService policy key.
	'featureThreadsOneOnOneEnabled',
	'featureThreadsSupervisionChatsEnabled',
	// FE#2491: the team chat on an open enquiry is a policy like supervision
	// (TenantService#405, AgencyService#389), with its own chat features.
	'featureTeamDiscussionEnabled',
	// FE#2491: off (default) archives the team chat read-only at accept
	// (ADR-016); on keeps it switchable in the accepted case.
	'featureTeamDiscussionAfterAcceptEnabled',
	'featureVideoCallsTeamDiscussionsEnabled',
	'featureAudioCallsTeamDiscussionsEnabled',
	'featureVoiceMessagesTeamDiscussionsEnabled',
	'featureThreadsTeamDiscussionsEnabled',
	'featureMediaUploadTeamDiscussionsEnabled',
	'featureMediaInlineDisplayTeamDiscussionsEnabled',
	'featureMediaAiScanTeamDiscussionsEnabled'
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
