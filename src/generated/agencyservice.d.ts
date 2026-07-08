declare namespace AgencyService {
	namespace Schemas {
		export interface AgencyAdminAllowedPermissionToggles {
			/**
			 * example:
			 * true
			 */
			appearance?: boolean;
			/**
			 * example:
			 * true
			 */
			anonymousChat?: boolean;
			/**
			 * example:
			 * true
			 */
			calls?: boolean;
			/**
			 * example:
			 * true
			 */
			groupChat?: boolean;
			/**
			 * example:
			 * true
			 */
			supervision?: boolean;
			/**
			 * example:
			 * true
			 */
			supervisionAnonymousChats?: boolean;
			/**
			 * example:
			 * true
			 */
			supervisionOneOnOneChats?: boolean;
			/**
			 * example:
			 * true
			 */
			audioCalls?: boolean;
			/**
			 * example:
			 * true
			 */
			audioCallsAnonymousChats?: boolean;
			/**
			 * example:
			 * true
			 */
			audioCallsOneOnOneChats?: boolean;
			/**
			 * example:
			 * true
			 */
			audioCallsGroupChats?: boolean;
			/**
			 * example:
			 * true
			 */
			audioCallsSupervisionChats?: boolean;
			/**
			 * example:
			 * true
			 */
			videoCalls?: boolean;
			/**
			 * example:
			 * true
			 */
			videoCallsAnonymousChats?: boolean;
			/**
			 * example:
			 * true
			 */
			videoCallsOneOnOneChats?: boolean;
			/**
			 * example:
			 * true
			 */
			videoCallsGroupChats?: boolean;
			/**
			 * example:
			 * true
			 */
			videoCallsSupervisionChats?: boolean;
			/**
			 * example:
			 * true
			 */
			threads?: boolean;
			/**
			 * example:
			 * true
			 */
			threadsAnonymousChats?: boolean;
			/**
			 * example:
			 * true
			 */
			threadsOneOnOneChats?: boolean;
			/**
			 * example:
			 * true
			 */
			threadsGroupChats?: boolean;
			/**
			 * example:
			 * true
			 */
			threadsSupervisionChats?: boolean;
			/**
			 * example:
			 * true
			 */
			voiceMessages?: boolean;
			/**
			 * example:
			 * true
			 */
			voiceMessagesAnonymousChats?: boolean;
			/**
			 * example:
			 * true
			 */
			voiceMessagesOneOnOneChats?: boolean;
			/**
			 * example:
			 * true
			 */
			voiceMessagesGroupChats?: boolean;
			/**
			 * example:
			 * true
			 */
			voiceMessagesSupervisionChats?: boolean;
		}
		export interface AgencyAdminControls {
			/**
			 * example:
			 * true
			 */
			permissionsPageEnabled?: boolean;
			allowedPermissionToggles?: AgencyAdminAllowedPermissionToggles;
		}
		export interface AgencyDepartmentDTO {
			/**
			 * example:
			 * 7
			 */
			topicId?: number; // int64
			/**
			 * true if the department has a published data privacy policy of its own
			 * example:
			 * true
			 */
			hasPublishedDpp?: boolean;
			/**
			 * true if the department has a published imprint of its own
			 * example:
			 * false
			 */
			hasPublishedImprint?: boolean;
		}
		export interface AgencyResponseDTO {
			/**
			 * example:
			 * 684
			 */
			id?: number; // int64
			/**
			 * example:
			 * Suchtberatung Freiburg
			 */
			name?: string;
			/**
			 * example:
			 * 79106
			 */
			postcode?: string;
			/**
			 * example:
			 * Bonn
			 */
			city?: string;
			/**
			 * example:
			 * Our agency provides help for the following topics: Lorem ipsum..
			 */
			description?: string;
			/**
			 * example:
			 * false
			 */
			teamAgency?: boolean;
			/**
			 * example:
			 * false
			 */
			offline?: boolean;
			/**
			 * example:
			 * 0
			 */
			consultingType?: number;
			/**
			 * example:
			 * 12
			 */
			tenantId?: number; // int64
			/**
			 * example:
			 * specific for agency privacy text
			 */
			agencySpecificPrivacy?: string;
			topicIds?: number /* int64 */[];
			/**
			 * example:
			 * base64 encoded image
			 */
			agencyLogo?: string;
			settings?: Settings;
		}
		export interface AgencyTopicsDTO {
			/**
			 * example:
			 * 684
			 */
			id?: number; // int64
			/**
			 * example:
			 * Adoption and fostering a child
			 */
			name?: string;
		}
		export interface DemographicsDTO {
			/**
			 * example:
			 * 25
			 */
			ageFrom?: number;
			/**
			 * example:
			 * 55
			 */
			ageTo?: number;
			/**
			 * example:
			 * [MALE,FEMALE,DIVERS]
			 */
			genders?: string[];
		}
		export interface DepartmentLegalContentDTO {
			/**
			 * Published multilingual content as a JSON language->HTML map string; null when the text is a draft or was never authored (drafts are never exposed)
			 */
			content?: string | null;
		}
		export interface DepartmentLegalDTO {
			dpp: DepartmentLegalContentDTO;
			imprint: DepartmentLegalContentDTO;
		}
		export interface FullAgencyResponseDTO {
			/**
			 * example:
			 * 684
			 */
			id?: number; // int64
			/**
			 * example:
			 * Suchtberatung Freiburg
			 */
			name?: string;
			/**
			 * example:
			 * 79106
			 */
			postcode?: string;
			/**
			 * example:
			 * Bonn
			 */
			city?: string;
			/**
			 * example:
			 * Our agency provides help for the following topics: Lorem ipsum..
			 */
			description?: string;
			/**
			 * example:
			 * false
			 */
			teamAgency?: boolean;
			/**
			 * example:
			 * false
			 */
			offline?: boolean;
			/**
			 * example:
			 * 0
			 */
			consultingType?: number;
			/**
			 * example:
			 * 12
			 */
			tenantId?: number; // int64
			/**
			 * example:
			 * specific for agency privacy text
			 */
			agencySpecificPrivacy?: string;
			topicIds?: number /* int64 */[];
			/**
			 * example:
			 * base64 encoded image
			 */
			agencyLogo?: string;
			settings?: Settings;
			demographics?: DemographicsDTO;
			/**
			 * example:
			 * http://www.domain.com/agency
			 */
			url?: string;
			/**
			 * example:
			 * false
			 */
			external?: boolean;
			/**
			 * The agency's departments (one per assigned topic) with the publication state of their own legal texts. Optional - older clients can ignore it.
			 */
			departments?: AgencyDepartmentDTO[];
		}
		export interface Settings {
			/**
			 * example:
			 * false
			 */
			featureStatisticsEnabled?: boolean;
			/**
			 * example:
			 * false
			 */
			featureTopicsEnabled?: boolean;
			/**
			 * example:
			 * false
			 */
			topicsInRegistrationEnabled?: boolean;
			/**
			 * example:
			 * false
			 */
			featureDemographicsEnabled?: boolean;
			/**
			 * example:
			 * false
			 */
			featureAppointmentsEnabled?: boolean;
			/**
			 * example:
			 * false
			 */
			featureGroupChatV2Enabled?: boolean;
			/**
			 * example:
			 * false
			 */
			featureToolsEnabled?: boolean;
			/**
			 * example:
			 * true
			 */
			featureAnonymousChatEnabled?: boolean;
			/**
			 * example:
			 * true
			 */
			featureCallsEnabled?: boolean;
			/**
			 * Master toggle for supervision functionality (adding/removing supervisors, supervision views).
			 * example:
			 * true
			 */
			featureSupervisionEnabled?: boolean;
			/**
			 * Enable supervision functionality in anonymous chats.
			 * example:
			 * true
			 */
			featureSupervisionAnonymousChatsEnabled?: boolean;
			/**
			 * Enable supervision functionality in 1-on-1 chats.
			 * example:
			 * true
			 */
			featureSupervisionOneOnOneChatsEnabled?: boolean;
			/**
			 * Master toggle for audio call button availability (all chat types).
			 * example:
			 * true
			 */
			featureAudioCallsEnabled?: boolean;
			/**
			 * Enable audio call button in anonymous chats.
			 * example:
			 * true
			 */
			featureAudioCallsAnonymousChatsEnabled?: boolean;
			/**
			 * Enable audio call button in 1-on-1 chats.
			 * example:
			 * true
			 */
			featureAudioCallsOneOnOneChatsEnabled?: boolean;
			/**
			 * Enable audio call button in group chats.
			 * example:
			 * true
			 */
			featureAudioCallsGroupChatsEnabled?: boolean;
			/**
			 * Enable audio call button when a user is in supervision mode.
			 * example:
			 * true
			 */
			featureAudioCallsSupervisionChatsEnabled?: boolean;
			/**
			 * Master toggle for video call button availability (all chat types).
			 * example:
			 * true
			 */
			featureVideoCallsEnabled?: boolean;
			/**
			 * Enable video call button in anonymous chats.
			 * example:
			 * true
			 */
			featureVideoCallsAnonymousChatsEnabled?: boolean;
			/**
			 * Enable video call button in 1-on-1 chats.
			 * example:
			 * true
			 */
			featureVideoCallsOneOnOneChatsEnabled?: boolean;
			/**
			 * Enable video call button in group chats.
			 * example:
			 * true
			 */
			featureVideoCallsGroupChatsEnabled?: boolean;
			/**
			 * Enable video call button when a user is in supervision mode.
			 * example:
			 * true
			 */
			featureVideoCallsSupervisionChatsEnabled?: boolean;
			/**
			 * Master toggle for threads availability (all chat types).
			 * example:
			 * true
			 */
			featureThreadsEnabled?: boolean;
			/**
			 * Enable threads in anonymous chats.
			 * example:
			 * true
			 */
			featureThreadsAnonymousChatsEnabled?: boolean;
			/**
			 * Enable threads in group chats.
			 * example:
			 * true
			 */
			featureThreadsGroupChatsEnabled?: boolean;
			/**
			 * Enable threads in 1-on-1 chats.
			 * example:
			 * true
			 */
			featureThreadsOneOnOneEnabled?: boolean;
			/**
			 * Enable threads when a user is in supervision mode.
			 * example:
			 * true
			 */
			featureThreadsSupervisionChatsEnabled?: boolean;
			/**
			 * Master toggle for voice messages availability (all chat types).
			 * example:
			 * true
			 */
			featureVoiceMessagesEnabled?: boolean;
			/**
			 * Enable voice messages in anonymous chats.
			 * example:
			 * true
			 */
			featureVoiceMessagesAnonymousChatsEnabled?: boolean;
			/**
			 * Enable voice messages in 1-on-1 chats.
			 * example:
			 * true
			 */
			featureVoiceMessagesOneOnOneChatsEnabled?: boolean;
			/**
			 * Enable voice messages in group chats.
			 * example:
			 * true
			 */
			featureVoiceMessagesGroupChatsEnabled?: boolean;
			/**
			 * Enable voice messages when a user is in supervision mode.
			 * example:
			 * true
			 */
			featureVoiceMessagesSupervisionChatsEnabled?: boolean;
			/**
			 * example:
			 * false
			 */
			featureAttachmentUploadDisabled?: boolean;
			/**
			 * example:
			 * 1234-1234-1234-1234
			 */
			featureToolsOICDToken?: string;
			/**
			 * example:
			 * [en, de, fr]
			 */
			activeLanguages?: string[];
			/**
			 * example:
			 * false
			 */
			showAskerProfile?: boolean;
			/**
			 * example:
			 * false
			 */
			isVideoCallAllowed?: boolean;
			/**
			 * example:
			 * false
			 */
			featureSystemNotificationEmailsEnabled?: boolean;
			/**
			 * example:
			 * false
			 */
			featureCentralDataProtectionTemplateEnabled?: boolean;
			agencyAdminControls?: AgencyAdminControls;
		}
	}
}
declare namespace Paths {
	namespace GetAgencies {
		namespace Parameters {
			/**
			 * example:
			 * 27
			 */
			export type Age = number; // int32
			/**
			 * example:
			 * 5
			 */
			export type ConsultingType = number; // int32
			/**
			 * example:
			 * PARENTAL_COUNSELLING
			 */
			export type CounsellingRelation = string;
			/**
			 * example:
			 * FEMALE
			 */
			export type Gender = string;
			/**
			 * example:
			 * 56789
			 */
			export type Postcode = string;
			/**
			 * example:
			 * 7
			 */
			export type TopicId = number; // int32
		}
		export interface QueryParameters {
			postcode?: /**
			 * example:
			 * 56789
			 */
			Parameters.Postcode;
			consultingType: /**
			 * example:
			 * 5
			 */
			Parameters.ConsultingType /* int32 */;
			topicId?: /**
			 * example:
			 * 7
			 */
			Parameters.TopicId /* int32 */;
			age?: /**
			 * example:
			 * 27
			 */
			Parameters.Age /* int32 */;
			gender?: /**
			 * example:
			 * FEMALE
			 */
			Parameters.Gender;
			counsellingRelation?: /**
			 * example:
			 * PARENTAL_COUNSELLING
			 */
			Parameters.CounsellingRelation;
		}
		namespace Responses {
			export type $200 = AgencyService.Schemas.FullAgencyResponseDTO[];
			export interface $400 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetAgenciesByConsultingType {
		namespace Parameters {
			export type ConsultingTypeId = number;
		}
		export interface PathParameters {
			consultingTypeId: Parameters.ConsultingTypeId;
		}
		namespace Responses {
			export type $200 = AgencyService.Schemas.AgencyResponseDTO[];
			export interface $400 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetAgenciesByIds {
		namespace Parameters {
			export type AgencyIds = number /* int64 */[];
		}
		export interface PathParameters {
			agencyIds: Parameters.AgencyIds;
		}
		namespace Responses {
			export type $200 = AgencyService.Schemas.AgencyResponseDTO[];
			export interface $400 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetAgenciesTopics {
		namespace Responses {
			export type $200 = AgencyService.Schemas.AgencyTopicsDTO[];
			export interface $400 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetDepartmentLegal {
		namespace Parameters {
			export type AgencyId = number; // int64
			export type TopicId = number; // int64
		}
		export interface PathParameters {
			agencyId: Parameters.AgencyId /* int64 */;
			topicId: Parameters.TopicId /* int64 */;
		}
		namespace Responses {
			export type $200 = AgencyService.Schemas.DepartmentLegalDTO;
			export interface $404 {}
			export interface $500 {}
		}
	}
	namespace GetTenantAgencies {
		namespace Parameters {
			/**
			 * example:
			 * 56789
			 */
			export type Postcode = string;
			/**
			 * example:
			 * 7
			 */
			export type TopicId = number; // int32
		}
		export interface QueryParameters {
			postcode: /**
			 * example:
			 * 56789
			 */
			Parameters.Postcode;
			topicId: /**
			 * example:
			 * 7
			 */
			Parameters.TopicId /* int32 */;
		}
		namespace Responses {
			export type $200 = AgencyService.Schemas.FullAgencyResponseDTO[];
			export interface $400 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
}
