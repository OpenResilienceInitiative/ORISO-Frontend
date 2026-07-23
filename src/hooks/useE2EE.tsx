import { useCallback } from 'react';

/**
 * Legacy Rocket.Chat room E2EE is removed (Matrix-only app).
 *
 * This hook keeps the historical API shape so chat components compile and
 * behave as "unencrypted room, ready" without any Rocket.Chat key exchange.
 * Matrix room encryption is intentionally NOT enabled here (ADR-004: crypto
 * only after the homeserver rebuild).
 */

export const ENCRYPT_ROOM_STATE_GET_MEMBERS = 'get_members';
export const ENCRYPT_ROOM_STATE_GET_USERS_WITHOUT_KEY = 'get_users_without_key';
export const ENCRYPT_ROOM_STATE_ENCRYPTING_USERS = 'encrypting_users';
export const ENCRYPT_ROOM_STATE_SET_ROOM_KEY = 'set_room_key';
export const ENCRYPT_ROOM_STATE_SEND_ALIAS_MESSAGE = 'send_alias_message';
export const ENCRYPT_ROOM_STATE_DONE = 'done';
export const ENCRYPT_ROOM_STATE_ERROR = 'error';

export type TEncryptRoomState = {
	state:
		| typeof ENCRYPT_ROOM_STATE_GET_MEMBERS
		| typeof ENCRYPT_ROOM_STATE_GET_USERS_WITHOUT_KEY
		| typeof ENCRYPT_ROOM_STATE_ENCRYPTING_USERS
		| typeof ENCRYPT_ROOM_STATE_SET_ROOM_KEY
		| typeof ENCRYPT_ROOM_STATE_SEND_ALIAS_MESSAGE
		| typeof ENCRYPT_ROOM_STATE_DONE
		| typeof ENCRYPT_ROOM_STATE_ERROR;
	count: number;
	total: number;
};

export type e2eeParams = {
	key?: CryptoKey;
	keyID?: string;
	sessionKeyExportedString?: string;
	encrypted?: boolean;
};

export interface UseE2EEParams extends e2eeParams {
	addNewUsersToEncryptedRoom?: (
		onStateChange?: (state: TEncryptRoomState) => void,
		roomId?: string
	) => Promise<void>;
	encryptRoom?: (
		onStateChange?: (state: TEncryptRoomState) => void,
		roomId?: string
	) => Promise<void>;
	ready: boolean;
	subscriptionKeyLost: boolean;
	roomNotFound: boolean;
}

export const useE2EE = (
	_rid: string | null,
	_triggerReEncrypt: boolean = false
): UseE2EEParams => {
	const completeImmediately = useCallback(
		async (onStateChange?: (state: TEncryptRoomState) => void) => {
			onStateChange?.({
				state: ENCRYPT_ROOM_STATE_DONE,
				count: 0,
				total: 0
			});
		},
		[]
	);

	return {
		key: null,
		keyID: null,
		sessionKeyExportedString: null,
		encrypted: false,
		addNewUsersToEncryptedRoom: completeImmediately,
		encryptRoom: completeImmediately,
		ready: true,
		subscriptionKeyLost: false,
		roomNotFound: false
	};
};
