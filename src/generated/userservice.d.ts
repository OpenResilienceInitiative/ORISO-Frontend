declare namespace UserService {
	namespace Schemas {
		export interface AbsenceDTO {
			/**
			 * example:
			 * true
			 */
			absent: boolean;
			/**
			 * example:
			 * Ich bin abwesend vom...bis.
			 */
			message?: string;
		}
		export interface AdditionalInformationDTO {
			name?: string;
			value?: string;
		}
		export interface AdminAgencyResponseDTO {
			_embedded: AgencyAdminFullResponseDTO[];
			_links: AgencyLinks;
			total?: number;
		}
		export interface AdminDTO {
			/**
			 * example:
			 * 0f2cca9c-9303-4791-a0a5-a1ce16f1524f
			 */
			id?: string;
			/**
			 * example:
			 * max.mustermann
			 */
			username?: string;
			/**
			 * example:
			 * Max
			 */
			firstname?: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastname?: string;
			/**
			 * example:
			 * max@mustermann.de
			 */
			email?: string;
			createDate?: string;
			updateDate?: string;
			deleteDate?: string;
			tenantId?: string;
			tenantName?: string;
			tenantSubdomain?: string;
			agencies?: AgencyAdminResponseDTO[];
			publicName?: string;
			roleInOrg?: string;
			vacated?: boolean;
			adminRights?: boolean;
			/**
			 * true if this admin also holds a consultant identity on the same account
			 */
			hasOtherIdentity?: boolean;
		}
		export interface AdminFilter {
			username?: string;
			lastname?: string;
			email?: string;
			agencyId?: number; // int64
		}
		export interface AdminLinks {
			self: HalLink;
			update?: HalLink;
			delete?: HalLink;
			agencies?: HalLink;
			addAgency?: HalLink;
		}
		export interface AdminResponseDTO {
			_embedded?: AdminDTO;
			_links?: AdminLinks;
		}
		export interface AdminSearchResultDTO {
			_embedded?: AdminResponseDTO[];
			_links?: PaginationLinks;
			total?: number;
		}
		export interface AgencyAdminFullResponseDTO {
			_embedded?: AgencyAdminResponseDTO;
			_links?: AgencyLinks;
		}
		export interface AgencyAdminResponseDTO {
			/**
			 * example:
			 * 684
			 */
			id?: number; // int64
			/**
			 * example:
			 * 684
			 */
			dioceseId?: number; // int64
			/**
			 * example:
			 * Suchtberatung Freiburg
			 */
			name?: string;
			/**
			 * example:
			 * Our agency provides help for the following topics: Lorem ipsum..
			 */
			description?: string;
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
			 * 1
			 */
			consultingType?: number;
			/**
			 * example:
			 * https://www.domain.com
			 */
			url?: string;
			/**
			 * example:
			 * false
			 */
			external?: boolean;
			/**
			 * example:
			 * 2019-08-23T08:52:05
			 */
			createDate?: string;
			/**
			 * example:
			 * 2019-12-02T13:12:08
			 */
			updateDate?: string;
			/**
			 * example:
			 * 2020-09-02T15:53:23
			 */
			deleteDate?: string;
		}
		export interface AgencyAdminSearchResultDTO {
			_embedded?: AgencyAdminFullResponseDTO[];
			_links?: SearchResultLinks;
			total?: number;
		}
		export interface AgencyConsultantResponseDTO {
			_embedded: ConsultantAdminResponseDTO[];
			_links: ConsultantAgencyLinks;
			total?: number;
		}
		export interface AgencyDTO {
			/**
			 * example:
			 * 153918
			 */
			id?: number; // int64
			/**
			 * example:
			 * Alkohol-Beratung
			 */
			name?: string;
			/**
			 * example:
			 * 53113
			 */
			postcode?: string;
			/**
			 * example:
			 * Bonn
			 */
			city?: string;
			/**
			 * example:
			 * Our agency provides help for the following topics..
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
			 * 1
			 */
			consultingType?: number;
			/**
			 * example:
			 * 12
			 */
			tenantId?: number; // int64
			topicIds?: number /* int64 */[];
		}
		export interface AgencyLinks {
			self: HalLink;
		}
		export interface AgencyPostcodeRangeResponseDTO {
			_embedded?: PostcodeRangeResponseDTO;
			_links?: DefaultLinks;
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
			topicIds?: number /* int64 */[];
		}
		export interface AgencyTypeDTO {
			agencyType: 'TEAM_AGENCY' | 'DEFAULT_AGENCY';
		}
		export interface AgencyTypeRequestDTO {
			agencyType: 'TEAM_AGENCY' | 'DEFAULT_AGENCY';
		}
		export interface AliasMessageDTO {
			videoCallMessageDTO?: VideoCallMessageDTO;
			messageType?: MessageType;
			content?: string;
		}
		export interface AskerDTO {
			/**
			 * example:
			 * 0f2cca9c-9303-4791-a0a5-a1ce16f1524f
			 */
			id?: string;
			/**
			 * example:
			 * max@mustermann.de
			 */
			email?: string;
		}
		export interface AskerResponseDTO {
			/**
			 * example:
			 * 0f2cca9c-9303-4791-a0a5-a1ce16f1524f
			 */
			id?: string;
			/**
			 * example:
			 * max94
			 */
			username?: string;
			/**
			 * example:
			 * max@mustermann.de
			 */
			email?: string;
		}
		/**
		 * Supervision (auto-assigned): the consultant id of this counsellor's standing supervisor, who is automatically attached read-only to every case the counsellor accepts. At most one; the target must itself have isSupervisor = true and may not be the counsellor themselves. Omitted/null leaves the current assignment untouched; an empty string clears it (clearing stops future auto-attachment and does not detach supervisors already on in-flight cases).
		 * example:
		 * 8bb2b0a4-2c5b-4f5a-9c3a-1d2e3f4a5b6c
		 */
		export type AssignedSupervisorId = string;
		export interface ChatDTO {
			/**
			 * example:
			 * Wöchentliche Drogenberatung
			 */
			topic: string;
			/**
			 * example:
			 * 7
			 */
			agencyId?: number; // int64
			/**
			 * example:
			 * 2019-10-23T00:00:00.000Z
			 */
			startDate: string; // date
			/**
			 * example:
			 * 12:05
			 */
			startTime: string; // time
			/**
			 * example:
			 * 120
			 */
			duration: number;
			/**
			 * example:
			 * false
			 */
			repetitive: boolean;
			repeatCount?: number;
			chatInterval?:
				| 'DAILY'
				| 'WEEKLY'
				| 'BIWEEKLY'
				| 'MONTHLY'
				| 'QUARTERLY'
				| 'YEARLY';
			modality?: 'TEXT' | 'AUDIO' | 'VIDEO';
			/**
			 * example:
			 * Europe/Berlin
			 */
			timezone?: string;
			/**
			 * example:
			 * Hint
			 */
			hintMessage?: string;
			/**
			 * example:
			 * de
			 */
			sourceLanguage?: string;
			hintMessageTranslations?: {
				[name: string]: string;
			};
			groupChatRulesTranslations?: {
				[name: string]: [
					string?,
					string?,
					string?,
					string?,
					string?,
					string?,
					string?,
					string?,
					string?,
					string?
				];
			};
		}
		export interface ChatInfoResponseDTO {
			/**
			 * example:
			 * 153918
			 */
			id: number; // int64
			/**
			 * example:
			 * !aBcDeF123:matrix.example
			 */
			matrixRoomId: string;
			/**
			 * example:
			 * false
			 */
			active: boolean;
			/**
			 * usernames
			 */
			bannedUsers?: string[];
		}
		export interface ChatMemberResponseDTO {
			_id?: string;
			status?: string;
			username?: string;
			displayName?: string;
			utcOffset?: string;
			userId?: string;
		}
		export interface ChatMembersResponseDTO {
			members?: ChatMemberResponseDTO[];
		}
		export interface ConsultantAdminResponseDTO {
			_embedded?: ConsultantDTO;
			_links?: ConsultantLinks;
		}
		export interface ConsultantAgencyLinks {
			self: HalLink;
		}
		export interface ConsultantAgencyResponseDTO {
			_embedded: AgencyAdminFullResponseDTO[];
			_links: AgencyLinks;
			total?: number;
		}
		export interface ConsultantDTO {
			/**
			 * example:
			 * 0f2cca9c-9303-4791-a0a5-a1ce16f1524f
			 */
			id?: string;
			/**
			 * example:
			 * max.mustermann
			 */
			username?: string;
			/**
			 * example:
			 * Max
			 */
			firstname?: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastname?: string;
			/**
			 * example:
			 * max@mustermann.de
			 */
			email?: string;
			/**
			 * example:
			 * true
			 */
			formalLanguage?: boolean;
			/**
			 * example:
			 * false
			 */
			teamConsultant?: boolean;
			/**
			 * example:
			 * true
			 */
			absent?: boolean;
			/**
			 * example:
			 * I am absent until...
			 */
			absenceMessage?: string;
			createDate?: string;
			updateDate?: string;
			deleteDate?: string;
			status?: string;
			agencies?: AgencyAdminResponseDTO[];
			isGroupchatConsultant?: /**
			 * example:
			 * true
			 */
			IsGroupchatConsultant;
			isSupervisor?: /**
			 * Flag that indicates if the consultant can be added as a supervisor
			 * example:
			 * true
			 */
			IsSupervisor;
			assignedSupervisorId?: /**
			 * Supervision (auto-assigned): the consultant id of this counsellor's standing supervisor, who is automatically attached read-only to every case the counsellor accepts. At most one; the target must itself have isSupervisor = true and may not be the counsellor themselves. Omitted/null leaves the current assignment untouched; an empty string clears it (clearing stops future auto-attachment and does not detach supervisors already on in-flight cases).
			 * example:
			 * 8bb2b0a4-2c5b-4f5a-9c3a-1d2e3f4a5b6c
			 */
			AssignedSupervisorId;
			tenantId?: number;
			tenantName?: string;
			displayName?: string;
			publicName?: string;
			/**
			 * example:
			 * nikunj-rohit
			 */
			publicSlug?: string;
			/**
			 * example:
			 * nikunj-rohit
			 */
			pendingPublicSlug?: string;
			publicSlugStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
			roleInOrg?: string;
			vacated?: boolean;
			adminRights?: boolean;
			/**
			 * topics directly assigned to the consultant, enriched with names
			 */
			topics?: ConsultantTopicDTO[];
			/**
			 * true if this consultant also holds an admin identity on the same account
			 */
			hasOtherIdentity?: boolean;
			/**
			 * which admin identities this consultant additionally holds
			 */
			otherIdentityTypes?: ('TENANT_ADMIN' | 'AGENCY_ADMIN')[];
		}
		export interface ConsultantFilter {
			username?: string;
			lastname?: string;
			email?: string;
			agencyId?: number; // int64
			absent?: boolean;
		}
		export interface ConsultantLinks {
			self: HalLink;
			update?: HalLink;
			delete?: HalLink;
			agencies?: HalLink;
			addAgency?: HalLink;
		}
		export interface ConsultantResponseDTO {
			/**
			 * example:
			 * aadc0ecf-c048-4bfc-857d-8c9b2e425500
			 */
			consultantId?: string;
			/**
			 * example:
			 * Max
			 */
			firstName?: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastName?: string;
			displayName?: string;
			/**
			 * example:
			 * nikunj-rohit
			 */
			publicSlug?: string;
			username?: string;
			/**
			 * Flag that indicates if the consultant can be added as a supervisor
			 * example:
			 * true
			 */
			isSupervisor?: boolean;
			agencies?: AgencyResponseDTO[];
		}
		export interface ConsultantSearchResultDTO {
			_embedded?: ConsultantAdminResponseDTO[];
			_links?: PaginationLinks;
			total?: number;
		}
		export interface ConsultantSessionDTO {
			/**
			 * example:
			 * 153918
			 */
			id?: number; // int64
			/**
			 * example:
			 * 100
			 */
			agencyId?: number; // int64
			/**
			 * example:
			 * 1
			 */
			consultingType?: number;
			/**
			 * example:
			 * 0
			 */
			status?: number;
			/**
			 * example:
			 * 79098
			 */
			postcode?: string;
			/**
			 * Matrix room ID
			 * example:
			 * !aBcDeF123:matrix.example
			 */
			matrixRoomId?: string;
			/**
			 * keycloak id of assigned consultant
			 * example:
			 * 926b9777-4eef-443d-925a-4aa534797bd7
			 */
			consultantId?: string;
			/**
			 * Matrix user ID of assigned consultant
			 * example:
			 * @consultant:matrix.example
			 */
			consultantMatrixUserId?: string;
			/**
			 * asker keycloak id
			 * example:
			 * 926b9777-4eef-443d-925a-4aa534797bd7
			 */
			askerId?: string;
			/**
			 * Matrix user ID of the asker
			 * example:
			 * @asker:matrix.example
			 */
			askerMatrixUserId?: string;
			/**
			 * asker username
			 * example:
			 * asker123
			 */
			askerUserName?: string;
			/**
			 * example:
			 * false
			 */
			isTeamSession?: boolean;
			/**
			 * example:
			 * 17
			 */
			age?: number;
			/**
			 * example:
			 * 0
			 */
			gender?: string;
			/**
			 * example:
			 * SELF_COUNSELLING
			 */
			counsellingRelation?: string;
			mainTopic?: SessionTopicDTO;
			topics?: SessionTopicDTO[];
			/**
			 * example:
			 * 12345678
			 */
			referer?: string; // ^[a-zA-Z0-9]{1,8}$
		}
		export interface ConsultantSessionListResponseDTO {
			sessions: ConsultantSessionResponseDTO[];
			/**
			 * Session value where to start from in the query (0 = first item)
			 */
			offset: number;
			/**
			 * Number of sessions which are being returned
			 */
			count: number;
			/**
			 * Total amount of sessions the consultant has
			 */
			total: number;
		}
		export interface ConsultantSessionResponseDTO {
			session?: SessionDTO;
			chat?: UserChatDTO;
			user?: SessionUserDTO;
			consultant?: SessionConsultantForConsultantDTO;
			latestMessage?: Date;
		}
		export interface ConsultantTopicDTO {
			/**
			 * example:
			 * 3
			 */
			id?: number; // int64
			/**
			 * example:
			 * Addiction
			 */
			name?: string;
		}
		export interface ConsultingTypeMap {
			value?: {
				[key: string]: any;
			};
		}
		export type ConversationType =
			| 'AGENCY_COUNSELLING'
			| 'LIVE_CHAT'
			| 'INTERNAL_GROUP'
			| 'SELF_HELP';
		export interface CreateAdminAgencyRelationDTO {
			/**
			 * example:
			 * 15
			 */
			agencyId: number; // int64
		}
		export interface CreateAdminDTO {
			/**
			 * example:
			 * max.mustermann
			 */
			username: string;
			password?: string; // password
			/**
			 * example:
			 * Max
			 */
			firstname: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastname: string;
			/**
			 * example:
			 * max@mustermann.de
			 */
			email: string;
			/**
			 * example:
			 * 1
			 */
			tenantId?: number;
		}
		export interface CreateChatResponseDTO {
			/**
			 * example:
			 * 2019-10-23T12:05:00.000Z
			 */
			createdAt?: string; // time
			/**
			 * example:
			 * Max M.
			 */
			creatorDisplayName?: string;
			/**
			 * example:
			 * !aBcDeF123:matrix.example
			 */
			matrixRoomId: string;
		}
		export interface CreateConsultantAgencyDTO {
			/**
			 * example:
			 * 15
			 */
			agencyId: number; // int64
			roleSetKey?: string;
		}
		export interface CreateConsultantDTO {
			/**
			 * example:
			 * max.mustermann
			 */
			username: string;
			/**
			 * Password for the consultant
			 * example:
			 * SecurePass123!
			 */
			password: string; // password
			/**
			 * example:
			 * Max
			 */
			firstname: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastname: string;
			/**
			 * example:
			 * max@mustermann.de
			 */
			email: string;
			/**
			 * example:
			 * true
			 */
			formalLanguage: boolean;
			/**
			 * example:
			 * true
			 */
			absent: boolean;
			/**
			 * example:
			 * I am absent until...
			 */
			absenceMessage?: string;
			/**
			 * example:
			 * 1
			 */
			tenantId?: number; // int64
			isGroupchatConsultant?: /**
			 * example:
			 * true
			 */
			IsGroupchatConsultant;
			/**
			 * ids of topics directly assigned to the consultant
			 * example:
			 * [
			 *   3,
			 *   7,
			 *   12
			 * ]
			 */
			topicIds?: number /* int64 */[];
			/**
			 * ids of agencies assigned atomically with the consultant
			 * example:
			 * [
			 *   5,
			 *   9
			 * ]
			 */
			agencyIds?: number /* int64 */[];
			/**
			 * Optional public slug. Admin-created values go live immediately.
			 * example:
			 * nikunj-rohit
			 */
			publicSlug?: string;
		}
		export interface CreateEnquiryMessageResponseDTO {
			sessionId?: number; // int64
			/**
			 * example:
			 * !aBcDeF123:matrix.example
			 */
			matrixRoomId?: string;
			t?: string;
		}
		export interface Date {}
		export interface DefaultLinks {
			self: HalLink;
			update?: HalLink;
			delete?: HalLink;
		}
		export interface DeleteUserAccountDTO {
			/**
			 * example:
			 * p@ssw0rd
			 */
			password: string; // password
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
		export interface DioceseAdminResultDTO {
			_embedded?: DioceseResponseDTO[];
			_links?: PaginationLinks;
			total?: number;
		}
		export interface DioceseResponseDTO {
			/**
			 * example:
			 * 12
			 */
			id?: number; // int64
			/**
			 * example:
			 * Freiburg
			 */
			name?: string;
			/**
			 * example:
			 * 2019-08-23T08:52:05
			 */
			createDate?: string;
			/**
			 * example:
			 * 2019-12-02T13:12:08
			 */
			updateDate?: string;
		}
		export interface EmailDTO {
			/**
			 * example:
			 * max.mustermann@domain.de
			 */
			email: string; // email
		}
		export interface EmailNotificationsDTO {
			/**
			 * example:
			 * true
			 */
			emailNotificationsEnabled: boolean;
			settings?: NotificationsSettingsDTO;
		}
		export interface EmailToggle {
			name: EmailType;
			state: boolean;
		}
		export type EmailType =
			| 'DAILY_ENQUIRY'
			| 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER';
		export interface EnquiryMessageDTO {
			/**
			 * example:
			 * Lorem ipsum dolor sit amet, consetetur...
			 */
			message: string;
			language?: /* ISO 639-1 code */ LanguageCode;
			t?: string;
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
			topicIds?: number /* int64 */[];
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
		}
		export interface GroupChatParticipantDTO {
			consultantId: string;
			role: 'OWNER' | 'CO_MODERATOR' | 'PARTICIPANT';
			displayName: string;
		}
		export interface GroupSessionConsultantDTO {
			/**
			 * example:
			 * 153918
			 */
			id?: string;
			/**
			 * example:
			 * beraterXYZ
			 */
			username?: string;
			displayName?: string;
			/**
			 * example:
			 * true
			 */
			isAbsent?: boolean;
			/**
			 * example:
			 * Bin nicht da
			 */
			absenceMessage?: string;
			/**
			 * example:
			 * Max
			 */
			firstName?: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastName?: string;
		}
		export interface GroupSessionListResponseDTO {
			sessions?: GroupSessionResponseDTO[];
		}
		export interface GroupSessionResponseDTO {
			session?: SessionDTO;
			chat?: UserChatDTO;
			user?: SessionUserDTO;
			consultant?: GroupSessionConsultantDTO;
			agency?: AgencyDTO;
			latestMessage?: Date;
		}
		export interface HalLink {
			href: string;
			method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
			templated?: boolean;
		}
		export interface HttpStatus {}
		/**
		 * example:
		 * true
		 */
		export type IsGroupchatConsultant = boolean;
		/**
		 * Flag that indicates if the consultant can be added as a supervisor
		 * example:
		 * true
		 */
		export type IsSupervisor = boolean;
		/**
		 * ISO 639-1 code
		 */
		export type LanguageCode =
			| 'aa'
			| 'ab'
			| 'ae'
			| 'af'
			| 'ak'
			| 'am'
			| 'an'
			| 'ar'
			| 'as'
			| 'av'
			| 'ay'
			| 'az'
			| 'ba'
			| 'be'
			| 'bg'
			| 'bh'
			| 'bi'
			| 'bm'
			| 'bn'
			| 'bo'
			| 'br'
			| 'bs'
			| 'ca'
			| 'ce'
			| 'ch'
			| 'co'
			| 'cr'
			| 'cs'
			| 'cu'
			| 'cv'
			| 'cy'
			| 'da'
			| 'de'
			| 'dv'
			| 'dz'
			| 'ee'
			| 'el'
			| 'en'
			| 'eo'
			| 'es'
			| 'et'
			| 'eu'
			| 'fa'
			| 'ff'
			| 'fi'
			| 'fj'
			| 'fo'
			| 'fr'
			| 'fy'
			| 'ga'
			| 'gd'
			| 'gl'
			| 'gn'
			| 'gu'
			| 'gv'
			| 'ha'
			| 'he'
			| 'hi'
			| 'ho'
			| 'hr'
			| 'ht'
			| 'hu'
			| 'hy'
			| 'hz'
			| 'ia'
			| 'id'
			| 'ie'
			| 'ig'
			| 'ii'
			| 'ik'
			| 'io'
			| 'is'
			| 'it'
			| 'iu'
			| 'ja'
			| 'jv'
			| 'ka'
			| 'kg'
			| 'ki'
			| 'kj'
			| 'kk'
			| 'kl'
			| 'km'
			| 'kn'
			| 'ko'
			| 'kr'
			| 'ks'
			| 'ku'
			| 'kv'
			| 'kw'
			| 'ky'
			| 'la'
			| 'lb'
			| 'lg'
			| 'li'
			| 'ln'
			| 'lo'
			| 'lt'
			| 'lu'
			| 'lv'
			| 'mg'
			| 'mh'
			| 'mi'
			| 'mk'
			| 'ml'
			| 'mn'
			| 'mr'
			| 'ms'
			| 'mt'
			| 'my'
			| 'na'
			| 'nb'
			| 'nd'
			| 'ne'
			| 'ng'
			| 'nl'
			| 'nn'
			| 'no'
			| 'nr'
			| 'nv'
			| 'ny'
			| 'oc'
			| 'oj'
			| 'om'
			| 'or'
			| 'os'
			| 'pa'
			| 'pi'
			| 'pl'
			| 'ps'
			| 'pt'
			| 'qu'
			| 'rm'
			| 'rn'
			| 'ro'
			| 'ru'
			| 'rw'
			| 'sa'
			| 'sc'
			| 'sd'
			| 'se'
			| 'sg'
			| 'si'
			| 'sk'
			| 'sl'
			| 'sm'
			| 'sn'
			| 'so'
			| 'sq'
			| 'sr'
			| 'ss'
			| 'st'
			| 'su'
			| 'sv'
			| 'sw'
			| 'ta'
			| 'te'
			| 'tg'
			| 'th'
			| 'ti'
			| 'tk'
			| 'tl'
			| 'tn'
			| 'to'
			| 'tr'
			| 'ts'
			| 'tt'
			| 'tw'
			| 'ty'
			| 'ug'
			| 'uk'
			| 'ur'
			| 'uz'
			| 've'
			| 'vi'
			| 'vo'
			| 'wa'
			| 'wo'
			| 'xh'
			| 'yi'
			| 'yo'
			| 'za'
			| 'zh'
			| 'zu';
		export interface LanguageResponseDTO {
			languages?: /* ISO 639-1 code */ LanguageCode[];
		}
		export interface LastMessageDTO {
			msg?: string;
			t?: string;
		}
		export interface MasterKeyDTO {
			/**
			 * example:
			 * sdj8wnFNASj324!ksldf9
			 */
			masterKey: string;
		}
		export type MessageType =
			| 'APPOINTMENT_SET'
			| 'APPOINTMENT_CANCELLED'
			| 'APPOINTMENT_RESCHEDULED'
			| 'FURTHER_STEPS'
			| 'UPDATE_SESSION_DATA'
			| 'VIDEOCALL'
			| 'FINISHED_CONVERSATION'
			| 'USER_MUTED'
			| 'USER_UNMUTED'
			| 'E2EE_ACTIVATED'
			| 'MASTER_KEY_LOST'
			| 'REASSIGN_CONSULTANT'
			| 'REASSIGN_CONSULTANT_RESET_LAST_MESSAGE';
		export interface MobileTokenDTO {
			/**
			 * example:
			 * 8cc2058
			 */
			token?: string;
		}
		export interface NewRegistrationDto {
			/**
			 * example:
			 * 79098
			 */
			postcode: string;
			/**
			 * example:
			 * 232
			 */
			agencyId: number; // int64
			/**
			 * example:
			 * 1
			 */
			consultingType: string;
			/**
			 * used for direct consultant registration
			 */
			consultantId?: string;
			/**
			 * example:
			 * 12
			 */
			age?: string;
			/**
			 * example:
			 * DIVERSE
			 */
			gender?: string;
			/**
			 * example:
			 * [
			 *   12,
			 *   15
			 * ]
			 */
			topicIds?: number /* int64 */[];
			/**
			 * example:
			 * 15
			 */
			mainTopicId?: number;
			/**
			 * example:
			 * SELF_COUNSELLING
			 */
			counsellingRelation?: string;
			/**
			 * example:
			 * 12345678
			 */
			referer?: string; // ^[a-zA-Z0-9]{1,8}$
		}
		export interface NewRegistrationResponseDto {
			sessionId?: number; // int64
			matrixRoomId?: string;
			status?: HttpStatus;
		}
		export interface NotificationsSettingsDTO {
			/**
			 * example:
			 * true
			 */
			initialEnquiryNotificationEnabled?: boolean;
			/**
			 * example:
			 * true
			 */
			newChatMessageNotificationEnabled?: boolean;
			/**
			 * example:
			 * true
			 */
			reassignmentNotificationEnabled?: boolean;
			/**
			 * example:
			 * true
			 */
			appointmentNotificationEnabled?: boolean;
		}
		export interface OccurrenceOverrideRequest {
			originalStartUtc: string; // date-time
			overrideStartUtc?: string; // date-time
			duration?: number;
			capacity?: number;
			modality?: 'TEXT' | 'AUDIO' | 'VIDEO';
		}
		export interface OneTimePasswordDTO {
			secret: string; // password
			otp: string; // password
		}
		export type OtpType = 'EMAIL' | 'APP';
		export interface PaginationLinks {
			self: HalLink;
			next?: HalLink;
			previous?: HalLink;
		}
		export interface PasswordDTO {
			/**
			 * example:
			 * oldpass@w0rd
			 */
			oldPassword: string; // password
			/**
			 * example:
			 * newpass@w0rd
			 */
			newPassword: string; // password
		}
		export interface PatchAdminDTO {
			/**
			 * example:
			 * Max
			 */
			firstname: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastname: string;
			/**
			 * example:
			 * maxmuster@mann.com
			 */
			email: string; // email
		}
		/**
		 * at least one property must be set
		 */
		export interface PatchUserDTO {
			/**
			 * indicates if 2FA is supposed to be encouraged
			 * example:
			 * true
			 */
			encourage2fa?: boolean;
			/**
			 * indicates if magic-link login should be enabled for this account
			 * example:
			 * false
			 */
			magicLinkLoginEnabled?: boolean;
			displayName?: string;
			/**
			 * indicates should the walkt hrough be enabled
			 * example:
			 * true
			 */
			walkThroughEnabled?: boolean;
			emailToggles?: EmailToggle[];
			preferredLanguage?: /* ISO 639-1 code */ LanguageCode;
			/**
			 * Flag that indicates has the user accepted new terms and conditions text
			 * example:
			 * true
			 */
			termsAndConditionsConfirmation?: boolean;
			/**
			 * Flag that indicates does the user accepted new data privacy text
			 * example:
			 * true
			 */
			dataPrivacyConfirmation?: boolean;
			/**
			 * mark consultant as (not) available for one-on-one chats, no effect on others
			 */
			available?: boolean;
			emailNotifications?: EmailNotificationsDTO;
		}
		export interface PostcodeRangeDTO {
			/**
			 * example:
			 * 79106-79386;88682;97051-97111
			 */
			postcodeRanges?: string;
		}
		export interface PostcodeRangeResponseDTO {
			/**
			 * The agency id of the related postcoderanges
			 * example:
			 * 684
			 */
			id?: number; // int64
			/**
			 * example:
			 * 79106-79386;88682;97051-97111
			 */
			postcodeRanges?: string;
		}
		export interface Properties {
			value?: {
				[key: string]: any;
			};
		}
		export interface ReassignmentNotificationDTO {
			/**
			 * example:
			 * !aBcDeF123:matrix.example
			 */
			matrixRoomId: string;
			toConsultantId: string; // UUID
			fromConsultantName?: string;
			/**
			 * null defines the reassign request
			 */
			isConfirmed?: boolean;
		}
		export interface RoleRequest {
			role: 'OWNER' | 'CO_MODERATOR' | 'PARTICIPANT';
		}
		export interface RootDTO {
			_links: RootLinks;
		}
		export interface RootLinks {
			self: HalLink;
			sessions?: HalLink;
			consultantAgencies?: HalLink;
			consultants?: HalLink;
			createConsultant?: HalLink;
			deleteAsker?: HalLink;
		}
		export interface SearchResultLinks {
			self: HalLink;
			next?: HalLink;
			previous?: HalLink;
			search?: HalLink;
		}
		export interface SessionAdminDTO {
			/**
			 * example:
			 * 94
			 */
			id?: number; // int64
			/**
			 * example:
			 * 1da238c6-cd46-4162-80f1-bff74eafe77f
			 */
			userId?: string;
			/**
			 * example:
			 * 1da238c6-cd46-4162-80f1-bff74eafe77f
			 */
			consultantId?: string;
			/**
			 * example:
			 * enc.OBSXEZTPOJWWC3TDMUWWC43LMVZC2NZS
			 */
			username?: string;
			/**
			 * example:
			 * email@beratungcaritas.de
			 */
			email?: string;
			/**
			 * example:
			 * 1
			 */
			consultingType?: number;
			/**
			 * example:
			 * 12345
			 */
			postcode?: string;
			/**
			 * example:
			 * 1
			 */
			agencyId?: number;
			isTeamSession?: boolean;
			messageDate?: string;
			createDate?: string;
			updateDate?: string;
		}
		export interface SessionAdminResultDTO {
			_embedded?: SessionAdminDTO[];
			_links?: PaginationLinks;
			total?: number;
		}
		export interface SessionAttachmentDTO {
			/**
			 * example:
			 * image/png
			 */
			fileType?: string;
			/**
			 * example:
			 * /9j/2wBDAAYEBQYFBAYGBQY
			 */
			imagePreview?: string;
			/**
			 * example:
			 * true
			 */
			fileReceived?: boolean;
		}
		export interface SessionConsultantForConsultantDTO {
			/**
			 * example:
			 * 153918
			 */
			id?: string;
			/**
			 * example:
			 * Max
			 */
			firstName?: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastName?: string;
			/**
			 * example:
			 * beraterXYZ
			 */
			username?: string;
			/**
			 * example:
			 * Berater XYZ
			 */
			displayName?: string;
		}
		export interface SessionConsultantForUserDTO {
			/**
			 * example:
			 * consultantId
			 */
			id?: string;
			/**
			 * example:
			 * beraterXYZ
			 */
			username?: string;
			displayName?: string;
			/**
			 * example:
			 * true
			 */
			isAbsent?: boolean;
			/**
			 * example:
			 * Bin nicht da
			 */
			absenceMessage?: string;
		}
		export interface SessionDTO {
			/**
			 * example:
			 * 153918
			 */
			id: number; // int64
			/**
			 * example:
			 * 100
			 */
			agencyId: number; // int64
			/**
			 * example:
			 * 1
			 */
			consultingType: number;
			/**
			 * 0 = INITIAL, 1 = NEW, 2 = IN PROGRESS, 3 = DONE
			 * example:
			 * 0
			 */
			status: number;
			/**
			 * Stable ADR-006 modality. One of AGENCY_COUNSELLING, LIVE_CHAT, INTERNAL_GROUP, SELF_HELP.
			 * example:
			 * LIVE_CHAT
			 */
			conversationType?:
				| 'AGENCY_COUNSELLING'
				| 'LIVE_CHAT'
				| 'INTERNAL_GROUP'
				| 'SELF_HELP';
			/**
			 * example:
			 * 79098
			 */
			postcode?: string;
			language?: /* ISO 639-1 code */ LanguageCode;
			/**
			 * Matrix Synapse room ID
			 * example:
			 * !aBcDeF123:91.99.219.182
			 */
			matrixRoomId?: string;
			/**
			 * Matrix user ID of the asker
			 * example:
			 * @asker:matrix.example
			 */
			askerMatrixUserId?: string;
			e2eLastMessage?: LastMessageDTO;
			lastMessage?: string;
			lastMessageType?: MessageType;
			/**
			 * example:
			 * 1539184948
			 */
			messageDate?: number; // int64
			/**
			 * example:
			 * false
			 */
			messagesRead?: boolean;
			/**
			 * example:
			 * false
			 */
			isTeamSession?: boolean;
			/**
			 * example:
			 * ANONYMOUS
			 */
			registrationType: string;
			/**
			 * example:
			 * 2021-05-11T15:29:37.000Z
			 */
			createDate?: string;
			attachment?: SessionAttachmentDTO;
			videoCallMessageDTO?: VideoCallMessageDTO;
			topic?: SessionTopicDTO;
		}
		export interface SessionDataDTO {
			/**
			 * Session-scoped pseudonym shown to consultants for anonymous live chat
			 * example:
			 * Behutsames Pferd Jules
			 */
			displayName?: string;
			/**
			 * mandatory depending on the consulting type
			 * example:
			 * 17
			 */
			age?: string;
			/**
			 * mandatory depending on the consulting type
			 * example:
			 * 8
			 */
			state?: string;
		}
		export interface SessionFilter {
			agency?: number;
			asker?: string;
			consultant?: string;
			consultingType?: number;
		}
		export interface SessionTopicDTO {
			/**
			 * example:
			 * 12132
			 */
			id?: number; // int64
			/**
			 * example:
			 * Topic name
			 */
			name?: string;
			/**
			 * example:
			 * Description
			 */
			description?: string;
			/**
			 * example:
			 * Active
			 */
			status?: string;
		}
		export interface SessionUserDTO {
			/**
			 * example:
			 * 926b9777-4eef-443d-925a-4aa534797bd7
			 */
			id?: string;
			/**
			 * example:
			 * max94
			 */
			username?: string;
			/**
			 * example:
			 * Behutsames Pferd Jules
			 */
			displayName?: string;
			isDeleted?: boolean;
			/**
			 * LinkedHashMap<String, Object>
			 */
			sessionData?: string;
		}
		export interface Sort {
			/**
			 * example:
			 * firstName|lastName|username|email
			 */
			field?: 'firstName' | 'lastName' | 'username' | 'email';
			/**
			 * example:
			 * ASC|DESC
			 */
			order?: 'ASC' | 'DESC';
		}
		export interface TopicDTO {
			/**
			 * example:
			 * 12132
			 */
			id?: number; // int64
			/**
			 * example:
			 * Topic name
			 */
			name?: string;
			/**
			 * example:
			 * Description
			 */
			description?: string;
			/**
			 * example:
			 * identifier for data exports for example: alcohol
			 */
			internalIdentifier?: string;
			/**
			 * example:
			 * Active
			 */
			status?: string;
		}
		export interface TransferOwnershipRequest {
			consultantId: string;
		}
		export interface TwoFactorAuthDTO {
			/**
			 * example:
			 * true
			 */
			isEnabled: boolean;
			/**
			 * example:
			 * true
			 */
			isActive: boolean;
			secret?: string; // password
			qrCode?: string;
			type?: OtpType;
			/**
			 * indicates if 2FA is supposed to be encouraged
			 * example:
			 * true
			 */
			isToEncourage?: boolean;
		}
		export interface UpdateAdminConsultantDTO {
			/**
			 * example:
			 * Max
			 */
			firstname: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastname: string;
			/**
			 * example:
			 * max@mustermann.de
			 */
			email: string;
			/**
			 * example:
			 * true
			 */
			formalLanguage: boolean;
			/**
			 * example:
			 * true
			 */
			absent: boolean;
			/**
			 * example:
			 * I am absent until...
			 */
			absenceMessage?: string;
			languages?: string[];
			/**
			 * Flag that indicates has the user accepted new terms and conditions text
			 * example:
			 * true
			 */
			termsAndConditionsConfirmation?: boolean;
			/**
			 * Flag that indicates does the user accepted new data privacy text
			 * example:
			 * true
			 */
			dataPrivacyConfirmation?: boolean;
			isGroupchatConsultant?: /**
			 * example:
			 * true
			 */
			IsGroupchatConsultant;
			isSupervisor?: /**
			 * Flag that indicates if the consultant can be added as a supervisor
			 * example:
			 * true
			 */
			IsSupervisor;
			assignedSupervisorId?: /**
			 * Supervision (auto-assigned): the consultant id of this counsellor's standing supervisor, who is automatically attached read-only to every case the counsellor accepts. At most one; the target must itself have isSupervisor = true and may not be the counsellor themselves. Omitted/null leaves the current assignment untouched; an empty string clears it (clearing stops future auto-attachment and does not detach supervisors already on in-flight cases).
			 * example:
			 * 8bb2b0a4-2c5b-4f5a-9c3a-1d2e3f4a5b6c
			 */
			AssignedSupervisorId;
			/**
			 * replaces the full set of topics assigned to the consultant
			 * example:
			 * [
			 *   3,
			 *   7,
			 *   12
			 * ]
			 */
			topicIds?: number /* int64 */[];
			/**
			 * Optional public slug. Admin edits go live immediately; empty clears it.
			 * example:
			 * nikunj-rohit
			 */
			publicSlug?: string;
			/**
			 * If true, rejects the currently pending public slug without changing the active slug.
			 * example:
			 * false
			 */
			rejectPendingPublicSlug?: boolean;
		}
		export interface UpdateAgencyAdminDTO {
			/**
			 * example:
			 * Max
			 */
			firstname: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastname: string;
			/**
			 * example:
			 * maxmuster@mann.com
			 */
			email: string; // email
		}
		export interface UpdateAgencyDTO {
			/**
			 * example:
			 * 12
			 */
			dioceseId: number; // int64
			/**
			 * example:
			 * Beratungsstelle
			 */
			name: string;
			/**
			 * example:
			 * Beschreibung Beratungsstelle...
			 */
			description?: string;
			/**
			 * example:
			 * 79106
			 */
			postcode?: string;
			/**
			 * example:
			 * Muenchen
			 */
			city?: string;
			/**
			 * example:
			 * false
			 */
			offline: boolean;
			/**
			 * example:
			 * https://www.domain.com
			 */
			url?: string;
			/**
			 * example:
			 * false
			 */
			external: boolean;
			topicIds?: number /* int64 */[];
			demographics?: DemographicsDTO;
		}
		export interface UpdateAgencyResponseDTO {
			_embedded?: AgencyAdminResponseDTO;
			_links?: DefaultLinks;
		}
		export interface UpdateChatResponseDTO {
			/**
			 * example:
			 * !aBcDeF123:matrix.example
			 */
			matrixRoomId: string;
		}
		export interface UpdateConsultantDTO {
			/**
			 * example:
			 * Max
			 */
			firstname: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastname: string;
			/**
			 * example:
			 * maxmuster@mann.com
			 */
			email: string; // email
			/**
			 * Optional public slug request. Letters and hyphens only.
			 * example:
			 * nikunj-rohit
			 */
			publicSlug?: string;
			/**
			 * example:
			 * de, en
			 */
			languages?: /* ISO 639-1 code */ LanguageCode[];
			/**
			 * Flag that indicates has the user accepted new terms and conditions text
			 * example:
			 * true
			 */
			termsAndConditionsConfirmation?: boolean;
			/**
			 * Flag that indicates does the user accepted new data privacy text
			 * example:
			 * true
			 */
			dataPrivacyConfirmation?: boolean;
			emailNotifications?: EmailNotificationsDTO;
		}
		export interface UpdateTenantAdminDTO {
			/**
			 * example:
			 * Max
			 */
			firstname: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastname: string;
			/**
			 * example:
			 * maxmuster@mann.com
			 */
			email: string; // email
			/**
			 * example:
			 * 1
			 */
			tenantId?: number;
		}
		export interface UserChatDTO {
			/**
			 * example:
			 * 153918
			 */
			id: number; // int64
			/**
			 * example:
			 * Drugs
			 */
			topic: string;
			/**
			 * example:
			 * 2019-10-23T00:00:00.000Z
			 */
			startDate: string; // date
			/**
			 * example:
			 * 12:05
			 */
			startTime: string; // time
			/**
			 * example:
			 * 120
			 */
			duration: number;
			/**
			 * example:
			 * false
			 */
			repetitive: boolean;
			/**
			 * example:
			 * 6
			 */
			repeatCount?: number;
			/**
			 * example:
			 * 0
			 */
			currentOccurrenceIndex?: number;
			chatInterval?:
				| 'DAILY'
				| 'WEEKLY'
				| 'BIWEEKLY'
				| 'MONTHLY'
				| 'QUARTERLY'
				| 'YEARLY';
			modality?: 'TEXT' | 'AUDIO' | 'VIDEO';
			/**
			 * example:
			 * Europe/Berlin
			 */
			timezone?: string;
			/**
			 * example:
			 * false
			 */
			active: boolean;
			/**
			 * Stable ADR-006 modality. One of AGENCY_COUNSELLING, LIVE_CHAT, INTERNAL_GROUP, SELF_HELP.
			 * example:
			 * SELF_HELP
			 */
			conversationType?:
				| 'AGENCY_COUNSELLING'
				| 'LIVE_CHAT'
				| 'INTERNAL_GROUP'
				| 'SELF_HELP';
			/**
			 * example:
			 * 0
			 */
			consultingType: number;
			e2eLastMessage?: LastMessageDTO;
			/**
			 * example:
			 * Thanks for the answer
			 */
			lastMessage?: string;
			/**
			 * example:
			 * 1539184948
			 */
			messageDate?: number; // int64
			/**
			 * example:
			 * false
			 */
			messagesRead?: boolean;
			/**
			 * example:
			 * !aBcDeF123:matrix.example
			 */
			matrixRoomId: string;
			attachment?: SessionAttachmentDTO;
			/**
			 * example:
			 * false
			 */
			subscribed?: boolean;
			moderators?: string[];
			participants?: GroupChatParticipantDTO[];
			startDateWithTime?: string; // date-time
			/**
			 * example:
			 * 2023-10-23T12:05:00.000Z
			 */
			createdAt?: string; // time
			chatAgencies?: AgencyDTO[];
			/**
			 * example:
			 * Hint
			 */
			hintMessage?: string;
			/**
			 * example:
			 * de
			 */
			sourceLanguage?: string;
			hintMessageTranslations?: {
				[name: string]: string;
			};
			groupChatRulesTranslations?: {
				[name: string]: [
					string?,
					string?,
					string?,
					string?,
					string?,
					string?,
					string?,
					string?,
					string?,
					string?
				];
			};
		}
		export interface UserDTO {
			/**
			 * Session-scoped pseudonym shown to consultants for anonymous live chat
			 * example:
			 * Behutsames Pferd Jules
			 */
			displayName?: string;
			/**
			 * mandatory depending on the consulting type
			 * example:
			 * 17
			 */
			age?: string;
			/**
			 * mandatory depending on the consulting type
			 * example:
			 * 8
			 */
			state?: string;
			/**
			 * example:
			 * max94
			 */
			username: string;
			/**
			 * example:
			 * 79098
			 */
			postcode: string;
			/**
			 * example:
			 * 15
			 */
			agencyId: number; // int64
			/**
			 * example:
			 * pass@w0rd
			 */
			password: string; // password
			/**
			 * example:
			 * true
			 */
			termsAccepted: string;
			/**
			 * example:
			 * 3
			 */
			consultingType: string;
			/**
			 * UUID
			 */
			consultantId?: string;
			/**
			 * example:
			 * 15
			 */
			mainTopicId?: number;
			/**
			 * example:
			 * [
			 *   12,
			 *   15
			 * ]
			 */
			topicIds?: number[];
			/**
			 * example:
			 * SELF_COUNSELLING
			 */
			counsellingRelation?: string;
			/**
			 * example:
			 * DIVERSE
			 */
			gender?: string;
			preferredLanguage?: /* ISO 639-1 code */ LanguageCode;
		}
		export interface UserDataResponseDTO {
			/**
			 * example:
			 * ajsd89-sdf9-sadk-as8j-asdf8jo
			 */
			userId?: string;
			/**
			 * example:
			 * max.muster
			 */
			userName?: string;
			/**
			 * example:
			 * Max M.
			 */
			displayName?: string;
			/**
			 * Active public slug used for consultant registration links
			 * example:
			 * nikunj-rohit
			 */
			publicSlug?: string;
			/**
			 * Consultant-requested slug waiting for admin approval
			 * example:
			 * nikunj-rohit
			 */
			pendingPublicSlug?: string;
			publicSlugStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
			/**
			 * example:
			 * Max
			 */
			firstName?: string;
			/**
			 * example:
			 * Mustermann
			 */
			lastName?: string;
			/**
			 * example:
			 * maxmuster@mann.com
			 */
			email?: string; // email
			/**
			 * indicates if magic-link login is enabled for this account
			 * example:
			 * false
			 */
			magicLinkLoginEnabled?: boolean;
			/**
			 * consultants can mark themselves as not available for one-on-one chats
			 */
			available?: boolean;
			/**
			 * consultants can mark themselves as absent
			 * example:
			 * false
			 */
			absent?: boolean;
			/**
			 * example:
			 * true
			 */
			isFormalLanguage?: boolean;
			languages?: string[];
			preferredLanguage?: /* ISO 639-1 code */ LanguageCode;
			/**
			 * example:
			 * Bin mal weg...
			 */
			absenceMessage?: string;
			/**
			 * example:
			 * true
			 */
			isInTeamAgency?: boolean;
			agencies?: AgencyDTO[];
			userRoles?: string[];
			grantedAuthorities?: string[];
			twoFactorAuth?: TwoFactorAuthDTO;
			consultingTypes?: ConsultingTypeMap;
			/**
			 * Is true if consultant has at least one consulting type containing anonymous conversations active
			 * example:
			 * true
			 */
			hasAnonymousConversations?: boolean;
			/**
			 * Is true if consultant has access to archive
			 * example:
			 * true
			 */
			hasArchive?: boolean;
			/**
			 * Is true if feature is enabled. Enables end-to-end encryption in video chat
			 * example:
			 * true
			 */
			isE2EEncryptionEnabled?: boolean;
			/**
			 * Is true if the walk through is enabled for the user
			 * example:
			 * true
			 */
			isWalkThroughEnabled?: boolean;
			emailToggles?: EmailToggle[];
			/**
			 * example:
			 * true
			 */
			appointmentFeatureEnabled?: boolean;
			/**
			 * Datetime stamp when the user accepted terms and condition
			 * example:
			 * 2022-12-07T11:51:01.000Z
			 */
			termsAndConditionsConfirmation?: string;
			/**
			 * Datetime stamp when the user accepted data privacy
			 * example:
			 * 2022-12-07T11:51:01.000Z
			 */
			dataPrivacyConfirmation?: string;
			emailNotifications?: EmailNotificationsDTO;
			sessions?: SessionDTO[];
		}
		export interface UserSessionListResponseDTO {
			sessions?: UserSessionResponseDTO[];
		}
		export interface UserSessionResponseDTO {
			session?: SessionDTO;
			chat?: UserChatDTO;
			agency?: AgencyDTO;
			consultant?: SessionConsultantForUserDTO;
			latestMessage?: Date;
		}
		export interface VideoCallMessageDTO {
			eventType: 'IGNORED_CALL';
			/**
			 * example:
			 * consultant23
			 */
			initiatorUserName: string;
			/**
			 * example:
			 * @consultant23:matrix.example
			 */
			initiatorMatrixUserId: string;
		}
		export interface ViolationDTO {
			violationType?: 'CONSULTANT' | 'ASKER';
			identifier?: string;
			reason?: string;
			additionalInformation?: AdditionalInformationDTO[];
		}
	}
}
declare namespace Paths {
	namespace AcceptEnquiry {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace ActivateTwoFactorAuthByApp {
		export type RequestBody = UserService.Schemas.OneTimePasswordDTO;
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace AddMobileAppToken {
		export type RequestBody = UserService.Schemas.MobileTokenDTO;
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace ArchiveSession {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace AssignChat {
		namespace Parameters {
			export type MatrixRoomId = string;
		}
		export interface PathParameters {
			matrixRoomId: Parameters.MatrixRoomId;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $500 {}
		}
	}
	namespace AssignSession {
		namespace Parameters {
			export type ConsultantId = string;
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
			consultantId: Parameters.ConsultantId;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace BanFromChat {
		namespace Parameters {
			export type ChatId = number; // int64
			export type MatrixUserId = string;
		}
		export interface PathParameters {
			matrixUserId: Parameters.MatrixUserId;
			chatId: Parameters.ChatId /* int64 */;
		}
		namespace Responses {
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $500 {}
		}
	}
	namespace ChangeChatSeriesParticipantRole {
		namespace Parameters {
			export type ConsultantId = string;
			export type SeriesId = number; // int64
		}
		export interface PathParameters {
			seriesId: Parameters.SeriesId /* int64 */;
			consultantId: Parameters.ConsultantId;
		}
		export type RequestBody = UserService.Schemas.RoleRequest;
		namespace Responses {
			export interface $204 {}
			export interface $401 {}
			export interface $403 {}
		}
	}
	namespace CreateChatV1 {
		export type RequestBody = UserService.Schemas.ChatDTO;
		namespace Responses {
			export type $201 = UserService.Schemas.CreateChatResponseDTO;
			export interface $400 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace CreateChatV2 {
		export type RequestBody = UserService.Schemas.ChatDTO;
		namespace Responses {
			export type $201 = UserService.Schemas.CreateChatResponseDTO;
			export interface $400 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace CreateEnquiryMessage {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		export type RequestBody = UserService.Schemas.EnquiryMessageDTO;
		namespace Responses {
			export type $201 =
				UserService.Schemas.CreateEnquiryMessageResponseDTO;
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace DeactivateAndFlagUserAccountForDeletion {
		export type RequestBody = UserService.Schemas.DeleteUserAccountDTO;
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace DeactivateTwoFactorAuthByApp {
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace DearchiveSession {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace DeleteEmailAddress {
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace DeleteSessionAndInactiveUser {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $500 {}
		}
	}
	namespace FetchSessionForConsultant {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.ConsultantSessionDTO;
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $500 {}
		}
	}
	namespace FinishTwoFactorAuthByEmailSetup {
		namespace Parameters {
			export type Tan = string; // [0-9]{6}
		}
		export interface PathParameters {
			tan: Parameters.Tan /* [0-9]{6} */;
		}
		namespace Responses {
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $412 {}
			export interface $429 {}
			export interface $500 {}
		}
	}
	namespace GetChat {
		namespace Parameters {
			export type ChatId = number; // int64
		}
		export interface PathParameters {
			chatId: Parameters.ChatId /* int64 */;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.ChatInfoResponseDTO;
			export interface $400 {}
			export interface $404 {}
			export interface $500 {}
		}
	}
	namespace GetChatById {
		namespace Parameters {
			export type ChatId = number; // int64
		}
		export interface PathParameters {
			chatId: Parameters.ChatId /* int64 */;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.GroupSessionListResponseDTO;
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetChatMembers {
		namespace Parameters {
			export type ChatId = number; // int64
		}
		export interface PathParameters {
			chatId: Parameters.ChatId /* int64 */;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.ChatMembersResponseDTO;
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace GetChatSeriesConsultants {
		namespace Responses {
			export type $200 = UserService.Schemas.ConsultantResponseDTO[];
			export interface $204 {}
			export interface $401 {}
			export interface $403 {}
		}
	}
	namespace GetChatSeriesOccurrences {
		namespace Parameters {
			export type From = string; // date-time
			export type Limit = number;
			export type SeriesId = number; // int64
			export type To = string; // date-time
		}
		export interface PathParameters {
			seriesId: Parameters.SeriesId /* int64 */;
		}
		export interface QueryParameters {
			from: Parameters.From /* date-time */;
			to: Parameters.To /* date-time */;
			limit?: Parameters.Limit;
		}
		namespace Responses {
			export type $200 = {
				seriesId?: number; // int64
				occurrenceIndex?: number; // int32
				originalStart?: string; // date-time
				start?: string; // date-time
				duration?: number; // int32
				capacity?: number; // int32
				modality?: 'TEXT' | 'AUDIO' | 'VIDEO';
			}[];
			export interface $401 {}
		}
	}
	namespace GetConsultantPublicData {
		namespace Parameters {
			export type ConsultantId = string;
		}
		export interface PathParameters {
			consultantId: Parameters.ConsultantId;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.ConsultantResponseDTO;
			export interface $400 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace GetConsultants {
		namespace Parameters {
			export type AgencyId = number; // int64
		}
		export interface QueryParameters {
			agencyId: Parameters.AgencyId /* int64 */;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.ConsultantResponseDTO[];
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetLanguages {
		namespace Parameters {
			export type AgencyId = number; // int64
		}
		export interface QueryParameters {
			agencyId: Parameters.AgencyId /* int64 */;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.LanguageResponseDTO;
			export interface $400 {}
			export interface $403 {}
			export interface $404 {}
			export interface $500 {}
		}
	}
	namespace GetSessionForId {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.GroupSessionListResponseDTO;
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetSessionsForAuthenticatedConsultant {
		namespace Parameters {
			export type Count = number;
			export type Filter = string;
			export type Offset = number;
			export type Status = number;
		}
		export interface QueryParameters {
			status?: Parameters.Status;
			offset: Parameters.Offset;
			count: Parameters.Count;
			filter: Parameters.Filter;
		}
		namespace Responses {
			export type $200 =
				UserService.Schemas.ConsultantSessionListResponseDTO;
			export interface $204 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetSessionsForAuthenticatedUser {
		namespace Responses {
			export type $200 = UserService.Schemas.UserSessionListResponseDTO;
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetSessionsForRoomIds {
		namespace Parameters {
			export type RoomIds = string[];
		}
		export interface QueryParameters {
			'roomIds[]': Parameters.RoomIds;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.GroupSessionListResponseDTO;
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetTeamSessionsForAuthenticatedConsultant {
		namespace Parameters {
			export type Count = number;
			export type Filter = string;
			export type Offset = number;
		}
		export interface QueryParameters {
			offset: Parameters.Offset;
			count: Parameters.Count;
			filter: Parameters.Filter;
		}
		namespace Responses {
			export type $200 =
				UserService.Schemas.ConsultantSessionListResponseDTO;
			export interface $204 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetUserData {
		namespace Responses {
			export type $200 = UserService.Schemas.UserDataResponseDTO;
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace GetUserEmailNotifications {
		namespace Parameters {
			export type Email = string;
		}
		export interface QueryParameters {
			email: Parameters.Email;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.EmailNotificationsDTO;
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace ImportConsultants {
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $500 {}
		}
	}
	namespace JoinChat {
		namespace Parameters {
			export type ChatId = number; // int64
		}
		export interface PathParameters {
			chatId: Parameters.ChatId /* int64 */;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace LeaveChat {
		namespace Parameters {
			export type ChatId = number; // int64
		}
		export interface PathParameters {
			chatId: Parameters.ChatId /* int64 */;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace OverrideChatSeriesOccurrence {
		namespace Parameters {
			export type SeriesId = number; // int64
		}
		export interface PathParameters {
			seriesId: Parameters.SeriesId /* int64 */;
		}
		export type RequestBody = UserService.Schemas.OccurrenceOverrideRequest;
		namespace Responses {
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
		}
	}
	namespace PatchUser {
		export type RequestBody =
			/* at least one property must be set */ UserService.Schemas.PatchUserDTO;
		namespace Responses {
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace RegisterNewConsultingType {
		export type RequestBody = UserService.Schemas.NewRegistrationDto;
		namespace Responses {
			export type $201 = UserService.Schemas.NewRegistrationResponseDto;
			export interface $400 {}
			export interface $403 {}
			export type $409 = UserService.Schemas.NewRegistrationResponseDto;
			export interface $500 {}
		}
	}
	namespace RegisterNewSession {
		export type RequestBody = UserService.Schemas.NewRegistrationDto;
		namespace Responses {
			export type $201 = UserService.Schemas.NewRegistrationResponseDto;
			export interface $400 {}
			export interface $403 {}
			export type $409 = UserService.Schemas.NewRegistrationResponseDto;
			export interface $500 {}
		}
	}
	namespace RegisterUser {
		export type RequestBody = UserService.Schemas.UserDTO;
		namespace Responses {
			export interface $201 {}
			export interface $400 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace RemoveChatSeriesParticipant {
		namespace Parameters {
			export type ConsultantId = string;
			export type SeriesId = number; // int64
		}
		export interface PathParameters {
			seriesId: Parameters.SeriesId /* int64 */;
			consultantId: Parameters.ConsultantId;
		}
		namespace Responses {
			export interface $204 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
		}
	}
	namespace RemoveFromSession {
		namespace Parameters {
			export type ConsultantId = string; // UUID
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
			consultantId: Parameters.ConsultantId /* UUID */;
		}
		namespace Responses {
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace SearchConsultants {
		namespace Parameters {
			export type Field =
				| 'FIRSTNAME'
				| 'LASTNAME'
				| 'EMAIL'
				| 'UPDATE_DATE'; // ^(FIRSTNAME|LASTNAME|EMAIL|UPDATE_DATE)$
			export type Order = 'ASC' | 'DESC'; // ^(ASC|DESC)$
			export type Page = number;
			export type PerPage = number;
			export type Query = string;
		}
		export interface QueryParameters {
			query: Parameters.Query;
			page?: Parameters.Page;
			perPage?: Parameters.PerPage;
			field?: Parameters.Field /* ^(FIRSTNAME|LASTNAME|EMAIL|UPDATE_DATE)$ */;
			order?: Parameters.Order /* ^(ASC|DESC)$ */;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.ConsultantSearchResultDTO;
			export interface $400 {}
			export interface $401 {}
			export interface $500 {}
		}
	}
	namespace SendLiveEvent {
		namespace Parameters {
			export type MatrixRoomId = string;
		}
		export interface QueryParameters {
			matrixRoomId: Parameters.MatrixRoomId;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace SendReassignmentNotification {
		export type RequestBody =
			UserService.Schemas.ReassignmentNotificationDTO;
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $500 {}
		}
	}
	namespace SkipChatSeriesOccurrence {
		namespace Parameters {
			export type OriginalStartUtc = string; // date-time
			export type SeriesId = number; // int64
		}
		export interface PathParameters {
			seriesId: Parameters.SeriesId /* int64 */;
		}
		export interface QueryParameters {
			originalStartUtc: Parameters.OriginalStartUtc /* date-time */;
		}
		namespace Responses {
			export interface $204 {}
			export interface $401 {}
			export interface $403 {}
		}
	}
	namespace StartChat {
		namespace Parameters {
			export type ChatId = number; // int64
		}
		export interface PathParameters {
			chatId: Parameters.ChatId /* int64 */;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace StartTwoFactorAuthByEmailSetup {
		export type RequestBody = UserService.Schemas.EmailDTO;
		namespace Responses {
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $412 {}
			export interface $500 {}
		}
	}
	namespace StopChat {
		namespace Parameters {
			export type ChatId = number; // int64
		}
		export interface PathParameters {
			chatId: Parameters.ChatId /* int64 */;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace TransferChatSeriesOwnership {
		namespace Parameters {
			export type SeriesId = number; // int64
		}
		export interface PathParameters {
			seriesId: Parameters.SeriesId /* int64 */;
		}
		export type RequestBody = UserService.Schemas.TransferOwnershipRequest;
		namespace Responses {
			export interface $204 {}
			export interface $401 {}
			export interface $403 {}
		}
	}
	namespace UpdateAbsence {
		export type RequestBody = UserService.Schemas.AbsenceDTO;
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace UpdateChat {
		namespace Parameters {
			export type ChatId = number; // int64
		}
		export interface PathParameters {
			chatId: Parameters.ChatId /* int64 */;
		}
		export type RequestBody = UserService.Schemas.ChatDTO;
		namespace Responses {
			export type $200 = UserService.Schemas.UpdateChatResponseDTO;
			export interface $400 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace UpdateConsultantData {
		export type RequestBody = UserService.Schemas.UpdateConsultantDTO;
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace UpdateEmailAddress {
		export type RequestBody = string;
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace UpdateKey {
		export type RequestBody = UserService.Schemas.MasterKeyDTO;
		namespace Responses {
			export interface $202 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
	namespace UpdateMobileToken {
		export type RequestBody = UserService.Schemas.MobileTokenDTO;
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace UpdatePassword {
		export type RequestBody = UserService.Schemas.PasswordDTO;
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $500 {}
		}
	}
	namespace UpdateSessionData {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		export type RequestBody = UserService.Schemas.SessionDataDTO;
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $500 {}
		}
	}
	namespace UserExists {
		namespace Parameters {
			export type Username = string;
		}
		export interface PathParameters {
			username: Parameters.Username;
		}
		namespace Responses {
			export interface $200 {}
			export interface $404 {}
		}
	}
	namespace VerifyCanModerateChat {
		namespace Parameters {
			export type ChatId = number; // int64
		}
		export interface PathParameters {
			chatId: Parameters.ChatId /* int64 */;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $409 {}
			export interface $500 {}
		}
	}
}
