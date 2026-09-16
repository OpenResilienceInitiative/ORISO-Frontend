import { ComponentType, lazy } from 'react';
import { metrics } from '@opentelemetry/api';

/**
 * Keeps a deploy invisible to people who have the app open.
 *
 * Every lazily loaded part of the app (Login, AuthenticatedApp, Registration,
 * SessionView, …) is a webpack chunk named by content hash. After a release
 * the server only has the new hashes, but a tab that was opened before still
 * runs the previous build and asks for the old ones. The proxy answers 404
 * (proxy/lib/staticServing.js), webpack throws `ChunkLoadError`, and without
 * this module the ErrorBoundary sent everyone to error.500.html — the
 * "500 after every release, log out and in again" report. Logging out only
 * helped because it is a full page load that fetches the new shell.
 *
 * Recovery: retry once (a request can hit an old pod mid-rollout), then reload
 * the page once so the browser picks up the new shell. The reload is guarded
 * by a timestamp in sessionStorage: a chunk that is still missing right after
 * a reload is a genuinely broken build and goes to the ErrorBoundary instead
 * of looping.
 */

export const CHUNK_RELOAD_AT_KEY = 'oriso:chunk-reload-at';

/** A chunk failure this soon after our own reload is not a stale tab. */
export const CHUNK_RELOAD_GUARD_MS = 30_000;

/** Pause before the single retry, so a pod that is being replaced is gone. */
export const CHUNK_RETRY_DELAY_MS = 500;

/**
 * How long to wait for `location.reload()` to actually navigate. An embedding
 * context or an extension can swallow it without throwing; without this the
 * Suspense fallback would spin forever.
 */
export const RELOAD_FALLBACK_MS = 10_000;

const CHUNK_ERROR_PATTERNS = [
	// webpack JS and CSS chunks (mini-css-extract-plugin)
	'loading chunk',
	'loading css chunk',
	// native dynamic import, in case a bundler change ever emits one
	'failed to fetch dynamically imported module',
	'importing a module script failed',
	'error loading dynamically imported module'
];

// Dashboard contract, like the other counters in utils/observability: the
// SigNoz query uses these names. Only the outcome is recorded — no URL, no
// user, no route.
const METER_NAME = 'chunk-load-recovery';
const COUNTER_NAME = 'chunk_load_failure';

type RecoveryOutcome = 'retry' | 'reload' | 'gave_up';

const countOutcome = (outcome: RecoveryOutcome) => {
	try {
		metrics
			.getMeter(METER_NAME)
			.createCounter(COUNTER_NAME, {
				description:
					'Lazy chunk failed to load, usually a tab that still runs the previous build'
			})
			.add(1, { outcome });
	} catch {
		// telemetry is best-effort
	}
};

export const isChunkLoadError = (error: unknown): boolean => {
	if (!error) return false;
	if ((error as { name?: string }).name === 'ChunkLoadError') return true;

	const message = (
		error instanceof Error ? error.message : String(error)
	).toLowerCase();
	return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

/**
 * Reloads the page unless we already did so within the guard window.
 * Returns whether a reload was started. Without sessionStorage (Safari private
 * mode, blocked storage) nothing could stop a loop, so it never reloads.
 */
export const reloadOnceForNewBuild = (): boolean => {
	const now = Date.now();
	try {
		const lastReloadAt = Number(
			window.sessionStorage.getItem(CHUNK_RELOAD_AT_KEY)
		);
		if (lastReloadAt && now - lastReloadAt < CHUNK_RELOAD_GUARD_MS) {
			return false;
		}
		window.sessionStorage.setItem(CHUNK_RELOAD_AT_KEY, String(now));
	} catch {
		return false;
	}

	countOutcome('reload');
	window.location.reload();
	return true;
};

/** Counted where the person actually ends on the error page. */
export const reportChunkLoadGaveUp = () => countOutcome('gave_up');

const wait = (ms: number) =>
	new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export const loadChunk = async <TModule>(
	factory: () => Promise<TModule>
): Promise<TModule> => {
	try {
		return await factory();
	} catch (firstError) {
		if (!isChunkLoadError(firstError)) throw firstError;
	}

	await wait(CHUNK_RETRY_DELAY_MS);
	try {
		const module = await factory();
		countOutcome('retry');
		return module;
	} catch (retryError) {
		if (!isChunkLoadError(retryError) || !reloadOnceForNewBuild()) {
			throw retryError;
		}
		// Normally never settles: the page is going away. The timeout only
		// fires when the reload silently did nothing — then the error page
		// beats an endless spinner.
		return new Promise<TModule>((_, reject) => {
			window.setTimeout(() => reject(retryError), RELOAD_FALLBACK_MS);
		});
	}
};

/** `React.lazy` that survives a deploy. Use it for every lazy component. */
export const lazyWithReload = <TComponent extends ComponentType<any>>(
	factory: () => Promise<{ default: TComponent }>
) => lazy(() => loadChunk(factory));
