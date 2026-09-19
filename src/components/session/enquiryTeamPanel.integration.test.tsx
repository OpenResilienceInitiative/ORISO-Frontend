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
	fireEvent
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
		client: null as any
	};
});
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
		resources: { de: { translation: {} } },
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
	cleanup();
	service?.stopAndCleanup();
	setMatrixClientServiceRef(null);
	expect(boundary.fetch).not.toHaveBeenCalled();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function RouteProbe() {
	return <output data-testid="route">{useLocation().search}</output>;
}
function openEnquiry(type: SESSION_LIST_TYPES = SESSION_LIST_TYPES.ENQUIRY) {
	const activeSession = {
		isGroup: false,
		isSession: true,
		isEnquiry: true,
		user: { username: 'Ratsuchende', userId: 'asker' },
		item: {
			id: 4711,
			topic: {},
			matrixRoomId: MAIN,
			status: 1,
			active: true,
			agencyId: 1,
			consultingType: 0,
			conversationType: 'AGENCY_COUNSELLING',
			askerMatrixUserId: '@asker:test'
		}
	};
	function LiveSession({ children }: { children: React.ReactNode }) {
		const [current, setCurrent] = React.useState(activeSession);
		return (
			<ActiveSessionContext.Provider
				value={{
					activeSession: current as any,
					reloadActiveSession: () => {
						setCurrent({
							...activeSession,
							isEnquiry: false,
							item: { ...activeSession.item, status: 2 }
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
					userId: 'consultant',
					userName: 'Beraterin',
					grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
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
			{ notifications: [], addEventNotification: vi.fn() }
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
				initialEntries={['/sessions/consultant/sessionPreview/4711']}
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
