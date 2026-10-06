// @vitest-environment jsdom
/**
 * S0 gate proof: the REAL wired containers (SessionsZone → SessionsList,
 * SessionView → SessionStream → SessionItemComponent → AcceptAssign, the
 * team side panel and the supervisor flow) run on the practice world. Only
 * browser gaps (canvas, lottie, layout APIs) are substituted; no component
 * and no API module is mocked. A tripwire stands in for the real Matrix
 * service that keeps living in the page.
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
import {
	MemoryRouter,
	Route,
	Routes,
	useLocation,
	useNavigate,
	type NavigateFunction
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Context as ResponsiveContext } from 'react-responsive';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
// Preload the lazy composer and session view during collection.
import '../components/messageSubmitInterface/messageSubmitInterfaceComponent';
import '../components/session/SessionView';
import { SessionsZone } from '../components/app/SessionsZone';
import { RouterConfigConsultant } from '../components/app/RouterConfig';
import {
	AppConfigContext,
	ConsultantListContext,
	ConsultingTypesContext,
	NotificationsContext,
	ServerSettingsContext,
	TopicsContext,
	UserDataContext
} from '../globalState';
import { LocaleContext } from '../globalState/context/LocaleContext';
import { LanguagesContext } from '../globalState/provider/LanguagesProvider';
import { MatrixClientContext } from '../globalState/context/MatrixClientContext';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from '../services/matrixClientRegistry';
import { setTenantSettings } from '../utils/tenantSettingsHelper';
import { config } from '../resources/scripts/config';
import { PracticeSandbox, usePracticeSandbox } from './PracticeSandbox';
import { practiceCounsellorFixture } from './fixtures/practiceCounsellorFixture';
import { PRACTICE_CAST, PRACTICE_SCRIPT } from './fixtures/practiceCast';
import {
	isPracticeRoomId,
	PRACTICE_ENQUIRY_SESSION_ID,
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_SUPERVISION_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from './fixtures/practiceIdentifiers';
import { PRACTICE_COUNSELLOR_MATRIX_USER_ID } from './fixtures/practiceCast';
import { SYSTEM_NOTIFICATION_PREFIX } from '../components/message/messageConstants';
import type { PracticeWorld } from './practiceWorld';
import {
	enterPracticeMode,
	exitPracticeMode,
	getPracticeNetworkGuard
} from './practiceMode';

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
// Browser-only animation renderers have no canvas in jsdom.
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

interface NetworkCall {
	method: string;
	url: string;
}

const network: NetworkCall[] = [];
const networkFetch = vi.fn(
	async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = input instanceof Request ? input : null;
		network.push({
			method: (init?.method || request?.method || 'GET').toUpperCase(),
			url: request ? request.url : String(input)
		});
		throw new Error('network is not reachable in the practice proof');
	}
);

/** Fails loudly when anything reaches the real Matrix service. */
const realMatrixTouches: string[] = [];
const realMatrixService = new Proxy(
	{},
	{
		get: (_target, key) => {
			if (typeof key === 'string' && key !== 'then') {
				realMatrixTouches.push(key);
			}
			return () => null;
		}
	}
);

/** The app-level notification centre the practice view sits inside. */
const appNotifications = {
	notifications: [],
	addNotification: vi.fn(),
	addEventNotification: vi.fn()
};

/** Every browser-storage write while the practice view runs. */
const storageWrites: string[] = [];
const indexedDbOpens = vi.fn();

const translations = createInstance().use(initReactI18next);
const counsellor = practiceCounsellorFixture();
let world: PracticeWorld | null = null;

function WorldProbe() {
	world = usePracticeSandbox().world;
	return null;
}
let navigateInTest: NavigateFunction | null = null;
function RouteProbe() {
	const { pathname, search } = useLocation();
	navigateInTest = useNavigate();
	return <output data-testid="route">{`${pathname}${search}`}</output>;
}

const LIST_ROUTE = {
	enquiry: '/sessions/consultant/sessionPreview',
	acceptedCase: '/sessions/consultant/sessionView'
} as const;

