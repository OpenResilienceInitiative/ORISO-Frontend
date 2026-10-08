// @vitest-environment jsdom
/**
 * Public enquiry UI boundary: real session, timeline, side panel and composer.
 * Only network APIs, the Matrix SDK client and browser rendering are substituted.
 * This proves composition and interaction, not pixel layout or encrypted access.
 */
import React from 'react';
import {
	render,
	screen,
	waitFor,
	cleanup,
	fireEvent,
	act
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Context as ResponsiveContext } from 'react-responsive';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import { MatrixEvent } from 'matrix-js-sdk';
import { SessionStream } from './SessionStream';
// Preload the real lazy composer during collection; interaction timers must not
// measure Vite's first compilation of this large module.
import '../messageSubmitInterface/messageSubmitInterfaceComponent';
import { SESSION_LIST_TYPES } from './sessionHelpers';
import {
	ActiveSessionContext,
	UserDataContext,
	SessionTypeContext,
	ConsultantListContext,
	ConsultingTypesContext,
	TopicsContext,
	SessionsDataContext,
	ServerSettingsContext
} from '../../globalState';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { LocaleContext } from '../../globalState/context/LocaleContext';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import { MatrixClientService } from '../../services/matrixClientService';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import { enterPracticeMode, exitPracticeMode } from '../../practice';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import { FETCH_ERRORS } from '../../api/fetchData';
import {
	setValueInCookie,
	deleteCookieByName
} from '../sessionCookie/accessSessionCookie';
import { setTenantSettings } from '../../utils/tenantSettingsHelper';

const boundary = vi.hoisted(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () =>
			new Proxy(
				{},
				{
					get: (_target, key) =>
						key === 'measureText' ? () => ({ width: 0 }) : () => {}
				}
			)
	});
	process.env.REACT_APP_API_URL = 'http://localhost:9001';
	process.env.REACT_APP_KEYCLOAK_REALM = 'oriso';
	return {
		rooms: new Map<string, any>(),
		open: vi.fn(),
		getTeam: vi.fn(),
		sessionRoom: vi.fn(),
		fetch: vi.fn(),
		rejectEnquiry: vi.fn(),
		reload: vi.fn(),
		changeCase: null as ((id: number) => void) | null,
		client: null as any
	};
});
vi.mock('../../api', async (original) => ({
	...(await original<any>()),
	apiRejectEnquiry: (...args: any[]) => boundary.rejectEnquiry(...args)
}));
vi.mock('matrix-js-sdk', async (original) => ({
	...(await original<any>()),
	createClient: () => boundary.client
}));
// Browser-only animation implementation has no canvas renderer in jsdom.
vi.mock('lottie-web', () => ({
	default: {
		loadAnimation: () => ({
			destroy() {},
			play() {},
			stop() {},
			addEventListener() {}
		})
	}
}));
vi.mock('../../api/apiTeamDiscussion', () => ({
	apiGetTeamDiscussion: (...args: any[]) => boundary.getTeam(...args),
	apiOpenTeamDiscussion: (...args: any[]) => boundary.open(...args)
}));
vi.mock('../../api/apiGetSessionSupervisors', () => ({
	apiGetSessionSupervisors: async () => []
}));
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomBySessionId: (...args: any[]) =>
		boundary.sessionRoom(...args),
	apiGetSessionRoomsByRoomIds: async () => ({ sessions: [] })
}));
vi.mock('../../api/apiGetAgencyConsultantList', () => ({
	apiGetAgencyConsultantList: async () => [],
	fetchAgencyConsultantList: async () => [],
	apiGetTenantConsultantList: async () => []
}));
vi.mock('../../api/apiPatchNotificationActiveView', () => ({
	apiPatchNotificationActiveView: async () => undefined
}));
vi.mock('../../api/apiMatrixSyncRegister', () => ({
	apiRegisterMatrixRoomForSync: async () => undefined
}));
vi.mock('../../api/apiPostError', () => ({
	apiPostError: async () => undefined,
	TError: {},
	ERROR_LEVEL_WARN: 'WARN'
}));
vi.mock('../../api/apiGetTenantTheming', () => ({
	apiGetTenantTheming: async () => ({
		settings: { featureTeamDiscussionEnabled: true }
	})
}));
vi.mock('../../api/apiUserDrafts', () => ({
	apiGetUserDraft: async () => null,
	apiUpsertUserDraft: async () => undefined,
	apiDeleteUserDraft: async () => undefined
}));
vi.mock('../../utils/pseudonymGenerator', async (original) => ({
	...(await original<any>()),
	renderAvatarSvg: async () => '<svg xmlns="http://www.w3.org/2000/svg" />'
}));

