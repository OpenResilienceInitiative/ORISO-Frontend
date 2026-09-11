// @vitest-environment jsdom
/**
 * Unread axis (#1147) — reactivity for the client-side unread derivation.
 *
 * `useUnreadVersion` bumps whenever the Matrix client reports a change that
 * can flip a room between read and unread (notification counts, receipts),
 * so list consumers re-run `isChatItemUnread` without polling the backend.
 */

import { act, renderHook } from '@testing-library/react';
import { RoomEvent } from 'matrix-js-sdk';
import { afterEach, describe, expect, it } from 'vitest';
import { setMatrixClientServiceRef } from '../services/matrixClientRegistry';
import { useUnreadVersion } from './useUnreadVersion';

type Listener = (...args: unknown[]) => void;

const buildFakeClient = () => {
	const listeners = new Map<string, Set<Listener>>();
	return {
		on: (event: string, cb: Listener) => {
			if (!listeners.has(event)) {
				listeners.set(event, new Set());
			}
			listeners.get(event)!.add(cb);
		},
		removeListener: (event: string, cb: Listener) => {
			listeners.get(event)?.delete(cb);
		},
		emit: (event: string) => {
			listeners.get(event)?.forEach((cb) => cb());
		},
		listenerCount: (event: string) => listeners.get(event)?.size ?? 0
	};
};

describe('useUnreadVersion', () => {
	afterEach(() => {
		setMatrixClientServiceRef(null);
	});

	it('bumps when the Matrix client reports changed unread notifications', () => {
		const client = buildFakeClient();
		setMatrixClientServiceRef({ getClient: () => client } as any);

		const { result } = renderHook(() => useUnreadVersion());
		const initial = result.current;

		act(() => {
			client.emit(RoomEvent.UnreadNotifications);
		});

		expect(result.current).not.toBe(initial);
	});

	it('bumps when a read receipt arrives (own or another device)', () => {
		const client = buildFakeClient();
		setMatrixClientServiceRef({ getClient: () => client } as any);

		const { result } = renderHook(() => useUnreadVersion());
		const initial = result.current;

		act(() => {
			client.emit(RoomEvent.Receipt);
		});

		expect(result.current).not.toBe(initial);
	});

	it('unsubscribes from the client on unmount', () => {
		const client = buildFakeClient();
		setMatrixClientServiceRef({ getClient: () => client } as any);

		const { unmount } = renderHook(() => useUnreadVersion());
		expect(client.listenerCount(RoomEvent.UnreadNotifications)).toBe(1);

		unmount();

		expect(client.listenerCount(RoomEvent.UnreadNotifications)).toBe(0);
		expect(client.listenerCount(RoomEvent.Receipt)).toBe(0);
	});

	it('stays inert without a Matrix client', () => {
		setMatrixClientServiceRef(null);

		const { result } = renderHook(() => useUnreadVersion());

		expect(result.current).toBe(0);
	});
});