const renderPractice = (
	start: 'enquiry' | 'acceptedCase' = 'enquiry',
	{ underGuard = false } = {}
) => {
	const providers: [React.Context<any>, any][] = [
		[AppConfigContext, config],
		[ResponsiveContext, { width: 1440 }],
		[UserDataContext, { userData: counsellor, setUserData: vi.fn() }],
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
		[LocaleContext, { locale: 'de' }],
		[LanguagesContext, { fixed: ['de'], spoken: [] }],
		// The real app-level provider: the sandbox must shadow it.
		[
			MatrixClientContext,
			{
				matrixClientService: realMatrixService,
				setMatrixClientService: vi.fn()
			}
		]
	];
	return render(
		<I18nextProvider i18n={translations}>
			<MemoryRouter initialEntries={[LIST_ROUTE[start]]}>
				{providers.reduceRight(
					(child, [Context, value]) => (
						<Context.Provider value={value}>
							{child}
						</Context.Provider>
					),
					<PracticeSandbox
						counsellor={counsellor}
						start={start}
						// Under the guard the sandbox falls back to the page fetch.
						baseFetch={
							underGuard ? undefined : (networkFetch as any)
						}
					>
						<WorldProbe />
						<RouteProbe />
						<Routes>
							<Route
								path="sessions/*"
								element={
									<SessionsZone
										routerConfig={RouterConfigConsultant(
											config
										)}
									/>
								}
							/>
						</Routes>
					</PracticeSandbox>
				)}
			</MemoryRouter>
		</I18nextProvider>
	);
};

beforeEach(async () => {
	network.length = 0;
	realMatrixTouches.length = 0;
	storageWrites.length = 0;
	networkFetch.mockClear();
	indexedDbOpens.mockClear();
	appNotifications.addNotification.mockClear();
	appNotifications.addEventNotification.mockClear();
	vi.stubGlobal('fetch', networkFetch);
	vi.stubGlobal('indexedDB', { open: indexedDbOpens });
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
	setTenantSettings({
		featureTeamDiscussionEnabled: true,
		featureSupervisionEnabled: true
	} as any);
	setMatrixClientServiceRef(realMatrixService as any);
	const setItem = Storage.prototype.setItem;
	const removeItem = Storage.prototype.removeItem;
	vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
		this: Storage,
		key: string,
		value: string
	) {
		storageWrites.push(`set ${key}`);
		setItem.call(this, key, value);
	});
	vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (
		this: Storage,
		key: string
	) {
		storageWrites.push(`remove ${key}`);
		removeItem.call(this, key);
	});
});

