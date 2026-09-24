import { VideoCallMessageDTO } from '../../components/message/MessageItemComponent';
import { AgencyDataInterface } from './UserDataInterface';

export const SESSION_DATA_KEY_ENQUIRIES = 'enquiries';
export const SESSION_DATA_KEY_MY_SESSIONS = 'mySessions';

export type SessionDataKeyEnquiries = typeof SESSION_DATA_KEY_ENQUIRIES;
export type SessionDataKeyMySessions = typeof SESSION_DATA_KEY_MY_SESSIONS;

export type SessionDataKeys =
	| SessionDataKeyEnquiries
	| SessionDataKeyMySessions;

export type SessionsDataInterface = {
	[key in SessionDataKeys]?: ListItemInterface[];
};

export interface ListItemInterface {
	agency?: AgencyDataInterface;
	consultant?: SessionConsultantInterface;
	session?: SessionItemInterface;
	chat?: GroupChatItemInterface;
	user?: SessionUserInterface;
	language?: string;
	latestMessage?: string;
}

export interface SessionConsultantInterface {
	consultantId: string;
	absent: boolean;
	absenceMessage: string;
	displayName?: string;
	username: string;
	firstName?: string;
	lastName?: string;
	id?: string;
}

export const STATUS_EMPTY = 0;
type statusEmpty = typeof STATUS_EMPTY;

export const STATUS_ENQUIRY = 1;
type statusEnquiry = typeof STATUS_ENQUIRY;

export const STATUS_ACTIVE = 2;
type statusActive = typeof STATUS_ACTIVE;

export const STATUS_FINISHED = 3;
type statusFinished = typeof STATUS_FINISHED;

export const STATUS_ARCHIVED = 4;
type statusArchived = typeof STATUS_ARCHIVED;

export const REGISTRATION_TYPE_REGISTERED = 'REGISTERED';
type registrationTypeRegistered = typeof REGISTRATION_TYPE_REGISTERED;

export interface TopicSessionInterface {
	id: number;
	name: string;
	description: string;
}

export interface SessionItemInterface {
	conversationType?:
		| 'AGENCY_COUNSELLING'
		| 'LIVE_CHAT'
		| 'INTERNAL_GROUP'
		| 'SELF_HELP';
	agencyId: number;
	askerMatrixUserId: string;
	/** Matrix id of the assigned consultant (SessionDTO); absent on group chats. */
	consultantMatrixUserId?: string;
	attachment: UserService.Schemas.SessionAttachmentDTO;
	consultingType: number;
	matrixRoomId: string;
	id: number;
	e2eLastMessage: {
		t: string;
		msg: string;
	};
	lastMessage?: string;
	lastMessageType?: string;
	messageDate: number;
	createDate: string;
	/**
	 * @deprecated Hard-coded to `true` by the backend since the Matrix-native
	 * refactor — carries no information. Derive unread state from the Matrix
	 * room via `utils/sessionUnread` (#1147) instead of reading this field.
	 */
	messagesRead: boolean;
	messageTime?: number;
	postcode: number;
	registrationType: registrationTypeRegistered;
	teamSession?: boolean;
	status:
		| statusEmpty
		| statusEnquiry
		| statusActive
		| statusFinished
		| statusArchived;
	videoCallMessageDTO: VideoCallMessageDTO;
	language?: string;
	topic: TopicSessionInterface;
	/**
	 * ADR-008 supervision marker. `undefined` on backends that predate the
	 * field — consumers fall back to heuristics, never to "not supervised".
	 */
	supervision?: UserService.Schemas.SessionSupervisionDTO;
}

export interface GroupChatItemInterface {
	conversationType?:
		| 'AGENCY_COUNSELLING'
		| 'LIVE_CHAT'
		| 'INTERNAL_GROUP'
		| 'SELF_HELP';
	active: boolean;
	assignedAgencies: AgencyService.Schemas.AgencyResponseDTO[];
	attachment: UserService.Schemas.SessionAttachmentDTO;
	consultingType: number;
	duration: number;
	matrixRoomId: string;
	hintMessage: string;
	sourceLanguage?: string;
	hintMessageTranslations?: Record<string, string>;
	groupChatRulesTranslations?: Record<string, string[]>;
	id: number;
	lastMessage: string;
	lastMessageType?: string;
	e2eLastMessage: {
		t: string;
		msg: string;
	};
	messageDate: number;
	/**
	 * @deprecated Hard-coded to `true` by the backend since the Matrix-native
	 * refactor — carries no information. Derive unread state from the Matrix
	 * room via `utils/sessionUnread` (#1147) instead of reading this field.
	 */
	messagesRead: boolean;
	moderators: string[];
	participants?: UserService.Schemas.GroupChatParticipantDTO[];
	repetitive: boolean;
	repeatCount?: number;
	currentOccurrenceIndex?: number;
	chatInterval?: UserService.Schemas.UserChatDTO['chatInterval'];
	modality?: UserService.Schemas.UserChatDTO['modality'];
	timezone?: string;
	startDate: string;
	startTime: string;
	startDateWithTime?: string;
	subscribed: boolean;
	topic: string;
	createdAt: string;
}

export interface SessionUserInterface {
	username: string;
	displayName?: string;
	sessionData: SessionUserDataInterface;
}

export interface SessionUserDataInterface {
	addictiveDrugs?: string;
	age?: number;
	gender?: number;
	relation?: number;
	state?: number;
}

export interface ListItemsResponseInterface {
	count: number;
	offset: number;
	sessions: ListItemInterface[];
	total: number;
}
