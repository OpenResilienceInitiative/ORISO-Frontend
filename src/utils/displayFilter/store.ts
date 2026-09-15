/**
 * Display filter — store (#1377 slice 2, spec §7).
 *
 * Observable singleton over one Matrix account-data key,
 * `org.oriso.display_filters`, with a user-scoped localStorage mirror.
 * React reads it through `useDisplayFilter`; the list integrations (slices
 * 3–5) read the same state.
 *
 * The rules this implements (numbered as in the spec):
 *  1. account data is authoritative whenever it exists;
 *  2. the mirror is read only at attach and seeds the account once, and
 *     "no event yet" is decided only after the initial sync (`PREPARED` or
 *     `SYNCING`); until then the store is read-only;
 *  3. updates before attach or before sync are rejected;
 *  4. writes are serialised: one request in flight, later changes coalesce
 *     into the next write, the mirror follows a completion only while its
 *     revision is still the latest;
 *  5. detach resets to hard defaults, removes the mirror key synchronously,
 *     and invalidates in-flight writes via an attachment generation; other
 *     tabs follow a removal through the `storage` event.
 * Plus the version rule: a record newer than this client supports is
 * read-only, and writes carry unknown top-level keys through unchanged.
 */

import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { DisplayFilterValue } from '../../components/displayFilter/displayFilterTypes';
import {
	DEFAULT_DISPLAY_FILTERS,
	DISPLAY_FILTERS_VERSION,
	DisplayFilter,
	DisplayFilterSection,
	OrisoDisplayFilters,
	isNewerDisplayFiltersVersion,
	parseDisplayFilters,
	withGlobalFilter,
	withSectionOverride,
	withoutSectionOverride
} from './model';

export const DISPLAY_FILTERS_EVENT_TYPE = 'org.oriso.display_filters';

/**
 * Inside the `oriso.` namespace so `purgeAppWebStorage` covers it, scoped
 * by user so another user's mirror is never a seed candidate (§7).
 */
export const mirrorKey = (userId: string): string =>
	`oriso.displayFilters.v1.${userId}`;

const isPreparedSyncState = (state: string | null | undefined): boolean =>
	state === 'PREPARED' || state === 'SYNCING';

export interface DisplayFilterStoreState {
	filters: OrisoDisplayFilters;
	/** Where the current state came from. */
	source: 'defaults' | 'mirror' | 'account';
	/** True once the attached client reported its initial sync. */
	synced: boolean;
	/** True when the stored record is newer than this client can write. */
	readOnly: boolean;
	/**
	 * True after an account-data write was rejected and the state rolled
	 * back to the last confirmed record; cleared by the next accepted update.
	 */
	writeFailed: boolean;
}

type Listener = () => void;

const readAccountData = (client: MatrixClient, type: string): unknown =>
	client.getAccountData(type as any)?.getContent();

const writeAccountData = (
	client: MatrixClient,
	type: string,
	content: object
): Promise<boolean> =>
	client
		.setAccountData(type as any, content as any)
		.then(() => true)
		.catch(() => false);

const readMirror = (userId: string): OrisoDisplayFilters | null => {
	try {
		const raw = localStorage.getItem(mirrorKey(userId));
		return raw ? parseDisplayFilters(JSON.parse(raw)) : null;
	} catch {
		return null;
	}
};

const writeMirror = (userId: string, filters: OrisoDisplayFilters): void => {
	try {
		localStorage.setItem(mirrorKey(userId), JSON.stringify(filters));
	} catch {
		/* storage full/unavailable — the mirror is best-effort */
	}
};

const removeMirror = (userId: string): void => {
	try {
		localStorage.removeItem(mirrorKey(userId));
	} catch {
		/* storage unavailable */
	}
};

const KNOWN_TOP_LEVEL_KEYS = new Set(['version', 'global', 'sections']);

/** Top-level keys this client does not know, carried through on write. */
const unknownTopLevelKeys = (raw: unknown): Record<string, unknown> => {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return {};
	}
	const extra: Record<string, unknown> = {};
	Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
		if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
			extra[key] = value;
		}
	});
	return extra;
};

const DEFAULT_STATE: DisplayFilterStoreState = {
	filters: DEFAULT_DISPLAY_FILTERS,
	source: 'defaults',
	synced: false,
	readOnly: false,
	writeFailed: false
};

class DisplayFilterStore {
	private state: DisplayFilterStoreState = DEFAULT_STATE;

