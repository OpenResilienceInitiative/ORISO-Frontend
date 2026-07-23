// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { MatrixEventEvent } from 'matrix-js-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMatrixDecryptionFailures } from './useMatrixDecryptionFailures';

const { getMatrixClientServiceMock } = vi.hoisted(() => ({
	getMatrixClientServiceMock: vi.fn()
}));

vi.mock('../services/matrixClientRegistry', () => ({
	getMatrixClientService: getMatrixClientServiceMock
}));

class FakeMatrixEvent {
	private listeners = new Map<string, Set<() => void>>();

	constructor(
		private readonly id: string,
		public type = 'm.room.encrypted',
		public decryptionFailure = true
	) {}

	getId = () => this.id;

	getType = () => this.type;

	isDecryptionFailure = () => this.decryptionFailure;

	on = (name: string, listener: () => void) => {
		const listeners = this.listeners.get(name) ?? new Set();
		listeners.add(listener);
		this.listeners.set(name, listeners);
	};

	off = (name: string, listener: () => void) => {
		this.listeners.get(name)?.delete(listener);
	};

	emitDecrypted = () => {
		this.listeners
			.get(MatrixEventEvent.Decrypted)
			?.forEach((listener) => listener());
	};

	listenerCount = () =>
		this.listeners.get(MatrixEventEvent.Decrypted)?.size ?? 0;
}

const createClient = (events: FakeMatrixEvent[]) => {
	const timelineListeners = new Set<(...args: any[]) => void>();
	return {
		getRoom: vi.fn(() => ({
			getLiveTimeline: () => ({ getEvents: () => events })
		})),
		on: vi.fn((name: string, listener: (...args: any[]) => void) => {
			if (name === 'Room.timeline') timelineListeners.add(listener);
		}),
		off: vi.fn((name: string, listener: (...args: any[]) => void) => {
			if (name === 'Room.timeline') timelineListeners.delete(listener);
		})
	};
};

describe('useMatrixDecryptionFailures listener lifecycle', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		getMatrixClientServiceMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('unbinds and stops tracking an event after successful decryption', () => {
		const event = new FakeMatrixEvent('$event');
		const client = createClient([event]);
		getMatrixClientServiceMock.mockReturnValue({ getClient: () => client });

		const { result } = renderHook(() =>
			useMatrixDecryptionFailures('!room:example.org')
		);

		expect(event.listenerCount()).toBe(1);
		event.type = 'm.room.message';
		event.decryptionFailure = false;
		act(() => event.emitDecrypted());

		expect(event.listenerCount()).toBe(0);
		act(() => vi.advanceTimersByTime(12_000));
		expect(result.current.size).toBe(0);
	});

	it('keeps a failed event tracked until a later decrypt succeeds', () => {
		const event = new FakeMatrixEvent('$event');
		const client = createClient([event]);
		getMatrixClientServiceMock.mockReturnValue({ getClient: () => client });

		const { result } = renderHook(() =>
			useMatrixDecryptionFailures('!room:example.org')
		);

		act(() => vi.advanceTimersByTime(12_000));
		expect(result.current.has('$event')).toBe(true);
		expect(event.listenerCount()).toBe(1);

		event.type = 'm.room.message';
		event.decryptionFailure = false;
		act(() => event.emitDecrypted());

		expect(result.current.size).toBe(0);
		expect(event.listenerCount()).toBe(0);
	});
});
