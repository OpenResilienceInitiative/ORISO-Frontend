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
	agencyDepartmentLegal: (agencyId: number, topicId: number) =>
		agencyServiceOrigin +
		`/service/agencies/${agencyId}/topics/${topicId}/legal`,
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
	caseHandoverBatch: userServiceOrigin + '/service/users/case-handover/batch',
	caseHandoverCandidates:
		userServiceOrigin + '/service/users/case-handover/candidates',
	caseHandoverReasons:
		userServiceOrigin + '/service/users/case-handover/reasons',
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
	messages: {
		get: userServiceOrigin + '/service/messages',
		delete: userServiceOrigin + '/service/messages/:messageId'
	},
	myMessagesBase:
		userServiceOrigin + '/service/conversations/consultants/mymessages/',
	passwordReset: userServiceOrigin + '/service/users/password/change',
	registerAsker: userServiceOrigin + '/service/users/askers/new',
	baseUserService: userServiceOrigin + '/service/users',
	//todo delete?
	registerAskerNewConsultingType:
		userServiceOrigin + '/service/users/askers/consultingType/new',
	rejectVideoCall: apiUrl + '/service/videocalls/reject',
	sendAliasMessage: userServiceOrigin + '/service/messages/aliasonly/new',
	sendMessage: userServiceOrigin + '/service/messages/new',
	sessionBase: userServiceOrigin + '/service/users/sessions',
	sessionRooms: userServiceOrigin + '/service/users/sessions/room',
	setAbsence: userServiceOrigin + '/service/users/consultants/absences',
	startVideoCall: apiUrl + '/service/videocalls/new',
	tenantServiceBase: tenantServiceOrigin + '/service/tenant',
	dpaSignatureConfirm: (token: string) =>
		tenantServiceOrigin +
		`/service/tenant/public/dpa/confirm/${encodeURIComponent(token)}`,
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
	videocallServiceBase: apiUrl + '/service/videocalls'
};
