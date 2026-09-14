/**
 * Actual enquiry screen with HTTP fixtures for UserService and Matrix.
 * Uses the existing LiveService websocket test helper. This verifies browser
 * interaction and rendering, not encryption or access with real accounts.
 * Run with npm run test:enquiry-team, also used by PR CI.
 * The bundled Electron 114 lacks Promise.withResolvers
 * required by the Matrix SDK send scheduler.
 */
import {
	startWebSocketServer,
	closeWebSocketServer,
	mockWebSocket
} from '../support/websocket';
import { USER_CONSULTANT } from '../support/commands/mockApi';
import { generateConsultantSession } from '../support/sessions';
import { SESSION_LIST_TYPES } from '../../src/components/session/sessionHelpers';

const roomId = '!enquiry-1375:matrix.test';
const teamRoomId = '!team-1375:matrix.test';
const text =
	'Meine Anfrage: ' +
	'Ich möchte meine Situation ausführlich erklären. '.repeat(24) +
	'ENDE DER ORIGINALANFRAGE';
const member = (id: string) => ({
	type: 'm.room.member',
	state_key: id,
	sender: id,
	event_id: `$member-${id}`,
	origin_server_ts: 1,
	content: {
		membership: 'join',
		displayname: id.includes('asker') ? 'Ratsuchende' : 'Beraterin'
	}
});
const syncRoom = (id: string, original: boolean) => ({
	state: {
		events: [
			member('@consultant:matrix.test'),
			...(original ? [member('@asker:matrix.test')] : []),
			{
				type: 'm.room.create',
				state_key: '',
				event_id: '$create',
				sender: '@consultant:matrix.test',
				content: {
					creator: '@consultant:matrix.test',
					room_version: '10'
				}
			}
		]
	},
	timeline: {
		events: original
			? [
					{
						type: 'm.room.message',
						sender: '@asker:matrix.test',
						event_id: '$original',
						room_id: id,
						origin_server_ts: Date.now(),
						content: { msgtype: 'm.text', body: text }
					}
				]
			: [],
		limited: false,
		prev_batch: 'history'
	},
	ephemeral: { events: [] },
	account_data: { events: [] },
	unread_notifications: {}
});

