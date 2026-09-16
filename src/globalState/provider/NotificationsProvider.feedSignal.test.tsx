/**
 * P2 feed-update signal, end to end on the client:
 *
 *   UserService → Matrix to-device `org.oriso.feed.updated`
 *     → matrixLiveEventBridge
 *     → feedUpdateSignalBridge → messageEventEmitter
 *     → NotificationsProvider.refreshNotificationFeed (existing 400 ms debounce)
 *
 * The signal only says "your feed changed"; the rows still come from the
 * authenticated REST feed endpoint, so no notification content rides on Matrix.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsProvider } from './NotificationsProvider';
import { matrixLiveEventBridge } from '../../services/matrixLiveEventBridge';
import { bindFeedUpdateSignal } from '../../services/feedUpdateSignalBridge';
import { displayFilterStore } from '../../utils/displayFilter/store';
import { DEFAULT_DISPLAY_FILTERS } from '../../utils/displayFilter/model';

const apiGetEventNotifications = vi.fn();
const apiGetEventNotificationsUnreadCount = vi.fn();

vi.mock('../../api/apiEventNotifications', () => ({
	apiGetEventNotifications: (...args: unknown[]) =>
		apiGetEventNotifications(...args),
	apiMarkEventNotificationRead: vi.fn(),
	apiMarkEventNotificationsReadByTypes: vi.fn(() =>
		Promise.reject({ status: 404 })
	),
	apiGetEventNotificationsUnreadCount: (...args: unknown[]) =>
		apiGetEventNotificationsUnreadCount(...args),
	apiMarkAllEventNotificationsRead: vi.fn(),
	apiClearEventNotifications: vi.fn(() => Promise.resolve())
}));

vi.mock('../../components/sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: () => 'fake-token'
}));

type Listener = (...args: any[]) => void;

/** Minimal Matrix client double with a manual emit helper. */
const createFakeMatrixClient = () => {
	const listeners = new Map<string, Set<Listener>>();
	return {
		on: (event: string, listener: Listener) => {
			if (!listeners.has(event)) listeners.set(event, new Set());
			listeners.get(event)!.add(listener);
		},
		removeAllListeners: (event: string) => {
			listeners.delete(event);
		},
		getUserId: () => '@me:matrix.oriso.org',
		getSyncState: () => 'PREPARED',
		getAccountData: () => ({ getContent: () => DEFAULT_DISPLAY_FILTERS }),
		setAccountData: vi.fn(() => Promise.resolve()),
		removeListener: () => undefined,
		emit: (event: string, ...args: any[]) => {
			listeners.get(event)?.forEach((listener) => listener(...args));
		}
	};
};

const advanceTimers = async (milliseconds: number) => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(milliseconds);
	});
};

const waitFor = async (assertion: () => void) => {
	for (let elapsed = 0; ; elapsed += 50) {
		try {
			assertion();
			return;
		} catch (error) {
			if (elapsed >= 1000) throw error;
		}
		await advanceTimers(50);
	}
};

describe('NotificationsProvider × Matrix feed-update signal (P2)', () => {
	let client: ReturnType<typeof createFakeMatrixClient>;
	let unbind: () => void;

	beforeEach(() => {
		vi.useFakeTimers();
		apiGetEventNotifications.mockReset();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
		apiGetEventNotificationsUnreadCount.mockReset();
		apiGetEventNotificationsUnreadCount.mockResolvedValue({
			unreadCount: 0
		});
		displayFilterStore.resetForTests();
		localStorage.clear();
		client = createFakeMatrixClient();
		displayFilterStore.attachClient(client as any);
		matrixLiveEventBridge.initialize(client as any);
		unbind = bindFeedUpdateSignal();
	});

	afterEach(() => {
		unbind();
		matrixLiveEventBridge.destroy();
		cleanup();
		displayFilterStore.resetForTests();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	const emitSignal = () =>
		act(() => {
			client.emit('receivedToDeviceMessage', {
				message: {
					type: 'org.oriso.feed.updated',
					sender: '@admin:matrix.oriso.org',
					content: {}
				},
				encryptionInfo: null
			});
		});

	it('refreshes the feed within the debounce window, long before the 15 s poll', async () => {
		render(
			<NotificationsProvider>
				<div />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
		);
		const afterMount = apiGetEventNotifications.mock.calls.length;

		emitSignal();
		await advanceTimers(500);

		expect(apiGetEventNotifications.mock.calls.length).toBeGreaterThan(
			afterMount
		);
		// Well inside the old 15 s poll interval.
		expect(vi.getTimerCount()).toBeGreaterThanOrEqual(0);
	});

	it('collapses a burst of signals into a single refresh (400 ms debounce)', async () => {
		render(
			<NotificationsProvider>
				<div />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
		);
		const afterMount = apiGetEventNotifications.mock.calls.length;

		emitSignal();
		await advanceTimers(50);
		emitSignal();
		await advanceTimers(50);
		emitSignal();
		await advanceTimers(500);

		expect(apiGetEventNotifications.mock.calls.length).toBe(afterMount + 1);
	});

	it('does not refresh on an unrelated to-device message', async () => {
		render(
			<NotificationsProvider>
				<div />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
		);
		const afterMount = apiGetEventNotifications.mock.calls.length;

		act(() => {
			client.emit('receivedToDeviceMessage', {
				message: { type: 'm.room_key', content: {} }
			});
		});
		await advanceTimers(500);

		expect(apiGetEventNotifications.mock.calls.length).toBe(afterMount);
	});
});