const MAIN = '!enquiry:test';
const TEAM = '!team:test';
const TEXT =
	'Meine vollständige Anfrage: ' +
	'Dieser Absatz erklärt meine Situation ausführlich. '.repeat(24) +
	'ENDE DER ORIGINALANFRAGE';
let service: MatrixClientService;
const translations = createInstance().use(initReactI18next);
const room = (roomId: string, timeline: MatrixEvent[]) => ({
	roomId,
	timeline,
	getMyMembership: () => 'join',
	getMembers: () => [],
	getJoinedMembers: () => [],
	getMember: () => null,
	getLiveTimeline: () => ({ getEvents: () => timeline }),
	currentState: { getStateEvents: () => null, maySendEvent: () => true },
	getUnreadNotificationCount: () => 0
});

beforeEach(async () => {
	vi.stubGlobal(
		'fetch',
		boundary.fetch.mockRejectedValue(
			new Error('Unexpected enquiry integration-test network request')
		)
	);
	await translations.init({
		lng: 'de',
		fallbackLng: 'de',
		resources: {
			de: {
				translation: {
					enquiry: {
						rejection: {
							action: 'Anfrage ablehnen',
							confirmTitle: 'Diese Anfrage ablehnen?',
							confirm: 'Anfrage ablehnen',
							cancel: 'Abbrechen',
							inProgress: 'Die Ablehnung wird abgeschlossen…',
							error: 'Die Ablehnung konnte noch nicht vollständig abgeschlossen werden. Bitte versuchen Sie es erneut.',
							conflict:
								'Die Anfrage hat sich geändert. Bitte laden Sie die aktuelle Ansicht.',
							closed: 'Diese Anfrage wurde abgelehnt.'
						}
					}
				}
			}
		},
		interpolation: { escapeValue: false }
	});
	localStorage.clear();
	sessionStorage.clear();
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: (query: string) => ({
			matches: query.includes('min-width'),
			media: query,
			addListener() {},
			removeListener() {},
			addEventListener() {},
			removeEventListener() {}
		})
	});
	window.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as any;
	HTMLElement.prototype.scrollIntoView = vi.fn();
	HTMLElement.prototype.scrollTo = vi.fn();
	boundary.rooms.clear();
	boundary.rooms.set(
		MAIN,
		room(MAIN, [
			new MatrixEvent({
				event_id: '$original',
				room_id: MAIN,
				sender: '@asker:test',
				type: 'm.room.message',
				origin_server_ts: Date.now(),
				content: { msgtype: 'm.text', body: TEXT }
			})
		])
	);
	boundary.rooms.set(TEAM, room(TEAM, []));
	boundary.client = {
		getAccountData: () => null,
		setAccountData: async () => {},
		getRoom: (id: string) => boundary.rooms.get(id),
		getRooms: () => [...boundary.rooms.values()],
		getUserId: () => '@consultant:test',
		getDeviceId: () => 'TEST',
		initRustCrypto: async () => {},
		startClient() {},
		stopClient() {},
		on() {},
		off() {},
		removeListener() {},
		removeAllListeners() {},
		getCrypto: () => undefined,
		getSyncState: () => 'PREPARED',
		sendReadReceipt: async () => {},
		setRoomReadMarkers: async () => {},
		isRoomEncrypted: () => false
	};
	boundary.open
		.mockReset()
		.mockResolvedValue({ matrixRoomId: TEAM, status: 'OPEN' });
	boundary.getTeam.mockReset().mockResolvedValue(null);
	boundary.sessionRoom.mockReset().mockResolvedValue({ sessions: [] });
	boundary.fetch.mockClear();
	boundary.reload.mockReset();
	boundary.rejectEnquiry.mockReset().mockResolvedValue(undefined);
	setTenantSettings({ featureTeamDiscussionEnabled: true } as any);
	service = new MatrixClientService();
	await service.initializeClient({
		userId: '@consultant:test',
		deviceId: 'TEST',
		accessToken: 'test',
		homeserverUrl: 'https://matrix.test'
	} as any);
	setMatrixClientServiceRef(service);
});
afterEach(() => {
	exitPracticeMode();
	cleanup();
	service?.stopAndCleanup();
	setMatrixClientServiceRef(null);
	expect(boundary.fetch).not.toHaveBeenCalled();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function RouteProbe() {
	return (
		<output data-testid="route">
			{useLocation().pathname + useLocation().search}
		</output>
	);
}
function openEnquiry(
	type: SESSION_LIST_TYPES = SESSION_LIST_TYPES.ENQUIRY,
	options: {
		status?: number;
		seeker?: boolean;
		reloadedStatus?: number;
		teamChannel?: boolean;
		threadChannel?: boolean;
		id?: number;
		registrationType?: string;
		conversationType?: string;
		agencyId?: number;
		assigned?: boolean;
	} = {}
) {
	const status = options.status ?? 1;
	const activeSession = {
		isGroup: false,
		isSession: true,
		isEnquiry: status === 0 || status === 1,
		isEmptyEnquiry: status === 0,
		isNonEmptyEnquiry: status === 1,
		isRejected: status === 5,
		user: { username: 'Ratsuchende', userId: 'asker' },
		...(options.assigned
			? {
					consultant: {
						id: 'colleague',
						consultantId: 'colleague',
						username: 'colleague'
					}
				}
			: {}),
		item: {
			id: options.id ?? 4711,
			topic: {},
			matrixRoomId: MAIN,
			status,
			registrationType: options.registrationType ?? 'REGISTERED',
			active: true,
			agencyId: options.agencyId ?? 1,
			consultingType: 0,
			conversationType:
				'conversationType' in options
					? options.conversationType
					: 'AGENCY_COUNSELLING',
			askerMatrixUserId: '@asker:test'
		}
	};
	function LiveSession({ children }: { children: React.ReactNode }) {
		const [current, setCurrent] = React.useState(activeSession);
		boundary.changeCase = (id) =>
			setCurrent({
				...activeSession,
				item: { ...activeSession.item, id }
			});
		return (
			<ActiveSessionContext.Provider
				value={{
					activeSession: current as any,
					reloadActiveSession: () => {
						boundary.reload();
						const reloaded = options.reloadedStatus ?? 2;
						setCurrent({
							...activeSession,
							isEnquiry: false,
							isRejected: reloaded === 5,
							item: { ...activeSession.item, status: reloaded }
						});
					},
					readActiveSession: vi.fn()
				}}
			>
				{children}
			</ActiveSessionContext.Provider>
		);
	}
	const providers: [React.Context<any>, any][] = [
		[ResponsiveContext, { width: 1440 }],
		[
			UserDataContext,
			{
				userData: {
					userId: options.seeker ? 'asker' : 'consultant',
					userName: 'Beraterin',
					grantedAuthorities: [
						options.seeker
							? 'AUTHORIZATION_USER_DEFAULT'
							: 'AUTHORIZATION_CONSULTANT_DEFAULT'
					],
					agencies: [{ id: 1 }]
				},
				setUserData: vi.fn()
			}
		],
		[
			ActiveSessionContext,
			{
				activeSession,
				reloadActiveSession: vi.fn(),
				readActiveSession: vi.fn()
			}
		],
		[
			SessionTypeContext,
			{
				type,
				path: '/sessions/consultant/sessionPreview'
			}
		],
		[
			ConsultantListContext,
			{ consultantList: [], setConsultantList: vi.fn() }
		],
		[ServerSettingsContext, { getSetting: () => undefined }],
		[SessionsDataContext, { sessionsData: {}, dispatch: vi.fn() }],
		[TopicsContext, { topics: [], setTopics: vi.fn() }],
		[
			ConsultingTypesContext,
			{
				consultingTypes: [{ id: 0, isVideoCallAllowed: false }],
				setConsultingTypes: vi.fn()
			}
		],
		[
			NotificationsContext,
			{
				notifications: [],
				notificationFeed: [],
				addEventNotification: vi.fn()
			}
		],
		[LocaleContext, { locale: 'de' }],
		[
			MatrixClientContext,
			{ matrixClientService: service, setMatrixClientService: vi.fn() }
		]
	];
	return render(
		<I18nextProvider i18n={translations}>
			<MemoryRouter
				initialEntries={[
					'/sessions/consultant/sessionPreview/4711' +
						(options.teamChannel
							? '?channel=team'
							: options.threadChannel
								? '?channel=thread:%24original'
								: '')
				]}
			>
				{providers.reduceRight(
					(child, [Context, value]) => (
						<Context.Provider value={value}>
							{child}
						</Context.Provider>
					),
					<LiveSession>
						<RouteProbe />
						<SessionStream
							readonly={false}
							bannedUsers={[]}
							checkMutedUserForThisSession={() => {}}
						/>
					</LiveSession>
				)}
			</MemoryRouter>
		</I18nextProvider>
	);
}

it('opens the enquiry with its complete original text and the shared team panel without accepting', async () => {
	const view = openEnquiry();
	await waitFor(() => expect(boundary.open).toHaveBeenCalledWith(4711));
	await waitFor(
		() => expect(view.container.querySelector('.sidePanel')).not.toBeNull(),
		{ timeout: 15000 }
	);
	expect(
		view.container.querySelector('.chatStage__panel .sidePanel')
	).not.toBeNull();
	expect(
		view.container.querySelector('.chatStage__mainPane')?.textContent
	).toContain(TEXT);
	expect(
		screen.getByRole('button', { name: 'enquiry.acceptButton.known' })
	).toBeTruthy();
	expect(view.container.querySelector('.sidePanel')?.textContent).toContain(
		'chatStage.panel.team.empty.text'
	);
	expect(
		view.container.querySelector('.sidePanel')?.textContent
	).not.toContain('notifications.center.preview.empty');
}, 20000);

it('shows the complete enquiry text when opened outside the enquiry list', async () => {
	const view = openEnquiry(SESSION_LIST_TYPES.MY_SESSION);
	await waitFor(
		() => {
			expect(
				view.container.querySelector('.chatStage__mainPane')
					?.textContent
			).toContain(TEXT);
		},
		{ timeout: 15000 }
	);
}, 20000);

it('keeps an explicit close when the same enquiry is opened again', async () => {
	const view = openEnquiry();
	const panel = await waitFor(
		() => {
			const node =
				view.container.querySelector<HTMLElement>('.sidePanel');
			expect(node).not.toBeNull();
			return node!;
		},
		{ timeout: 15000 }
	);
	const close = panel.querySelector<HTMLButtonElement>(
		'[data-cy="panel-header-close"]'
	);
	expect(close).not.toBeNull();
	fireEvent.click(close!);
	await waitFor(() =>
		expect(view.container.querySelector('.sidePanel')).toBeNull()
	);
	expect(view.container.textContent).toContain(TEXT);
	const calls = boundary.open.mock.calls.length;
	view.unmount();
	const reopened = openEnquiry();
	await waitFor(() => expect(reopened.container.textContent).toContain(TEXT));
	expect(reopened.container.querySelector('.sidePanel')).toBeNull();
	expect(boundary.open).toHaveBeenCalledTimes(calls);
	const teamAction = screen.getByRole('button', {
		name: 'enquiry.teamDiscussion.open'
	});
	expect(teamAction.classList.contains('button__secondary')).toBe(true);
	expect(
		reopened.container.querySelector('[data-cy="channel-switcher-fab"]')
	).toBeNull();
	fireEvent.click(teamAction);
	await waitFor(() =>
		expect(reopened.container.querySelector('.sidePanel')).not.toBeNull()
	);
}, 20000);

it('keeps the original enquiry available after an opening error and retries into the same side panel', async () => {
	boundary.open.mockRejectedValueOnce(
		new Error('Temporary room service failure')
	);
	const view = openEnquiry();
	await screen.findByRole('alert');
	expect(view.container.textContent).toContain(TEXT);
	fireEvent.click(
		screen.getByRole('button', { name: 'sessionList.reloadButton.label' })
	);
	await waitFor(
		() => expect(view.container.querySelector('.sidePanel')).not.toBeNull(),
		{ timeout: 15000 }
	);
	expect(view.container.textContent).toContain(TEXT);
	expect(screen.queryByRole('alert')).toBeNull();
}, 20000);

it('shows an empty archived team discussion without inviting the counsellor to write', async () => {
	boundary.open.mockResolvedValue({ matrixRoomId: TEAM, status: 'ARCHIVED' });
	const view = openEnquiry();
	await waitFor(
		() => {
			const panel = view.container.querySelector(
				'.chatStage__panel .sidePanel'
			);
			expect(panel?.textContent).toContain(
				'notifications.center.preview.empty'
			);
			expect(panel?.textContent).not.toContain(
				'chatStage.panel.team.empty.title'
			);
			expect(panel?.textContent).not.toContain(
				'chatStage.panel.team.empty.text'
			);
			expect(
				panel?.querySelector(
					'[contenteditable="true"], textarea, [role="textbox"]'
				)
			).toBeNull();
		},
		{ timeout: 15000 }
	);
}, 20000);

it('keeps archived team history readable without a composer when the server reports acceptance', async () => {
	const history = 'Wir haben die Anfrage gemeinsam besprochen.';
	boundary.rooms.set(
		TEAM,
		room(TEAM, [
			new MatrixEvent({
				event_id: '$team-history',
				room_id: TEAM,
				sender: '@colleague:test',
				type: 'm.room.message',
				origin_server_ts: Date.now(),
				content: { msgtype: 'm.text', body: history }
			})
		])
	);
	boundary.open.mockResolvedValue({ matrixRoomId: TEAM, status: 'ARCHIVED' });
	const view = openEnquiry();
	await waitFor(
		() => {
			const panel = view.container.querySelector(
				'.chatStage__panel .sidePanel'
			);
			expect(panel?.textContent).toContain(history);
			expect(
				panel?.querySelector(
					'[contenteditable="true"], textarea, [role="textbox"]'
				)
			).toBeNull();
		},
		{ timeout: 15000 }
	);
	expect(
		view.container.querySelector('.chatStage__mainPane')?.textContent
	).toContain(TEXT);
}, 20000);

it('keeps the consultant enquiry one-way and hides system notices while retaining asker messages', async () => {
	const timeline = boundary.rooms.get(MAIN).timeline;
	for (const [id, body] of [
		['$system-mail', '[SYSTEM_NOTIFICATION] E-Mail wurde versendet'],
		['$system-carimat', '[SYSTEM_NOTIFICATION] Carimat Systemhinweis'],
		[
			'$asker-followup',
			'Meine weitere Nachricht zur E-Mail bleibt sichtbar'
		]
	]) {
		timeline.push(
			new MatrixEvent({
				event_id: id,
				room_id: MAIN,
				sender:
					id === '$asker-followup' ? '@asker:test' : '@system:test',
				type: 'm.room.message',
				origin_server_ts: Date.now(),
				content: { msgtype: 'm.text', body }
			})
		);
	}
	const view = openEnquiry();
	await waitFor(
		() =>
			expect(
				view.container.querySelector('.chatStage__mainPane')
					?.textContent
			).toContain(TEXT),
		{ timeout: 15000 }
	);
	const main = view.container.querySelector('.chatStage__mainPane');
	expect(main?.textContent).toContain(
		'Meine weitere Nachricht zur E-Mail bleibt sichtbar'
	);
	expect(main?.textContent).not.toContain('E-Mail wurde versendet');
	expect(main?.textContent).not.toContain('Carimat Systemhinweis');
	expect(main?.querySelector('[contenteditable="true"]')).toBeNull();
	expect(
		screen.getByRole('button', { name: 'enquiry.acceptButton.known' })
	).toBeTruthy();
}, 20000);

it('updates an already open enquiry when another colleague accepts it', async () => {
	const view = openEnquiry();
	await waitFor(() =>
		expect(
			view.container.querySelector(
				'.chatStage__panel [contenteditable="true"]'
			)
		).not.toBeNull()
	);
	boundary.getTeam.mockResolvedValue({
		matrixRoomId: TEAM,
		status: 'ARCHIVED'
	});
	boundary.open.mockResolvedValue({ matrixRoomId: TEAM, status: 'ARCHIVED' });
	boundary.sessionRoom.mockResolvedValue({
		sessions: [{ session: { id: 4711, status: 2, matrixRoomId: MAIN } }]
	});
	await waitFor(
		() => {
			expect(
				screen.queryByRole('button', {
					name: 'enquiry.acceptButton.known'
				})
			).toBeNull();
			expect(
				view.container.querySelector(
					'.chatStage__panel [contenteditable="true"]'
				)
			).toBeNull();
		},
		{ timeout: 10000 }
	);
}, 20000);

it('keeps focus the reader moved away right after the panel composer focused itself', async () => {
	// The desktop autofocus must not leave a focus behind for a later frame
	// (#1443): TipTap's chain().focus() lands one frame after the call.
	const frames: FrameRequestCallback[] = [];
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
		frames.push(callback);
		return frames.length;
	});
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
	const flushFrames = () =>
		frames.splice(0).forEach((callback) => callback(0));
	const view = openEnquiry();
	await waitFor(
		() => {
			const card = view.container.querySelector<HTMLElement>(
				'.chatStage__panel .textarea__wrapper-send-message'
			);
			// Earlier frames may carry the mount; the autofocus's own frame
			// must stay queued until the reader has moved away.
			if (!card?.hasAttribute('data-auto-focused')) flushFrames();
			expect(card?.hasAttribute('data-auto-focused')).toBe(true);
		},
		{ timeout: 15000 }
	);
	const elsewhere = screen.getByRole('button', {
		name: 'enquiry.acceptButton.known'
	});
	elsewhere.focus();

	flushFrames();
	flushFrames();

	expect(document.activeElement).toBe(elsewhere);
}, 20000);

