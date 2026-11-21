import { wcagContrast } from '../../src/utils/theme/wcagContrast';
import { USER_ASKER } from '../support/commands/mockApi';
import { generateAskerSession } from '../support/sessions';
import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';

const roomId = '!display-room:matrix.test';
const sessionId = 4791;
const asker = '@asker:matrix.test';
const counsellor = '@consultant:matrix.test';
const incoming = 'Wann können wir uns für ein Gespräch Zeit nehmen?';
const outgoing = 'Ich bin morgen nachmittags erreichbar.';
const draft = 'Ich ergänze noch eine Frage für das Gespräch.';

const membership = (id: string) => ({
	type: 'm.room.member',
	state_key: id,
	sender: id,
	event_id: `$member-${id}`,
	origin_server_ts: 1,
	content: { membership: 'join', displayname: id }
});

const message = (sender: string, eventId: string, body: string) => ({
	type: 'm.room.message',
	sender,
	event_id: eventId,
	room_id: roomId,
	origin_server_ts: Date.now(),
	content: { msgtype: 'm.text', body }
});

const matrixRoom = () => ({
	state: {
		events: [
			{
				type: 'm.room.create',
				state_key: '',
				event_id: '$create-display-room',
				sender: counsellor,
				content: { creator: counsellor, room_version: '10' }
			},
			membership(asker),
			membership(counsellor)
		]
	},
	timeline: {
		events: [
			message(counsellor, '$incoming-display', incoming),
			message(asker, '$outgoing-display', outgoing)
		],
		limited: false,
		prev_batch: 'history'
	},
	account_data: { events: [] },
	ephemeral: { events: [] },
	unread_notifications: {}
});

const mockChat = (deviceId: string) => {
	const filters = new Map<string, object>();
	cy.intercept('GET', '**/service/addons/registry', { addons: [] });
	cy.intercept('GET', '**/service/tenant/public/id/1', {
		id: 1,
		name: 'Beispielträger',
		settings: {}
	});
	cy.intercept('GET', '**/service/users/temporary-account', {
		statusCode: 404
	});
	cy.intercept(
		'GET',
		`**/service/users/sessions/${sessionId}/appointments`,
		[]
	);
	cy.intercept(
		'PUT',
		'https://matrix.test/_matrix/**/send/m.room.message/*',
		() => {
			throw new Error('This test only edits a draft');
		}
	);
	cy.intercept('GET', '**/service/conversations/consultants/availability*', {
		available: false
	});
	cy.intercept('POST', '**/service/matrix/sync/register/*', {
		statusCode: 204
	});
	cy.intercept('GET', '**/service/users/drafts/single*', { statusCode: 204 });
	cy.intercept('GET', '**/service/matrix/me/token*', {
		accessToken: 'story-fixture-token',
		userId: asker,
		deviceId
	});
	cy.intercept('https://matrix.test/_matrix/**', (request) => {
		const endpoint = new URL(request.url).pathname;
		if (endpoint.endsWith('/sync')) {
			request.reply({
				delay: 150,
				body: {
					next_batch: 'display-batch',
					rooms: new URL(request.url).searchParams.has('since')
						? {}
						: { join: { [roomId]: matrixRoom() } },
					account_data: { events: [] },
					to_device: { events: [] },
					device_lists: { changed: [], left: [] },
					device_one_time_keys_count: { signed_curve25519: 50 }
				}
			});
		} else if (endpoint.endsWith('/versions')) {
			request.reply({ versions: ['v1.11'], unstable_features: {} });
		} else if (endpoint.endsWith('/pushrules/')) {
			request.reply({
				global: {
					override: [],
					content: [],
					room: [],
					sender: [],
					underride: []
				}
			});
		} else if (request.method === 'POST' && endpoint.endsWith('/filter')) {
			const id = `display-filter-${filters.size + 1}`;
			filters.set(id, request.body);
			request.reply({ filter_id: id });
		} else if (
			request.method === 'GET' &&
			/\/filter\/[^/]+$/.test(endpoint)
		) {
			const id = endpoint.slice(endpoint.lastIndexOf('/') + 1);
			if (filters.has(id)) {
				request.reply({ body: filters.get(id) });
			} else {
				request.reply({
					statusCode: 404,
					body: {
						errcode: 'M_NOT_FOUND',
						error: 'Unknown test filter'
					}
				});
			}
		} else if (endpoint.endsWith('/whoami')) {
			request.reply({ user_id: asker, device_id: deviceId });
		} else if (endpoint.endsWith('/keys/upload')) {
			request.reply({ one_time_key_counts: { signed_curve25519: 50 } });
		} else if (endpoint.endsWith('/keys/query')) {
			request.reply({ device_keys: {}, failures: {} });
		} else if (endpoint.endsWith('/messages')) {
			request.reply({ start: 'history', chunk: [], state: [] });
		} else {
			request.reply({});
		}
	});

	const session = generateAskerSession();
	Object.assign(session.session, {
		id: sessionId,
		matrixRoomId: roomId,
		askerMatrixUserId: asker,
		consultantMatrixUserId: counsellor,
		conversationType: 'AGENCY_COUNSELLING',
		lastMessage: outgoing
	});
	cy.willReturn('askerSessions', [session]);
	cy.intercept('GET', '**/service/users/sessions/room?*', {
		sessions: [session]
	});
	cy.intercept('GET', `**/service/users/sessions/room/${sessionId}`, {
		sessions: [session]
	});
	const claims = btoa(
		JSON.stringify({
			iss: 'https://issuer.test',
			sub: USER_ASKER,
			tenantId: 1,
			sid: 'chat-display-fixture',
			exp: Math.floor(Date.now() / 1000) + 3600
		})
	);
	cy.setCookie('keycloak', `fixture.${claims}.fixture`);
	cy.fastLogin();
	cy.visit(`/sessions/user/view/session/${sessionId}`);
};

