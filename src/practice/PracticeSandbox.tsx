import * as React from 'react';
import {
	createContext,
	useCallback,
	useContext,
	useLayoutEffect,
	useMemo,
	useState
} from 'react';
import { getI18n, I18nContext } from 'react-i18next';
import type { UserDataInterface } from '../globalState/interfaces';
import { MatrixClientContext } from '../globalState/context/MatrixClientContext';
import { SessionsDataProvider } from '../globalState/provider/SessionsDataProvider';
import { TopicsContext } from '../globalState/provider/TopicsProvider';
import { NotificationsContext } from '../globalState/provider/NotificationsProvider';
import type { MatrixClientService } from '../services/matrixClientService';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from '../services/matrixClientRegistry';
import { createPracticeWorld, type PracticeWorld } from './practiceWorld';
import {
	holdPracticeExit,
	isPracticeMode,
	onPracticeExit
} from './practiceMode';
import { isPracticeId } from './practiceIds';
import { isPracticeDraftScope } from './practiceDraftScopes';
import { PracticeBlockedRequestError } from './networkGuard';
import { isSafeMethod, redactUrl } from './requestPolicy';
import {
	createPracticeTopic,
	type PracticeStart
} from './fixtures/practiceScenario';
import type { ScriptEngine } from './script/ScriptEngine';
import { createScriptFromI18n } from './script/createScriptFromI18n';

type Fetch = typeof window.fetch;

const ACTIVE_SESSION_KEY = '__activeSessionContext';

/**
 * Practice mode is a page-wide singleton: one installation owns `fetch`, the
 * Matrix registry and `window.__activeSessionContext` while any sandbox is
 * mounted. Restores only what it still owns.
 */
interface Installation {
	world: PracticeWorld;
	baseFetch: Fetch;
	previousFetch: Fetch;
	patchedFetch: Fetch;
	previousService: MatrixClientService | null;
	activeSession: { had: boolean; value: unknown };
	depth: number;
	/** Unmount started: only practice-addressed requests are still answered. */
	draining: boolean;
	/** Practice requests the fake has not answered yet. */
	inFlight: number;
	/** Keeps `endPractice` from removing the guard underneath this layer. */
	releaseExitHold: () => void;
	/** Synchronous Matrix restore for auth expiry, while REST can still drain. */
	removeExitTeardown?: () => void;
}

let installation: Installation | null = null;

const asService = (world: PracticeWorld) =>
	world.matrix as unknown as MatrixClientService;

const hideActiveSessionContext = (): Installation['activeSession'] => {
	const had = Object.prototype.hasOwnProperty.call(
		window,
		ACTIVE_SESSION_KEY
	);
	const value = (window as any)[ACTIVE_SESSION_KEY];
	// `ActiveSessionProvider` writes on every render and never cleans up;
	// practice writes are swallowed so the real value survives.
	Object.defineProperty(window, ACTIVE_SESSION_KEY, {
		configurable: true,
		get: () => value,
		set: () => undefined
	});
	return { had, value };
};

const restoreActiveSessionContext = ({
	had,
	value
}: Installation['activeSession']) => {
	delete (window as any)[ACTIVE_SESSION_KEY];
	if (had) (window as any)[ACTIVE_SESSION_KEY] = value;
};

/** A practice id in the path or a query value (a search for "-1" as well). */
const addressesPractice = (input: RequestInfo | URL): boolean => {
	const href = input instanceof Request ? input.url : String(input);
	let url: URL;
	try {
		url = new URL(href, window.location.href);
	} catch {
		return false;
	}
	return [...url.pathname.split('/'), ...url.searchParams.values()].some(
		(part) => {
			try {
				const value = decodeURIComponent(part);
				return isPracticeId(value) || isPracticeDraftScope(value);
			} catch {
				return false;
			}
		}
	);
};

/**
 * Practice ids are the fake's, even the ones it does not know. A non-2xx
 * answer would send `fetchData` to the error page, so a read finds nothing
 * (204) and a write fails like every other write while practising.
 */