it('declines an ordinary incoming enquiry only after explicit confirmation and refreshes its preview', async () => {
	const view = openEnquiry();
	await waitFor(() =>
		expect(view.container.textContent).toContain('ENDE DER ORIGINALANFRAGE')
	);
	fireEvent.click(screen.getByRole('button', { name: 'Anfrage ablehnen' }));
	const dialog = screen.getByRole('dialog', {
		name: 'Diese Anfrage ablehnen?'
	});
	expect(dialog.querySelector('textarea')).toBeNull();
	expect(boundary.rejectEnquiry).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
	expect(screen.queryByRole('dialog')).toBeNull();
	expect(boundary.rejectEnquiry).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole('button', { name: 'Anfrage ablehnen' }));
	fireEvent.click(
		screen.getAllByRole('button', { name: 'Anfrage ablehnen' }).at(-1)!
	);
	await waitFor(() =>
		expect(boundary.rejectEnquiry).toHaveBeenCalledTimes(1)
	);
	expect(boundary.rejectEnquiry.mock.calls[0][0]).toBe(4711);
	await waitFor(() =>
		expect(
			screen.queryByRole('button', { name: 'enquiry.acceptButton.known' })
		).toBeNull()
	);
}, 20000);

it.each([2, 5])(
	'retains the seeker history at status %s and permits writing only in the active state',
	async (status) => {
		const view = openEnquiry(SESSION_LIST_TYPES.MY_SESSION, {
			status,
			seeker: true
		});
		await waitFor(
			() =>
				expect(view.container.textContent).toContain(
					'Meine vollständige Anfrage:'
				),
			{ timeout: 15000 }
		);
		if (status === 2) {
			await waitFor(() =>
				expect(
					view.container.querySelector('[contenteditable="true"]')
				).not.toBeNull()
			);
		} else {
			expect(
				view.container.querySelector('[contenteditable="true"]')
			).toBeNull();
			expect(view.container.textContent).toContain(
				'Diese Anfrage wurde abgelehnt.'
			);
			expect(
				screen.queryByRole('button', { name: 'Anfrage ablehnen' })
			).toBeNull();
		}
	},
	20000
);

