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

	it('filters unread sessions, drafts, internal group chats, and conversation circles', () => {
		cy.consultantSession({
			session: {
				id: 9876,
				messagesRead: false
			}
		});
		cy.consultantSession({
			chat: {
				id: 4101,
				groupId: 'internal-group-room',
				topic: 'Interner Gruppenchat',
				hintMessage: 'internal group metadata only',
				lastMessage: 'encrypted body must not be required',
				messagesRead: true,
				repetitive: false,
				active: true,
				subscribed: true,
				moderators: [USER_CONSULTANT],
				assignedAgencies: [],
				consultingType: 0,
				duration: 0,
				attachment: null,
				e2eLastMessage: {
					t: '1606900241',
					msg: 'encrypted body must stay hidden'
				},
				messageDate: 1606900241,
				startDate: '2026-06-24',
				startTime: '12:00',
				createdAt: '2026-06-24T12:00:00.000Z'
			}
		});
		cy.consultantSession({
			chat: {
				id: 4102,
				groupId: 'conversation-circle-room',
				topic: 'Gesprächskreis',
				hintMessage: 'circle metadata only',
				lastMessage: 'encrypted group body must not be required',
				messagesRead: true,
				repetitive: true,
				active: true,
				subscribed: true,
				moderators: [USER_CONSULTANT],
				assignedAgencies: [],
				consultingType: 0,
				duration: 0,
				attachment: null,
				e2eLastMessage: {
					t: '1606900242',
					msg: 'encrypted group body must stay hidden'
				},
				messageDate: 1606900242,
				startDate: '2026-06-24',
				startTime: '12:05',
				createdAt: '2026-06-24T12:05:00.000Z'
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

		cy.get('[data-cy=sessions-list-search]').clear();
		cy.get('[data-cy=sessions-list-search]').type('Interner Gruppenchat');
		cy.get('.sessionsListItem')
			.should('have.length', 1)
			.and('contain.text', 'Interner Gruppenchat');

		cy.get('[data-cy=sessions-list-search]').clear();
		cy.get('[data-cy=sessions-list-search]').type(
			'encrypted body must stay hidden'
		);
		cy.get('.sessionsListItem').should('not.exist');
		cy.get('[data-cy=sessions-list-search]').clear();
		cy.get('body').click(0, 0);
		cy.get('[data-cy=sessions-list-chips]').should('be.visible');

		cy.get('[data-cy=sessions-list-chips] [data-cy]').then(($chips) => {
			const chipOrder = [...$chips].map((chip) =>
				chip.getAttribute('data-cy')
			);

			expect(chipOrder).to.include('sessions-list-chip-internal-group');
			expect(chipOrder.indexOf('sessions-list-chip-archive')).to.be.lessThan(
				chipOrder.indexOf('sessions-list-chip-internal-group')
			);
			expect(
				chipOrder.indexOf('sessions-list-chip-internal-group')
			).to.be.lessThan(chipOrder.indexOf('sessions-list-chip-groups'));
			if (chipOrder.includes('sessions-list-chip-supervision')) {
				expect(
					chipOrder.indexOf('sessions-list-chip-internal-group')
				).to.be.lessThan(
					chipOrder.indexOf('sessions-list-chip-supervision')
				);
				expect(
					chipOrder.indexOf('sessions-list-chip-supervision')
				).to.be.lessThan(
					chipOrder.indexOf('sessions-list-chip-groups')
				);
			}
		});

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

		cy.get('[data-cy=sessions-list-chip-internal-group]').click();
		cy.location('search').should('contain', 'chip=internalGroup');
		cy.get('.sessionsListItem').should('have.length', 1);
		cy.get('.sessionsListItem')
			.should('contain.text', 'Interner Gruppenchat')
			.and('not.contain.text', 'encrypted body must stay hidden');

		cy.get('[data-cy=sessions-list-chip-groups]').click();
		cy.location('search').should('contain', 'chip=groups');
		cy.get('.sessionsListItem').should('have.length', 1);
		cy.get('.sessionsListItem')
			.should('contain.text', 'Gesprächskreis')
			.and('not.contain.text', 'encrypted group body must stay hidden');
	});
});
