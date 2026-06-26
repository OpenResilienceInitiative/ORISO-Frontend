import { getApiBaseUrl } from './getApiBaseUrl';
import {
	getAgencyServiceOrigin,
	getConsultingTypeServiceOrigin,
	getKeycloakAuthPath,
	getKeycloakOrigin,
	getTenantServiceOrigin,
	getUserServiceOrigin
} from './runtimeConfig';

export const apiUrl = getApiBaseUrl();
const userServiceOrigin = getUserServiceOrigin(apiUrl);
const tenantServiceOrigin = getTenantServiceOrigin(apiUrl);
const agencyServiceOrigin = getAgencyServiceOrigin(apiUrl);
const consultingTypeServiceOrigin = getConsultingTypeServiceOrigin(apiUrl);
const keycloakOrigin = getKeycloakOrigin(apiUrl);

export const endpoints = {
	agencyConsultants: userServiceOrigin + '/service/users/consultants',
	agencyServiceBase: agencyServiceOrigin + '/service/agencies',
	agencyTopics: agencyServiceOrigin + '/service/agencies/topics',
	agenciesByTenant: agencyServiceOrigin + '/service/agencies/by-tenant',
	additionalEnquiry: userServiceOrigin + '/service/users/askers/session/new',
	appointmentBase: apiUrl + '/service/appointments/sessions',
	appointmentBaseNew: (sessionId: number) =>
		apiUrl + `/service/appointments/sessions/${sessionId}/enquiry/new`,
	appointmentServiceBase: apiUrl + '/service/agency/',
	appointmentServiceCalDav:
		agencyServiceOrigin + '/service/appointservice/caldav',
	appointmentServiceCalDavAccount:
		agencyServiceOrigin + '/service/appointservice/caldav/hasAccount',
	appointmentServiceMeetingLink: (agencyId: number) =>
		agencyServiceOrigin +
		`/service/appointservice/agencies/${agencyId}/initialMeetingSlug`,
	counselorAppointmentLink: (userId: string) =>
		agencyServiceOrigin +
		`/service/appointservice/consultants/${userId}/meetingSlug`,
	counselorToken:
		agencyServiceOrigin + `/service/appointservice/consultants/token`,
	appointmentsServiceBase: apiUrl + '/service/appointments',
	appointmentsServiceBookingEventsByUserId: (userId: string) =>
		agencyServiceOrigin +
		`/service/appointservice/askers/${userId}/bookings`,
	appointmentsServiceConsultantBookings: (userId: string, status: string) =>
		agencyServiceOrigin +
		`/service/appointservice/consultants/${userId}/bookings?status=${status}`,
	askerSessions: userServiceOrigin + '/service/users/sessions/askers',
	attachmentUpload: apiUrl + '/service/uploads/new/',
	banUser: (rcUserId, chatId) =>
		userServiceOrigin + `/service/users/${rcUserId}/chat/${chatId}/ban`,
	budibaseTools: (userId: string) =>
		apiUrl + `/service/counselingtoolsservice/tools/${userId}`,
	chatRoom: userServiceOrigin + '/service/users/chat/room',
	anonymousEnquiryDetails: (sessionId: number | string) =>
		userServiceOrigin + `/service/conversations/anonymous/${sessionId}`,
	finishAnonymousConversation: (sessionId: number | string) =>
		userServiceOrigin +
		`/service/conversations/anonymous/${sessionId}/finish`,
	anonymousConsultantAvailability:
		userServiceOrigin + '/service/conversations/anonymous/availability',
	consultantEnquiriesBase:
		userServiceOrigin + '/service/conversations/consultants/enquiries/',
	consultantLiveChatAvailability:
		userServiceOrigin + '/service/conversations/consultants/availability',
	consultantSessions:
		userServiceOrigin + '/service/users/sessions/consultants?status=2&',
	consultantStatistics: apiUrl + '/service/statistics/consultant',
	consultantsLanguages:
		userServiceOrigin + '/service/users/consultants/languages',
	consultingTypeServiceBase:
		consultingTypeServiceOrigin + '/service/consultingtypes',
	deleteAskerAccount: userServiceOrigin + '/service/users/account',
	draftMessages: userServiceOrigin + '/service/messages/draft',
	userDrafts: userServiceOrigin + '/service/users/drafts',
	email: userServiceOrigin + '/service/users/email',
	error: apiUrl + '/service/logstash',
	groupChatBase: userServiceOrigin + '/service/users/chat/',
	keycloakAccessToken:
		keycloakOrigin + getKeycloakAuthPath('/protocol/openid-connect/token'),
	keycloakLogout:
		keycloakOrigin + getKeycloakAuthPath('/protocol/openid-connect/logout'),
	liveservice: apiUrl + '/service/live',
	loginResetPasswordLink:
		keycloakOrigin +
		getKeycloakAuthPath(
			'/login-actions/reset-credentials?client_id=account'
		),
	magicLinkRequest: userServiceOrigin + '/service/users/magic-link/request',
	magicLinkConsume: userServiceOrigin + '/service/users/magic-link/consume',
	matrixAccessToken: userServiceOrigin + '/service/matrix/me/token',
	messageRead: apiUrl + '/api/v1/subscriptions.read',
	messages: {
		get: userServiceOrigin + '/service/messages',
		delete: userServiceOrigin + '/service/messages/:messageId'
	},
	myMessagesBase:
		userServiceOrigin + '/service/conversations/consultants/mymessages/',
	passwordReset: userServiceOrigin + '/service/users/password/change',
	rc: {
		accessToken: apiUrl + '/api/v1/login',
		e2ee: {
			fetchMyKeys: apiUrl + '/api/v1/e2e.fetchMyKeys',
			getUsersOfRoomWithoutKey:
				apiUrl + '/api/v1/e2e.getUsersOfRoomWithoutKey',
			setRoomKeyID: apiUrl + '/api/v1/e2e.setRoomKeyID',
			setUserPublicAndPrivateKeys:
				apiUrl + '/api/v1/e2e.setUserPublicAndPrivateKeys',
			updateGroupKey: apiUrl + '/api/v1/e2e.updateGroupKey'
		},
		groups: {
			members: apiUrl + '/api/v1/groups.members'
		},
		logout: apiUrl + '/api/v1/logout',
		rooms: {
			get: apiUrl + '/api/v1/rooms.get',
			info: apiUrl + '/api/v1/rooms.info'
		},
		settings: {
			public: apiUrl + '/api/v1/settings.public'
		},
		subscriptions: {
			get: apiUrl + '/api/v1/subscriptions.get',
			read: apiUrl + '/api/v1/subscriptions.read',
			getOne: apiUrl + '/api/v1/subscriptions.getOne'
		},
		users: {
			getStatus: apiUrl + '/api/v1/users.getStatus',
			info: apiUrl + '/api/v1/users.info',
			resetE2EKey: apiUrl + '/api/v1/users.resetE2EKey'
		}
	},
	registerAsker: userServiceOrigin + '/service/users/askers/new',
	baseUserService: userServiceOrigin + '/service/users',
	//todo delete?
	registerAskerNewConsultingType:
		userServiceOrigin + '/service/users/askers/consultingType/new',
	rejectVideoCall: apiUrl + '/service/videocalls/reject',
	rocketchatAccessToken: apiUrl + '/api/v1/login',
	rocketchatLogout: apiUrl + '/api/v1/logout',
	sendAliasMessage: userServiceOrigin + '/service/messages/aliasonly/new',
	sendMessage: userServiceOrigin + '/service/messages/new',
	sessionBase: userServiceOrigin + '/service/users/sessions',
	sessionRooms: userServiceOrigin + '/service/users/sessions/room',
	setAbsence: userServiceOrigin + '/service/users/consultants/absences',
	startVideoCall: apiUrl + '/service/videocalls/new',
	tenantServiceBase: tenantServiceOrigin + '/service/tenant',
	topicGroups: consultingTypeServiceOrigin + '/service/topic-groups',
	topicsData: consultingTypeServiceOrigin + '/service/topic/public/',
	twoFactorAuth: userServiceOrigin + '/service/users/2fa',
	twoFactorAuthApp: userServiceOrigin + '/service/users/2fa/app',
	twoFactorAuthEmail: userServiceOrigin + '/service/users/2fa/email',
	updateMessage: userServiceOrigin + '/service/messages/',
	userData: userServiceOrigin + '/service/users/data',
	eventNotifications:
		userServiceOrigin + '/service/users/event-notifications',
	userDataBySessionId: (sessionId: number) =>
		userServiceOrigin + `/service/users/consultants/sessions/${sessionId}`,
	userSessionsListView: '/sessions/user/view',
	serviceSettings: consultingTypeServiceOrigin + '/service/settings',
	frontend: {
		settings: '/p/api/settings'
	},
	setAppointmentSuccessMessage:
		userServiceOrigin + '/service/messages/aliasWithContent/new',
	userUpdateE2EKey: userServiceOrigin + '/service/users/chat/e2e',
	videocallServiceBase: apiUrl + '/service/videocalls'
};
