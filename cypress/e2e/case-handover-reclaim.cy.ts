/**
 * ADR-002 reclaim (#200) in the actual app with HTTP fixtures: the counsellor a
 * takeover moved a case away from finds it through the session search, opens
 * it and takes it back. Verifies the browser flow and rendering; the backend
 * rules live in CaseHandoverServiceTest.
 */
import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';
import { USER_CONSULTANT } from '../support/commands/mockApi';
import { generateConsultantSession } from '../support/sessions';

const caseRoomId = '!reclaim-200:matrix.test';
const ownRoomId = '!own-200:matrix.test';
const caseMessage = 'Danke, dass Sie sich die Zeit für mich nehmen.';

const member = (id: string) => ({
	type: 'm.room.member',
	state_key: id,
	sender: id,
	event_id: `$member-${id}`,
	origin_server_ts: 1,
	content: { membership: 'join', displayname: id }
});

const syncRoom = (roomId: string) => ({
	state: {
		events: [
			member('@consultant:matrix.test'),
			member('@asker:matrix.test'),
			{
				type: 'm.room.create',
				state_key: '',
				event_id: `$create-${roomId}`,
				sender: '@consultant:matrix.test',
				content: {
					creator: '@consultant:matrix.test',
					room_version: '10'
				}
			}
		]
	},
	timeline: {
		events: [
			{
				type: 'm.room.message',
				sender: '@asker:matrix.test',
				event_id: `$message-${roomId}`,
				room_id: roomId,
				origin_server_ts: Date.now(),
				content: { msgtype: 'm.text', body: caseMessage }
			}
		],
		limited: false,
		prev_batch: 'history'
	},
	ephemeral: { events: [] },
	account_data: { events: [] },
	unread_notifications: {}
});

