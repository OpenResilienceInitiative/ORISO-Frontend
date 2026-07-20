export interface TenantDataInterface {
	id: number | null;
	name: string;
	theming: {
		logo: string;
		associationLogo: string | null;
		favicon: string;
		primaryColor: string;
		secondaryColor: string;
	};
	content: {
		impressum: string;
		privacy: string;
		termsAndConditions: string;
		claim: string;
		dataPrivacyConfirmation: string;
		termsAndConditionsConfirmation: string;
		renderedPrivacy: string;
		/**
		 * Raw stored language->HTML maps incl. `<lang>__meta` machine-
		 * translation metadata keys (additive TenantService fields; absent
		 * on older backends). May be empty when no content is stored.
		 */
		impressumLanguages?: Record<string, string>;
		privacyLanguages?: Record<string, string>;
	};
	settings?: TenantDataSettingsInterface;
}

export interface TenantDataSettingsInterface {
	activeLanguages: string[];
	featureAppointmentsEnabled: boolean;
	featureDemographicsEnabled: boolean;
	featureGroupChatV2Enabled: boolean;
	featureStatisticsEnabled: boolean;
	featureToolsEnabled: boolean;
	featureToolsOICDToken: string;
	featureTopicsEnabled: boolean;
	topicsInRegistrationEnabled: boolean;
	featureMediaUploadEnabled?: boolean;
	featureMediaUploadAnonymousChatsEnabled?: boolean;
	featureMediaUploadOneOnOneChatsEnabled?: boolean;
	featureMediaUploadGroupChatsEnabled?: boolean;
	featureMediaUploadSupervisionChatsEnabled?: boolean;
	featureMediaInlineDisplayEnabled?: boolean;
	featureMediaInlineDisplayAnonymousChatsEnabled?: boolean;
	featureMediaInlineDisplayOneOnOneChatsEnabled?: boolean;
	featureMediaInlineDisplayGroupChatsEnabled?: boolean;
	featureMediaInlineDisplaySupervisionChatsEnabled?: boolean;
	featureMediaAiScanEnabled?: boolean;
	featureMediaAiScanAnonymousChatsEnabled?: boolean;
	featureMediaAiScanOneOnOneChatsEnabled?: boolean;
	featureMediaAiScanGroupChatsEnabled?: boolean;
	featureMediaAiScanSupervisionChatsEnabled?: boolean;
	featureAnonymousChatEnabled?: boolean;
	featureCallsEnabled?: boolean;
	featureSupervisionEnabled?: boolean;
	featureSupervisionAnonymousChatsEnabled?: boolean;
	featureSupervisionOneOnOneChatsEnabled?: boolean;
	featureAudioCallsEnabled?: boolean;
	featureAudioCallsAnonymousChatsEnabled?: boolean;
	featureAudioCallsOneOnOneChatsEnabled?: boolean;
	featureAudioCallsGroupChatsEnabled?: boolean;
	featureAudioCallsSupervisionChatsEnabled?: boolean;
	featureVideoCallsEnabled?: boolean;
	featureVideoCallsAnonymousChatsEnabled?: boolean;
	featureVideoCallsOneOnOneChatsEnabled?: boolean;
	featureVideoCallsGroupChatsEnabled?: boolean;
	featureVideoCallsSupervisionChatsEnabled?: boolean;
	featureThreadsEnabled?: boolean;
	featureTeamDiscussionEnabled?: boolean;
	featureThreadsAnonymousChatsEnabled?: boolean;
	featureThreadsGroupChatsEnabled?: boolean;
	featureThreadsOneOnOneEnabled?: boolean;
	featureThreadsSupervisionChatsEnabled?: boolean;
	featureVoiceMessagesEnabled?: boolean;
	featureVoiceMessagesAnonymousChatsEnabled?: boolean;
	featureVoiceMessagesOneOnOneChatsEnabled?: boolean;
	featureVoiceMessagesGroupChatsEnabled?: boolean;
	featureVoiceMessagesSupervisionChatsEnabled?: boolean;
}
