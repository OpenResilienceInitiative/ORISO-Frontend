import {
	ClientEvent,
	EventTimeline,
	MatrixClient,
	MatrixEvent
} from 'matrix-js-sdk';
import type { IMegolmSessionData } from 'matrix-js-sdk/lib/@types/crypto';
import { isInvisibleCryptoEnabledForClient } from './matrixDeviceIsolation';

export { isUndecryptedRoomEvent } from '../utils/matrixDecryptionFailure';

const KEY_REQUEST_EVENT = 'org.oriso.room_history_key_request';
const KEY_BUNDLE_EVENT = 'org.oriso.room_history_key_bundle';
const REQUEST_THROTTLE_MS = 30_000;
const MAX_KEY_BUNDLE_COUNT = 5_000;
const MAX_PENDING_APPROVALS = 20;
const MAX_PENDING_PER_ROOM = 5;
const PENDING_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_REASON_LENGTH = 500;

export const MATRIX_HISTORY_KEYS_IMPORTED_EVENT =
	'oriso:matrix-history-keys-imported';
export const MATRIX_HISTORY_KEYS_REQUESTED_EVENT =
	'oriso:matrix-history-keys-requested';
export const MATRIX_HISTORY_KEYS_SENT_EVENT = 'oriso:matrix-history-keys-sent';
export const MATRIX_HISTORY_KEYS_DIAGNOSTIC_EVENT =
	'oriso:matrix-history-keys-diagnostic';
/** A request from an unverified device now waits for a person to approve it. */
export const MATRIX_HISTORY_REQUEST_PENDING_EVENT =
	'oriso:matrix-history-request-pending';
/** A waiting request was approved, declined or dropped. */
export const MATRIX_HISTORY_REQUEST_RESOLVED_EVENT =
	'oriso:matrix-history-request-resolved';

export type PendingHistoryRequest = {
	requestId: string;
	roomId: string;
	requesterUserId: string;
	requesterDeviceId: string;
	/** What the person wrote about the conversation, at most 500 characters. */
	reason: string;
	receivedAt: number;
};

const normalizeReason = (value: unknown): string =>
	typeof value === 'string' ? value.trim().slice(0, MAX_REASON_LENGTH) : '';

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
	reason?: string;
};

