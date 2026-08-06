// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsProvider } from './NotificationsProvider';
import { messageEventEmitter } from '../../services/messageEventEmitter';

const apiGetEventNotifications = vi.fn();

vi.mock('../../api/apiEventNotifications', () => ({
	apiGetEventNotifications: (...args: unknown[]) =>
		apiGetEventNotifications(...args),
	apiMarkEventNotificationRead: vi.fn(),
	apiMarkAllEventNotificationsRead: vi.fn(),
	apiClearEventNotifications: vi.fn()
}));

vi.mock('../../components/sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: () => 'fake-token'
}));

describe('NotificationsProvider real-time refresh (#473)', () => {
	beforeEach(() => {
		apiGetEventNotifications.mockReset();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
	});

	// The provider subscribes to a singleton emitter — unmount it between cases so
	// stale listeners don't fire on the next test's emit.
	afterEach(() => cleanup());

	it('refetches the feed when a live directMessage event fires, without waiting for the 15s poll', async () => {
		render(
			<NotificationsProvider>
				<div />
			</NotificationsProvider>
		);

		// Initial mount fetch — let it settle, then isolate the live-event refetch.
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalled()
		);
		apiGetEventNotifications.mockClear();

		// The client's own Matrix sync re-emits room events on
		// messageEventEmitter (there is no backend live push, see #845);
		// any such signal must refresh the feed ahead of the 15s poll.
		messageEventEmitter.emit({});

		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
		);
	});

	it('collapses a burst of live events into a single debounced refetch', async () => {
		render(
			<NotificationsProvider>
				<div />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalled()
		);
		apiGetEventNotifications.mockClear();

		messageEventEmitter.emit({});
		messageEventEmitter.emit({});
		messageEventEmitter.emit({});

		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
		);
		// Give any un-debounced extra calls a chance to (wrongly) fire.
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(apiGetEventNotifications).toHaveBeenCalledTimes(1);
	});
});
