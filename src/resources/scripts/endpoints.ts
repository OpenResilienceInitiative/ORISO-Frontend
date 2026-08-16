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
export const tenantServiceOrigin = getTenantServiceOrigin(apiUrl);
const agencyServiceOrigin = getAgencyServiceOrigin(apiUrl);
const consultingTypeServiceOrigin = getConsultingTypeServiceOrigin(apiUrl);
const keycloakOrigin = getKeycloakOrigin(apiUrl);

export const endpoints = {
	accountInvite: (token: string) =>
		userServiceOrigin +
		`/service/users/account-invites/${encodeURIComponent(token)}`,
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
	appointmentsServiceBookingEventsByUserId: (userId: string) =>
		agencyServiceOrigin +
		`/service/appointservice/askers/${userId}/bookings`,
	appointmentsServiceConsultantBookings: (userId: string, status: string) =>
		agencyServiceOrigin +
		`/service/appointservice/consultants/${userId}/bookings?status=${status}`,
	askerSessions: userServiceOrigin + '/service/users/sessions/askers',
	banUser: (matrixUserId, chatId) =>
		userServiceOrigin +
		`/service/users/${encodeURIComponent(matrixUserId)}/chat/${chatId}/ban`,
	budibaseTools: (userId: string) =>
		apiUrl + `/service/counselingtoolsservice/tools/${userId}`,
	chatRoom: userServiceOrigin + '/service/users/chat/room',
	anonymousEnquiryDetails: (sessionId: number | string) =>
		userServiceOrigin + `/service/conversations/anonymous/${sessionId}`,
	acceptAnonymousEnquiry: (sessionId: number | string) =>
		userServiceOrigin +
		`/service/conversations/askers/anonymous/${sessionId}/accept`,
	finishAnonymousConversation: (sessionId: number | string) =>
		userServiceOrigin +
		`/service/conversations/anonymous/${sessionId}/finish`,
	anonymousConsultantAvailability:
		userServiceOrigin + '/service/conversations/anonymous/availability',
	consultantEnquiriesBase:
		userServiceOrigin + '/service/conversations/consultants/enquiries/',
	consultantLiveChatAvailability:
		userServiceOrigin + '/service/conversations/consultants/availability',
	consultantLiveChatAvailabilityHeartbeat:
		userServiceOrigin +
		'/service/conversations/consultants/availability/heartbeat',
	consultantSessions:
		userServiceOrigin + '/service/users/sessions/consultants?status=2&',
	consultantStatistics:
		userServiceOrigin + '/service/users/statistics/consultant',
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
	userDrafts: userServiceOrigin + '/service/users/drafts',
	tutorialProgress: userServiceOrigin + '/service/users/tutorials/progress',
	email: userServiceOrigin + '/service/users/email',
	// logstash intake was retired; client crash reports now go to UserService's
	// OBS-P3 error-intake endpoint, which logs them into SigNoz (ORISO-Helm#62).
	error: userServiceOrigin + '/service/error-reports',
	groupChatBase: userServiceOrigin + '/service/users/chat/',
	chatSeriesBase: userServiceOrigin + '/service/users/chat-series/',
	keycloakAccessToken:
		keycloakOrigin + getKeycloakAuthPath('/protocol/openid-connect/token'),
	keycloakLogout:
		keycloakOrigin + getKeycloakAuthPath('/protocol/openid-connect/logout'),
	loginResetPasswordLink:
		keycloakOrigin +
		getKeycloakAuthPath(
			'/login-actions/reset-credentials?client_id=account'
		),
	magicLinkRequest: userServiceOrigin + '/service/users/magic-link/request',
	magicLinkConsume: userServiceOrigin + '/service/users/magic-link/consume',
	passwordResetRequest:
		userServiceOrigin + '/service/users/password-reset/request',
	passwordResetConfirm:
		userServiceOrigin + '/service/users/password-reset/confirm',
	matrixAccessToken: userServiceOrigin + '/service/matrix/me/token',
	matrixSyncRegister: (sessionId: number) =>
		userServiceOrigin + `/service/matrix/sync/register/${sessionId}`,
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
	sendAliasMessage: userServiceOrigin + '/service/messages/aliasonly/new',
	sendMessage: userServiceOrigin + '/service/messages/new',
	sessionBase: userServiceOrigin + '/service/users/sessions',
	sessionRooms: userServiceOrigin + '/service/users/sessions/room',
	teamDiscussion: (sessionId: number) =>
		userServiceOrigin +
		`/service/users/sessions/${sessionId}/team-discussion`,
	setAbsence: userServiceOrigin + '/service/users/consultants/absences',
	tenantServiceBase: tenantServiceOrigin + '/service/tenant',
	dpaSignatureConfirm: (token: string) =>
		tenantServiceOrigin +
		`/service/tenant/public/dpa/confirm/${encodeURIComponent(token)}`,
	dpaSignaturePreview: (token: string) =>
		tenantServiceOrigin +
		`/service/tenant/public/dpa/confirm/${encodeURIComponent(token)}`,
	topicGroups: consultingTypeServiceOrigin + '/service/topic-groups',
	topicsData: consultingTypeServiceOrigin + '/service/topic/public',
	twoFactorAuth: userServiceOrigin + '/service/users/2fa',
	twoFactorAuthApp: userServiceOrigin + '/service/users/2fa/app',
	twoFactorAuthEmail: userServiceOrigin + '/service/users/2fa/email',
	updateMessage: userServiceOrigin + '/service/messages/',
	userData: userServiceOrigin + '/service/users/data',
	eventNotifications:
		userServiceOrigin + '/service/users/event-notifications',
	doNotDisturb:
		userServiceOrigin + '/service/users/notifications/do-not-disturb',
	userDataBySessionId: (sessionId: number) =>
		userServiceOrigin + `/service/users/consultants/sessions/${sessionId}`,
	userSessionsListView: '/sessions/user/view',
	serviceSettings: consultingTypeServiceOrigin + '/service/settings',
	frontend: {
		settings: '/p/api/settings'
	},
	setAppointmentSuccessMessage:
		userServiceOrigin + '/service/messages/aliasWithContent/new'
};