type KeyBundle = {
	room_id: string;
	request_id: string;
	keys: IMegolmSessionData[];
};

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === 'string' && value.length > 0;

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
	private readonly lastHandledRequestAt = new Map<string, number>();
	private readonly pendingRooms = new Set<string>();
	private readonly approvalsInFlight = new Set<string>();
	private readonly pendingApprovals = new Map<
		string,
		PendingHistoryRequest
	>();

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
		// Tell open cards that these requests are gone, so none stays on screen.
		const dropped = Array.from(this.pendingApprovals.values());
		this.pendingApprovals.clear();
		this.approvalsInFlight.clear();
		dropped.forEach((request) => this.announceResolved(request, 'dropped'));
	}

	/** Requests from unverified devices that wait for a person's decision. */
	public getPendingApprovals(roomId?: string): PendingHistoryRequest[] {
		this.expirePendingApprovals();
		return Array.from(this.pendingApprovals.values()).filter(
			(request) => !roomId || request.roomId === roomId
		);
	}

	/**
	 * A person has read the reason and agrees: send that one room's keys to
	 * that one device. The device stays unverified; the approval is the check.
	 */
	public async approveRequest(requestId: string): Promise<boolean> {
		const request = this.pendingApprovals.get(requestId);
		const client = this.client;
		if (!request || !client || this.approvalsInFlight.has(requestId))
			return false;
		this.approvalsInFlight.add(requestId);
		try {
			const room = client.getRoom(request.roomId);
			await (room as any)?.loadMembersIfNeeded?.();
			if (
				room?.getMember(request.requesterUserId)?.membership !== 'join'
			) {
				emitDiagnostic('approval-membership-rejected');
				this.pendingApprovals.delete(requestId);
				this.announceResolved(request, 'dropped');
				return false;
			}
			const sent = await this.sendBundle(
				request.roomId,
				request.requesterUserId,
				request.requesterDeviceId,
				request.requestId
			);
			// A failed send keeps the request, so the person can try again.
			if (sent && this.pendingApprovals.delete(requestId))
				this.announceResolved(request, 'approved');
			return sent;
		} catch (error) {
			emitDiagnostic('approval-failed');
			return false;
		} finally {
			this.approvalsInFlight.delete(requestId);
		}
	}

	public declineRequest(requestId: string): void {
		const request = this.pendingApprovals.get(requestId);
		if (!request) return;
		this.pendingApprovals.delete(requestId);
		this.announceResolved(request, 'declined');
	}

	/** Requests nobody decided on for a day are dropped, so the queue cannot stay full. */
	private expirePendingApprovals(): void {
		const limit = Date.now() - PENDING_APPROVAL_TTL_MS;
		for (const [id, request] of this.pendingApprovals) {
			if (request.receivedAt < limit && !this.approvalsInFlight.has(id)) {
				this.pendingApprovals.delete(id);
				this.announceResolved(request, 'dropped');
			}
		}
	}

	private announceResolved(
		request: PendingHistoryRequest,
		outcome: 'approved' | 'declined' | 'dropped'
	): void {
		window.dispatchEvent(
			new CustomEvent(MATRIX_HISTORY_REQUEST_RESOLVED_EVENT, {
				detail: {
					roomId: request.roomId,
					requestId: request.requestId,
					outcome
				}
			})
		);
	}

	public async requestKeys(
		roomId: string,
		options: { reason?: string } = {}
	): Promise<boolean> {
		const client = this.client;
		const crypto = client?.getCrypto();
		const userId = client?.getUserId();
		const deviceId = client?.getDeviceId();
		const room = client?.getRoom(roomId);
		if (!client || !crypto || !userId || !deviceId || !room) {
			emitDiagnostic('request-prerequisite-missing');
			this.pendingRooms.add(roomId);
			return false;
		}
		if (room.getMember(userId)?.membership !== 'join') {
			emitDiagnostic('request-membership-rejected');
			this.pendingRooms.add(roomId);
			return false;
		}

		const now = Date.now();
		if (now - (this.lastRequestAt.get(roomId) || 0) < REQUEST_THROTTLE_MS) {
			emitDiagnostic('request-throttled');
			return false;
		}

		const otherUsers = room
			.getJoinedMembers()
			.map((member) => member.userId)
			.filter((memberUserId) => memberUserId !== userId);
		if (otherUsers.length === 0) {
			emitDiagnostic('request-no-peer');
			return false;
		}

		const deviceMap = await crypto.getUserDeviceInfo(otherUsers, true);
		const targets = otherUsers.flatMap((memberUserId) =>
			Array.from(deviceMap.get(memberUserId)?.values() || []).map(
				(device) => ({
					userId: memberUserId,
					deviceId: device.deviceId
				})
			)
		);
		if (targets.length === 0) {
			emitDiagnostic('request-no-target-device');
			return false;
		}

		const requestId =
			typeof globalThis.crypto?.randomUUID === 'function'
				? globalThis.crypto.randomUUID()
				: `${deviceId}-${now}`;
		this.lastRequestAt.set(roomId, now);
		const reason = normalizeReason(options.reason);
		const requestContent = {
			room_id: roomId,
			request_id: requestId,
			requester_user_id: userId,
			requester_device_id: deviceId,
			...(reason ? { reason } : {})
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
		if (deliveredTargetCount === 0) {
			emitDiagnostic('request-delivery-failed');
			return false;
		}
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
		const event = {
			getType: () => message.type,
			getSender: () => message.sender,
			getContent: () => message.content
		} as MatrixEvent;
		if (event.getType() === KEY_REQUEST_EVENT) {
			emitDiagnostic('received', { eventType: KEY_REQUEST_EVENT });
			void this.handleKeyRequest(event).catch(() =>
				emitDiagnostic('request-handler-failed')
			);
		} else if (event.getType() === KEY_BUNDLE_EVENT) {
			emitDiagnostic('received', { eventType: KEY_BUNDLE_EVENT });
			void this.handleKeyBundle(event).catch(() =>
				emitDiagnostic('bundle-handler-failed')
			);
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
		if (isInvisibleCryptoEnabledForClient(client)) {
			const verification = await crypto.getDeviceVerificationStatus(
				content.requester_user_id,
				content.requester_device_id
			);
			if (!verification?.isVerified()) {
				// A device that logged in without keys (for example after a
				// password reset) may still get them, but only when the person
				// wrote why and a human on this side approves. Without a reason
				// nothing is kept and nothing is sent, as before.
				const reason = normalizeReason(content.reason);
				if (reason) {
					const pending: PendingHistoryRequest = {
						requestId: content.request_id,
						roomId: content.room_id,
						requesterUserId: content.requester_user_id,
						requesterDeviceId: content.requester_device_id,
						reason,
						receivedAt: Date.now()
					};
					const sameId = this.pendingApprovals.get(pending.requestId);
					if (
						sameId &&
						(sameId.requesterUserId !== pending.requesterUserId ||
							sameId.requesterDeviceId !==
								pending.requesterDeviceId)
					) {
						// Another device must not overwrite this request.
						emitDiagnostic('request-id-collision');
						return;
					}
					// One waiting request per requesting device: a newer one replaces
					// the older, so a single device cannot fill the list.
					for (const [id, other] of this.pendingApprovals) {
						if (
							other.roomId === pending.roomId &&
							other.requesterUserId === pending.requesterUserId &&
							other.requesterDeviceId ===
								pending.requesterDeviceId
						)
							this.pendingApprovals.delete(id);
					}
					this.expirePendingApprovals();
					const inRoom = Array.from(
						this.pendingApprovals.values()
					).filter((other) => other.roomId === pending.roomId).length;
					if (
						this.pendingApprovals.size >= MAX_PENDING_APPROVALS ||
						inRoom >= MAX_PENDING_PER_ROOM
					) {
						emitDiagnostic('approval-queue-full');
						return;
					}
					this.pendingApprovals.set(pending.requestId, pending);
					window.dispatchEvent(
						new CustomEvent(MATRIX_HISTORY_REQUEST_PENDING_EVENT, {
							detail: {
								roomId: pending.roomId,
								requestId: pending.requestId
							}
						})
					);
				} else {
					emitDiagnostic('requester-device-unverified');
				}
				return;
			}
		}

		const handledRequestKey = `${content.room_id}:${content.requester_user_id}:${content.requester_device_id}`;
		const now = Date.now();
		if (
			now - (this.lastHandledRequestAt.get(handledRequestKey) || 0) <
			REQUEST_THROTTLE_MS
		) {
			emitDiagnostic('request-handler-throttled');
			return;
		}
		this.lastHandledRequestAt.set(handledRequestKey, now);

		await this.sendBundle(
			content.room_id,
			content.requester_user_id,
			content.requester_device_id,
			content.request_id
		);
	}

	/** Exports the keys of exactly one room and sends them to exactly one device. */
	private async sendBundle(
		roomId: string,
		userId: string,
		deviceId: string,
		requestId: string
	): Promise<boolean> {
		const client = this.client;
		const crypto = client?.getCrypto();
		if (!client || !crypto) return false;
		const keys = (await crypto.exportRoomKeys()).filter(
			(key) => key.room_id === roomId
		);
		if (keys.length === 0 || keys.length > MAX_KEY_BUNDLE_COUNT) {
			emitDiagnostic('request-key-count-rejected', {
				keyCount: keys.length
			});
			return false;
		}

		await client.encryptAndSendToDevice(
			KEY_BUNDLE_EVENT,
			[{ userId, deviceId }],
			{ room_id: roomId, request_id: requestId, keys }
		);
		window.dispatchEvent(
			new CustomEvent(MATRIX_HISTORY_KEYS_SENT_EVENT, {
				detail: { roomId, keyCount: keys.length }
			})
		);
		return true;
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
			emitDiagnostic('bundle-invalid');
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
			emitDiagnostic('bundle-membership-rejected');
			return;
		}

		const roomKeys = content.keys.filter(
			(key) => key && key.room_id === content.room_id
		);
		if (roomKeys.length === 0) {
			emitDiagnostic('bundle-room-mismatch');
			return;
		}
		await crypto.importRoomKeys(roomKeys);
		// FE#811: importRoomKeys only fills the key store — it never re-decrypts
		// events that already failed. (The SDK's automatic retry hooks onto keys
		// arriving via sync `m.room_key`, not onto manual imports; and
		// `decryptEventIfNeeded` is a no-op for failed events because their
		// clearEvent is set to the m.bad.encrypted placeholder.) Without this
		// retry the counsellor keeps staring at "Unable to decrypt" although the
		// key is already on their device — so retry first, then announce.
		await this.retryFailedDecryptions(content.room_id);
		window.dispatchEvent(
			new CustomEvent(MATRIX_HISTORY_KEYS_IMPORTED_EVENT, {
				detail: { roomId: content.room_id, imported: roomKeys.length }
			})
		);
	}

	private async retryFailedDecryptions(roomId: string): Promise<void> {
		const client = this.client;
		const crypto = client?.getCrypto();
		const room = client?.getRoom(roomId);
		if (!client || !crypto || !room) {
			return;
		}
		// Walk every already-loaded timeline backwards from the live one:
		// backfilled scrollback lives in neighbouring timelines, and its failed
		// events must retry too, or a key import would fill the store while old
		// history stays "Unable to decrypt".
		const loadedEvents: MatrixEvent[] = [];
		let timeline = room.getLiveTimeline?.() || null;
		while (timeline) {
			loadedEvents.unshift(...(timeline.getEvents?.() || []));
			timeline =
				timeline.getNeighbouringTimeline?.(EventTimeline.BACKWARDS) ||
				null;
		}
		const failedEvents = loadedEvents.filter(
			(timelineEvent) =>
				timelineEvent.isEncrypted?.() &&
				timelineEvent.isDecryptionFailure?.() &&
				typeof timelineEvent.attemptDecryption === 'function'
		);
		if (failedEvents.length === 0) {
			return;
		}
		// attemptDecryption() is the only retry path for a FAILED event: its
		// clearEvent already holds the m.bad.encrypted placeholder, so
		// shouldAttemptDecryption() returns false and the public
		// decryptEventIfNeeded() is a guaranteed no-op. The SDK's automatic
		// retry (onRoomKeysUpdated) only fires for keys arriving via sync,
		// never for manual importRoomKeys(). attemptDecryption explicitly
		// supports this case (`alreadyDecrypted = clearEvent &&
		// !isDecryptionFailure()`), and the runtime guard above keeps an SDK
		// upgrade that removes it from throwing.
		// CryptoApi and CryptoBackend are the same rust-crypto object at
		// runtime; the SDK only exposes the narrower type via getCrypto().
		const cryptoBackend = crypto as unknown as Parameters<
			MatrixEvent['attemptDecryption']
		>[0];
		const results = await Promise.allSettled(
			failedEvents.map((timelineEvent) =>
				timelineEvent.attemptDecryption(cryptoBackend, {
					isRetry: true
				})
			)
		);
		emitDiagnostic('retry-decryption', {
			roomId,
			attempted: failedEvents.length,
			rejected: results.filter((r) => r.status === 'rejected').length
		});
	}
}

export const matrixRoomHistoryKeyTransfer = new MatrixRoomHistoryKeyTransfer();
