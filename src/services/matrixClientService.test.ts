import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatrixClientService } from './matrixClientService';

vi.hoisted(() => {
	process.env.REACT_APP_KEYCLOAK_REALM = 'oriso';
	Object.defineProperty(globalThis, 'window', {
		value: {
			Cypress: undefined,
			clearTimeout: globalThis.clearTimeout,
			location: {
				hostname: 'app.oriso-dev.site'
			},
			setTimeout: globalThis.setTimeout
		},
		configurable: true
	});
	Object.defineProperty(globalThis, 'localStorage', {
		value: {
			getItem: () => null
		},
		configurable: true
	});
});

const setClient = (
	service: MatrixClientService,
	client: Record<string, unknown>
) => {
	(service as unknown as { client: Record<string, unknown> }).client = client;
};

describe('MatrixClientService', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', {
			getItem: vi.fn(() => null)
		});
	});

	it('sends Matrix messages in migration rooms without native Matrix encryption state', async () => {
		const sendMessage = vi.fn(() =>
			Promise.resolve({ event_id: '$event' })
		);
		const service = new MatrixClientService();
		setClient(service, {
			sendMessage,
			isRoomEncrypted: () => false,
			getRoom: () => ({
				hasEncryptionStateEvent: () => false,
				currentState: {
					getStateEvents: () => null
				}
			})
		});

		await expect(
			service.sendMessage('!room:example.org', 'Hello Matrix')
		).resolves.toEqual({ event_id: '$event' });
		expect(sendMessage).toHaveBeenCalledWith('!room:example.org', {
			msgtype: 'm.text',
			body: 'Hello Matrix'
		});
	});

	it('sends typing state in migration rooms without native Matrix encryption state', async () => {
		const sendTyping = vi.fn(() => Promise.resolve());
		const service = new MatrixClientService();
		setClient(service, {
			sendTyping,
			isRoomEncrypted: () => false,
			getRoom: () => ({
				hasEncryptionStateEvent: () => false,
				currentState: {
					getStateEvents: () => null
				}
			})
		});

		await expect(
			service.sendTyping('!room:example.org', true)
		).resolves.toBeUndefined();
		expect(sendTyping).toHaveBeenCalledWith(
			'!room:example.org',
			true,
			30000
		);
	});
});
