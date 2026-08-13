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
