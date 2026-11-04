/**
 * Timeline settings — store (ADR-021). One Matrix account-data key,
 * `org.oriso.timeline_settings`, with a user-scoped localStorage mirror for
 * the first paint. Same rules as the display-filter store, kept small:
 *  - account data decides once the client reported its initial sync;
 *  - no writes before attach or sync, none to a record from a newer client;
 *  - a rejected write rolls back to the last confirmed record;
 *  - unknown top-level keys of the stored record are written back unchanged;
 *  - detach resets to defaults and removes the mirror.
 */

import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
	DEFAULT_TIMELINE_SETTINGS,
	TIMELINE_SETTINGS_VERSION,
	TimelineSettings,
	isNewerTimelineSettingsVersion,
	parseTimelineSettings
} from './model';

export const TIMELINE_SETTINGS_EVENT_TYPE = 'org.oriso.timeline_settings';

/** Inside the `oriso.` namespace so `purgeAppWebStorage` covers it. */
export const timelineMirrorKey = (userId: string): string =>
	`oriso.timelineSettings.v1.${userId}`;

const isPreparedSyncState = (state: string | null | undefined): boolean =>
	state === 'PREPARED' || state === 'SYNCING';

export interface TimelineSettingsState {
	settings: TimelineSettings;
	synced: boolean;
	readOnly: boolean;
	writeFailed: boolean;
}

const DEFAULT_STATE: TimelineSettingsState = {
	settings: DEFAULT_TIMELINE_SETTINGS,
	synced: false,
	readOnly: false,
	writeFailed: false
};

const KNOWN_KEYS = new Set(Object.keys(DEFAULT_TIMELINE_SETTINGS));

const extraKeysOf = (raw: unknown): Record<string, unknown> =>
	typeof raw === 'object' && raw !== null && !Array.isArray(raw)
		? Object.fromEntries(
				Object.entries(raw as Record<string, unknown>).filter(
					([key]) => !KNOWN_KEYS.has(key)
				)
			)
		: {};

const readMirror = (userId: string): TimelineSettings | null => {
	try {
		const raw = localStorage.getItem(timelineMirrorKey(userId));
		return raw ? parseTimelineSettings(JSON.parse(raw)) : null;
	} catch {
		return null;
	}
};

const writeMirror = (userId: string, settings: TimelineSettings): void => {
	try {
		localStorage.setItem(
			timelineMirrorKey(userId),
			JSON.stringify(settings)
		);
	} catch {
		/* best effort */
	}
};

const removeMirror = (userId: string): void => {
	try {
		localStorage.removeItem(timelineMirrorKey(userId));
	} catch {
		/* storage unavailable */
	}
};

class TimelineSettingsStore {
	private state: TimelineSettingsState = DEFAULT_STATE;

	private listeners = new Set<() => void>();

	private client: MatrixClient | null = null;

	private userId: string | null = null;

	/** Bumped on attach/detach; completions of an older attachment are ignored. */
	private generation = 0;

	/** Bumped on every accepted update; only the latest write may confirm. */
	private revision = 0;

	private confirmed: TimelineSettings = DEFAULT_TIMELINE_SETTINGS;

	private extraKeys: Record<string, unknown> = {};

	private accountDataHandler = (event: MatrixEvent): void => {
		if (event.getType() !== TIMELINE_SETTINGS_EVENT_TYPE) return;
		this.adopt(event.getContent());
	};

	private syncHandler = (syncState: string): void => {
		if (isPreparedSyncState(syncState)) this.onSynced();
	};

	getState(): TimelineSettingsState {
		return this.state;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private setState(partial: Partial<TimelineSettingsState>): void {
		this.state = { ...this.state, ...partial };
		this.listeners.forEach((listener) => listener());
	}

	attachClient(client: MatrixClient): void {
		if (this.client === client) return;
		this.detachClient();
		this.client = client;
		this.userId = client.getUserId?.() ?? null;
		const mirrored = this.userId ? readMirror(this.userId) : null;
		if (mirrored) {
			this.setState({
				settings: mirrored,
				readOnly: isNewerTimelineSettingsVersion(mirrored)
			});
		}
		client.on('accountData' as any, this.accountDataHandler);
		client.on('sync' as any, this.syncHandler);
		if (isPreparedSyncState(client.getSyncState?.())) this.onSynced();
	}

	detachClient(): void {
		if (this.client) {
			this.client.removeListener(
				'accountData' as any,
				this.accountDataHandler
			);
			this.client.removeListener('sync' as any, this.syncHandler);
		}
		if (this.userId) removeMirror(this.userId);
		this.generation += 1;
		this.client = null;
		this.userId = null;
		this.confirmed = DEFAULT_TIMELINE_SETTINGS;
		this.extraKeys = {};
		this.setState({ ...DEFAULT_STATE });
	}

	private onSynced(): void {
		if (!this.client || this.state.synced) return;
		const raw = this.client
			.getAccountData(TIMELINE_SETTINGS_EVENT_TYPE as any)
			?.getContent();
		if (raw && typeof raw === 'object') {
			this.adopt(raw);
		} else {
			// No record yet: defaults (or the mirror) stand until the first change.
			this.setState({ synced: true });
		}
	}

	/** A stored record (initial sync or another device) replaces the state. */
	private adopt(raw: unknown): void {
		const stored = parseTimelineSettings(raw);
		this.confirmed = stored;
		this.extraKeys = extraKeysOf(raw);
		this.setState({
			settings: stored,
			synced: true,
			readOnly: isNewerTimelineSettingsVersion(stored),
			writeFailed: false
		});
		if (this.userId) writeMirror(this.userId, stored);
	}

	canWrite(): boolean {
		return (
			this.client !== null && this.state.synced && !this.state.readOnly
		);
	}

	/** Returns false (and changes nothing) before sync or on a newer record. */
	update(patch: Partial<Omit<TimelineSettings, 'version'>>): boolean {
		if (!this.canWrite() || !this.client) return false;
		const next: TimelineSettings = {
			...this.state.settings,
			...patch,
			version: TIMELINE_SETTINGS_VERSION
		};
		this.revision += 1;
		const revision = this.revision;
		const generation = this.generation;
		const userId = this.userId;
		this.setState({ settings: next, writeFailed: false });
		this.client
			.setAccountData(
				TIMELINE_SETTINGS_EVENT_TYPE as any,
				{ ...this.extraKeys, ...next } as any
			)
			.then(
				() => true,
				() => false
			)
			.then((ok) => {
				if (generation !== this.generation) return;
				if (ok) {
					if (revision === this.revision) {
						this.confirmed = next;
						if (userId) writeMirror(userId, next);
					}
					return;
				}
				if (revision === this.revision) {
					this.setState({
						settings: this.confirmed,
						writeFailed: true
					});
				}
			});
		return true;
	}

	resetForTests(): void {
		this.detachClient();
		this.revision = 0;
	}
}

export const timelineSettingsStore = new TimelineSettingsStore();