const expectFont = ($element: JQuery<HTMLElement>, pixels: number) => {
	const style = $element[0].ownerDocument.defaultView.getComputedStyle(
		$element[0]
	);
	expect(parseFloat(style.fontSize)).to.be.closeTo(pixels, 0.05);
};

const readContrastPair = (doc: Document) => {
	const styleOf = (element: Element) =>
		doc.defaultView.getComputedStyle(element);
	const rgb = (value: string) => {
		const channels = value.match(/[\d.]+/g).map(Number);
		return value.startsWith('color(srgb')
			? channels.map((channel, index) =>
					index < 3 ? channel * 255 : channel
				)
			: channels;
	};
	const lightness = (color: number[]) =>
		color.slice(0, 3).reduce((sum, value, index) => {
			const channel = value / 255;
			const linear =
				channel <= 0.04045
					? channel / 12.92
					: ((channel + 0.055) / 1.055) ** 2.4;
			return sum + linear * [0.2126, 0.7152, 0.0722][index];
		}, 0);

	const foreground = (element: Element, property = 'color') =>
		rgb(styleOf(element).getPropertyValue(property));
	const background = (element: Element): number[] => {
		const value = rgb(styleOf(element).backgroundColor);
		const opacity = value[3] ?? 1;
		if (opacity === 1) return value;
		const under = element.parentElement
			? background(element.parentElement)
			: [255, 255, 255];
		return under.map(
			(channel, index) => channel * (1 - opacity) + opacity * value[index]
		);
	};
	const pair = (
		foregroundNode: Element,
		fillNode = foregroundNode,
		property = 'color'
	) => {
		const fg = foreground(foregroundNode, property);
		const bg = background(fillNode);
		const alpha = fg[3] ?? 1;
		const a = lightness(
			bg.map(
				(channel, index) => alpha * fg[index] + (1 - alpha) * channel
			)
		);
		const b = lightness(bg);
		return {
			fg,
			bg,
			ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
		};
	};
	return pair;
};

