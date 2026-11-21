import { ADDON_CONTRACT } from '../../src/addons/addonTypes';

export function mockConsultantShell() {
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
	cy.intercept('GET', '**/service/conversations/consultants/availability*', {
		available: false
	});
	cy.intercept('GET', '**/conversations/consultants/enquiries/registered*', {
		sessions: [],
		total: 0
	}).as('consultantEnquiriesBase');
	cy.intercept('GET', '**/conversations/consultants/enquiries/anonymous*', {
		sessions: [],
		total: 0
	});

	cy.intercept('GET', '**/service/matrix/me/token*', {
		accessToken: 'test-only',
		userId: '@consultant:matrix.test',
		deviceId: 'TEST_CONSULTANT_SHELL'
	});
	cy.intercept('POST', '**/service/matrix/sync/register/*', {
		statusCode: 204
	});
	cy.intercept('https://matrix.test/_matrix/**', (request) => {
		const path = new URL(request.url).pathname;

		if (path.endsWith('/sync')) {
			request.reply({
				delay: 250,
				body: { next_batch: 'batch', rooms: { join: {} } }
			});
		} else if (path.endsWith('/versions')) {
			request.reply({ versions: ['v1.11'], unstable_features: {} });
		} else if (path.endsWith('/filter')) {
			request.reply({ filter_id: 'test-filter' });
		} else {
			request.reply({});
		}
	});
}
