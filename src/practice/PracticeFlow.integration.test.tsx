// @vitest-environment oriso-jsdom
/**
 * The REAL practice tours walk through the REAL app shell pieces
 * (tour host, banner, navigation bar, practice surface + sandbox, session
 * containers) exactly as `Routing` wires them. Only Joyride's overlay is
 * captured (as in `ProductTourAdapter.component.test.tsx`) and browser gaps
 * are filled; anchors, routes, advance conditions and events are real.
 */
import React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { Context as ResponsiveContext } from 'react-responsive';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import { createStore, Provider as JotaiProvider } from 'jotai';
import userEvent from '@testing-library/user-event';
// Preload the lazy composer and session view during collection.
import '../components/messageSubmitInterface/messageSubmitInterfaceComponent';
import '../components/session/SessionView';
import { SessionsZone } from '../components/app/SessionsZone';
import { NavigationBar } from '../components/app/NavigationBar';
import { LiveChatAvailability } from '../components/profile/LiveChatAvailability';
import { Header } from '../components/header/Header';
import { RouterConfigConsultant } from '../components/app/RouterConfig';
import { CalendarPageWired } from '../components/calendar/CalendarPageWired';
import { Walkthrough } from '../components/walkthrough/Walkthrough';
import { tourLaunchRequestAtom } from '../components/productTour/tourLaunchState';
import { subscribeToTourEvent } from '../components/productTour/tourEvents';
import {
	AppConfigContext,
	ConsultantListContext,
	ConsultingTypesContext,
	NotificationsContext,
	ServerSettingsContext,
	TenantContext,
	TopicsContext,
	UserDataContext
} from '../globalState';
import { LocaleContext } from '../globalState/context/LocaleContext';
import { LanguagesContext } from '../globalState/provider/LanguagesProvider';
import { MatrixClientContext } from '../globalState/context/MatrixClientContext';
import { SessionsDataContext } from '../globalState/provider/SessionsDataProvider';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from '../services/matrixClientRegistry';
import { setTenantSettings } from '../utils/tenantSettingsHelper';
import { config } from '../resources/scripts/config';
import { teardownLocalSession } from '../components/logout/logout';
import { MatrixClientService } from '../services/matrixClientService';
import { PracticeLayer } from './PracticeLayer';
import { PracticeBanner } from './PracticeBanner';
import { PracticeSurface } from './PracticeSurface';
import { PracticeOverviewSection } from './PracticeOverviewSection';
import { practiceTours } from './practiceTours';
import { practiceCounsellorFixture } from './fixtures/practiceCounsellorFixture';
import { getPracticeNetworkGuard, getPracticeSnapshot } from './practiceMode';
import {
	PRACTICE_TOUR_EVENTS,
	type PracticeTourEventName
} from './practiceTourEvents';
import {
	createTestScript,
	practiceScriptBlock
} from './script/scriptTestSupport';
import { PRACTICE_ENQUIRIES_ROUTE } from './practiceRoutes';
import { isPracticeId } from './practiceIds';
import {
	LIVE_CHAT_AVAILABILITY_ACK_STORAGE_KEY,
	LIVE_CHAT_AVAILABILITY_LOSS_STORAGE_KEY,
	LIVE_CHAT_AVAILABILITY_STORAGE_KEY
} from '../utils/liveChatAvailabilityStorage';

vi.hoisted(() => {
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
});
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
vi.mock('lottie-react', () => ({ default: () => null }));

/** Joyride draws the overlay only; the adapter drives it through these props. */
let joyride: {
	run: boolean;
	stepIndex: number;
	steps: Array<{ target: string }>;
	onEvent: (data: any) => void;
} | null = null;
vi.mock('react-joyride', async () => {
	const actual: any = await vi.importActual('react-joyride');
	const { useEffect } = await vi.importActual<typeof React>('react');
	return {
		...actual,
		Joyride: (props: any) => {
			joyride = props;
			useEffect(
				() => () => {
					joyride = null;
				},
				[]
			);
			return null;
		}
	};
});

const ACCEPT = 'consultant-practice-accept';
const HANDOVER = 'consultant-case-handover';
const LIVE_CHAT = 'consultant-live-chat';
const GROUP_CIRCLE = 'consultant-group-circle';
const CALENDAR = 'consultant-calendar';
const CALENDAR_ROUTE = '/booking/events';
/** The counsellor's real Beratungsstelle (the fixture's), read by the shell. */
/** The counsellor's own Beratungsstellen, as the create entry reads them. */
const REAL_AGENCIES_URL = /^\/service\/agencies\/(\d+(?:,\d+)*)$/;
const SECOND_AGENCY = { id: 4712, name: 'Zweite echte Beratungsstelle' };
const HELP_ROUTE = '/profile/hilfe/rundgaenge';
/** The texts the page's German script shows; the catalogue is the source. */
const SCRIPT = createTestScript('de');
const TUTORIAL_PROGRESS = '/service/users/tutorials/progress';
/** The real availability (GET/PUT) and its heartbeat (POST) share this path. */
const LIVE_CHAT_AVAILABILITY =
	'/service/conversations/consultants/availability';
const SETTINGS_ROUTE = '/profile/aktivitaeten/abwesenheit';
const LIVE_CHAT_STORAGE_KEYS = [
	LIVE_CHAT_AVAILABILITY_STORAGE_KEY,
	LIVE_CHAT_AVAILABILITY_LOSS_STORAGE_KEY,
	LIVE_CHAT_AVAILABILITY_ACK_STORAGE_KEY
];

