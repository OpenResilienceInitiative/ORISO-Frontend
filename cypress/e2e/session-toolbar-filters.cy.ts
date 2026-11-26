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
		cy.viewport(1455, 860);
		mockWebSocket();
		// The Träger offers both group formats (tenant service flags) and the
		// counsellor's agency answers without its own policy; otherwise the
		// group chips are shown locked (formatAvailability.ts) and cannot filter.
		cy.fixture('service.settings.json').then((settings) =>
			cy.willReturn('settings', {
				...settings,
				useTenantService: { value: true, readOnly: false }
			})
		);
		cy.intercept('GET', '**/service/tenant/public/**', {
			id: 1,
			name: 'Träger',
			settings: {
				featureGroupChatV2Enabled: true,
				featureInternalGroupChatEnabled: true,
				featureSelfHelpGroupsEnabled: true
			}
		});
		cy.fixture('service.agencies.json').then((agencies) =>
			cy.willReturn(
				'agencies',
				agencies.map((agency) => ({ ...agency, tenantId: null }))
			)
		);
	});

	it('filters internal group chats, supervision, and conversation circles', () => {
		cy.consultantSession({
			session: {
				id: 9876,
				messagesRead: false
			}
		});
		// #2494: the Supervision chip only shows when the list holds a case to
		// supervise; a read case owned by a colleague is one (legacy rule).
		cy.consultantSession({
			session: {
				id: 5555,
				messagesRead: true
			},
			consultant: {
				id: 'colleague',
				firstName: 'Kim',
				lastName: 'Kollegin',
				username: 'colleague'
			}
		});
		cy.consultantSession({
			// Group chat rows carry no 1:1 session.
			session: null,
			chat: {
				id: 4101,
				groupId: '!internal-group-room:example.org',
				// Chats are Matrix rooms; previews never come from the DTO text.
				matrixRoomId: '!internal-group-room:example.org',
				topic: 'Interner Gruppenchat',
				hintMessage: 'internal group metadata only',
				lastMessage: 'matrix clear body must stay hidden',
				messagesRead: false,
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
			// Group chat rows carry no 1:1 session.
			session: null,
			chat: {
				id: 4102,
				groupId: 'conversation-circle-room',
				matrixRoomId: '!conversation-circle-room:example.org',
				topic: 'Gesprächskreis',
				hintMessage: 'circle metadata only',
				lastMessage: 'encrypted group body must not be required',
				messagesRead: false,
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
		cy.fastLogin({
			userId: USER_CONSULTANT
		});

		cy.get('a[href="/sessions/consultant/sessionView"]').click();
		cy.wait('@consultantSessions');

		cy.get('[data-cy=sessions-list-search]').clear();
		cy.get('[data-cy=sessions-list-search]').type('Interner Gruppenchat');
		cy.get('.sessionsListItem')
			.should('have.length', 1)
			.and('contain.text', 'Interner Gruppenchat');

		cy.get('[data-cy=sessions-list-search]').clear();
		cy.get('[data-cy=sessions-list-search]').type(
			'encrypted body must stay hidden'
		);
		cy.get('.sessionsListToolbar__searchEmpty').should('be.visible');
		cy.get('[data-cy=sessions-list-search]').clear();
		cy.get('body').click(0, 0);
		cy.get('[data-cy=sessions-list-chips]').should('be.visible');
		cy.get('[data-cy=sessions-list-chip-internal-group]').should('exist');
		cy.get('[data-cy=sessions-list-chip-internal-group]').scrollIntoView();
		cy.get('[data-cy=sessions-list-chip-supervision]').should('exist');
		cy.get('[data-cy=sessions-list-chip-groups]').should('exist');
		cy.get('[data-cy=sessions-list-chip-groups]').scrollIntoView();
		cy.get('[data-cy=sessions-list-chips]').should(($chipsScroll) => {
			const scrollStyle = getComputedStyle($chipsScroll[0]);
			expect(scrollStyle.scrollbarWidth).to.equal('none');
			expect(scrollStyle.overflowX).to.equal('auto');
		});
		cy.get('[data-cy=sessions-list-chip-internal-group]').should(
			($chip) => {
				const chipStyle = getComputedStyle($chip[0]);
				expect(chipStyle.transitionProperty).to.include(
					'background-color'
				);
				expect(chipStyle.transitionProperty).to.include('max-width');
				const longestDuration = Math.max(
					...chipStyle.transitionDuration
						.split(',')
						.map((duration) => parseFloat(duration))
				);
				expect(longestDuration).to.be.greaterThan(0.38);
			}
		);
		cy.get(
			'[data-cy=sessions-list-chip-internal-group] .sessionsListToolbar__chipLabel'
		).should(($label) => {
			expect(getComputedStyle($label[0]).transitionProperty).to.include(
				'max-width'
			);
		});

		cy.get('[data-cy=sessions-list-chips] [data-cy]').then(($chips) => {
			const chipOrder = [...$chips].map((chip) =>
				chip.getAttribute('data-cy')
			);

			expect(chipOrder).to.include('sessions-list-chip-internal-group');
			expect(
				chipOrder.indexOf('sessions-list-chip-archive')
			).to.be.lessThan(
				chipOrder.indexOf('sessions-list-chip-internal-group')
			);
			expect(
				chipOrder.indexOf('sessions-list-chip-internal-group')
			).to.be.lessThan(
				chipOrder.indexOf('sessions-list-chip-supervision')
			);
			expect(
				chipOrder.indexOf('sessions-list-chip-supervision')
			).to.be.lessThan(chipOrder.indexOf('sessions-list-chip-groups'));
		});

		// The chip row scrolls sideways under a chevron; bring the chip in.
		cy.get('[data-cy=sessions-list-chip-nearby]').scrollIntoView();
		cy.get('[data-cy=sessions-list-chip-nearby]').click();
		cy.location('search').should('contain', 'chip=nearby');
		cy.get('.sessionsListItem').its('length').should('be.greaterThan', 1);

		cy.get('[data-cy=sessions-list-chip-internal-group]').scrollIntoView();
		cy.get('[data-cy=sessions-list-chip-internal-group]').click();
		cy.location('search').should('contain', 'chip=internalGroup');
		cy.get('.sessionsListItem').should('have.length', 1);
		cy.get('.sessionsListItem')
			.should('contain.text', 'Interner Gruppenchat')
			.and('contain.text', 'Nachricht verschlüsselt')
			.and('not.contain.text', 'matrix clear body must stay hidden')
			.and('not.contain.text', 'encrypted body must stay hidden');

		cy.get('[data-cy=sessions-list-chip-groups]').scrollIntoView();
		cy.get('[data-cy=sessions-list-chip-groups]').click();
		cy.location('search').should('contain', 'chip=groups');
		cy.get('.sessionsListItem').should('have.length', 1);
		cy.get('.sessionsListItem')
			.should('contain.text', 'Gesprächskreis')
			.and('not.contain.text', 'encrypted group body must stay hidden');
	});

	// Decision pending in #2572. Unread state comes only from the Matrix
	// client since #1147 (src/utils/sessionUnread.ts; the DTO's messagesRead
	// is always true). The Cypress harness runs without Matrix, so every row
	// reads as read. Covered by Vitest in sessionUnread.test.ts; a
	// real-browser check needs Playwright against Dev.
	it.skip('counts and filters unread sessions with the unread chip', () => {
		cy.fastLogin({
			userId: USER_CONSULTANT
		});

		cy.get('a[href="/sessions/consultant/sessionView"]').click();
		cy.wait('@consultantSessions');

		cy.get('[data-cy=sessions-list-chip-unread]')
			.should(($chip) => {
				expect($chip.text()).to.contain('3');
			})
			.click();
		cy.location('search').should('contain', 'chip=unread');
		cy.get('.sessionsListItem').should('have.length', 3);
		cy.get('.sessionsListItem')
			.should('contain.text', 'Interner Gruppenchat')
			.and('contain.text', 'Gesprächskreis')
			.and('contain.text', 'Nachricht verschlüsselt')
			.and('not.contain.text', 'matrix clear body must stay hidden')
			.and('not.contain.text', 'encrypted group body must stay hidden');
	});

	// Decision pending in #2572. Drafts are end-to-end encrypted now: inside
	// the Cypress runner the app lives in an iframe, where draft keys only
	// come from the parent ORISO window (draftCryptographyWindow.ts), so the
	// draft feed is never requested here. Covered by Vitest in
	// apiUserDrafts.test.ts and SessionsListToolbar.test.tsx; a real-browser
	// check needs Playwright against Dev.
	it.skip('lists unassigned drafts under the drafts chip without their text', () => {
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

		cy.get('a[href="/sessions/consultant/sessionView"]').click();
		cy.wait('@userDrafts');

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
	});
});
