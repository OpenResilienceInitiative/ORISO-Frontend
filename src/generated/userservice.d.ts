declare namespace UserService {
	namespace Parameters {
		export type InviteId = number; // int64
	}
	export interface PathParameters {
		InviteId?: Parameters.InviteId /* int64 */;
	}
	namespace Responses {
		export interface AccountInviteConflict {}
	}
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
		export interface AccountInvite {
			id?: number; // int64
			targetRole?: AccountInviteTargetRole;
			/**
			 * Server-derived purpose; absent in older clients means an ordinary invite.
			 */
			onboardingPurpose?: 'INVITE' | 'EXISTING_ACCOUNT_SETUP';
			tenantId?: number; // int64
			recipientEmail?: string;
			firstName?: string;
			lastName?: string;
			agencyId?: number; // int64
			departmentId?: number; // int64
			tenantIdAllocationMode?: /* AUTO/MANUAL reserve a new ID; EXISTING names a unit that exists (nothing is reserved). */ IdAllocationMode;
			agencyIdAllocationMode?: /* AUTO/MANUAL reserve a new ID; EXISTING names a unit that exists (nothing is reserved). */ IdAllocationMode;
			/**
			 * AGENCY_ADMIN invites only; null for every other role.
			 */
			alsoCounsellor?: boolean;
			/**
			 * Set while inviteStatus is WAITING_FOR_UNIT; the Admin shows "Beratungsstelle noch nicht angelegt".
			 */
			waitingForUnit?: 'AGENCY' | 'TENANT';
			/**
			 * A waiting invite whose unit has no pending admin invite any more; derived on read.
			 */
			queueProblem?: 'NO_UNIT_ADMIN';
			provisioningStatus?: string;
			/**
			 * Fixed admin-only setup recovery code; absent from the public token response.
			 */
			setupRecoveryReason?: string;
			provisionedUserId?: string;
			inviteStatus?: AccountInviteStatus;
			emailVerificationStatus?: string;
			emailDeliveryStatus?: string;
			twoFactorStatus?: string;
			accessGateStatus?: string;
			expiresAt?: string; // date-time
			acceptedAt?: string; // date-time
			revokedAt?: string; // date-time
			supersededAt?: string; // date-time
			twoFactorWaivedBy?: string;
			twoFactorWaivedAt?: string; // date-time
			twoFactorWaiverReason?: string;
			createDate?: string; // date-time
			/**
			 * Only in the answer that sent the mail.
			 */
			rawToken?: string;
			/**
			 * Only in the answer that sent the mail.
			 */
			acceptUrl?: string;
			dpaForwardedAt?: string; // date-time
			dpaForwardCount?: number;
			dpaSignedAt?: string; // date-time
			topicPermission?: /* How far a counsellor may extend their own topics (ORISO-Admin#1026). NONE = only the assigned department, SELECT_EXISTING = pick among the agency's departments, CREATE = add further topics of the Traeger (today's behaviour). On an update, null leaves the stored value untouched. */ TopicPermissionDTO;
			/**
			 * Public accept endpoint only.
			 */
			phase?: string;
			progressPhase?: /* The Admin's status tiles, derived in one place (InviteProgress). PREPARED = draft or waiting (Vorbereitet); INVITED = mail sent, link valid (Eingeladen); ACCOUNT_CREATED = a gate is open (Konto angelegt); DONE = all gates passed (Fertig); NEEDS_ACTION = bounced, expired, provisioning failed or no admin for its new unit (Braucht Aktion); CLOSED = revoked or replaced, no tile. */ AccountInviteProgressPhase;
			/**
			 * When the new unit this invite needed was created, set once: the release of a WAITING_FOR_UNIT invite, or for a Träger admin founding a new Träger its creation.
			 */
			unitCreatedAt?: string; // date-time
			/**
			 * When the latest invite mail was sent.
			 */
			sentAt?: string; // date-time
			/**
			 * When the account was created (same moment as acceptedAt).
			 */
			accountCreatedAt?: string; // date-time
			/**
			 * When 2FA was activated or waived (acceptedAt when not required); null until then.
			 */
			twoFactorDoneAt?: string; // date-time
			/**
			 * Accepted invites only; the roles the account holds now, also ones added later.
			 */
			accountRoles?: AccountInviteTargetRole[] | null;
			/**
			 * When the last gate passed (2FA activated or waived; for TENANT_ADMIN also the DPA signature). Null while a gate is open, and for 2FA activations before this field.
			 */
			completedAt?: string; // date-time
		}
		/**
		 * The Admin's status tiles, derived in one place (InviteProgress). PREPARED = draft or waiting (Vorbereitet); INVITED = mail sent, link valid (Eingeladen); ACCOUNT_CREATED = a gate is open (Konto angelegt); DONE = all gates passed (Fertig); NEEDS_ACTION = bounced, expired, provisioning failed or no admin for its new unit (Braucht Aktion); CLOSED = revoked or replaced, no tile.
		 */
		export type AccountInviteProgressPhase =
			| 'PREPARED'
			| 'INVITED'
			| 'ACCOUNT_CREATED'
			| 'DONE'
			| 'NEEDS_ACTION'
			| 'CLOSED';
		export type AccountInviteStatus =
			| 'WAITING_FOR_UNIT'
			| 'DRAFT'
			| 'EMAIL_SENT'
			| 'ACCEPTED'
			| 'EXPIRED'
			| 'REVOKED'
			| 'SUPERSEDED';
		export type AccountInviteTargetRole =
			| 'TENANT_ADMIN'
			| 'AGENCY_ADMIN'
			| 'COUNSELLOR'
			| 'ADVICE_SEEKER'
			| 'PLATFORM_ADMIN';
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
			 * Login enabled in the identity provider. Null means unknown, not disabled. Read-only best-effort metadata; missing identity data, provider outages or exhausted page lookup budgets leave the status unknown without removing rows.
			 */
			active?: boolean | null;
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
			agencies?: /* UserService compatibility view. This provider-owned response remains stable even when the AgencyService client model evolves independently. */ AgencyAdminResponseDTO[];
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
		export interface AdminListPreferencesDTO {
			/**
			 * Saved sort per list tab, keyed by tab name.
			 */
			sorts: {
				[
					name: string
				]: /* One saved list sort. field is FIRSTNAME, LASTNAME, EMAIL or UPDATE_DATE; the tenant-admins and platform-admins tabs also accept TENANT_ID. order is ASC or DESC. */ AdminListSortDTO;
			};
		}
		/**
		 * One saved list sort. field is FIRSTNAME, LASTNAME, EMAIL or UPDATE_DATE; the tenant-admins and platform-admins tabs also accept TENANT_ID. order is ASC or DESC.
		 */
		export interface AdminListSortDTO {
			/**
			 * example:
			 * LASTNAME
			 */
			field: string;
			/**
			 * example:
			 * ASC
			 */
			order: string;
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
			/**
			 * example:
			 * true
			 */
			mediaUpload?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaUploadAnonymousChats?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaUploadOneOnOneChats?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaUploadGroupChats?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaUploadSupervisionChats?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaInlineDisplay?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaInlineDisplayAnonymousChats?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaInlineDisplayOneOnOneChats?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaInlineDisplayGroupChats?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaInlineDisplaySupervisionChats?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaAiScan?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaAiScanAnonymousChats?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaAiScanOneOnOneChats?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaAiScanGroupChats?: boolean;
			/**
			 * example:
			 * true
			 */
			mediaAiScanSupervisionChats?: boolean;
		}
		export interface AgencyAdminControls {
			/**
			 * example:
			 * true
			 */
			permissionsPageEnabled?: boolean;
			allowedPermissionToggles?: AgencyAdminAllowedPermissionToggles;
			enforcedPermissionToggles?: AgencyAdminAllowedPermissionToggles;
		}
		/**
		 * One department (Fachbereich = agency x topic), mirrored from AgencyService.
		 */
		export interface AgencyAdminDepartmentDTO {
			/**
			 * example:
			 * 7
			 */
			topicId?: number; // int64
			hasPublishedDpp?: boolean;
			hasPublishedImprint?: boolean;
		}
		export interface AgencyAdminFullResponseDTO {
			_embedded?: /* UserService compatibility view. This provider-owned response remains stable even when the AgencyService client model evolves independently. */ AgencyAdminResponseDTO;
			_links?: AgencyLinks;
		}
		/**
		 * UserService compatibility view. This provider-owned response remains stable even when the AgencyService client model evolves independently.
		 */
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
		export interface AgencyIdAvailabilityResponseDTO {
			/**
			 * example:
			 * 21
			 */
			agencyId: number; // int64
			/**
			 * example:
			 * FREE
			 */
			status: 'FREE' | 'RESERVED' | 'ASSIGNED';
		}
		export interface AgencyIdReservationRequestDTO {
			/**
			 * The manually picked agency ID to reserve. Omit for AUTO mode (smallest free ID).
			 * example:
			 * 21
			 */
			agencyId?: number; // int64
			/**
			 * Tenant the pending agency belongs to. Validated only - never reserved here.
			 * example:
			 * 1
			 */
			tenantId?: number; // int64
		}
		export interface AgencyIdResponseDTO {
			/**
			 * example:
			 * 21
			 */
			agencyId: number; // int64
		}
		export interface AgencyLinks {
			self: HalLink;
			update?: HalLink;
			delete?: HalLink;
			postcodeRanges?: HalLink;
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
			 * Wall-clock start time in `timezone`; stored as a UTC instant.
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
		/**
		 * Topics a consultant offers at one counselling centre (Fachbereich = centre x topic).
		 */
		export interface ConsultantAgencyTopicsDTO {
			/**
			 * example:
			 * 5
			 */
			agencyId?: number; // int64
			/**
			 * example:
			 * [
			 *   3,
			 *   7
			 * ]
			 */
			topicIds?: number /* int64 */[];
		}
		export interface ConsultantDTO {
			/**
			 * Login enabled in the identity provider. Null means unknown, not disabled. Read-only best-effort metadata; missing identity data, provider outages or exhausted page lookup budgets leave the status unknown without removing rows.
			 */
			active?: boolean | null;
			topicPermission?: /* How far a counsellor may extend their own topics (ORISO-Admin#1026). NONE = only the assigned department, SELECT_EXISTING = pick among the agency's departments, CREATE = add further topics of the Traeger (today's behaviour). On an update, null leaves the stored value untouched. */ TopicPermissionDTO;
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
			agencies?: /* UserService compatibility view. This provider-owned response remains stable even when the AgencyService client model evolves independently. */ AgencyAdminResponseDTO[];
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
			/**
			 * The PUBLIC display name — the name advice seekers see.
			 */
			displayName?: string;
			/**
			 * Alias of displayName (the public name), kept for existing clients.
			 */
			publicName?: string;
			/**
			 * Optional internal display name for internal surfaces (team lists, internal group chats, supervision). Internal contexts fall back to displayName when empty.
			 */
			internalDisplayName?: string;
			/**
			 * example:
			 * counsellor_female
			 */
			salutation?: string;
			/**
			 * example:
			 * Head of counselling centre north
			 */
			position?: string;
			/**
			 * example:
			 * Dipl.-Soz.Päd.
			 */
			title?: string;
			/**
			 * Internal remarks about the consultant. Only present for tenant-level admin callers (tenant admin / platform admin).
			 */
			adminRemarks?: string;
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
			/**
			 * Counsellor avatar choice (#1046); absent when the counsellor made no choice.
			 */
			avatarKind?: 'ICON' | 'INITIALS' | 'PICTURE';
			/**
			 * Id of the chosen counsellor motif; only set together with avatarKind = ICON.
			 * example:
			 * motif-24
			 */
			avatarId?: string;
			roleInOrg?: string;
			vacated?: boolean;
			adminRights?: boolean;
			/**
			 * topics directly assigned to the consultant, enriched with names
			 */
			topics?: ConsultantTopicDTO[];
			/**
			 * Topics of the consultant per counselling centre (#1264). An entry without agencyId holds legacy assignments that apply to every centre of the consultant.
			 */
			topicsByAgency?: /* Topics a consultant offers at one counselling centre (Fachbereich = centre x topic). */ ConsultantAgencyTopicsDTO[];
			/**
			 * true if this consultant also holds an admin identity on the same account
			 */
			hasOtherIdentity?: boolean;
			/**
			 * which admin identities this consultant additionally holds
			 */
			otherIdentityTypes?: ('TENANT_ADMIN' | 'AGENCY_ADMIN')[];
			/**
			 * Whether this consultant owns a chat (Matrix) identity. MISSING means the account exists in the identity provider and the database but chat provisioning did not complete, so the counsellor cannot start or join any counselling room. Repair it with POST /useradmin/consultants/{consultantId}/chat-identity. Absent on responses from older deployments; treat absent as unknown, not as PROVISIONED.
			 */
			chatIdentityStatus?: 'PROVISIONED' | 'MISSING';
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
			/**
			 * The Keycloak username. Kept deliberately (#1107): ORISO-Frontend uses it as the third fallback for a consultant's display label, after "firstName lastName" and displayName, so dropping it would degrade that case to a raw id. It is populated only on the two authenticated list endpoints; the unauthenticated public-data endpoint leaves it unset. Removing it is a cross-repo change - retire the frontend fallback first.
			 */
			username?: string;
			/**
			 * Flag that indicates if the consultant can be added as a supervisor
			 * example:
			 * true
			 */
			isSupervisor?: boolean;
			/**
			 * Flag that indicates if the consultant is currently absent
			 * example:
			 * true
			 */
			absent?: boolean;
			/**
			 * The out-of-office message; carries a value only while absent is true, otherwise null
			 * example:
			 * I am absent until...
			 */
			absenceMessage?: string | null;
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
			supervision?: /* ADR-008 supervision marker for consultant-facing session lists. Filled for the requesting consultant only; absent on advice-seeker responses. Additive - older clients can ignore it. */ SessionSupervisionDTO;
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
		export interface CreateAccountInviteRequest {
			targetRole: AccountInviteTargetRole;
			/**
			 * Required for MANUAL and EXISTING; a Träger-bound caller gets their own when omitted.
			 */
			tenantId?: number; // int64
			recipientEmail: string;
			firstName?: string;
			lastName?: string;
			agencyId?: number; // int64
			/**
			 * The counsellor's topic; defaults to the agency's only topic.
			 */
			departmentId?: number; // int64
			/**
			 * For a waiting invite the clock starts at the release, not at creation.
			 */
			expiresInDays?: number; // int64
			/**
			 * Set = create and send in one step; a waiting invite keeps it for its release.
			 */
			templateId?: number; // int64
			/**
			 * Ignored; the accept link is server configuration.
			 */
			acceptBaseUrl?: string;
			tenantIdAllocationMode?: /* AUTO/MANUAL reserve a new ID; EXISTING names a unit that exists (nothing is reserved). */ IdAllocationMode;
			agencyIdAllocationMode?: /* AUTO/MANUAL reserve a new ID; EXISTING names a unit that exists (nothing is reserved). */ IdAllocationMode;
			/**
			 * AGENCY_ADMIN only (400 otherwise); omitted = true.
			 */
			alsoCounsellor?: boolean;
			topicPermission?: /* NONE, SELECT_EXISTING or CREATE (case-insensitive); the CSV import may send true (= CREATE) or false (= NONE). Omitted on create (e.g. a CSV row without that column) = SELECT_EXISTING, whatever the agency default says; an explicit value always wins; agency admins always get CREATE. */ TopicPermissionInput;
		}
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
			/**
			 * Optional PUBLIC display name shown to advice seekers.
			 */
			displayName?: string;
			/**
			 * Optional internal display name for internal surfaces; internal contexts fall back to the public displayName when empty.
			 */
			internalDisplayName?: string;
			/**
			 * Stable salutation key chosen from the admin form option list.
			 * example:
			 * counsellor_female
			 */
			salutation?: string;
			/**
			 * example:
			 * Head of counselling centre north
			 */
			position?: string;
			/**
			 * example:
			 * Dipl.-Soz.Päd.
			 */
			title?: string;
			/**
			 * Internal remarks about the consultant. Only readable and writable for tenant-level admins (tenant admin / platform admin); ignored for other callers.
			 */
			adminRemarks?: string;
			/**
			 * Counsellor avatar choice (#1046): ICON = one of the platform's monochrome counsellor motifs (then avatarId carries the motif id), INITIALS = the generated initials tile, PICTURE = an own uploaded picture. The upload itself is a separate ticket (#1048/#1049) and is not served by this service yet. Omitted means no choice; the initials fallback is rendered.
			 */
			avatarKind?: 'ICON' | 'INITIALS' | 'PICTURE';
			/**
			 * Id of the chosen counsellor motif. Only meaningful together with avatarKind = ICON; it is dropped for every other kind, and an ICON without a motif id is stored as INITIALS — a half choice is never persisted.
			 * example:
			 * motif-24
			 */
			avatarId?: string;
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
		export interface CreateLegalTextDTO {
			kind: 'DPP' | 'IMPRINT';
			label: string;
			/**
			 * Language code (e.g. de, en) to HTML text (multilingual map). Keys with the __meta suffix carry JSON translation metadata instead of HTML.
			 */
			content: {
				[name: string]: string;
			};
			/**
			 * true = mark PUBLISHED; false/absent = keep as DRAFT
			 */
			publish?: boolean;
		}
		export interface DataProtectionContactDTO {
			/**
			 * example:
			 * Max Mustermann
			 */
			nameAndLegalForm?: string;
			/**
			 * example:
			 * Musterstraße 1
			 */
			street?: string;
			/**
			 * example:
			 * 79106
			 */
			postcode?: string;
			/**
			 * example:
			 * Freiburg
			 */
			city?: string;
			/**
			 * example:
			 * 0761 123456
			 */
			phoneNumber?: string;
			email?: string;
		}
		export interface DataProtectionDTO {
			dataProtectionResponsibleEntity?:
				| 'AGENCY_RESPONSIBLE'
				| 'ALTERNATIVE_REPRESENTATIVE'
				| 'DATA_PROTECTION_OFFICER';
			agencyDataProtectionResponsibleContact?: DataProtectionContactDTO;
			alternativeDataProtectionRepresentativeContact?: DataProtectionContactDTO;
			dataProtectionOfficerContact?: DataProtectionContactDTO;
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
		export interface DepartmentDataProtectionContentDTO {
			/**
			 * Stored multilingual content as a JSON language->HTML map string; null if never authored
			 */
			content?: string | null;
			/**
			 * Current publication status of the department's data privacy policy
			 */
			publicationStatus: 'DRAFT' | 'PUBLISHED';
		}
		export interface DepartmentDataProtectionDTO {
			/**
			 * Language code (e.g. de, en) to HTML data privacy policy text (multilingual map)
			 * example:
			 * {
			 *   "de": "<p>Datenschutzerklärung des Fachbereichs ...</p>",
			 *   "en": "<p>Data privacy policy of the department ...</p>"
			 * }
			 */
			content: {
				[name: string]: string;
			};
			/**
			 * true = mark PUBLISHED (final legal document); false/absent = keep as DRAFT (draft-save)
			 */
			publish?: boolean;
		}
		export interface DepartmentDataProtectionResponseDTO {
			/**
			 * Resulting publication status of the department's data privacy policy
			 */
			publicationStatus: 'DRAFT' | 'PUBLISHED';
		}
		export interface DepartmentImprintContentDTO {
			/**
			 * Stored multilingual content as a JSON language->HTML map string; null if never authored
			 */
			content?: string | null;
			/**
			 * Current publication status of the department's imprint
			 */
			publicationStatus: 'DRAFT' | 'PUBLISHED';
		}
		export interface DepartmentImprintDTO {
			/**
			 * Language code (e.g. de, en) to HTML imprint text (multilingual map). Keys with the __meta suffix carry JSON translation metadata instead of HTML.
			 * example:
			 * {
			 *   "de": "<p>Impressum des Fachbereichs ...</p>",
			 *   "en": "<p>Imprint of the department ...</p>"
			 * }
			 */
			content: {
				[name: string]: string;
			};
			/**
			 * true = mark PUBLISHED (final legal document); false/absent = keep as DRAFT (draft-save)
			 */
			publish?: boolean;
		}
		export interface DepartmentImprintResponseDTO {
			/**
			 * Resulting publication status of the department's imprint
			 */
			publicationStatus: 'DRAFT' | 'PUBLISHED';
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
		export interface DpaPolicyErrorDTO {
			reason:
				| 'DPA_NEW_COUNSELLING_NOT_ALLOWED'
				| 'DPA_POLICY_UNAVAILABLE';
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
			/**
			 * ID of the browser-encrypted Matrix event to finalize as the initial enquiry
			 */
			matrixEventId?: string;
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
		export interface GroupChatJoinRequestAdmitDTO {
			role?: 'PARTICIPANT' | 'CO_MODERATOR';
		}
		/**
		 * Moderator view of a pending join request.
		 */
		export interface GroupChatJoinRequestDTO {
			id: number; // int64
			seriesId: number; // int64
			groupTitle?: string;
			status: GroupChatJoinRequestStatus;
			requestedAt: string; // date-time
			decidedAt?: string | null; // date-time
			via: 'INVITE_LINK';
			/**
			 * The caller's own role in this Series. Only an OWNER may admit as CO_MODERATOR.
			 */
			viewerRole: 'OWNER' | 'CO_MODERATOR';
			requester: GroupChatJoinRequesterDTO;
		}
		export type GroupChatJoinRequestStatus =
			| 'PENDING'
			| 'ADMITTING'
			| 'ADMITTED'
			| 'DECLINED'
			| 'CANCELLED';
		/**
		 * Requester view of a join request. Deliberately carries no group data.
		 */
		export interface GroupChatJoinRequestStatusDTO {
			id: number; // int64
			status: GroupChatJoinRequestStatus;
			requestedAt: string; // date-time
			decidedAt?: string | null; // date-time
		}
		export interface GroupChatJoinRequesterDTO {
			consultantId: string;
			displayName?: string | null;
			firstName?: string | null;
			lastName?: string | null;
			agencyName?: string | null;
			tenantName?: string | null;
			sameAgency: boolean;
			sameTenant: boolean;
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
			/**
			 * The counsellor's chosen avatar (#1046/#1047), so the advice seeker sees the same avatar in the chat that the counsellor picked. Absent when no choice was made and the initials fallback is rendered.
			 */
			avatarKind?: 'ICON' | 'INITIALS' | 'PICTURE';
			/**
			 * Id of the chosen counsellor motif; only set together with avatarKind = ICON.
			 * example:
			 * motif-24
			 */
			avatarId?: string;
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
		export interface GuestIdentitySuggestion {
			username: string; // ^[a-z0-9_]{3,30}$
			displayName: string;
			/**
			 * Existing bundled animal SVG filename, never an external URL
			 */
			avatarKey: string;
		}
		export interface GuestIdentitySuggestionRequest {
			locale: string;
			count: 1 | 4;
			exclude: [
				string?,
				string?,
				string?,
				string?,
				string?,
				string?,
				string?,
				string?,
				string?,
				string?,
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
		}
		export interface GuestInvitationContext {
			tenantId: number; // int64
			agencyId?: number | null; // int64
			consultingTypeId: number; // int32
			topicId?: number | null; // int64
			chatType: string;
		}
		export interface HalLink {
			href: string;
			method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
			templated?: boolean;
		}
		export interface HttpStatus {}
		/**
		 * AUTO/MANUAL reserve a new ID; EXISTING names a unit that exists (nothing is reserved).
		 */
		export type IdAllocationMode = 'AUTO' | 'MANUAL' | 'EXISTING';
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
		export interface LegalTextAdminDTO {
			id: number; // int64
			kind: 'DPP' | 'IMPRINT';
			/**
			 * Admin-facing name shown in the legal-text library
			 */
			label: string;
			/**
			 * Stored multilingual content as a JSON language->HTML map string
			 */
			content?: string | null;
			publicationStatus: 'DRAFT' | 'PUBLISHED';
			/**
			 * How many departments currently reference this text
			 */
			usageCount: number; // int64
		}
		export interface LegalTextAssignmentDTO {
			/**
			 * Which slot of the department to assign
			 */
			kind: 'DPP' | 'IMPRINT';
			/**
			 * Legal text to reference; null clears the slot — the department falls back to its own inline content (content_dpp/content_imprint). Tenant-level fallback is future work (ADR-014 / #136).
			 */
			legalTextId?: number | null; // int64
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
			/**
			 * Counsellor: an enquiry was assigned to me.
			 * example:
			 * true
			 */
			assignmentNotificationEnabled?: boolean;
			/**
			 * Counsellor: a new ordinary internal-group message. Independent of advice-seeker messages and protected professional feedback. Omitted legacy values mean enabled; an omitted PATCH preserves the saved choice.
			 * example:
			 * true
			 */
			internalChatNotificationEnabled?: boolean;
			/**
			 * Counsellor: a reply arrived in the protected professional exchange.
			 * example:
			 * true
			 */
			feedbackNotificationEnabled?: boolean;
			/**
			 * Both roles: maintenance and platform notices. Outages are sent regardless — this switches off the planned ones only.
			 * example:
			 * true
			 */
			serviceNoticeNotificationEnabled?: boolean;
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
		export interface PagedAccountInvites {
			content?: AccountInvite[];
			totalElements?: number; // int64
			totalPages?: number;
			page?: number;
			size?: number;
			/**
			 * Invites per progress phase over all pages of the tab and the caller's scope; ignores the status and progress_phase filters.
			 */
			phaseCounts?: {
				[name: string]: number; // int64
			};
			/**
			 * Per progress phase, what its count is made of: the invite status, or for NEEDS_ACTION why it is stuck (DELIVERY_FAILED, LINK_EXPIRED, PROVISIONING_FAILED, NO_UNIT_ADMIN, EXPIRED).
			 */
			phaseDetailCounts?: {
				[name: string]: {
					[name: string]: number; // int64
				};
			};
		}
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
			 * Consultants only: switches product tours on or off (Profile > Help). Defaults to false.
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
			/**
			 * consultants only: control live-chat availability from the navigation rail instead of My Profile; stored on the profile, no effect on others
			 * example:
			 * true
			 */
			liveChatViaSidebar?: boolean;
			emailNotifications?: EmailNotificationsDTO;
			/**
			 * Consultants only (#1240): ICON shows the motif in avatarId, INITIALS drops the motif and brings back the default avatar. Omitted with a non-empty avatarId means ICON.
			 */
			avatarKind?: 'ICON' | 'INITIALS';
			/**
			 * The chosen avatar (#1240): the counsellor motif id for consultants, the animal id for advice seekers, both the lower-case file stem such as "magpie". An empty string clears the choice; omitted leaves it unchanged.
			 * example:
			 * magpie
			 */
			avatarId?: string; // ^([a-z0-9-]{1,40})?$
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
		export interface SelfAssignment {
			role?: 'COUNSELLOR';
			agencyId?: number; // int64
			userId?: string;
			consultantIdentityCreated?: boolean;
		}
		export interface SelfAssignmentRequest {
			role: 'COUNSELLOR';
			agencyId: number; // int64
			/**
			 * Omitted = the agency's only topic; required when it offers several.
			 */
			topicIds?: number /* int64 */[];
		}
		export interface SendAccountInviteRequest {
			templateId?: number; // int64
			/**
			 * Ignored; the accept link is server configuration.
			 */
			acceptBaseUrl?: string;
		}
		export interface ServiceNoticeConfirmRequest {
			/**
			 * The recipients count shown by the dry run
			 */
			expectedRecipients: number;
		}
		export interface ServiceNoticeConfirmed {
			campaignKey: string;
			status: 'CONFIRMED';
			recipients: number;
			mailQueued: number;
			alreadyConfirmed: boolean;
		}
		export interface ServiceNoticeDraftInput {
			maintenanceDate: string; // date
			/**
			 * Same-day local time in whole minutes
			 * example:
			 * 14:00:00
			 */
			maintenanceStart: string;
			/**
			 * Same-day local time in whole minutes
			 * example:
			 * 15:00:00
			 */
			maintenanceEnd: string;
			/**
			 * Explicit public HTTPS status page
			 */
			statusUrl: string; // uri
		}
		export interface ServiceNoticeDraftPreview {
			campaignKey: string;
			variant: 'de-sie' | 'de-du' | 'en' | 'fr' | 'ru' | 'ti' | 'tr';
			subject: string;
			preheader: string;
			html: string;
			text: string;
		}
		export interface ServiceNoticeDraftView {
			campaignKey: string;
			status: string;
			maintenanceDate: string; // date
			maintenanceStart: string;
			maintenanceEnd: string;
			statusUrl: string; // uri
		}
		export interface ServiceNoticeDryRun {
			campaignKey: string;
			audience: 'AGENCY_ADMINS';
			/**
			 * Everyone who would get the in-app entry
			 */
			recipients: number;
			/**
			 * Recipients who would also get the mail
			 */
			mail: number;
			/**
			 * In-app only because their service-notice switch is off
			 */
			feedOnlyPreferenceOff: number;
			/**
			 * In-app only because no real address is stored
			 */
			feedOnlyNoAddress: number;
			/**
			 * In-app only because no sender tenant is known
			 */
			feedOnlyNoSenderTenant: number;
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
		export interface SessionConsentDTO {
			/**
			 * The legal-text version the help-seeker agreed to, as published by ORISO-AgencyService. A public document version - no personal data. Stored as a pointer that is overwritten on re-consent (ADR-022 decision 2); no consent log is kept.
			 * example:
			 * 7
			 */
			legalVersionId: number; // int64
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
			/**
			 * The counsellor's chosen avatar (#1046/#1047), so the advice seeker sees the same avatar in the chat that the counsellor picked. Absent when no choice was made and the initials fallback is rendered.
			 */
			avatarKind?: 'ICON' | 'INITIALS' | 'PICTURE';
			/**
			 * Id of the chosen counsellor motif; only set together with avatarKind = ICON.
			 * example:
			 * motif-24
			 */
			avatarId?: string;
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
			/**
			 * Matrix user id of the assigned consultant (null when no consultant is assigned)
			 * example:
			 * @consultant:matrix.example
			 */
			consultantMatrixUserId?: string | null;
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
			/**
			 * ADR-022 decision 2 - the legal-text version (owned by ORISO-AgencyService) this room is currently cleared for; null when Gate 2 has not been passed. A pointer, overwritten on re-consent, never a consent log. Additive - older clients can ignore it.
			 * example:
			 * 7
			 */
			consentedLegalVersionId?: number; // int64
			/**
			 * true when Gate 2 applies to this session and no consent pointer is recorded, i.e. the client must show the consent gate instead of the composer. Internal rooms (no help-seeker) always report false. Additive - older clients can ignore it.
			 * example:
			 * false
			 */
			consentRequired?: boolean;
			supervision?: /* ADR-008 supervision marker for consultant-facing session lists. Filled for the requesting consultant only; absent on advice-seeker responses. Additive - older clients can ignore it. */ SessionSupervisionDTO;
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
		/**
		 * ADR-008 supervision marker for consultant-facing session lists. Filled for the requesting consultant only; absent on advice-seeker responses. Additive - older clients can ignore it.
		 */
		export interface SessionSupervisionDTO {
			/**
			 * true when the requesting consultant is an active SessionSupervisor of this session, i.e. the entry is in their list because they supervise it, not because they counsel it.
			 * example:
			 * true
			 */
			supervisedByMe: boolean;
			/**
			 * Keycloak ids of all active supervisors of this session (empty when none).
			 * example:
			 * [
			 *   "926b9777-4eef-443d-925a-4aa534797bd7"
			 * ]
			 */
			supervisorConsultantIds: string[];
			/**
			 * Internal display names of the active supervisors, same order as supervisorConsultantIds (internal display name, else public display name, else username). Never a real name.
			 * example:
			 * [
			 *   "Supervisor Sam"
			 * ]
			 */
			supervisorDisplayNames: string[];
			/**
			 * Internal display name of the session's assigned (responsible) consultant, resolved by the same #996 rule as supervisorDisplayNames (internal display name, else public display name, else username). Never a real name. Absent when the session has no consultant yet (enquiry not taken). Lets a supervisor's panel title the case by its counsellor without a second lookup.
			 * example:
			 * Counsellor Chris
			 */
			counsellorDisplayName?: string | null;
			/**
			 * Matrix room id of the private ADR-008 supervision back-channel. Returned only when the requesting consultant is the session's assigned counsellor or an active supervisor. Never contains the help-seeker room id; null for unrelated team-list viewers, legacy rows that stored the client room, missing rooms, or inconsistent active assignments.
			 * example:
			 * !supervision-side-room:matrix.example.org
			 */
			sideRoomId?: string | null;
		}
		/**
		 * An active supervision assignment for a session.
		 */
		export interface SessionSupervisorResponseDTO {
			id: number; // int64
			sessionId: number; // int64
			/**
			 * Keycloak id of the supervising consultant.
			 */
			supervisorConsultantId: string;
			supervisorUsername: string;
			/**
			 * Matrix user id of the supervisor; null when no Matrix id is available.
			 */
			supervisorMatrixUserId?: string | null;
			/**
			 * Keycloak id of the consultant who created the assignment.
			 */
			addedByConsultantId: string;
			addedDate: string; // date-time
			matrixRoomId?: string | null;
			/**
			 * Human-readable supervision notes decoded from the stored payload.
			 */
			notes?: string | null;
			reasonCode?: string | null;
			justification?: string | null;
			consent?: string | null;
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
			 * Internal group chats (counsellors only). Unset falls back to featureGroupChatV2Enabled. On the public agency response this is the effective value: Traeger AND Beratungsstelle; a Traeger 'off' always wins (ADR-013).
			 * example:
			 * true
			 */
			featureInternalGroupChatEnabled?: boolean;
			/**
			 * Conversation circles / self-help groups (include advice seekers). Unset falls back to featureGroupChatV2Enabled. On the public agency response this is the effective value: Traeger AND Beratungsstelle; a Traeger 'off' always wins (ADR-013).
			 * example:
			 * true
			 */
			featureSelfHelpGroupsEnabled?: boolean;
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
			 * Master toggle: may images/media be uploaded into chats at all. Replaces the retired featureAttachmentUploadDisabled (ADR-015).
			 * example:
			 * true
			 */
			featureMediaUploadEnabled?: boolean;
			/**
			 * Enable media upload in anonymous chats.
			 * example:
			 * true
			 */
			featureMediaUploadAnonymousChatsEnabled?: boolean;
			/**
			 * Enable media upload in 1-on-1 chats.
			 * example:
			 * true
			 */
			featureMediaUploadOneOnOneChatsEnabled?: boolean;
			/**
			 * Enable media upload in group chats.
			 * example:
			 * true
			 */
			featureMediaUploadGroupChatsEnabled?: boolean;
			/**
			 * Enable media upload when a user is in supervision mode.
			 * example:
			 * true
			 */
			featureMediaUploadSupervisionChatsEnabled?: boolean;
			/**
			 * Master toggle: render media as scaled thumbnails (on) or deliver as downloadable file only (off). The virus-scan requirement is attached to this switch.
			 * example:
			 * true
			 */
			featureMediaInlineDisplayEnabled?: boolean;
			/**
			 * Inline media display in anonymous chats.
			 * example:
			 * true
			 */
			featureMediaInlineDisplayAnonymousChatsEnabled?: boolean;
			/**
			 * Inline media display in 1-on-1 chats.
			 * example:
			 * true
			 */
			featureMediaInlineDisplayOneOnOneChatsEnabled?: boolean;
			/**
			 * Inline media display in group chats.
			 * example:
			 * true
			 */
			featureMediaInlineDisplayGroupChatsEnabled?: boolean;
			/**
			 * Inline media display when a user is in supervision mode.
			 * example:
			 * true
			 */
			featureMediaInlineDisplaySupervisionChatsEnabled?: boolean;
			/**
			 * Master toggle: AI content check sets the media check state automatically; off = blurred until counsellor click-to-reveal.
			 * example:
			 * false
			 */
			featureMediaAiScanEnabled?: boolean;
			/**
			 * AI media scan for anonymous chats.
			 * example:
			 * false
			 */
			featureMediaAiScanAnonymousChatsEnabled?: boolean;
			/**
			 * AI media scan for 1-on-1 chats.
			 * example:
			 * false
			 */
			featureMediaAiScanOneOnOneChatsEnabled?: boolean;
			/**
			 * AI media scan for group chats.
			 * example:
			 * false
			 */
			featureMediaAiScanGroupChatsEnabled?: boolean;
			/**
			 * AI media scan when a user is in supervision mode.
			 * example:
			 * false
			 */
			featureMediaAiScanSupervisionChatsEnabled?: boolean;
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
		/**
		 * How far a counsellor may extend their own topics (ORISO-Admin#1026). NONE = only the assigned department, SELECT_EXISTING = pick among the agency's departments, CREATE = add further topics of the Traeger (today's behaviour). On an update, null leaves the stored value untouched.
		 */
		export type TopicPermissionDTO = 'NONE' | 'SELECT_EXISTING' | 'CREATE';
		/**
		 * NONE, SELECT_EXISTING or CREATE (case-insensitive); the CSV import may send true (= CREATE) or false (= NONE). Omitted on create (e.g. a CSV row without that column) = SELECT_EXISTING, whatever the agency default says; an explicit value always wins; agency admins always get CREATE.
		 */
		export type TopicPermissionInput =
			/* NONE, SELECT_EXISTING or CREATE (case-insensitive); the CSV import may send true (= CREATE) or false (= NONE). Omitted on create (e.g. a CSV row without that column) = SELECT_EXISTING, whatever the agency default says; an explicit value always wins; agency admins always get CREATE. */ /* How far a counsellor may extend their own topics (ORISO-Admin#1026). NONE = only the assigned department, SELECT_EXISTING = pick among the agency's departments, CREATE = add further topics of the Traeger (today's behaviour). On an update, null leaves the stored value untouched. */
			TopicPermissionDTO | boolean;
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
			/**
			 * indicates that the account may not be used until a second factor is active. Set for counsellors whose login was provisioned by an administrator, who chooses the initial password and hands it over.
			 * example:
			 * true
			 */
			isRequired?: boolean;
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
			/**
			 * Replaces the counsellor's spoken languages when non-empty. Omitted, null or an empty list leave the stored languages untouched (an omitted field arrives as an empty list, so the two cannot be told apart).
			 */
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
			 * Replaces the full set of topics assigned to the consultant; each topic is stored for every assigned counselling centre that offers it. Ignored when topicsByAgency is non-empty. Omitted or null keeps the stored topics; an empty list is rejected while the consultant still has topics.
			 * example:
			 * [
			 *   3,
			 *   7,
			 *   12
			 * ]
			 */
			topicIds?: number /* int64 */[] | null;
			/**
			 * Optional. Replaces the full set of topics per counselling centre (#1264). Each agency must be assigned to the consultant and must offer every topic listed for it. Wins over topicIds when non-empty; an empty list counts as not sent (clear with topicIds: []).
			 */
			topicsByAgency?: /* Topics a consultant offers at one counselling centre (Fachbereich = centre x topic). */ ConsultantAgencyTopicsDTO[];
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
			/**
			 * The PUBLIC display name shown to advice seekers. Null leaves the stored value untouched; an empty string clears it.
			 */
			displayName?: string;
			/**
			 * Optional internal display name for internal surfaces; internal contexts fall back to the public displayName when empty. Null leaves the stored value untouched; an empty string clears it.
			 */
			internalDisplayName?: string;
			/**
			 * Stable salutation key chosen from the admin form option list. Null leaves the stored value untouched; an empty string clears it.
			 * example:
			 * counsellor_female
			 */
			salutation?: string;
			/**
			 * Null leaves the stored value untouched; an empty string clears it.
			 * example:
			 * Head of counselling centre north
			 */
			position?: string;
			/**
			 * Null leaves the stored value untouched; an empty string clears it.
			 * example:
			 * Dipl.-Soz.Päd.
			 */
			title?: string;
			/**
			 * Internal remarks about the consultant. Only readable and writable for tenant-level admins (tenant admin / platform admin); ignored for other callers. Null leaves the stored value untouched; an empty string clears it.
			 */
			adminRemarks?: string;
			/**
			 * Counsellor avatar choice (#1046). Null leaves the stored choice untouched. Unlike the free-text personal-info fields this is a typed enum, so it carries no empty-string clear: send INITIALS to drop an icon choice.
			 */
			avatarKind?: 'ICON' | 'INITIALS' | 'PICTURE';
			/**
			 * Id of the chosen counsellor motif, only meaningful with avatarKind = ICON. Null leaves the stored value untouched; an empty string clears it — which also demotes a stored ICON choice to INITIALS, because a half choice is never persisted.
			 * example:
			 * motif-24
			 */
			avatarId?: string;
			topicPermission?: /* How far a counsellor may extend their own topics (ORISO-Admin#1026). NONE = only the assigned department, SELECT_EXISTING = pick among the agency's departments, CREATE = add further topics of the Traeger (today's behaviour). On an update, null leaves the stored value untouched. */ TopicPermissionDTO;
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
			 * 1
			 */
			consultingType?: number;
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
			 * Musterstraße
			 */
			street?: string;
			/**
			 * example:
			 * 12a
			 */
			houseNumber?: string;
			/**
			 * example:
			 * 2. OG, Haus B
			 */
			floorBuilding?: string;
			/**
			 * example:
			 * Deutschland
			 */
			country?: string;
			/**
			 * example:
			 * 0761 123456
			 */
			phone?: string;
			/**
			 * example:
			 * 0761 654321
			 */
			phoneSecondary?: string;
			/**
			 * example:
			 * kontakt@beratungsstelle.de
			 */
			email?: string;
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
			counsellingRelations?: (
				| 'RELATIVE_COUNSELLING'
				| 'SELF_COUNSELLING'
				| 'PARENTAL_COUNSELLING'
			)[];
			dataProtection?: DataProtectionDTO;
			/**
			 * example:
			 * base64 encoded image
			 */
			agencyLogo?: string;
			/**
			 * Agency settings including platform-level agencyAdminControls
			 */
			settings?: Settings;
		}
		export interface UpdateAgencyResponseDTO {
			_embedded?: /* UserService compatibility view. This provider-owned response remains stable even when the AgencyService client model evolves independently. */ AgencyAdminResponseDTO;
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
			 * Replaces the spoken languages when non-empty. Omitted, null or an empty list leave the stored languages untouched.
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
		export interface UpdateLegalTextDTO {
			label: string;
			/**
			 * Language code (e.g. de, en) to HTML text (multilingual map). Keys with the __meta suffix carry JSON translation metadata instead of HTML.
			 */
			content: {
				[name: string]: string;
			};
			/**
			 * true = PUBLISHED, false = DRAFT; omitted/null = keep the current publication status (a label/content-only update never unpublishes)
			 */
			publish?: boolean | null;
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
			 * Date of the current occurrence, as wall-clock time in `timezone`.
			 * example:
			 * 2019-10-23T00:00:00.000Z
			 */
			startDate: string; // date
			/**
			 * Start of the current occurrence, as wall-clock time in `timezone` (not UTC).
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
			/**
			 * Secret part of the invite link (send it as inviteToken to /users/chat/{id}/assign). Only present for counsellors who may see the group.
			 */
			inviteToken?: string;
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
			 * "Join without an account" from a self-help group invite link. The browser holds the only login, so the account is deleted once no login can still be alive (`user.temporary.deleteWorkflow.maxAge`, default 24 hours). Default false.
			 * example:
			 * false
			 */
			temporary?: boolean;
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
			/**
			 * Self-help group the person joins through its invite link. When set, the registration assigns that group and opens no counselling enquiry. It must be a self-help group of `agencyId`, it needs `groupChatInviteToken`, and it cannot be combined with `consultantId`.
			 * example:
			 * 19
			 */
			groupChatId?: number; // int64
			/**
			 * The secret part of that group's invite link. Required with `groupChatId`; a missing or wrong token answers 403 before any account is created, the same check as joining by invite link.
			 */
			groupChatInviteToken?: string;
		}
		export interface UserDataResponseDTO {
			chatRecoveryMode?: 'RECOVERY_KEY' | 'LOGIN_PASSWORD';
			chatRecoveryPolicyRevision?: number; // int64
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
			 * Counsellor avatar choice (#1046); absent when the counsellor made no choice and the initials fallback is rendered.
			 */
			avatarKind?: 'ICON' | 'INITIALS' | 'PICTURE';
			/**
			 * Consultants: id of the chosen counsellor motif, only set together with avatarKind = ICON. Advice seekers (#1240): id of the chosen animal; absent when the default derived from the user id applies.
			 * example:
			 * motif-24
			 */
			avatarId?: string;
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
			/**
			 * indicates that the account still carries the password its administrator chose and may not be used until the user has replaced it.
			 * example:
			 * true
			 */
			passwordChangeRequired?: boolean;
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
			 * Consultants only: product tours are switched on. Defaults to false; not set for other users.
			 * example:
			 * true
			 */
			isWalkThroughEnabled?: boolean;
			/**
			 * Consultants only: live-chat availability is controlled from the navigation rail instead of My Profile. Defaults to false; not set for other users.
			 * example:
			 * false
			 */
			liveChatViaSidebar?: boolean;
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
	namespace AdmitChatSeriesJoinRequest {
		namespace Parameters {
			export type RequestId = number; // int64
			export type SeriesId = number; // int64
		}
		export interface PathParameters {
			seriesId: Parameters.SeriesId /* int64 */;
			requestId: Parameters.RequestId /* int64 */;
		}
		export type RequestBody =
			UserService.Schemas.GroupChatJoinRequestAdmitDTO;
		namespace Responses {
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $409 {}
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
			export type InviteToken = string;
			export type MatrixRoomId = string;
		}
		export interface PathParameters {
			matrixRoomId: Parameters.MatrixRoomId;
		}
		export interface QueryParameters {
			inviteToken?: Parameters.InviteToken;
		}
		namespace Responses {
			export interface $200 {}
			export interface $400 {}
			export interface $401 {}
			export type $403 = UserService.Schemas.DpaPolicyErrorDTO;
			export interface $404 {}
			export interface $409 {}
			export interface $500 {}
			export type $502 = UserService.Schemas.DpaPolicyErrorDTO;
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
			export interface $404 {}
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
	namespace CancelOwnChatSeriesJoinRequest {
		namespace Parameters {
			export type SeriesId = number; // int64
		}
		export interface PathParameters {
			seriesId: Parameters.SeriesId /* int64 */;
		}
		namespace Responses {
			export interface $204 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
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
	namespace CheckEnquiryPermission {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		namespace Responses {
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export type $403 = UserService.Schemas.DpaPolicyErrorDTO;
			export interface $409 {}
			export type $502 = UserService.Schemas.DpaPolicyErrorDTO;
		}
	}
	namespace ConfirmServiceNoticeDraft {
		namespace Parameters {
			export type CampaignKey = string; // ^[A-Za-z0-9][A-Za-z0-9-]{0,79}$
		}
		export interface PathParameters {
			campaignKey: Parameters.CampaignKey /* ^[A-Za-z0-9][A-Za-z0-9-]{0,79}$ */;
		}
		export type RequestBody =
			UserService.Schemas.ServiceNoticeConfirmRequest;
		namespace Responses {
			export type $200 = UserService.Schemas.ServiceNoticeConfirmed;
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $409 {}
		}
	}
	namespace CreateChatSeriesJoinRequest {
		namespace Parameters {
			export type InviteToken = string;
			export type SeriesId = number; // int64
		}
		export interface PathParameters {
			seriesId: Parameters.SeriesId /* int64 */;
		}
		export interface QueryParameters {
			inviteToken?: Parameters.InviteToken;
		}
		namespace Responses {
			export type $200 =
				/* Requester view of a join request. Deliberately carries no group data. */ UserService.Schemas.GroupChatJoinRequestStatusDTO;
			export type $201 =
				/* Requester view of a join request. Deliberately carries no group data. */ UserService.Schemas.GroupChatJoinRequestStatusDTO;
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
		}
	}
	namespace CreateChatV1 {
		export type RequestBody = UserService.Schemas.ChatDTO;
		namespace Responses {
			export type $201 = UserService.Schemas.CreateChatResponseDTO;
			export interface $400 {}
			export type $403 = UserService.Schemas.DpaPolicyErrorDTO;
			export interface $409 {}
			export interface $500 {}
			export type $502 = UserService.Schemas.DpaPolicyErrorDTO;
		}
	}
	namespace CreateChatV2 {
		export type RequestBody = UserService.Schemas.ChatDTO;
		namespace Responses {
			export type $201 = UserService.Schemas.CreateChatResponseDTO;
			export interface $400 {}
			export type $403 = UserService.Schemas.DpaPolicyErrorDTO;
			export interface $409 {}
			export interface $500 {}
			export type $502 = UserService.Schemas.DpaPolicyErrorDTO;
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
	namespace DeclineChatSeriesJoinRequest {
		namespace Parameters {
			export type RequestId = number; // int64
			export type SeriesId = number; // int64
		}
		export interface PathParameters {
			seriesId: Parameters.SeriesId /* int64 */;
			requestId: Parameters.RequestId /* int64 */;
		}
		namespace Responses {
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $409 {}
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
	namespace DryRunServiceNoticeDraft {
		namespace Parameters {
			export type CampaignKey = string; // ^[A-Za-z0-9][A-Za-z0-9-]{0,79}$
		}
		export interface PathParameters {
			campaignKey: Parameters.CampaignKey /* ^[A-Za-z0-9][A-Za-z0-9-]{0,79}$ */;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.ServiceNoticeDryRun;
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
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
			export interface $503 {}
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
	namespace GetGuestInvitationContext {
		namespace Parameters {
			export type Token = string;
		}
		export interface PathParameters {
			token: Parameters.Token;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.GuestInvitationContext;
			export interface $400 {}
			export interface $404 {}
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
	namespace GetOwnChatSeriesJoinRequest {
		namespace Parameters {
			export type SeriesId = number; // int64
		}
		export interface PathParameters {
			seriesId: Parameters.SeriesId /* int64 */;
		}
		namespace Responses {
			export type $200 =
				/* Requester view of a join request. Deliberately carries no group data. */ UserService.Schemas.GroupChatJoinRequestStatusDTO;
			export interface $204 {}
			export interface $401 {}
			export interface $403 {}
		}
	}
	namespace GetPendingChatSeriesJoinRequests {
		namespace Responses {
			export type $200 =
				/* Moderator view of a pending join request. */ UserService.Schemas.GroupChatJoinRequestDTO[];
			export interface $401 {}
			export interface $403 {}
		}
	}
	namespace GetServiceNoticeDraft {
		namespace Parameters {
			export type CampaignKey = string; // ^[A-Za-z0-9][A-Za-z0-9-]{0,79}$
		}
		export interface PathParameters {
			campaignKey: Parameters.CampaignKey /* ^[A-Za-z0-9][A-Za-z0-9-]{0,79}$ */;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.ServiceNoticeDraftView;
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
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
	namespace GetSessionSupervisors {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		namespace Responses {
			export type $200 =
				/* An active supervision assignment for a session. */ UserService.Schemas.SessionSupervisorResponseDTO[];
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
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
			export type $403 = UserService.Schemas.DpaPolicyErrorDTO;
			export interface $404 {}
			export interface $409 {}
			export interface $500 {}
			export type $502 = UserService.Schemas.DpaPolicyErrorDTO;
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
	namespace PreviewServiceNoticeDraft {
		namespace Parameters {
			export type CampaignKey = string; // ^[A-Za-z0-9][A-Za-z0-9-]{0,79}$
			export type Variant =
				| 'de-sie'
				| 'de-du'
				| 'en'
				| 'fr'
				| 'ru'
				| 'ti'
				| 'tr';
		}
		export interface PathParameters {
			campaignKey: Parameters.CampaignKey /* ^[A-Za-z0-9][A-Za-z0-9-]{0,79}$ */;
		}
		export interface QueryParameters {
			variant: Parameters.Variant;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.ServiceNoticeDraftPreview;
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
		}
	}
	namespace RecordSessionConsent {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		export type RequestBody = UserService.Schemas.SessionConsentDTO;
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
	namespace SaveServiceNoticeDraft {
		namespace Parameters {
			export type CampaignKey = string; // ^[A-Za-z0-9][A-Za-z0-9-]{0,79}$
		}
		export interface PathParameters {
			campaignKey: Parameters.CampaignKey /* ^[A-Za-z0-9][A-Za-z0-9-]{0,79}$ */;
		}
		export type RequestBody = UserService.Schemas.ServiceNoticeDraftInput;
		namespace Responses {
			export type $200 = UserService.Schemas.ServiceNoticeDraftView;
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $409 {}
		}
	}
	namespace SearchConsultants {
		namespace Parameters {
			export type AgencyId = number /* int64 */[];
			export type Field =
				| 'FIRSTNAME'
				| 'LASTNAME'
				| 'EMAIL'
				| 'UPDATE_DATE'; // ^(FIRSTNAME|LASTNAME|EMAIL|UPDATE_DATE)$
			export type Order = 'ASC' | 'DESC'; // ^(ASC|DESC)$
			export type Page = number;
			export type PerPage = number;
			export type Query = string;
			export type TenantId = number; // int64
		}
		export interface QueryParameters {
			query: Parameters.Query;
			page?: Parameters.Page;
			perPage?: Parameters.PerPage;
			field?: Parameters.Field /* ^(FIRSTNAME|LASTNAME|EMAIL|UPDATE_DATE)$ */;
			order?: Parameters.Order /* ^(ASC|DESC)$ */;
			tenantId?: Parameters.TenantId /* int64 */;
			agencyId?: Parameters.AgencyId;
		}
		namespace Responses {
			export type $200 = UserService.Schemas.ConsultantSearchResultDTO;
			export interface $400 {}
			export interface $401 {}
			export interface $500 {}
		}
	}
	namespace SendContactSheetEmail {
		namespace Parameters {
			export type SessionId = number; // int64
		}
		export interface PathParameters {
			sessionId: Parameters.SessionId /* int64 */;
		}
		namespace Responses {
			export interface $204 {}
			export interface $400 {}
			export interface $401 {}
			export interface $403 {}
			export interface $404 {}
			export interface $409 {}
			export interface $500 {}
			export interface $502 {}
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
			export interface $410 {}
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
			export type $403 = UserService.Schemas.DpaPolicyErrorDTO;
			export interface $409 {}
			export interface $500 {}
			export type $502 = UserService.Schemas.DpaPolicyErrorDTO;
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
	namespace SuggestGuestIdentities {
		export type RequestBody =
			UserService.Schemas.GuestIdentitySuggestionRequest;
		namespace Responses {
			export type $200 = [
				UserService.Schemas.GuestIdentitySuggestion?,
				UserService.Schemas.GuestIdentitySuggestion?,
				UserService.Schemas.GuestIdentitySuggestion?,
				UserService.Schemas.GuestIdentitySuggestion?
			];
			export interface $400 {}
			export interface $429 {}
			export interface $503 {}
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
			export type $403 = UserService.Schemas.DpaPolicyErrorDTO;
			export interface $409 {}
			export interface $500 {}
			export type $502 = UserService.Schemas.DpaPolicyErrorDTO;
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
			export interface $409 {}
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