	private listeners = new Set<Listener>();

	private client: MatrixClient | null = null;

	private userId: string | null = null;

	/** Bumped on every attach/detach; stale completions are ignored (§7.5). */
	private generation = 0;

	/** Bumped on every accepted update; the mirror follows the latest (§7.4). */
	private revision = 0;

	private writeInFlight = false;

	/** An update arrived while a write was pending → one more write. */
	private writeDirty = false;

	/** Unknown top-level keys of the stored record, preserved on write. */
	private extraKeys: Record<string, unknown> = {};

	/** The last record known to be in account data (rollback target). */
	private confirmed: OrisoDisplayFilters = DEFAULT_DISPLAY_FILTERS;

	private accountDataHandler = (event: MatrixEvent): void => {
		if (event.getType() !== DISPLAY_FILTERS_EVENT_TYPE) {
			return;
		}
		this.applyAccountContent(event.getContent());
	};

	private syncHandler = (syncState: string): void => {
		if (isPreparedSyncState(syncState)) {
			this.onSynced();
		}
	};

	private storageHandler = (event: StorageEvent): void => {
		if (
			this.userId &&
			event.key === mirrorKey(this.userId) &&
			event.newValue === null
		) {
			// Logout or hygiene purge in another tab of the same user.
			this.invalidate();
			this.setState({ ...DEFAULT_STATE });
		}
	};

