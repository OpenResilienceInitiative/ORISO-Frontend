export interface TenantDataInterface {
	id: number | null;
	name: string;
	theming: {
		logo: string;
		associationLogo: string | null;
		/**
		 * Which of the partner marks the tenant wants on the login stage
		 * (FE-H05 / #178). Absent on backends that do not deliver the setting
		 * yet — then every mark is shown, which is what the operator has to be
		 * able to switch off. Empty array = show none.
		 */
		associationLogos?: string[];
		favicon: string;
		primaryColor: string;
		secondaryColor: string;
		/**
		 * Which decorative effect the login stage runs, chosen by the tenant in
		 * Admin -> Appearance. Absent or `null` means never configured and is
		 * read as `none`, i.e. the plain stage. Additive TenantService field —
		 * older backends simply do not send it.
		 */
		loginEffect?: 'NONE' | 'LINES' | 'CONNECTED_DOTS' | 'CRACKS' | null;
	};
	content: {
		impressum: string;
		privacy: string;
		termsAndConditions: string;
		claim: string;
		dataPrivacyConfirmation: string;
		termsAndConditionsConfirmation: string;
		/**
		 * `privacy` with the data-protection placeholders (`${responsible}`,
		 * `${dataProtectionOfficer}`, …) substituted by TenantService. This is
		 * the field to show a help-seeker — `privacy` still carries the raw
		 * placeholders. Optional because a backend predating it simply omits
		 * it, in which case the raw text is the only thing there is.
		 */
		renderedPrivacy?: string;
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
	emailVisible?: boolean;
	emailRequired?: boolean;
}