it('blocks writing in retained team history immediately when its enquiry is rejected even before room lookup reconciles', async () => {
	boundary.getTeam.mockResolvedValue({ matrixRoomId: TEAM, status: 'OPEN' });
	const view = openEnquiry(SESSION_LIST_TYPES.ENQUIRY, {
		status: 5,
		teamChannel: true
	});
	await waitFor(
		() =>
			expect(
				view.container.querySelector('.chatStage__panel .sidePanel')
			).not.toBeNull(),
		{ timeout: 15000 }
	);
	expect(
		view.container.querySelector(
			'.chatStage__panel [contenteditable="true"]'
		)
	).toBeNull();
	expect(
		screen.queryByRole('button', { name: 'enquiry.acceptButton.known' })
	).toBeNull();
}, 20000);

const deferredRejection = () => {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	boundary.rejectEnquiry.mockReturnValueOnce(promise);
	return { resolve, reject };
};
const confirmRejection = async () => {
	fireEvent.click(
		await screen.findByRole('button', { name: 'Anfrage ablehnen' })
	);
	fireEvent.click(
		screen.getAllByRole('button', { name: 'Anfrage ablehnen' }).at(-1)!
	);
};
it('keeps a pending decision single and blocks simultaneous acceptance until confirmed', async () => {
	const pending = deferredRejection();
	openEnquiry();
	await confirmRejection();
	const confirm = screen
		.getAllByRole('button', { name: 'Anfrage ablehnen' })
		.at(-1)!;
	expect((confirm as HTMLButtonElement).disabled).toBe(true);
	expect(
		(
			screen.getByRole('button', {
				name: 'enquiry.acceptButton.known',
				hidden: true
			}) as HTMLButtonElement
		).disabled
	).toBe(true);
	fireEvent.click(confirm);
	expect(boundary.rejectEnquiry).toHaveBeenCalledTimes(1);
	expect(boundary.reload).not.toHaveBeenCalled();
	expect(screen.getByTestId('route').textContent).toContain('/4711');
	await act(async () => pending.resolve());
	expect(boundary.reload).toHaveBeenCalledTimes(1);
	expect(screen.queryByRole('dialog')).toBeNull();
	expect(screen.getByTestId('route').textContent).toBe(
		'/sessions/consultant/sessionPreview'
	);
}, 20000);
it.each([FETCH_ERRORS.CATCH_ALL])(
	'resyncs durable rejection after incomplete closure, retains honest retry and confirms only a successful retry',
	async (error) => {
		boundary.rejectEnquiry.mockRejectedValueOnce(new Error(error));
		const events = vi.spyOn(messageEventEmitter, 'emit');
		const view = openEnquiry(SESSION_LIST_TYPES.ENQUIRY, {
			reloadedStatus: 5
		});
		await confirmRejection();
		await screen.findByRole('alert');
		expect(screen.getByRole('alert').textContent).toContain(
			'noch nicht vollständig'
		);
		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(screen.getByTestId('route').textContent).toContain('/4711');
		expect(boundary.reload).toHaveBeenCalledTimes(1);
		expect(events).toHaveBeenCalledWith(
			expect.objectContaining({
				changedSessionId: 4711,
				refreshEnquiryList: true,
				refreshSessionList: true
			})
		);
		expect(
			view.container.querySelector('[contenteditable="true"]')
		).toBeNull();
		expect(
			screen.queryByRole('button', { name: 'enquiry.acceptButton.known' })
		).toBeNull();
		fireEvent.click(
			screen.getByRole('button', { name: 'Anfrage ablehnen' })
		);
		await waitFor(() =>
			expect(boundary.rejectEnquiry).toHaveBeenCalledTimes(2)
		);
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(boundary.reload).toHaveBeenCalledTimes(2);
	},
	20000
);
it('does not offer retry after a conflicting rejection by another counsellor', async () => {
	boundary.rejectEnquiry.mockRejectedValueOnce(
		new Error(FETCH_ERRORS.CONFLICT)
	);
	openEnquiry(SESSION_LIST_TYPES.ENQUIRY, { reloadedStatus: 5 });
	await confirmRejection();
	await screen.findByRole('alert');
	expect(boundary.reload).toHaveBeenCalledTimes(1);
	expect(screen.getByRole('alert').textContent).toContain(
		'hat sich geändert'
	);
	expect(
		(
			screen.getByRole('button', {
				name: 'Anfrage ablehnen'
			}) as HTMLButtonElement
		).disabled
	).toBe(true);
	fireEvent.click(screen.getByRole('button', { name: 'Anfrage ablehnen' }));
	expect(boundary.rejectEnquiry).toHaveBeenCalledTimes(1);
}, 20000);
it.each(['case change', 'case round trip', 'account change', 'unmount'])(
	'discards an old completion after %s',
	async (change) => {
		const pending = deferredRejection();
		const view = openEnquiry();
		await confirmRejection();
		if (change === 'case change') act(() => boundary.changeCase!(4712));
		if (change === 'case round trip') {
			act(() => boundary.changeCase!(4712));
			act(() => boundary.changeCase!(4711));
		}
		if (change === 'account change')
			act(() => setValueInCookie('keycloak', 'new-account'));
		if (change === 'unmount') view.unmount();
		await act(async () => pending.resolve());
		expect(boundary.reload).not.toHaveBeenCalled();
		if (change !== 'unmount')
			expect(screen.getByTestId('route').textContent).toContain('/4711');
		deleteCookieByName('keycloak');
	},
	20000
);
it('keeps practice enquiries free of the new real rejection command', async () => {
	enterPracticeMode({ tourId: 'consultant-practice-accept' });
	openEnquiry(SESSION_LIST_TYPES.ENQUIRY, { id: -4711 });
	await screen.findByRole('button', { name: 'enquiry.acceptButton.known' });
	expect(
		screen.queryByRole('button', { name: 'Anfrage ablehnen' })
	).toBeNull();
	expect(boundary.rejectEnquiry).not.toHaveBeenCalled();
}, 20000);