const unknownToTheFake = (
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<Response> => {
	const method = (
		init?.method || (input instanceof Request ? input.method : 'GET')
	).toUpperCase();
	if (isSafeMethod(method)) {
		return Promise.resolve(new Response(null, { status: 204 }));
	}
	const href = input instanceof Request ? input.url : String(input);
	return Promise.reject(
		new PracticeBlockedRequestError({
			method,
			url: redactUrl(href),
			channel: 'fetch',
			reason: 'default-deny'
		})
	);
};

const ensureInstalled = (world: PracticeWorld, baseFetch?: Fetch) => {
	if (installation) {
		if (installation.world !== world) {
			if (getMatrixClientService() === asService(installation.world)) {
				setMatrixClientServiceRef(asService(world));
			}
			installation.world = world;
		}
		installation.draining = false;
		return;
	}

	const previousFetch = window.fetch;
	const patchedFetch: Fetch = async (input, init) => {
		const current = installation;
		if (!current || current.patchedFetch !== patchedFetch) {
			return previousFetch(input as RequestInfo, init);
		}
		// Counted until the fake answered: the uninstall (and with it the
		// guard's removal) waits for every practice request in flight.
		current.inFlight += 1;
		let response: Response | null;
		try {
			response = await current.world.rest.handle(
				input as RequestInfo,
				init,
				{ practiceAddressedOnly: current.draining }
			);
		} finally {
			current.inFlight -= 1;
			if (current.draining && current.inFlight === 0) {
				scheduleUninstallCheck();
			}
		}
		if (response) return response;
		return addressesPractice(input)
			? unknownToTheFake(input, init)
			: current.baseFetch(input as RequestInfo, init);
	};
	installation = {
		world,
		baseFetch: baseFetch ?? previousFetch,
		previousFetch,
		patchedFetch,
		previousService: getMatrixClientService(),
		activeSession: hideActiveSessionContext(),
		depth: 0,
		draining: false,
		inFlight: 0,
		releaseExitHold: holdPracticeExit()
	};
	window.fetch = patchedFetch;
	setMatrixClientServiceRef(asService(world));
	if (isPracticeMode()) {
		const current = installation;
		current.removeExitTeardown = onPracticeExit(() => {
			// Session teardown must see the real client in this same turn so
			// its pollers/calls stop before login renders. Keep the fake REST
			// layer for pending requests and practice-addressed unmount writes.
			current.draining = true;
			if (getMatrixClientService() === asService(current.world)) {
				setMatrixClientServiceRef(current.previousService);
			}
			current.previousService = null;
		});
	}
	// A render that never commits must not leave practice mode behind.
	scheduleUninstallCheck();
};

const uninstallIfIdle = () => {
	const current = installation;
	if (!current || current.depth > 0 || current.inFlight > 0) return;
	installation = null;
	current.removeExitTeardown?.();
	if (window.fetch === current.patchedFetch) {
		window.fetch = current.previousFetch;
	}
	if (getMatrixClientService() === asService(current.world)) {
		setMatrixClientServiceRef(current.previousService);
	}
	restoreActiveSessionContext(current.activeSession);
	current.releaseExitHold();
};

// A macrotask later: the practice tree's passive cleanups (e.g. the
// active-view PATCH {active:false}) still reach the fake, while views mounted
// in the same commit already get the real lists (draining mode).
const scheduleUninstallCheck = () => {
	window.setTimeout(uninstallIfIdle, 0);
};

const acquire = (world: PracticeWorld, baseFetch?: Fetch) => {
	ensureInstalled(world, baseFetch);
	installation!.depth += 1;
};

const release = () => {
	if (!installation) return;
	installation.depth = Math.max(0, installation.depth - 1);
	if (installation.depth === 0) {
		installation.draining = true;
		scheduleUninstallCheck();
	}
};

interface PracticeSandboxApi {
	world: PracticeWorld;
	/** Fresh fixtures; the practice subtree remounts. */
	restart: () => void;
}

const PracticeSandboxContext = createContext<PracticeSandboxApi | null>(null);

export const usePracticeSandbox = (): PracticeSandboxApi => {
	const api = useContext(PracticeSandboxContext);
	if (!api) {
		throw new Error(
			'usePracticeSandbox must be used inside PracticeSandbox'
		);
	}
	return api;
};

const noop = () => undefined;
const resolved = () => Promise.resolve();

export interface PracticeSandboxProps {
	/** The real logged-in counsellor; practice fixtures borrow only identity. */
	counsellor: UserDataInterface;
	start?: PracticeStart;
	/**
	 * The script of this run. Defaults to the one built from the page's i18n
	 * when practice starts (language follows the counsellor, fixed for the run).
	 */
	script?: ScriptEngine;
	/**
	 * Where requests the fake does not answer go. Defaults to the `fetch`
	 * found at install time, which is the network guard's while practice runs.
	 */
	baseFetch?: Fetch;
	children: React.ReactNode;
}

/**
 * Runs its children against the in-memory practice world: practice endpoints
 * are answered by the fake REST backend, the Matrix client is the fake one
 * (context and registry), and nothing is persisted.
 */
export const PracticeSandbox = ({
	counsellor,
	start = 'enquiry',
	script: scriptOverride,
	baseFetch,
	children
}: PracticeSandboxProps) => {
	const i18n = useContext(I18nContext)?.i18n ?? getI18n();
	// Resolved once: a restart replays the same language, a language switch
	// during the run does not reach it.
	const [script] = useState(
		() => scriptOverride ?? createScriptFromI18n(i18n)
	);
	const [run, setRun] = useState(() => ({
		generation: 0,
		world: createPracticeWorld({ counsellor, script, start })
	}));
	const { world } = run;

	// During render as well: children read the registry while rendering and
	// may fetch from their own layout effects, which run before ours.
	ensureInstalled(world, baseFetch);
	useLayoutEffect(() => {
		acquire(world, baseFetch);
		return release;
	}, [world, baseFetch]);

	const restart = useCallback(
		() =>
			setRun(({ generation }) => ({
				generation: generation + 1,
				world: createPracticeWorld({ counsellor, script, start })
			})),
		[counsellor, script, start]
	);
	const practiceTopics = useMemo(
		() => ({
			topics: [createPracticeTopic(script.names.topic)],
			refreshTopics: noop
		}),
		[script]
	);
	const api = useMemo(() => ({ world, restart }), [world, restart]);
	// Toasts stay; feed entries would outlive practice in the real centre, and
	// the real Zeitstrahl (asker names, links to real cases) stays out of view.
	const notifications = useContext(NotificationsContext);
	const practiceNotifications = useMemo(
		() =>
			notifications && {
				...notifications,
				addEventNotification: noop,
				notificationFeed: [],
				unreadNotificationCount: 0,
				serverUnreadTotal: 0,
				hasUnreadNotifications: false,
				visibleUnreadCount: 0,
				hiddenUnreadInLoadedPages: 0,
				hasOlderNotifications: false,
				refreshNotificationFeed: noop,
				loadOlderNotifications: resolved,
				markNotificationAsRead: noop,
				markNotificationsReadConfirmed: resolved,
				markAllNotificationsAsRead: noop,
				clearNotificationFeed: noop
			},
		[notifications]
	);
	const matrixContext = useMemo(
		() => ({
			matrixClientService: asService(world),
			setMatrixClientService: noop
		}),
		[world]
	);

	return (
		<PracticeSandboxContext.Provider value={api}>
			<MatrixClientContext.Provider value={matrixContext}>
				<TopicsContext.Provider value={practiceTopics}>
					<NotificationsContext.Provider
						value={practiceNotifications}
					>
						{/* Practice lists never enter the app-level sessions store. */}
						<SessionsDataProvider key={run.generation}>
							{children}
						</SessionsDataProvider>
					</NotificationsContext.Provider>
				</TopicsContext.Provider>
			</MatrixClientContext.Provider>
		</PracticeSandboxContext.Provider>
	);
};
