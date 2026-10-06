// @vitest-environment jsdom
/**
 * I1 proof: the REAL practice tours walk through the REAL app shell pieces
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Context as ResponsiveContext } from 'react-responsive';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import { createStore, Provider as JotaiProvider } from 'jotai';
// Preload the lazy composer and session view during collection.
import '../components/messageSubmitInterface/messageSubmitInterfaceComponent';
import '../components/session/SessionView';
import { SessionsZone } from '../components/app/SessionsZone';
import { NavigationBar } from '../components/app/NavigationBar';
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
import { PracticeLayer } from './PracticeLayer';
import { PracticeBanner } from './PracticeBanner';
import { PracticeSurface } from './PracticeSurface';
import { practiceCounsellorFixture } from './fixtures/practiceCounsellorFixture';
import {
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from './fixtures/practiceIdentifiers';
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
	return {
		...actual,
		Joyride: (props: any) => {
			joyride = props;
			return null;
		}
	};
});

const ACCEPT = 'consultant-practice-accept';
const SUPERVISION = 'consultant-practice-supervision';
const HELP_ROUTE = '/profile/hilfe/rundgaenge';
/** The texts the page's German script shows; the catalogue is the source. */
const SCRIPT = createTestScript('de');
const TUTORIAL_PROGRESS = '/service/users/tutorials/progress';

interface NetworkCall {
	method: string;
	url: string;
}
const network: NetworkCall[] = [];
const networkFetch = vi.fn(
	async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = input instanceof Request ? input : null;
		const method = (init?.method || request?.method || 'GET').toUpperCase();
		const url = request ? request.url : String(input);
		network.push({ method, url });
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

const renderApp = ({ teamDiscussion = true } = {}) => {
	const flags = {
		featureTeamDiscussionEnabled: teamDiscussion,
		featureSupervisionEnabled: true
	};
	setTenantSettings(flags as any);
	const store = createStore();
	const routerConfig = RouterConfigConsultant(appConfig);
	const providers: [React.Context<any>, any][] = [
		[AppConfigContext, appConfig],
		[ResponsiveContext, { width: 1440 }],
		[UserDataContext, { userData: counsellor, setUserData: vi.fn() }],
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
				consultingTypes: [{ id: 0, isVideoCallAllowed: false }],
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
		[SessionsDataContext, { sessions: [], dispatch: vi.fn() }],
		[
			MatrixClientContext,
			{
				matrixClientService: realMatrixService,
				setMatrixClientService: vi.fn()
			}
		]
	];
	const view = render(
		<I18nextProvider i18n={translations}>
			<JotaiProvider store={store}>
				<MemoryRouter initialEntries={[HELP_ROUTE]}>
					{providers.reduceRight(
						(child, [Context, value]) => (
							<Context.Provider value={value}>
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
											<p data-testid="help-page">Hilfe</p>
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
	const start = (tourId: string) =>
		act(() =>
			store.set(tourLaunchRequestAtom, {
				tourId,
				mode: 'start',
				requestedAt: Date.now()
			})
		);
	return { ...view, store, start };
};

beforeEach(async () => {
	joyride = null;
	network.length = 0;
	realMatrixWrites.length = 0;
	storageWrites.length = 0;
	networkFetch.mockClear();
	appNotifications.addEventNotification.mockClear();
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
		expect(joyride?.run).toBe(true);
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

/** The page-level safety net: nothing of the practice world left the page. */
const expectNothingLeftThePracticeWorld = () => {
	const writes = network.filter(({ method }) => method !== 'GET');
	expect(
		writes.filter(({ url }) => !url.includes(TUTORIAL_PROGRESS))
	).toEqual([]);
	expect(
		network.filter(({ url }) =>
			/\/(-\d+)(\/|$|\?)|practice/.test(decodeURIComponent(url))
		)
	).toEqual([]);
	expect(realMatrixWrites).toEqual([]);
	expect(storageWrites).toEqual([]);
	expect(appNotifications.addEventNotification).not.toHaveBeenCalled();
	expect(getPracticeNetworkGuard()?.blockedRequests ?? []).toEqual([]);
};

/** The enquiry steps of F1 up to the open enquiry: 1 and 2 in both variants. */
const openThePracticeEnquiry = async () => {
	// 1: the Anfragen icon in the real navigation bar; Next.
	await expectStep(0);
	expect(getPracticeSnapshot().status).toBe('active');
	pressNext(0);

	// 2: the practice enquiry, the only row of the real list; click it.
	const row = await expectStep(1);
	expect(route()).toBe(PRACTICE_ENQUIRIES_ROUTE);
	expect(
		document.querySelectorAll('[data-cy="session-list-item"]')
	).toHaveLength(1);
	expect(row!.textContent).toContain(SCRIPT.cast.asker.displayName);
	fireEvent.click(row!);
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
	expect(window.fetch).toBe(networkFetch);
	expect(
		network.filter(({ method }) => method === 'PUT').length
	).toBeGreaterThan(0);
	expectNothingLeftThePracticeWorld();
};

describe('practice flows on the real app shell', () => {
	it('F1 with the team step: every anchor is live when its step shows, and the real actions advance the tour', async () => {
		const app = renderApp({ teamDiscussion: true });
		app.start(ACCEPT);
		await openThePracticeEnquiry();
		expect(joyride!.steps).toHaveLength(8);

		// 3: the team button of the open enquiry; click it.
		const teamButton = await expectStep(2);
		fireEvent.click(teamButton!);

		// 4: the team panel; the reply lands in the team room only.
		const panel = await expectStep(3);
		const note = 'Ich übernehme das gern.';
		await afterWorldEvent(PRACTICE_TOUR_EVENTS.teamMessageSent, () =>
			typeAndSend(() => panel, note)
		);
		expect(textOf('.chatStage__mainPane')).not.toContain(note);

		// 5-7: accept, Erstantwort, reply.
		await acceptAndAnswer(4);

		// 8: done.
		await finish(7);
	}, 120000);

	it('F1 without the team step (Träger switched it off): six steps, no team anchor, the same real actions', async () => {
		const app = renderApp({ teamDiscussion: false });
		app.start(ACCEPT);
		await openThePracticeEnquiry();
		expect(joyride!.steps).toHaveLength(6);

		// 3-5: accept straight away, Erstantwort, reply.
		await expectStep(2);
		expect(
			document.querySelector('[data-tour-target="enquiry-team-button"]')
		).toBeNull();
		await acceptAndAnswer(2);

		// 6: done.
		await finish(5);
	}, 120000);

	it('F2: the accepted case opens, the real picker adds the supervisor, and the reply shows in the side thread', async () => {
		const app = renderApp();
		app.start(SUPERVISION);

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
				const picker = await screen.findByRole('combobox', {}, SLOW);
				fireEvent.mouseDown(picker);
				fireEvent.click(
					await screen.findByRole('option', {
						name: SCRIPT.cast.supervisor.displayName
					})
				);
				fireEvent.change(
					screen.getByPlaceholderText(
						'sessionHeader.supervisor.modal.reasonPlaceholder'
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
							name: 'sessionHeader.supervisor.modal.addButton'
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
});
