import merge from 'lodash.merge';
import { generateAskerSession, generateConsultantSession } from '../sessions';
import { endpoints } from '../../../src/resources/scripts/endpoints';
import { setAskerSessions } from './helper/askerSessions';
import { setConsultantSessions } from './helper/consultantSessions';
import { config } from '../../../src/resources/scripts/config';
import usersConsultantsApi from './api/users/consultants';
import usersDataApi from './api/users/data';
import usersSessionsApi from './api/users/sessions';
import apiAgencies from './api/agencies';
import apiConsultingTypes from './api/consultTypes';
import loginCommand from './helper/login';
import fastLoginCommand from './helper/fastLogin';
import askerSessionsCommand from './helper/askerSessions';
import consultantSessionsCommand from './helper/consultantSessions';
import apiTopics from './api/topic';
import { ADDON_CONTRACT } from '../../../src/addons/addonTypes';

let overrides = {};

const defaultReturns = {
	'userData': {
		emailToggles: [
			{
				name: 'DAILY_ENQUIRY',
				state: true
			},
			{
				name: 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER',
				state: false
			}
		]
	},
	'agencies': [],
	'consultingTypes': [],
	'settings': {},
	'service.tenant.public': {},
	'releases': {
		statusCode: 404
	},
	'releases_markup': {
		statusCode: 404
	},
	'sessionRooms': {
		statusCode: 200,
		body: {
			sessions: []
		}
	},
	'frontend.settings': config,
	'agencyConsultants': [],
	'agencyConsultantsLanguages': ['de'],
	'userDrafts': {
		items: [],
		page: 0,
		perPage: 200
	},
	'eventNotifications': {
		items: [],
		unreadCount: 0,
		page: 0,
		perPage: 50
	}
};

const setWillReturn = (name: string, data: any, mergeData: boolean = false) => {
	if (mergeData) {
		overrides[name] = merge(
			Array.isArray(overrides[name] || defaultReturns[name]) ? [] : {},
			overrides[name] || defaultReturns[name] || {},
			data || {}
		);
		return;
	}

	overrides[name] = data;
};

Cypress.Commands.add(
	'willReturn',
	(name: string, data?: any, mergeData: boolean = false) =>
		data === undefined
			? getWillReturn(name)
			: setWillReturn(name, data, mergeData)
);

const getWillReturn = (name: string) => {
	return overrides[name] || defaultReturns[name] || null;
};

loginCommand(getWillReturn, setWillReturn);
fastLoginCommand(getWillReturn, setWillReturn);
consultantSessionsCommand(getWillReturn, setWillReturn);
askerSessionsCommand(getWillReturn, setWillReturn);

// Services the app shell calls on every authenticated page. Without a stub the
// local dev proxy answers 500 and the app leaves for /error.500.html, so every
// spec that did not stub them failed (FE#2572). Registered first, so a spec's
// own intercept for the same path wins.
const mockAppShellDefaults = () => {
	cy.intercept('GET', '**/service/addons/registry*', {
		contract: ADDON_CONTRACT,
		addons: []
	});
	cy.intercept('GET', '**/service/addons/calendar*', { entries: [] });
	cy.intercept('GET', '**/service/users/calendar/proposals*', {
		sent: [],
		received: []
	});
	cy.intercept('GET', '**/service/users/directlinks*', []);
	cy.intercept('GET', '**/service/users/chat-series/join-requests*', []);
	// Background reads of a consultant chat. Unstubbed, the dev proxy forwards
	// them to itself and on Linux CI they hang. Chrome opens at most six
	// connections per host, so a handful of hanging reads queued every later
	// request: the case-handover form never loaded in sessions.cy.ts.
	cy.intercept('GET', '**/service/users/call-knocks*', []);
	cy.intercept(
		'GET',
		'**/service/users/sessions/consultants/deleted-askers*',
		[]
	);
	cy.intercept('GET', '**/service/users/appointments/upcoming*', []);
	cy.intercept('GET', '**/service/users/sessions/*/supervisors', []);
	cy.intercept('GET', '**/service/users/sessions/*/appointments', []);
	cy.intercept('PATCH', '**/service/users/event-notifications/active-view*', {
		statusCode: 204
	});
	cy.intercept('POST', '**/service/matrix/sync/register/*', {
		statusCode: 204
	});
	cy.intercept('GET', '**/service/conversations/consultants/availability*', {
		available: false
	});
	cy.intercept('GET', '**/service/users/statistics/consultant*', (req) => {
		const url = new URL(req.url);
		req.reply({
			startDate: url.searchParams.get('startDate'),
			endDate: url.searchParams.get('endDate'),
			numberOfAssignedSessions: 0,
			numberOfActiveSessions: 0,
			numberOfSentMessages: 0,
			breakdown: []
		});
	});
	cy.intercept('POST', '**/service/error-reports*', { statusCode: 204 });
	// Case handover (#2447 era): own sessions are not under a handover, so the
	// list must not render them as locked.
	cy.intercept('GET', '**/service/users/case-handover/candidates*', {
		sessions: [],
		offset: 0,
		count: 0,
		total: 0
	});
	cy.intercept('GET', '**/service/users/sessions/*/case-handover', (req) => {
		const sessionId = Number(
			new URL(req.url).pathname.split('/').slice(-2, -1)[0]
		);
		req.reply({
			sessionId,
			status: 'NOT_REQUESTED',
			canViewContent: true,
			ownershipRevision: 1
		});
	});
	// The app boots without its Matrix conversation service.
	cy.intercept('GET', '**/service/matrix/me/token*', { statusCode: 503 });
};

