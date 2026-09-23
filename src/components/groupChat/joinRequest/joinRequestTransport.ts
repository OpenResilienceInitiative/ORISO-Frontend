import {
	GroupChatJoinAdmitRole,
	GroupChatJoinRequest,
	GroupChatJoinRequestOwnStatus
} from './joinRequestModel';

/**
 * How knocks travel (#1499). One interface for both sides, so the UI never
 * knows whether a change arrived by polling, by a Matrix to-device nudge or
 * from a story's fake — see `docs/architecture/knock-to-join.md`.
 */
export interface JoinRequestTransport {
	/**
	 * Knocks with the token of the invite link she came with (the server
	 * refuses a knock without it, 403). Resolves with her own request only.
	 */
	knock: (
		seriesId: number,
		inviteToken: string
	) => Promise<GroupChatJoinRequestOwnStatus>;
	/**
	 * Her newest request for this group, `null` if none. Rejects with
	 * `JoinRequestsUnavailableError` where the server has no knock endpoints.
	 */
	getMine: (
		seriesId: number
	) => Promise<GroupChatJoinRequestOwnStatus | null>;
	cancelMine: (seriesId: number) => Promise<void>;
	/** Calls back whenever her request changes. Returns the unsubscribe. */
	watchMine: (
		seriesId: number,
		onChange: (status: GroupChatJoinRequestOwnStatus | null) => void
	) => () => void;
	/**
	 * Calls back with every open request of every group the caller moderates,
	 * oldest first, whenever that list changes. Returns the unsubscribe.
	 */
	watchPending: (
		onChange: (requests: GroupChatJoinRequest[]) => void
	) => () => void;
	admit: (
		request: GroupChatJoinRequest,
		role: GroupChatJoinAdmitRole
	) => Promise<void>;
	decline: (request: GroupChatJoinRequest) => Promise<void>;
}

/** The server this app talks to does not offer knocking (yet). */
export class JoinRequestsUnavailableError extends Error {
	constructor() {
		super('JOIN_REQUESTS_UNAVAILABLE');
	}
}

/** The server refused the knock's invite token (403): the link is no longer valid. */
export class JoinRequestLinkInvalidError extends Error {
	constructor() {
		super('JOIN_REQUEST_LINK_INVALID');
	}
}
