import { ClientEvent, MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import type { IMegolmSessionData } from 'matrix-js-sdk/lib/@types/crypto';

const KEY_REQUEST_EVENT = 'org.oriso.room_history_key_request';
const KEY_BUNDLE_EVENT = 'org.oriso.room_history_key_bundle';
const REQUEST_THROTTLE_MS = 30_000;
const MAX_KEY_BUNDLE_COUNT = 5_000;

export const MATRIX_HISTORY_KEYS_IMPORTED_EVENT =
	'oriso:matrix-history-keys-imported';
export const MATRIX_HISTORY_KEYS_REQUESTED_EVENT =
	'oriso:matrix-history-keys-requested';
export const MATRIX_HISTORY_KEYS_SENT_EVENT = 'oriso:matrix-history-keys-sent';
export const MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT =
	'oriso:matrix-history-keys-diagnostic';

const emitDiagnostic = (stage: string, detail: Record<string, unknown> = {}) =>
	window.dispatchEvent(
		new CustomEvent(MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT, {
			detail: { stage, ...detail }
		})
	);

type KeyRequest = {
	room_id: string;
	request_id: string;
	requester_user_id: string;
	requester_device_id: string;
};

type KeyBundle = {
	room_id: string;
	request_id: string;
	keys: IMegolmSessionData[];
};

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === 'string' && value.length > 0;

export const isUndecryptedRoomEvent = (event: any): boolean => {
	const clearContent = event?.getClearContent?.();
	const sdkFailureBody = (clearContent || event?.getContent?.())?.body;
	return (
		event?.isDecryptionFailure?.() === true ||
		event?.getContent?.()?.msgtype === 'm.bad.encrypted' ||
		(event?.getType?.() === 'm.room.encrypted' && !clearContent?.msgtype) ||
		(typeof sdkFailureBody === 'string' &&
			sdkFailureBody.includes('Unable to decrypt: DecryptionError'))
	);
};

/**
 * Transfers only the Megolm sessions for one room, device-to-device over Olm.
 *
 * A late-joining counsellor cannot decrypt messages sent before they joined:
 * that is an intentional Megolm property. For an authorised case handover the
 * new device asks the other joined room members for the already-held sessions.
 * The keys never pass through ORISO services or plaintext Matrix events.
 */
export class MatrixRoomHistoryKeyTransfer {
	private client: MatrixClient | null = null;
	private readonly lastRequestAt = new Map<string, number>();
	private readonly pendingRooms = new Set<string>();

	public initialize(client: MatrixClient): void {
		if (this.client === client) return;
		this.detach();
		this.client = client;
		client.on(
			ClientEvent.ReceivedToDeviceMessage,
			this.onReceivedToDeviceMessage
		);
		for (const roomId of this.pendingRooms) {
			void this.requestKeys(roomId).catch(() => undefined);
		}
	}

	public detach(): void {
		this.client?.off(
			ClientEvent.ReceivedToDeviceMessage,
			this.onReceivedToDeviceMessage
		);
		this.client = null;
	}

	public async requestKeys(roomId: string): Promise<boolean> {
		const client = this.client;
		const crypto = client?.getCrypto();
		const userId = client?.getUserId();
		const deviceId = client?.getDeviceId();
		const room = client?.getRoom(roomId);
		if (!client || !crypto || !userId || !deviceId || !room) {
			this.pendingRooms.add(roomId);
			return false;
		}
		if (room.getMember(userId)?.membership !== 'join') {
			this.pendingRooms.add(roomId);
			return false;
		}

		const now = Date.now();
		if (now - (this.lastRequestAt.get(roomId) || 0) < REQUEST_THROTTLE_MS) {
			return false;
		}

		const otherUsers = room
			.getJoinedMembers()
			.map((member) => member.userId)
			.filter((memberUserId) => memberUserId !== userId);
		if (otherUsers.length === 0) return false;

		const deviceMap = await crypto.getUserDeviceInfo(otherUsers, true);
		const targets = otherUsers.flatMap((memberUserId) =>
			Array.from(deviceMap.get(memberUserId)?.values() || []).map(
				(device) => ({
					userId: memberUserId,
					deviceId: device.deviceId
				})
			)
		);
		if (targets.length === 0) return false;

		const requestId =
			typeof globalThis.crypto?.randomUUID === 'function'
				? globalThis.crypto.randomUUID()
				: `${deviceId}-${now}`;
		this.lastRequestAt.set(roomId, now);
		const requestContent = {
			room_id: roomId,
			request_id: requestId,
			requester_user_id: userId,
			requester_device_id: deviceId
		};
		const deliveryResults = await Promise.allSettled(
			targets.map((target) =>
				client.encryptAndSendToDevice(
					KEY_REQUEST_EVENT,
					[target],
					requestContent
				)
			)
		);
		const deliveredTargetCount = deliveryResults.filter(
			(result) => result.status === 'fulfilled'
		).length;
		if (deliveredTargetCount === 0) return false;
		window.dispatchEvent(
			new CustomEvent(MATRIX_HISTORY_KEYS_REQUESTED_EVENT, {
				detail: {
					roomId,
					targetCount: deliveredTargetCount,
					attemptedTargetCount: targets.length
				}
			})
		);
		this.pendingRooms.delete(roomId);
		return true;
	}

	private onReceivedToDeviceMessage = (payload: any): void => {
		const message = payload?.message;
		if (!message) return;
		emitDiagnostic('received', { eventType: message.type });
		const event = {
			getType: () => message.type,
			getSender: () => message.sender,
			getContent: () => message.content
		} as MatrixEvent;
		if (event.getType() === KEY_REQUEST_EVENT) {
			void this.handleKeyRequest(event).catch(() => undefined);
		} else if (event.getType() === KEY_BUNDLE_EVENT) {
			void this.handleKeyBundle(event).catch(() => undefined);
		}
	};

	private async handleKeyRequest(event: MatrixEvent): Promise<void> {
		const client = this.client;
		const crypto = client?.getCrypto();
		const sender = event.getSender();
		const content = event.getContent() as Partial<KeyRequest>;
		if (
			!client ||
			!crypto ||
			!sender ||
			!isNonEmptyString(content.room_id) ||
			!isNonEmptyString(content.request_id) ||
			!isNonEmptyString(content.requester_user_id) ||
			!isNonEmptyString(content.requester_device_id) ||
			sender !== content.requester_user_id
		) {
			emitDiagnostic('request-invalid');
			return;
		}

		const room = client.getRoom(content.room_id);
		await (room as any)?.loadMembersIfNeeded?.();
		if (
			!room ||
			room.getMember(sender)?.membership !== 'join' ||
			!['join', 'leave'].includes(
				room.getMember(client.getUserId() || '')?.membership || ''
			)
		) {
			emitDiagnostic('request-membership-rejected', {
				roomFound: Boolean(room)
			});
			return;
		}

		const keys = (await crypto.exportRoomKeys()).filter(
			(key) => key.room_id === content.room_id
		);
		if (keys.length === 0 || keys.length > MAX_KEY_BUNDLE_COUNT) {
			emitDiagnostic('request-key-count-rejected', {
				keyCount: keys.length
			});
			return;
		}

		// The requester may have logged in only seconds ago. Refresh its device
		// list before Olm encryption; otherwise Rust Crypto can silently build an
		// empty to-device batch for the not-yet-cached device.
		const requesterDevices = await crypto.getUserDeviceInfo(
			[content.requester_user_id],
			true
		);
		if (
			!requesterDevices
				.get(content.requester_user_id)
				?.has(content.requester_device_id)
		) {
			emitDiagnostic('requester-device-missing');
			return;
		}

		await client.encryptAndSendToDevice(
			KEY_BUNDLE_EVENT,
			[
				{
					userId: content.requester_user_id,
					deviceId: content.requester_device_id
				}
			],
			{
				room_id: content.room_id,
				request_id: content.request_id,
				keys
			}
		);
		window.dispatchEvent(
			new CustomEvent(MATRIX_HISTORY_KEYS_SENT_EVENT, {
				detail: { roomId: content.room_id, keyCount: keys.length }
			})
		);
	}

	private async handleKeyBundle(event: MatrixEvent): Promise<void> {
		const client = this.client;
		const crypto = client?.getCrypto();
		const sender = event.getSender();
		const content = event.getContent() as Partial<KeyBundle>;
		if (
			!client ||
			!crypto ||
			!sender ||
			!isNonEmptyString(content.room_id) ||
			!isNonEmptyString(content.request_id) ||
			!Array.isArray(content.keys) ||
			content.keys.length === 0 ||
			content.keys.length > MAX_KEY_BUNDLE_COUNT
		) {
			return;
		}

		const room = client.getRoom(content.room_id);
		await (room as any)?.loadMembersIfNeeded?.();
		if (
			!room ||
			room.getMember(client.getUserId() || '')?.membership !== 'join' ||
			!['join', 'leave'].includes(
				room.getMember(sender)?.membership || ''
			)
		) {
			return;
		}

		const roomKeys = content.keys.filter(
			(key) => key && key.room_id === content.room_id
		);
		if (roomKeys.length === 0) return;
		await crypto.importRoomKeys(roomKeys);
		window.dispatchEvent(
			new CustomEvent(MATRIX_HISTORY_KEYS_IMPORTED_EVENT, {
				detail: { roomId: content.room_id, imported: roomKeys.length }
			})
		);
	}
}

export const matrixRoomHistoryKeyTransfer = new MatrixRoomHistoryKeyTransfer();