interface NetworkCall {
	method: string;
	url: string;
	/** The tutorial progress status a PUT writes. */
	status?: string;
}
const network: NetworkCall[] = [];
const networkFetch = vi.fn(
	async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = input instanceof Request ? input : null;
		const method = (init?.method || request?.method || 'GET').toUpperCase();
		const url = request ? request.url : String(input);
		const body = init?.body ?? (await request?.clone().text());
		const status =
			typeof body === 'string' && body
				? JSON.parse(body).status
				: undefined;
		network.push({ method, url, status });
		// A real read the create entry needs: the Beratungsstelle's own
		// settings, without policies, so the Träger's flags decide.
		const agencyIds =
			method === 'GET' && REAL_AGENCIES_URL.exec(new URL(url).pathname);
		if (agencyIds) {
			const ids = agencyIds[1].split(',').map(Number);
			return new Response(JSON.stringify(ids.map((id) => ({ id }))), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		if (url.includes(TUTORIAL_PROGRESS)) {
			return method === 'GET'
				? new Response('[]', {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					})
				: new Response(null, { status: 204 });
		}
		// The counsellor is really NOT available; only the read is answered.
		if (method === 'GET' && url.endsWith(LIVE_CHAT_AVAILABILITY)) {
			return new Response(JSON.stringify({ available: false }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw new Error('network is not reachable in the practice flow proof');
	}
);

/** The real Matrix service keeps living in the page; practice must never write to it. */
const realMatrixWrites: string[] = [];
const realMatrixService = new Proxy(
	{},
	{
		get: (_target, key) => {
			if (
				typeof key === 'string' &&
				/^(send|set|join|invite|leave|redact|create)/.test(key)
			) {
				realMatrixWrites.push(key);
			}
			return () => null;
		}
	}
);

const appNotifications = {
	notifications: [],
	notificationFeed: [],
	visibleUnreadCount: 0,
	hiddenUnreadInLoadedPages: 0,
	addNotification: vi.fn(),
	addEventNotification: vi.fn()
};
const storageWrites: string[] = [];
const appSessionsDispatch = vi.fn();
const translations = createInstance().use(initReactI18next);
const counsellor = practiceCounsellorFixture({ isWalkThroughEnabled: false });
const appConfig = {
	...config,
	enableWalkthrough: true,
	releaseToggles: { ...config.releaseToggles, enablePracticeArea: true }
};

function RouteProbe() {
	const { pathname, search } = useLocation();
	return <output data-testid="route">{`${pathname}${search}`}</output>;
}
const route = () => screen.getByTestId('route').textContent;
/** The header's switch to the Element client (all real rooms). */
const uiVersionSwitch = () => screen.queryByLabelText('app.ui.classic');

const renderApp = ({
	teamDiscussion = true,
	practiceArea = true,
	width = 1440,
	strictMode = false,
	/** Gesprächskreise on, and the counsellor may create and start one. */
	groupCircle = false,
	/** Only the circle format: the create flow skips its format picker. */
	circleOnly = false,
	/** A second Beratungsstelle: the circle settings preselect none. */
	twoAgencies = false,
	liveChatViaSidebar = false,
	supervision = true
} = {}) => {
	const settings = {
		...appConfig,
		releaseToggles: {
			...appConfig.releaseToggles,
			enablePracticeArea: practiceArea
		}
	};
	const flags = {
		featureTeamDiscussionEnabled: teamDiscussion,
		featureSupervisionEnabled: supervision,
		...(groupCircle && { featureGroupChatV2Enabled: true }),
		...(circleOnly && {
			featureInternalGroupChatEnabled: false,
			featureDirectInviteChatEnabled: false,
			featureDirectInviteAudioEnabled: false,
			featureDirectInviteVideoEnabled: false
		})
	};
	const userData = groupCircle
		? {
				...counsellor,
				grantedAuthorities: [
					...counsellor.grantedAuthorities,
					'AUTHORIZATION_CREATE_NEW_CHAT'
				],
				agencies: twoAgencies
					? [
							...counsellor.agencies,
							{ ...counsellor.agencies[0], ...SECOND_AGENCY }
						]
					: counsellor.agencies
			}
		: counsellor;
	setTenantSettings(flags as any);
	const store = createStore();
	const routerConfig = RouterConfigConsultant(settings);
	const providers: [React.Context<any>, any][] = [
		[AppConfigContext, settings],
		[ResponsiveContext, { width }],
		[
			UserDataContext,
			{
				userData: { ...userData, liveChatViaSidebar },
				setUserData: vi.fn()
			}
		],
		[TenantContext, { tenant: { id: 1, settings: flags }, setTenant() {} }],
		[
			ConsultantListContext,
			{ consultantList: [], setConsultantList: vi.fn() }
		],
		[ServerSettingsContext, { getSetting: () => undefined }],
		[TopicsContext, { topics: [], setTopics: vi.fn() }],
		[
			ConsultingTypesContext,
			{
				consultingTypes: [
					{
						id: 0,
						isVideoCallAllowed: false,
						// Every real consulting type carries it; the circle's
						// waiting room reads it.
						groupChat: { isGroupChat: false }
					}
				],
				setConsultingTypes: vi.fn()
			}
		],
		[NotificationsContext, appNotifications],
		[
			LocaleContext,
			{
				locale: 'de',
				locales: ['de'],
				selectableLocales: ['de'],
				setLocale: vi.fn(),
				initLocale: 'de'
			}
		],
		[LanguagesContext, { fixed: ['de'], spoken: [] }],
		// The app-level store the navigation bar reads: practice must not fill it.
		[SessionsDataContext, { sessions: [], dispatch: appSessionsDispatch }],
		[
			MatrixClientContext,
			{
				matrixClientService: realMatrixService,
				setMatrixClientService: vi.fn()
			}
		]
	];
	const app = (viewportWidth = width) => (
		<I18nextProvider i18n={translations}>
			<JotaiProvider store={store}>
				<MemoryRouter initialEntries={[HELP_ROUTE]}>
					{providers.reduceRight(
						(child, [Context, value]) => (
							<Context.Provider
								value={
									Context === ResponsiveContext
										? { width: viewportWidth }
										: value
								}
							>
								{child}
							</Context.Provider>
						),
						// The shell as `Routing` wires it, below `PracticeLayer`.
						<PracticeLayer>
							<Walkthrough />
							<PracticeBanner />
							<NavigationBar
								routerConfig={routerConfig}
								onLogout={() => undefined}
							/>
							<Header />
							<RouteProbe />
							<PracticeSurface>
								<Routes>
									<Route
										path="sessions/*"
										element={
											<SessionsZone
												routerConfig={routerConfig}
											/>
										}
									/>
									<Route
										path={CALENDAR_ROUTE.slice(1)}
										element={<CalendarPageWired />}
									/>
									<Route
										path={SETTINGS_ROUTE.slice(1)}
										element={<LiveChatAvailability />}
									/>
									<Route
										path="*"
										element={
											<div data-testid="help-page">
												<PracticeOverviewSection />
											</div>
										}
									/>
								</Routes>
							</PracticeSurface>
						</PracticeLayer>
					)}
				</MemoryRouter>
			</JotaiProvider>
		</I18nextProvider>
	);
	const view = render(app(), {
		wrapper: strictMode ? React.StrictMode : undefined
	});
	const resize = (viewportWidth: number) => view.rerender(app(viewportWidth));
	/** Starts a flow from its real card on the Help page. */
	const start = async (tourId: string) => {
		const title = practiceTours.find(
			(tour) => tour.id === tourId
		)!.titleKey;
		const card = (
			await screen.findByRole('heading', { name: title }, SLOW)
		).closest('li')!;
		fireEvent.click(
			within(card).getByRole('button', {
				name: 'practice.cards.action.start'
			})
		);
	};
	/** A launch request that did not come from a card (e.g. a stale one). */
	const request = (tourId: string) =>
		act(() =>
			store.set(tourLaunchRequestAtom, {
				tourId,
				mode: 'start',
				requestedAt: Date.now()
			})
		);
	return { ...view, store, start, request, resize };
};

beforeEach(async () => {
	joyride = null;
	network.length = 0;
	realMatrixWrites.length = 0;
	storageWrites.length = 0;
	networkFetch.mockClear();
	appNotifications.addEventNotification.mockClear();
	appSessionsDispatch.mockClear();
	vi.stubGlobal('fetch', networkFetch);
	vi.stubGlobal('indexedDB', { open: vi.fn() });
	await translations.init({
		lng: 'de',
		fallbackLng: 'de',
		// Product keys render as themselves; only the practice script has texts.
		resources: {
			de: { translation: { practiceScript: practiceScriptBlock('de') } }
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
	setMatrixClientServiceRef(realMatrixService as any);
	const setItem = Storage.prototype.setItem;
	vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
		this: Storage,
		key: string,
		value: string
	) {
		// The shell's own writes before practice starts are not practice state.
		if (getPracticeSnapshot().status !== 'inactive')
			storageWrites.push(key);
		setItem.call(this, key, value);
	});
});

afterEach(async () => {
	cleanup();
	await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
	await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
	expect(getPracticeSnapshot().status).toBe('inactive');
	expect(getMatrixClientService()).toBe(realMatrixService);
	setMatrixClientServiceRef(null);
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const SLOW = { timeout: 15000 };

/** The step the tour shows now: its index, and its anchor live in the page. */
const expectStep = async (index: number) => {
	await waitFor(() => {
		expect(
			joyride?.run,
			`Expected active step ${index}; current index ${joyride?.stepIndex}; route ${route()}`
		).toBe(true);
		expect(joyride?.stepIndex).toBe(index);
	}, SLOW);
	const { target } = joyride!.steps[index];
	if (target !== 'body') {
		expect(document.querySelector(target), target).toBeTruthy();
	}
	return target === 'body'
		? null
		: document.querySelector<HTMLElement>(target)!;
};

/** The step that points at this tour target, in the resolved run. */
const stepIndexOf = (name: string) => {
	const index =
		joyride?.steps.findIndex(
			({ target }) => target === `[data-tour-target="${name}"]`
		) ?? -1;
	expect(index, name).toBeGreaterThanOrEqual(0);
	return index;
};

const pressNext = (index: number) =>
	act(() => {
		joyride!.onEvent({
			action: 'next',
			index,
			status: 'running',
			type: 'step:after'
		});
	});

/** The real action makes the world emit the step's event, exactly once. */
const afterWorldEvent = async (
	name: PracticeTourEventName,
	action: () => Promise<void>
) => {
	const seen = vi.fn();
	const off = subscribeToTourEvent(name, seen);
	try {
		await action();
		await waitFor(() => expect(seen).toHaveBeenCalled(), SLOW);
		expect(seen).toHaveBeenCalledTimes(1);
	} finally {
		off();
	}
};

const liveEditor = (scope: () => HTMLElement | null) => {
	const editor = scope()?.querySelector<any>(
		'.ProseMirror[contenteditable="true"]'
	)?.editor;
	return editor && !editor.isDestroyed ? editor : null;
};

/** Types through the real TipTap editor and presses the real send button. */
const typeAndSend = async (scope: () => HTMLElement | null, text: string) => {
	await waitFor(() => {
		const editor = liveEditor(scope);
		expect(editor).toBeTruthy();
		if (!editor.getText().includes(text)) {
			act(() => {
				editor.chain().focus().insertContent(text).run();
			});
		}
		expect(liveEditor(scope)?.getText()).toContain(text);
	}, SLOW);
	const send = await waitFor(() => {
		const button = within(scope()!).getByRole('button', {
			name: 'enquiry.write.input.button.title'
		});
		expect(button.hasAttribute('disabled')).toBe(false);
		return button;
	});
	await act(async () => {
		fireEvent.click(send);
	});
};

const textOf = (selector: string) =>
	document.querySelector(selector)?.textContent ?? '';

/** A practice id anywhere in the path or the query, e.g. a search for "-1". */
const addressesPractice = (href: string) => {
	const url = new URL(href, 'http://localhost');
	return [
		...url.pathname.split('/').map(decodeURIComponent),
		...url.searchParams.values()
	].some((part) => isPracticeId(part) || part.includes('practice'));
};

/** The page-level safety net: nothing of the practice world left the page. */
const expectNothingLeftThePracticeWorld = () => {
	const writes = network.filter(({ method }) => method !== 'GET');
	expect(
		writes.filter(({ url }) => !url.includes(TUTORIAL_PROGRESS))
	).toEqual([]);
	expect(network.filter(({ url }) => addressesPractice(url))).toEqual([]);
	expect(realMatrixWrites).toEqual([]);
	expect(storageWrites).toEqual([]);
	expect(appNotifications.addEventNotification).not.toHaveBeenCalled();
	expect(appSessionsDispatch).not.toHaveBeenCalled();
	expect(getPracticeNetworkGuard()?.blockedRequests ?? []).toEqual([]);
};

/** The availability keys the real toggle shares between tabs. */
const liveChatStorage = () =>
	LIVE_CHAT_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)]);
const settingsSwitch = () =>
	screen.getByRole<HTMLInputElement>('switch', {
		name: 'profile.functions.liveChat.toggleLabel'
	});
const railToggle = () =>
	document.querySelector<HTMLElement>(
		'[data-tour-target="livechat-availability-toggle"]'
	)!;

/**
 * The availability step: on the settings page, pointing at whichever control
 * the counsellor uses; switching it on moves the tour on.
 */
const switchPracticeAvailabilityOn = async (control: () => HTMLElement) => {
	const step = stepIndexOf('livechat-availability-control');
	const target = await expectStep(step);
	expect(route()).toBe(SETTINGS_ROUTE);
	// The anchor is the control, or sits inside it (the rail button).
	expect(target!.contains(control()) || control().contains(target)).toBe(
		true
	);
	// Practice starts "off", whatever the real state.
	expect(
		control().getAttribute('aria-checked') ??
			String((control() as HTMLInputElement).checked)
	).toBe('false');
	await afterWorldEvent(PRACTICE_TOUR_EVENTS.liveChatAvailable, async () => {
		fireEvent.click(control());
	});
};

/**
 * Nothing reached the real availability: no PUT, no heartbeat POST, no
 * shared preference, lease or loss record in localStorage.
 */
const expectRealAvailabilityUntouched = (before: unknown) => {
	expect(
		network.filter(
			({ method, url }) =>
				url.includes(LIVE_CHAT_AVAILABILITY) && method !== 'GET'
		)
	).toEqual([]);
	expect(
		storageWrites.filter((key) => key.startsWith('oriso_liveChat'))
	).toEqual([]);
	expect(liveChatStorage()).toEqual(before);
};

/** The enquiry steps of F1 up to the open enquiry: 1 and 2 in both variants. */
const openThePracticeEnquiry = async () => {
	// 1: the Anfragen icon in the real navigation bar; Next.
	await expectStep(0);
	expect(getPracticeSnapshot().status).toBe('active');
	expect(uiVersionSwitch()).toBeNull();
	pressNext(0);

	// 2: the practice enquiry, the only row of the real list; click it.
	await expectStep(1);
	expect(route()).toBe(PRACTICE_ENQUIRIES_ROUTE);
	expect(
		document.querySelectorAll('[data-cy="session-list-item"]')
	).toHaveLength(1);
	const listItemSelector = joyride!.steps[1].target;
	// Restart remounts the sandbox list. A row captured before that swap is
	// detached, and fireEvent on it never reaches the tour's document listener.
	await waitFor(() => {
		const row = document.querySelector<HTMLElement>(listItemSelector);
		expect(row?.isConnected).toBe(true);
		expect(row?.textContent).toContain(SCRIPT.cast.asker.displayName);
	}, SLOW);
	await act(async () => {
		fireEvent.click(document.querySelector<HTMLElement>(listItemSelector)!);
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
	});
};

/** F1 from the accept step on; `at` is the accept step's index. */
const acceptAndAnswer = async (at: number) => {
	// The real accept button; click it.
	const accept = await expectStep(at);
	await afterWorldEvent(PRACTICE_TOUR_EVENTS.enquiryAccepted, async () => {
		fireEvent.click(accept!);
	});
	await waitFor(
		() => expect(route()).toMatch(/sessionView\/!practice-1/),
		SLOW
	);

	// The Erstantwort and the asker's message; Next.
	await expectStep(at + 1);
	await waitFor(
		() =>
			expect(textOf('.chatStage__mainPane')).toContain(
				SCRIPT.texts.askerFirstMessage
			),
		SLOW
	);
	pressNext(at + 1);

	// The composer; the reply is answered by the script.
	await expectStep(at + 2);
	// No attachments while practising, not even by drag and drop.
	expect(document.querySelector('.dragAndDropArea')).toBeNull();
	const reply = 'Hallo Sam, schön, dass Sie sich melden.';
	await afterWorldEvent(PRACTICE_TOUR_EVENTS.messageSent, () =>
		typeAndSend(() => document.querySelector('.chatStage__mainPane'), reply)
	);
	await waitFor(
		() =>
			expect(textOf('.chatStage__mainPane')).toContain(
				SCRIPT.texts.askerReply
			),
		SLOW
	);
};

/** The last step: completion is written, practice ends, back to Help. */
const finish = async (at: number) => {
	await expectStep(at);
	pressNext(at);
	await waitFor(
		() => expect(getPracticeSnapshot().status).toBe('inactive'),
		SLOW
	);
	expect(route()).toBe(HELP_ROUTE);
	expect(screen.getByTestId('help-page')).toBeTruthy();
	expect(uiVersionSwitch()).not.toBeNull();
	expect(window.fetch).toBe(networkFetch);
	expect(progressWrites()).toContain('completed');
	expectNothingLeftThePracticeWorld();
};

const progressWrites = () =>
	network
		.filter(
			({ method, url }) =>
				method === 'PUT' && url.includes(TUTORIAL_PROGRESS)
		)
		.map(({ status }) => status);

const banner = () =>
	within(screen.getByRole('status', { name: 'practice.banner.title' }));

/**
 * The Gesprächskreis flow from the settings on (FE#2545): "Erstellen" makes
 * the circle in memory, the list opens it, the waiting room starts it, the
 * call button shows the simulated start (D3), and the tour completes.
 */
const createOpenStartAndCall = async (
	configureIndex: number,
	{ agency, topic }: { agency?: string; topic?: boolean } = {}
) => {
	// The settings card: what "Erstellen" needs is filled in there, inside
	// the spotlight; then Next.
	const card = await expectStep(configureIndex);
	expect(joyride!.steps[configureIndex]).toMatchObject({
		disableFocusTrap: true
	});
	expect(joyride!.steps[configureIndex]).not.toHaveProperty(
		'blockTargetInteraction'
	);
	if (topic) {
		fireEvent.click(
			within(card!).getByRole('button', {
				name: 'groupChat.circle.topicLabel'
			})
		);
		fireEvent.click(
			await screen.findByRole('option', { name: SCRIPT.names.topic })
		);
	}
	if (agency) {
		fireEvent.mouseDown(within(card!).getByRole('combobox'));
		fireEvent.click(await screen.findByRole('option', { name: agency }));
	}
	pressNext(configureIndex);

	// The real "Erstellen" of the settings; the circle is made in memory.
	const settingsIndex = configureIndex + 1;
	const settings = await expectStep(settingsIndex);
	await waitFor(() => expect(settings!.hasAttribute('disabled')).toBe(false));
	await afterWorldEvent(PRACTICE_TOUR_EVENTS.circleCreated, async () => {
		fireEvent.click(settings!);
	});

	// Back in the list (no share dialog): the new circle; click it.
	const open = settingsIndex + 1;
	await expectStep(open);
	await waitFor(
		() => expect(route()).toBe('/sessions/consultant/sessionView'),
		SLOW
	);
	expect(screen.queryByRole('dialog')).toBeNull();
	const rowSelector = joyride!.steps[open].target;
	await waitFor(() => {
		const row = document.querySelector<HTMLElement>(rowSelector);
		expect(row?.isConnected).toBe(true);
		expect(row?.textContent).toContain(SCRIPT.names.topic);
	}, SLOW);
	await act(async () => {
		fireEvent.click(document.querySelector<HTMLElement>(rowSelector)!);
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
	});
	await waitFor(
		() => expect(route()).toMatch(/sessionView\/!practice-4[^/]*\/-2/),
		SLOW
	);

	// The waiting room's real "Video-Call starten"; it starts the circle.
	const start = await expectStep(open + 1);
	const startButton = within(start!).getByRole('button', {
		name: 'videoCall.button.startVideoCall'
	});
	await afterWorldEvent(PRACTICE_TOUR_EVENTS.circleStarted, async () => {
		await act(async () => {
			fireEvent.click(startButton);
		});
	});

	// The call button of the started circle, used: practice shows a
	// simulated start (D3) and reaches neither the media nor a prompt.
	const call = await expectStep(open + 2);
	expect(route()).toMatch(/sessionView\/!practice-4/);
	const getUserMedia = vi.fn();
	Object.defineProperty(navigator, 'mediaDevices', {
		configurable: true,
		value: { getUserMedia }
	});
	const confirm = vi.spyOn(window, 'confirm');
	const alert = vi.spyOn(window, 'alert');
	await afterWorldEvent(PRACTICE_TOUR_EVENTS.circleCallStarted, async () => {
		await act(async () => {
			fireEvent.click(call!.querySelector('.button__item, button')!);
		});
	});
	expect(getUserMedia).not.toHaveBeenCalled();
	expect(confirm).not.toHaveBeenCalled();
	expect(alert).not.toHaveBeenCalled();
	expect(screen.getByText('practice.callStart.description')).toBeTruthy();
	fireEvent.click(screen.getByTestId('practice-call-start-close'));
	await waitFor(() =>
		expect(screen.queryByText('practice.callStart.description')).toBeNull()
	);

	// Done: completion is written for the circle tour itself, and the
	// circle never left the page.
	await finish(open + 3);
	expect(
		network.filter(({ url }) => url.includes('/service/users/chat'))
	).toEqual([]);
};

/** The open "Neuer Eintrag" dialog (or another calendar dialog) by test id. */
const calendarDialog = async (testId: string): Promise<HTMLElement> => {
	let dialog: HTMLElement | null = null;
	await waitFor(() => {
		dialog = document.querySelector<HTMLElement>(
			`[data-testid="${testId}"]`
		);
		expect(dialog, testId).not.toBeNull();
	}, SLOW);
	return dialog!;
};

/**
 * "Neuer Eintrag" on the real calendar: the practice advice seeker is the
 * one conversation to choose; optionally with "Weitere Personen per Link
 * einladen" on. Saved with the dialog's own button.
 */
const createPracticeAppointment = async (
	createButton: HTMLElement,
	{ inviteOthers = false } = {}
) => {
	await act(async () => {
		fireEvent.click(createButton);
	});
	const dialog = await calendarDialog('calendar-appointment-dialog');
	fireEvent.mouseDown(within(dialog).getByRole('combobox'));
	fireEvent.click(
		await screen.findByRole('option', {
			name: SCRIPT.cast.asker.username
		})
	);
	if (inviteOthers) {
		fireEvent.click(
			within(dialog).getByRole('switch', {
				name: 'directInvitation.dialog.inviteOthers'
			})
		);
	}
	await act(async () => {
		fireEvent.click(
			within(dialog).getByTestId('calendar-appointment-save')
		);
	});
};

/**
 * Nothing of the calendar exercise reached the real calendar or links, from
 * the practice start (`from`, an index into `network`) on. The navigation's
 * own real proposal count before the start is not practice.
 */
const expectCalendarStayedInPractice = (from: number) =>
	expect(
		network
			.slice(from)
			.filter(({ url }) =>
				/\/calendar\b|\/appointments\b|direct-invitations|directlinks/.test(
					url
				)
			)
	).toEqual([]);

/**
 * Opens the header "+" menu of the open case and picks an entry, until its
 * dialog shows. The composer takes the focus once the case has opened, and
 * focus outside the menu closes it, also between finding and clicking an
 * entry: open it again until the dialog is there.
 */
const pickPlusMenuEntry = async (entry: 'supervision' | 'handover') => {
	// The handover shows a loading state first, then the offer dialog.
	const dialogTestIds =
		entry === 'supervision'
			? ['manage-people-dialog']
			: ['supervisor-dialog', 'case-handover-state-dialog'];
	const opened = () => dialogTestIds.some((id) => screen.queryByTestId(id));
	const settle = () =>
		act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
	for (let attempt = 0; attempt < 60; attempt++) {
		if (opened()) return;
		const item = document.querySelector<HTMLElement>(
			`[data-cy="session-header-plus-${entry}"]`
		);
		if (!item) {
			fireEvent.click(
				document.querySelector<HTMLElement>(
					'[data-tour-target="session-supervisor-add"]'
				)!
			);
		} else if (item.getAttribute('aria-disabled') !== 'true') {
			// "Supervisor verwalten" waits for the conversation features.
			fireEvent.click(item);
		}
		await settle();
	}
	expect(opened()).toBe(true);
};

/** Picks an option of a real (MUI) select inside the given dialog. */
const choose = async (
	select: HTMLElement,
	option: string | RegExp | ((name: string) => boolean)
) => {
	fireEvent.mouseDown(within(select).getByRole('combobox'));
	fireEvent.click(
		await screen.findByRole(
			'option',
			{
				name:
					typeof option === 'function'
						? (name: string) => option(name)
						: option
			},
			SLOW
		)
	);
};

/** The supervisor part (the former F2): "+" → "Supervisor verwalten", Robin, a reason, confirm. */
const addTheSupervisor = async () => {
	await pickPlusMenuEntry('supervision');
	fireEvent.click(
		await screen.findByRole(
			'button',
			{ name: 'managePeople.add.labelFor' },
			SLOW
		)
	);
	fireEvent.change(
		await screen.findByPlaceholderText(
			'managePeople.supervision.reasonPlaceholder'
		),
		{ target: { value: 'Ich möchte mich zum Vorgehen absichern.' } }
	);
	await act(async () => {
		fireEvent.click(
			screen.getByRole('button', { name: 'managePeople.add.confirm' })
		);
	});
};

/** "+" → "Beratung übergeben": Alex, the first reason, "Übergabe anbieten". */
const offerTheCaseToAlex = async () => {
	await pickPlusMenuEntry('handover');
	const dialog = await screen.findByTestId('supervisor-dialog', {}, SLOW);
	await choose(
		within(dialog).getByTestId('supervisor-dialog-person'),
		(name: string) => name.startsWith(SCRIPT.cast.colleague.displayName)
	);
	fireEvent.mouseDown(
		within(
			within(dialog).getByTestId('supervisor-dialog-reason')
		).getByRole('combobox')
	);
	const reasons = (await screen.findAllByRole('option', {}, SLOW)).filter(
		(option) => option.getAttribute('data-value')
	);
	fireEvent.click(reasons[0]);
	await act(async () => {
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'supervisorDialog.confirm.handover'
			})
		);
	});
};

/** Types the colleague's name into the real search of the sessions list. */
const searchForAlex = async (search: HTMLElement) => {
	const input = await waitFor(() => {
		const field = search.querySelector<HTMLInputElement>('input');
		if (!field) {
			fireEvent.click(
				within(search).getByRole('button', {
					name: 'sessionList.toolbar.search.toggle'
				})
			);
		}
		expect(field).toBeTruthy();
		return field!;
	}, SLOW);
	fireEvent.focus(input);
	fireEvent.change(input, { target: { value: 'Alex' } });
	// The search runs after its debounce; the menu still lies over the list,
	// so the tour must not move on yet (Dev, FE#2545).
	await act(() => new Promise<void>((resolve) => setTimeout(resolve, 600)));
	expect(joyride?.stepIndex).toBe(stepIndexOf('sessions-search'));
	expect(
		document.querySelector('[data-testid="session-search-results-scroll"]')
	).toBeTruthy();
	// "✓" / Enter closes the menu: only now is "Zugriff anfragen" reachable.
	fireEvent.keyDown(input, { key: 'Enter' });
};

/** The curtain wizard: "Schritt für Schritt zeigen", a reason, "Weiter", a text, "Zugriff anfragen". */
const requestAccessThroughTheCurtain = async (curtain: HTMLElement) => {
	fireEvent.click(
		within(curtain).getByRole('button', {
			name: 'caseHandover.curtain.intro.cta'
		})
	);
	const [firstReason] = await within(curtain).findAllByRole(
		'radio',
		{},
		SLOW
	);
	fireEvent.click(firstReason);
	const next = () =>
		document.querySelector<HTMLButtonElement>(
			'[data-cy="case-handover-curtain-next"]'
		)!;
	await waitFor(() => expect(next().disabled).toBe(false), SLOW);
	fireEvent.click(next());
	const explanation = await waitFor(() => {
		const field = document.querySelector<HTMLTextAreaElement>(
			'[data-cy="case-handover-curtain-explanation"]'
		);
		expect(field).toBeTruthy();
		return field!;
	}, SLOW);
	fireEvent.change(explanation, {
		target: { value: 'Ich vertrete Alex in dieser Woche.' }
	});
	await waitFor(() => expect(next().disabled).toBe(false), SLOW);
	await act(async () => {
		fireEvent.click(next());
	});
};

describe('practice flows on the real app shell', () => {
	it('keeps the real practice sandbox active during StrictMode replay and restores the real service after unmount', async () => {
		const app = renderApp({ strictMode: true });
		await app.request(HANDOVER);
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
		expect(getPracticeNetworkGuard()?.isInstalled).toBe(true);
		expect(getMatrixClientService()).not.toBe(realMatrixService);

		app.unmount();
		await waitFor(() =>
			expect(getPracticeSnapshot().status).toBe('inactive')
		);
		expect(getMatrixClientService()).toBe(realMatrixService);
	});

	it.each([true, false])(
		'F1 (team chat %s): six steps, no team button anchor, the same real actions (FE#2491)',
		async (teamDiscussion) => {
			const app = renderApp({ teamDiscussion });
			await app.start(ACCEPT);
			await openThePracticeEnquiry();
			expect(joyride!.steps).toHaveLength(6);

			// 3-5: accept straight away, Erstantwort, reply. The team chat
			// lives in "Weitere Funktionen" now; no button beside "Annehmen".
			await expectStep(2);
			expect(
				document.querySelector('[data-cy="enquiry-open-team"]')
			).toBeNull();
			await acceptAndAnswer(2);

			// 6: done.
			await finish(5);
		},
		120000
	);

	it('Live chat (FE#2545): availability is switched on in practice only, then a practice live chat waits, is started with the real button and answered', async () => {
		const app = renderApp();
		const storageBefore = liveChatStorage();
		// The Help list starts topic tours by request; there is no card.
		await app.request(LIVE_CHAT);

		// 1: what is different about live chat; Next.
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
		pressNext(0);

		// 2: "Bin verfügbar" on the real settings page; switch it on.
		await switchPracticeAvailabilityOn(settingsSwitch);

		// 3: switching on landed on the shared queue, the live-chat filter
		// already on (as in real life); Next.
		const queue = stepIndexOf('livechat-queue');
		await expectStep(queue);
		expect(route()).toBe(`${PRACTICE_ENQUIRIES_ROUTE}?chip=liveChat`);
		pressNext(queue);

		// 4: the waiting live chat, the only row of the queue; click it.
		const open = stepIndexOf('enquiry-list-item');
		await expectStep(open);
		// The queue filter stays on: only live chats are listed.
		expect(route()).toBe(`${PRACTICE_ENQUIRIES_ROUTE}?chip=liveChat`);
		const rowSelector = joyride!.steps[open].target;
		await waitFor(() => {
			const row = document.querySelector<HTMLElement>(rowSelector);
			expect(row?.isConnected).toBe(true);
			expect(row?.textContent).toContain(SCRIPT.cast.asker.displayName);
		}, SLOW);
		await act(async () => {
			fireEvent.click(document.querySelector<HTMLElement>(rowSelector)!);
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
		});

		// The real "Chat starten"; it takes the live-chat accept path.
		const accept = await expectStep(open + 1);
		await afterWorldEvent(
			PRACTICE_TOUR_EVENTS.enquiryAccepted,
			async () => {
				fireEvent.click(accept!);
			}
		);
		expect(
			network.some(({ url }) =>
				url.includes('/conversations/askers/anonymous/')
			)
		).toBe(false);
		await waitFor(
			() => expect(route()).toMatch(/sessionView\/!practice-1/),
			SLOW
		);

		// The composer; the scripted asker answers the first reply.
		await expectStep(open + 2);
		await waitFor(
			() =>
				expect(textOf('.chatStage__mainPane')).toContain(
					SCRIPT.texts.askerFirstMessage
				),
			SLOW
		);
		await afterWorldEvent(PRACTICE_TOUR_EVENTS.messageSent, () =>
			typeAndSend(
				() => document.querySelector('.chatStage__mainPane'),
				'Hallo, schön, dass Sie schreiben. Was beschäftigt Sie?'
			)
		);
		await waitFor(
			() =>
				expect(textOf('.chatStage__mainPane')).toContain(
					SCRIPT.texts.askerReply
				),
			SLOW
		);

		// Done: completion is written for the live-chat tour itself.
		await finish(open + 3);
		expectRealAvailabilityUntouched(storageBefore);
	}, 120000);

	it('Live chat with the switch in the menu bar (FE#2545): the rail toggle switches practice availability on, and the real state shows again after End', async () => {
		const app = renderApp({ liveChatViaSidebar: true });
		const storageBefore = liveChatStorage();
		await app.request(LIVE_CHAT);
		await expectStep(0);
		pressNext(0);

		// The settings switch only mirrors the state here: the rail is the control.
		await switchPracticeAvailabilityOn(railToggle);
		expect(settingsSwitch).toThrow();
		expect(railToggle().getAttribute('aria-checked')).toBe('true');
		// The queue step follows on the enquiries list.
		await expectStep(stepIndexOf('livechat-queue'));

		fireEvent.click(
			banner().getByRole('button', { name: 'practice.banner.end' })
		);
		await waitFor(
			() => expect(getPracticeSnapshot().status).toBe('inactive'),
			SLOW
		);
		// The real state, off, shows again.
		await waitFor(() =>
			expect(railToggle().getAttribute('aria-checked')).toBe('false')
		);
		expectNothingLeftThePracticeWorld();
		expectRealAvailabilityUntouched(storageBefore);
	}, 120000);

	it('Live chat: narrowing the window ends the practice run instead of swapping in the explanation tour, and widening does not restart it', async () => {
		const app = renderApp({ width: 1440 });
		await app.request(LIVE_CHAT);
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');

		app.resize(899);
		await waitFor(
			() => expect(getPracticeSnapshot().status).toBe('inactive'),
			SLOW
		);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

		app.resize(1440);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(screen.queryByTestId('practice-banner')).toBeNull();
		expect(progressWrites()).not.toContain('completed');
	}, 120000);

	it('Live chat launched on a small screen keeps its explanation tour, also after widening', async () => {
		const app = renderApp({ width: 899 });
		await app.request(LIVE_CHAT);
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('inactive');

		app.resize(1440);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(getPracticeNetworkGuard()).toBeFalsy();
		expect(screen.queryByTestId('practice-banner')).toBeNull();
		// Still the explanation tour, on its first step.
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('inactive');
	});

	it('Live chat without the practice area: the explanation tour runs on the real page', async () => {
		const app = renderApp({ practiceArea: false });
		await app.request(LIVE_CHAT);
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(getPracticeNetworkGuard()).toBeFalsy();
	});

	it.each([
		{ twoAgencies: false, agency: undefined },
		// Dev: a counsellor of several Beratungsstellen gets none preselected,
		// and "Erstellen" waits for her choice in the settings card.
		{ twoAgencies: true, agency: SECOND_AGENCY.name }
	])(
		'Gesprächskreis (FE#2545, two agencies: $twoAgencies): the real create flow makes a practice circle, which is opened, started and its call start simulated',
		async ({ twoAgencies, agency }) => {
			const app = renderApp({ groupCircle: true, twoAgencies });
			// The Help list starts topic tours by request; there is no card.
			await app.request(GROUP_CIRCLE);

			// 1: an exercise, nothing is real; Next.
			await expectStep(0);
			expect(getPracticeSnapshot().status).toBe('active');
			pressNext(0);

			// 2: the real "Erstellen" of the counsellor's own list; click it.
			const create = stepIndexOf('groupchat-create-button');
			const createButton = await expectStep(create);
			expect(route()).toBe('/sessions/consultant/sessionView');
			await act(async () => {
				fireEvent.click(createButton!);
				await new Promise<void>((resolve) => setTimeout(resolve, 0));
			});

			// 3: the circle card among the formats; Next.
			const format = await expectStep(create + 1);
			expect(format!.dataset.tourTarget).toBe('groupchat-format-circle');
			pressNext(create + 1);

			// 4: the topic: open the list, pick the practice topic, continue.
			const picker = await expectStep(create + 2);
			fireEvent.click(
				within(picker!).getByRole('button', {
					name: 'groupChat.circle.topicLabel'
				})
			);
			fireEvent.click(
				await screen.findByRole('option', { name: SCRIPT.names.topic })
			);
			await act(async () => {
				fireEvent.click(
					within(picker!).getByRole('button', {
						name: SCRIPT.names.topic
					})
				);
			});

			if (twoAgencies) {
				await expectStep(create + 3);
				expect(
					document
						.querySelector(
							'[data-tour-target="groupchat-circle-create"]'
						)!
						.hasAttribute('disabled')
				).toBe(true);
			}
			await createOpenStartAndCall(create + 3, { agency });
		},
		120000
	);

	it('Gesprächskreis with only the circle format: the picker steps are skipped and the flow still ends at done', async () => {
		const app = renderApp({ groupCircle: true, circleOnly: true });
		await app.request(GROUP_CIRCLE);
		await expectStep(0);
		pressNext(0);

		const create = stepIndexOf('groupchat-create-button');
		const createButton = await expectStep(create);
		await act(async () => {
			fireEvent.click(createButton!);
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
		});

		// No format picker, no topic card: the settings open directly, and
		// the tour goes on at their card. The topic is picked there.
		await expectStep(create + 3);
		expect(
			document.querySelector(
				'[data-tour-target="groupchat-format-circle"]'
			)
		).toBeNull();
		expect(
			document
				.querySelector('[data-tour-target="groupchat-circle-create"]')!
				.hasAttribute('disabled')
		).toBe(true);

		await createOpenStartAndCall(create + 3, { topic: true });
	}, 120000);

	it('Gesprächskreis without the practice area: the explanation tour runs on the real page', async () => {
		const app = renderApp({ practiceArea: false, groupCircle: true });
		await app.request(GROUP_CIRCLE);
		await expectStep(0);
		expect(joyride!.steps).toHaveLength(6);
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(getPracticeNetworkGuard()).toBeFalsy();
	});

	it('Kalender (FE#2545): a practice appointment, a Terminlink, a cancel, a Sperrzeit and automatic confirmation, all through the real calendar', async () => {
		const app = renderApp();
		// The Help list starts topic tours by request; there is no card.
		await app.request(CALENDAR);

		// 1: an exercise, nothing is real; Next.
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
		const practiceStart = network.length;
		pressNext(0);

		// 2: "Neuer Eintrag": an appointment with the practice advice seeker.
		const appointment = stepIndexOf('calendar-create');
		const create = await expectStep(appointment);
		expect(route()).toBe(CALENDAR_ROUTE);
		await afterWorldEvent(
			PRACTICE_TOUR_EVENTS.calendarAppointmentCreated,
			() => createPracticeAppointment(create!)
		);

		// 3: again, now with "Weitere Personen per Link einladen": the
		// Terminlink is made in memory and its share dialog opens.
		const invitation = await expectStep(appointment + 1);
		await afterWorldEvent(
			PRACTICE_TOUR_EVENTS.calendarInvitationCreated,
			() => createPracticeAppointment(invitation!, { inviteOthers: true })
		);
		const share = await calendarDialog('direct-link-share-dialog');
		// The practice link points at a reserved host: it leads nowhere.
		expect(
			within(share).getByDisplayValue(/^https:\/\/practice\.invalid\//)
		).toBeTruthy();
		fireEvent.click(
			within(share).getByRole('button', { name: 'app.close' })
		);

		// 4: "Als Nächstes" lists both; one is cancelled from its menu.
		const cancel = stepIndexOf('calendar-upcoming');
		const upcoming = await expectStep(cancel);
		const row = await waitFor(() => {
			const found = upcoming!.querySelector<HTMLElement>(
				'[data-cy^="calendar-upcoming-practice-appointment-"]'
			);
			expect(found).not.toBeNull();
			return found!;
		}, SLOW);
		expect(row.textContent).toContain(SCRIPT.cast.asker.username);
		await afterWorldEvent(
			PRACTICE_TOUR_EVENTS.calendarAppointmentCancelled,
			async () => {
				fireEvent.click(row);
				fireEvent.click(
					await waitFor(() => {
						const item = document.querySelector<HTMLElement>(
							'[data-cy="calendar-entry-cancel"]'
						);
						expect(item).not.toBeNull();
						return item!;
					})
				);
				await act(async () => {
					fireEvent.click(
						await screen.findByTestId('calendar-cancel-confirm')
					);
				});
			}
		);

		// 5: "Neuer Eintrag" again, tab "Sperrzeit".
		const blocker = await expectStep(cancel + 1);
		await afterWorldEvent(
			PRACTICE_TOUR_EVENTS.calendarBlockerCreated,
			async () => {
				await act(async () => {
					fireEvent.click(blocker!);
				});
				fireEvent.click(
					await screen.findByRole('tab', {
						name: 'calendar.dialog.tabs.blocker'
					})
				);
				const dialog = await calendarDialog('calendar-blocker-dialog');
				await act(async () => {
					fireEvent.click(
						within(dialog).getByTestId('calendar-blocker-save')
					);
				});
			}
		);

		// 6: ⋮ → Sprechstunden: "Buchungen automatisch bestätigen" on, saved.
		const settings = await expectStep(stepIndexOf('calendar-settings'));
		await afterWorldEvent(
			PRACTICE_TOUR_EVENTS.calendarAutoAcceptOn,
			async () => {
				fireEvent.click(settings!);
				fireEvent.click(
					await screen.findByText('calendar.consultationHours.title')
				);
				const dialog = await calendarDialog(
					'calendar-consultation-hours-dialog'
				);
				const autoAccept = within(dialog).getByTestId(
					'consultation-hours-auto-accept'
				);
				fireEvent.click(
					autoAccept.querySelector('input') ?? autoAccept
				);
				await act(async () => {
					fireEvent.click(
						within(dialog).getByTestId('consultation-hours-save')
					);
				});
			}
		);

		// Done: completion is written for the calendar tour itself, and
		// nothing of the exercise reached the real calendar.
		await finish(stepIndexOf('calendar-settings') + 1);
		expectCalendarStayedInPractice(practiceStart);
	}, 120000);

	it('Kalender without the practice area: the explanation tour runs on the real page', async () => {
		const app = renderApp({ practiceArea: false });
		await app.request(CALENDAR);
		await expectStep(0);
		expect(joyride!.steps).toHaveLength(7);
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(getPracticeNetworkGuard()).toBeFalsy();
	});

	it("Fälle übergeben (FE#2545): adds a supervisor, offers the case to Alex, finds Alex's case and requests access, all through the real controls", async () => {
		const app = renderApp();
		// The Help list starts topic tours by request; there is no card.
		await app.request(HANDOVER);

		// 1: an exercise, nothing is real; Next.
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
		expect(joyride!.steps).toHaveLength(10);
		pressNext(0);

		// 2: "+" → "Supervisor verwalten" in the accepted practice case.
		await expectStep(1);
		expect(route()).toMatch(/sessionView\/!practice-/);
		await waitFor(
			() =>
				expect(textOf('.chatStage__mainPane')).toContain(
					SCRIPT.texts.acceptedCaseCounsellorMessage
				),
			SLOW
		);
		await afterWorldEvent(
			PRACTICE_TOUR_EVENTS.supervisorAdded,
			addTheSupervisor
		);

		// 3: Robin's reply in the side thread, not in the main chat; Next.
		const panel = await expectStep(2);
		await waitFor(
			() =>
				expect(panel!.textContent).toContain(
					SCRIPT.texts.supervisorReply
				),
			SLOW
		);
		expect(textOf('.chatStage__mainPane')).not.toContain(
			SCRIPT.texts.supervisorReply
		);
		pressNext(2);

		// 4: "+" → "Beratung übergeben": Alex, a reason, "Übergabe anbieten".
		await expectStep(3);
		await afterWorldEvent(
			PRACTICE_TOUR_EVENTS.caseHandoverOffered,
			offerTheCaseToAlex
		);

		// 5: the offer waits for Alex; the dialog shows its state and
		// "Angebot zurückziehen". Close it; Next.
		await expectStep(4);
		const state = await screen.findByTestId(
			'case-handover-state-dialog',
			{},
			SLOW
		);
		expect(
			within(state).getByRole('button', {
				name: 'caseHandover.offer.withdraw'
			})
		).toBeTruthy();
		// The primary "Schließen" in the footer (the header × has the same name).
		fireEvent.click(
			within(state)
				.getAllByRole('button', { name: 'supervisorDialog.close' })
				.at(-1)!
		);
		await waitFor(() =>
			expect(
				screen.queryByTestId('case-handover-state-dialog')
			).toBeNull()
		);
		pressNext(4);

		// 6: the real search of the sessions list; "Alex" lists Alex's case.
		const search = await expectStep(5);
		expect(route()).toMatch(/^\/sessions\/consultant\/sessionView/);
		await afterWorldEvent(PRACTICE_TOUR_EVENTS.colleagueCaseListed, () =>
			searchForAlex(search!)
		);

		// 7: "Zugriff anfragen" on Alex's case; the click moves on.
		const requestAccess = await expectStep(6);
		expect(requestAccess!.textContent).toContain(
			'caseHandover.list.requestAccess'
		);
		await act(async () => {
			fireEvent.click(
				requestAccess!.matches('button')
					? requestAccess!
					: requestAccess!.querySelector('button')!
			);
		});

		// 8: the case opens behind its curtain; the wizard sends the request.
		const curtain = await expectStep(7);
		await waitFor(
			() => expect(route()).toMatch(/sessionView\/session\/-3$/),
			SLOW
		);
		expect(textOf('.chatStage__mainPane')).not.toContain(
			SCRIPT.texts.acceptedCaseCounsellorMessage
		);
		await afterWorldEvent(PRACTICE_TOUR_EVENTS.caseHandoverRequested, () =>
			requestAccessThroughTheCurtain(curtain!)
		);
		await waitFor(
			() =>
				expect(curtain!.textContent).toContain(
					'caseHandover.pending.title'
				),
			SLOW
		);

		// 9: the status lives in the activity timeline; Next.
		await expectStep(8);
		pressNext(8);

		// 10: done. Only the completion is written; nothing else left.
		await finish(9);
		expect(progressWrites()).toEqual(expect.arrayContaining(['completed']));
		expect(
			network.filter(({ url }) => url.includes('case-handover'))
		).toEqual([]);
	}, 120000);

	it('Fälle übergeben without supervision: the supervisor steps drop out, the handover stays', async () => {
		const app = renderApp({ supervision: false });
		await app.request(HANDOVER);
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
		expect(joyride!.steps).toHaveLength(8);
		pressNext(0);
		const plus = await expectStep(1);
		expect(plus!.getAttribute('data-tour-target')).toBe(
			'session-supervisor-add'
		);
		await afterWorldEvent(
			PRACTICE_TOUR_EVENTS.caseHandoverOffered,
			offerTheCaseToAlex
		);
		await expectStep(2);
	}, 120000);

	it('Fälle übergeben without the practice area: the explanation tour runs on the real page', async () => {
		const app = renderApp({ practiceArea: false });
		await app.request(HANDOVER);
		await expectStep(0);
		expect(joyride!.steps).toHaveLength(6);
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(getPracticeNetworkGuard()).toBeFalsy();
	});

	it('cannot launch the "Fälle übergeben" practice through a stale request below its picker breakpoint', async () => {
		const app = renderApp({ width: 1199 });
		app.request(HANDOVER);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(screen.queryByTestId('practice-banner')).toBeNull();
		expect(progressWrites()).not.toContain('completed');
		app.resize(1200);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(screen.queryByTestId('practice-banner')).toBeNull();
	});

	it('can launch the "Fälle übergeben" practice at the real picker breakpoint', async () => {
		const app = renderApp({ width: 1200 });
		await app.request(HANDOVER);
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
	}, 120000);

	it('does not restart the "Fälle übergeben" practice automatically after resizing below and back above its picker breakpoint', async () => {
		const app = renderApp({ width: 1200 });
		await app.request(HANDOVER);
		await expectStep(0);

		app.resize(1199);
		await waitFor(
			() => expect(getPracticeSnapshot().status).toBe('inactive'),
			SLOW
		);
		app.resize(1200);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(screen.queryByTestId('practice-banner')).toBeNull();
		expect(progressWrites()).not.toContain('completed');

		await app.request(HANDOVER);
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
	}, 120000);

	it('keeps an unsent real composer draft and its shared index off the network during immediate auth teardown', async () => {
		const service = new MatrixClientService();
		setMatrixClientServiceRef(service);
		const app = renderApp();
		try {
			await app.request(HANDOVER);
			await expectStep(0);
			pressNext(0);
			await expectStep(1);
			const scope = () =>
				document.querySelector<HTMLElement>('.chatStage__mainPane');
			await waitFor(() => expect(liveEditor(scope)).toBeTruthy(), SLOW);
			const unsent = 'This fictional draft must stay in practice.';
			act(() =>
				liveEditor(scope).chain().focus().insertContent(unsent).run()
			);
			expect(liveEditor(scope).getText()).toContain(unsent);

			act(() => teardownLocalSession());
			app.unmount();
			// Include the asynchronous shared-index continuation of composer cleanup.
			await act(
				() => new Promise<void>((resolve) => setTimeout(resolve, 50))
			);
			expect(
				network.filter(
					({ method, url }) =>
						url.includes('/drafts') &&
						(method !== 'GET' ||
							new URL(url).searchParams.has('scopeKey'))
				)
			).toEqual([]);
			expect(progressWrites()).not.toContain('completed');
			expect(getPracticeSnapshot().status).toBe('inactive');
			expect(getMatrixClientService()).toBeNull();
		} finally {
			app.unmount();
			await act(
				() => new Promise<void>((resolve) => setTimeout(resolve, 0))
			);
			setMatrixClientServiceRef(realMatrixService as any);
		}
	}, 120000);

	it('banner End remains keyboard-accessible while the supervisor picker of "Fälle übergeben" is open', async () => {
		// The real focus trap stays active; jsdom supplies no visible geometry.
		vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
			() => [{ width: 100, height: 40 }] as unknown as DOMRectList
		);
		const app = renderApp();
		await app.request(HANDOVER);
		await expectStep(0);
		pressNext(0);
		await expectStep(1);
		await pickPlusMenuEntry('supervision');
		await screen.findByRole(
			'button',
			{ name: 'managePeople.add.labelFor' },
			SLOW
		);
		const dialog = screen.getByRole('dialog', {
			name: 'managePeople.supervision.title'
		});
		const end = banner().getByRole('button', {
			name: 'practice.banner.end'
		});
		const close = within(dialog).getByRole('button', { name: 'app.close' });
		await waitFor(() => expect(document.activeElement).toBe(close));
		await userEvent.tab({ shift: true });
		expect(document.activeElement).toBe(end);
		expect(end.closest('[aria-hidden="true"]')).toBeNull();
		await userEvent.keyboard('{Enter}');

		await waitFor(
			() => expect(getPracticeSnapshot().status).toBe('inactive'),
			SLOW
		);
		expect(document.body.contains(dialog)).toBe(false);
		expect(route()).toBe(HELP_ROUTE);
		expect(progressWrites()).not.toContain('completed');
		expectNothingLeftThePracticeWorld();
	}, 120000);

	it('banner Restart mid-flow: same guard, fresh case with the accept available again, tour back at step 1', async () => {
		const app = renderApp({ teamDiscussion: false });
		await app.start(ACCEPT);
		await openThePracticeEnquiry();
		const accept = await expectStep(2);
		await afterWorldEvent(
			PRACTICE_TOUR_EVENTS.enquiryAccepted,
			async () => {
				fireEvent.click(accept!);
			}
		);
		await expectStep(3);
		const guard = getPracticeNetworkGuard();

		fireEvent.click(
			banner().getByRole('button', { name: 'practice.banner.restart' })
		);

		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
		expect(getPracticeNetworkGuard()).toBe(guard);
		// The accepted case is an open enquiry again.
		await openThePracticeEnquiry();
		await expectStep(2);

		fireEvent.click(
			banner().getByRole('button', { name: 'practice.banner.end' })
		);
		await waitFor(
			() => expect(getPracticeSnapshot().status).toBe('inactive'),
			SLOW
		);
		expect(route()).toBe(HELP_ROUTE);
		expectNothingLeftThePracticeWorld();
	}, 120000);

	it('banner End mid-flow: the real page comes back where practice started, and the run is not marked done', async () => {
		const app = renderApp();
		await app.start(ACCEPT);
		await openThePracticeEnquiry();
		await expectStep(2);

		fireEvent.click(
			banner().getByRole('button', { name: 'practice.banner.end' })
		);

		await waitFor(
			() => expect(getPracticeSnapshot().status).toBe('inactive'),
			SLOW
		);
		expect(route()).toBe(HELP_ROUTE);
		expect(screen.getByTestId('help-page')).toBeTruthy();
		expect(joyride).toBeNull();
		expect(
			screen.queryByRole('status', { name: 'practice.banner.title' })
		).toBeNull();
		expect(progressWrites()).not.toContain('completed');
		expect(progressWrites()).not.toContain('skipped');
		expect(progressWrites().at(-1)).toBe('not_started');
		expect(window.fetch).toBe(networkFetch);
		expectNothingLeftThePracticeWorld();
	}, 120000);
	it('release flag off: no card, no registry lookup, no sandbox, and a stray launch request reaches nothing', async () => {
		const lookup = vi.spyOn(practiceTours, 'find');
		const app = renderApp({ practiceArea: false });
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		expect(
			screen.queryByRole('list', { name: 'practice.cards.title' })
		).toBeNull();

		app.request(ACCEPT);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

		expect(lookup).not.toHaveBeenCalled();
		expect(joyride).toBeNull();
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(getPracticeNetworkGuard()).toBeNull();
		expect(window.fetch).toBe(networkFetch);
		expect(getMatrixClientService()).toBe(realMatrixService);
		expect(
			screen.queryByRole('status', { name: 'practice.banner.title' })
		).toBeNull();
		expect(route()).toBe(HELP_ROUTE);
		expectNothingLeftThePracticeWorld();
	});
});
