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
	apiGetTeamDiscussion: async () => null,
	apiOpenTeamDiscussion: (...args: any[]) => boundary.open(...args)
}));
vi.mock('../../api/apiGetSessionSupervisors', () => ({
	apiGetSessionSupervisors: async () => []
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
	vi.restoreAllMocks();
});

function RouteProbe() {
	return <output data-testid="route">{useLocation().search}</output>;
}
function openEnquiry() {
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
			conversationType: 'AGENCY_COUNSELLING',
			askerMatrixUserId: '@asker:test'
		}
	};
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
				type: SESSION_LIST_TYPES.ENQUIRY,
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
			{ consultingTypes: [], setConsultingTypes: vi.fn() }
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
					<>
						<RouteProbe />
						<SessionStream
							readonly={false}
							bannedUsers={[]}
							checkMutedUserForThisSession={() => {}}
						/>
					</>
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