const mockMatrix = () => {
	cy.intercept('**/service/conversations/consultants/availability*', {
		available: false
	});
	cy.intercept('POST', '**/service/matrix/sync/register/*', {
		statusCode: 204
	});
	cy.intercept('GET', '**/service/users/drafts/single*', { statusCode: 204 });
	cy.intercept('**/service/matrix/me/token*', {
		accessToken: 'test-only',
		userId: '@consultant:matrix.test',
		deviceId: 'TEST200'
	});
	cy.intercept('https://matrix.test/_matrix/**', (req) => {
		if (req.url.includes('/sync'))
			req.reply({
				delay: 250,
				body: {
					next_batch: 'batch',
					rooms: {
						join: {
							[caseRoomId]: syncRoom(caseRoomId),
							[ownRoomId]: syncRoom(ownRoomId)
						}
					},
					account_data: { events: [] },
					to_device: { events: [] },
					device_lists: { changed: [], left: [] },
					device_one_time_keys_count: { signed_curve25519: 50 }
				}
			});
		else if (req.url.includes('/pushrules'))
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
};

const handoverStatus = (overrides: Record<string, unknown>) => ({
	sessionId: 4711,
	status: 'NOT_REQUESTED',
	canViewContent: false,
	clientConsent: 'NONE',
	clientConsentRequired: false,
	auditOutcome: 'NOT_REQUESTED',
	...overrides
});

/**
 * The fixture homeserver cannot complete the key backup, so the app shows its
 * recovery notice. It is unrelated to reclaim; close it like a user would.
 */
const dismissRecoveryNotice = () =>
	cy.get('body').then(($body) => {
		const close = $body.find(
			'[data-testid="key-backup-recovery-action-close"]'
		);
		if (close.length) {
			cy.wrap(close.first()).click({ force: true });
			cy.get('[data-testid="key-backup-recovery-action"]').should(
				'not.exist'
			);
		}
	});

const shot = (name: string) => {
	dismissRecoveryNotice();
	cy.screenshot(name, {
		capture: 'viewport',
		scale: true,
		overwrite: true,
		disableTimersAndAnimations: false
	});
};

/**
 * Logs in as the original counsellor. Their own list holds another case; the
 * taken-over one now belongs to the cover counsellor and is only reachable
 * through the session search (case-handover candidates).
 */
const openTakenOverCase = (
	canReclaim: boolean,
	reclaimReply: { statusCode: number; body?: unknown }
) => {
	mockMatrix();
	const own = generateConsultantSession();
	Object.assign(own.session, {
		id: 4700,
		matrixRoomId: ownRoomId,
		lastMessage: 'Bis nächste Woche.'
	});
	own.user.username = 'ratsuchende-4700';
	const taken = generateConsultantSession();
	Object.assign(taken.session, {
		id: 4711,
		matrixRoomId: caseRoomId,
		lastMessage: caseMessage
	});
	taken.user.username = 'ratsuchende-4711';
	taken.consultant = {
		...taken.consultant,
		id: 'cover-counsellor',
		firstName: 'Vertretung',
		lastName: 'Beratung',
		username: 'vertretung'
	};

	let currentStatus = handoverStatus({ canReclaim });
	cy.willReturn('consultantSessions', [own]);
	cy.intercept('GET', '**/service/users/sessions/room?*', (req) => {
		const ids =
			new URL(req.url).searchParams.get('roomIds[]')?.split(',') || [];
		req.reply({
			sessions: [own, taken].filter((entry) =>
				ids.includes(entry.session.matrixRoomId)
			)
		});
	});
	cy.intercept('GET', '**/service/users/sessions/room/4711', {
		sessions: [taken]
	});
	cy.intercept('GET', '**/case-handover/candidates*', {
		sessions: [taken],
		offset: 0,
		count: 1,
		total: 1
	}).as('candidates');
	cy.intercept('GET', '**/case-handover/reasons', [
		{
			code: 'COUNSELLOR_ON_HOLIDAY',
			label: 'Geplante Abwesenheit',
			clientConsentRequired: false
		}
	]);
	cy.intercept('GET', '**/users/sessions/4711/case-handover', (req) =>
		req.reply(currentStatus)
	).as('handoverStatus');
	cy.intercept(
		'POST',
		'**/users/sessions/4711/case-handover/reclaim',
		(req) => {
			if (reclaimReply.statusCode === 200) {
				currentStatus = handoverStatus({
					status: 'GRANTED',
					canViewContent: true,
					auditOutcome: 'ACTIVE_OWNER'
				});
				req.reply({ statusCode: 200, body: currentStatus });
				return;
			}
			req.reply(reclaimReply);
		}
	).as('reclaim');
	cy.intercept('GET', '**/sessions/*/supervisors*', []);
	cy.intercept('GET', '**/sessions/*/team-discussion', { statusCode: 204 });

	cy.fastLogin({ userId: USER_CONSULTANT });
	cy.get('a[href="/sessions/consultant/sessionView"]').click();
	cy.wait('@consultantSessions');
	cy.get('[data-cy=session-list-item]').should('have.length', 1);
};

/**
 * Type in the session search: the colleague's case joins the list while the
 * query stands. Clicking outside closes the search panel and keeps the query.
 */
const searchAndOpenTheCase = (screenshotName?: string) => {
	cy.get('[data-cy=sessions-list-search]').type('4711');
	cy.wait('@candidates');
	cy.get('[data-cy=session-search-panel]').should(
		'contain.text',
		'ratsuchende-4711'
	);
	cy.get('body').click(1200, 450);
	cy.get('[data-cy=session-search-panel]').should('not.exist');
	cy.contains('[data-cy=session-list-item]', 'ratsuchende-4711').should(
		'be.visible'
	);
	if (screenshotName) {
		shot(screenshotName);
	}
	cy.contains('[data-cy=session-list-item]', 'ratsuchende-4711').click();
	cy.wait('@handoverStatus');
};

describe('Case handover reclaim — actual app with service fixtures', () => {
	before(() => startWebSocketServer());
	after(() => closeWebSocketServer());
	beforeEach(() => {
		cy.viewport(1455, 860);
		mockWebSocket();
	});

	it('lets the original counsellor find the case, take it back and read it again', () => {
		openTakenOverCase(true, { statusCode: 200 });
		shot('05-app-session-list');

		searchAndOpenTheCase('06-app-search-finds-case');
		cy.get('[data-cy=case-handover-curtain-reclaim]')
			.should('be.visible')
			.and('contain.text', 'Fall zurücknehmen');
		cy.contains('Abwesenheit übernommen').should('be.visible');
		shot('07-app-curtain-reclaim');

		cy.get('[data-cy=case-handover-curtain-reclaim]').click();
		cy.wait('@reclaim');
		cy.get('[data-cy=case-handover-curtain]').should('not.exist');
		cy.contains(caseMessage).should('be.visible');
		shot('08-app-after-reclaim');
	});

	it('explains when the case can no longer be taken back', () => {
		openTakenOverCase(true, { statusCode: 409 });
		searchAndOpenTheCase();
		cy.get('[data-cy=case-handover-curtain-reclaim]').click();
		cy.wait('@reclaim');
		cy.contains(
			'Dieser Fall kann nicht mehr zurückgenommen werden.'
		).should('be.visible');
		cy.get('[data-cy=case-handover-curtain]').should('be.visible');
		shot('09-app-reclaim-conflict');
	});

	it('offers no reclaim after a permanent handover', () => {
		openTakenOverCase(false, { statusCode: 409 });
		searchAndOpenTheCase();
		cy.get('[data-cy=case-handover-curtain-start]').should('be.visible');
		cy.get('[data-cy=case-handover-curtain-reclaim]').should('not.exist');
		shot('10-app-permanent-no-reclaim');
	});
});
