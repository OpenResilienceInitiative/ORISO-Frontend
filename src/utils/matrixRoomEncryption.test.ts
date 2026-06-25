import { describe, expect, it } from 'vitest';
import {
	assertMatrixRoomEncrypted,
	isMatrixRoomEncrypted
} from './matrixRoomEncryption';

describe('matrixRoomEncryption', () => {
	it('detects room encryption from the Matrix room current state event', () => {
		const client = {
			isRoomEncrypted: () => false,
			getRoom: () => ({
				hasEncryptionStateEvent: () => false,
				currentState: {
					getStateEvents: (eventType: string, stateKey: string) =>
						eventType === 'm.room.encryption' && stateKey === ''
							? { type: 'm.room.encryption' }
							: null
				}
			})
		};

		expect(isMatrixRoomEncrypted(client as any, '!room:example.org')).toBe(
			true
		);
		expect(() =>
			assertMatrixRoomEncrypted(client as any, '!room:example.org')
		).not.toThrow();
	});

	it('rejects rooms without any encryption signal', () => {
		const client = {
			isRoomEncrypted: () => false,
			getRoom: () => ({
				hasEncryptionStateEvent: () => false,
				currentState: {
					getStateEvents: () => null
				}
			})
		};

		expect(isMatrixRoomEncrypted(client as any, '!room:example.org')).toBe(
			false
		);
		expect(() =>
			assertMatrixRoomEncrypted(client as any, '!room:example.org')
		).toThrow(/encrypted Matrix room/);
	});
});
