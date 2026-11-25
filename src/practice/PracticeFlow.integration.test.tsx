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
import { Header } from '../components/header/Header';
import { RouterConfigConsultant } from '../components/app/RouterConfig';
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
const SUPERVISION = 'consultant-practice-supervision';
const LIVE_CHAT = 'consultant-live-chat';
const GROUP_CIRCLE = 'consultant-group-circle';
/** The counsellor's real Beratungsstelle (the fixture's), read by the shell. */
const REAL_AGENCY_URL = '/service/agencies/4711';
const HELP_ROUTE = '/profile/hilfe/rundgaenge';
/** The texts the page's German script shows; the catalogue is the source. */
const SCRIPT = createTestScript('de');
const TUTORIAL_PROGRESS = '/service/users/tutorials/progress';

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
		if (method === 'GET' && new URL(url).pathname === REAL_AGENCY_URL) {
			return new Response(JSON.stringify([{ id: 4711 }]), {
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
	groupCircle = false
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
		featureSupervisionEnabled: true,
		...(groupCircle && { featureGroupChatV2Enabled: true })
	};
	const userData = groupCircle
		? {
				...counsellor,
				grantedAuthorities: [
					...counsellor.grantedAuthorities,
					'AUTHORIZATION_CREATE_NEW_CHAT'
				]
			}
		: counsellor;
	setTenantSettings(flags as any);
	const store = createStore();
	const routerConfig = RouterConfigConsultant(settings);
	const providers: [React.Context<any>, any][] = [
		[AppConfigContext, settings],
		[ResponsiveContext, { width }],
		[UserDataContext, { userData, setUserData: vi.fn() }],
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

describe('practice flows on the real app shell', () => {
	it('keeps the real practice sandbox active during StrictMode replay and restores the real service after unmount', async () => {
		const app = renderApp({ strictMode: true });
		await app.start(SUPERVISION);
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

	it('Live chat (FE#2545): a practice live chat waits, is started with the real button and answered', async () => {
		const app = renderApp();
		// The Help list starts topic tours by request; there is no card.
		await app.request(LIVE_CHAT);

		// 1: what is different about live chat; Next.
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
		pressNext(0);

		// 2: the live-chat filter, the shared queue; click it.
		const chip = await expectStep(stepIndexOf('livechat-queue'));
		await act(async () => {
			fireEvent.click(chip!);
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
		});

		// 3: the waiting live chat, the only row of the queue; click it.
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
	}, 120000);

	it('Live chat without the practice area: the explanation tour runs on the real page', async () => {
		const app = renderApp({ practiceArea: false });
		await app.request(LIVE_CHAT);
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(getPracticeNetworkGuard()).toBeFalsy();
	});

	it('Gesprächskreis (FE#2545): the real create flow makes a practice circle, which is opened, started and shows its call button', async () => {
		const app = renderApp({ groupCircle: true });
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

		// 5: the real "Erstellen" of the settings; the circle is made in memory.
		const settings = await expectStep(create + 3);
		await waitFor(() =>
			expect(settings!.hasAttribute('disabled')).toBe(false)
		);
		await afterWorldEvent(PRACTICE_TOUR_EVENTS.circleCreated, async () => {
			fireEvent.click(settings!);
		});

		// 6: back in the list (no share dialog): the new circle; click it.
		const open = create + 4;
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

		// 7: the waiting room's real "Video-Call starten"; it starts the circle.
		const start = await expectStep(open + 1);
		const startButton = within(start!).getByRole('button', {
			name: 'videoCall.button.startVideoCall'
		});
		await afterWorldEvent(PRACTICE_TOUR_EVENTS.circleStarted, async () => {
			await act(async () => {
				fireEvent.click(startButton);
			});
		});

		// 8: the call button of the started circle, shown and not usable:
		// practice starts no call (D3), and the start asked for none.
		const call = await expectStep(open + 2);
		expect(call!.querySelector('button')).toBeTruthy();
		expect(joyride!.steps[open + 2]).toMatchObject({
			blockTargetInteraction: true
		});
		expect(route()).toMatch(/sessionView\/!practice-4/);
		pressNext(open + 2);

		// Done: completion is written for the circle tour itself, and the
		// circle never left the page.
		await finish(open + 3);
		expect(
			network.filter(({ url }) => url.includes('/service/users/chat'))
		).toEqual([]);
	}, 120000);

	it('Gesprächskreis without the practice area: the explanation tour runs on the real page', async () => {
		const app = renderApp({ practiceArea: false, groupCircle: true });
		await app.request(GROUP_CIRCLE);
		await expectStep(0);
		expect(joyride!.steps).toHaveLength(6);
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(getPracticeNetworkGuard()).toBeFalsy();
	});

	it('F2: the accepted case opens, the real picker adds the supervisor, and the reply shows in the side thread', async () => {
		const app = renderApp();
		await app.start(SUPERVISION);

		// 1: the add-supervisor button of the accepted case; click, pick, confirm.
		const add = await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
		expect(route()).toMatch(/sessionView\//);
		expect(textOf('.chatStage__mainPane')).toContain(
			SCRIPT.texts.acceptedCaseCounsellorMessage
		);
		await afterWorldEvent(
			PRACTICE_TOUR_EVENTS.supervisorAdded,
			async () => {
				fireEvent.click(add!);
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
					{
						target: {
							value: 'Ich möchte mich zum Vorgehen absichern.'
						}
					}
				);
				await act(async () => {
					fireEvent.click(
						screen.getByRole('button', {
							name: 'managePeople.add.confirm'
						})
					);
				});
			}
		);

		// 2: the side thread with the supervisor's reply; Next.
		const panel = await expectStep(1);
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
		pressNext(1);

		// 3: the standing assignment, explained; Next.
		await expectStep(2);
		pressNext(2);

		// 4: done.
		await finish(3);
	}, 120000);
	it('cannot launch F2 through a stale request below its picker breakpoint', async () => {
		const app = renderApp({ width: 1199 });
		app.request(SUPERVISION);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(screen.queryByTestId('practice-banner')).toBeNull();
		expect(progressWrites()).toEqual([]);
		app.resize(1200);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(screen.queryByTestId('practice-banner')).toBeNull();
	});

	it('can launch F2 at the real picker breakpoint', async () => {
		const app = renderApp({ width: 1200 });
		await app.start(SUPERVISION);
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
	}, 120000);

	it('does not restart F2 automatically after resizing below and back above its picker breakpoint', async () => {
		const app = renderApp({ width: 1200 });
		await app.start(SUPERVISION);
		await expectStep(0);

		app.resize(1199);
		await waitFor(
			() => expect(getPracticeSnapshot().status).toBe('inactive'),
			SLOW
		);
		expect(route()).toBe(HELP_ROUTE);
		app.resize(1200);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(screen.queryByTestId('practice-banner')).toBeNull();
		expect(progressWrites()).not.toContain('completed');

		await app.start(SUPERVISION);
		await expectStep(0);
		expect(getPracticeSnapshot().status).toBe('active');
	}, 120000);

	it('keeps an unsent real composer draft and its shared index off the network during immediate auth teardown', async () => {
		const service = new MatrixClientService();
		setMatrixClientServiceRef(service);
		const app = renderApp();
		try {
			await app.start(SUPERVISION);
			await expectStep(0);
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

	it('banner End remains keyboard-accessible while the F2 picker is open', async () => {
		// The real focus trap stays active; jsdom supplies no visible geometry.
		vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
			() => [{ width: 100, height: 40 }] as unknown as DOMRectList
		);
		const app = renderApp();
		await app.start(SUPERVISION);
		const add = await expectStep(0);
		fireEvent.click(add!);
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