afterEach(async () => {
	cleanup();
	await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
	expect(getMatrixClientService()).toBe(realMatrixService);
	setMatrixClientServiceRef(null);
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const listItems = (container: HTMLElement) =>
	container.querySelectorAll<HTMLElement>('[data-cy="session-list-item"]');

/** The list holds the practice case and nothing else; opens it by click. */
const openThePracticeCase = async (container: HTMLElement) => {
	const row = await waitFor(
		() => {
			const items = listItems(container);
			expect(items).toHaveLength(1);
			expect(items[0].textContent).toContain(
				PRACTICE_CAST.asker.displayName
			);
			return items[0];
		},
		{ timeout: 15000 }
	);
	fireEvent.click(row);
};

const textOf = (container: HTMLElement, selector: string) =>
	container.querySelector(selector)?.textContent ?? '';

const liveEditor = (scope: () => HTMLElement | null) => {
	const editor = scope()?.querySelector<any>(
		'.ProseMirror[contenteditable="true"]'
	)?.editor;
	return editor && !editor.isDestroyed ? editor : null;
};

/** Types through the real TipTap editor and presses the real send button. */
const typeAndSend = async (scope: () => HTMLElement | null, text: string) => {
	// The composer may remount while the case reloads after acceptance.
	await waitFor(
		() => {
			const editor = liveEditor(scope);
			expect(editor).toBeTruthy();
			if (!editor.getText().includes(text)) {
				act(() => {
					editor.chain().focus().insertContent(text).run();
				});
			}
			expect(liveEditor(scope)?.getText()).toContain(text);
		},
		{ timeout: 15000 }
	);
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

const bodiesIn = (roomId: string) =>
	world!.matrix
		.getRoomMessages(roomId)
		.map((event) => `${event.getSender()}: ${event.getContent().body}`);

/** The page-level safety net every practice journey must leave intact. */
const expectNothingLeftThePracticeWorld = () => {
	const practiceOnNetwork = network.filter(
		({ url }) =>
			/\/(-\d+)(\/|$|\?)/.test(
				new URL(url, window.location.href).pathname
			) || decodeURIComponent(url).includes('practice')
	);
	expect(practiceOnNetwork).toEqual([]);
	expect(network.filter(({ method }) => method !== 'GET')).toEqual([]);
	expect(realMatrixTouches).toEqual([]);
	expect(storageWrites).toEqual([]);
	expect(indexedDbOpens).not.toHaveBeenCalled();
	expect(appNotifications.addEventNotification).not.toHaveBeenCalled();
	expect(
		world!.matrix.getRooms().every((room) => isPracticeRoomId(room.roomId))
	).toBe(true);
};

/** F1 up to the scripted answer: open, accept, reply through the composer. */
const acceptAndReply = async (view: { container: HTMLElement }) => {
	await openThePracticeCase(view.container);
	const accept = await screen.findByRole(
		'button',
		{ name: 'enquiry.acceptButton.known' },
		{ timeout: 15000 }
	);
	expect(textOf(view.container, '.chatStage__mainPane')).toContain(
		PRACTICE_SCRIPT.enquiry
	);

	fireEvent.click(accept);

	await waitFor(() => expect(world!.rest.getCase().session.status).toBe(2), {
		timeout: 15000
	});
	expect(
		world!.rest.served.some(
			({ method, url }) =>
				method === 'PUT' &&
				url.endsWith(
					`/service/users/sessions/new/${PRACTICE_ENQUIRY_SESSION_ID}`
				)
		)
	).toBe(true);
	await waitFor(
		() =>
			expect(screen.getByTestId('route').textContent).toMatch(
				/\/sessions\/consultant\/sessionView\/!practice-1/
			),
		{ timeout: 15000 }
	);
	await waitFor(
		() =>
			expect(textOf(view.container, '.chatStage__mainPane')).toContain(
				PRACTICE_SCRIPT.enquiry
			),
		{ timeout: 15000 }
	);

	const reply = 'Hallo Sam, schön, dass du dich meldest.';
	await typeAndSend(
		() => view.container.querySelector('.chatStage__mainPane'),
		reply
	);

	await waitFor(
		() => {
			const main = textOf(view.container, '.chatStage__mainPane');
			expect(main).toContain(reply);
			expect(main).toContain(PRACTICE_SCRIPT.askerReply);
		},
		{ timeout: 15000 }
	);
	return reply;
};

describe('practice sandbox on the real session containers', () => {
	it('F1: lists only the practice enquiry, accepts it with the real button and answers through the real composer', async () => {
		const view = renderPractice();

		const reply = await acceptAndReply(view);

		// The real Erstantwort renderer reads the fake room's system event.
		expect(textOf(view.container, '.chatStage__mainPane')).toContain(
			PRACTICE_SCRIPT.erstantwortGreeting
		);
		const [sent, answer] = bodiesIn(PRACTICE_MAIN_ROOM_ID).slice(-2);
		expect(sent).toMatch(
			new RegExp(`^${PRACTICE_COUNSELLOR_MATRIX_USER_ID}: .*${reply}`)
		);
		expect(answer).toBe(
			`${PRACTICE_CAST.asker.matrixUserId}: ${PRACTICE_SCRIPT.askerReply}`
		);
		expectNothingLeftThePracticeWorld();
	}, 60000);

	it('F1 under the real network guard: nothing needs blocking and the layers unwind in order', async () => {
		enterPracticeMode({ tourId: 'consultant-practice-accept' });
		const guardedFetch = window.fetch;
		try {
			const view = renderPractice('enquiry', { underGuard: true });

			await acceptAndReply(view);

			expect(getPracticeNetworkGuard()?.blockedRequests).toEqual([]);
			expect(window.fetch).not.toBe(guardedFetch);
			cleanup();
			await act(
				() => new Promise<void>((resolve) => setTimeout(resolve, 0))
			);
			expect(window.fetch).toBe(guardedFetch);
		} finally {
			exitPracticeMode();
		}
		expect(window.fetch).toBe(networkFetch);
		expectNothingLeftThePracticeWorld();
	}, 60000);

	it('team discussion: the enquiry opens with the colleague in the side panel and a reply stays in the team room', async () => {
		const view = renderPractice();
		const panel = () =>
			view.container.querySelector<HTMLElement>(
				'.chatStage__panel .sidePanel'
			);

		await openThePracticeCase(view.container);
		await waitFor(
			() =>
				expect(panel()?.textContent).toContain(
					PRACTICE_SCRIPT.teamColleague
				),
			{ timeout: 15000 }
		);

		const note = 'Ich übernehme das gern, wenn niemand widerspricht.';
		await typeAndSend(panel, note);

		await waitFor(() => expect(panel()?.textContent).toContain(note), {
			timeout: 15000
		});
		// Bodies carry the composer's transport markup around the text.
		expect(bodiesIn(PRACTICE_TEAM_ROOM_ID).at(-1)).toMatch(
			new RegExp(`^${PRACTICE_COUNSELLOR_MATRIX_USER_ID}: .*${note}`)
		);
		expect(bodiesIn(PRACTICE_MAIN_ROOM_ID).join('\n')).not.toContain(note);
		expect(textOf(view.container, '.chatStage__mainPane')).not.toContain(
			PRACTICE_SCRIPT.teamColleague
		);
		expectNothingLeftThePracticeWorld();
	}, 60000);

	it('supervision: adds Robin through the real picker and shows the reply in the side thread after reopening', async () => {
		const view = renderPractice('acceptedCase');

		await openThePracticeCase(view.container);
		const add = await screen.findByRole(
			'button',
			{ name: 'sessionHeader.supervisor.modal.title' },
			{ timeout: 15000 }
		);
		fireEvent.click(add);

		const picker = await screen.findByRole(
			'combobox',
			{},
			{ timeout: 15000 }
		);
		fireEvent.mouseDown(picker);
		fireEvent.click(
			await screen.findByRole('option', {
				name: PRACTICE_CAST.supervisor.displayName
			})
		);
		expect(
			screen.queryByRole('option', {
				name: PRACTICE_CAST.colleague.displayName
			})
		).toBeNull();
		fireEvent.change(
			screen.getByPlaceholderText(
				'sessionHeader.supervisor.modal.reasonPlaceholder'
			),
			{ target: { value: 'Ich möchte mich zum Vorgehen absichern.' } }
		);
		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', {
					name: 'sessionHeader.supervisor.modal.addButton'
				})
			);
		});

		await waitFor(
			() => expect(world!.rest.getCase().supervisors).toHaveLength(1),
			{ timeout: 15000 }
		);
		// The success toast stays; the feed entry is swallowed (see below).
		await waitFor(() =>
			expect(appNotifications.addNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'sessionHeader.supervisor.success.add.title'
				})
			)
		);
		await waitFor(() =>
			expect(
				bodiesIn(PRACTICE_MAIN_ROOM_ID).some((line) =>
					line.startsWith(
						`${PRACTICE_COUNSELLOR_MATRIX_USER_ID}: ${SYSTEM_NOTIFICATION_PREFIX}`
					)
				)
			).toBe(true)
		);
		expect(bodiesIn(PRACTICE_SUPERVISION_ROOM_ID)).toEqual([
			`${PRACTICE_CAST.supervisor.matrixUserId}: ${PRACTICE_SCRIPT.supervisorReply}`
		]);

		// The real view resolves the side room on open only (finding in
		// SPIKE-REPORT): leave the case and open it again.
		act(() => navigateInTest!(LIST_ROUTE.acceptedCase));
		await openThePracticeCase(view.container);

		await waitFor(
			() =>
				expect(textOf(view.container, '.chatStage__panel')).toContain(
					PRACTICE_SCRIPT.supervisorReply
				),
			{ timeout: 15000 }
		);
		expect(textOf(view.container, '.chatStage__mainPane')).not.toContain(
			PRACTICE_SCRIPT.supervisorReply
		);
		expectNothingLeftThePracticeWorld();
	}, 60000);
});
