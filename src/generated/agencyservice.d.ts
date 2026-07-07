declare namespace AgencyService {
	namespace Schemas {
		export type AgencyAdminAllowedPermissionToggles =
			AgencyAdminAllowedPermissionToggles;
		export type AgencyAdminControls = AgencyAdminControls;
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
		export type Settings = Settings;
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
