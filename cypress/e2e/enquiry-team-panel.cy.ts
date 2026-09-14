/**
 * Actual enquiry screen with HTTP fixtures for UserService and Matrix.
 * Uses the existing LiveService websocket test helper. This verifies browser
 * interaction and rendering, not encryption or access with real accounts.
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
		cy.viewport(1440, 1000);
		cy.intercept('**/service/conversations/consultants/availability*', {
			available: false
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
		cy.get('[data-cy="stage-main"]').should('contain.text', text);
		cy.get('[data-cy="stage-panel-slot"] [data-cy="stage-panel"]').should(
			'be.visible'
		);
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
		cy.get('[data-cy="stage-panel"]').should((nodes) => {
			const rect = nodes[0].getBoundingClientRect();
			expect(rect.right, 'panel right edge').to.be.at.most(
				nodes[0].ownerDocument.defaultView.innerWidth
			);
		});
		cy.get('[data-cy="panel-header-close"]').should((nodes) => {
			const rect = nodes[0].getBoundingClientRect();
			expect(rect.right, 'close control right edge').to.be.at.most(
				nodes[0].ownerDocument.defaultView.innerWidth
			);
		});
		cy.screenshot('enquiry-team-panel-after', {
			capture: 'viewport',
			scale: true,
			disableTimersAndAnimations: false
		});
		cy.get('[data-cy="panel-header-close"]').click();
		cy.get('[data-cy="stage-panel"]').should('not.exist');
		cy.reload();
		cy.get('[data-cy="stage-main"]').should('contain.text', text);
		cy.get('[data-cy="stage-panel"]').should('not.exist');
	});
});