describe('Enquiry team panel — actual app with local service fixtures', () => {
	before(() => startWebSocketServer());
	after(() => closeWebSocketServer());
	beforeEach(() => mockWebSocket());
	it('shows the complete original enquiry beside its automatic team panel', () => {
		const width = Number(Cypress.env('enquiryViewportWidth') || 1440);
		const height = Number(Cypress.env('enquiryViewportHeight') || 1000);
		cy.viewport(width, height);
		cy.intercept('**/service/conversations/consultants/availability*', {
			available: false
		});
		cy.intercept('POST', '**/service/matrix/sync/register/*', {
			statusCode: 204
		});
		cy.intercept('GET', '**/service/users/drafts/single*', {
			statusCode: 204
		});
		cy.intercept('**/service/matrix/me/token*', {
			accessToken: 'test-only',
			userId: '@consultant:matrix.test',
			deviceId: 'TEST1375'
		});
		cy.intercept('https://matrix.test/_matrix/**', (req) => {
			if (req.url.includes('/sync')) {
				req.reply({
					delay: 250,
					body: {
						next_batch: 'batch',
						rooms: {
							join: {
								[roomId]: syncRoom(roomId, true),
								[teamRoomId]: syncRoom(teamRoomId, false)
							}
						},
						account_data: { events: [] },
						to_device: { events: [] },
						device_lists: { changed: [], left: [] },
						device_one_time_keys_count: { signed_curve25519: 50 }
					}
				});
			} else if (req.url.includes('/pushrules'))
				req.reply({
					global: {
						override: [],
						content: [],
						room: [],
						sender: [],
						underride: []
					}
				});
			else if (req.url.includes('/filter'))
				req.reply({ filter_id: 'test-filter' });
			else if (req.url.includes('/versions'))
				req.reply({ versions: ['v1.11'], unstable_features: {} });
			else if (req.url.includes('/keys/upload'))
				req.reply({ one_time_key_counts: { signed_curve25519: 50 } });
			else if (req.url.includes('/keys/query'))
				req.reply({ device_keys: {}, failures: {} });
			else req.reply({});
		});
		const session = generateConsultantSession({
			type: SESSION_LIST_TYPES.ENQUIRY
		});
		Object.assign(session.session, {
			id: 1375,
			matrixRoomId: roomId,
			conversationType: 'AGENCY_COUNSELLING',
			lastMessage: text,
			askerMatrixUserId: '@asker:matrix.test'
		});
		session.consultant = null;
		cy.willReturn('consultantSessions', [session]);
		cy.intercept('GET', '**/service/users/sessions/room*', {
			sessions: [session]
		});
		cy.intercept('GET', '**/service/users/sessions/room/1375', {
			sessions: [session]
		});
		cy.intercept(
			'GET',
			'**/conversations/consultants/enquiries/registered*',
			{ sessions: [session], total: 1 }
		).as('consultantEnquiriesBase');
		cy.intercept(
			'GET',
			'**/conversations/consultants/enquiries/anonymous*',
			{ sessions: [], total: 0 }
		);
		cy.intercept('GET', '**/sessions/1375/supervisors*', []);
		cy.intercept('GET', '**/sessions/1375/team-discussion', {
			statusCode: 204
		});
		cy.intercept('POST', '**/sessions/1375/team-discussion', {
			matrixRoomId: teamRoomId,
			status: 'OPEN'
		}).as('openTeam');
		cy.fastLogin({ userId: USER_CONSULTANT });
		cy.visit('/sessions/consultant/sessionPreview');
		cy.get('[data-cy="session-list-item"]').first().click();
		cy.wait('@openTeam');
		if (width >= 900) {
			cy.get('[data-cy="stage-main"]').should('contain.text', text);
			cy.get(
				'[data-cy="stage-panel-slot"] [data-cy="stage-panel"]'
			).should('be.visible');
			cy.contains(
				'[data-cy="stage-main"] .messageItem__content',
				'ENDE DER ORIGINALANFRAGE'
			).scrollIntoView();
			cy.contains(
				'[data-cy="stage-main"] .messageItem__content',
				'ENDE DER ORIGINALANFRAGE'
			)
				.should('be.visible')
				.closest('.messageItem')
				.should('have.css', 'opacity', '1');
		}
		cy.get('[data-cy="stage-panel"]').should('be.visible');
		cy.get('[data-cy="stage-panel"]').should((nodes) => {
			const rect = nodes[0].getBoundingClientRect();
			expect(rect.right, 'panel right edge').to.be.at.most(
				nodes[0].ownerDocument.defaultView.innerWidth
			);
		});
		cy.intercept('POST', '**/service/error-reports', { statusCode: 204 });
		const reply = 'Wir besprechen diese Anfrage im Team.';
		cy.intercept(
			'PUT',
			'https://matrix.test/_matrix/client/**/rooms/*/send/m.room.message/*',
			{ event_id: '$team-reply' }
		).as('sendTeam');
		cy.intercept('POST', '**/message-events', { statusCode: 204 }).as(
			'teamNotification'
		);
		cy.intercept('PATCH', '**/service/users/drafts*', { statusCode: 204 });
		cy.intercept('DELETE', '**/service/users/drafts*', { statusCode: 204 });
		cy.get('[data-cy="stage-panel"] [contenteditable="true"]').type(reply);
		cy.get('[data-cy="stage-panel"] [contenteditable="true"]').should(
			'have.text',
			reply
		);
		cy.get('[data-cy="stage-panel"] .sendButton')
			.should('not.be.disabled')
			.click();
		cy.wait('@sendTeam').then(({ request }) => {
			expect(decodeURIComponent(request.url)).to.contain(
				`/rooms/${teamRoomId}/send/`
			);
			expect(request.body.body).to.contain(reply);
		});
		cy.wait('@teamNotification').its('request.body').should('include', {
			roomId: teamRoomId,
			teamDiscussion: true,
			matrixRoom: true,
			messagePreview: ''
		});
		cy.get('[data-cy="stage-panel"] [contenteditable="true"]').should(
			'have.text',
			''
		);
		const closeControl =
			width >= 900
				? '[data-cy="panel-header-close"]'
				: '[data-cy="stage-panel"] [data-cy="composer-back"]';
		cy.get(closeControl).should((nodes) => {
			const rect = nodes[0].getBoundingClientRect();
			expect(rect.right, 'close control right edge').to.be.at.most(
				nodes[0].ownerDocument.defaultView.innerWidth
			);
		});
		cy.screenshot(`enquiry-team-panel-after-${width}`, {
			capture: 'viewport',
			scale: true,
			disableTimersAndAnimations: false
		});
		cy.get(closeControl)
			.should('have.prop', 'tagName', 'BUTTON')
			.should('have.prop', 'tabIndex', 0)
			.focus();
		cy.get(closeControl).should('be.focused');
		cy.then(() =>
			Cypress.automation('remote:debugger:protocol', {
				command: 'Input.dispatchKeyEvent',
				params: {
					type: 'keyDown',
					text: '\r',
					unmodifiedText: '\r',
					key: 'Enter',
					code: 'Enter',
					windowsVirtualKeyCode: 13
				}
			})
		);
		cy.then(() =>
			Cypress.automation('remote:debugger:protocol', {
				command: 'Input.dispatchKeyEvent',
				params: {
					type: 'keyUp',
					key: 'Enter',
					code: 'Enter',
					windowsVirtualKeyCode: 13
				}
			})
		);
		cy.get('[data-cy="stage-panel"]').should('not.exist');
		cy.get('[data-cy="stage-main"]').should('contain.text', text);
		cy.contains(
			'[data-cy="stage-main"] .messageItem__content',
			'ENDE DER ORIGINALANFRAGE'
		).scrollIntoView();
		cy.contains(
			'[data-cy="stage-main"] .messageItem__content',
			'ENDE DER ORIGINALANFRAGE'
		).should('be.visible');
		cy.get('[data-cy="stage-main"] #session-scroll-container').scrollTo(
			'bottom',
			{ ensureScrollable: false }
		);
		cy.get('[data-cy="stage-main"] #session-scroll-container').should(
			(nodes) => {
				const container = nodes[0];
				const walker = container.ownerDocument.createTreeWalker(
					container,
					NodeFilter.SHOW_TEXT
				);
				let node: Node | null;
				let markerNode: Node | null = null;
				while ((node = walker.nextNode())) {
					if (node.textContent?.includes('ENDE DER ORIGINALANFRAGE'))
						markerNode = node;
				}
				expect(
					markerNode,
					'original enquiry ending exists'
				).not.to.equal(null);
				const range = container.ownerDocument.createRange();
				const start = markerNode.textContent.indexOf(
					'ENDE DER ORIGINALANFRAGE'
				);
				range.setStart(markerNode, start);
				range.setEnd(
					markerNode,
					start + 'ENDE DER ORIGINALANFRAGE'.length
				);
				const bounds = container.getBoundingClientRect();
				const rectangles = Array.from(range.getClientRects());
				expect(
					rectangles.length,
					'ending has rendered text'
				).to.be.greaterThan(0);
				for (const rect of rectangles) {
					expect(
						rect.top,
						'ending starts within visible area'
					).to.be.at.least(bounds.top);
					expect(
						rect.bottom,
						'ending finishes within visible area'
					).to.be.at.most(bounds.bottom);
				}
			}
		);
		// Layout fixture for the independent recovery notice above the real app.
		cy.document().then((document) => {
			const notice = document.createElement('aside');
			notice.className = 'encryption-recovery-notice';
			notice.textContent =
				'Ihr bisheriger Verlauf benötigt Ihren Wiederherstellungsschlüssel.';
			notice.style.minHeight = '81px';
			document.querySelector('.app__wrapper').before(notice);
		});
		cy.get('.session__acceptance button').should((buttons) => {
			const button = buttons[0];
			expect(button.getBoundingClientRect().bottom).to.be.at.most(
				button.ownerDocument.defaultView.innerHeight
			);
		});

		cy.get('.encryption-recovery-notice').should('be.visible');

		cy.screenshot(`enquiry-main-after-close-${width}`, {
			capture: 'viewport',
			scale: true,
			disableTimersAndAnimations: false
		});
		cy.reload();
		cy.get('[data-cy="stage-main"]').should('contain.text', text);
		cy.get('[data-cy="stage-panel"]').should('not.exist');
		// The accepted case can disappear from this colleague's authorized lookup.
		cy.intercept('GET', '**/service/users/sessions/room/1375', {
			statusCode: 204
		});
		cy.intercept('GET', '**/service/users/sessions/room?*', {
			statusCode: 204
		});
		cy.get('.session__acceptance', { timeout: 12000 }).should('not.exist');
		cy.get('[data-cy="stage-panel"]').should('not.exist');
		// A colleague can accept while this consultant only watches the queue.
		cy.visit('/sessions/consultant/sessionPreview');
		cy.get('[data-cy="session-list-item"]').should('have.length', 1);
		cy.intercept(
			'GET',
			'**/conversations/consultants/enquiries/registered*',
			{ statusCode: 204 }
		);
		cy.intercept(
			'GET',
			'**/conversations/consultants/enquiries/anonymous*',
			{ statusCode: 204 }
		);
		cy.get('[data-cy="session-list-item"]', { timeout: 22000 }).should(
			'not.exist'
		);
		const queue = Array.from({ length: 30 }, (_, index) => ({
			...session,
			session: {
				...session.session,
				id: 2000 + index,
				matrixRoomId: `!queue-${index}:matrix.test`
			}
		}));
		cy.intercept('GET', '**/service/users/sessions/room?*', (request) => {
			const ids =
				new URL(request.url).searchParams
					.get('roomIds[]')
					?.split(',') || [];
			request.reply({
				sessions: queue.filter((entry) =>
					ids.includes(entry.session.matrixRoomId)
				)
			});
		});
		cy.intercept('GET', '**/sessions/*/team-discussion', {
			statusCode: 204
		});
		cy.intercept('GET', '**/sessions/*/supervisors*', []);
		const refreshCounts: number[] = [];
		const queueRequests: string[] = [];
		cy.intercept(
			'GET',
			'**/conversations/consultants/enquiries/registered*',
			(request) => {
				const query = new URL(request.url).searchParams;
				const offset = Number(query.get('offset'));
				const count = Number(query.get('count'));
				queueRequests.push(`${offset}:${count}`);
				if (offset === 15) request.alias = 'queueMore';
				if (offset === 0) refreshCounts.push(count);
				request.reply({
					sessions: queue.slice(offset, offset + count),
					total: queue.length
				});
			}
		);
		cy.visit('/sessions/consultant/sessionPreview');
		cy.get('[data-cy="session-list-item"]').should('have.length', 15);
		cy.get('.sessionsList__scrollContainer').scrollTo('bottom');
		cy.wait('@queueMore');
		cy.get('[data-cy="session-list-item"]').should((nodes) =>
			expect(nodes.length, queueRequests.join(',')).to.equal(30)
		);
		cy.wrap(refreshCounts, { timeout: 22000 }).should('include', 30);
		cy.get('[data-cy="session-list-item"]').should('have.length', 30);
	});
});
