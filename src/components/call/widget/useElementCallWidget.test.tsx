// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useElementCallWidget } from './useElementCallWidget';

const widgetApiMocks = vi.hoisted(() => ({
	widgetDefinitions: [] as Array<Record<string, unknown>>,
	apiInstances: [] as any[]
}));

vi.mock('matrix-widget-api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('matrix-widget-api')>();
	return {
		...actual,
		MatrixWidgetType: { Custom: 'm.custom' },
		Widget: class {
			public constructor(definition: Record<string, unknown>) {
				widgetApiMocks.widgetDefinitions.push(definition);
			}
		},
		ClientWidgetApi: class {
			public readonly transport = {
				reply: vi.fn(),
				send: vi.fn().mockResolvedValue({})
			};

			public readonly setViewedRoomId = vi.fn();
			public readonly updateTheme = vi.fn().mockResolvedValue({});
			public readonly feedEvent = vi.fn().mockResolvedValue(undefined);
			public readonly feedToDevice = vi.fn().mockResolvedValue(undefined);
			public readonly feedStateUpdate = vi
				.fn()
				.mockResolvedValue(undefined);
			public readonly stop = vi.fn();

			private readonly listeners = new Map<
				string,
				Set<(event: CustomEvent) => void>
			>();

			public readonly on = vi.fn(
				(eventName: string, listener: (event: CustomEvent) => void) => {
					const listeners =
						this.listeners.get(eventName) ?? new Set();
					listeners.add(listener);
					this.listeners.set(eventName, listeners);
				}
			);

			public constructor() {
				widgetApiMocks.apiInstances.push(this);
			}

			public emit(eventName: string, event: CustomEvent): void {
				this.listeners
					.get(eventName)
					?.forEach((listener) => listener(event));
			}
		}
	};
});

vi.mock('../../../resources/scripts/runtimeConfig', () => ({
	getElementCallBaseUrl: () => 'https://call.oriso.example'
}));

const CALL_ROOM = '!call:oriso.example';

type TestMatrixClient = MatrixClient & {
	emitTest: (eventName: string, ...args: unknown[]) => void;
};

const createClient = ({
	membership = 'join',
	joinRoom = vi.fn().mockResolvedValue(undefined)
}: {
	membership?: string;
	joinRoom?: ReturnType<typeof vi.fn>;
} = {}): TestMatrixClient => {
	const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	return {
		getUserId: vi.fn().mockReturnValue('@user:oriso.example'),
		getDeviceId: vi.fn().mockReturnValue('ORISO_WEB_123'),
		getHomeserverUrl: vi
			.fn()
			.mockReturnValue('https://matrix.oriso.example'),
		getRoom: vi.fn().mockReturnValue({
			getMyMembership: () => membership,
			getLiveTimeline: () => ({
				getState: () => ({
					getStateEvents: () => []
				})
			})
		}),
		joinRoom,
		on: vi.fn(
			(eventName: string, listener: (...args: unknown[]) => void) => {
				const eventListeners = listeners.get(eventName) ?? new Set();
				eventListeners.add(listener);
				listeners.set(eventName, eventListeners);
			}
		),
		off: vi.fn(
			(eventName: string, listener: (...args: unknown[]) => void) => {
				listeners.get(eventName)?.delete(listener);
			}
		),
		emitTest: (eventName: string, ...args: unknown[]) => {
			listeners.get(eventName)?.forEach((listener) => listener(...args));
		}
	} as unknown as TestMatrixClient;
};

