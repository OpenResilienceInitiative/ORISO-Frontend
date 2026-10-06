import * as React from 'react';
import {
	createContext,
	useCallback,
	useContext,
	useLayoutEffect,
	useMemo,
	useState
} from 'react';
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
	PRACTICE_TOPIC,
	type PracticeStart
} from './fixtures/practiceScenario';

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
		const response = await current.world.rest.handle(
			input as RequestInfo,
			init,
			{ practiceAddressedOnly: current.draining }
		);
		return response ?? current.baseFetch(input as RequestInfo, init);
	};
	installation = {
		world,
		baseFetch: baseFetch ?? previousFetch,
		previousFetch,
		patchedFetch,
		previousService: getMatrixClientService(),
		activeSession: hideActiveSessionContext(),
		depth: 0,
		draining: false
	};
	window.fetch = patchedFetch;
	setMatrixClientServiceRef(asService(world));
	// A render that never commits must not leave practice mode behind.
	scheduleUninstallCheck();
};

const uninstallIfIdle = () => {
	const current = installation;
	if (!current || current.depth > 0) return;
	installation = null;
	if (window.fetch === current.patchedFetch) {
		window.fetch = current.previousFetch;
	}
	if (getMatrixClientService() === asService(current.world)) {
		setMatrixClientServiceRef(current.previousService);
	}
	restoreActiveSessionContext(current.activeSession);
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
const practiceTopics = { topics: [PRACTICE_TOPIC], refreshTopics: noop };

export interface PracticeSandboxProps {
	/** The real logged-in counsellor; practice fixtures borrow only identity. */
	counsellor: UserDataInterface;
	start?: PracticeStart;
	/**
	 * Where unanswered requests go. Seam for S1's NetworkGuard; defaults to the
	 * `fetch` found at install time.
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
	baseFetch,
	children
}: PracticeSandboxProps) => {
	const [run, setRun] = useState(() => ({
		generation: 0,
		world: createPracticeWorld({ counsellor, start })
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
				world: createPracticeWorld({ counsellor, start })
			})),
		[counsellor, start]
	);
	const api = useMemo(() => ({ world, restart }), [world, restart]);
	// Toasts stay; feed entries would outlive practice in the real centre.
	const notifications = useContext(NotificationsContext);
	const practiceNotifications = useMemo(
		() => notifications && { ...notifications, addEventNotification: noop },
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