const measureContrast = (doc: Document, editor: string) => {
	const pair = readContrastPair(doc);

	const composerText = doc.querySelector(`${editor} p`);
	const headerName = doc.querySelector('.sessionInfo__username h3');
	const send = doc.querySelector('.sendButton--ready');
	const menu = [
		...doc.querySelectorAll(
			'.sessionMenu__icon--mobile, .sessionMenu__icon--desktop'
		)
	].find((item) => item.getBoundingClientRect().width > 0);
	return {
		editor: pair(composerText),
		header: pair(headerName),
		sender: pair(doc.querySelector('.messageItem__senderInfoName')),
		agency: pair(doc.querySelector('.messageItem__usernameSubtitle')),
		incoming: pair(doc.querySelector('.messageItem__message')),
		outgoing: pair(doc.querySelector('.messageItem__message--myMessage')),
		send: pair(send.querySelector('.sendButton__plane'), send),
		menu: pair(menu.querySelector('svg circle'), menu, 'fill')
	};
};

describe('Personal size in the real chat', () => {
	before(() => startWebSocketServer());
	after(() => closeWebSocketServer());

	it('keeps recovery, history and the draft reachable at 320 px and 200%', () => {
		mockWebSocket();
		cy.viewport(320, 800);
		mockChat('DISPLAY_RECOVERY');

		const editor = '.tiptap-composer .ProseMirror[contenteditable="true"]';
		const timeline = '[data-cy="stage-main"] .session__content';
		const notice = '[data-testid="key-backup-recovery-action"]';
		const action = '[data-testid="key-backup-recovery-open"]';
		const assertReachable = ($element: JQuery<HTMLElement>) => {
			const element = $element[0];
			const bounds = element.getBoundingClientRect();
			const hit = element.ownerDocument.elementFromPoint(
				bounds.left + bounds.width / 2,
				bounds.top + bounds.height / 2
			);
			expect(element.contains(hit), element.textContent).to.equal(true);
		};
		const reach = (selector: string, text?: string) => {
			const find = () =>
				text === undefined
					? cy.get(selector)
					: cy.contains(selector, text);
			find().then(($element) => {
				$element[0].scrollIntoView({ block: 'center' });
			});
			find().should(assertReachable);
		};

		cy.get(editor).type(draft).should('contain', draft);
		cy.get('.personalDisplayEntry button:visible').click();
		for (const size of [125, 150, 175, 200]) {
			cy.get(
				'.personalDisplayDialog button[aria-label="Größer"]'
			).click();
			cy.get('.personalDisplayDialog output').should(
				'have.text',
				size + ' %'
			);
		}
		cy.get('.personalDisplayDialog .personalDisplaySize__save').click();
		cy.contains('.personalDisplayDialog label', /^Dunkel$/).click();
		cy.contains('.personalDisplayDialog label', /^Hoch$/).click();
		cy.get('.personalDisplayDialog button[aria-label="Schließen"]').click();

		cy.get('.sessionInfo').should(($header) => {
			const header = $header[0];
			const window = header.ownerDocument.defaultView;
			const bounds = header.getBoundingClientRect();
			for (const [selector, expectedSize] of [
				['.sessionInfo__username h3', 36],
				['.sessionInfo__metaInfo__content:not(.topicTag)', 24],
				['.sessionInfo__metaInfo__content.topicTag', 24]
			] as const) {
				const label = header.querySelector(selector);
				expect(label?.textContent?.trim(), selector).not.to.be.empty;
				const rect = label.getBoundingClientRect();
				const style = window.getComputedStyle(label);
				expect(rect.left, selector).to.be.at.least(bounds.left - 0.5);
				expect(rect.right, selector).to.be.at.most(bounds.right + 0.5);
				expect(style.textOverflow, selector).to.equal('ellipsis');
				expect(style.whiteSpace, selector).to.equal('nowrap');
				expect(label.getAttribute('title'), selector).not.to.be.empty;
				expect(
					parseFloat(window.getComputedStyle(label).fontSize),
					selector
				).to.be.closeTo(expectedSize, 0.05);
			}
		});
		cy.get('.personalDisplayEntry button:visible').should('be.focused');
		cy.get('.sessionMenu__icon--mobile:visible').should('be.visible');
		cy.screenshot('gespraechskopf-320x800-200-hoch', {
			capture: 'viewport',
			scale: false
		});

		cy.get(notice).should('have.length', 1);
		cy.get(timeline).find(notice).should('have.attr', 'role', 'status');
		cy.get(notice)
			.find('.MuiAlert-message')
			.should(($text) => expectFont($text, 28));
		reach('.messageItem__message', incoming);
		reach('.messageItem__message--myMessage', outgoing);
		cy.get(notice).should('exist');
		cy.get(editor).should('have.text', draft);
		cy.document().should((doc) => {
			expect(doc.documentElement.scrollWidth).to.be.at.most(321);
		});
		reach(action);
		cy.get(action).should(($action) => {
			const button = $action[0];
			const bounds = button.getBoundingClientRect();
			const panel = button.closest(notice).getBoundingClientRect();
			expect(bounds.left, 'action fits inside the notice').to.be.at.least(
				panel.left
			);
			expect(bounds.right, 'action fits inside the notice').to.be.at.most(
				panel.right
			);
			expect(
				button.scrollWidth,
				'action label fits its button'
			).to.be.at.most(button.clientWidth + 1);
			expectFont($action, 28);
		});
		cy.screenshot('wiederherstellung-320x800-200-hoch', {
			capture: 'viewport',
			scale: false
		});
		cy.get(action).click();
		cy.get('[role="dialog"]').filter(':visible').should('have.length', 1);
		cy.get('[role="dialog"]').filter(':visible').type('{esc}');
		cy.get(action).should('be.focused');
		cy.get(
			'button.composerToolbar__button--scrollToNewest:visible'
		).click();
		cy.contains('.messageItem__message--myMessage', outgoing).should(
			assertReachable
		);
		cy.get(notice).should('exist');
		cy.screenshot('juengste-nachricht-320x800-200-hoch', {
			capture: 'viewport',
			scale: false
		});
	});

	for (const [width, height] of [
		[390, 844],
		[820, 1180],
		[1440, 1000]
	]) {
		it(`scales both message directions and the composer at ${width} × ${height}`, () => {
			mockWebSocket();
			cy.viewport(width, height);
			if (width === 390) {
				cy.then(() =>
					Cypress.automation('remote:debugger:protocol', {
						command: 'Emulation.setEmulatedMedia',
						params: {
							features: [
								{
									name: 'prefers-reduced-motion',
									value: 'reduce'
								}
							]
						}
					})
				);
			} else {
				cy.then(() =>
					Cypress.automation('remote:debugger:protocol', {
						command: 'Emulation.setEmulatedMedia',
						params: {
							features: [
								{
									name: 'prefers-reduced-motion',
									value: 'no-preference'
								}
							]
						}
					})
				);
			}

			mockChat(`DISPLAY_${width}`);

			const messageSelector = '.messageItem__message';
			const editor =
				'.tiptap-composer .ProseMirror[contenteditable="true"]';
			const measureChat = (pixels: number) => {
				cy.get('[data-cy="stage-main"] .session__content').scrollTo(
					'bottom',
					{ ensureScrollable: false }
				);
				cy.contains(messageSelector, incoming)
					.should('be.visible')
					.should(($node) => expectFont($node, pixels));
				cy.contains('.messageItem__message--myMessage', outgoing)
					.should('be.visible')
					.should(($node) => expectFont($node, pixels));
				cy.get(editor)
					.should('be.visible')
					.should(($node) => expectFont($node, pixels));
			};
			measureChat(14);
			cy.get(editor).type(draft).should('contain', draft);

			cy.get('.personalDisplayEntry button:visible')
				.should('have.length', 1)
				.click();
			cy.get('[role=dialog] button[aria-label="Größer"]').click();
			cy.get('[role=dialog] output').should('have.text', '125 %');
			cy.get('[role=dialog] button[aria-label="Größer"]').click();
			cy.get('[role=dialog] output').should('have.text', '150 %');
			cy.get('[role=dialog] .personalDisplaySize__save').click();
			cy.contains('[role=dialog] label', /^Dunkel$/).click();
			cy.get('[role=dialog] button[aria-label="Schließen"]').click();
			cy.contains('[role=dialog] .m3Dialog__title', /^Anzeige$/).should(
				'not.exist'
			);

			measureChat(21);
			cy.get(editor).should('contain', draft);
			cy.document().then((doc) => {
				const colors = measureContrast(doc, editor);
				expect(
					colors.sender.ratio,
					'own sender name contrast'
				).to.be.at.least(4.5);
				expect(
					colors.agency.ratio,
					'sender counselling centre contrast'
				).to.be.at.least(4.5);
				expect(
					colors.editor.ratio,
					'draft text contrast'
				).to.be.at.least(4.5);
				expect(
					colors.header.ratio,
					'header name contrast'
				).to.be.at.least(4.5);
				expect(colors.send.ratio, 'send icon contrast').to.be.at.least(
					3
				);
				expect(
					colors.menu.ratio,
					'menu trigger contrast'
				).to.be.at.least(3);
				cy.writeFile(
					`cypress/screenshots/personal-display-chat.cy.ts/kontrast-${width}.json`,
					colors
				);
			});
			cy.get('.personalDisplayEntry button:visible').should('be.focused');
			cy.location('pathname').should(
				'eq',
				`/sessions/user/view/session/${sessionId}`
			);
			cy.document().should((doc) => {
				expect(doc.documentElement.scrollWidth).to.be.at.most(
					width + 1
				);
			});
			cy.get('[data-cy="stage-main"] .session__content').scrollTo(
				'bottom',
				{ ensureScrollable: false }
			);

			cy.get('[data-cy="stage-main"] .messageItem__message').should(
				($messages) => {
					const errors = [...$messages]
						.map((message) => {
							const bounds = message.getBoundingClientRect();
							const hit = message.ownerDocument.elementFromPoint(
								bounds.left + bounds.width / 2,
								bounds.top + bounds.height / 2
							);
							const wrapper = message.closest('.messageItem');
							const style =
								message.ownerDocument.defaultView.getComputedStyle(
									wrapper
								);
							if (width === 390)
								expect(style.animationName).to.equal('none');
							if (
								message.contains(hit) &&
								Number(style.opacity) > 0.99
							)
								return null;
							return (
								hit
									?.closest('[role=dialog], [role=alert]')
									?.textContent?.slice(0, 100) ??
								hit?.className ??
								'outside viewport'
							);
						})
						.filter(Boolean);
					expect(
						errors,
						'message bubbles covered by another element'
					).to.deep.equal([]);
				}
			);

			cy.screenshot(`chat-150-dunkel-${width}x${height}`, {
				capture: 'viewport',
				scale: false
			});

			cy.get('.personalDisplayEntry button:visible').click();
			cy.contains('[role=dialog] label', /^Hoch$/).click();
			cy.get('html').should(
				'have.attr',
				'data-oriso-contrast-level',
				'high'
			);
			cy.get('.personalDisplayDialog [role=dialog]').should(($dialog) => {
				const dialog = $dialog[0];
				const pair = readContrastPair(dialog.ownerDocument);
				const labels = dialog.querySelectorAll(
					'legend, label, .m3Dialog__title, output'
				);
				expect(labels.length).to.be.greaterThan(5);
				for (const label of labels) {
					expect(pair(label).ratio, label.textContent).to.be.at.least(
						7
					);
				}
			});
			cy.screenshot(`hochkontrast-dialog-${width}x${height}`, {
				capture: 'viewport',
				scale: false
			});

			cy.contains('[role=dialog] label', /^Hell$/).click();
			cy.get('html').should(
				'have.attr',
				'data-oriso-personal-scheme',
				'light'
			);

			const expectActiveTopicContrast = (minimum: number) => {
				cy.document().should((doc) => {
					const style = doc.defaultView.getComputedStyle(
						doc.documentElement
					);
					const ink = style
						.getPropertyValue('--oriso-topic-tag-active-fg')
						.trim();
					const fill = style
						.getPropertyValue('--oriso-topic-tag-active-bg')
						.trim();
					expect(ink).not.to.be.empty;
					expect(fill).not.to.be.empty;
					expect(wcagContrast(ink, fill)).to.be.at.least(minimum);
				});
			};
			expectActiveTopicContrast(7);
			cy.contains('[role=dialog] label', /^Mittel$/).click();
			cy.get('html').should(
				'have.attr',
				'data-oriso-contrast-level',
				'medium'
			);
			expectActiveTopicContrast(5.5);
			cy.contains('[role=dialog] label', /^Standard$/).click();
			cy.get('html').should(
				'have.attr',
				'data-oriso-contrast-level',
				'standard'
			);
			cy.get('html').should(($root) => {
				expect(
					$root[0].style.getPropertyValue(
						'--oriso-topic-tag-active-fg'
					)
				).to.equal('');
			});
			cy.contains('[role=dialog] label', /^Dunkel$/).click();
			cy.contains('[role=dialog] label', /^Hoch$/).click();
			cy.get('[role=dialog] button[aria-label="Schließen"]').click();
			cy.contains('[role=dialog] .m3Dialog__title', /^Anzeige$/).should(
				'not.exist'
			);
			measureChat(21);
			cy.get(editor).should('contain', draft);
			cy.get('[data-testid=key-backup-recovery-action]').should('exist');
			const measureHigh = (doc: Document) => {
				const pair = readContrastPair(doc);
				return {
					...measureContrast(doc, editor),
					recoveryLink: pair(
						doc.querySelector('.encryption-recovery-snackbar__link')
					),
					recoveryAction: pair(
						doc.querySelector(
							'[data-testid=key-backup-recovery-open]'
						)
					)
				};
			};
			cy.document().should((doc) => {
				const colors = measureHigh(doc);
				for (const role of [
					'editor',
					'header',
					'sender',
					'agency',
					'incoming',
					'outgoing',
					'recoveryLink',
					'recoveryAction'
				] as const) {
					expect(
						colors[role].ratio,
						`${role} ${JSON.stringify(colors[role])}`
					).to.be.at.least(7);
				}
				expect(colors.send.ratio, 'send').to.be.at.least(3);
				expect(colors.menu.ratio, 'menu').to.be.at.least(3);
			});
			cy.document().then((doc) =>
				cy.writeFile(
					`cypress/screenshots/personal-display-chat.cy.ts/high-${width}.json`,
					measureHigh(doc)
				)
			);
			cy.get('[data-cy="stage-main"] .session__content').scrollTo(
				'bottom',
				{ ensureScrollable: false }
			);
			cy.screenshot(`hochkontrast-chat-${width}x${height}`, {
				capture: 'viewport',
				scale: false
			});

			if (width === 390) {
				cy.reload();
				cy.get('.personalDisplayEntry button:visible').should(
					'have.length',
					1
				);
				cy.get('html').should(
					'have.attr',
					'data-oriso-contrast-level',
					'high'
				);
				cy.get('html').should(
					'have.attr',
					'data-oriso-personal-scheme',
					'dark'
				);
				cy.get('html').should(
					'have.attr',
					'data-oriso-personal-text-size',
					'150'
				);
			}
		});
	}
});