Cypress.Commands.add('mockApi', () => {
	// Empty overrides
	overrides = {};

	mockAppShellDefaults();

	// Generate 1 default sessions
	setAskerSessions([]);
	cy.askerSession(generateAskerSession());

	// Generate 3 default sessions
	setConsultantSessions([]);
	cy.consultantSession(generateConsultantSession());
	cy.consultantSession(generateConsultantSession());
	cy.consultantSession(generateConsultantSession());

	// ConsultingTypes
	cy.fixture('service.consultingtypes.emigration.json').then(
		(consultingType) => {
			overrides['consultingTypes'] = [
				...(overrides['consultingTypes'] || []),
				consultingType
			];
		}
	);
	cy.fixture('service.consultingtypes.addiction.json').then(
		(consultingType) => {
			overrides['consultingTypes'] = [
				...(overrides['consultingTypes'] || []),
				consultingType
			];
		}
	);
	cy.fixture('service.consultingtypes.pregnancy.json').then(
		(consultingType) => {
			overrides['consultingTypes'] = [
				...(overrides['consultingTypes'] || []),
				consultingType
			];
		}
	);
	cy.fixture('service.consultingtypes.u25.json').then((consultingType) => {
		overrides['consultingTypes'] = [
			...(overrides['consultingTypes'] || []),
			consultingType
		];
	});

	cy.fixture('service.users.sessions.room.json').then((session) => {
		// Copy instead of pushing into defaultReturns: the push leaked one
		// more fixture session into every following test of a spec.
		overrides['sessionRooms'] = {
			...defaultReturns['sessionRooms'],
			body: { sessions: [session] }
		};
	});

	cy.fixture('service.agency.consultants.json').then((agencyConsultants) => {
		overrides['agencyConsultants'] = agencyConsultants;
	});

	cy.fixture('auth.token').then((auth) => {
		overrides['auth'] = auth;
	});

	cy.intercept('GET', `${endpoints.consultantEnquiriesBase}*`, {}).as(
		'consultantEnquiriesBase'
	);

	cy.intercept('GET', `${endpoints.userDrafts}*`, (req) => {
		req.reply(getWillReturn('userDrafts'));
	}).as('userDrafts');

	cy.intercept('GET', `${endpoints.eventNotifications}*`, (req) => {
		req.reply(getWillReturn('eventNotifications'));
	}).as('eventNotifications');

	cy.intercept('PATCH', `${endpoints.eventNotifications}/**`, {
		statusCode: 204
	}).as('eventNotificationsPatch');

	cy.intercept('DELETE', endpoints.eventNotifications, {
		statusCode: 204
	}).as('eventNotificationsDelete');

	cy.intercept('POST', endpoints.keycloakLogout, {}).as('authLogout');

	cy.intercept('GET', endpoints.frontend.settings, (req) =>
		req.reply(JSON.stringify(getWillReturn('frontend.settings')))
	);

	cy.intercept('POST', endpoints.keycloakLogout, {
		statusCode: 204
	}).as('authLogout');

	cy.intercept(
		`${endpoints.liveservice}/**/*`,
		JSON.stringify({
			entropy: '-1197552011',
			origins: ['*:*'],
			cookie_needed: false,
			websocket: true
		})
	).as('liveService');

	cy.intercept('POST', endpoints.keycloakAccessToken, (req) => {
		req.reply(getWillReturn('auth'));
	}).as('authToken');

	cy.intercept('GET', `${endpoints.serviceSettings}`, (req) => {
		req.reply(JSON.stringify(getWillReturn('settings')));
	}).as('settings');

	cy.intercept('GET', `${endpoints.tenantServiceBase}/public/`, (req) => {
		req.reply(JSON.stringify(getWillReturn('service.tenant.public')));
	}).as('service.tenant.public');

	cy.intercept('GET', '/releases/*.json**', (req) => {
		req.reply(getWillReturn('releases'));
	}).as('releases');

	cy.intercept('GET', '/releases/*.md**', (req) => {
		req.reply(getWillReturn('releases_markup'));
	}).as('releases_markup');

	usersConsultantsApi(cy, getWillReturn, setWillReturn);
	usersDataApi(cy, getWillReturn, setWillReturn);
	usersSessionsApi(cy, getWillReturn, setWillReturn);
	apiAgencies(cy, getWillReturn, setWillReturn);
	apiConsultingTypes(cy, getWillReturn, setWillReturn);
	apiTopics(cy, getWillReturn, setWillReturn);
});

export const USER_ASKER = 'asker';
export const USER_CONSULTANT = 'consultant';

export interface LoginArgs {
	userId?: typeof USER_ASKER | typeof USER_CONSULTANT;
	auth?: { expires_in: number; refresh_expires_in: number };
	/** Set when `cy.clock()` is installed: tick the app's timers while logging in. */
	tickTimers?: boolean;
}
