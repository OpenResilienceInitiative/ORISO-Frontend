import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * Dedicated, encrypted, members-only room for a subset of colleagues
 * (ORISO-UserService#1426, `POST /users/chat/internal-subset`). The room holds
 * the caller plus exactly the listed colleagues, or an existing room with
 * exactly that member set is returned. There is deliberately no fallback to
 * the room every colleague can see: a refusal stays a refusal.
 */

/** Refusal codes of the endpoint (header `X-Reason` and body `{"reason"}`). */
export const INTERNAL_SUBSET_REASON = {
	RECIPIENTS_REQUIRED: 'INTERNAL_CHAT_RECIPIENTS_REQUIRED',
	RECIPIENT_UNKNOWN: 'INTERNAL_CHAT_RECIPIENT_UNKNOWN',
	RECIPIENT_OUT_OF_SCOPE: 'INTERNAL_CHAT_RECIPIENT_OUT_OF_SCOPE',
	MEMBERSHIP_FAILED: 'INTERNAL_CHAT_MEMBERSHIP_FAILED',
	ENCRYPTION_REQUIRED: 'INTERNAL_CHAT_ENCRYPTION_REQUIRED',
	/** 503: a request for the same people is still running. */
	BUSY: 'INTERNAL_CHAT_BUSY',
	/**
	 * 404 / 405 / 501 without a reason: the UserService does not know the
	 * endpoint yet (Frontend deployed ahead of ORISO-UserService#1426).
	 */
	NOT_AVAILABLE: 'INTERNAL_CHAT_NOT_AVAILABLE',
	/** A 403 without a reason: internal group chats are switched off. */
	DISABLED: 'INTERNAL_CHAT_DISABLED',
	UNKNOWN: 'INTERNAL_CHAT_UNKNOWN'
} as const;

export type InternalSubsetReason =
	(typeof INTERNAL_SUBSET_REASON)[keyof typeof INTERNAL_SUBSET_REASON];

/** Wait before the single automatic retry of a busy refusal. */
export const INTERNAL_SUBSET_BUSY_RETRY_MS = 1500;

/** Server limit: 1..50 colleagues besides the caller. */
export const INTERNAL_SUBSET_MAX_RECIPIENTS = 50;

export interface InternalSubsetChatRequest {
	consultantIds: string[];
	agencyId?: number;
	/** 3..50 characters; the server names the room after its members when absent. */
	topic?: string;
}

export interface InternalSubsetChatResult {
	matrixRoomId: string;
	chatId: number;
	/** True when a room with exactly this member set already existed (HTTP 200). */
	reused: boolean;
}

export class InternalSubsetChatError extends Error {
	constructor(
		readonly reason: InternalSubsetReason,
		readonly status?: number
	) {
		super(reason);
		Object.setPrototypeOf(this, InternalSubsetChatError.prototype);
	}
}

const KNOWN_REASONS: readonly string[] = [
	INTERNAL_SUBSET_REASON.RECIPIENTS_REQUIRED,
	INTERNAL_SUBSET_REASON.RECIPIENT_UNKNOWN,
	INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE,
	INTERNAL_SUBSET_REASON.MEMBERSHIP_FAILED,
	INTERNAL_SUBSET_REASON.ENCRYPTION_REQUIRED,
	INTERNAL_SUBSET_REASON.BUSY
];

/** Statuses a UserService without the endpoint answers with. */
const NOT_AVAILABLE_STATUSES = [404, 405, 501];

const isKnownReason = (value: unknown): value is InternalSubsetReason =>
	typeof value === 'string' && KNOWN_REASONS.includes(value);

const readReason = async (response: Response): Promise<unknown> => {
	const fromHeader = response.headers?.get(FETCH_ERRORS.X_REASON);
	if (fromHeader) {
		return fromHeader;
	}
	try {
		return (await response.json())?.reason;
	} catch {
		return undefined;
	}
};

const toError = async (
	rejection: unknown
): Promise<InternalSubsetChatError> => {
	if (!(rejection instanceof Response)) {
		return new InternalSubsetChatError(INTERNAL_SUBSET_REASON.UNKNOWN);
	}
	const reason = await readReason(rejection);
	if (isKnownReason(reason)) {
		return new InternalSubsetChatError(reason, rejection.status);
	}
	if (!reason && NOT_AVAILABLE_STATUSES.includes(rejection.status)) {
		return new InternalSubsetChatError(
			INTERNAL_SUBSET_REASON.NOT_AVAILABLE,
			rejection.status
		);
	}
	return new InternalSubsetChatError(
		rejection.status === 403 && !reason
			? INTERNAL_SUBSET_REASON.DISABLED
			: INTERNAL_SUBSET_REASON.UNKNOWN,
		rejection.status
	);
};

const post = async (request: InternalSubsetChatRequest): Promise<Response> => {
	try {
		return await fetchData({
			url: endpoints.internalSubsetChat,
			method: FETCH_METHODS.POST,
			bodyData: JSON.stringify(request),
			responseHandling: [FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE]
		});
	} catch (rejection) {
		throw await toError(rejection);
	}
};

const wait = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A busy refusal means a request for the same people is still running, so the
 * same request is repeated once after a short wait (it then finds the room
 * instead of building a second one). A second refusal is shown as it is.
 */
export const apiCreateInternalSubsetChat = async (
	request: InternalSubsetChatRequest
): Promise<InternalSubsetChatResult> => {
	let response: Response;
	try {
		response = await post(request);
	} catch (error) {
		if (
			!(error instanceof InternalSubsetChatError) ||
			error.reason !== INTERNAL_SUBSET_REASON.BUSY
		) {
			throw error;
		}
		await wait(INTERNAL_SUBSET_BUSY_RETRY_MS);
		response = await post(request);
	}
	const { matrixRoomId, chatId } = await response.json();
	return { matrixRoomId, chatId, reused: response.status === 200 };
};