it('preserves a pending confirmation through a token refresh for the same principal and auth session', async () => {
	const token = (iat: number) =>
		'e30.' +
		btoa(
			JSON.stringify({
				sub: 'consultant',
				sid: 'sessionA',
				tenantId: 1,
				iat
			})
		) +
		'.signature';
	setValueInCookie('keycloak', token(1));
	const pending = deferredRejection();
	openEnquiry();
	await confirmRejection();
	act(() => setValueInCookie('keycloak', token(2)));
	await act(async () => pending.resolve());
	expect(boundary.reload).toHaveBeenCalledTimes(1);
	expect(screen.queryByRole('dialog')).toBeNull();
	deleteCookieByName('keycloak');
}, 20000);

it.each([2, 5])(
	'retains the header supervision button but permits management only for active cases (status%s)',
	async (status) => {
		const view = openEnquiry(SESSION_LIST_TYPES.MY_SESSION, { status });
		await waitFor(() =>
			expect(view.container.textContent).toContain(
				'Meine vollständige Anfrage:'
			)
		);
		const name =
			status === 2
				? 'sessionHeader.supervisor.modal.title'
				: 'sessionHeader.supervisor.add.disabledUnavailable';
		const button = await screen.findByRole('button', { name });
		expect((button as HTMLButtonElement).disabled).toBe(status === 5);
	},
	20000
);

