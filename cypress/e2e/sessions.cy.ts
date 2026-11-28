import {
	closeWebSocketServer,
	startWebSocketServer,
	mockWebSocket
} from '../support/websocket';
import {
	generateMultipleAskerSessions,
	generateMultipleConsultantSessions
} from '../support/sessions';
import {
	MAX_ITEMS_TO_SHOW_WELCOME_ILLUSTRATION,
	SCROLL_PAGINATE_THRESHOLD
} from '../../src/components/sessionsList/sessionsListConfig';
import { USER_CONSULTANT } from '../support/commands/mockApi';

describe('Sessions', () => {
	before(() => {
		startWebSocketServer();
	});

	after(() => {
		closeWebSocketServer();
	});

	beforeEach(() => {
		mockWebSocket();
	});

	describe('Consultant', () => {
		// #1673: an active case is no longer reassigned through the assign
		// select; the owner offers it to a colleague via "Beratung weitergeben".
		it('should show confirmation forwarding the session', () => {
			generateMultipleConsultantSessions(5);
			// Keep unrelated shell polling off the missing local API proxy while
			// the case header and its handover dialog settle.
			cy.intercept('GET', '**/sessions/consultants/deleted-askers*', []);
			cy.intercept('GET', '**/call-knocks*', []);
			cy.intercept('GET', '**/appointments/upcoming*', []);
			cy.intercept('GET', '**/sessions/*/supervisors*', []);
			cy.intercept('GET', '**/sessions/*/appointments*', []);
			cy.intercept('GET', '**/case-handover/recipients', [
				{ consultantId: 'colleague-1', displayName: 'Kim Kollegin' }
			]).as('handoverRecipients');
			cy.intercept('GET', '**/case-handover/reasons', [
				{
					code: 'PLANNED_ABSENCE',
					label: 'Planned absence',
					clientConsentRequired: false
				}
			]).as('handoverReasons');
			cy.intercept('POST', '**/case-handover/offers', (req) =>
				req.reply({
					requestId: 1,
					sessionId: Number(req.url.split('/').slice(-3, -2)[0]),
					status: 'PENDING_RECIPIENT_ACCEPTANCE',
					direction: 'PUSH',
					canViewContent: true,
					recipientConsultantId: 'colleague-1'
				})
			).as('handoverOffer');

			cy.fastLogin({
				userId: USER_CONSULTANT
			});

			cy.get('a[href="/sessions/consultant/sessionView"]').click();
			cy.get('.sessionsListItem').should('exist');
			cy.wait('@consultantSessions');

			// Open the case only once the list has settled: a list that is still
			// loading re-renders the session header, and an offer dialog opened in
			// that moment never loads its form.
			cy.get('.sessionsListItem.skeleton').should('not.exist');
			cy.get('[data-cy=session-list-item]').first().click();
			cy.wait('@sessionRoomById');
			cy.get('.sessionsListItem.skeleton').should('not.exist');

			cy.get('#iconH').click();
			cy.get('#flyout').should('be.visible');
			cy.get('[data-cy=session-menu-group-handover]').click();
			cy.get('[data-cy=session-menu-case-handover]').click();
			cy.wait(['@handoverRecipients', '@handoverReasons']);
			cy.get('[data-testid=supervisor-dialog-person]').should(
				'be.visible'
			);

			cy.get('[data-testid=supervisor-dialog-person]').click();
			cy.contains('[role=option]', 'Kim Kollegin').click();
			cy.get('[data-testid=supervisor-dialog-reason]').click();
			cy.contains('[role=option]', 'Geplant abwesend').click();
			cy.get('[data-testid=supervisor-dialog-confirm]').click();

			cy.wait('@handoverOffer').its('request.body').should('include', {
				targetConsultantId: 'colleague-1',
				reasonCode: 'PLANNED_ABSENCE'
			});
			cy.contains(
				'[data-testid=case-handover-state-dialog] [role=status]',
				'Warten auf die ausgewählte Kolleg:in.'
			).should('be.visible');
		});

		it('should list my sessions', () => {
			generateMultipleConsultantSessions(3);

			cy.fastLogin({
				userId: USER_CONSULTANT
			});

			cy.get('a[href="/sessions/consultant/sessionView"]').click();
			cy.get('.sessionsListItem').should('have.length', 6);
		});

		it('should fetch next batch of sessions if scroll threshold is reached', () => {
			generateMultipleConsultantSessions(100);

			cy.fastLogin({
				userId: USER_CONSULTANT
			});

			cy.get('a[href="/sessions/consultant/sessionView"]').click();
			cy.wait('@consultantSessions');

			cy.get('.sessionsListItem').should('have.length', 15);

			cy.get('.sessionsList__scrollContainer').then(
				([scrollContainer]) => {
					const scrollPosition =
						Math.ceil(scrollContainer.scrollTop) +
						scrollContainer.offsetHeight;
					const scrollable =
						scrollContainer.scrollHeight - scrollPosition;
					cy.get('.sessionsList__scrollContainer').scrollTo(
						0,
						scrollable - SCROLL_PAGINATE_THRESHOLD
					);
				}
			);
			cy.wait('@consultantSessions');
		});

		// The stage v3 review removed drag-to-scroll from the list handle
		// (ResizableHandle.tsx header); Up/Down on the focused handle still
		// scrolls the list, so that is what this covers now.
		it('should scroll sessions list with the arrow keys on the handle', () => {
			generateMultipleConsultantSessions(100);

			cy.fastLogin({
				userId: USER_CONSULTANT
			});

			cy.get('a[href="/sessions/consultant/sessionView"]').click();
			cy.wait('@consultantSessions');
			cy.get('.sessionsListItem.skeleton').should('not.exist');

			cy.get('.sessionsList__scrollContainer').then(
				([scrollContainer]) => {
					const startTop = scrollContainer.scrollTop;

					cy.get('.sessionsList__resizeHandle')
						.first()
						.focus()
						.trigger('keydown', { key: 'ArrowDown' });

					cy.get('.sessionsList__scrollContainer').should(($sc) => {
						expect($sc[0].scrollTop).to.be.greaterThan(startTop);
					});
				}
			);
		});

		it('should not fetch next batch of sessions if scroll threshold is not reached', () => {
			generateMultipleConsultantSessions(100);

			cy.fastLogin({
				userId: USER_CONSULTANT
			});

			cy.get('a[href="/sessions/consultant/sessionView"]').click();
			cy.get('.sessionsListItem').should('exist');
			cy.wait('@consultantSessions');

			cy.get('.sessionsListItem').should('have.length', 15);

			cy.get('.sessionsList__scrollContainer').then(
				([scrollContainer]) => {
					const scrollPosition =
						Math.ceil(scrollContainer.scrollTop) +
						scrollContainer.offsetHeight;

					const scrollable =
						scrollContainer.scrollHeight - scrollPosition;

					cy.get('.sessionsList__scrollContainer').scrollTo(
						0,
						scrollable - SCROLL_PAGINATE_THRESHOLD - 1
					);
				}
			);

			cy.get('.skeleton__item').should('not.exist');
		});

		describe('Access Token expires while logged in', () => {
			it('should logout if trying to paginate sessions', () => {
				generateMultipleConsultantSessions(16);

				cy.fastLogin({
					userId: USER_CONSULTANT
				});

				cy.get('a[href="/sessions/consultant/sessionView"]').click();
				// The first page loads fine. The list may ask more than once while
				// it settles, and an aborted request has no response, so check that
				// one of them succeeded rather than the first one.
				cy.wait('@consultantSessions');
				cy.get('.sessionsListItem.skeleton').should('not.exist');
				cy.get('@consultantSessions.all').should((calls) => {
					expect(
						(
							calls as unknown as {
								response?: { statusCode: number };
							}[]
						).map((call) => call.response?.statusCode)
					).to.include(200);
				});
				cy.get('.sessionsListItem').should('exist');

				cy.willReturn('consultantSessions', {
					statusCode: 401
				});

				cy.get('.sessionsList__scrollContainer').scrollTo('bottom');
				cy.wait('@consultantSessions');
				cy.get('.loginForm').should('exist');
			});
		});
	});

	describe('Asker', () => {
		it('should list my sessions', () => {
			generateMultipleAskerSessions(3);
			cy.fastLogin();

			cy.get('.sessionsListItem').should('have.length', 4);
		});

		// Decision pending in #2572: the asker list header was removed on
		// purpose in 6b3e53609 (search toolbar). Retire or restore the test.
		it.skip('should show a header with headline', () => {
			cy.fastLogin();
			cy.get('[data-cy=session-list-header]').should('exist');
			cy.get('[data-cy=session-list-headline]').contains(
				'Meine Beratungen'
			);
		});

		// Decision pending in #2572: <WelcomeIllustration> is no longer
		// rendered since the legacy chat backend was removed (ef12120fb). Restore the
		// illustration or retire these tests.
		describe.skip('welcome illustration', () => {
			it('should show until given session item limit is reached', () => {
				// MAX_ITEMS_TO_SHOW_WELCOME_ILLUSTRATION minus 1 because on session is already added
				generateMultipleAskerSessions(
					MAX_ITEMS_TO_SHOW_WELCOME_ILLUSTRATION - 1
				);
				cy.fastLogin();

				cy.get('[data-cy=session-list-welcome-illustration]').should(
					'exist'
				);
			});

			it('should not show when given session item limit is reached', () => {
				generateMultipleAskerSessions(
					MAX_ITEMS_TO_SHOW_WELCOME_ILLUSTRATION
				);
				cy.fastLogin();

				cy.get('[data-cy=session-list-welcome-illustration]').should(
					'not.exist'
				);
			});
		});
	});
});