	getState(): DisplayFilterStoreState {
		return this.state;
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private setState(partial: Partial<DisplayFilterStoreState>): void {
		this.state = { ...this.state, ...partial };
		this.listeners.forEach((listener) => listener());
	}

	/** Forget every pending write; the next attach starts clean. */
	private invalidate(): void {
		this.generation += 1;
		this.writeInFlight = false;
		this.writeDirty = false;
	}

	/**
	 * Attach the logged-in client. The mirror (if any) serves read-only until
	 * the initial sync has completed; then account data decides (§7.1–2).
	 */
	attachClient(client: MatrixClient): void {
		if (this.client === client) {
			return;
		}
		const nextUserId = client.getUserId?.() ?? null;
		if (this.client && nextUserId && nextUserId === this.userId) {
			// Same user, new client object (token refresh): keep the mirror
			// and the current state, only re-bind and re-await the sync.
			// Pending writes of the old client are invalidated.
			this.unbindClient();
			this.invalidate();
			this.client = client;
			this.setState({ synced: false });
			this.bindClient(client);
			return;
		}
		this.detachClient();
		this.invalidate();
		this.client = client;
		this.userId = nextUserId;
		this.extraKeys = {};
		this.confirmed = DEFAULT_DISPLAY_FILTERS;

		const mirrored = this.userId ? readMirror(this.userId) : null;
		this.setState({
			filters: mirrored ?? DEFAULT_DISPLAY_FILTERS,
			source: mirrored ? 'mirror' : 'defaults',
			synced: false,
			readOnly: mirrored ? isNewerDisplayFiltersVersion(mirrored) : false,
			writeFailed: false
		});
		this.bindClient(client);
	}

	private bindClient(client: MatrixClient): void {
		client.on('accountData' as any, this.accountDataHandler);
		client.on('sync' as any, this.syncHandler);
		if (typeof window !== 'undefined') {
			window.addEventListener('storage', this.storageHandler);
		}
		if (isPreparedSyncState(client.getSyncState?.())) {
			this.onSynced();
		}
	}

	private unbindClient(): void {
		if (typeof window !== 'undefined') {
			window.removeEventListener('storage', this.storageHandler);
		}
		if (this.client) {
			this.client.removeListener(
				'accountData' as any,
				this.accountDataHandler
			);
			this.client.removeListener('sync' as any, this.syncHandler);
		}
	}

	/** First completed sync of the attached client: account data decides. */
	private onSynced(): void {
		if (!this.client || this.state.synced) {
			return;
		}
		const raw = readAccountData(this.client, DISPLAY_FILTERS_EVENT_TYPE);
		const stored = parseDisplayFilters(raw);
		if (stored) {
			this.extraKeys = unknownTopLevelKeys(raw);
			this.confirmed = stored;
			this.setState({
				filters: stored,
				source: 'account',
				synced: true,
				readOnly: isNewerDisplayFiltersVersion(stored),
				writeFailed: false
			});
			if (this.userId) {
				writeMirror(this.userId, stored);
			}
			return;
		}
		if (this.state.readOnly) {
			// No event, but the mirror is from a newer app version: seeding
			// would strip fields this client cannot parse and pin the record
			// to our version. Stay read-only until that version writes.
			this.setState({ synced: true });
			return;
		}
		// No (parseable) event yet: the mirror or the defaults seed the
		// account once. A malformed record is replaced by this write.
		const seed = this.state.filters;
		this.extraKeys = {};
		this.setState({
			filters: seed,
			source: 'account',
			synced: true,
			readOnly: false
		});
		this.revision += 1;
		this.startWrite();
	}

	private applyAccountContent(raw: unknown): void {
		const stored = parseDisplayFilters(raw);
		if (!stored) {
			return;
		}
		this.extraKeys = unknownTopLevelKeys(raw);
		this.confirmed = stored;
		this.setState({
			filters: stored,
			source: 'account',
			readOnly: isNewerDisplayFiltersVersion(stored),
			writeFailed: false
		});
		if (this.userId && !this.writeInFlight) {
			writeMirror(this.userId, stored);
		}
	}

	/**
	 * Detach: hard defaults, mirror key removed synchronously with the
	 * user-scoped key captured at attach, pending writes invalidated (§7.5).
	 */
	detachClient(): void {
		this.unbindClient();
		if (this.userId) {
			removeMirror(this.userId);
		}
		this.invalidate();
		this.client = null;
		this.userId = null;
		this.extraKeys = {};
		this.confirmed = DEFAULT_DISPLAY_FILTERS;
		this.setState({ ...DEFAULT_STATE });
	}

	/** True when writes are currently accepted (§7.3 and the version rule). */
	canWrite(): boolean {
		return (
			this.client !== null && this.state.synced && !this.state.readOnly
		);
	}

	/**
	 * Applies `mutate` to the current record and persists it. Returns `false`
	 * (and changes nothing) before attach, before sync, or in read-only mode.
	 */
	update(
		mutate: (current: OrisoDisplayFilters) => OrisoDisplayFilters
	): boolean {
		if (!this.canWrite()) {
			return false;
		}
		const next = {
			...mutate(this.state.filters),
			version: DISPLAY_FILTERS_VERSION
		};
		this.setState({ filters: next, source: 'account', writeFailed: false });
		this.revision += 1;
		this.startWrite();
		return true;
	}

	/** Serialised write: at most one in flight, later state coalesces (§7.4). */
	private startWrite(): void {
		if (this.writeInFlight) {
			this.writeDirty = true;
			return;
		}
		const client = this.client;
		const userId = this.userId;
		if (!client) {
			return;
		}
		const generation = this.generation;
		const revision = this.revision;
		const content = { ...this.extraKeys, ...this.state.filters };
		this.writeInFlight = true;
		this.writeDirty = false;
		void writeAccountData(client, DISPLAY_FILTERS_EVENT_TYPE, content).then(
			(ok) => {
				if (generation !== this.generation) {
					// Detached (or logged out elsewhere) meanwhile: never
					// touch the mirror or the state of the next user.
					return;
				}
				this.writeInFlight = false;
				if (ok && revision === this.revision) {
					this.confirmed = this.state.filters;
					if (userId) {
						writeMirror(userId, this.state.filters);
					}
				} else if (!ok && !this.writeDirty) {
					// Rejected and nothing newer queued: the optimistic state
					// would be lost on reload or on another device, so roll
					// back to the last confirmed record and say so. A newer
					// queued update retries with its own content instead.
					this.setState({
						filters: this.confirmed,
						writeFailed: true
					});
				}
				if (this.writeDirty) {
					this.startWrite();
				}
			}
		);
	}

	setSection(
		section: DisplayFilterSection,
		value: DisplayFilterValue
	): boolean {
		return this.update((current) =>
			withSectionOverride(current, section, value)
		);
	}

	resetSection(section: DisplayFilterSection): boolean {
		return this.update((current) =>
			withoutSectionOverride(current, section)
		);
	}

	setGlobal(section: DisplayFilterSection, filter: DisplayFilter): boolean {
		return this.update((current) =>
			withGlobalFilter(current, section, filter)
		);
	}

	/** Test seam. */
	resetForTests(): void {
		this.detachClient();
		this.listeners.clear();
		this.revision = 0;
	}
}

export const displayFilterStore = new DisplayFilterStore();
