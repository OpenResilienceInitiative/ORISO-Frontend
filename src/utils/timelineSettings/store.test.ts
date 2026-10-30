/**
 * ADR-021 — timeline settings store and model against a fake Matrix client.
 *
 * @vitest-environment oriso-jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { DEFAULT_TIMELINE_SETTINGS, parseTimelineSettings } from './model';
import {
	TIMELINE_SETTINGS_EVENT_TYPE,
	timelineMirrorKey,
	timelineSettingsStore
} from './store';

type Handler = (...args: any[]) => void;

const makeClient = (
	options: { synced?: boolean; initial?: any; failWrites?: boolean } = {}
) => {
	const accountData = new Map<string, any>();
	if (options.initial !== undefined)
		accountData.set(TIMELINE_SETTINGS_EVENT_TYPE, options.initial);
	const handlers: Record<string, Handler[]> = {};
	let syncState: string | null = options.synced === false ? null : 'PREPARED';
	return {
		getUserId: () => '@frank:oriso.test',
		getSyncState: () => syncState,
		getAccountData: (type: string) =>
			accountData.has(type)
				? { getContent: () => accountData.get(type) }
				: undefined,
		setAccountData: vi.fn((type: string, content: any) => {
			if (options.failWrites) return Promise.reject(new Error('403'));
			accountData.set(type, content);
			return Promise.resolve();
		}),
		on: (event: string, handler: Handler) => {
			(handlers[event] ||= []).push(handler);
		},
		removeListener: (event: string, handler: Handler) => {
			handlers[event] = (handlers[event] || []).filter(
				(h) => h !== handler
			);
		},
		sync: (state: string) => {
			syncState = state;
			(handlers.sync || []).forEach((h) => h(state));
		},
		emitAccountData: (type: string, content: any) => {
			accountData.set(type, content);
			(handlers.accountData || []).forEach((h) =>
				h({ getType: () => type, getContent: () => content })
			);
		},
		stored: () => accountData.get(TIMELINE_SETTINGS_EVENT_TYPE)
	};
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
	timelineSettingsStore.resetForTests();
	localStorage.clear();
});

describe('timeline settings model', () => {
	it('falls back per value, never as a whole', () => {
		expect(
			parseTimelineSettings({
				version: 1,
				scrollModel: 'single',
				pastDate: 'sideways',
				reveal: 'half'
			})
		).toEqual({
			...DEFAULT_TIMELINE_SETTINGS,
			scrollModel: 'single',
			reveal: 'half'
		});
		expect(parseTimelineSettings(null)).toEqual(DEFAULT_TIMELINE_SETTINGS);
	});
});

describe('timeline settings store', () => {
	it('reads the stored record after the initial sync', () => {
		const client = makeClient({
			initial: { version: 1, scrollModel: 'single', reveal: 'next' }
		});
		timelineSettingsStore.attachClient(client as any);
		const { settings, synced } = timelineSettingsStore.getState();
		expect(synced).toBe(true);
		expect(settings.scrollModel).toBe('single');
		expect(settings.reveal).toBe('next');
	});

	it('refuses writes before the initial sync', () => {
		const client = makeClient({ synced: false });
		timelineSettingsStore.attachClient(client as any);
		expect(timelineSettingsStore.update({ pastDate: 'off' })).toBe(false);
		client.sync('PREPARED');
		expect(timelineSettingsStore.update({ pastDate: 'off' })).toBe(true);
		expect(client.stored().pastDate).toBe('off');
	});

	it('writes unknown keys of a stored record back unchanged', async () => {
		const client = makeClient({
			initial: { version: 1, futureKey: { keep: true } }
		});
		timelineSettingsStore.attachClient(client as any);
		timelineSettingsStore.update({ scrollModel: 'single' });
		await flush();
		expect(client.stored()).toMatchObject({
			futureKey: { keep: true },
			scrollModel: 'single'
		});
		expect(
			JSON.parse(
				localStorage.getItem(timelineMirrorKey('@frank:oriso.test'))!
			).scrollModel
		).toBe('single');
	});

	it('rolls back a rejected write', async () => {
		const client = makeClient({ failWrites: true });
		timelineSettingsStore.attachClient(client as any);
		timelineSettingsStore.update({ reveal: 'most' });
		expect(timelineSettingsStore.getState().settings.reveal).toBe('most');
		await flush();
		expect(timelineSettingsStore.getState().settings.reveal).toBe('none');
		expect(timelineSettingsStore.getState().writeFailed).toBe(true);
	});

	it('follows a change from another device', () => {
		const client = makeClient();
		timelineSettingsStore.attachClient(client as any);
		client.emitAccountData(TIMELINE_SETTINGS_EVENT_TYPE, {
			version: 1,
			nowVariant: 'band'
		});
		expect(timelineSettingsStore.getState().settings.nowVariant).toBe(
			'band'
		);
	});

	it('is read-only for a record of a newer client', () => {
		const client = makeClient({ initial: { version: 99 } });
		timelineSettingsStore.attachClient(client as any);
		expect(timelineSettingsStore.update({ pastDate: 'off' })).toBe(false);
	});

	it('detach drops the mirror and returns to defaults', async () => {
		const client = makeClient();
		timelineSettingsStore.attachClient(client as any);
		timelineSettingsStore.update({ pastDate: 'line' });
		await flush();
		timelineSettingsStore.detachClient();
		expect(timelineSettingsStore.getState().settings).toEqual(
			DEFAULT_TIMELINE_SETTINGS
		);
		expect(
			localStorage.getItem(timelineMirrorKey('@frank:oriso.test'))
		).toBeNull();
	});
});