describe('useElementCallWidget', () => {
	beforeEach(() => {
		vi.stubGlobal('crypto', webcrypto as unknown as Crypto);
		widgetApiMocks.widgetDefinitions.length = 0;
		widgetApiMocks.apiInstances.length = 0;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('waits for room join and never puts credentials or premature E2EE flags in the URL', async () => {
		let finishJoin: (() => void) | undefined;
		const joinRoom = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finishJoin = resolve;
				})
		);
		const client = createClient({ membership: 'invite', joinRoom });

		const { result } = renderHook(() =>
			useElementCallWidget(client, {
				roomId: CALL_ROOM,
				isVideo: true
			})
		);

		expect(joinRoom).toHaveBeenCalledWith(CALL_ROOM);
		expect(result.current.url).toBeNull();

		act(() => finishJoin?.());
		await waitFor(() => expect(result.current.url).not.toBeNull());

		const url = new URL(result.current.url!);
		expect(url.origin).toBe('https://call.oriso.example');
		expect(url.search).toBe('');
		const fragment = new URLSearchParams(url.hash.slice(2));
		expect(fragment.get('roomId')).toBe(CALL_ROOM);
		expect(fragment.get('deviceId')).toBe('ORISO_WEB_123');
		expect(fragment.get('userId')).toBe('@user:oriso.example');
		expect(fragment.get('baseUrl')).toBe('https://matrix.oriso.example');
		expect(fragment.get('widgetId')).toMatch(/^oriso-call-[a-f0-9]{64}$/);
		expect(url.searchParams.has('accessToken')).toBe(false);
		expect(fragment.has('accessToken')).toBe(false);
		expect(fragment.has('password')).toBe(false);
		expect(fragment.has('enableE2EE')).toBe(false);
		expect(fragment.get('perParticipantE2EE')).toBe('true');
	});

	it('fails closed when the host cannot join the call room', async () => {
		const joinRoom = vi.fn().mockRejectedValue(new Error('join denied'));
		const client = createClient({ membership: 'invite', joinRoom });

		const { result } = renderHook(() =>
			useElementCallWidget(client, {
				roomId: CALL_ROOM,
				isVideo: false
			})
		);

		await waitFor(() =>
			expect(result.current.error?.message).toBe('join denied')
		);
		expect(result.current.url).toBeNull();
		expect(widgetApiMocks.apiInstances).toHaveLength(0);
	});

	it('uses a different opaque widget id for each mounted call surface', async () => {
		const first = renderHook(() =>
			useElementCallWidget(createClient(), {
				roomId: CALL_ROOM,
				isVideo: true
			})
		);
		const second = renderHook(() =>
			useElementCallWidget(createClient(), {
				roomId: CALL_ROOM,
				isVideo: true
			})
		);
		await waitFor(() => {
			expect(first.result.current.url).not.toBeNull();
			expect(second.result.current.url).not.toBeNull();
		});

		const widgetId = (url: string): string | null =>
			new URLSearchParams(new URL(url).hash.slice(2)).get('widgetId');

		expect(widgetId(first.result.current.url!)).not.toBe(
			widgetId(second.result.current.url!)
		);
	});

	it('rejects an iframe from any origin other than the configured Element Call origin', async () => {
		const client = createClient();
		const { result } = renderHook(() =>
			useElementCallWidget(client, {
				roomId: CALL_ROOM,
				isVideo: true
			})
		);
		await waitFor(() => expect(result.current.url).not.toBeNull());

		const iframe = document.createElement('iframe');
		iframe.src = 'https://attacker.example/room';
		act(() => result.current.attachIframe(iframe));

		expect(result.current.error?.message).toMatch(/origin/i);
		expect(widgetApiMocks.apiInstances).toHaveLength(0);
	});

	it('blocks spoofed messages on the mounted widget channel', async () => {
		const client = createClient();
		const { result } = renderHook(() =>
			useElementCallWidget(client, {
				roomId: CALL_ROOM,
				isVideo: true
			})
		);
		await waitFor(() => expect(result.current.url).not.toBeNull());

		const iframe = document.createElement('iframe');
		iframe.src = result.current.url!;
		act(() => result.current.attachIframe(iframe));

		const widgetId = new URLSearchParams(
			new URL(result.current.url!).hash.slice(2)
		).get('widgetId');
		const spoofedMessage = new MessageEvent('message', {
			data: { widgetId },
			origin: 'https://attacker.example',
			source: window
		});
		const stopImmediatePropagation = vi.spyOn(
			spoofedMessage,
			'stopImmediatePropagation'
		);

		window.dispatchEvent(spoofedMessage);

		expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
	});

	it('uses the ContentLoaded lifecycle and handles the first-party widget actions', async () => {
		const onClose = vi.fn();
		const onAlwaysOnScreenChange = vi.fn();
		const client = createClient();
		const { result } = renderHook(() =>
			useElementCallWidget(client, {
				roomId: CALL_ROOM,
				isVideo: true,
				onClose,
				onAlwaysOnScreenChange
			})
		);
		await waitFor(() => expect(result.current.url).not.toBeNull());

		const iframe = document.createElement('iframe');
		iframe.src = result.current.url!;
		act(() => result.current.attachIframe(iframe));

		expect(widgetApiMocks.widgetDefinitions[0]).toMatchObject({
			waitForIframeLoad: false
		});
		const api = widgetApiMocks.apiInstances[0];

		act(() => api.emit('ready', new CustomEvent('ready')));
		expect(api.updateTheme).toHaveBeenCalledWith({ name: 'light' });

		const closeRequest = {
			action: 'io.element.close',
			requestId: 'close-1',
			widgetId: 'widget',
			data: {}
		};
		const closeEvent = new CustomEvent('io.element.close', {
			cancelable: true,
			detail: closeRequest
		});
		act(() => api.emit('action:io.element.close', closeEvent));
		expect(closeEvent.defaultPrevented).toBe(true);
		expect(api.transport.reply).toHaveBeenCalledWith(closeRequest, {});
		expect(onClose).toHaveBeenCalledTimes(1);

		const muteRequest = {
			action: 'io.element.device_mute',
			requestId: 'mute-1',
			widgetId: 'widget',
			data: { audio_enabled: false, video_enabled: true }
		};
		act(() =>
			api.emit(
				'action:io.element.device_mute',
				new CustomEvent('io.element.device_mute', {
					cancelable: true,
					detail: muteRequest
				})
			)
		);
		expect(api.transport.reply).toHaveBeenCalledWith(
			muteRequest,
			muteRequest.data
		);

		const stickyRequest = {
			action: 'set_always_on_screen',
			requestId: 'sticky-1',
			widgetId: 'widget',
			data: { value: true }
		};
		act(() =>
			api.emit(
				'action:set_always_on_screen',
				new CustomEvent('set_always_on_screen', {
					cancelable: true,
					detail: stickyRequest
				})
			)
		);
		expect(api.transport.reply).toHaveBeenCalledWith(stickyRequest, {
			success: true
		});
		expect(onAlwaysOnScreenChange).toHaveBeenCalledWith(true);

		for (const action of [
			'io.element.join',
			'io.element.tile_layout',
			'io.element.spotlight_layout'
		]) {
			const request = {
				action,
				requestId: `${action}-1`,
				widgetId: 'widget',
				data: {}
			};
			const event = new CustomEvent(action, {
				cancelable: true,
				detail: request
			});
			act(() => api.emit(`action:${action}`, event));
			expect(event.defaultPrevented).toBe(true);
			expect(api.transport.reply).toHaveBeenCalledWith(request, {});
		}

		await act(() => result.current.hangup());
		expect(api.transport.send).toHaveBeenCalledWith('im.vector.hangup', {});
	});

	it('forwards local echoes, state updates, and allowed to-device events', async () => {
		const client = createClient();
		const { result } = renderHook(() =>
			useElementCallWidget(client, {
				roomId: CALL_ROOM,
				isVideo: true
			})
		);
		await waitFor(() => expect(result.current.url).not.toBeNull());

		const iframe = document.createElement('iframe');
		iframe.src = result.current.url!;
		act(() => result.current.attachIframe(iframe));
		const api = widgetApiMocks.apiInstances[0];
		const rawEvent = {
			type: 'io.element.call.encryption_keys',
			content: { key: 'test-key' }
		};
		const roomEvent = {
			getRoomId: () => CALL_ROOM,
			getEffectiveEvent: () => rawEvent,
			getType: () => 'io.element.call.encryption_keys',
			getWireType: () => 'm.room.encrypted'
		};
		const stateEvent = {
			...roomEvent,
			getEffectiveEvent: () => ({
				type: 'org.matrix.msc3401.call.member',
				state_key: '@user:oriso.example',
				content: {}
			}),
			getType: () => 'org.matrix.msc3401.call.member'
		};
		const forbiddenEvent = {
			...roomEvent,
			getEffectiveEvent: () => ({
				type: 'm.room.message',
				content: { body: 'private counselling message' }
			}),
			getType: () => 'm.room.message'
		};
		let encryptedType = 'm.room.encrypted';
		const decryptionListeners = new Set<
			(event: unknown, error?: Error) => void
		>();
		const decryptedRawEvent = {
			type: 'io.element.call.reaction',
			content: { emoji: '👍' }
		};
		const encryptedEvent = {
			...roomEvent,
			getType: () => encryptedType,
			getEffectiveEvent: () => decryptedRawEvent,
			on: (
				eventName: string,
				listener: (event: unknown, error?: Error) => void
			) => {
				if (eventName === 'Event.decrypted') {
					decryptionListeners.add(listener);
				}
			},
			off: (
				eventName: string,
				listener: (event: unknown, error?: Error) => void
			) => {
				if (eventName === 'Event.decrypted') {
					decryptionListeners.delete(listener);
				}
			}
		};

		act(() => {
			client.emitTest('Room.localEchoUpdated', roomEvent);
			client.emitTest('Room.localEchoUpdated', forbiddenEvent);
			client.emitTest('Room.timeline', encryptedEvent, {}, false);
			client.emitTest('RoomState.events', stateEvent, {
				roomId: CALL_ROOM
			});
			client.emitTest('RoomState.events', forbiddenEvent, {
				roomId: CALL_ROOM
			});
			client.emitTest('toDeviceEvent', roomEvent);
			client.emitTest('toDeviceEvent', forbiddenEvent);
		});

		expect(api.feedEvent).toHaveBeenCalledWith(rawEvent, CALL_ROOM);
		expect(api.feedEvent).toHaveBeenCalledTimes(1);
		expect(decryptionListeners).toHaveLength(1);

		act(() => {
			encryptedType = 'io.element.call.reaction';
			decryptionListeners.forEach((listener) => listener(encryptedEvent));
		});
		expect(api.feedEvent).toHaveBeenCalledWith(
			decryptedRawEvent,
			CALL_ROOM
		);
		expect(api.feedEvent).toHaveBeenCalledTimes(2);
		expect(decryptionListeners).toHaveLength(0);
		expect(api.feedStateUpdate).toHaveBeenCalledWith(
			stateEvent.getEffectiveEvent()
		);
		expect(api.feedStateUpdate).toHaveBeenCalledTimes(1);
		expect(api.feedToDevice).toHaveBeenCalledWith(rawEvent, true);
		expect(api.feedToDevice).toHaveBeenCalledTimes(1);
	});

	it('reports, and does not silently swallow, a call event that never decrypts', async () => {
		vi.useFakeTimers();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const client = createClient();
			const { result } = renderHook(() =>
				useElementCallWidget(client, {
					roomId: CALL_ROOM,
					isVideo: true
				})
			);
			await vi.waitFor(() => expect(result.current.url).not.toBeNull());
			const iframe = document.createElement('iframe');
			iframe.src = result.current.url!;
			act(() => result.current.attachIframe(iframe));
			const api =
				widgetApiMocks.apiInstances[
					widgetApiMocks.apiInstances.length - 1
				];

			const decryptionListeners = new Set<
				(event: unknown, error?: Error) => void
			>();
			const stuckEvent = {
				getRoomId: () => CALL_ROOM,
				getId: () => '$stuck-key-event',
				getType: () => 'm.room.encrypted',
				getWireType: () => 'm.room.encrypted',
				getEffectiveEvent: () => ({ type: 'm.room.encrypted' }),
				on: (name: string, l: (e: unknown, err?: Error) => void) => {
					if (name === 'Event.decrypted') decryptionListeners.add(l);
				},
				off: (name: string, l: (e: unknown, err?: Error) => void) => {
					if (name === 'Event.decrypted')
						decryptionListeners.delete(l);
				}
			};

			act(() => {
				client.emitTest('Room.timeline', stuckEvent, {}, false);
			});
			expect(decryptionListeners.size).toBe(1);

			// A failed decryption must NOT drop the listener: Megolm keys often
			// arrive later and the SDK retries. It must be reported, though.
			act(() => {
				decryptionListeners.forEach((l) =>
					l(stuckEvent, new Error('The sender key is unknown'))
				);
			});
			expect(decryptionListeners.size).toBe(1);
			expect(api.feedEvent).not.toHaveBeenCalled();
			expect(warn).toHaveBeenCalledWith(
				'[call] call event still undecrypted, waiting for the key:',
				'$stuck-key-event',
				'The sender key is unknown'
			);

			// Only after the timeout is the event truly lost — and that loss is
			// what makes a connected call silent, so it must be loud.
			act(() => {
				vi.advanceTimersByTime(5 * 60 * 1000);
			});
			expect(decryptionListeners.size).toBe(0);
			expect(error).toHaveBeenCalledWith(
				'[call] dropping call event that never decrypted:',
				'$stuck-key-event',
				'in',
				CALL_ROOM,
				'— media keys carried by this event are lost'
			);
		} finally {
			warn.mockRestore();
			error.mockRestore();
			vi.useRealTimers();
		}
	});
});