it.each([2, 5])(
	'keeps message history menus but permits reply and reactions only in active cases (status%s)',
	async (status) => {
		openEnquiry(SESSION_LIST_TYPES.MY_SESSION, { status, seeker: true });
		fireEvent.click(
			await screen.findByRole('button', { name: 'message.menu.open' })
		);
		if (status === 2) {
			expect(
				screen.getByRole('menuitem', {
					name: 'message.menu.replyDirect'
				})
			).toBeTruthy();
			expect(
				screen.getByRole('group', { name: 'message.reaction.add' })
			).toBeTruthy();
		} else {
			expect(
				screen.queryByRole('menuitem', {
					name: 'message.menu.replyDirect'
				})
			).toBeNull();
			expect(
				screen.queryByRole('group', { name: 'message.reaction.add' })
			).toBeNull();
		}
		expect(
			screen.getByRole('menuitem', { name: 'message.menu.markText' })
		).toBeTruthy();
	},
	20000
);
it('keeps a rejected thread history readable without a thread composer even through its direct URL', async () => {
	const view = openEnquiry(SESSION_LIST_TYPES.MY_SESSION, {
		status: 5,
		seeker: true,
		threadChannel: true
	});
	await waitFor(
		() =>
			expect(
				view.container.querySelector('.chatStage__panel .sidePanel')
			).not.toBeNull(),
		{ timeout: 15000 }
	);
	expect(
		view.container.querySelector('.chatStage__panel .sidePanel')
			?.textContent
	).toContain('Meine vollständige Anfrage:');
	expect(
		view.container.querySelector(
			'.chatStage__panel [contenteditable="true"]'
		)
	).toBeNull();
}, 20000);

it.each([
	['unsubmitted draft', { status: 0 }],
	['unsupported modality', { conversationType: 'FUTURE_UNKNOWN' }],
	['anonymous', { registrationType: 'ANONYMOUS' }],
	['another agency', { agencyId: 2 }],
	['already assigned', { assigned: true }]
])(
	'does not offer ordinary rejection for a %s enquiry',
	async (_name, options) => {
		const view = openEnquiry(SESSION_LIST_TYPES.ENQUIRY, options);
		await waitFor(() =>
			expect(view.container.textContent).toContain(
				'Meine vollständige Anfrage:'
			)
		);
		expect(
			screen.queryByRole('button', { name: 'Anfrage ablehnen' })
		).toBeNull();
		expect(boundary.rejectEnquiry).not.toHaveBeenCalled();
	},
	20000
);

it('retains ordinary rejection for a legacy submitted enquiry without an explicit modality', async () => {
	const view = openEnquiry(SESSION_LIST_TYPES.ENQUIRY, {
		conversationType: undefined
	});
	await waitFor(() =>
		expect(view.container.textContent).toContain(
			'Meine vollständige Anfrage:'
		)
	);
	expect(
		screen.getByRole('button', { name: 'Anfrage ablehnen' })
	).toBeTruthy();
});
