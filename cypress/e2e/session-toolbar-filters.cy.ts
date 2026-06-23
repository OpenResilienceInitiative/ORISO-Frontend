import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';
import { USER_CONSULTANT } from '../support/commands/mockApi';

describe('Session toolbar filters', () => {
	before(() => {
		startWebSocketServer();
	});

	after(() => {
		closeWebSocketServer();
	});

	beforeEach(() => {
		mockWebSocket();
	});

	it('filters unread sessions and shows drafts inside Gespräche instead of the sidebar', () => {
			cy.consultantSession({
				session: {
					id: 9876,
					messagesRead: false
				}
			});
			cy.willReturn('userDrafts', {
				items: [
					{
						scopeKey: 'scope:9876|thread:main',
						text: 'matched encrypted draft body must stay hidden',
						actionPath: '/sessions/consultant/sessionView/session/9876',
						title: 'Zugeordneter Entwurf',
						sourceSessionId: 9876,
						roomRef: null,
						threadRootId: null,
						updatedAt: '2026-06-24T12:01:00.000Z'
					},
					{
						scopeKey: 'u:consultant|scope:orphan-draft|thread:main',
						text: 'this encrypted draft body must stay hidden',
					actionPath: '/sessions/consultant/sessionView/session/9999',
					title: 'Nicht zugeordneter Entwurf',
					sourceSessionId: null,
					roomRef: null,
					threadRootId: null,
					updatedAt: '2026-06-24T12:00:00.000Z'
				}
			],
			page: 0,
			perPage: 200
		});

		cy.fastLogin({
			userId: USER_CONSULTANT
		});

		cy.get('a[href="/drafts"]').should('not.exist');
		cy.get('a[href="/sessions/consultant/sessionView"]').click();
		cy.wait('@consultantSessions');
		cy.wait('@userDrafts');

		cy.get('[data-cy=sessions-list-chip-unread]')
			.should(($chip) => {
				expect($chip.text()).to.match(/[1-9]/);
			})
			.click();
		cy.location('search').should('contain', 'chip=unread');
		cy.get('.sessionsListItem')
			.its('length')
			.should('be.greaterThan', 0);

			cy.get('[data-cy=sessions-list-chip-drafts]')
				.should('contain.text', '2')
				.click();
			cy.location('search').should('contain', 'chip=drafts');
			cy.get('.sessionsListItem').should('have.length', 1);
			cy.get('[data-cy=sessions-list-draft-item]')
				.should('be.visible')
				.and('contain.text', 'Nicht zugeordneter Entwurf')
				.and('not.contain.text', 'this encrypted draft body')
				.and('not.contain.text', 'matched encrypted draft body');

		cy.get('[data-cy=sessions-list-chip-nearby]').click();
		cy.location('search').should('contain', 'chip=nearby');
		cy.get('.sessionsListItem')
			.its('length')
			.should('be.greaterThan', 1);
	});
});
