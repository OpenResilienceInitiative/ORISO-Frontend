import { STATUS_ENQUIRY } from '../../globalState/interfaces/SessionsDataInterface';

interface AskerEnquirySubmissionInput {
	isEnquiryListType: boolean;
	sessionStatus?: number;
	hasAskerAuthority: boolean;
	isAnonymousLiveChat: boolean;
	hasEnquiryMessage?: boolean;
}

export type AskerMessageTransport = 'enquiry' | 'matrix' | 'blocked' | 'other';

interface AskerMessageTransportInput extends AskerEnquirySubmissionInput {
	isMatrixSession: boolean;
	matrixRoomId?: string | null;
}

interface AskerMessageTransportDispatch {
	transport: AskerMessageTransport;
	sendEnquiry: () => Promise<unknown>;
	sendMatrix: () => Promise<unknown>;
	onBlocked: () => void;
}

export interface EnquirySubmissionGuard {
	markFailed: () => void;
	markSucceeded: () => void;
	tryStart: () => boolean;
}

interface EncryptedInitialEnquiryInput {
	sessionId: number;
	sendEncryptedMatrixMessage: (transactionId: string) => Promise<{
		event_id?: string;
		eventId?: string;
	}>;
	finalizeEnquiry: (matrixEventId: string) => Promise<any>;
	onFinalized?: () => void;
	storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}

const pendingEnquiryEventStorageKey = (sessionId: number) =>
	`oriso.pendingEncryptedEnquiryEvent.${sessionId}`;

const initialEnquiryTransactionId = (sessionId: number) =>
	`oriso.enquiry.${sessionId}`;

const readRetryEventId = (
	storage: Pick<Storage, 'getItem'>,
	storageKey: string
): string => {
	try {
		return storage.getItem(storageKey) || '';
	} catch {
		return '';
	}
};

const cacheRetryEventId = (
	storage: Pick<Storage, 'setItem'>,
	storageKey: string,
	matrixEventId: string
): void => {
	try {
		storage.setItem(storageKey, matrixEventId);
	} catch {
		// The stable Matrix transaction ID remains the durable idempotency
		// boundary when browser storage is unavailable.
	}
};

const clearRetryEventId = (
	storage: Pick<Storage, 'removeItem'>,
	storageKey: string
): void => {
	try {
		storage.removeItem(storageKey);
	} catch {
		// Best-effort cache cleanup must not turn a finalized enquiry into a
		// failed submission.
	}
};

export const sendEncryptedInitialEnquiry = async ({
	sessionId,
	sendEncryptedMatrixMessage,
	finalizeEnquiry,
	onFinalized,
	storage = window.localStorage
}: EncryptedInitialEnquiryInput): Promise<any> => {
	const storageKey = pendingEnquiryEventStorageKey(sessionId);
	let matrixEventId = readRetryEventId(storage, storageKey);
	if (!matrixEventId) {
		const response = await sendEncryptedMatrixMessage(
			initialEnquiryTransactionId(sessionId)
		);
		matrixEventId = response.event_id || response.eventId || '';
		if (!matrixEventId) {
			throw new Error(
				'Encrypted Matrix enquiry send returned no event ID'
			);
		}
		cacheRetryEventId(storage, storageKey, matrixEventId);
	}

	const response = await finalizeEnquiry(matrixEventId);
	clearRetryEventId(storage, storageKey);
	onFinalized?.();
	return response;
};

export const isAskerEnquirySubmission = ({
	isEnquiryListType,
	sessionStatus,
	hasAskerAuthority,
	isAnonymousLiveChat,
	hasEnquiryMessage
}: AskerEnquirySubmissionInput): boolean =>
	(isEnquiryListType || sessionStatus === STATUS_ENQUIRY) &&
	hasAskerAuthority &&
	!isAnonymousLiveChat &&
	!hasEnquiryMessage;

export const resolveAskerMessageTransport = (
	input: AskerMessageTransportInput
): AskerMessageTransport => {
	if (isAskerEnquirySubmission(input)) {
		return 'enquiry';
	}
	if (
		!input.hasAskerAuthority ||
		input.isAnonymousLiveChat ||
		!input.hasEnquiryMessage
	) {
		return 'other';
	}

	return input.isMatrixSession && Boolean(input.matrixRoomId)
		? 'matrix'
		: 'blocked';
};

export const dispatchAskerMessageTransport = async ({
	transport,
	sendEnquiry,
	sendMatrix,
	onBlocked
}: AskerMessageTransportDispatch): Promise<boolean> => {
	if (transport === 'enquiry') {
		await sendEnquiry();
		return true;
	}
	if (transport === 'matrix') {
		await sendMatrix();
		return true;
	}
	if (transport === 'blocked') {
		onBlocked();
		return true;
	}
	return false;
};

export const createEnquirySubmissionGuard = (): EnquirySubmissionGuard => {
	let state: 'idle' | 'inFlight' | 'submitted' = 'idle';
	return {
		tryStart: () => {
			if (state !== 'idle') {
				return false;
			}
			state = 'inFlight';
			return true;
		},
		markSucceeded: () => {
			state = 'submitted';
		},
		markFailed: () => {
			if (state === 'inFlight') {
				state = 'idle';
			}
		}
	};
};

export type EnquiryMatrixRoomResolution =
	| { status: 'ready'; roomId: string }
	| { status: 'room-missing' }
	| { status: 'room-not-encrypted'; roomId: string };

interface EnquiryMatrixRoomResolutionInput {
	/** The room id the session list already knows, if any. */
	knownRoomId?: string | null;
	/**
	 * Re-reads the session from UserService. Registration provisions the
	 * agency holding room synchronously, but the session list may have been
	 * fetched before that write landed — and on a fresh deployment the room
	 * can be missing altogether (ORISO-Frontend#1401).
	 */
	fetchSessionRoomId: () => Promise<string | null | undefined>;
	/** Whether the Matrix client already holds the room with its encryption state. */
	isRoomEncrypted: (roomId: string) => boolean;
	/** Upper bound for waiting on /sync to deliver the room. */
	waitMs?: number;
	pollIntervalMs?: number;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
}

const defaultSleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * ORISO-Frontend#1401: an initial enquiry can only be sent into an encrypted
 * Matrix room, and the room is created by UserService at registration. When
 * the session shows no room, the old code failed instantly with the generic
 * "error while sending" box and every retry hit the same wall. This resolves
 * the room in three steps — trust the known id, otherwise re-read the
 * session, then give /sync a bounded window to deliver the encrypted room —
 * and names the reason when it still cannot send, so the UI can say what is
 * wrong instead of asking for a pointless retry.
 */
export const resolveEnquiryMatrixRoom = async ({
	knownRoomId,
	fetchSessionRoomId,
	isRoomEncrypted,
	waitMs = 8000,
	pollIntervalMs = 250,
	sleep = defaultSleep,
	now = () => Date.now()
}: EnquiryMatrixRoomResolutionInput): Promise<EnquiryMatrixRoomResolution> => {
	let roomId = knownRoomId || null;
	if (!roomId) {
		try {
			roomId = (await fetchSessionRoomId()) || null;
		} catch {
			roomId = null;
		}
	}
	if (!roomId) {
		return { status: 'room-missing' };
	}

	const startedAt = now();
	while (true) {
		if (isRoomEncrypted(roomId)) {
			return { status: 'ready', roomId };
		}
		if (now() - startedAt >= waitMs) {
			return { status: 'room-not-encrypted', roomId };
		}
		await sleep(pollIntervalMs);
	}
};
